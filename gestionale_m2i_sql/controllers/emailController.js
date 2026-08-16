const { knex } = require('../db');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads');

// 1. Configurazione Email (GET)
exports.getConfigurazione = async (req, res) => {
  try {
    const row = await knex('configurazione_email').where({ chiave: 'smtp_config' }).first();
    if (row) {
      res.json({ success: true, data: JSON.parse(row.valore) });
    } else {
      res.json({ 
        success: true, 
        data: {
          host: 'smtp.gmail.com',
          port: '465',
          user: '',
          pass: '',
          secure: true,
          imap_host: 'imaps.aruba.it',
          imap_port: '993',
          imap_secure: true,
          imap_user: '',
          imap_pass: '',
          use_smtp_creds: true
        }
      });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// 2. Configurazione Email (POST)
exports.salvaConfigurazione = async (req, res) => {
  try {
    const { 
      host, port, user, pass, secure, nome_mittente,
      imap_host, imap_port, imap_secure, imap_user, imap_pass, use_smtp_creds 
    } = req.body;
    
    if (!host || !port || !user) {
      return res.status(400).json({ success: false, error: 'Dati SMTP incompleti' });
    }
    
    const valore = JSON.stringify({ 
      host, port, user, pass: pass || '', secure,
      nome_mittente: nome_mittente || '',
      imap_host: imap_host || 'imaps.aruba.it',
      imap_port: imap_port || '993',
      imap_secure: imap_secure !== undefined ? imap_secure : true,
      imap_user: imap_user || '',
      imap_pass: imap_pass || '',
      use_smtp_creds: use_smtp_creds !== undefined ? use_smtp_creds : true
    });
    
    const existing = await knex('configurazione_email').where({ chiave: 'smtp_config' }).first();
    if (existing) {
      await knex('configurazione_email').where({ chiave: 'smtp_config' }).update({ valore });
    } else {
      await knex('configurazione_email').insert({ chiave: 'smtp_config', valore });
    }
    
    res.json({ success: true, message: 'Configurazione server salvata con successo!' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// Helper: Sync IMAP
async function syncImapEmails(config, limit = 50, offset = 0) {
  const host = config.imap_host || 'imaps.aruba.it';
  const port = parseInt(config.imap_port) || 993;
  const secure = config.imap_secure !== undefined ? config.imap_secure : true;
  const user = config.use_smtp_creds ? config.user : (config.imap_user || config.user);
  const pass = config.use_smtp_creds ? config.pass : (config.imap_pass || config.pass);

  if (!host || !user || !pass) {
    throw new Error('Configurazione IMAP incompleta.');
  }

  const client = new ImapFlow({ host, port, secure, auth: { user, pass }, logger: false });
  client.on('error', err => console.error('ImapFlow Error:', err));
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  let newCount = 0;
  
  try {
    const total = client.mailbox.exists;
    if (total > 0) {
      const endSeq = Math.max(1, total - offset);
      const startSeq = Math.max(1, total - offset - limit + 1);

      if (endSeq >= startSeq) {
        const messages = client.fetch(`${startSeq}:${endSeq}`, { source: true, envelope: true, flags: true, uid: true });
        for await (const message of messages) {
          try {
            const dateStr = message.envelope.date ? new Date(message.envelope.date).toISOString() : new Date().toISOString();
            const subject = message.envelope.subject || 'Senza Oggetto';
            const fromEmail = message.envelope.from && message.envelope.from[0] ? `${message.envelope.from[0].address}` : 'sconosciuto@mittente.com';
            
            const id = `EM_IMAP_${message.uid}`;
            const existing = await knex('emails').where({ id }).orWhere({ mittente: fromEmail, data_invio: dateStr, oggetto: subject }).first();

            if (!existing) {
              const parsed = await simpleParser(message.source);
              const mittente = fromEmail;
              const destinatario = user;
              const oggetto = parsed.subject || subject;
              const corpo = parsed.text || parsed.html || '(Corpo del messaggio vuoto o non leggibile)';
              const dataInvio = dateStr;
              const tipo = 'incoming';
              const stato = 'Ricevuta';
              const cartella = 'inbox';
              const letto = message.flags.has('\\\\Seen') ? 1 : 0;
              const preferito = message.flags.has('\\\\Flagged') ? 1 : 0;

              const attachmentsList = [];
              if (parsed.attachments && parsed.attachments.length > 0) {
                const docDir = path.join(uploadsDir, 'doc');
                if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });
                for (const att of parsed.attachments) {
                  const safeFilename = att.filename ? att.filename.replace(/[^a-zA-Z0-9.\\-_]/g, '_') : 'allegato';
                  const localName = `${id}_${Date.now()}_${safeFilename}`;
                  const localPath = path.join(docDir, localName);
                  fs.writeFileSync(localPath, att.content);
                  attachmentsList.push({ filename: att.filename || 'allegato', localName, contentType: att.contentType, size: att.size });
                }
              }
              const allegatiJson = attachmentsList.length > 0 ? JSON.stringify(attachmentsList) : null;

              await knex('emails').insert({
                id, data_invio: dataInvio, mittente, destinatario, oggetto, corpo, tipo, stato, cartella, letto, preferito, allegati: allegatiJson
              });
              newCount++;
            }
          } catch (err) {
            console.error("Errore parsing IMAP msg:", err.message);
          }
        }
      }
    }
  } finally {
    lock.release();
  }
  await client.logout();
  return newCount;
}

exports.syncEmails = async (req, res) => {
  try {
    const { limit, offset } = req.body;
    const configRow = await knex('configurazione_email').where({ chiave: 'smtp_config' }).first();
    if (!configRow) {
      return res.status(400).json({ success: false, error: 'Configurazione e-mail mancante.' });
    }
    const config = JSON.parse(configRow.valore);
    
    if (!offset || parseInt(offset) === 0) {
      await knex('emails').where('id', 'like', 'EM_IMAP_%').whereNull('allegati').del();
    }

    const addedCount = await syncImapEmails(config, parseInt(limit) || 50, parseInt(offset) || 0);
    res.json({ success: true, addedCount });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.getEmails = async (req, res) => {
  try {
    const { filter, cartella } = req.query;
    let list = [];
    if (filter === 'preferiti') {
      list = await knex('emails').where({ preferito: 1 }).orderBy('data_invio', 'desc');
    } else if (filter === 'posticipati') {
      list = await knex('emails').whereNotNull('data_posticipato').orderBy('data_invio', 'desc');
    } else if (cartella) {
      list = await knex('emails').where({ cartella }).orderBy('data_invio', 'desc');
    } else {
      list = await knex('emails').orderBy('data_invio', 'desc');
    }
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

async function inviaEmailHelper(destinatario, oggetto, corpo, configRow) {
  if (!configRow) return { success: false, error: "Nessuna configurazione SMTP trovata." };
  const config = JSON.parse(configRow.valore);
  if (!config.host || !config.user) return { success: false, error: "Configurazione SMTP incompleta." };

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: parseInt(config.port) || 465,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass }
  });

  try {
    const nomeMittente = config.nome_mittente || "Gestionale M2I";
    await transporter.sendMail({
      from: `"${nomeMittente}" <${config.user}>`,
      to: destinatario,
      subject: oggetto,
      text: corpo
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

exports.sendEmail = async (req, res) => {
  try {
    const { destinatario, oggetto, corpo, id_dipendente, id_cliente } = req.body;
    if (!destinatario || !oggetto || !corpo) {
      return res.status(400).json({ success: false, error: 'Dati incompleti per invio e-mail' });
    }
    const configRow = await knex('configurazione_email').where({ chiave: 'smtp_config' }).first();
    const mittente = configRow ? JSON.parse(configRow.valore).user : 'sconosciuto';
    
    const emailResult = await inviaEmailHelper(destinatario, oggetto, corpo, configRow);
    const stato = emailResult.success ? 'Inviata' : 'Fallita';
    
    const id = `EM_OUT_${Date.now()}`;
    await knex('emails').insert({
      id, data_invio: new Date().toISOString(), mittente, destinatario, oggetto, corpo, 
      tipo: 'outgoing', stato, id_dipendente: id_dipendente || null, id_cliente: id_cliente || null, 
      cartella: 'sent', letto: 1
    });

    if (!emailResult.success) {
      return res.status(500).json({ success: false, error: emailResult.error || 'Errore invio email' });
    }
    res.json({ success: true, message: 'Email inviata con successo!', id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.toggleLetto = async (req, res) => {
  try {
    const { letto } = req.body;
    await knex('emails').where({ id: req.params.id }).update({ letto: letto ? 1 : 0 });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.togglePreferito = async (req, res) => {
  try {
    const { preferito } = req.body;
    await knex('emails').where({ id: req.params.id }).update({ preferito: preferito ? 1 : 0 });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.setCartella = async (req, res) => {
  try {
    const { cartella } = req.body;
    await knex('emails').where({ id: req.params.id }).update({ cartella, data_posticipato: null });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.snooze = async (req, res) => {
  try {
    const { data_posticipato } = req.body;
    await knex('emails').where({ id: req.params.id }).update({ data_posticipato: data_posticipato || null, cartella: 'inbox' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.deleteEmail = async (req, res) => {
  try {
    await knex('emails').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// Send busta paga via email with PDF attachment
exports.sendBustaPagaEmail = async (req, res) => {
  try {
    const { buste, emailDipendentiUpdate } = req.body;
    if (!buste || buste.length === 0) {
      return res.status(400).json({ success: false, error: 'Nessuna busta paga selezionata.' });
    }

    // Save manually entered emails to dipendenti records
    if (emailDipendentiUpdate && emailDipendentiUpdate.length > 0) {
      for (const upd of emailDipendentiUpdate) {
        if (upd.id_dipendente && upd.email) {
          await knex('dipendenti').where({ id: upd.id_dipendente }).update({ email: upd.email });
        }
      }
    }

    const configRow = await knex('configurazione_email').where({ chiave: 'smtp_config' }).first();
    if (!configRow) {
      return res.status(400).json({ success: false, error: 'Nessuna configurazione SMTP trovata. Configura l\'email nelle impostazioni.' });
    }
    const config = JSON.parse(configRow.valore);
    if (!config.host || !config.user) {
      return res.status(400).json({ success: false, error: 'Configurazione SMTP incompleta.' });
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port) || 465,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass }
    });

    const nomeMittente = config.nome_mittente || "Gestionale M2I";
    const risultati = [];

    for (const busta of buste) {
      try {
        const filePath = path.join(__dirname, '..', busta.allegato_busta_paga);
        if (!fs.existsSync(filePath)) {
          risultati.push({ id: busta.id, dipendente: busta.dipendente, success: false, error: 'File PDF non trovato sul server.' });
          continue;
        }

        await transporter.sendMail({
          from: `"${nomeMittente}" <${config.user}>`,
          to: busta.email,
          subject: `Busta Paga - ${busta.mese_label || ''} ${busta.anno || ''}`.trim(),
          text: `Gentile ${busta.dipendente},\n\nin allegato trova la sua busta paga.\n\nCordiali saluti,\n${nomeMittente}`,
          attachments: [{
            filename: `Busta_Paga_${busta.dipendente.replace(/\s+/g, '_')}.pdf`,
            path: filePath
          }]
        });

        // Mark as emailed in DB
        await knex('buste_paga').where({ id: busta.id }).update({ 
          email_inviata: 1, 
          data_invio_email: new Date().toISOString() 
        });

        risultati.push({ id: busta.id, dipendente: busta.dipendente, success: true });
      } catch (err) {
        risultati.push({ id: busta.id, dipendente: busta.dipendente, success: false, error: err.message });
      }
    }

    const inviate = risultati.filter(r => r.success).length;
    const fallite = risultati.filter(r => !r.success).length;

    res.json({ 
      success: true, 
      message: `Inviate ${inviate} su ${risultati.length} buste paga.${fallite > 0 ? ` ${fallite} invii falliti.` : ''}`,
      risultati 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
