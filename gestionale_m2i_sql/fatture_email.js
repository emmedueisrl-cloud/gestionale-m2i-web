const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { descrizionePredefinita } = require('./descrizioni_fatture');

const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

function createInvoiceEmailService(knex, options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || __dirname;
  const createTransport = options.createTransport || (config => nodemailer.createTransport(config));

  async function invoiceDetails(id) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new Error('Fattura non valida.');
    const invoice = await knex('fatture_aruba_elaborati as f')
      .join('clienti as c', 'f.cliente_id', 'c.id')
      .where('f.id', Number(id))
      .first('f.id', 'f.cliente_id', 'f.mese', 'f.anno', 'f.numero_fattura', 'f.allegato_path',
        'c.ragione_sociale', 'c.email', 'c.email_secondaria', 'c.pec', 'c.causale_fattura');
    if (!invoice) throw new Error('Fattura non trovata.');
    const root = path.resolve(dataDir, 'uploads', 'fatture_aruba');
    const file = invoice.allegato_path ? path.resolve(dataDir, invoice.allegato_path) : '';
    if (!file.startsWith(root + path.sep) || path.extname(file).toLowerCase() !== '.pdf' || !fs.existsSync(file)) {
      throw new Error('Il PDF della fattura non è disponibile.');
    }
    const extraGroup = await knex('gruppi_fatturazione_extra').where('fattura_registrazione_id', invoice.id).first('id', 'tipo', 'nome');
    const descriptionKey = extraGroup?.tipo === 'extra' ? { tipo: 'extra', soggetto_id: extraGroup.id } : { tipo: 'cliente', soggetto_id: invoice.cliente_id };
    const savedDescription = await knex('descrizioni_fatture_elaborati').where({ ...descriptionKey, mese: invoice.mese, anno: invoice.anno }).first('descrizione');
    const service = extraGroup?.tipo === 'extra' ? await knex('servizi_extra').where('gruppo_id', extraGroup.id).first('descrizione_fattura', 'nome') : null;
    const description = String(savedDescription?.descrizione || service?.descrizione_fattura || service?.nome ||
      (extraGroup?.tipo === 'extra' ? extraGroup.nome : descrizionePredefinita(invoice, invoice.mese, invoice.anno))).trim();
    const pec = String(invoice.pec || '').trim().toLowerCase();
    const recipient = [invoice.email, invoice.email_secondaria].map(value => String(value || '').trim())
      .find(value => validEmail(value) && value.toLowerCase() !== pec) || '';
    return { invoice, file, description, recipient };
  }

  async function draft(id) {
    const { invoice, description, recipient } = await invoiceDetails(id);
    return {
      id: invoice.id, numero: invoice.numero_fattura, cliente: invoice.ragione_sociale,
      destinatario: recipient,
      oggetto: `Fattura per ${description}`,
      corpo: 'Buongiorno,\n\nin allegato la fattura per il servizio in oggetto.\n\nCordiali saluti,\nM2I S.r.l.',
      allegato: `Fattura_${String(invoice.numero_fattura).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
    };
  }

  async function send(id, input) {
    const { invoice, file } = await invoiceDetails(id);
    const destinatario = String(input?.destinatario || '').trim();
    const oggetto = String(input?.oggetto || '').trim();
    const corpo = String(input?.corpo || '').trim();
    if (!validEmail(destinatario) || destinatario.length > 254 || destinatario.toLowerCase() === String(invoice.pec || '').trim().toLowerCase()) {
      throw new Error('Inserisci un indirizzo email ordinario valido, diverso dalla PEC.');
    }
    if (!oggetto || oggetto.length > 250 || !corpo || corpo.length > 10000) throw new Error('Completa oggetto e testo dell’email.');
    const configRow = await knex('configurazione_email').where({ chiave: 'smtp_config' }).first();
    if (!configRow) throw new Error('Configura prima l’invio email nelle impostazioni.');
    const config = JSON.parse(configRow.valore);
    if (!config.host || !config.user) throw new Error('Configurazione SMTP incompleta.');
    const filename = `Fattura_${String(invoice.numero_fattura).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    const transporter = createTransport({ host: config.host, port: Number(config.port) || 465,
      secure: Boolean(config.secure), auth: { user: config.user, pass: config.pass } });
    await transporter.sendMail({
      from: { name: config.nome_mittente || 'Gestionale M2I', address: config.user },
      to: destinatario, subject: oggetto, text: corpo,
      attachments: [{ filename, path: file, contentType: 'application/pdf' }]
    });
    try {
      await knex('emails').insert({ id: `EM_INV_${crypto.randomUUID()}`, data_invio: new Date().toISOString(),
        mittente: config.user, destinatario, oggetto, corpo, tipo: 'outgoing', stato: 'Inviata',
        id_cliente: invoice.cliente_id, cartella: 'sent', letto: 1,
        allegati: JSON.stringify([{ filename, url: `/api/contabilita/fatture/${invoice.id}/allegato` }]) });
    } catch (error) {
      console.error('Email fattura inviata, registrazione nello storico non riuscita:', error);
    }
    return { success: true };
  }

  return { draft, send };
}

module.exports = { createInvoiceEmailService };
