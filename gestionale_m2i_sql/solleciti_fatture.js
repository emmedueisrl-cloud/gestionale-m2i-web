const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');

const validEmail = value => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(value);
const cleanEmail = value => String(value || '').trim().toLowerCase();
const uniqueEmails = values => [...new Set(values.map(cleanEmail).filter(Boolean))];
const dateIt = value => /^\d{4}-\d{2}-\d{2}/.test(value || '') ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : 'data non disponibile';
const euros = value => Number(value).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

function createReminderService(knex, receipts, options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || __dirname;
  const createTransport = options.createTransport || (config => nodemailer.createTransport(config));

  async function ensureSentRemindersTable() {
    if (await knex.schema.hasTable('solleciti_fatture_inviati')) return;
    await knex.schema.createTable('solleciti_fatture_inviati', table => {
      table.text('id').primary();
      table.text('email_id').notNullable();
      table.text('fattura_id').notNullable().index();
      table.text('cliente_id').notNullable();
      table.text('inviato_at').notNullable();
    });
  }

  async function openInvoices(clientId) {
    const result = await receipts.list();
    const rows = result.fatture.filter(row => String(row.clienteId) === String(clientId) && row.registrata && row.residuo > 0 &&
      row.tipoDocumento !== 'TD04' && !row.incongruenza && !row.daCollegare && row.gestibile);
    const registrations = await knex('fatture_aruba_elaborati').where({ cliente_id: clientId })
      .select('id', 'fattura_id', 'allegato_path');
    const historical = await knex.schema.hasTable('fatture_storiche_insoluti')
      ? await knex('fatture_storiche_insoluti as h').join('fatture as f', 'h.fattura_id', 'f.id')
        .where({ 'f.cliente_id': clientId }).select('h.fattura_id', 'h.pdf_path') : [];
    const roots = ['fatture_aruba', 'fatture_storiche'].map(folder => path.resolve(dataDir, 'uploads', folder));
    return rows.map(row => {
      const registration = registrations.find(item => `aruba:${item.id}` === String(row.id) ||
        (item.fattura_id && String(item.fattura_id) === String(row.id)));
      const archive = historical.find(item => String(item.fattura_id) === String(row.id));
      const relative = registration?.allegato_path || archive?.pdf_path;
      const file = relative ? path.resolve(dataDir, relative) : '';
      const allegabile = Boolean(file && roots.some(root => file.startsWith(root + path.sep)) &&
        path.extname(file).toLowerCase() === '.pdf' && fs.existsSync(file));
      return { id: row.id, numero: row.numero, dataFattura: row.dataFattura, scadenza: row.scadenza,
        residuo: row.residuo, cliente: row.cliente, allegabile, registrationId: registration?.id, file: allegabile ? file : '' };
    });
  }

  async function preview(invoiceId) {
    const all = (await receipts.list()).fatture;
    const source = all.find(row => String(row.id) === String(invoiceId));
    if (!source?.clienteId || !source.registrata || source.residuo <= 0) throw new Error('Fattura aperta non trovata.');
    const client = await knex('clienti').where({ id: source.clienteId }).first('id', 'ragione_sociale', 'email', 'email_secondaria');
    if (!client) throw new Error('Anagrafica cliente non trovata.');
    const invoices = await openInvoices(source.clienteId);
    if (!invoices.some(row => String(row.id) === String(invoiceId))) throw new Error('Verifica prima la fattura nel registro incassi.');
    return { cliente: { id: client.id, nome: client.ragione_sociale, email: client.email || '', emailSecondaria: client.email_secondaria || '' },
      fatture: invoices.map(({ file, registrationId, ...row }) => row), fatturaIniziale: String(invoiceId) };
  }

  async function send(input) {
    const ids = [...new Set((Array.isArray(input?.fatture) ? input.fatture : []).map(String))];
    if (!ids.length || ids.length > 100) throw new Error('Seleziona almeno una fattura.');
    const draft = await preview(ids[0]);
    const open = await openInvoices(draft.cliente.id);
    const selected = ids.map(id => open.find(row => String(row.id) === id));
    if (selected.some(row => !row)) throw new Error('Le fatture selezionate non risultano più aperte per questo cliente. Aggiorna il sollecito.');
    const attachmentIds = [...new Set((Array.isArray(input?.allegati) ? input.allegati : []).map(String))];
    if (attachmentIds.some(id => !ids.includes(id) || !selected.find(row => String(row.id) === id)?.allegabile)) {
      throw new Error('Uno degli allegati selezionati non è disponibile.');
    }
    const to = uniqueEmails(Array.isArray(input?.destinatari) ? input.destinatari : []);
    const cc = uniqueEmails(Array.isArray(input?.cc) ? input.cc : []);
    if (!to.length || [...to, ...cc].some(email => !validEmail(email) || email.length > 254)) throw new Error('Controlla gli indirizzi email del destinatario e del CC.');
    const subject = String(input?.oggetto || '').trim();
    const body = String(input?.corpo || '').trim();
    if (!subject || subject.length > 250 || !body || body.length > 10000) throw new Error('Completa oggetto e testo dell’email.');
    const update = input?.aggiornamentoEmail || 'nessuno';
    const newEmail = cleanEmail(input?.nuovaEmail);
    if (!['nessuno', 'sostituisci', 'secondaria'].includes(update)) throw new Error('Scelta di aggiornamento email non valida.');
    if (update !== 'nessuno') {
      if (!validEmail(newEmail) || !to.includes(newEmail)) throw new Error('La nuova email deve essere tra i destinatari del sollecito.');
      if (update === 'secondaria' && draft.cliente.emailSecondaria && cleanEmail(draft.cliente.emailSecondaria) !== newEmail) {
        throw new Error('La seconda email è già occupata. Scegli di usarla solo per questo invio o di sostituire la principale.');
      }
    }
    const configRow = await knex('configurazione_email').where({ chiave: 'smtp_config' }).first();
    if (!configRow) throw new Error('Configura prima l’invio email nelle impostazioni.');
    const config = JSON.parse(configRow.valore);
    if (!config.host || !config.user) throw new Error('Configurazione SMTP incompleta.');
    const attachments = attachmentIds.map(id => {
      const invoice = selected.find(row => String(row.id) === id);
      return { filename: `Fattura_${String(invoice.numero || invoice.registrationId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        path: invoice.file, contentType: 'application/pdf' };
    });
    const transporter = createTransport({ host: config.host, port: Number(config.port) || 465,
      secure: Boolean(config.secure), auth: { user: config.user, pass: config.pass } });
    await ensureSentRemindersTable();
    await transporter.sendMail({ from: { name: config.nome_mittente || 'Gestionale M2I', address: config.user },
      to: to.join(', '), cc: cc.join(', ') || undefined, subject, text: body, attachments });
    const warnings = [];
    const emailId = `EM_SOL_${crypto.randomUUID()}`;
    try {
      await knex('solleciti_fatture_inviati').insert(selected.map(invoice => ({ id: crypto.randomUUID(), email_id: emailId,
        fattura_id: invoice.registrationId ? `aruba:${invoice.registrationId}` : String(invoice.id),
        cliente_id: draft.cliente.id, inviato_at: new Date().toISOString() })));
    } catch (error) { warnings.push('Email inviata, ma conteggio solleciti non aggiornato.'); console.error(error); }
    if (update !== 'nessuno') {
      try { await knex('clienti').where({ id: draft.cliente.id }).update(update === 'sostituisci' ? { email: newEmail } : { email_secondaria: newEmail }); }
      catch (error) { warnings.push('Email inviata, ma indirizzo non salvato in anagrafica.'); console.error(error); }
    }
    try {
      await knex('emails').insert({ id: emailId, data_invio: new Date().toISOString(),
        mittente: config.user, destinatario: to.join(', '), oggetto: subject, corpo: body, tipo: 'outgoing', stato: 'Inviata',
        id_cliente: draft.cliente.id, cartella: 'sent', letto: 1,
        allegati: JSON.stringify(attachmentIds.map(id => ({ filename: attachments[attachmentIds.indexOf(id)].filename,
          url: `/api/contabilita/fatture/${selected.find(row => String(row.id) === id).registrationId}/allegato` }))) });
    } catch (error) { warnings.push('Email inviata, ma storico non aggiornato.'); console.error(error); }
    return { success: true, warning: warnings.join(' ') };
  }

  return { preview, send };
}

module.exports = { createReminderService };
