const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const knexFactory = require('knex');
const JSZip = require('jszip');
const { createArubaZipService, classify } = require('../fatture_aruba_zip');
const { createReceiptsService, todayInItaly } = require('../incassi_insoluti');

const invoiceXml = (number, amount) => `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica><FatturaElettronicaHeader><CessionarioCommittente><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>12345678901</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Cliente Test</Denominazione></Anagrafica></DatiAnagrafici></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Numero>${number}</Numero><Data>2026-10-08</Data><ImportoTotaleDocumento>${amount}</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi><DatiRiepilogo><ImponibileImporto>100.00</ImponibileImporto><Imposta>22.00</Imposta></DatiRiepilogo></DatiBeniServizi></FatturaElettronicaBody></FatturaElettronica>`;

test('ZIP Aruba: due fatture dello stesso cliente e differenze richiedono scelta esplicita', () => {
  const clients = [{ id: 'C1', ragione_sociale: 'Cliente Test', partita_iva: '12345678901' }];
  const base = { pdf: { name: 'documento.pdf' }, vat: '12345678901', taxCode: '',
    dataFattura: '2026-10-08', importoTotale: 122 };
  const duplicates = classify([{ ...base, id: 'a', numero: '1' }, { ...base, id: 'b', numero: '2' }],
    clients, [{ idCliente: 'C1', importoTotale: 122 }], []);
  assert.deepEqual(duplicates.map(item => item.issues.some(issue => issue.code === 'duplicato_cliente')), [true, true]);
  const mismatch = classify([{ ...base, id: 'a', numero: '1' }], clients,
    [{ idCliente: 'C1', importoTotale: 150 }], []);
  assert.equal(mismatch[0].issues.some(issue => issue.code === 'importo'), true);
  const otherPeriod = classify([{ ...base, id: 'a', numero: '1', periodoDescrizione: '2026-10' }],
    clients, [{ idCliente: 'C1', importoTotale: 122 }], [], [], '2026-09');
  assert.equal(otherPeriod[0].issues.some(issue => issue.code === 'periodo'), true);
  const renamed = classify([{ ...base, id: 'a', numero: '1', clienteXml: 'Nome Aruba Differente', tipoDocumento: 'TD01' }],
    clients, [{ idCliente: 'C1', importoTotale: 122 }], []);
  assert.equal(renamed[0].issues.some(issue => issue.code === 'nome'), true);
  const absent = classify([{ ...base, id: 'a', numero: '1', tipoDocumento: 'TD01' }], clients, [], []);
  assert.equal(absent[0].issues.some(issue => issue.code === 'mese'), true);
  const credit = classify([{ ...base, id: 'a', numero: 'NC1', tipoDocumento: 'TD04' }], clients,
    [{ idCliente: 'C1', importoTotale: 122 }], []);
  assert.equal(credit[0].issues.some(issue => issue.code === 'nota_credito'), true);
});

test('ZIP Aruba: anteprima, abbinamento PDF e registrazione contabile senza duplicati', async t => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  const previousDir = process.env.DATA_DIR;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-aruba-zip-'));
  process.env.DATA_DIR = dataDir;
  t.after(() => {
    if (previousDir === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previousDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  await db.schema.createTable('clienti', table => {
    table.text('id').primary(); table.text('ragione_sociale'); table.text('partita_iva'); table.text('codice_fiscale');
  });
  await db.schema.createTable('fatture', table => {
    table.text('id').primary(); table.text('cliente_id'); table.text('numero_fattura'); table.text('data_fattura');
    table.float('importo_imponibile'); table.float('importo_iva'); table.float('importo_totale');
    table.float('importo_pagato'); table.text('stato_pagamento'); table.text('allegato_fattura');
    table.text('tipo_documento');
    table.text('data_scadenza'); table.text('data_pagamento');
  });
  await db.schema.createTable('fatture_aruba_elaborati', table => {
    table.increments('id'); table.text('cliente_id'); table.integer('mese'); table.integer('anno');
    table.text('numero_fattura'); table.text('data_fattura'); table.float('importo_totale');
    table.text('allegato_path'); table.text('registrata_at'); table.text('registrata_da');
    table.text('fattura_id');
    table.text('tipo_documento');
  });
  await db.schema.createTable('documenti_aruba_mese', table => {
    table.increments('id'); table.text('cliente_id'); table.integer('mese'); table.integer('anno');
    table.text('tipo_documento'); table.text('numero_fattura'); table.text('data_fattura');
    table.float('importo_documento'); table.text('pdf_path'); table.text('xml_name');
    table.text('registrata_at'); table.text('registrata_da');
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
  await db('clienti').insert({ id: 'C1', ragione_sociale: 'Cliente Test', partita_iva: '12345678901' });
  await db('fatture_inviate_elaborati').insert({ cliente_id: 'C1', mese: 9, anno: 2026, inviata_at: '2026-10-08T00:00:00Z' });
  await db('righe_bloccate_elaborati').insert({ tipo: 'cliente', soggetto_id: 'C1',
    mese: 9, anno: 2026, snapshot: JSON.stringify({ importoTotale: 122 }) });
  const receipts = createReceiptsService(db);
  await receipts.initialize();
  const sentId = 'inviata:C1:2026:9';
  await receipts.register({ fatturaId: sentId, data: todayInItaly(), importo: '20.00' });
  const xmlZip = new JSZip(); xmlZip.file('XML/aruba_A.xml', invoiceXml('FPR 1/26', '122.00'));
  const pdfZip = new JSZip(); pdfZip.file('PDF/aruba_A.xml.p7m - FPR 1_26.pdf', Buffer.from('%PDF-1.4\nexample'));
  const args = { xmlZip: await xmlZip.generateAsync({ type: 'nodebuffer' }),
    pdfZip: await pdfZip.generateAsync({ type: 'nodebuffer' }), mese: 9, anno: 2026 };
  const workflow = { period: (_, mese, anno) => ({ mese: Number(mese), anno: Number(anno) }),
    lockedRows: async () => [{ idCliente: 'C1' }] };
  const service = createArubaZipService(db, workflow);
  const preview = await service.preview(args);
  assert.equal(preview.fatture[0].stato, 'pronta');
  assert.equal(preview.fatture[0].selezionata, true);
  const imported = await service.importSelected({ ...args, selected: ['aruba_A'], userId: 'TEST' });
  assert.equal(imported.importate, 1);
  assert.equal(imported.risultati[0].esito, 'riconciliata');
  const registration = await db('fatture_aruba_elaborati').first();
  const official = await db('fatture').first();
  assert.equal(registration.fattura_id, official.id);
  assert.equal(official.importo_pagato, 20);
  assert.ok(fs.readFileSync(path.join(dataDir, registration.allegato_path)).subarray(0, 5).equals(Buffer.from('%PDF-')));
  assert.ok(fs.existsSync(path.join(dataDir, 'uploads', 'unknown', official.allegato_fattura)));
  assert.equal((await service.preview(args)).fatture[0].stato, 'presente');
  assert.equal((await db('fatture')).length, 1);

  const creditXml = invoiceXml('NC 1/26', '122.00').replace('<TipoDocumento>TD01</TipoDocumento>', '<TipoDocumento>TD04</TipoDocumento>');
  const creditZip = new JSZip(); creditZip.file('XML/nota_C.xml', creditXml);
  const creditPdfZip = new JSZip(); creditPdfZip.file('PDF/altro-documento.pdf', Buffer.from('%PDF-1.4\nexample'));
  const creditArgs = { ...args, xmlZip: await creditZip.generateAsync({ type: 'nodebuffer' }),
    pdfZip: await creditPdfZip.generateAsync({ type: 'nodebuffer' }) };
  const creditPreview = await service.preview(creditArgs);
  assert.equal(creditPreview.fatture[0].selezionata, false);
  assert.equal(creditPreview.fatture[0].incongruenze.some(issue => issue.code === 'nota_credito'), true);
  assert.equal(creditPreview.fatture[0].incongruenze.some(issue => issue.code === 'pdf'), true);
  await assert.rejects(service.importSelected({ ...creditArgs, selected: [{ id: 'nota_C', pdfId: 'altro-documento', reviewed: true }] }),
    /nota di credito/);
  const attached = await service.importSelected({ ...creditArgs, selected: [{ id: 'nota_C',
    clienteId: 'C1', pdfId: 'altro-documento', creditMode: 'solo_allegato', reviewed: true }] });
  assert.equal(attached.importate, 1);
  assert.equal((await db('documenti_aruba_mese')).length, 1);
  assert.equal((await db('fatture')).length, 1);

  const deductionZip = new JSZip(); deductionZip.file('XML/nota_D.xml', creditXml.replace('NC 1/26', 'NC 2/26'));
  const deductionPdf = new JSZip(); deductionPdf.file('PDF/nota_D.xml - NC 2_26.pdf', Buffer.from('%PDF-1.4\nexample'));
  const deductionArgs = { ...args, xmlZip: await deductionZip.generateAsync({ type: 'nodebuffer' }),
    pdfZip: await deductionPdf.generateAsync({ type: 'nodebuffer' }) };
  const deducted = await service.importSelected({ ...deductionArgs,
    selected: [{ id: 'nota_D', creditMode: 'deduci', reviewed: true }] });
  assert.equal(deducted.importate, 1);
  assert.equal((await db('fatture').where({ tipo_documento: 'TD04' }).first()).importo_totale, -122);
  const listing = await receipts.list();
  assert.equal(listing.fatture.find(row => row.numero === 'NC 2/26').stato, 'Nota di credito');
  assert.equal(listing.fatture.find(row => row.numero === 'NC 2/26').incongruenza, false);

  await db('clienti').insert({ id: 'C2', ragione_sociale: 'Cliente Esterno', partita_iva: '98765432109' });
  const extraXml = invoiceXml('FPR 3/26', '122.00').replace('12345678901', '98765432109')
    .replace('Cliente Test', 'Nome diverso in Aruba');
  const extraZip = new JSZip(); extraZip.file('XML/extra_E.xml', extraXml);
  const extraPdf = new JSZip(); extraPdf.file('PDF/extra_E.xml - FPR 3_26.pdf', Buffer.from('%PDF-1.4\nexample'));
  const extraArgs = { ...args, xmlZip: await extraZip.generateAsync({ type: 'nodebuffer' }),
    pdfZip: await extraPdf.generateAsync({ type: 'nodebuffer' }) };
  const extraPreview = (await service.preview(extraArgs)).fatture[0];
  assert.equal(extraPreview.incongruenze.some(issue => issue.code === 'nome'), true);
  assert.equal(extraPreview.incongruenze.some(issue => issue.code === 'mese'), true);
  await assert.rejects(service.importSelected({ ...extraArgs,
    selected: [{ id: 'extra_E', reviewed: true }] }), /fuori mese/);
  const extraResult = await service.importSelected({ ...extraArgs,
    selected: [{ id: 'extra_E', reviewed: true, extra: true }] });
  assert.equal(extraResult.importate, 1);
  assert.equal((await db('fatture_aruba_elaborati').where({ cliente_id: 'C2' }).first()).numero_fattura, 'FPR 3/26');
});
