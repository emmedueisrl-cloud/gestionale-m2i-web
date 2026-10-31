const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const knex = require('knex')({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true, pool: { min: 1, max: 1 } });

// Use only the isolated database created below.
const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { knex, getVal: (obj, key) => obj?.[key] } };
const workflow = require('../workflow_elaborati');
const elaborati = require('../controllers/elaborati');
const { createServiziExtra } = require('../servizi_extra');

before(async () => {
  const connection = await knex.client.acquireConnection();
  try {
    await new Promise((resolve, reject) => connection.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'),
      error => error ? reject(error) : resolve()));
  } finally { await knex.client.releaseConnection(connection); }
  await knex.raw('PRAGMA foreign_keys = ON');
  await workflow.initialize();
  await knex('clienti').insert([
    { id: 'C_PENDING', ragione_sociale: 'Da elaborare', partita_iva: 'TEST_PENDING' },
    { id: 'C_SENT', ragione_sociale: 'Inviata', partita_iva: 'TEST_SENT' },
    { id: 'C_REGISTERED', ragione_sociale: 'Registrata', partita_iva: 'TEST_REGISTERED' }
  ]);
  for (const [mese, anno] of [[7, 2026], [8, 2026], [9, 2026], [10, 2026], [11, 2026]]) {
    for (const [id, name] of [['C_PENDING', 'Da elaborare'], ['C_SENT', 'Inviata'], ['C_REGISTERED', 'Registrata']]) {
      await knex('righe_bloccate_elaborati').insert({ tipo: 'cliente', mese, anno, soggetto_id: id,
        snapshot: JSON.stringify({ idCliente: id, ragioneSociale: name, imponibile: 100, importoTotale: 100 }),
        bloccata_at: new Date().toISOString() });
    }
  }
});
after(() => knex.destroy());

test('rettifica firmata del mese ricalcola IVA e totale e non modifica fatture inviate', async () => {
  const maggiorazione = await workflow.saveInvoiceAdjustment({ mese: 7, anno: 2026, clienteId: 'C_PENDING', importo: '10,00' });
  assert.equal(maggiorazione.prezzoServizio, 100);
  assert.equal(maggiorazione.imponibile, 110);
  assert.equal(maggiorazione.importoIva, 24.2);
  assert.equal(maggiorazione.importoTotale, 134.2);
  const row = (await workflow.accountingRows('cliente', 7, 2026)).find(item => item.idCliente === 'C_PENDING');
  assert.equal(row.rettificaFatturazione, 10);
  assert.equal(row.importoTotale, 134.2);
  const detrazione = await workflow.saveInvoiceAdjustment({ mese: 7, anno: 2026, clienteId: 'C_PENDING', importo: '-10.00' });
  assert.equal(detrazione.imponibile, 90);
  assert.equal(detrazione.importoTotale, 109.8);
  await workflow.markInvoiceSent({ mese: 7, anno: 2026, clienteId: 'C_SENT' });
  await assert.rejects(() => workflow.saveInvoiceAdjustment({ mese: 7, anno: 2026, clienteId: 'C_SENT', importo: '5' }), /già inviata/);
  await workflow.saveInvoiceAdjustment({ mese: 7, anno: 2026, clienteId: 'C_PENDING', importo: '' });
  assert.equal(await knex('rettifiche_fatturazione_mensili').where({ cliente_id: 'C_PENDING', mese: 7, anno: 2026 }).first(), undefined);
});

test('la rettifica usa reverse charge e aliquota ritenuta della scheda cliente', async () => {
  await knex('clienti').where({ id: 'C_REGISTERED' }).update({ tipo_tassazione: 'REVERSE CHARGE' });
  const reverse = await workflow.saveInvoiceAdjustment({ mese: 7, anno: 2026, clienteId: 'C_REGISTERED', importo: '10' });
  assert.equal(reverse.importoIva, 0);
  assert.equal(reverse.importoTotale, 110);
  await knex('clienti').where({ id: 'C_PENDING' }).update({ tipo_tassazione: 'TRAT. ACC.', percentuale_tassazione: 4,
    fatturazione_aliquota_ritenuta: '4' });
  const ritenuta = await workflow.saveInvoiceAdjustment({ mese: 7, anno: 2026, clienteId: 'C_PENDING', importo: '10' });
  assert.equal(ritenuta.importoIva, 24.2);
  assert.equal(ritenuta.importoRitenuta, 4.4);
  assert.equal(ritenuta.importoTotale, 129.8);
});

test('la riga da elaborare si sblinda, anche se un altro cliente ha una fattura inviata', async () => {
  await workflow.markInvoiceSent({ mese: 8, anno: 2026, clienteId: 'C_SENT' });
  const result = await workflow.unlockRow('cliente', 8, 2026, 'C_PENDING');
  assert.equal(result.sbloccata, true);
  assert.equal(await knex('righe_bloccate_elaborati').where({ tipo: 'cliente', mese: 8, anno: 2026, soggetto_id: 'C_PENDING' }).first(), undefined);
  assert.ok(await knex('righe_bloccate_elaborati').where({ tipo: 'cliente', mese: 8, anno: 2026, soggetto_id: 'C_SENT' }).first());
});

test('solo servizi extra non crea righe mensili e conserva quelle già blindate', async () => {
  await knex('clienti').insert({ id: 'C_EXTRA_ONLY', ragione_sociale: 'Solo extra',
    partita_iva: 'TEST_EXTRA_ONLY', attivo: 'SI', tipo_rapporto: 'solo_extra' });
  const month = await elaborati.ottieniElaboratoClienti(6, 2026);
  assert.equal(month.dati.some(row => row.idCliente === 'C_EXTRA_ONLY'), false);
  await knex('righe_bloccate_elaborati').insert({ tipo: 'cliente', mese: 6, anno: 2026,
    soggetto_id: 'C_EXTRA_ONLY', snapshot: JSON.stringify({ idCliente: 'C_EXTRA_ONLY', ragioneSociale: 'Solo extra' }),
    bloccata_at: new Date().toISOString() });
  const lockedMonth = await elaborati.ottieniElaboratoClienti(6, 2026);
  assert.equal(lockedMonth.dati.find(row => row.idCliente === 'C_EXTRA_ONLY')?.rigaBloccata, true);
});

test('Fattura inviata impedisce la sblindatura della riga, senza alterare il mese', async () => {
  await workflow.markInvoiceSent({ mese: 9, anno: 2026, clienteId: 'C_SENT' });
  await assert.rejects(() => workflow.unlockRow('cliente', 9, 2026, 'C_SENT'), /Fattura inviata/);
  assert.ok(await knex('righe_bloccate_elaborati').where({ tipo: 'cliente', mese: 9, anno: 2026, soggetto_id: 'C_SENT' }).first());
});

test('Registra fattura impedisce la sblindatura della riga', async () => {
  const invoice = await workflow.registerInvoice({ mese: 10, anno: 2026, clienteId: 'C_REGISTERED',
    numero: 'TEST-10', dataFattura: '2026-09-30', importo: 100 });
  assert.ok(invoice.id);
  await assert.rejects(() => workflow.unlockRow('cliente', 10, 2026, 'C_REGISTERED'), /Fattura registrata/);
  assert.ok(await knex('righe_bloccate_elaborati').where({ tipo: 'cliente', mese: 10, anno: 2026, soggetto_id: 'C_REGISTERED' }).first());
});

test('lo sblocco del mese è impedito se contiene anche una sola fattura inviata o registrata', async () => {
  await knex('mesi_chiusi_clienti').insert({ mese: 11, anno: 2026, stato: 'Chiuso', data_chiusura: new Date().toISOString() });
  await knex('dettaglio_mesi_chiusi_clienti').insert([
    { mese: 11, anno: 2026, cliente_id: 'C_PENDING', ragione_sociale: 'Da elaborare' },
    { mese: 11, anno: 2026, cliente_id: 'C_SENT', ragione_sociale: 'Inviata' },
    { mese: 11, anno: 2026, cliente_id: 'C_REGISTERED', ragione_sociale: 'Registrata' }
  ]);
  await workflow.markInvoiceSent({ mese: 11, anno: 2026, clienteId: 'C_SENT' });
  await assert.rejects(() => elaborati.sbloccaMeseClienti(11, 2026), /fatture inviate/);
  assert.ok(await knex('mesi_chiusi_clienti').where({ mese: 11, anno: 2026 }).first());
  assert.equal((await knex('righe_bloccate_elaborati').where({ tipo: 'cliente', mese: 11, anno: 2026 })).length, 3);

  await knex('fatture_inviate_elaborati').where({ mese: 11, anno: 2026 }).del();
  await knex('fatture_aruba_elaborati').insert({ cliente_id: 'C_REGISTERED', mese: 11, anno: 2026,
    numero_fattura: 'TEST-11', data_fattura: '2026-09-30', importo_totale: 100, registrata_at: new Date().toISOString() });
  await assert.rejects(() => elaborati.sbloccaMeseClienti(11, 2026), /fatture registrate/);
  assert.ok(await knex('mesi_chiusi_clienti').where({ mese: 11, anno: 2026 }).first());
});

test('un mese senza fatture elaborate può ancora essere sbloccato', async () => {
  await knex('mesi_chiusi_clienti').insert({ mese: 12, anno: 2026, stato: 'Chiuso', data_chiusura: new Date().toISOString() });
  await knex('dettaglio_mesi_chiusi_clienti').insert({ mese: 12, anno: 2026, cliente_id: 'C_PENDING', ragione_sociale: 'Da elaborare' });
  await knex('righe_bloccate_elaborati').insert({ tipo: 'cliente', mese: 12, anno: 2026, soggetto_id: 'C_PENDING',
    snapshot: JSON.stringify({ idCliente: 'C_PENDING', ragioneSociale: 'Da elaborare' }), bloccata_at: new Date().toISOString() });
  const result = await elaborati.sbloccaMeseClienti(12, 2026);
  assert.equal(result.success, true);
  assert.equal(await knex('mesi_chiusi_clienti').where({ mese: 12, anno: 2026 }).first(), undefined);
  assert.equal(await knex('righe_bloccate_elaborati').where({ tipo: 'cliente', mese: 12, anno: 2026 }).first(), undefined);
});

test('la marcatura inviata è ripetibile e non può essere aggiunta dopo la sblindatura', async () => {
  const first = await workflow.markInvoiceSent({ mese: 9, anno: 2026, clienteId: 'C_REGISTERED' });
  const second = await workflow.markInvoiceSent({ mese: 9, anno: 2026, clienteId: 'C_REGISTERED' });
  assert.deepEqual(second, first);
  await workflow.unlockRow('cliente', 9, 2026, 'C_PENDING');
  await assert.rejects(() => workflow.markInvoiceSent({ mese: 9, anno: 2026, clienteId: 'C_PENDING' }), /non blindata/);
  assert.equal(await knex('fatture_inviate_elaborati').where({ cliente_id: 'C_PENDING', mese: 9, anno: 2026 }).first(), undefined);
});

test('la fattura di un extra non registra né blocca la riga mensile', async () => {
  await createServiziExtra(knex).initialize();
  const [registrationId] = await knex('fatture_aruba_elaborati').insert({ cliente_id: 'C_PENDING',
    mese: 10, anno: 2026, numero_fattura: 'EX-10', data_fattura: '2026-10-20',
    importo_totale: 122, registrata_at: new Date().toISOString() });
  await knex('gruppi_fatturazione_extra').insert({ id: 'G-SOLO-EXTRA', cliente_id: 'C_PENDING',
    mese: 10, anno: 2026, tipo: 'extra', nome: 'Sgrosso', creata_at: new Date().toISOString(),
    fattura_registrazione_id: registrationId });
  const monthly = (await workflow.accountingRows('cliente', 10, 2026))
    .find(row => row.idCliente === 'C_PENDING');
  assert.equal(monthly.fatture.length, 1);
  assert.equal(monthly.fattureMensili.length, 0);
  assert.equal((await workflow.unlockRow('cliente', 10, 2026, 'C_PENDING')).sbloccata, true);
});
