const test = require('node:test');
const assert = require('node:assert/strict');
const xml2js = require('xml2js');
const JSZip = require('jszip');
const { buildInvoice, createArubaExport } = require('../fatture_aruba_export');

const company = {
  ragione_sociale: 'M2I SRL', partita_iva: '15989811003', codice_fiscale: '15989811003',
  fatturazione_id_paese_iva: 'IT', fatturazione_indirizzo: 'Via del Fontanile Anagnino 183',
  fatturazione_cap: '00118', fatturazione_citta: 'Roma', fatturazione_provincia: 'RM',
  fatturazione_paese: 'IT', fatturazione_regime: 'RF01', fatturazione_iban: 'IT53F0306905058100000006375'
};
const client = {
  id: 'c1', ragione_sociale: 'Cliente Test', partita_iva: '12345678901', codice_fiscale: '12345678901',
  fatturazione_id_paese_iva: 'IT', indirizzo_sede: 'Via Prova', civico_sede: '5', cap: '00100',
  citta: 'Roma', provincia: 'RM', fatturazione_paese: 'IT', codice_sdi: 'SUBM70N',
  tipo_tassazione: 'IVA', percentuale_tassazione: 22,
  fatturazione_esigibilita_iva: 'I', fatturazione_modalita_pagamento: 'MP05',
  fatturazione_condizioni_pagamento: 'TP02'
};
const row = { idCliente: 'c1', ragioneSociale: 'Cliente Test', imponibile: 100,
  importoIva: 22, importoTotale: 122, tipoTassazione: 'IVA',
  descrizioneFattura: 'Servizio di pulizia Ottobre 2026' };
const base = { company, client, row, lines: [{ description: row.descrizioneFattura, amount: 100 }],
  date: '2026-10-13', number: 'FPR 618/26', progressivo: 'A1B2C3' };
const parse = xml => xml2js.parseStringPromise(xml, { explicitArray: false });

test('genera un XML FPR12 con dati IVA e importi coerenti', async () => {
  const doc = await parse(buildInvoice(base));
  const root = doc.FatturaElettronica;
  assert.equal(root.$.versione, 'FPR12');
  assert.equal(root.FatturaElettronicaHeader.DatiTrasmissione.IdTrasmittente.IdCodice, '01879020517');
  assert.equal(root.FatturaElettronicaHeader.CedentePrestatore.Sede.Indirizzo, company.fatturazione_indirizzo);
  assert.equal(root.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.Numero, 'FPR 618/26');
  assert.equal(root.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo.Imposta, '22.00');
  assert.equal(root.FatturaElettronicaBody.DatiPagamento.DettaglioPagamento.ImportoPagamento, '122.00');
});

test('reverse charge con cliente identificato solo tramite codice fiscale', async () => {
  const cfOnly = { ...client, partita_iva: '96117270585', codice_fiscale: '96117270585',
    fatturazione_id_paese_iva: '', tipo_tassazione: 'REVERSE CHARGE',
    fatturazione_natura: 'N6.7', fatturazione_riferimento_normativo: 'Art. 17 DPR 633/72' };
  const doc = await parse(buildInvoice({ ...base, client: cfOnly,
    row: { ...row, importoIva: 0, importoTotale: 100 } }));
  const recipient = doc.FatturaElettronica.FatturaElettronicaHeader.CessionarioCommittente.DatiAnagrafici;
  assert.equal(recipient.CodiceFiscale, '96117270585');
  assert.equal(recipient.IdFiscaleIVA, undefined);
  const summary = doc.FatturaElettronica.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo;
  assert.equal(summary.Natura, 'N6.7');
  assert.equal(summary.Imposta, '0.00');
});

test('ritenuta al 4% applicata al pagamento netto', async () => {
  const withheld = { ...client, tipo_tassazione: 'TRAT. ACC.',
    fatturazione_tipo_ritenuta: 'RT02', fatturazione_aliquota_ritenuta: '4',
    fatturazione_causale_pagamento: 'A' };
  const doc = await parse(buildInvoice({ ...base, client: withheld,
    row: { ...row, importoTotale: 118 } }));
  const body = doc.FatturaElettronica.FatturaElettronicaBody;
  assert.equal(body.DatiGenerali.DatiGeneraliDocumento.DatiRitenuta.ImportoRitenuta, '4.00');
  assert.equal(body.DatiGenerali.DatiGeneraliDocumento.ImportoTotaleDocumento, '122.00');
  assert.equal(body.DatiPagamento.DettaglioPagamento.ImportoPagamento, '118.00');
});

test('rifiuta importi che non coincidono con l’elaborato', () => {
  assert.throws(() => buildInvoice({ ...base, row: { ...row, importoTotale: 123 } }), /non coincidono/);
});

test('l’anteprima segnala numeri già registrati senza produrre XML', async () => {
  const db = table => {
    if (table === 'm2i_azienda_dati') return { where: () => ({ first: async () => company }) };
    if (table === 'clienti') return { whereIn: async () => [client] };
    if (table === 'fatture_aruba_elaborati') return { whereIn: () => ({ select: async () => [{ numero_fattura: 'FPR 618/26' }] }) };
    if (table === 'fatture') return { whereIn: () => ({ select: async () => [] }) };
    throw new Error(table);
  };
  const service = createArubaExport(db, { period: () => {}, accountingRows: async () => [row] },
    { groups: async () => [] });
  const result = await service.prepare({ mese: 10, anno: 2026, keys: ['cliente:c1'],
    data: '2026-10-13', primoNumero: 'FPR 618/26' });
  assert.equal(result.invoices.length, 0);
  assert.match(result.errors[0].issues.join(' '), /già registrato/);
});

test('scarica uno ZIP di XML numerati in sequenza con extra mensile nella fattura principale', async () => {
  const second = { ...client, id: 'c2', ragione_sociale: 'Secondo Cliente',
    partita_iva: '12345678902', codice_fiscale: '12345678902' };
  const extra = { id: 'g1', clienteId: 'c1', tipo: 'mensile', servizi: ['s1'],
    tuttiBlindati: true, imponibileExtra: 50, totaleExtraPrevisto: 61,
    descrizioneFattura: 'Servizio extra Ottobre 2026' };
  const db = table => {
    if (table === 'm2i_azienda_dati') return { where: () => ({ first: async () => company }) };
    if (table === 'clienti') return { whereIn: async () => [client, second] };
    if (table === 'fatture_aruba_elaborati') return { whereIn: () => ({ select: async () => [] }) };
    if (table === 'fatture') return { whereIn: () => ({ select: async () => [] }) };
    throw new Error(table);
  };
  const service = createArubaExport(db, { period: () => {}, accountingRows: async () => [row,
    { ...row, idCliente: 'c2', ragioneSociale: 'Secondo Cliente' }] }, { groups: async () => [extra] });
  const result = await service.download({ mese: 10, anno: 2026,
    keys: ['cliente:c1', 'cliente:c2'], data: '2026-10-13', primoNumero: 'FPR 618/26' });
  assert.equal(result.errors, undefined);
  const zip = await JSZip.loadAsync(result.buffer);
  const files = Object.values(zip.files);
  assert.equal(files.length, 2);
  const parsed = await Promise.all(files.map(file => file.async('string').then(parse)));
  const byNumber = new Map(parsed.map(doc => {
    const body = doc.FatturaElettronica.FatturaElettronicaBody;
    return [body.DatiGenerali.DatiGeneraliDocumento.Numero, body];
  }));
  assert.deepEqual([...byNumber.keys()], ['FPR 618/26', 'FPR 619/26']);
  assert.equal(byNumber.get('FPR 618/26').DatiBeniServizi.DatiRiepilogo.ImponibileImporto, '150.00');
  assert.equal(byNumber.get('FPR 618/26').DatiBeniServizi.DatiRiepilogo.Imposta, '33.00');
});
