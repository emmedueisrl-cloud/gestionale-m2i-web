const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const knex = require('knex')({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });

const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { knex } };
const operatori = require('../operatori');

before(async () => {
  const connection = await knex.client.acquireConnection();
  try {
    await new Promise((resolve, reject) => connection.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'),
      error => error ? reject(error) : resolve()));
  } finally { await knex.client.releaseConnection(connection); }
  await knex('clienti').insert({ id: 'C1', ragione_sociale: 'Cliente', partita_iva: 'P1', operatore: 'Operatore Storico' });
  await operatori.ensureTables();
});

after(() => knex.destroy());

test('importa gli operatori già presenti nelle schede cliente', async () => {
  const elenco = await operatori.elencaOperatori();
  assert.deepEqual(elenco.map(item => item.nome), ['Operatore Storico']);
  assert.deepEqual(elenco[0].clientiAttivi, [{ id: 'C1', ragioneSociale: 'Cliente' }]);
});

test('la cessazione vale dal mese successivo e la riattivazione riapre lo storico', async () => {
  const [operatore] = await operatori.elencaOperatori();
  await operatori.cessaOperatore(operatore.id, '2026-10-05');
  assert.equal((await operatori.nomiAttiviNelMese(10, 2026)).has('operatore storico'), true);
  assert.equal((await operatori.nomiAttiviNelMese(11, 2026)).has('operatore storico'), false);

  await operatori.riattivaOperatore(operatore.id, '2026-12-10');
  assert.equal((await operatori.nomiAttiviNelMese(12, 2026)).has('operatore storico'), true);
});
