const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const makeKnex = require('knex');
const { createInvoiceUploadCleanup } = require('../fatture_caricamenti_cleanup');

test('pulizia multipla atomica: conserva gli incassi e rimuove solo i caricamenti selezionati', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-cleanup-'));
  const db = makeKnex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true,
    pool: { min: 1, max: 1 } });
  try {
    const connection = await db.client.acquireConnection();
    try {
      await new Promise((resolve, reject) => connection.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'),
        error => error ? reject(error) : resolve()));
    } finally { await db.client.releaseConnection(connection); }
    await db.raw('PRAGMA foreign_keys = ON');
    await db('clienti').insert({ id: 'C1', ragione_sociale: 'Cliente prova', partita_iva: '12345678901' });
    const uuid = '11111111-1111-4111-8111-111111111111';
    const xml = `${uuid}.xml`, pdf = `${uuid}.pdf`, officialId = `FAT_${uuid}`;
    const pdfRelative = path.join('uploads', 'fatture_aruba', pdf);
    fs.mkdirSync(path.join(root, 'uploads', 'fatture_aruba'), { recursive: true });
    fs.mkdirSync(path.join(root, 'uploads', 'unknown'), { recursive: true });
    fs.writeFileSync(path.join(root, pdfRelative), 'pdf');
    fs.writeFileSync(path.join(root, 'uploads', 'unknown', xml), 'xml');
    await db('fatture').insert({ id: officialId, cliente_id: 'C1', numero_fattura: 'FPR 1/26',
      data_fattura: '2026-11-03', importo_imponibile: 100, importo_iva: 22, importo_totale: 122,
      allegato_fattura: xml, importo_pagato: 0 });
    const [firstId] = await db('fatture_aruba_elaborati').insert({ cliente_id: 'C1', mese: 11, anno: 2026,
      numero_fattura: 'FPR 1/26', data_fattura: '2026-11-03', importo_totale: 122,
      allegato_path: pdfRelative, fattura_id: officialId, registrata_at: new Date().toISOString() });
    const [paidId] = await db('fatture_aruba_elaborati').insert({ cliente_id: 'C1', mese: 11, anno: 2026,
      numero_fattura: 'FPR 2/26', data_fattura: '2026-11-03', importo_totale: 50,
      registrata_at: new Date().toISOString() });
    await db('incassi_fatture_aruba').insert({ id: 'PAY1', registrazione_id: paidId,
      data_incasso: '2026-11-03', importo_cent: 100, registrato_at: new Date().toISOString() });
    await db('gruppi_fatturazione_extra').insert({ id: 'GROUP1', cliente_id: 'C1', mese: 11, anno: 2026,
      tipo: 'mensile', nome: 'Mensile', creata_at: new Date().toISOString(), fattura_registrazione_id: firstId });
    const cleanup = createInvoiceUploadCleanup(db, root);
    const listed = await cleanup.list({ mese: 11, anno: 2026 });
    assert.equal(listed.find(row => row.id === firstId).bloccata, false);
    assert.match(listed.find(row => row.id === paidId).motivo, /Pagamento/);
    await assert.rejects(() => cleanup.remove({ mese: 11, anno: 2026, ids: [firstId, paidId] }), /Pagamento/);
    assert.equal((await db('fatture_aruba_elaborati')).length, 2);
    assert.ok(fs.existsSync(path.join(root, pdfRelative)));
    assert.deepEqual(await cleanup.remove({ mese: 11, anno: 2026, ids: [firstId] }), { rimosse: 1 });
    assert.equal(await db('fatture').where({ id: officialId }).first(), undefined);
    assert.equal(await db('fatture_aruba_elaborati').where({ id: firstId }).first(), undefined);
    assert.ok(await db('fatture_aruba_elaborati').where({ id: paidId }).first());
    assert.equal((await db('gruppi_fatturazione_extra').where({ id: 'GROUP1' }).first()).fattura_registrazione_id, null);
    assert.equal(fs.existsSync(path.join(root, pdfRelative)), false);
    assert.equal(fs.existsSync(path.join(root, 'uploads', 'unknown', xml)), false);
  } finally { await db.destroy(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('un pagamento contabile registrato dopo la selezione impedisce la pulizia', async () => {
  const db = makeKnex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true,
    pool: { min: 1, max: 1 } });
  try {
    const connection = await db.client.acquireConnection();
    try {
      await new Promise((resolve, reject) => connection.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'),
        error => error ? reject(error) : resolve()));
    } finally { await db.client.releaseConnection(connection); }
    await db.raw('PRAGMA foreign_keys = ON');
    await db('clienti').insert({ id: 'C1', ragione_sociale: 'Cliente prova', partita_iva: '12345678901' });
    await db('fatture').insert({ id: 'FAT_ESISTENTE', cliente_id: 'C1', numero_fattura: 'FPR 3/26',
      data_fattura: '2026-11-03', importo_imponibile: 100, importo_iva: 22, importo_totale: 122,
      importo_pagato: 0 });
    const [id] = await db('fatture_aruba_elaborati').insert({ cliente_id: 'C1', mese: 11, anno: 2026,
      numero_fattura: 'FPR 3/26', data_fattura: '2026-11-03', importo_totale: 122,
      fattura_id: 'FAT_ESISTENTE', registrata_at: new Date().toISOString() });
    const cleanup = createInvoiceUploadCleanup(db, null);
    assert.equal((await cleanup.list({ mese: 11, anno: 2026 }))[0].bloccata, false);
    await db('incassi_fatture').insert({ id: 'PAY2', fattura_id: 'FAT_ESISTENTE',
      data_incasso: '2026-11-03', importo_cent: 12200, registrato_at: new Date().toISOString() });
    await assert.rejects(() => cleanup.remove({ mese: 11, anno: 2026, ids: [id] }), /Pagamento/);
    assert.ok(await db('fatture_aruba_elaborati').where({ id }).first());
    assert.ok(await db('fatture').where({ id: 'FAT_ESISTENTE' }).first());
    await db('incassi_fatture').where({ id: 'PAY2' }).del();
    assert.deepEqual(await cleanup.remove({ mese: 11, anno: 2026, ids: [id] }), { rimosse: 1 });
    assert.ok(await db('fatture').where({ id: 'FAT_ESISTENTE' }).first());
  } finally { await db.destroy(); }
});
