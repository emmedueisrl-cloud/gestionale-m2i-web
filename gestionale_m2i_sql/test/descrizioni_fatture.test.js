const test = require('node:test');
const assert = require('node:assert/strict');
const knexFactory = require('knex');
const { descrizionePredefinita, initialize, freezeMonthlyDescription, save } = require('../descrizioni_fatture');

test('causale fattura: sempre mese dell’elaborato e descrizione per fattura', async t => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  await db.schema.createTable('clienti', table => { table.text('id').primary(); });
  await db.schema.createTable('fatture_inviate_elaborati', table => {
    table.text('cliente_id'); table.integer('mese'); table.integer('anno');
  });
  await db.schema.createTable('fatture_aruba_elaborati', table => {
    table.increments('id'); table.text('cliente_id'); table.integer('mese'); table.integer('anno');
  });
  await db.schema.createTable('gruppi_fatturazione_extra', table => {
    table.text('id').primary(); table.text('cliente_id'); table.text('tipo'); table.integer('mese'); table.integer('anno');
    table.text('inviata_at'); table.integer('fattura_registrazione_id');
  });
  await db('clienti').insert({ id: 'C1' });
  await initialize(db);
  const client = await db('clienti').where({ id: 'C1' }).first();
  assert.equal(descrizionePredefinita(client, 1, 2027), 'SERVIZIO DI PULIZIA GENNAIO 2027');
  assert.equal(descrizionePredefinita({ ...client, periodo_causale_fattura: 'corrente' }, 1, 2027), 'SERVIZIO DI PULIZIA GENNAIO 2027');
  await save(db, { tipo: 'cliente', soggettoId: 'C1', mese: 1, anno: 2027, descrizione: 'Pulizia uffici gennaio 2027' });
  assert.equal((await db('descrizioni_fatture_elaborati').first()).descrizione, 'Pulizia uffici gennaio 2027');
  await db('fatture_inviate_elaborati').insert({ cliente_id: 'C1', mese: 1, anno: 2027 });
  await assert.rejects(() => save(db, { tipo: 'cliente', soggettoId: 'C1', mese: 1, anno: 2027, descrizione: 'Cambio' }), /già inviata/);
  await db('gruppi_fatturazione_extra').insert({ id: 'G1', tipo: 'extra', mese: 1, anno: 2027 });
  await save(db, { tipo: 'extra', soggettoId: 'G1', mese: 1, anno: 2027, descrizione: 'Sgrosso magazzino' });
  assert.equal((await db('descrizioni_fatture_elaborati').where({ tipo: 'extra' }).first()).descrizione, 'Sgrosso magazzino');
});

test('lo storico usa il mese elaborato, corregge i valori precedenti e conserva quelli manuali', async t => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  await db.schema.createTable('clienti', table => { table.text('id').primary(); });
  await db.schema.createTable('fatture_inviate_elaborati', table => {
    table.text('cliente_id'); table.integer('mese'); table.integer('anno');
  });
  await db.schema.createTable('fatture_aruba_elaborati', table => {
    table.increments('id'); table.text('cliente_id'); table.integer('mese'); table.integer('anno');
    table.text('tipo_documento'); table.float('importo_totale');
  });
  await db.schema.createTable('dettaglio_mesi_chiusi_clienti', table => {
    table.text('cliente_id'); table.integer('mese'); table.integer('anno');
  });
  await db('clienti').insert({ id: 'C1' });
  await db('fatture_inviate_elaborati').insert({ cliente_id: 'C1', mese: 10, anno: 2026 });
  await db('fatture_aruba_elaborati').insert({ cliente_id: 'C1', mese: 9, anno: 2026,
    tipo_documento: 'TD01', importo_totale: 100 });
  await db('dettaglio_mesi_chiusi_clienti').insert({ cliente_id: 'C1', mese: 8, anno: 2026 });
  await initialize(db);
  assert.deepEqual((await db('descrizioni_fatture_elaborati').where({ tipo: 'cliente' }).orderBy('mese'))
    .map(row => row.descrizione), [
    'SERVIZIO DI PULIZIA AGOSTO 2026', 'SERVIZIO DI PULIZIA SETTEMBRE 2026', 'SERVIZIO DI PULIZIA OTTOBRE 2026'
  ]);
  await db('descrizioni_fatture_elaborati').where({ mese: 9 }).update({ descrizione: 'SERVIZIO DI PULIZIA AGOSTO 2026' });
  await db('descrizioni_fatture_elaborati').where({ mese: 8 }).update({ descrizione: 'Prestazione concordata a parte' });
  await db('clienti').where({ id: 'C1' }).update({ periodo_causale_fattura: 'precedente' });
  await initialize(db);
  const historic = await db('descrizioni_fatture_elaborati').where({ tipo: 'cliente' }).orderBy('mese');
  assert.deepEqual(historic.map(row => row.descrizione), [
    'Prestazione concordata a parte', 'SERVIZIO DI PULIZIA SETTEMBRE 2026', 'SERVIZIO DI PULIZIA OTTOBRE 2026'
  ]);
  assert.equal((await db('clienti').where({ id: 'C1' }).first()).periodo_causale_fattura, 'corrente');
  await db('clienti').where({ id: 'C1' }).update({ causale_fattura: 'GIARDINAGGIO', periodo_causale_fattura: 'corrente' });
  await initialize(db);
  await freezeMonthlyDescription(db, { clienteId: 'C1', mese: 10, anno: 2026 });
  assert.deepEqual((await db('descrizioni_fatture_elaborati').where({ tipo: 'cliente' }).orderBy('mese'))
    .map(row => row.descrizione), historic.map(row => row.descrizione));
});
