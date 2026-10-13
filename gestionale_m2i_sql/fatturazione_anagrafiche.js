const JSZip = require('jszip');
const xml2js = require('xml2js');

const CLIENT_FIELDS = {
  ragione_sociale: 'Ragione sociale', partita_iva: 'Partita IVA', codice_fiscale: 'Codice fiscale',
  tipo_tassazione: 'Trattamento fiscale', percentuale_tassazione: 'Aliquota IVA',
  indirizzo_sede: 'Indirizzo', civico_sede: 'Numero civico', cap: 'CAP', citta: 'Comune', provincia: 'Provincia',
  fatturazione_paese: 'Paese', fatturazione_id_paese_iva: 'Paese partita IVA',
  codice_sdi: 'Codice destinatario', pec: 'PEC destinatario',
  fatturazione_natura: 'Natura IVA', fatturazione_riferimento_normativo: 'Riferimento normativo',
  fatturazione_esigibilita_iva: 'Esigibilità IVA', fatturazione_tipo_ritenuta: 'Tipo ritenuta',
  fatturazione_aliquota_ritenuta: 'Aliquota ritenuta', fatturazione_causale_pagamento: 'Causale pagamento',
  fatturazione_modalita_pagamento: 'Modalità pagamento',
  fatturazione_condizioni_pagamento: 'Condizioni pagamento'
};
const ISSUER_FIELDS = {
  ragione_sociale: 'Ragione sociale', partita_iva: 'Partita IVA', codice_fiscale: 'Codice fiscale',
  fatturazione_indirizzo: 'Indirizzo fiscale', fatturazione_cap: 'CAP', fatturazione_citta: 'Comune',
  fatturazione_provincia: 'Provincia', fatturazione_paese: 'Paese',
  fatturazione_id_paese_iva: 'Paese partita IVA', fatturazione_regime: 'Regime fiscale',
  fatturazione_iban: 'IBAN incasso', pec: 'PEC', fatturazione_ufficio_rea: 'Ufficio REA',
  fatturazione_numero_rea: 'Numero REA', capitale_sociale: 'Capitale sociale',
  fatturazione_socio_unico: 'Socio unico', fatturazione_stato_liquidazione: 'Stato liquidazione'
};

const val = value => String(value ?? '').trim();
const first = value => Array.isArray(value) ? value[0] : value;
const node = (obj, key) => first(obj?.[key]) || {};
const text = (obj, key) => val(first(obj?.[key]));
const fiscal = value => val(value).toUpperCase().replace(/\s/g, '');
const validId = value => fiscal(value) && !/^(?:0+|BOZZA_.*)$/.test(fiscal(value));
const nameKey = value => val(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
const equal = (a, b, key) => key.includes('indirizzo') || key === 'ragione_sociale'
  ? nameKey(a) === nameKey(b) : key === 'percentuale_tassazione'
    ? Number(a) === Number(b) : fiscal(a) === fiscal(b);
const displayName = dati => text(dati?.Anagrafica, 'Denominazione') ||
  [text(dati?.Anagrafica, 'Nome'), text(dati?.Anagrafica, 'Cognome')].filter(Boolean).join(' ');

function extractParty(party, issuer = false) {
  const dati = node(party, 'DatiAnagrafici');
  const iva = node(dati, 'IdFiscaleIVA');
  const sede = node(party, 'Sede');
  const result = {
    ragione_sociale: displayName(dati), partita_iva: text(iva, 'IdCodice'),
    codice_fiscale: text(dati, 'CodiceFiscale'),
    fatturazione_id_paese_iva: text(iva, 'IdPaese'),
    cap: text(sede, 'CAP'), citta: text(sede, 'Comune'), provincia: text(sede, 'Provincia')
  };
  if (issuer) {
    Object.assign(result, {
      fatturazione_indirizzo: [text(sede, 'Indirizzo'), text(sede, 'NumeroCivico')].filter(Boolean).join(' '),
      fatturazione_cap: result.cap, fatturazione_citta: result.citta,
      fatturazione_provincia: result.provincia, fatturazione_paese: text(sede, 'Nazione'),
      fatturazione_regime: text(dati, 'RegimeFiscale'), pec: text(node(party, 'Contatti'), 'PEC')
    });
    delete result.cap; delete result.citta; delete result.provincia;
    const rea = node(party, 'IscrizioneREA');
    Object.assign(result, {
      fatturazione_ufficio_rea: text(rea, 'Ufficio'), fatturazione_numero_rea: text(rea, 'NumeroREA'),
      capitale_sociale: text(rea, 'CapitaleSociale'), fatturazione_socio_unico: text(rea, 'SocioUnico'),
      fatturazione_stato_liquidazione: text(rea, 'StatoLiquidazione')
    });
  } else {
    Object.assign(result, {
      indirizzo_sede: text(sede, 'Indirizzo'),
      civico_sede: text(sede, 'NumeroCivico'),
      fatturazione_paese: text(sede, 'Nazione')
    });
  }
  return result;
}

async function parseXml(buffer, filename) {
  const raw = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new Error(`${filename}: DTD ed entità XML non consentite.`);
  const data = await xml2js.parseStringPromise(raw, { explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] });
  const root = data.FatturaElettronica;
  if (!root) throw new Error(`${filename}: non è una FatturaElettronica.`);
  const header = node(root, 'FatturaElettronicaHeader');
  const issuer = extractParty(node(header, 'CedentePrestatore'), true);
  const recipient = extractParty(node(header, 'CessionarioCommittente'));
  const transmission = node(header, 'DatiTrasmissione');
  recipient.codice_sdi = text(transmission, 'CodiceDestinatario');
  recipient.pec = text(transmission, 'PECDestinatario');
  if (!validId(recipient.partita_iva) && !validId(recipient.codice_fiscale)) {
    throw new Error(`${filename}: identificativo fiscale destinatario assente.`);
  }
  if (!validId(issuer.partita_iva)) throw new Error(`${filename}: partita IVA emittente assente.`);
  const bodies = [].concat(root.FatturaElettronicaBody || []);
  if (!bodies.length) throw new Error(`${filename}: corpo fattura assente.`);
  const invoices = bodies.map(body => {
    const general = node(node(body, 'DatiGenerali'), 'DatiGeneraliDocumento');
    const rows = [].concat(node(body, 'DatiBeniServizi').DatiRiepilogo || []);
    const withholding = node(general, 'DatiRitenuta');
    const payment = node(body, 'DatiPagamento');
    const detail = node(payment, 'DettaglioPagamento');
    const kinds = [...new Set(rows.map(row => text(row, 'Natura')).filter(Boolean))];
    const refs = [...new Set(rows.map(row => text(row, 'RiferimentoNormativo')).filter(Boolean))];
    const rates = [...new Set(rows.map(row => text(row, 'AliquotaIVA')).filter(Boolean))];
    const taxType = kinds.some(kind => kind.startsWith('N6')) ? 'REVERSE CHARGE'
      : text(withholding, 'TipoRitenuta') ? 'TRAT. ACC.' : 'IVA';
    return {
      filename, numero: text(general, 'Numero'), data: text(general, 'Data'),
      issuer: { ...issuer, fatturazione_iban: text(detail, 'IBAN') },
      recipient: { ...recipient, tipo_tassazione: taxType,
        percentuale_tassazione: rates.length === 1 ? String(Number(rates[0])) : '',
        fatturazione_natura: kinds.join(', '),
        fatturazione_riferimento_normativo: refs.join('; '),
        fatturazione_esigibilita_iva: text(first(rows), 'EsigibilitaIVA'),
        fatturazione_tipo_ritenuta: text(withholding, 'TipoRitenuta'),
        fatturazione_aliquota_ritenuta: text(withholding, 'AliquotaRitenuta'),
        fatturazione_causale_pagamento: text(withholding, 'CausalePagamento'),
        fatturazione_modalita_pagamento: text(detail, 'ModalitaPagamento'),
        fatturazione_condizioni_pagamento: text(payment, 'CondizioniPagamento') }
    };
  });
  return invoices;
}

async function readFiles(files) {
  if (!files?.length) throw new Error('Seleziona almeno un XML o un archivio ZIP.');
  const entries = [];
  let total = 0;
  for (const file of files) {
    const name = val(file.originalname);
    const ext = name.toLowerCase().split('.').pop();
    const buffer = file.buffer;
    if (!['xml', 'zip'].includes(ext)) throw new Error(`Formato non supportato: ${name}`);
    if (ext === 'xml') {
      total += buffer.length;
      if (buffer.length > 5 * 1024 * 1024 || total > 30 * 1024 * 1024) throw new Error('Limite XML superato (5 MB per file, 30 MB totali).');
      entries.push({ name, buffer });
    }
    else {
      const zip = await JSZip.loadAsync(buffer);
      if (Object.keys(zip.files).length > 300) throw new Error('L’archivio contiene troppi file.');
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !entry.name.toLowerCase().endsWith('.xml')) continue;
        if ((entry._data?.uncompressedSize || 0) > 5 * 1024 * 1024) throw new Error(`${entry.name}: XML troppo grande.`);
        if (entries.length >= 300) throw new Error('Massimo 300 XML per importazione.');
        const content = await entry.async('nodebuffer');
        total += content.length;
        if (content.length > 5 * 1024 * 1024 || total > 30 * 1024 * 1024) throw new Error('Limite XML superato (5 MB per file, 30 MB totali).');
        entries.push({ name: entry.name, buffer: content });
      }
    }
  }
  if (!entries.length || entries.length > 300) throw new Error('Servono da 1 a 300 file XML.');
  const result = [];
  for (const entry of entries) {
    result.push(...await parseXml(entry.buffer, entry.name));
  }
  return result;
}

function collect(rows, kind) {
  const fields = kind === 'issuer' ? ISSUER_FIELDS : CLIENT_FIELDS;
  const values = {};
  const internal = [];
  for (const key of Object.keys(fields)) {
    const found = [...new Set(rows.map(row => val(row[kind][key])).filter(Boolean))];
    if (found.length === 1) values[key] = found[0];
    if (found.length > 1) internal.push({ field: key, label: fields[key], values: found });
  }
  return { values, internal };
}

function compare(current, extracted, fields) {
  return Object.entries(extracted).map(([field, value]) => {
    const stored = val(current?.[field]);
    const civic = field === 'indirizzo_sede' ? val(current?.civico_sede) : '';
    const combined = civic && !nameKey(stored).endsWith(nameKey(civic)) ? `${stored} ${civic}`.trim() : stored;
    const same = equal(stored, value, field) || (field === 'indirizzo_sede' && equal(combined, value, field));
    return { field, label: fields[field], attuale: same ? stored : combined, xml: value,
      stato: !stored ? 'nuovo' : same ? 'uguale' : 'diverso' };
  });
}

function matchClient(profile, clients) {
  const vat = fiscal(profile.partita_iva), cf = fiscal(profile.codice_fiscale);
  const exact = clients.filter(c =>
    (validId(vat) && fiscal(c.partita_iva) === vat) ||
    (validId(cf) && fiscal(c.codice_fiscale) === cf));
  if (exact.length === 1) return { id: exact[0].id, reason: 'identificativo fiscale' };
  if (exact.length > 1) return { id: null, reason: 'identificativo ambiguo', candidates: exact.map(c => ({ id: c.id, name: c.ragione_sociale })) };
  const names = clients.filter(c => nameKey(c.ragione_sociale) === nameKey(profile.ragione_sociale));
  return { id: null, reason: 'non riconosciuto', candidates: names.map(c => ({ id: c.id, name: c.ragione_sociale })) };
}

async function preview(db, invoices, mappings = {}) {
  const [clients, company] = await Promise.all([
    db('clienti').where(q => q.where('cestinato', 0).orWhereNull('cestinato')),
    db('m2i_azienda_dati').where({ id: 1 }).first()
  ]);
  const issuer = collect(invoices, 'issuer');
  const groups = new Map();
  for (const row of invoices) {
    const key = validId(row.recipient.partita_iva) ? fiscal(row.recipient.partita_iva) : fiscal(row.recipient.codice_fiscale);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const customers = [...groups].map(([key, rows]) => {
    const extracted = collect(rows, 'recipient');
    const match = matchClient(extracted.values, clients);
    const requested = mappings[key];
    const selected = requested ? clients.find(c => c.id === requested) : clients.find(c => c.id === match.id);
    if (requested && !selected) throw new Error(`Cliente scelto per ${key} non disponibile.`);
    return {
      key, name: extracted.values.ragione_sociale || key, invoices: rows.length,
      files: [...new Set(rows.map(row => row.filename))], match,
      clientId: selected?.id || null, clientName: selected?.ragione_sociale || '',
      internal: extracted.internal, fields: compare(selected, extracted.values, CLIENT_FIELDS)
    };
  });
  return {
    count: invoices.length, issuer: {
      internal: issuer.internal, fields: compare(company, issuer.values, ISSUER_FIELDS),
      identityMismatch: Boolean(company?.partita_iva && issuer.values.partita_iva &&
        fiscal(company.partita_iva) !== fiscal(issuer.values.partita_iva))
    }, customers
  };
}

function readinessCompany(row) {
  const issues = [];
  for (const [key, label] of Object.entries({ ragione_sociale: 'Ragione sociale', partita_iva: 'Partita IVA', codice_fiscale: 'Codice fiscale', fatturazione_indirizzo: 'Indirizzo fiscale', fatturazione_cap: 'CAP', fatturazione_citta: 'Comune', fatturazione_paese: 'Paese', fatturazione_regime: 'Regime fiscale' })) {
    if (!val(row?.[key])) issues.push(label);
  }
  if (val(row?.partita_iva) && !validId(row.partita_iva)) issues.push('Partita IVA valida');
  if (validId(row?.partita_iva) && !val(row?.fatturazione_id_paese_iva)) issues.push('Paese partita IVA');
  return issues;
}

function readinessClient(row) {
  const issues = [];
  if (!validId(row.partita_iva) && !validId(row.codice_fiscale)) issues.push('Partita IVA o codice fiscale');
  if (validId(row.partita_iva) && !val(row.fatturazione_id_paese_iva)) issues.push('Paese partita IVA');
  for (const [key, label] of Object.entries({ ragione_sociale: 'Ragione sociale', indirizzo_sede: 'Indirizzo', cap: 'CAP', citta: 'Comune', fatturazione_paese: 'Paese' })) {
    if (!val(row[key])) issues.push(label);
  }
  if (!/^([A-Z0-9]{7})$/i.test(val(row.codice_sdi)) && !val(row.pec).includes('@')) issues.push('Codice SdI (7 caratteri) o PEC');
  if (row.tipo_tassazione === 'REVERSE CHARGE' && !val(row.fatturazione_natura)) issues.push('Natura reverse charge');
  if (['TRAT. ACC.', 'TRATTENUTA ACCONTO'].includes(row.tipo_tassazione) && !val(row.fatturazione_tipo_ritenuta)) issues.push('Dati ritenuta');
  return issues;
}

async function status(db) {
  const [company, clients] = await Promise.all([
    db('m2i_azienda_dati').where({ id: 1 }).first(),
    db('clienti').where(q => q.where('attivo', 'SI').orWhereNull('attivo')).where(q => q.where('cestinato', 0).orWhereNull('cestinato')).orderBy('ragione_sociale')
  ]);
  return { issuerIssues: readinessCompany(company), clients: clients.map(c => ({
    id: c.id, name: c.ragione_sociale, issues: readinessClient(c)
  })) };
}

async function apply(db, invoices, options = {}) {
  const plan = await preview(db, invoices, options.mappings || {});
  if (plan.issuer.identityMismatch) throw new Error('La partita IVA emittente non coincide con M2I: importazione bloccata.');
  if (plan.issuer.internal.some(x => ['partita_iva', 'codice_fiscale'].includes(x.field))) {
    throw new Error('Gli XML contengono emittenti con identificativi fiscali discordanti.');
  }
  const accepted = options.accepted || {};
  const results = { companyFields: 0, clientsUpdated: 0, fieldsUpdated: 0, unresolved: [] };
  await db.transaction(async trx => {
    if (plan.issuer.internal.length) results.unresolved.push({ key: 'issuer', name: 'M2I', reason: 'XML emittente discordanti fra loro' });
    const issuerUpdates = {};
    for (const field of plan.issuer.fields) {
      if (field.stato === 'nuovo' || (field.stato === 'diverso' && accepted.issuer?.includes(field.field))) issuerUpdates[field.field] = field.xml;
    }
    if (Object.keys(issuerUpdates).length) {
      await trx('m2i_azienda_dati').where({ id: 1 }).update(issuerUpdates);
      results.companyFields = Object.keys(issuerUpdates).length;
    }
    const issuerDifferences = plan.issuer.fields.filter(f => f.stato === 'diverso' && !accepted.issuer?.includes(f.field));
    if (issuerDifferences.length) results.unresolved.push({ key: 'issuer', name: 'M2I', reason: `${issuerDifferences.length} differenze da verificare` });
    for (const customer of plan.customers) {
      if (!customer.clientId) {
        results.unresolved.push({ key: customer.key, name: customer.name, reason: 'Scheda cliente non individuata' });
        continue;
      }
      if (customer.internal.length) results.unresolved.push({ key: customer.key, name: customer.name, reason: 'XML discordanti fra loro' });
      if (customer.internal.some(x => ['partita_iva', 'codice_fiscale'].includes(x.field))) continue;
      const fiscalConflicts = customer.fields.filter(f =>
        ['partita_iva', 'codice_fiscale'].includes(f.field) && f.stato === 'diverso' &&
        !accepted[customer.key]?.includes(f.field));
      if (fiscalConflicts.length) {
        results.unresolved.push({ key: customer.key, name: customer.name, reason: 'Identificativi fiscali discordanti' });
        continue;
      }
      const updates = {};
      for (const field of customer.fields) {
        if (field.stato === 'nuovo' || (field.stato === 'diverso' && accepted[customer.key]?.includes(field.field))) updates[field.field] = field.xml;
      }
      // L'indirizzo XML sostituisce quello della scheda. Se il civico non è un campo
      // separato nell'XML, evita di conservare un vecchio civico già incluso nell'indirizzo.
      if (Object.hasOwn(updates, 'indirizzo_sede') && !customer.fields.some(field => field.field === 'civico_sede')) {
        updates.civico_sede = '';
      }
      if (Object.keys(updates).length) {
        await trx('clienti').where({ id: customer.clientId }).update(updates);
        results.clientsUpdated++;
        results.fieldsUpdated += Object.keys(updates).length;
      }
      const remaining = customer.fields.filter(f => f.stato === 'diverso' && !accepted[customer.key]?.includes(f.field));
      if (remaining.length) results.unresolved.push({ key: customer.key, name: customer.name, reason: `${remaining.length} differenze da verificare` });
    }
    if (results.companyFields || results.fieldsUpdated) await trx('log_attivita').insert({
      categoria: 'Fatturazione', icona: '📄', colore: '#6366f1',
      descrizione: `Estratti dati fiscali da ${invoices.length} documenti XML: ${results.clientsUpdated} anagrafiche clienti aggiornate`,
      eseguito_da: 'LocalServer'
    });
  });
  return results;
}

async function ensureColumns(db) {
  for (const [table, fields] of [['clienti', CLIENT_FIELDS], ['m2i_azienda_dati', ISSUER_FIELDS]]) {
    for (const key of Object.keys(fields)) {
      if (!await db.schema.hasColumn(table, key)) await db.schema.alterTable(table, t => t.text(key));
    }
  }
  const company = await db('m2i_azienda_dati').where({ id: 1 }).first();
  if (company && !val(company.fatturazione_indirizzo)) {
    const match = val(company.sede_legale).match(/^(.*?),\s*(\d{5})\s+(.+?)(?:\s*\(([A-Z]{2})\))?$/i);
    if (match) await db('m2i_azienda_dati').where({ id: 1 }).update({
      fatturazione_indirizzo: match[1].trim(), fatturazione_cap: match[2],
      fatturazione_citta: match[3].trim(), fatturazione_provincia: match[4] || '', fatturazione_paese: 'IT'
    });
  }
}

module.exports = { CLIENT_FIELDS, ISSUER_FIELDS, parseXml, readFiles, preview, apply, status, ensureColumns, readinessClient, readinessCompany };
