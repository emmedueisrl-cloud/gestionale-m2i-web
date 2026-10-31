const crypto = require('node:crypto');
const JSZip = require('jszip');
const { Builder } = require('xml2js');
const { readinessCompany, readinessClient } = require('./fatturazione_anagrafiche');

const value = input => String(input ?? '').trim();
const cents = input => Math.round(Number(input) * 100);
const money = input => (input / 100).toFixed(2);
const dateValid = input => /^\d{4}-\d{2}-\d{2}$/.test(input) &&
  !Number.isNaN(Date.parse(`${input}T00:00:00Z`)) && new Date(`${input}T00:00:00Z`).toISOString().slice(0, 10) === input;
const keyOf = row => row.gruppoExtraId ? `extra:${row.gruppoExtraId}` : `cliente:${row.idCliente}`;
const isEligible = row => !row.rigaExtra && !(row.fattureMensili ?? row.fatture)?.length && !row.documentiAruba?.length &&
  !row.fatturaInviataAt && (!row.gruppoExtraId || row.gruppoExtraTipo === 'extra' && row.tuttiBlindati);

function party(profile, issuer) {
  const vat = value(profile.partita_iva).replace(/^IT(?=\d{11}$)/i, '');
  const country = value(profile.fatturazione_id_paese_iva).toUpperCase();
  const fiscal = value(profile.codice_fiscale).toUpperCase();
  const identity = {};
  // Una scheda CF-only può contenere nel vecchio campo P.IVA una copia del CF.
  // Senza il Paese IVA verificato, quel dato non va emesso come IdFiscaleIVA.
  if (country && vat) identity.IdFiscaleIVA = { IdPaese: country, IdCodice: vat };
  if (fiscal) identity.CodiceFiscale = fiscal;
  identity.Anagrafica = { Denominazione: value(profile.ragione_sociale) };
  if (issuer) identity.RegimeFiscale = value(profile.fatturazione_regime);
  const address = issuer ? value(profile.fatturazione_indirizzo) : value(profile.indirizzo_sede);
  const sede = { Indirizzo: address };
  if (!issuer && value(profile.civico_sede)) sede.NumeroCivico = value(profile.civico_sede);
  sede.CAP = value(issuer ? profile.fatturazione_cap : profile.cap);
  sede.Comune = value(issuer ? profile.fatturazione_citta : profile.citta);
  const province = value(issuer ? profile.fatturazione_provincia : profile.provincia);
  if (province) sede.Provincia = province;
  sede.Nazione = value(profile.fatturazione_paese).toUpperCase();
  const result = { DatiAnagrafici: identity, Sede: sede };
  if (issuer && value(profile.fatturazione_ufficio_rea) && value(profile.fatturazione_numero_rea)) {
    result.IscrizioneREA = { Ufficio: value(profile.fatturazione_ufficio_rea),
      NumeroREA: value(profile.fatturazione_numero_rea) };
    if (value(profile.capitale_sociale)) result.IscrizioneREA.CapitaleSociale = Number(profile.capitale_sociale).toFixed(2);
    if (value(profile.fatturazione_socio_unico)) result.IscrizioneREA.SocioUnico = value(profile.fatturazione_socio_unico);
    if (value(profile.fatturazione_stato_liquidazione)) result.IscrizioneREA.StatoLiquidazione = value(profile.fatturazione_stato_liquidazione);
  }
  return result;
}

function buildInvoice({ company, client, row, lines, date, number, progressivo }) {
  const regime = value(client.tipo_tassazione || row.tipoTassazione).toUpperCase();
  const reverse = regime === 'REVERSE CHARGE';
  const withholding = regime === 'TRAT. ACC.' || regime === 'TRATTENUTA ACCONTO';
  const rate = reverse ? 0 : Number(client.percentuale_tassazione) > 0 ? Number(client.percentuale_tassazione) : 22;
  const taxable = lines.reduce((sum, line) => sum + cents(line.amount), 0);
  const baseTax = row.importoIva == null ? Math.round(cents(row.imponibile) * rate / 100) : cents(row.importoIva);
  const tax = baseTax +
    lines.filter(line => line.extraMonthly).reduce((sum, line) => sum + Math.round(cents(line.amount) * rate / 100), 0);
  const withholdingCents = withholding ? Math.round(taxable * Number(client.fatturazione_aliquota_ritenuta || 4) / 100) : 0;
  const gross = taxable + tax;
  const expectedNet = cents(row.importoTotale) + lines.filter(line => line.extraMonthly)
    .reduce((sum, line) => sum + cents(line.expectedTotal), 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100 || !Number.isSafeInteger(taxable) ||
      taxable <= 0 || !Number.isSafeInteger(gross) ||
      Math.abs(gross - withholdingCents - expectedNet) > 1) {
    throw new Error('Imponibile, IVA, ritenuta e totale non coincidono con l’elaborato.');
  }
  const destination = value(client.codice_sdi).toUpperCase() || '0000000';
  const transmission = { IdTrasmittente: { IdPaese: 'IT', IdCodice: '01879020517' },
    ProgressivoInvio: progressivo, FormatoTrasmissione: 'FPR12', CodiceDestinatario: destination };
  if (destination === '0000000' && value(client.pec)) transmission.PECDestinatario = value(client.pec);
  const generalDocument = { TipoDocumento: 'TD01', Divisa: 'EUR', Data: date, Numero: number };
  if (withholding) generalDocument.DatiRitenuta = {
    TipoRitenuta: value(client.fatturazione_tipo_ritenuta), ImportoRitenuta: money(withholdingCents),
    AliquotaRitenuta: Number(client.fatturazione_aliquota_ritenuta || 4).toFixed(2),
    CausalePagamento: value(client.fatturazione_causale_pagamento)
  };
  generalDocument.ImportoTotaleDocumento = money(gross);
  const detail = lines.map((line, index) => ({ NumeroLinea: index + 1,
    Descrizione: value(line.description), Quantita: '1.00', PrezzoUnitario: money(cents(line.amount)),
    PrezzoTotale: money(cents(line.amount)), AliquotaIVA: rate.toFixed(2),
    ...(reverse ? { Natura: value(client.fatturazione_natura) } : {}),
    ...(withholding ? { Ritenuta: 'SI' } : {}) }));
  const summary = { AliquotaIVA: rate.toFixed(2),
    ...(reverse ? { Natura: value(client.fatturazione_natura) } : {}),
    ImponibileImporto: money(taxable), Imposta: money(tax) };
  if (value(client.fatturazione_esigibilita_iva) && !reverse) summary.EsigibilitaIVA = value(client.fatturazione_esigibilita_iva);
  if (reverse && value(client.fatturazione_riferimento_normativo)) summary.RiferimentoNormativo = value(client.fatturazione_riferimento_normativo);
  const body = { DatiGenerali: { DatiGeneraliDocumento: generalDocument },
    DatiBeniServizi: { DettaglioLinee: detail, DatiRiepilogo: summary } };
  if (value(client.fatturazione_modalita_pagamento)) {
    const payment = { ModalitaPagamento: value(client.fatturazione_modalita_pagamento),
      ImportoPagamento: money(gross - withholdingCents) };
    if (value(company.fatturazione_iban) && payment.ModalitaPagamento === 'MP05') payment.IBAN = value(company.fatturazione_iban);
    body.DatiPagamento = { CondizioniPagamento: value(client.fatturazione_condizioni_pagamento) || 'TP02',
      DettaglioPagamento: payment };
  }
  return new Builder({ headless: false, renderOpts: { pretty: true }, xmldec: { version: '1.0', encoding: 'UTF-8' } })
    .buildObject({ 'p:FatturaElettronica': { $: {
      'xmlns:p': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2', versione: 'FPR12' },
    FatturaElettronicaHeader: { DatiTrasmissione: transmission,
      CedentePrestatore: party(company, true), CessionarioCommittente: party(client, false) },
    FatturaElettronicaBody: body } });
}

function createArubaExport(db, workflow, extrasService) {
  async function prepare(input) {
    const mese = Number(input.mese), anno = Number(input.anno);
    workflow.period('cliente', mese, anno);
    const keys = input.keys;
    if (!Array.isArray(keys) || !keys.length || keys.length > 300 ||
      keys.some(key => typeof key !== 'string' || !/^(cliente|extra):[\w-]+$/.test(key)) || new Set(keys).size !== keys.length) {
      throw new Error('Seleziona da 1 a 300 fatture da elaborare.');
    }
    const date = value(input.data), firstNumber = value(input.primoNumero);
    const match = /^(.*?)(\d+)(\/\d{2,4})?$/.exec(firstNumber);
    if (!dateValid(date) || !match || firstNumber.length > 20 || !/^[\w ./-]*$/.test(firstNumber)) {
      throw new Error('Inserisci una data e un primo numero fattura validi, per esempio FPR 618/26.');
    }
    const [rows, groups, company] = await Promise.all([
      workflow.accountingRows('cliente', mese, anno), extrasService.groups(mese, anno),
      db('m2i_azienda_dati').where({ id: 1 }).first()
    ]);
    const candidates = [...rows.filter(row => !row.rigaExtra), ...groups.filter(group => group.tipo === 'extra' && group.servizi?.length).map(group => ({
      idCliente: group.clienteId, ragioneSociale: group.clienteNome, gruppoExtraId: group.id,
      gruppoExtraTipo: group.tipo, tuttiBlindati: group.tuttiBlindati, fatturaInviataAt: group.inviataAt,
      fatture: group.fatturaRegistrazioneId ? [{ id: group.fatturaRegistrazioneId }] : [],
      imponibile: group.imponibileExtra, importoTotale: group.totaleExtraPrevisto,
      descrizioneFattura: group.descrizioneFattura, tipoTassazione: group.tipoTassazione
    }))];
    const candidateByKey = new Map(candidates.map(row => [keyOf(row), row]));
    const clientIds = [...new Set(candidates.filter(row => keys.includes(keyOf(row))).map(row => row.idCliente))];
    const clients = new Map((clientIds.length ? await db('clienti').whereIn('id', clientIds) : [])
      .map(client => [String(client.id), client]));
    const companyIssues = readinessCompany(company || {});
    const numberFor = index => `${match[1]}${String(Number(match[2]) + index).padStart(match[2].length, '0')}${match[3] || ''}`;
    const numbers = keys.map((_, i) => numberFor(i));
    const [registered, accounting] = await Promise.all([
      db('fatture_aruba_elaborati').whereIn('numero_fattura', numbers).select('numero_fattura'),
      db('fatture').whereIn('numero_fattura', numbers).select('numero_fattura')
    ]);
    const occupied = new Set([...registered, ...accounting].map(item => item.numero_fattura));
    const errors = [];
    const invoices = [];
    keys.forEach((key, index) => {
      const row = candidateByKey.get(key), client = row && clients.get(String(row.idCliente));
      const issues = [];
      if (!row || !isEligible(row)) issues.push('Fattura non disponibile, già elaborata o servizio extra non blindato');
      if (!client) issues.push('Scheda cliente assente');
      if (companyIssues.length) issues.push(`Dati M2I: ${companyIssues.join(', ')}`);
      if (client) {
        const clientIssues = readinessClient(client);
        const cfOnly = !value(client.fatturazione_id_paese_iva) &&
          value(client.codice_fiscale) && value(client.partita_iva) === value(client.codice_fiscale);
        issues.push(...clientIssues.filter(issue => issue !== 'Paese partita IVA' || !cfOnly));
        if (!/^[A-Z]{2}$/.test(value(client.fatturazione_paese).toUpperCase())) issues.push('Paese cliente non valido');
        if (value(client.fatturazione_paese).toUpperCase() === 'IT' && !/^\d{5}$/.test(value(client.cap))) issues.push('CAP cliente non valido');
        if (value(client.codice_sdi) && !/^[A-Z0-9]{7}$/i.test(value(client.codice_sdi))) issues.push('Codice destinatario non valido');
        if (['TRAT. ACC.', 'TRATTENUTA ACCONTO'].includes(value(client.tipo_tassazione).toUpperCase()) &&
            (!value(client.fatturazione_causale_pagamento) ||
              !(Number(client.fatturazione_aliquota_ritenuta) > 0))) {
          issues.push('Causale o aliquota ritenuta assente');
        }
        if (value(client.tipo_tassazione).toUpperCase() === 'REVERSE CHARGE' &&
            !/^N6(?:\.[1-9])?$/.test(value(client.fatturazione_natura))) issues.push('Natura reverse charge non valida');
      }
      if (occupied.has(numberFor(index))) issues.push(`Numero ${numberFor(index)} già registrato`);
      if (row && !(cents(row.imponibile) > 0)) issues.push('Imponibile nullo o negativo');
      if (row && !value(row.descrizioneFattura)) issues.push('Descrizione fattura assente');
      if (row && value(row.descrizioneFattura).length > 1000) issues.push('Descrizione fattura oltre 1000 caratteri');
      if (row && client && value(row.tipoTassazione).toUpperCase() !== value(client.tipo_tassazione || 'IVA').toUpperCase()) {
        issues.push('Trattamento fiscale dell’elaborato diverso dalla scheda cliente');
      }
      const monthly = row && !row.gruppoExtraId ? groups.filter(group => group.tipo === 'mensile' &&
        String(group.clienteId) === String(row.idCliente) && group.servizi?.length && !group.fatturaRegistrazioneId) : [];
      if (monthly.some(group => !group.tuttiBlindati || group.inviataAt)) issues.push('Servizi extra mensili non pronti');
      if (monthly.some(group => !value(group.descrizioneFattura) || value(group.descrizioneFattura).length > 1000)) {
        issues.push('Descrizione dei servizi extra mensili assente o troppo lunga');
      }
      if (!issues.length) {
        const lines = [{ description: row.descrizioneFattura, amount: row.imponibile },
          ...monthly.map(group => ({ description: group.descrizioneFattura, amount: group.imponibileExtra,
            expectedTotal: group.totaleExtraPrevisto, extraMonthly: true }))];
        try {
          const progressivo = crypto.randomBytes(5).toString('hex').toUpperCase();
          invoices.push({ key, client: row.ragioneSociale, number: numberFor(index),
            filename: `IT01879020517_${progressivo}.xml`,
            xml: buildInvoice({ company, client, row, lines, date, number: numberFor(index), progressivo }) });
        } catch (error) { issues.push(error.message); }
      }
      if (issues.length) errors.push({ key, client: row?.ragioneSociale || key, issues });
    });
    return { invoices, errors, date, mese, anno, issuerAddress: value(company?.fatturazione_indirizzo) };
  }
  async function download(input) {
    const result = await prepare(input);
    if (result.errors.length) return { errors: result.errors };
    const zip = new JSZip();
    for (const invoice of result.invoices) zip.file(invoice.filename, invoice.xml);
    return { buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
      filename: `Fatture_Aruba_${result.anno}_${String(result.mese).padStart(2, '0')}.zip` };
  }
  return { prepare, download };
}

module.exports = { createArubaExport, buildInvoice, keyOf, isEligible };
