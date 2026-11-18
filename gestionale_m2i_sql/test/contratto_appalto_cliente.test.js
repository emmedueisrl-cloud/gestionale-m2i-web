const test = require('node:test');
const assert = require('node:assert/strict');
const makeKnex = require('knex');

test('salva i dati del contratto per cliente e lascia vuoti quelli mai inseriti', async t => {
  const knex = makeKnex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true,
    pool: { min: 1, max: 1 } });
  t.after(() => knex.destroy());
  await knex.schema.createTable('clienti', table => {
    table.text('id').primary(); table.text('ragione_sociale'); table.text('contratto_appalto_dati');
  });
  await knex.schema.createTable('clienti_periodi_attivita', table => {
    table.increments('id'); table.text('cliente_id'); table.text('data_inizio');
  });
  await knex.schema.createTable('chiavi_assegnazioni', table => {
    table.increments('id'); table.text('cliente_id'); table.text('dipendente_id'); table.integer('attivo'); table.integer('num_copia');
  });
  await knex.schema.createTable('dipendenti', table => {
    table.text('id').primary(); table.text('nome'); table.text('cognome');
  });
  await knex('clienti').insert([{ id: 'C1', ragione_sociale: 'Cliente con contratto' },
    { id: 'C2', ragione_sociale: 'Cliente senza contratto' }]);
  const dbPath = require.resolve('../db');
  const previous = require.cache[dbPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { knex } };
  const controllerPath = require.resolve('../controllers/clienti');
  delete require.cache[controllerPath];
  t.after(() => { delete require.cache[controllerPath];
    if (previous) require.cache[dbPath] = previous; else delete require.cache[dbPath]; });
  const clienti = require('../controllers/clienti');
  assert.equal((await clienti.recuperaDatiCompletiCliente('C2')).contrattoAppalto, null);
  await clienti.salvaDatiContrattoAppaltoCliente('C1', { localiServizio: 'Uffici', oreMensili: '36', dataFirma: '' });
  const saved = await clienti.recuperaDatiCompletiCliente('C1');
  assert.equal(saved.contrattoAppalto.localiServizio, 'Uffici');
  assert.equal(saved.contrattoAppalto.oreMensili, '36');
  assert.equal(saved.contrattoAppalto.dataFirma, '');
  await assert.rejects(() => clienti.salvaDatiContrattoAppaltoCliente('C3', {}), /Cliente non trovato/);
});
