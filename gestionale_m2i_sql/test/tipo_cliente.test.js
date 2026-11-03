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

    let prossimoId = 4;
    const dbPath = require.resolve('../db');
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
      knex, getVal: (data, key) => data?.[key], generaIDIncrementale: async () => `C${prossimoId++}`
    } };
    const clienti = require('../controllers/clienti');
    await assert.rejects(() => clienti.salvaCliente({ ragioneSociale: 'Privato senza CF', tipoCliente: 'PRIVATO' }), /codice fiscale/);
    await clienti.salvaCliente({ ragioneSociale: 'Nuovo privato', tipoCliente: 'PRIVATO',
      codiceFiscale: 'RSSMRA80A01H501U', dataInizioAttivita: '2026-10-01' });
    assert.deepEqual(await knex('clienti').where({ id: 'C4' }).first('tipo_cliente', 'partita_iva', 'codice_fiscale'),
      { tipo_cliente: 'PRIVATO', partita_iva: null, codice_fiscale: 'RSSMRA80A01H501U' });
    await clienti.salvaCliente({ ragioneSociale: 'Ente con solo CF', tipoCliente: 'PARTITA_IVA',
      codiceFiscale: '96117270585', dataInizioAttivita: '2026-10-01' });
    assert.deepEqual(await knex('clienti').where({ id: 'C5' }).first('tipo_cliente', 'partita_iva', 'codice_fiscale'),
      { tipo_cliente: 'PARTITA_IVA', partita_iva: null, codice_fiscale: '96117270585' });
    await assert.rejects(() => clienti.aggiornaDatiCliente({ id: 'C5', ragioneSociale: 'Ente con solo CF',
      tipoCliente: 'PARTITA_IVA', codiceFiscale: '123' }), /11 cifre o 16 caratteri/);
    await clienti.aggiornaDatiCliente({ id: 'C5', ragioneSociale: 'Ente con solo CF',
      tipoCliente: 'PARTITA_IVA', codiceFiscale: '06117270585' });
    assert.equal((await knex('clienti').where({ id: 'C5' }).first('codice_fiscale')).codice_fiscale, '06117270585');
    await clienti.aggiornaDatiCliente({ id: 'C1', ragioneSociale: 'Azienda', tipoCliente: 'PRIVATO',
      codiceFiscale: 'VRDLCU80A01H501A' });
    assert.deepEqual(await knex('clienti').where({ id: 'C1' }).first('tipo_cliente', 'partita_iva', 'codice_fiscale'),
      { tipo_cliente: 'PRIVATO', partita_iva: null, codice_fiscale: 'VRDLCU80A01H501A' });
  } finally { await knex.destroy(); }
});

test('rende facoltativa la partita IVA anche con chiavi esterne storiche orfane', async () => {
  const knex = makeKnex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true,
    pool: { min: 1, max: 1, afterCreate: (connection, done) => connection.run('PRAGMA foreign_keys = ON', done) } });
  try {
    await knex.schema.createTable('clienti', table => {
      table.text('id').primary();
      table.text('ragione_sociale').notNullable();
      table.text('partita_iva').unique().notNullable();
    });
    await knex.schema.createTable('storico', table => {
      table.integer('id').primary();
      table.text('cliente_id').references('id').inTable('clienti');
    });
    await knex('clienti').insert({ id: 'C1', ragione_sociale: 'Azienda', partita_iva: '12345678901' });
    const connection = await knex.client.acquireConnection();
    try {
      await new Promise((resolve, reject) => connection.exec(
        "PRAGMA foreign_keys = OFF; INSERT INTO storico (id, cliente_id) VALUES (1, 'C_MANCANTE'); PRAGMA foreign_keys = ON;",
        error => error ? reject(error) : resolve()
      ));
    } finally { await knex.client.releaseConnection(connection); }
    assert.equal((await knex.raw('PRAGMA foreign_key_check')).length, 1);

    await ensureTipoCliente(knex);
    await ensureTipoCliente(knex);

    assert.equal((await knex.raw('PRAGMA foreign_key_check')).length, 1);
    assert.deepEqual(await knex('clienti').where({ id: 'C1' }).first('partita_iva', 'tipo_cliente'),
      { partita_iva: '12345678901', tipo_cliente: 'PARTITA_IVA' });
    await knex('clienti').insert({ id: 'C2', ragione_sociale: 'Privato', partita_iva: null, tipo_cliente: 'PRIVATO' });
    await assert.rejects(() => knex('storico').insert({ id: 2, cliente_id: 'C_ASSENTE' }), /FOREIGN KEY/);
  } finally { await knex.destroy(); }
});
