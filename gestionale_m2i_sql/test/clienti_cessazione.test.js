const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const knex = require('knex')({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true, pool: { min: 1, max: 1 } });

// Database isolato: non caricare il database locale o di produzione.
const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { knex, getVal: (obj, key) => obj?.[key] } };
const clienti = require('../controllers/clienti');
const elaborati = require('../controllers/elaborati');
const workflow = require('../workflow_elaborati');

before(async () => {
  const connection = await knex.client.acquireConnection();
  try {
    await new Promise((resolve, reject) => connection.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'),
      error => error ? reject(error) : resolve()));
  } finally { await knex.client.releaseConnection(connection); }
  await knex.raw('PRAGMA foreign_keys = ON');
  await knex('clienti').insert({ id: 'C_LEGACY', ragione_sociale: 'Cessato preesistente', partita_iva: 'TEST-LEGACY',
    attivo: 'Cessato', data_cessazione: '2026-07-15' });
  await workflow.initialize();
  await knex('clienti').insert([
    { id: 'C_DATE', ragione_sociale: 'Con data', partita_iva: 'TEST-DATE' },
    { id: 'C_LOCK', ragione_sociale: 'Blindato', partita_iva: 'TEST-LOCK' },
    { id: 'C_TRASH', ragione_sociale: 'Cestinabile', partita_iva: 'TEST-TRASH' },
    { id: 'C_HISTORY', ragione_sociale: 'Storico', partita_iva: 'TEST-HISTORY' }
  ]);
});
after(() => knex.destroy());

const visible = async (id, mese, anno = 2026) =>
  (await elaborati.ottieniElaboratoClienti(mese, anno)).dati.some(row => row.idCliente === id);

test('cessazione e riattivazione conservano i mesi inattivi anche dopo più cicli', async () => {
  await assert.rejects(() => clienti.cessaCliente('C_DATE'), /data di cessazione valida/);
  await assert.rejects(() => clienti.cessaCliente('C_DATE', '2026-02-30'), /data di cessazione valida/);
  await assert.rejects(() => clienti.cessaCliente('C_DATE', '2100-01-01'), /non può essere futura/);
  await clienti.cessaCliente('C_DATE', '2026-07-15');
  assert.equal(await visible('C_DATE', 6), true);
  assert.equal(await visible('C_DATE', 7), true);
  assert.equal(await visible('C_DATE', 8), false);
  await assert.rejects(() => clienti.riattivaCliente('C_DATE'), /data di cessazione valida/);
  await assert.rejects(() => clienti.riattivaCliente('C_DATE', '2026-07-01'), /non può precedere/);
  await clienti.riattivaCliente('C_DATE', '2026-09-10');
  assert.equal(await visible('C_DATE', 8), false);
  assert.equal(await visible('C_DATE', 9), true);
  await clienti.cessaCliente('C_DATE', '2026-09-20');
  assert.equal(await visible('C_DATE', 10), false);
  await clienti.riattivaCliente('C_DATE', '2026-10-01');
  assert.equal(await visible('C_DATE', 8), false);
  assert.equal(await visible('C_DATE', 10), true);
  assert.deepEqual((await knex('clienti_periodi_attivita').where({ cliente_id: 'C_DATE' }).orderBy('id'))
    .map(({ data_inizio, data_fine }) => [data_inizio, data_fine]),
    [[null, '2026-07-15'], ['2026-09-10', '2026-09-20'], ['2026-10-01', null]]);
  assert.equal((await knex('clienti').where({ id: 'C_DATE' }).first()).data_cessazione, null);
});

test('la migrazione conserva il periodo di un cliente già cessato', async () => {
  assert.deepEqual((await knex('clienti_periodi_attivita').where({ cliente_id: 'C_LEGACY' })).map(p => [p.data_inizio, p.data_fine]),
    [[null, '2026-07-15']]);
  assert.equal(await visible('C_LEGACY', 7), true);
  assert.equal(await visible('C_LEGACY', 8), false);
  await clienti.riattivaCliente('C_LEGACY', '2026-09-01');
  assert.equal(await visible('C_LEGACY', 8), false);
  assert.equal(await visible('C_LEGACY', 9), true);
});

test('cliente blindato non va nel cestino e non può essere cessato prima del mese blindato', async () => {
  await workflow.lockRow('cliente', 8, 2026, 'C_LOCK');
  await assert.rejects(() => clienti.eliminaCliente('C_LOCK'), /mese blindato/);
  assert.equal((await knex('clienti').where({ id: 'C_LOCK' }).first()).cestinato, 0);
  await assert.rejects(() => clienti.cessaCliente('C_LOCK', '2026-07-15'), /precede un mese già blindato/);
  await clienti.cessaCliente('C_LOCK', '2026-08-15');
  assert.equal(await visible('C_LOCK', 8), true);
  assert.equal(await visible('C_LOCK', 9), false);
  await clienti.riattivaCliente('C_LOCK', '2026-09-01');
  assert.equal(await visible('C_LOCK', 8), true);
  assert.equal(await visible('C_LOCK', 9), true);
  assert.ok(await knex('righe_bloccate_elaborati').where({ tipo: 'cliente', soggetto_id: 'C_LOCK', mese: 8, anno: 2026 }).first());
});

test('eliminazione senza mesi blindati conserva il cliente, lo cessa e lo nasconde dagli elaborati aperti', async () => {
  const vecchioElaborato = await elaborati.ottieniElaboratoClienti(7, 2026);
  assert.equal(vecchioElaborato.dati.some(r => r.idCliente === 'C_TRASH'), true);
  assert.deepEqual(await clienti.eliminaCliente('C_TRASH'), { cestinato: true });
  const row = await knex('clienti').where({ id: 'C_TRASH' }).first();
  assert.equal(row.attivo, 'Cessato');
  assert.equal(row.cestinato, 1);
  assert.match(row.data_cessazione, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(await visible('C_TRASH', 7), false);
  await assert.rejects(() => elaborati.chiudiMeseClienti(7, 2026, vecchioElaborato.dati), /ricarica l’elaborato/);
  assert.equal(await knex('mesi_chiusi_clienti').where({ mese: 7, anno: 2026 }).first(), undefined);
  await clienti.ripristinaCliente('C_TRASH');
  assert.equal((await knex('clienti').where({ id: 'C_TRASH' }).first()).attivo, 'Cessato');
});

test('uno storico mensile chiuso impedisce l’eliminazione anche senza riga di blindatura', async () => {
  await knex('mesi_chiusi_clienti').insert({ mese: 5, anno: 2026, stato: 'Chiuso', data_chiusura: new Date().toISOString() });
  await knex('dettaglio_mesi_chiusi_clienti').insert({ mese: 5, anno: 2026, cliente_id: 'C_HISTORY', ragione_sociale: 'Storico' });
  await assert.rejects(() => clienti.eliminaCliente('C_HISTORY'), /mese blindato/);
  assert.equal((await knex('clienti').where({ id: 'C_HISTORY' }).first()).cestinato, 0);
});

test('non riattiva retroattivamente in un mese chiuso senza il cliente', async () => {
  await knex('clienti').insert({ id: 'C_GAP', ragione_sociale: 'Intervallo', partita_iva: 'TEST-GAP' });
  await clienti.cessaCliente('C_GAP', '2026-07-15');
  await knex('mesi_chiusi_clienti').insert({ mese: 8, anno: 2026, stato: 'Chiuso', data_chiusura: new Date().toISOString() });
  await assert.rejects(() => clienti.riattivaCliente('C_GAP', '2026-08-20'), /mese già chiuso/);
  assert.equal((await knex('clienti').where({ id: 'C_GAP' }).first()).attivo, 'Cessato');
  await clienti.riattivaCliente('C_GAP', '2026-09-01');
  assert.equal(await visible('C_GAP', 8), false);
  assert.equal(await visible('C_GAP', 9), true);
});
