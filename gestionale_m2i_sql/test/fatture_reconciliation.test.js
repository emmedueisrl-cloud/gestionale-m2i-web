const test = require('node:test');
const assert = require('node:assert/strict');
const knexFactory = require('knex');
const { reconcileOfficial, reconcileRegistration, registrationStatuses } = require('../fatture_reconciliation');
const { inspectChoice, requireChoices, replaceRegistration } = require('../fatture_import_choice');

test('Aruba e XML/CSV si riconciliano nei due ordini, senza duplicati o abbinamenti incerti', async () => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  try {
    await db.schema.createTable('fatture', t => {
      t.string('id').primary(); t.string('cliente_id'); t.string('numero_fattura');
      t.string('data_fattura'); t.decimal('importo_totale'); t.string('allegato_fattura');
    });
    await db.schema.createTable('fatture_aruba_elaborati', t => {
      t.increments('id'); t.string('cliente_id'); t.string('numero_fattura');
      t.string('data_fattura'); t.decimal('importo_totale'); t.string('fattura_id').unique();
    });
    const operational = { cliente_id: 'C1', numero_fattura: '42/A', data_fattura: '2026-09-28', importo_totale: 122 };
    await db('fatture_aruba_elaborati').insert(operational);
    assert.equal((await reconcileRegistration(db, operational)).stato, 'in_attesa_importazione');
    const official = { id: 'F1', ...operational };
    await db('fatture').insert(official);
    assert.equal((await reconcileOfficial(db, official)).stato, 'riconciliata');
    assert.equal((await reconcileOfficial(db, official)).stato, 'riconciliata');
    assert.equal((await db('fatture_aruba_elaborati').first()).fattura_id, 'F1');

    await db('fatture').insert({ id: 'F2', cliente_id: 'C2', numero_fattura: '43/A', data_fattura: '2026-09-29', importo_totale: 50 });
    const second = { cliente_id: 'C2', numero_fattura: '43/A', data_fattura: '2026-09-29', importo_totale: 50 };
    await db('fatture_aruba_elaborati').insert(second);
    assert.equal((await reconcileRegistration(db, second)).stato, 'riconciliata');

    const wrong = { cliente_id: 'C3', numero_fattura: '44/A', data_fattura: '2026-09-29', importo_totale: 60 };
    await db('fatture_aruba_elaborati').insert(wrong);
    await db('fatture').insert({ id: 'F3', ...wrong, importo_totale: 70 });
    assert.equal((await reconcileOfficial(db, { id: 'F3', ...wrong, importo_totale: 70 })).stato, 'da_verificare');
    const wrongDate = { cliente_id: 'C4', numero_fattura: '45/A', data_fattura: '2026-09-29', importo_totale: 60 };
    await db('fatture_aruba_elaborati').insert(wrongDate);
    await db('fatture').insert({ id: 'F4', ...wrongDate, data_fattura: '2026-09-30' });
    assert.equal((await reconcileRegistration(db, wrongDate)).stato, 'da_verificare');
    const duplicate = { cliente_id: 'C5', numero_fattura: '46/A', data_fattura: '2026-09-29', importo_totale: 60 };
    await db('fatture_aruba_elaborati').insert(duplicate);
    await db('fatture').insert([{ id: 'F5', ...duplicate }, { id: 'F6', ...duplicate }]);
    assert.equal((await reconcileRegistration(db, duplicate)).stato, 'da_verificare');
    const rows = await registrationStatuses(db, await db('fatture_aruba_elaborati'));
    assert.equal(rows.find(row => row.cliente_id === 'C3').stato_riconciliazione, 'da_verificare');
    assert.equal(rows.filter(row => row.stato_riconciliazione === 'riconciliata').length, 2);
  } finally {
    await db.destroy();
  }
});

test('una fattura discordante richiede scelta, mantiene il precedente per default e storicizza la sostituzione', async () => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  try {
    await db.schema.createTable('fatture', t => {
      t.string('id').primary(); t.string('cliente_id'); t.string('numero_fattura');
      t.string('data_fattura'); t.decimal('importo_totale'); t.decimal('importo_pagato');
      t.decimal('importo_imponibile'); t.decimal('importo_iva');
    });
    await db.schema.createTable('fatture_aruba_elaborati', t => {
      t.increments('id'); t.string('cliente_id'); t.string('numero_fattura');
      t.string('data_fattura'); t.decimal('importo_totale'); t.string('fattura_id'); t.string('allegato_path');
      t.integer('mese'); t.integer('anno');
    });
    await db.schema.createTable('rettifiche_fatture_aruba', t => {
      t.increments('id'); t.integer('registrazione_id'); t.text('precedente'); t.text('successivo');
      t.text('fonte'); t.text('rettificata_at'); t.integer('rettificata_da');
    });
    const prior = { cliente_id: 'C1', numero_fattura: '7/A', data_fattura: '2026-09-28', importo_totale: 100,
      mese: 9, anno: 2026,
      allegato_path: 'uploads/fatture_aruba/originale.pdf' };
    await db('fatture_aruba_elaborati').insert(prior);
    const incoming = { ...prior, data_fattura: '2026-09-29', importo_totale: 120, idRow: 'R1' };
    const inspection = await inspectChoice(db, incoming);
    assert.equal(inspection.conflict.sostituibile, true);
    assert.notEqual(inspection.conflict.key, (await inspectChoice(db, { ...incoming, importo_totale: 121 })).conflict.key);
    assert.ok((await inspectChoice(db, { ...incoming, data_fattura: '2027-01-02', mese: 9, anno: 2026 })).conflict);
    assert.throws(() => requireChoices([inspection], {}), { status: 409 });
    assert.equal((await db('fatture_aruba_elaborati').first()).importo_totale, 100);
    requireChoices([inspection], { [inspection.conflict.key]: 'mantieni' });
    assert.equal((await db('fatture_aruba_elaborati').first()).importo_totale, 100);
    requireChoices([inspection], { [inspection.conflict.key]: 'sostituisci' });
    await replaceRegistration(db, await db('fatture_aruba_elaborati').first(), incoming, 'XML', 3);
    const current = await db('fatture_aruba_elaborati').first();
    assert.equal(current.importo_totale, 120);
    assert.equal(current.allegato_path, null);
    assert.equal(JSON.parse((await db('rettifiche_fatture_aruba').first()).precedente).allegato_path, prior.allegato_path);
    assert.equal((await inspectChoice(db, incoming)).conflict, null);
    await db('fatture').insert({ id: 'F2', cliente_id: 'C1', numero_fattura: '7/A', data_fattura: '2027-09-29', importo_totale: 140 });
    assert.equal((await inspectChoice(db, incoming)).official, null);
    await db('fatture').insert({ id: 'F1', cliente_id: 'C1', numero_fattura: '7/A', data_fattura: '2026-09-29', importo_totale: 120, importo_pagato: 10 });
    assert.equal((await inspectChoice(db, { ...incoming, importo_totale: 140 })).conflict.sostituibile, false);
    await db('fatture').where({ id: 'F1' }).update({ importo_pagato: 0, importo_imponibile: 100, importo_iva: 20 });
    assert.ok((await inspectChoice(db, { ...incoming, importo_imponibile: 110, importo_iva: 10 })).conflict);
  } finally {
    await db.destroy();
  }
});
