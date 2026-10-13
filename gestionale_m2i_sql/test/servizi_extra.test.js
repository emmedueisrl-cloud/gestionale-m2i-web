const test = require('node:test');
const assert = require('node:assert/strict');
const knexFactory = require('knex');
const { createServiziExtra } = require('../servizi_extra');
const { tableData } = require('../tabella_contabilita_export');

test('servizio extra: dipendenti facoltativi, nota, blindatura e fattura Aruba separata', async t => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  await db.schema.createTable('clienti', table => {
    table.text('id').primary(); table.text('ragione_sociale');
    table.text('tipo_tassazione'); table.float('percentuale_tassazione');
  });
  await db.schema.createTable('dipendenti', table => { table.text('id').primary(); table.text('tipo_paga'); });
  await db.schema.createTable('mesi_chiusi_clienti', table => { table.integer('mese'); table.integer('anno'); });
  await db.schema.createTable('mesi_chiusi_dipendenti', table => { table.integer('mese'); table.integer('anno'); });
  await db.schema.createTable('righe_bloccate_elaborati', table => {
    table.text('tipo'); table.integer('mese'); table.integer('anno'); table.text('soggetto_id'); table.text('snapshot');
  });
  await db.schema.createTable('pagamenti_elaborati_dipendenti', table => {
    table.text('dipendente_id'); table.integer('mese'); table.integer('anno');
  });
  await db.schema.createTable('fatture', table => {
    table.text('id').primary(); table.text('cliente_id'); table.text('numero_fattura');
    table.text('data_fattura'); table.float('importo_totale'); table.text('tipo_documento');
  });
  await db.schema.createTable('fatture_aruba_elaborati', table => {
    table.increments('id'); table.text('cliente_id'); table.integer('mese'); table.integer('anno');
    table.text('tipo_documento'); table.text('numero_fattura'); table.text('data_fattura');
    table.float('importo_totale'); table.text('registrata_at'); table.text('fattura_id');
  });
  await db.schema.createTable('fatture_inviate_elaborati', table => {
    table.text('cliente_id'); table.integer('mese'); table.integer('anno'); table.text('inviata_at');
  });
  await db.schema.createTable('incassi_fatture_aruba', table => {
    table.text('id').primary(); table.integer('registrazione_id'); table.text('data_incasso');
    table.integer('importo_cent'); table.text('nota'); table.text('origine'); table.text('registrato_at');
    table.text('registrato_da'); table.text('annullato_at'); table.text('annullato_da');
    table.text('motivo_annullamento'); table.text('idempotency_key');
  });
  await db('clienti').insert({ id: 'C1', ragione_sociale: 'Cliente X', tipo_tassazione: 'IVA', percentuale_tassazione: 22 });
  await db('dipendenti').insert([{ id: 'D1', tipo_paga: 'Oraria' }, { id: 'D2', tipo_paga: 'Mensile' }]);
  const service = createServiziExtra(db);
  await service.initialize();
  const input = { clienteId: 'C1', mese: 10, anno: 2026, dataServizio: '2026-10-12',
    nome: 'Sgrosso', categoria: 'Sgrosso', descrizione: '', descrizioneFattura: 'SGROSSO OTTOBRE 2026',
    imponibile: '100', destinazione: 'extra', lavori: [] };
  const created = await service.save(input);
  assert.equal((await service.list(10, 2026))[0].lavori.length, 0);
  assert.equal((await service.list(10, 2026))[0].modificabile, true);
  const [pendingGroup] = await service.groups(10, 2026);
  assert.equal(pendingGroup.clienteNome, 'Cliente X');
  assert.equal(pendingGroup.descrizioneFattura, 'SGROSSO OTTOBRE 2026');
  assert.deepEqual(pendingGroup.nomiServizi, ['Sgrosso']);
  assert.equal(pendingGroup.totaleExtraPrevisto, 122);
  assert.equal(pendingGroup.tuttiBlindati, false);
  const printable = tableData('cliente', 0, [], [], 10, 2026, [pendingGroup]);
  assert.equal(printable.rows.length, 1);
  assert.match(printable.rows[0][8], /Fattura extra separata: Sgrosso/);
  const work = { dipendenteId: 'D1', modalita: 'solo_nota', compenso: '50',
    giornate: [{ data: '2026-10-12', ore: 3 }] };
  await service.save({ ...input, id: created.id, gruppoId: created.gruppoId, lavori: [work] });
  assert.equal((await service.list(10, 2026))[0].lavori[0].compenso, 50);
  await service.setLock(created.id, true);
  assert.equal((await service.groups(10, 2026))[0].tuttiBlindati, true);
  await service.markSent(created.gruppoId);
  assert.equal((await service.list(10, 2026))[0].modificabile, false);
  const [sentGroup] = await service.groups(10, 2026);
  assert.equal(sentGroup.totaleFattura, 122);
  assert.equal(tableData('cliente', 0, [], [], 10, 2026, [sentGroup]).rows.length, 0);
  assert.equal(tableData('cliente', 1, [], [], 10, 2026, [sentGroup]).rows.length, 1);
  await assert.rejects(service.save({ ...input, id: created.id, gruppoId: created.gruppoId,
    imponibile: '101', lavori: [work] }), /non è modificabile/);
  await assert.rejects(service.save({ ...input, id: created.id, gruppoId: created.gruppoId,
    descrizioneFattura: 'CAMBIO', lavori: [work] }), /non è modificabile/);
  await assert.rejects(service.save({ ...input, id: created.id, gruppoId: created.gruppoId,
    lavori: [{ ...work, compenso: '55' }] }), /non è modificabile/);
  assert.equal((await service.list(10, 2026))[0].lavori[0].compenso, 50);
  const [registrationId] = await db('fatture_aruba_elaborati').insert({ cliente_id: 'C1', mese: 10, anno: 2026,
    tipo_documento: 'TD01', numero_fattura: 'EX-1', data_fattura: '2026-10-12',
    importo_totale: 122, registrata_at: new Date().toISOString() });
  await service.linkRegistration(created.gruppoId, registrationId);
  const [registeredGroup] = await service.groups(10, 2026);
  assert.equal(registeredGroup.fatturaRegistrazioneId, registrationId);
  const ordinaryRow = { idCliente: 'C1', ragioneSociale: 'Cliente X', imponibile: 200,
    importoTotale: 244, fatture: [{ id: registrationId, importo: 122 }] };
  assert.equal(tableData('cliente', 0, [ordinaryRow], [], 10, 2026, [registeredGroup]).rows.length, 1);
  assert.equal(tableData('cliente', 1, [ordinaryRow], [], 10, 2026, [registeredGroup]).rows.length, 1);
  await assert.rejects(service.setLock(created.id, false), /inviata o registrata/);
  const [creditId] = await db('fatture_aruba_elaborati').insert({ cliente_id: 'C1', mese: 11, anno: 2026,
    tipo_documento: 'TD04', numero_fattura: 'NC-1', data_fattura: '2026-11-03',
    importo_totale: -122, registrata_at: new Date().toISOString() });
  await service.registerCredit(created.gruppoId, creditId, '100');
  const replacement = await service.reissue(created.gruppoId);
  assert.notEqual(replacement.gruppoId, created.gruppoId);
  assert.equal((await service.list(10, 2026))[0].gruppoId, replacement.gruppoId);
  assert.equal((await service.groups(10, 2026)).find(group => group.id === created.gruppoId).crediti[0].gruppoSostitutivoId, replacement.gruppoId);
  await service.setLock(created.id, true);
  await db('fatture').insert({ id: 'XML2', cliente_id: 'C1', numero_fattura: 'EX-2',
    data_fattura: '2026-11-04', importo_totale: 122, tipo_documento: 'TD01' });
  const official = (await service.registrations(10, 2026, 'C1')).find(invoice => invoice.id === 'official:XML2');
  assert.ok(official);
  await service.linkRegistration(replacement.gruppoId, official.id);
  assert.equal((await db('fatture_aruba_elaborati').where({ fattura_id: 'XML2' }).first()).mese, 10);
  await db('mesi_chiusi_clienti').insert({ mese: 10, anno: 2026 });
  assert.equal((await service.list(10, 2026))[0].modificabile, false);
});
