const { knex } = require('./db');

async function ensureTable() {
  if (await knex.schema.hasTable('public_appointment_notifications')) return;
  await knex.schema.createTable('public_appointment_notifications', table => {
    table.increments('id').primary();
    table.integer('appuntamento_id').notNullable();
    table.string('nominativo', 255).notNullable();
    table.text('testo').notNullable();
    table.string('creata_il', 24).notNullable();
    table.index(['id']);
  });
}

async function appointment(id, db = knex) {
  return db('appuntamenti_preventivi').where('id', id).first();
}

async function record(id, text, previous = null, db = knex) {
  const current = await appointment(id, db);
  const visible = current?.origine_pubblica || previous?.origine_pubblica;
  if (!visible) return;
  await db('public_appointment_notifications').insert({
    appuntamento_id: Number(id),
    nominativo: current?.nominativo || previous?.nominativo || 'Appuntamento',
    testo: text,
    creata_il: new Date().toISOString()
  });
}

async function list() {
  return knex('public_appointment_notifications')
    .select('id', 'appuntamento_id as appuntamentoId', 'nominativo', 'testo', 'creata_il as creataIl')
    .orderBy('id', 'desc').limit(30);
}

const fields = {
  data_ora: 'Data e ora', nominativo: 'Cliente', referente: 'Referente', telefono: 'Telefono',
  email: 'Email', incaricato: 'Chi lo svolge', operatore: 'Operatore', luogo: 'Luogo',
  attivita: 'Attività', note: 'Note della scheda', stato: 'Stato', esito: 'Esito'
};

function describeEdit(before, after) {
  if (!before?.origine_pubblica && after?.origine_pubblica) return 'Appuntamento condiviso con il link.';
  const changed = Object.entries(fields).filter(([key]) => String(before?.[key] ?? '') !== String(after?.[key] ?? ''));
  if (!changed.length) return '';
  const details = changed.filter(([key]) => ['data_ora', 'incaricato', 'operatore', 'luogo', 'stato'].includes(key))
    .map(([key, label]) => `${label}: ${String(after[key] || 'vuoto').slice(0, 100)}`);
  return `Scheda aggiornata: ${changed.map(([, label]) => label).join(', ')}.${details.length ? ` Nuovi valori: ${details.join('; ')}.` : ''}`;
}

module.exports = { ensureTable, appointment, record, list, describeEdit };
