const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const makeKnex = require('knex');
const { ensureTipoCliente } = require('../tipo_cliente');

test('migra lo schema esistente senza cambiare i clienti con partita IVA', async () => {
  const knex = makeKnex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true,
    pool: { min: 1, max: 1, afterCreate: (connection, done) => connection.run('PRAGMA foreign_keys = ON', done) } });
  try {
    const current = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
    const legacy = current.replace(/partita_iva TEXT UNIQUE,\r?\n    tipo_cliente TEXT NOT NULL DEFAULT 'PARTITA_IVA',/,
      'partita_iva TEXT UNIQUE NOT NULL,');
    assert.notEqual(legacy, current);
    const connection = await knex.client.acquireConnection();
    try {
      await new Promise((resolve, reject) => connection.exec(legacy, error => error ? reject(error) : resolve()));
    } finally { await knex.client.releaseConnection(connection); }
    await knex('clienti').insert({ id: 'C1', ragione_sociale: 'Azienda', partita_iva: '12345678901' });

    await ensureTipoCliente(knex);
    await ensureTipoCliente(knex);
    assert.deepEqual(await knex('clienti').where({ id: 'C1' }).first('partita_iva', 'tipo_cliente'),
      { partita_iva: '12345678901', tipo_cliente: 'PARTITA_IVA' });
    await knex('clienti').insert([
      { id: 'C2', ragione_sociale: 'Mario Rossi', tipo_cliente: 'PRIVATO', codice_fiscale: 'RSSMRA80A01H501U', partita_iva: null },
      { id: 'C3', ragione_sociale: 'Lucia Verdi', tipo_cliente: 'PRIVATO', codice_fiscale: 'VRDLCU80A01H501A', partita_iva: null }
    ]);
    await assert.rejects(() => knex('clienti').insert({ id: 'C4', ragione_sociale: 'Duplicato', partita_iva: '12345678901' }), /UNIQUE/);
    assert.deepEqual(await knex.raw('PRAGMA foreign_key_check'), []);

    const dbPath = require.resolve('../db');
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
      knex, getVal: (data, key) => data?.[key], generaIDIncrementale: async () => 'C4'
    } };
    const clienti = require('../controllers/clienti');
    await assert.rejects(() => clienti.salvaCliente({ ragioneSociale: 'Privato senza CF', tipoCliente: 'PRIVATO' }), /codice fiscale/);
    await clienti.salvaCliente({ ragioneSociale: 'Nuovo privato', tipoCliente: 'PRIVATO',
      codiceFiscale: 'RSSMRA80A01H501U', dataInizioAttivita: '2026-10-01' });
    assert.deepEqual(await knex('clienti').where({ id: 'C4' }).first('tipo_cliente', 'partita_iva', 'codice_fiscale'),
      { tipo_cliente: 'PRIVATO', partita_iva: null, codice_fiscale: 'RSSMRA80A01H501U' });
    await clienti.aggiornaDatiCliente({ id: 'C1', ragioneSociale: 'Azienda', tipoCliente: 'PRIVATO',
      codiceFiscale: 'VRDLCU80A01H501A' });
    assert.deepEqual(await knex('clienti').where({ id: 'C1' }).first('tipo_cliente', 'partita_iva', 'codice_fiscale'),
      { tipo_cliente: 'PRIVATO', partita_iva: null, codice_fiscale: 'VRDLCU80A01H501A' });
  } finally { await knex.destroy(); }
});
