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
const parse = xml => xml2js.parseStringPromise(xml, { explicitArray: false,
  tagNameProcessors: [xml2js.processors.stripPrefix] });

test('genera un XML FPR12 con dati IVA e importi coerenti', async () => {
  const xml = buildInvoice(base);
  const doc = await parse(xml);
  const root = doc.FatturaElettronica;
  assert.equal(root.$.versione, 'FPR12');
  const namespaceDoc = await xml2js.parseStringPromise(xml, { explicitArray: false, xmlns: true,
    tagNameProcessors: [xml2js.processors.stripPrefix] });
  assert.equal(namespaceDoc.FatturaElettronica.$ns.uri, 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2');
  assert.equal(namespaceDoc.FatturaElettronica.FatturaElettronicaHeader.$ns.uri, '');
  assert.equal(namespaceDoc.FatturaElettronica.FatturaElettronicaBody.$ns.uri, '');
  assert.equal(root.FatturaElettronicaHeader.DatiTrasmissione.IdTrasmittente.IdCodice, '01879020517');
  assert.equal(root.FatturaElettronicaHeader.CedentePrestatore.Sede.Indirizzo, company.fatturazione_indirizzo);
  assert.equal(root.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.Numero, 'FPR 618/26');
  assert.equal(root.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo.Imposta, '22.00');
  assert.equal(root.FatturaElettronicaBody.DatiPagamento.DettaglioPagamento.ImportoPagamento, '122.00');
});

test('fattura un privato con solo codice fiscale e destinatario 0000000', async () => {
  const privato = { ...client, tipo_cliente: 'PRIVATO', partita_iva: null,
    codice_fiscale: 'RSSMRA80A01H501U', fatturazione_id_paese_iva: '', codice_sdi: '', pec: '' };
  const doc = await parse(buildInvoice({ ...base, client: privato }));
  const header = doc.FatturaElettronica.FatturaElettronicaHeader;
  assert.equal(header.CessionarioCommittente.DatiAnagrafici.CodiceFiscale, privato.codice_fiscale);
  assert.equal(header.CessionarioCommittente.DatiAnagrafici.IdFiscaleIVA, undefined);
  assert.equal(header.DatiTrasmissione.CodiceDestinatario, '0000000');
  assert.equal(doc.FatturaElettronica.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo.Imposta, '22.00');
});

test('fattura un ente con solo codice fiscale numerico senza partita IVA', async () => {
  const cfOnly = { ...client, tipo_cliente: 'PARTITA_IVA', partita_iva: null,
    codice_fiscale: '96117270585', fatturazione_id_paese_iva: '', codice_sdi: '', pec: '' };
  const db = table => {
    if (table === 'm2i_azienda_dati') return { where: () => ({ first: async () => company }) };
    if (table === 'clienti') return { whereIn: async () => [cfOnly] };
    if (['fatture_aruba_elaborati', 'fatture'].includes(table)) return { whereIn: () => ({ select: async () => [] }) };
    throw new Error(table);
  };
  const service = createArubaExport(db, { period: () => {}, accountingRows: async () => [row] },
    { groups: async () => [] });
  const result = await service.prepare({ mese: 10, anno: 2026, keys: ['cliente:c1'],
    data: '2026-10-13', primoNumero: 'FPR 618/26' });
  assert.deepEqual(result.errors, []);
  const doc = await parse(result.invoices[0].xml);
  const header = doc.FatturaElettronica.FatturaElettronicaHeader;
  assert.equal(header.CessionarioCommittente.DatiAnagrafici.CodiceFiscale, cfOnly.codice_fiscale);
  assert.equal(header.CessionarioCommittente.DatiAnagrafici.IdFiscaleIVA, undefined);
  assert.equal(header.DatiTrasmissione.CodiceDestinatario, '0000000');
});

test('anteprima Aruba accetta un privato senza SdI e PEC con ritenuta', async () => {
  const privato = { ...client, tipo_cliente: 'PRIVATO', partita_iva: null,
    codice_fiscale: 'RSSMRA80A01H501U', fatturazione_id_paese_iva: '', codice_sdi: '', pec: '',
    tipo_tassazione: 'TRAT. ACC.', fatturazione_tipo_ritenuta: 'RT02',
    fatturazione_aliquota_ritenuta: '4', fatturazione_causale_pagamento: 'A' };
  const privateRow = { ...row, tipoTassazione: 'TRAT. ACC.', importoTotale: 118 };
  const db = table => {
    if (table === 'm2i_azienda_dati') return { where: () => ({ first: async () => company }) };
    if (table === 'clienti') return { whereIn: async () => [privato] };
    if (['fatture_aruba_elaborati', 'fatture'].includes(table)) return { whereIn: () => ({ select: async () => [] }) };
    throw new Error(table);
  };
  const service = createArubaExport(db, { period: () => {}, accountingRows: async () => [privateRow] },
    { groups: async () => [] });
  const result = await service.prepare({ mese: 10, anno: 2026, keys: ['cliente:c1'],
    data: '2026-10-13', primoNumero: 'FPR 618/26' });
  assert.deepEqual(result.errors, []);
  assert.equal(result.invoices.length, 1);
  const doc = await parse(result.invoices[0].xml);
  assert.equal(doc.FatturaElettronica.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.DatiRitenuta.ImportoRitenuta, '4.00');
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

test('dichiarazione d’intento esporta N3.5 e i riferimenti della ricevuta', async () => {
  const intentClient = { ...client, tipo_tassazione: "DICHIARAZIONE D'INTENTO",
    percentuale_tassazione: 0, fatturazione_natura: 'N3.5',
    fatturazione_riferimento_normativo: "Art. 8, c. 1, lett. c) DPR 633/72",
    fatturazione_intento_protocollo: '08060120341234567-000001',
    fatturazione_intento_data: '2026-10-01' };
  const intentRow = { ...row, tipoTassazione: "DICHIARAZIONE D'INTENTO",
    importoIva: 0, importoTotale: 100 };
  const doc = await parse(buildInvoice({ ...base, client: intentClient, row: intentRow }));
  const body = doc.FatturaElettronica.FatturaElettronicaBody;
  const line = body.DatiBeniServizi.DettaglioLinee;
  const summary = body.DatiBeniServizi.DatiRiepilogo;
  assert.equal(line.AliquotaIVA, '0.00');
  assert.equal(line.Natura, 'N3.5');
  assert.equal(line.AltriDatiGestionali.TipoDato, 'INTENTO');
  assert.equal(line.AltriDatiGestionali.RiferimentoTesto, intentClient.fatturazione_intento_protocollo);
  assert.equal(line.AltriDatiGestionali.RiferimentoData, intentClient.fatturazione_intento_data);
  assert.equal(summary.Imposta, '0.00');
  assert.equal(summary.RiferimentoNormativo, intentClient.fatturazione_riferimento_normativo);
  assert.equal(summary.EsigibilitaIVA, undefined);
  assert.equal(body.DatiGenerali.DatiGeneraliDocumento.DatiRitenuta, undefined);
});

test('anteprima Aruba blocca la dichiarazione d’intento priva della ricevuta', async () => {
  const intentClient = { ...client, tipo_tassazione: "DICHIARAZIONE D'INTENTO",
    percentuale_tassazione: 0, fatturazione_natura: 'N3.5',
    fatturazione_riferimento_normativo: "Art. 8, c. 1, lett. c) DPR 633/72" };
  const intentRow = { ...row, tipoTassazione: "DICHIARAZIONE D'INTENTO",
    importoIva: 0, importoTotale: 100 };
  const db = table => {
    if (table === 'm2i_azienda_dati') return { where: () => ({ first: async () => company }) };
    if (table === 'clienti') return { whereIn: async () => [intentClient] };
    if (['fatture_aruba_elaborati', 'fatture'].includes(table)) return { whereIn: () => ({ select: async () => [] }) };
    throw new Error(table);
  };
  const result = await createArubaExport(db,
    { period: () => {}, accountingRows: async () => [intentRow] }, { groups: async () => [] })
    .prepare({ mese: 10, anno: 2026, keys: ['cliente:c1'],
      data: '2026-10-13', primoNumero: 'FPR 618/26' });
  assert.equal(result.invoices.length, 0);
  assert.match(result.errors[0].issues.join(' '), /Protocollo dichiarazione d’intento/);
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
