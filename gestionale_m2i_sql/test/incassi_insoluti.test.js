const test = require('node:test');
const assert = require('node:assert/strict');
const knexFactory = require('knex');
const { createReceiptsService, todayInItaly } = require('../incassi_insoluti');
const { reconcileOfficial } = require('../fatture_reconciliation');

test('registro incassi: storico, acconti, saldo, annullamento e scadenze', async t => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  await db.schema.createTable('clienti', table => { table.text('id').primary(); table.text('ragione_sociale'); });
  await db.schema.createTable('fatture', table => {
    table.text('id').primary(); table.text('cliente_id'); table.text('numero_fattura'); table.text('data_fattura');
    table.text('data_scadenza'); table.text('data_pagamento'); table.float('importo_totale');
    table.float('importo_pagato'); table.text('stato_pagamento');
  });
  await db.schema.createTable('fatture_aruba_elaborati', table => {
    table.increments('id'); table.text('fattura_id'); table.text('cliente_id');
    table.integer('mese'); table.integer('anno');
    table.text('numero_fattura'); table.text('data_fattura'); table.float('importo_totale');
  });
  await db.schema.createTable('fatture_inviate_elaborati', table => {
    table.text('cliente_id'); table.integer('mese'); table.integer('anno'); table.text('inviata_at');
  });
  await db.schema.createTable('righe_bloccate_elaborati', table => {
    table.text('tipo'); table.integer('mese'); table.integer('anno'); table.text('soggetto_id'); table.text('snapshot');
  });
  await db.schema.createTable('dettaglio_mesi_chiusi_clienti', table => {
    table.text('cliente_id'); table.integer('mese'); table.integer('anno'); table.float('importo_totale');
  });
  await db.schema.createTable('log_attivita', table => {
    table.increments('id'); table.text('categoria'); table.text('icona'); table.text('colore');
    table.text('descrizione'); table.text('eseguito_da');
  });
  await db('clienti').insert({ id: 'C1', ragione_sociale: 'Cliente Prova' });
  await db('fatture').insert([
    { id: 'F1', cliente_id: 'C1', numero_fattura: '1', data_fattura: '2026-09-01',
      data_scadenza: '2026-09-30', importo_totale: 120, importo_pagato: 20,
      data_pagamento: '2026-09-20', stato_pagamento: 'Parzialmente Pagata' },
    { id: 'F2', cliente_id: 'C1', numero_fattura: '2', data_fattura: '2026-10-01',
      importo_totale: 100, importo_pagato: 0, stato_pagamento: 'Da Pagare' }
  ]);
  await db('fatture_aruba_elaborati').insert([
    { fattura_id: 'F1', cliente_id: 'C1', mese: 9, anno: 2026,
      numero_fattura: '1', data_fattura: '2026-09-01', importo_totale: 120 },
    { fattura_id: 'F2', cliente_id: 'C1', mese: 10, anno: 2026,
      numero_fattura: '2', data_fattura: '2026-10-01', importo_totale: 100 }
  ]);
  const service = createReceiptsService(db);
  await service.initialize();
  await service.initialize();
  let dashboard = await service.list();
  assert.equal(dashboard.riepilogo.daIncassare, 200);
  assert.equal(dashboard.fatture.find(row => row.id === 'F1').stato, 'Insoluta');
  assert.equal(dashboard.fatture.find(row => row.id === 'F1').registrata, true);
  assert.equal(dashboard.fatture.find(row => row.id === 'F2').registrata, true);
  assert.equal(dashboard.fatture.find(row => row.id === 'F1').storico.length, 1);
  assert.equal(dashboard.fatture.find(row => row.id === 'F1').storico[0].origine, 'storico');
  const today = todayInItaly();
  const partial = await service.register({ fatturaId: 'F1', data: today, importo: '30,50', idempotencyKey: 'test-partial-1' });
  assert.equal(partial.residuo, 69.5);
  assert.equal((await service.register({ fatturaId: 'F1', data: today, importo: '30,50', idempotencyKey: 'test-partial-1' })).alreadyRegistered, true);
  await assert.rejects(service.register({ fatturaId: 'F1', data: today, importo: '70.00' }), /superiore al residuo/);
  await assert.rejects(service.register({ fatturaId: 'F1', data: '2026-02-30', importo: '1' }), /data di incasso valida/);
  await assert.rejects(service.cancel({ receiptId: partial.id, reason: '' }), /motivo/);
  const final = await service.register({ fatturaId: 'F1', data: today, importo: '69.50' });
  assert.equal(final.residuo, 0);
  dashboard = await service.list();
  assert.equal(dashboard.fatture.find(row => row.id === 'F1').stato, 'Incassata');
  assert.equal(dashboard.riepilogo.daIncassare, 100);
  await service.cancel({ receiptId: final.id, reason: 'Registrazione duplicata' });
  dashboard = await service.list();
  assert.equal(dashboard.fatture.find(row => row.id === 'F1').residuo, 69.5);
  assert.equal(dashboard.fatture.find(row => row.id === 'F1').storico.find(row => row.id === final.id).motivoAnnullamento, 'Registrazione duplicata');
  await assert.rejects(service.cancel({ receiptId: dashboard.fatture.find(row => row.id === 'F1').storico.find(row => row.origine === 'storico').id, reason: 'Errore storico' }), /storico/);
  await service.setDueDate({ fatturaId: 'F1', date: '2099-01-01' });
  assert.equal((await service.list()).fatture.find(row => row.id === 'F1').stato, 'Parziale');
  await service.setDueDate({ fatturaId: 'F1', date: null });
  assert.equal((await service.list()).fatture.find(row => row.id === 'F1').scadenza, null);
});

test('incassi mostra solo le fatture elaborate, anche senza importazione generale', async t => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  await db.schema.createTable('clienti', table => {
    table.text('id').primary(); table.text('ragione_sociale');
  });
  await db.schema.createTable('fatture', table => {
    table.text('id').primary(); table.text('cliente_id'); table.text('numero_fattura');
    table.text('data_fattura'); table.text('data_scadenza'); table.text('data_pagamento');
    table.float('importo_totale'); table.float('importo_pagato'); table.text('stato_pagamento');
  });
  await db.schema.createTable('fatture_aruba_elaborati', table => {
    table.increments('id'); table.text('fattura_id'); table.text('cliente_id');
    table.integer('mese'); table.integer('anno'); table.text('numero_fattura');
    table.text('data_fattura'); table.float('importo_totale');
  });
  await db.schema.createTable('fatture_inviate_elaborati', table => {
    table.text('cliente_id'); table.integer('mese'); table.integer('anno'); table.text('inviata_at');
  });
  await db.schema.createTable('righe_bloccate_elaborati', table => {
    table.text('tipo'); table.integer('mese'); table.integer('anno'); table.text('soggetto_id'); table.text('snapshot');
  });
  await db.schema.createTable('dettaglio_mesi_chiusi_clienti', table => {
    table.text('cliente_id'); table.integer('mese'); table.integer('anno'); table.float('importo_totale');
  });
  await db.schema.createTable('log_attivita', table => {
    table.increments('id'); table.text('categoria'); table.text('icona');
    table.text('colore'); table.text('descrizione'); table.text('eseguito_da');
  });
  await db('clienti').insert([
    { id: 'OLD', ragione_sociale: 'Importazione storica' },
    { id: 'SEP', ragione_sociale: 'Fattura settembre' },
    { id: 'SENT', ragione_sociale: 'Solo inviata' }
  ]);
  await db('fatture').insert({ id: 'OLD1', cliente_id: 'OLD', numero_fattura: '486/26',
    data_fattura: '2026-08-03', importo_totale: 27940.26, importo_pagato: 0, stato_pagamento: 'Insoluto' });
  await db('fatture_aruba_elaborati').insert({ cliente_id: 'SEP', mese: 9, anno: 2026,
    numero_fattura: '12/26', data_fattura: '2026-09-29', importo_totale: 936 });
  await db('fatture_inviate_elaborati').insert([
    { cliente_id: 'SEP', mese: 9, anno: 2026, inviata_at: '2026-10-01T10:00:00Z' },
    { cliente_id: 'SENT', mese: 10, anno: 2026, inviata_at: '2026-09-30T22:30:00Z' }
  ]);
  await db('righe_bloccate_elaborati').insert({ tipo: 'cliente', soggetto_id: 'SENT',
    mese: 10, anno: 2026, snapshot: JSON.stringify({ importoTotale: 150 }) });
  const service = createReceiptsService(db);
  await service.initialize();
  const result = await service.list();
  assert.equal(result.fatture.length, 2);
  assert.equal(result.fatture.find(row => row.clienteId === 'OLD'), undefined);
  assert.deepEqual(result.fatture.map(row => [row.periodo, row.totale]), [['2026-09', 936], ['2026-10', 150]]);
  assert.equal(result.fatture[0].dataFattura, '2026-09-29');
  assert.equal(result.fatture[1].dataFattura, '2026-10-01');
  assert.equal(result.riepilogo.daIncassare, 1086);
  assert.equal(result.fatture[0].gestibile, true);
  assert.equal(result.fatture[1].registrata, false);
  const registrationId = result.fatture[0].id;
  const paymentDate = todayInItaly();
  const payment = await service.register({ fatturaId: registrationId, data: paymentDate,
    importo: '300.00', idempotencyKey: 'aruba-payment-1' });
  assert.equal(payment.residuo, 636);
  assert.equal((await service.register({ fatturaId: registrationId, data: paymentDate,
    importo: '300.00', idempotencyKey: 'aruba-payment-1' })).alreadyRegistered, true);
  await assert.rejects(service.register({ fatturaId: registrationId, data: paymentDate,
    importo: '700.00' }), /superiore al residuo/);
  const reversed = await service.register({ fatturaId: registrationId, data: paymentDate, importo: '50.00' });
  await service.cancel({ receiptId: reversed.id, reason: 'Acconto duplicato' });
  await service.setDueDate({ fatturaId: registrationId, date: '2099-01-01' });
  const withPayment = (await service.list()).fatture.find(row => row.clienteId === 'SEP');
  assert.equal(withPayment.incassato, 300);
  assert.equal(withPayment.stato, 'Parziale');
  assert.equal(withPayment.scadenza, '2099-01-01');
  const conflicting = { id: 'CONFLICT', cliente_id: 'SEP', numero_fattura: '12/26',
    data_fattura: '2026-09-29', importo_totale: 936, importo_pagato: 100, stato_pagamento: 'Parzialmente Pagata' };
  await db('fatture').insert(conflicting);
  assert.equal((await db.transaction(trx => reconcileOfficial(trx, conflicting))).stato, 'da_verificare');
  assert.equal((await db('fatture_aruba_elaborati').where({ cliente_id: 'SEP' }).first()).fattura_id, null);
  assert.equal((await db('incassi_fatture_aruba').where({ id: payment.id }).count('* as count').first()).count, 1);
  await db('fatture').where({ id: 'CONFLICT' }).del();
  const official = { id: 'SEP1', cliente_id: 'SEP', numero_fattura: '12/26',
    data_fattura: '2026-09-29', importo_totale: 936, importo_pagato: 0, stato_pagamento: 'Da Pagare' };
  await db('fatture').insert(official);
  assert.equal((await db.transaction(trx => reconcileOfficial(trx, official))).stato, 'riconciliata');
  assert.equal((await db('fatture').where({ id: 'SEP1' }).first()).importo_pagato, 300);
  assert.equal((await db('incassi_fatture_aruba').count('* as count').first()).count, 0);
  const linked = (await service.list()).fatture.find(row => row.clienteId === 'SEP');
  assert.equal(linked.id, 'SEP1');
  assert.equal(linked.incassato, 300);
  assert.equal(linked.storico.find(row => row.id === payment.id).importo, 300);
  assert.equal(linked.storico.find(row => row.id === reversed.id).motivoAnnullamento, 'Acconto duplicato');
  assert.equal((await service.register({ fatturaId: registrationId, data: paymentDate,
    importo: '300.00', idempotencyKey: 'aruba-payment-1' })).alreadyRegistered, true);
  await service.cancel({ receiptId: payment.id, reason: 'Incasso inserito per errore' });
  assert.equal((await service.list()).fatture.find(row => row.clienteId === 'SEP').incassato, 0);
});
