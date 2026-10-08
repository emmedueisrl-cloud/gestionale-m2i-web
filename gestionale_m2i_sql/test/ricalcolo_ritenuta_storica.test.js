const test = require('node:test');
const assert = require('node:assert/strict');
const knexFactory = require('knex');
const { ricalcolaRitenutaStorica } = require('../ricalcolo_ritenuta_storica');

test('ricalcola righe blindate e mesi chiusi con ritenuta, conservando una traccia e senza ripetere le modifiche', async t => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  await db.schema.createTable('clienti', table => {
    table.text('id').primary(); table.text('tipo_tassazione');
  });
  await db.schema.createTable('righe_bloccate_elaborati', table => {
    table.text('tipo'); table.text('soggetto_id'); table.integer('mese'); table.integer('anno'); table.text('snapshot');
  });
  await db.schema.createTable('dettaglio_mesi_chiusi_clienti', table => {
    table.increments('id'); table.text('cliente_id'); table.integer('mese'); table.integer('anno');
    table.float('imponibile'); table.float('importo_iva'); table.float('importo_totale');
  });
  await db.schema.createTable('fatture', table => {
    table.text('id').primary(); table.float('importo_totale');
  });
  await db('fatture').insert({ id: 'ARUBA-STORICA', importo_totale: 104 });
  await db('clienti').insert([
    { id: 'R', tipo_tassazione: 'TRAT. ACC.' },
    { id: 'I', tipo_tassazione: 'IVA' },
    { id: 'L', tipo_tassazione: 'TRAT. ACC.' },
    { id: 'S', tipo_tassazione: 'TRAT. ACC.' }
  ]);
  await db('righe_bloccate_elaborati').insert([
    { tipo: 'cliente', soggetto_id: 'R', mese: 9, anno: 2026,
      snapshot: JSON.stringify({ imponibile: 100, importoIva: 4, importoTotale: 104, tipoTassazione: 'TRAT. ACC.' }) },
    { tipo: 'cliente', soggetto_id: 'I', mese: 9, anno: 2026,
      snapshot: JSON.stringify({ imponibile: 100, importoIva: 22, importoTotale: 122, tipoTassazione: 'IVA' }) },
    { tipo: 'cliente', soggetto_id: 'S', mese: 9, anno: 2026,
      snapshot: JSON.stringify({ imponibile: 100, importoIva: 22, importoTotale: 122, tipoTassazione: 'IVA' }) }
  ]);
  await db('dettaglio_mesi_chiusi_clienti').insert([
    { cliente_id: 'R', mese: 9, anno: 2026, imponibile: 100, importo_iva: 4, importo_totale: 104 },
    { cliente_id: 'I', mese: 9, anno: 2026, imponibile: 100, importo_iva: 22, importo_totale: 122 },
    { cliente_id: 'L', mese: 8, anno: 2026, imponibile: 100, importo_iva: 4, importo_totale: 104 },
    { cliente_id: 'S', mese: 9, anno: 2026, imponibile: 100, importo_iva: 22, importo_totale: 122 }
  ]);

  assert.deepEqual(await ricalcolaRitenutaStorica(db), { righe: 1, dettagli: 2 });
  const snapshot = JSON.parse((await db('righe_bloccate_elaborati').where({ soggetto_id: 'R' }).first()).snapshot);
  assert.equal(snapshot.importoIva, 22);
  assert.equal(snapshot.importoRitenuta, 4);
  assert.equal(snapshot.importoTotale, 118);
  assert.equal((await db('dettaglio_mesi_chiusi_clienti').where({ cliente_id: 'R' }).first()).importo_totale, 118);
  assert.equal((await db('dettaglio_mesi_chiusi_clienti').where({ cliente_id: 'L' }).first()).importo_totale, 118);
  assert.equal((await db('dettaglio_mesi_chiusi_clienti').where({ cliente_id: 'S' }).first()).importo_totale, 122);
  assert.equal((await db('rettifiche_ritenuta_elaborati')).length, 3);
  assert.equal((await db('fatture').where({ id: 'ARUBA-STORICA' }).first()).importo_totale, 104);
  assert.deepEqual(await ricalcolaRitenutaStorica(db), { righe: 0, dettagli: 0 });
  assert.equal((await db('rettifiche_ritenuta_elaborati')).length, 3);
});
