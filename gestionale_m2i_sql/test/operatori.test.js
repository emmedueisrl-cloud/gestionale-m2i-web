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
  await knex('clienti').insert([
    { id: 'C1', ragione_sociale: 'Cliente', partita_iva: 'P1', operatore: 'Valore Outbound', operatore_assegnato: 'Vecchio valore diverso' },
    { id: 'C2', ragione_sociale: 'Cliente storico', partita_iva: 'P2', operatore: '', operatore_assegnato: 'Operatore Storico' }
  ]);
  await operatori.ensureTables();
});

after(() => knex.destroy());

test('il primo avvio azzera le assegnazioni, ne conserva una copia e non aggiunge operatori', async () => {
  assert.deepEqual(await operatori.elencaOperatori(), []);
  const azzerati = await knex('clienti').select('id', 'operatore', 'operatore_assegnato').orderBy('id');
  assert.deepEqual(azzerati, [
    { id: 'C1', operatore: '', operatore_assegnato: '' },
    { id: 'C2', operatore: '', operatore_assegnato: '' }
  ]);
  const copie = await knex('operatori_assegnazioni_pre_reset').select('cliente_id', 'outbound', 'operatore_assegnato').orderBy('cliente_id');
  assert.deepEqual(copie, [
    { cliente_id: 'C1', outbound: 'Valore Outbound', operatore_assegnato: 'Vecchio valore diverso' },
    { cliente_id: 'C2', outbound: '', operatore_assegnato: 'Operatore Storico' }
  ]);
  assert.equal(await knex('operatori_migrazioni').count('* as totale').first().then(r => r.totale), 1);

  await operatori.creaOperatore('Valore Outbound');
  await operatori.creaOperatore('Operatore Storico');
  await knex('clienti').where({ id: 'C1' }).update({ operatore: 'Valore Outbound' });
  await knex('clienti').where({ id: 'C2' }).update({ operatore: 'Operatore Storico' });
  const elenco = await operatori.elencaOperatori();
  assert.deepEqual(elenco.map(item => item.nome), ['Operatore Storico', 'Valore Outbound']);
  assert.deepEqual(elenco[0].clientiAttivi, [{ id: 'C2', ragioneSociale: 'Cliente storico' }]);
  assert.deepEqual(elenco[1].clientiAttivi, [{ id: 'C1', ragioneSociale: 'Cliente' }]);
  delete require.cache[require.resolve('../operatori')];
  await require('../operatori').ensureTables();
  assert.equal((await knex('clienti').where({ id: 'C1' }).first()).operatore, 'Valore Outbound');
  assert.equal(await knex('operatori_migrazioni').count('* as totale').first().then(r => r.totale), 1);
});

test('si possono assegnare soltanto gli operatori creati nelle impostazioni', async () => {
  await assert.rejects(operatori.validaOutbound('Nome non registrato'), /Seleziona un Outbound attivo/);
  assert.equal(await operatori.validaOutbound('valore outbound'), 'Valore Outbound');
  // Un valore storico già assegnato resta modificabile nella scheda cliente.
  assert.equal(await operatori.validaOutbound('Nome storico', 'Nome storico'), 'Nome storico');
});

test('la cessazione vale dal mese successivo e la riattivazione riapre lo storico', async () => {
  const operatore = (await operatori.elencaOperatori()).find(item => item.nome === 'Operatore Storico');
  await operatori.cessaOperatore(operatore.id, '2026-10-05');
  await assert.rejects(operatori.validaOutbound('Operatore Storico'), /Seleziona un Outbound attivo/);
  assert.equal((await operatori.nomiAttiviNelMese(10, 2026)).has('operatore storico'), true);
  assert.equal((await operatori.nomiAttiviNelMese(11, 2026)).has('operatore storico'), false);

  await operatori.riattivaOperatore(operatore.id, '2026-12-10');
  assert.equal((await operatori.nomiAttiviNelMese(12, 2026)).has('operatore storico'), true);
});

test('elimina un Outbound solo dopo averlo rimosso da tutte le schede cliente', async () => {
  const operatore = (await operatori.elencaOperatori()).find(item => item.nome === 'Valore Outbound');
  assert.equal(operatore.clientiAssegnati, 1);
  await assert.rejects(operatori.eliminaOperatore(operatore.id), /assegnato a un cliente/);
  await knex('clienti').where({ id: 'C1' }).update({ attivo: 'Cessato' });
  assert.equal((await operatori.elencaOperatori()).find(item => item.id === operatore.id).clientiAssegnati, 1);
  await assert.rejects(operatori.eliminaOperatore(operatore.id), /assegnato a un cliente/);
  await knex('clienti').where({ id: 'C1' }).update({ operatore: '' });
  assert.deepEqual(await operatori.eliminaOperatore(operatore.id), { success: true });
  assert.equal((await operatori.elencaOperatori()).some(item => item.id === operatore.id), false);
  assert.equal(await knex('operatori_periodi').where({ operatore_id: operatore.id }).count('* as totale').first().then(r => r.totale), 0);
  assert.equal((await operatori.creaOperatore('Valore Outbound')).nome, 'Valore Outbound');
});
