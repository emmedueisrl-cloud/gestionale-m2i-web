const { knex } = require('./db');

const DEFAULTS = {
  commerciale1Nome: 'Mauro Martinelli',
  commerciale1Telefono: '3473673505',
  commerciale2Nome: 'Maggi Andrea',
  commerciale2Telefono: '3517987985',
  ufficioTelefono: '3515471406',
  email: 'emmedueisrl@gmail.com'
};

async function ensureTable() {
  if (!await knex.schema.hasTable('riferimenti_aziendali')) {
    await knex.schema.createTable('riferimenti_aziendali', table => {
      table.integer('id').primary();
      for (const key of Object.keys(DEFAULTS)) table.string(key, 255).notNullable();
    });
  }
  if (!await knex('riferimenti_aziendali').where({ id: 1 }).first()) {
    await knex('riferimenti_aziendali').insert({ id: 1, ...DEFAULTS });
  }
}

async function get() {
  const row = await knex('riferimenti_aziendali').where({ id: 1 }).first();
  return Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, row?.[key] ?? DEFAULTS[key]]));
}

async function update(input) {
  const values = {};
  for (const key of Object.keys(DEFAULTS)) {
    const value = String(input?.[key] ?? '').trim();
    if (!value || value.length > 255) throw new Error('Compila tutti i riferimenti aziendali (massimo 255 caratteri per campo).');
    values[key] = value;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw new Error('Inserisci un indirizzo email valido.');
  await knex('riferimenti_aziendali').where({ id: 1 }).update(values);
  return values;
}

module.exports = { ensureTable, get, update };
