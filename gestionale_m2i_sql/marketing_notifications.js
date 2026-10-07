const { knex } = require('./db');

async function ensureTables() {
  if (!await knex.schema.hasTable('marketing_notifications')) {
    await knex.schema.createTable('marketing_notifications', table => {
      table.increments('id').primary();
      table.integer('appuntamento_id').notNullable();
      table.string('tipo', 20).notNullable();
      table.string('azienda', 255).notNullable();
      table.text('testo').notNullable().defaultTo('');
      table.string('creata_il', 24).notNullable();
    });
  }
  if (!await knex.schema.hasTable('marketing_notification_reads')) {
    await knex.schema.createTable('marketing_notification_reads', table => {
      table.integer('utente_id').primary();
      table.integer('ultimo_id').notNullable().defaultTo(0);
    });
  }
}

async function record(trx, { appointmentId, type, company, text = '' }) {
  await trx('marketing_notifications').insert({
    appuntamento_id: appointmentId,
    tipo: type,
    azienda: company,
    testo: text,
    creata_il: new Date().toISOString()
  });
}

async function listUnread(userId) {
  const seen = await knex('marketing_notification_reads').where('utente_id', userId).first('ultimo_id');
  return knex('marketing_notifications').where('id', '>', seen?.ultimo_id || 0)
    .select('id', 'appuntamento_id as appuntamentoId', 'tipo', 'azienda', 'testo', 'creata_il as creataIl')
    .orderBy('id', 'asc').limit(50);
}

async function markRead(userId, notificationId) {
  const id = Number(notificationId);
  if (!Number.isSafeInteger(id) || id < 1 || !await knex('marketing_notifications').where({ id }).first('id')) return false;
  await knex.raw(`INSERT INTO marketing_notification_reads (utente_id, ultimo_id)
    VALUES (?, ?) ON CONFLICT(utente_id) DO UPDATE SET ultimo_id = MAX(ultimo_id, excluded.ultimo_id)`, [userId, id]);
  return true;
}

module.exports = { ensureTables, record, listUnread, markRead };
