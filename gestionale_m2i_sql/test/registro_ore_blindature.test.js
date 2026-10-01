const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const knex = require('knex')({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true, pool: { min: 1, max: 1 } });
// Never load production db.js: every query in these tests targets this in-memory connection.
const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { knex, getVal: (obj, key) => obj[key] } };
const ore = require('../controllers/ore');
const workflow = require('../workflow_elaborati');
const { statoCostoPersonalePerCliente, calcolaCostoPersonalePerCliente } = require('../costo_personale_clienti');

before(async () => {
  const conn = await knex.client.acquireConnection();
  try { await new Promise((resolve, reject) => conn.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'), err => err ? reject(err) : resolve())); }
  finally { await knex.client.releaseConnection(conn); }
  await knex.raw('PRAGMA foreign_keys = ON');
  await workflow.initialize();
});
after(() => knex.destroy());

const days = h => [h, ...Array(30).fill(0)];
let serial = 0;
async function fixture(method = 'Calendarizzata') {
  const n = ++serial, id = `D${n}`, a = `A${n}`, b = `B${n}`;
  await knex('dipendenti').insert({ id, cognome: 'TEST', nome: String(n), codice_fiscale: `CF${n}`, data_assunzione: '2026-01-01', paga_oraria_reale: 7 });
  await knex('clienti').insert([{ id: a, ragione_sociale: a, partita_iva: a, quotazione_tipo: 'Oraria' }, { id: b, ragione_sociale: b, partita_iva: b, quotazione_tipo: 'Oraria' }]);
  const get = () => ore.recuperaOreMensili(id, 9, 2026);
  const row = (client, h) => ({ idCliente: client, causale: 'Ordinario', note: 'Preservare', giorni: days(h), ore_totali: h });
  const save = async (righe, extra = {}) => ore.salvaPresenzeMensili({ idDipendente: id, mese: 9, anno: 2026, metodoInserimento: method, revisione: (await get()).revisione, righe, ...extra });
  const lock = (tipo = 'cliente', subject = a) => knex('righe_bloccate_elaborati').insert({ tipo, mese: 9, anno: 2026, soggetto_id: subject, snapshot: '{}', bloccata_at: new Date().toISOString() });
  const physical = () => knex('registro_ore').where({ dipendente_id: id, mese: 9, anno: 2026 }).orderBy('id');
  await save([row(a, 3), row(b, 2)]);
  return { id, a, b, get, row, save, lock, physical };
}

for (const method of ['Calendarizzata', 'Mensile Totale']) test(`${method}: preserva integralmente cliente blindato e modifica cliente aperto`, async () => {
  const f = await fixture(method);
  await f.lock();
  const original = (await f.physical())[0];
  const loaded = await f.get();
  assert.equal(loaded.righe[0].bloccata, true);
  assert.equal(loaded.righe[1].bloccata, false);
  assert.equal(loaded.solaLettura, false);
  const result = await f.save([f.row(f.b, 5)]);
  const stored = await f.physical();
  assert.deepEqual(stored[0], original);
  assert.equal(stored[1].ore_totali, 5);
  assert.equal(result.revisione, (await f.get()).revisione);
  assert.notEqual(result.revisione, loaded.revisione);
  await f.save([]);
  assert.deepEqual(await f.physical(), [original]);
});

test('non accetta nuove ore, modifiche o sostituzioni su cliente blindato', async () => {
  const f = await fixture(); await f.lock();
  const before = await f.physical();
  for (const h of [3, 4, 0]) await assert.rejects(() => f.save([f.row(f.a, h), f.row(f.b, 1)]), /blindato/);
  assert.deepEqual(await f.physical(), before);
});

test('limite giornaliero e mensile comprende le ore protette', async () => {
  const f = await fixture(); await f.lock();
  const before = await f.physical();
  await assert.rejects(() => f.save([f.row(f.b, 10)]), /12 ore/);
  assert.deepEqual(await f.physical(), before);
  const m = await fixture('Mensile Totale'); await m.lock();
  await assert.rejects(() => m.save([m.row(m.b, 358)]), /mensili/);
});

test('revisione obsoleta, mancante e blindatura sopraggiunta non sovrascrivono dati', async () => {
  const f = await fixture(); const old = await f.get();
  await f.lock();
  const before = await f.physical();
  await assert.rejects(() => f.save([f.row(f.b, 5)], { revisione: old.revisione }), /aggiornati/);
  await assert.rejects(() => f.save([f.row(f.b, 5)], { revisione: undefined }), /aggiornati/);
  assert.deepEqual(await f.physical(), before);
});

test('due salvataggi con la stessa revisione: uno solo vince', async () => {
  const f = await fixture(); await f.lock();
  const revisione = (await f.get()).revisione;
  const results = await Promise.allSettled([f.save([f.row(f.b, 4)], { revisione }), f.save([f.row(f.b, 5)], { revisione })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(results.find(r => r.status === 'rejected').reason.message, /aggiornati/);
});

test('svuotamento e cambio modalità non cancellano ore protette', async () => {
  const f = await fixture(); await f.lock(); const before = await f.physical();
  await assert.rejects(() => ore.svuotaRegistroOreMensili(f.id, 9, 2026, 'stale'), /aggiornati/);
  await assert.rejects(async () => ore.svuotaRegistroOreMensili(f.id, 9, 2026, (await f.get()).revisione), /ore blindate/);
  await assert.rejects(() => f.save([f.row(f.b, 2)], { metodoInserimento: 'Mensile Totale' }), /cambiare metodo/);
  assert.deepEqual(await f.physical(), before);
});

test('Excel completo o parziale conserva le ore blindate; Excel alterato viene rifiutato', async () => {
  const f = await fixture(); await f.lock(); const protectedRow = (await f.physical())[0];
  await f.save([f.row(f.a, 3), f.row(f.b, 4)], { importazioneExcel: true });
  await f.save([f.row(f.b, 5)], { importazioneExcel: true });
  const before = await f.physical();
  await assert.rejects(() => f.save([f.row(f.a, 4), f.row(f.b, 1)], { importazioneExcel: true }), /Excel modifica/);
  assert.deepEqual(await f.physical(), before);
  assert.deepEqual(before[0], protectedRow);
});

test('precompilazione esclude i clienti blindati', async () => {
  const f = await fixture(); await f.lock();
  for (const idCliente of [f.a, f.b]) await knex('programma_fisso').insert({ dipendente_id: f.id, cliente_id: idCliente, giorno_settimana: 'Lunedì', ora_inizio: '09:00', ora_fine: '10:00' });
  const prog = await ore.precompilaDaProgrammaFisso(f.id, 9, 2026);
  assert.deepEqual(prog.map(r => r.idCliente), [f.b]);
});

test('dipendente blindato blocca anche clienti aperti e ore senza cliente', async () => {
  const f = await fixture(); await f.lock('dipendente', f.id);
  assert.equal((await f.get()).solaLettura, true);
  await assert.rejects(() => f.save([f.row(f.b, 1)]), /sola lettura/);
  await assert.rejects(() => f.save([f.row(null, 1)]), /sola lettura/);
  const next = await ore.recuperaOreMensili(f.id, 10, 2026);
  await ore.salvaPresenzeMensili({ idDipendente: f.id, mese: 10, anno: 2026, righe: [f.row(f.a, 1)], revisione: next.revisione });
});

test('errore su cliente inesistente annulla anche la cancellazione delle righe libere', async () => {
  const f = await fixture(); await f.lock(); const before = await f.physical();
  await assert.rejects(() => f.save([f.row('INESISTENTE', 1)]), /FOREIGN KEY/);
  assert.deepEqual(await f.physical(), before);
});

test('protezioni SQL restano attive anche fuori dal salvataggio applicativo', async () => {
  const f = await fixture(); await f.lock();
  const where = { dipendente_id: f.id, cliente_id: f.a, mese: 9, anno: 2026 };
  await assert.rejects(() => knex('registro_ore').where(where).update({ giorno_1: 0 }), /blindata/);
  await assert.rejects(() => knex('registro_ore').where(where).del(), /blindata/);
  await assert.rejects(() => knex('registro_ore').insert({ ...where, ore_totali: 1 }), /blindata/);
});

test('costo definitivo solo con tutte le righe dipendenti blindate o con il mese chiuso', () => {
  const records = [{ dipendente_id: 'D1', cliente_id: 'C', ore_totali: 20 }, { dipendente_id: 'D2', cliente_id: 'C', ore_totali: 10 }];
  const righeMeseParziali = [{ idDipendente: 'D1', rigaBloccata: true }, { idDipendente: 'D2', rigaBloccata: true }, { idDipendente: 'D3', rigaBloccata: false }];
  assert.equal(statoCostoPersonalePerCliente(righeMeseParziali, records).get('C'), false);
  assert.equal(statoCostoPersonalePerCliente(righeMeseParziali, records, true).get('C'), true);
  assert.equal(statoCostoPersonalePerCliente(righeMeseParziali.map(r => ({ ...r, rigaBloccata: true })), records).get('C'), true);
  const dip = [{ idDipendente: 'D1', stipendioNetto: 1200 }];
  assert.equal(calcolaCostoPersonalePerCliente(dip, [records[0], { dipendente_id: 'D1', cliente_id: 'B', ore_totali: 80 }]).get('C'), 240);
  assert.equal(calcolaCostoPersonalePerCliente(dip, [records[0], { dipendente_id: 'D1', cliente_id: 'B', ore_totali: 100 }]).get('C'), 200);
});

test('clienti: blindatura senza conferma e chiusura solo con Chiudi Mese, anche con vecchi elenchi salvati', async () => {
  const f = await fixture();
  const elaborati = require('../controllers/elaborati');
  await knex('periodi_elaborati').insert({ tipo: 'cliente', mese: 12, anno: 2026, elenco_confermato_at: new Date().toISOString() });
  await knex('righe_attese_elaborati').insert({ tipo: 'cliente', mese: 12, anno: 2026, soggetto_id: f.a });
  assert.deepEqual(await workflow.status('cliente', 12, 2026), { bloccati: [] });
  const mancantiPrima = await workflow.missingCount('cliente', 12, 2026);
  const locked = await workflow.lockRow('cliente', 12, 2026, f.b);
  assert.equal(locked.meseChiuso, false);
  assert.equal((await workflow.missingCount('cliente', 12, 2026)).mancanti, mancantiPrima.mancanti - 1);
  assert.equal(await knex('mesi_chiusi_clienti').where({ mese: 12, anno: 2026 }).first(), undefined);
  assert.deepEqual(await workflow.status('cliente', 12, 2026), { bloccati: [f.b] });
  const current = await elaborati.ottieniElaboratoClienti(12, 2026);
  await elaborati.chiudiMeseClienti(12, 2026, current.dati);
  assert.ok(await knex('mesi_chiusi_clienti').where({ mese: 12, anno: 2026 }).first());
  assert.equal((await workflow.missingCount('cliente', 12, 2026)).mancanti, 0);
  assert.equal((await knex('dettaglio_mesi_chiusi_clienti').where({ mese: 12, anno: 2026 })).length, current.dati.length);
});

test('dipendenti: blindatura senza conferma e chiusura solo con Chiudi Mese, anche con vecchi elenchi salvati', async () => {
  const f = await fixture();
  const elaborati = require('../controllers/elaborati');
  await knex('periodi_elaborati').insert({ tipo: 'dipendente', mese: 12, anno: 2026, elenco_confermato_at: new Date().toISOString() });
  await knex('righe_attese_elaborati').insert({ tipo: 'dipendente', mese: 12, anno: 2026, soggetto_id: f.id });
  assert.deepEqual(await workflow.status('dipendente', 12, 2026), { bloccati: [] });
  const mancantiPrima = await workflow.missingCount('dipendente', 12, 2026);
  const locked = await workflow.lockRow('dipendente', 12, 2026, f.id);
  assert.equal(locked.meseChiuso, false);
  assert.equal((await workflow.missingCount('dipendente', 12, 2026)).mancanti, mancantiPrima.mancanti - 1);
  assert.equal(await knex('mesi_chiusi_dipendenti').where({ mese: 12, anno: 2026 }).first(), undefined);
  assert.deepEqual(await workflow.status('dipendente', 12, 2026), { bloccati: [f.id] });
  const current = await elaborati.ottieniElaboratoMensile(12, 2026);
  await elaborati.chiudiMeseDipendenti(12, 2026, current.dati);
  assert.ok(await knex('mesi_chiusi_dipendenti').where({ mese: 12, anno: 2026 }).first());
  assert.equal((await workflow.missingCount('dipendente', 12, 2026)).mancanti, 0);
  assert.equal((await knex('dettaglio_mesi_chiusi_dipendenti').where({ mese: 12, anno: 2026 })).length, current.dati.length);
});

test('blindatura reale usa snapshot transazionale; il costo diventa definitivo solo alla chiusura completa', async () => {
  const f = await fixture();
  const elaborati = require('../controllers/elaborati');
  const get = () => ore.recuperaOreMensili(f.id, 11, 2026);
  const save = async h => ore.salvaPresenzeMensili({ idDipendente: f.id, mese: 11, anno: 2026,
    revisione: (await get()).revisione, righe: [f.row(f.b, h)] });
  await ore.salvaPresenzeMensili({ idDipendente: f.id, mese: 11, anno: 2026,
    revisione: (await get()).revisione, righe: [f.row(f.a, 3), f.row(f.b, 2)] });
  const clients = await elaborati.ottieniElaboratoClienti(11, 2026);
  assert.ok(clients.dati.some(r => r.idCliente === f.a));
  const original = elaborati.ottieniElaboratoClienti;
  let transactional = false;
  elaborati.ottieniElaboratoClienti = async (m, y, connection) => {
    transactional = Boolean(connection?.isTransaction);
    return original(m, y, connection);
  };
  try { await workflow.lockRow('cliente', 11, 2026, f.a); }
  finally { elaborati.ottieniElaboratoClienti = original; }
  assert.equal(transactional, true);
  const snapshot = await knex('righe_bloccate_elaborati').where({ tipo: 'cliente', soggetto_id: f.a, mese: 11, anno: 2026 }).first();
  await save(4);
  assert.deepEqual(await knex('righe_bloccate_elaborati').where({ tipo: 'cliente', soggetto_id: f.a, mese: 11, anno: 2026 }).first(), snapshot);
  let row = (await workflow.accountingRows('cliente', 11, 2026)).find(r => r.idCliente === f.a);
  assert.equal(row.costoPersonaleDefinitivo, false);
  assert.equal(row.oreLavorate, 3);
  const employees = await elaborati.ottieniElaboratoMensile(11, 2026);
  assert.ok(employees.dati.some(r => r.idDipendente === f.id));
  await workflow.lockRow('dipendente', 11, 2026, f.id);
  row = (await workflow.accountingRows('cliente', 11, 2026)).find(r => r.idCliente === f.a);
  assert.equal(row.costoPersonaleDefinitivo, false);
  await elaborati.chiudiMeseDipendenti(11, 2026, (await elaborati.ottieniElaboratoMensile(11, 2026)).dati);
  row = (await workflow.accountingRows('cliente', 11, 2026)).find(r => r.idCliente === f.a);
  assert.equal(row.costoPersonaleDefinitivo, true);
  await assert.rejects(() => save(5), /sola lettura/);
});

test('mesi chiusi: clienti impedisce nuove ore cliente, dipendenti impedisce qualsiasi ora', async () => {
  const f = await fixture();
  await knex('mesi_chiusi_clienti').insert({ mese: 9, anno: 2026, stato: 'Chiuso' });
  try {
    assert.equal((await f.get()).meseClientiChiuso, true);
    await assert.rejects(() => f.save([f.row(f.b, 1)]), /blindato/);
    await f.save([{ ...f.row(null, 1), causale: 'Ferie' }]);
    await knex('mesi_chiusi_dipendenti').insert({ mese: 9, anno: 2026, stato: 'Chiuso' });
    await assert.rejects(() => f.save([{ ...f.row(null, 1), causale: 'Ferie' }]), /sola lettura/);
  } finally {
    await knex('mesi_chiusi_clienti').where({ mese: 9, anno: 2026 }).del();
    await knex('mesi_chiusi_dipendenti').where({ mese: 9, anno: 2026 }).del();
  }
});
