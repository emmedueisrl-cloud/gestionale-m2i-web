const crypto = require('node:crypto');
const path = require('node:path');
const nodemailer = require('nodemailer');
const pdfmake = require('pdfmake');
const { knex } = require('./db');
const workflowElaborati = require('./workflow_elaborati');

const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const fonts = { Roboto: {
  normal: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
  bold: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
  italics: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
  bolditalics: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf')
} };
const emailKey = 'email_consulente_elaborati';
const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function getRecipient() {
  const row = await knex('configurazioni').where({ chiave: emailKey }).first();
  return { email: row?.valore || '' };
}

async function saveRecipient(value) {
  const email = String(value || '').trim();
  if (!validEmail(email)) throw new Error('Inserisci un indirizzo email valido per il consulente.');
  await knex('configurazioni').insert({ chiave: emailKey, valore: email })
    .onConflict('chiave').merge(['valore']);
  return { email };
}

async function buildConsultantPdf(mese, anno) {
  const p = workflowElaborati.period('dipendente', mese, anno);
  const periodo = `${months[p.mese - 1]} ${p.anno}`;
  const rows = (await workflowElaborati.accountingRows('dipendente', p.mese, p.anno))
    .filter(row => row.notaConsulente?.trim())
    .map(row => [
      { text: row.cognomeNome || '', bold: true },
      { text: row.notaConsulente, preserveLeadingSpaces: true }
    ]);
  const definition = {
    pageSize: 'A4', pageMargins: [36, 40, 36, 40],
    content: [
      { text: periodo, fontSize: 18, bold: true, margin: [0, 0, 0, 22] },
      { table: { headerRows: 1, widths: [175, '*'], body: [
        [{ text: 'Dipendente', bold: true }, { text: 'Note consulente', bold: true }],
        ...(rows.length ? rows : [[{ text: 'Nessun dipendente' }, { text: 'Nessuna nota per consulente.' }]])
      ] }, layout: { fillColor: rowIndex => rowIndex === 0 ? '#e9edf2' : null,
        hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1',
        paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 8, paddingBottom: () => 8 } }
    ],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#111827' }
  };
  pdfmake.addFonts(fonts);
  return pdfmake.createPdf(definition).getBuffer();
}

async function send({ mese, anno, destinatario, oggetto, corpo }) {
  const p = workflowElaborati.period('dipendente', mese, anno);
  const saved = await getRecipient();
  if (!saved.email || destinatario !== saved.email) throw new Error('Il destinatario deve corrispondere all’email consulente salvata.');
  if (!validEmail(destinatario) || typeof oggetto !== 'string' || !oggetto.trim() || oggetto.length > 200 || typeof corpo !== 'string' || !corpo.trim() || corpo.length > 10000) {
    throw new Error('Completa destinatario, oggetto e testo dell’email.');
  }
  const configRow = await knex('configurazione_email').where({ chiave: 'smtp_config' }).first();
  if (!configRow) throw new Error('Configura prima l’email SMTP nelle impostazioni del gestionale.');
  const config = JSON.parse(configRow.valore);
  if (!config.host || !config.user) throw new Error('Configurazione SMTP incompleta.');
  const pdf = await buildConsultantPdf(p.mese, p.anno);
  const filename = `Per_consulente_${months[p.mese - 1]}_${p.anno}.pdf`;
  const transporter = nodemailer.createTransport({
    host: config.host, port: parseInt(config.port, 10) || 465, secure: config.secure,
    auth: { user: config.user, pass: config.pass }
  });
  await transporter.sendMail({
    from: `"${config.nome_mittente || 'Gestionale M2I'}" <${config.user}>`,
    to: destinatario, subject: oggetto.trim(), text: corpo.trim(),
    attachments: [{ filename, content: pdf, contentType: 'application/pdf' }]
  });
  try {
    await knex('emails').insert({
      id: `EM_OUT_${crypto.randomUUID()}`, data_invio: new Date().toISOString(), mittente: config.user,
      destinatario, oggetto: oggetto.trim(), corpo: corpo.trim(), tipo: 'outgoing', stato: 'Inviata',
      cartella: 'sent', letto: 1
    });
  } catch (error) {
    // L'invio è già avvenuto: non presentarlo come fallito per evitare un secondo invio.
    console.error('[EMAIL CONSULENTE] Invio riuscito, salvataggio storico non riuscito:', error);
  }
  return { success: true, message: `Email inviata a ${destinatario}.` };
}

module.exports = { getRecipient, saveRecipient, buildConsultantPdf, send };
