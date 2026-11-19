const { test } = require('node:test');
const assert = require('node:assert/strict');
const knexFactory = require('knex');
const { inizializzaCessazioniDipendenti, creaAggiornamentoCessazioni, registraCessazioneDipendente } = require('../cessazioni_dipendenti');

test('una cessazione manuale mantiene contratto e attività fino all’ultimo giorno incluso', async t => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  await db.schema.createTable('dipendenti', table => {
    table.text('id').primary();
    for (const key of ['stato', 'data_assunzione', 'scadenza', 'data_cessazione', 'data_trasformazione_indeterminato', 'note']) table.text(key);
  });
  await db.schema.createTable('log_attivita', table => {
    for (const key of ['categoria', 'icona', 'colore', 'descrizione', 'eseguito_da']) table.text(key);
  });
  const dbPath = require.resolve('../db');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { knex: db, getVal: (obj, key) => obj[key] } };
  const contratti = require('../controllers/contratti');
  await inizializzaCessazioniDipendenti(db);
  const dipendente = () => db('dipendenti').where({ id: 'D1' }).first();
  await db('dipendenti').insert({ id: 'D1', stato: 'Determinato', data_assunzione: '2098-03-01', scadenza: '2100-01-31' });
  await contratti.registraCessazione({ idDipendente: 'D1', dataCessazione: '2099-11-30', motivoCessazione: 'Dimissioni volontarie' });
  let row = await dipendente();
  assert.equal(row.stato, 'Determinato');
  assert.equal(row.motivo_cessazione, 'Dimissioni volontarie');
  assert.equal(row.scadenza, '2100-01-31');
  let oggi = '2099-11-30';
  const aggiorna = creaAggiornamentoCessazioni(db, () => oggi);
  // Riproduce una scheda esistente già marcata cessata dalla vecchia versione.
  await db('dipendenti').where({ id: 'D1' }).update({ stato: 'Cessato', data_cessazione: '30/11/2099', stato_pre_cessazione: null });
  await Promise.all([aggiorna(), aggiorna()]);
  assert.equal((await dipendente()).data_cessazione, '2099-11-30');
  assert.equal((await dipendente()).stato, 'Determinato');
  oggi = '2099-12-01';
  await Promise.all([aggiorna(), aggiorna()]);
  row = await dipendente();
  assert.equal(row.stato, 'Cessato');
  assert.equal(row.stato_pre_cessazione, 'Determinato');
  assert.equal(row.scadenza, '2100-01-31');
  await contratti.riattivaDipendenteServer({ idDipendente: 'D1', nuovoStato: 'Indeterminato', nuovaDataAssunzione: '2100-04-01' });
  row = await dipendente();
  assert.equal(row.stato, 'Indeterminato');
  assert.equal(row.data_cessazione, null);
  assert.equal(row.motivo_cessazione, null);
  assert.equal(row.stato_pre_cessazione, null);
  await assert.rejects(registraCessazioneDipendente(db, row, '31/02/2101', 'Dimissioni'), /valida/);
  await assert.rejects(registraCessazioneDipendente(db, row, '2098-04-30', 'Dimissioni'), /assunzione/);
  await registraCessazioneDipendente(db, row, '2100-04-02', 'Dimissioni', '2100-04-03');
  assert.equal((await dipendente()).stato, 'Cessato');
  assert.equal((await dipendente()).stato_pre_cessazione, 'Indeterminato');
});
