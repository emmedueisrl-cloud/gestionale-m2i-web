const test = require('node:test');
const assert = require('node:assert/strict');
const knexFactory = require('knex');
const { createReceiptsService, todayInItaly } = require('../incassi_insoluti');

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
    table.text('numero_fattura'); table.text('data_fattura'); table.float('importo_totale');
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
  await db('fatture_aruba_elaborati').insert({ fattura_id: null, cliente_id: 'C1',
    numero_fattura: '2', data_fattura: '2026-10-01', importo_totale: 100 });
  const service = createReceiptsService(db);
  await service.initialize();
  await service.initialize();
  let dashboard = await service.list();
  assert.equal(dashboard.riepilogo.daIncassare, 200);
  assert.equal(dashboard.fatture.find(row => row.id === 'F1').stato, 'Insoluta');
  assert.equal(dashboard.fatture.find(row => row.id === 'F1').registrata, false);
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
