const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const knex = require('knex')({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });

const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { knex } };
const elaborati = require('../controllers/elaborati');
const operatori = require('../operatori');

before(async () => {
  const connection = await knex.client.acquireConnection();
  try {
    await new Promise((resolve, reject) => connection.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'),
      error => error ? reject(error) : resolve()));
  } finally { await knex.client.releaseConnection(connection); }
  await operatori.ensureTables();
  await knex('clienti').insert([
    { id: 'C_OP_1', ragione_sociale: 'Cliente Uno', partita_iva: 'OP-1', operatore: 'Mario Rossi' },
    { id: 'C_OP_2', ragione_sociale: 'Cliente Due', partita_iva: 'OP-2', operatore: 'mario rossi' },
    { id: 'C_OP_3', ragione_sociale: 'Cliente Tre', partita_iva: 'OP-4', operatore: 'Mario Rossi' },
    { id: 'C_NO_FATT', ragione_sociale: 'Senza Fattura', partita_iva: 'OP-3', operatore: 'Lucia Bianchi' }
  ]);
  await knex('fatture').insert([
    { id: 'F_OP_1', numero_fattura: '1', data_fattura: '2026-09-10', cliente_id: 'C_OP_1', importo_imponibile: 100, importo_iva: 22, importo_totale: 122 },
    { id: 'F_OP_2', numero_fattura: '2', data_fattura: '2026-09-20', cliente_id: 'C_OP_2', importo_imponibile: 200, importo_iva: 44, importo_totale: 244 },
    { id: 'F_OP_3', numero_fattura: '3', data_fattura: '2026-09-25', cliente_id: 'C_OP_3', importo_imponibile: 201, importo_iva: 44.22, importo_totale: 245.22 }
  ]);
  await operatori.creaOperatore('Mario Rossi');
  await operatori.creaOperatore('Lucia Bianchi');
});

after(() => knex.destroy());

test('raggruppa per operatore solo i clienti che hanno fatturato nel periodo', async () => {
  const result = await elaborati.ottieniElaboratoProvvigioni(9, 2026);
  assert.equal(result.length, 1);
  assert.equal(result[0].operatore, 'Mario Rossi');
  assert.equal(result[0].fatturatoTotale, 501);
  assert.equal(result[0].provvigioneTotale, 35);
  assert.deepEqual(
    result[0].clienti.map(cliente => [cliente.ragioneSociale, cliente.provvigione]),
    [['CLIENTE DUE', 10], ['CLIENTE TRE', 20], ['CLIENTE UNO', 5]]
  );
});

test('settembre chiuso usa gli imponibili blindati e l’Outbound riassegnato', async () => {
  await knex('mesi_chiusi_clienti').insert({ mese: 9, anno: 2026 });
  await knex('dettaglio_mesi_chiusi_clienti').insert([
    { mese: 9, anno: 2026, cliente_id: 'C_OP_1', ragione_sociale: 'Cliente Uno', imponibile: 100 },
    { mese: 9, anno: 2026, cliente_id: 'C_OP_2', ragione_sociale: 'Cliente Due', imponibile: 200 },
    { mese: 9, anno: 2026, cliente_id: 'C_OP_3', ragione_sociale: 'Cliente Tre', imponibile: 201 }
  ]);
  await knex('clienti').where({ id: 'C_OP_1' }).update({ operatore: '' });
  assert.equal((await elaborati.ottieniElaboratoProvvigioni(9, 2026))[0].provvigioneTotale, 30);
  await knex('clienti').where({ id: 'C_OP_1' }).update({ operatore: 'Mario Rossi' });
  const result = await elaborati.ottieniElaboratoProvvigioni(9, 2026);
  assert.equal(result[0].fatturatoTotale, 501);
  assert.equal(result[0].provvigioneTotale, 35);
  assert.equal(result[0].clienti.length, 3);
});

test('una singola riga blindata conta anche senza fattura registrata', async () => {
  await knex('righe_bloccate_elaborati').insert({
    tipo: 'cliente', mese: 10, anno: 2026, soggetto_id: 'C_OP_1',
    snapshot: JSON.stringify({ imponibile: 150 }), bloccata_at: '2026-10-06T00:00:00.000Z'
  });
  const result = await elaborati.ottieniElaboratoProvvigioni(10, 2026);
  assert.equal(result.length, 1);
  assert.equal(result[0].fatturatoTotale, 150);
  assert.equal(result[0].provvigioneTotale, 10);
});
