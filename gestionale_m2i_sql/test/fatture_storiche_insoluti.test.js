const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const knexFactory = require('knex');
const JSZip = require('jszip');
const { createHistoricalInvoiceService } = require('../fatture_storiche_insoluti');

const xml = (number, type = 'TD01') => `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica><FatturaElettronicaHeader>
<CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>15989811003</IdCodice></IdFiscaleIVA></DatiAnagrafici></CedentePrestatore>
<CessionarioCommittente><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>12345678901</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Cliente Storico</Denominazione></Anagrafica></DatiAnagrafici>
<Sede><Indirizzo>Via Test</Indirizzo><NumeroCivico>4</NumeroCivico><CAP>00100</CAP><Comune>Roma</Comune><Provincia>RM</Provincia></Sede></CessionarioCommittente>
</FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>${type}</TipoDocumento><Numero>${number}</Numero><Data>2026-08-08</Data><ImportoTotaleDocumento>122.00</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali>
<DatiBeniServizi><DatiRiepilogo><ImponibileImporto>100.00</ImponibileImporto><Imposta>22.00</Imposta></DatiRiepilogo></DatiBeniServizi>
<DatiPagamento><DettaglioPagamento><DataScadenzaPagamento>2026-09-30</DataScadenzaPagamento></DettaglioPagamento></DatiPagamento>
</FatturaElettronicaBody></FatturaElettronica>`;

test('fatture storiche: anteprima, cliente non attivo, duplicati e note di credito', async t => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-fatture-storiche-'));
  t.after(async () => { await db.destroy(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  await db.schema.createTable('m2i_azienda_dati', table => { table.increments('id'); table.text('partita_iva'); });
  await db('m2i_azienda_dati').insert({ partita_iva: '15989811003' });
  await db.schema.createTable('clienti', table => {
    table.text('id').primary(); table.text('ragione_sociale'); table.text('partita_iva'); table.text('codice_fiscale');
    table.text('tipo_cliente'); table.text('attivo'); table.text('indirizzo_sede'); table.text('civico_sede');
    table.text('cap'); table.text('citta'); table.text('provincia'); table.text('sede_legale');
    table.text('codice_sdi'); table.text('pec'); table.text('note');
  });
  await db.schema.createTable('fatture', table => {
    table.text('id').primary(); table.text('cliente_id'); table.text('numero_fattura'); table.text('data_fattura');
    table.float('importo_imponibile'); table.float('importo_iva'); table.float('importo_totale');
    table.float('importo_pagato'); table.text('stato_pagamento'); table.text('data_scadenza');
    table.text('tipo_documento'); table.text('allegato_fattura'); table.text('note'); table.text('creato_da');
  });
  await db.schema.createTable('fatture_aruba_elaborati', table => {
    table.increments('id'); table.text('numero_fattura'); table.text('data_fattura');
  });
  await db('fatture_aruba_elaborati').insert({ numero_fattura: 'FPR 1/26', data_fattura: '2026-08-08' });
  const service = createHistoricalInvoiceService(db, { dataDir });
  await service.initialize();
  const zip = new JSZip();
  for (const [id, number, type] of [['a', 'FPR 1/26', 'TD01'], ['b', 'FPR 2/26', 'TD01'], ['c', 'NC 1/26', 'TD04']]) {
    zip.file(`XML/${id}.xml`, xml(number, type));
    zip.file(`PDF/${id}.xml - ${number.replace('/', '_')}.pdf`, Buffer.from('%PDF-1.4\nexample'));
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const preview = await service.preview({ zip: buffer });
  assert.deepEqual(preview.fatture.map(row => row.stato), ['presente', 'pronta', 'nota_credito']);
  assert.equal(preview.fatture[1].scadenza, '2026-09-30');
  assert.equal(preview.fatture[1].nuovoCliente, true);
  const result = await service.importSelected({ zip: buffer, selected: [{ id: 'b' }], userId: 'test' });
  assert.equal(result.importate, 1);
  assert.equal(result.clientiCreati, 1);
  assert.equal((await db('clienti').first()).attivo, 'NO');
  const invoice = await db('fatture').first();
  assert.equal(invoice.numero_fattura, 'FPR 2/26');
  assert.equal(invoice.data_scadenza, '2026-09-30');
  assert.equal(invoice.importo_totale, 122);
  assert.ok(await service.pdf(invoice.id));
  assert.equal((await service.preview({ zip: buffer })).fatture[1].stato, 'presente');
  assert.equal((await service.importSelected({ zip: buffer, selected: [{ id: 'b' }] })).importate, 0);
  assert.equal((await db('fatture').count('* as total').first()).total, 1);
});
