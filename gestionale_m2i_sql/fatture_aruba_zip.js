const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');
const xml2js = require('xml2js');
const { reconcileRegistration } = require('./fatture_reconciliation');
const { transferSentReceipts } = require('./incassi_insoluti');

const MAX_ENTRIES = 300;
const MAX_UNCOMPRESSED = 100 * 1024 * 1024;
const cents = value => Math.round(Number(value) * 100);
const fiscal = value => String(value || '').trim().toUpperCase().replace(/^IT(?=\d{11}$)/, '').replace(/\s/g, '');
const nameKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '');
const italianMonths = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const one = value => Array.isArray(value) ? value[0] : value;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

async function entries(buffer, kind) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer.subarray(0, 2).toString() !== 'PK') {
    throw new Error(`Archivio ${kind} non valido.`);
  }
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
  const files = Object.values(zip.files).filter(entry => !entry.dir);
  if (files.length > MAX_ENTRIES || files.reduce((sum, entry) => sum + Number(entry._data?.uncompressedSize || 0), 0) > MAX_UNCOMPRESSED) {
    throw new Error(`Archivio ${kind} troppo grande.`);
  }
  const extension = kind === 'XML' ? '.xml' : '.pdf';
  const result = new Map();
  let extractedBytes = 0;
  for (const entry of files) {
    const name = path.posix.basename(entry.name);
    if (!name.toLowerCase().endsWith(extension)) continue;
    const match = kind === 'XML' ? /^(.+)\.xml$/i.exec(name)
      : /^(.+?)\.xml(?:\.p7m)?(?:\s+-.*)?\.pdf$/i.exec(name);
    const id = match?.[1] || (kind === 'PDF' ? name.slice(0, -4) : null);
    if (!id || result.has(id)) throw new Error(`Nomi ${kind} duplicati o non riconosciuti.`);
    const content = await entry.async('nodebuffer');
    extractedBytes += content.length;
    if (extractedBytes > MAX_UNCOMPRESSED) throw new Error(`Archivio ${kind} troppo grande.`);
    if (content.length > 10 * 1024 * 1024) throw new Error(`Un file ${kind} supera 10 MB.`);
    if (kind === 'PDF' && !content.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`PDF non valido: ${name}.`);
    result.set(id, { id, name, content });
  }
  if (!result.size) throw new Error(`Nessun file ${kind} nell’archivio.`);
  return result;
}

async function parseInvoice(content) {
  const parsed = await xml2js.parseStringPromise(content.toString('utf8'), { explicitArray: false, ignoreAttrs: true });
  const root = parsed[Object.keys(parsed).find(key => key.includes('FatturaElettronica'))];
  const body = one(root?.FatturaElettronicaBody);
  const document = one(body?.DatiGenerali?.DatiGeneraliDocumento);
  const customer = root?.FatturaElettronicaHeader?.CessionarioCommittente?.DatiAnagrafici;
  const number = String(document?.Numero || '').trim();
  const tipoDocumento = String(document?.TipoDocumento || '').trim().toUpperCase();
  const date = String(document?.Data || '').trim();
  const vat = fiscal(customer?.IdFiscaleIVA?.IdCodice);
  const taxCode = fiscal(customer?.CodiceFiscale);
  const summaries = [body?.DatiBeniServizi?.DatiRiepilogo].flat().filter(Boolean);
  const taxable = summaries.reduce((sum, item) => sum + Number(item.ImponibileImporto || 0), 0);
  const tax = summaries.reduce((sum, item) => sum + Number(item.Imposta || 0), 0);
  const total = document?.ImportoTotaleDocumento == null ? taxable + tax : Number(document.ImportoTotaleDocumento);
  const descriptions = [...[document?.Causale].flat(), ...[body?.DatiBeniServizi?.DettaglioLinee].flat()
    .filter(Boolean).map(line => line.Descrizione)].filter(Boolean).join(' ');
  const referencePeriods = new Set([...descriptions.toLowerCase().matchAll(
    /\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})\b/g
  )].map(match => `${match[2]}-${String(italianMonths.indexOf(match[1]) + 1).padStart(2, '0')}`));
  if (!number || number.length > 80 || !validDate(date) || !vat && !taxCode || !summaries.length ||
      !Number.isFinite(total) || total < 0 || total > 1_000_000_000 ||
      !Number.isSafeInteger(cents(total)) || Math.abs(total * 100 - cents(total)) > 0.000001 ||
      !Number.isFinite(taxable) || !Number.isFinite(tax)) throw new Error('Dati XML non validi.');
  return { numero: number, tipoDocumento, dataFattura: date, importoTotale: cents(total) / 100,
    imponibile: cents(taxable) / 100, iva: cents(tax) / 100,
    vat, taxCode, periodoDescrizione: referencePeriods.size === 1 ? [...referencePeriods][0] : null,
    periodoAmbiguo: referencePeriods.size > 1,
    clienteXml: customer?.Anagrafica?.Denominazione ||
      [customer?.Anagrafica?.Nome, customer?.Anagrafica?.Cognome].filter(Boolean).join(' ') };
}

async function readPair(xmlZip, pdfZip) {
  const first = await Promise.allSettled([entries(xmlZip, 'XML'), entries(pdfZip, 'PDF')]);
  let xmls, pdfs, swapped = false;
  if (first.every(result => result.status === 'fulfilled')) {
    [xmls, pdfs] = first.map(result => result.value);
  } else if (first[0].status === 'rejected' && first[1].status === 'rejected' &&
    first[0].reason?.message === 'Nessun file XML nell’archivio.' &&
    first[1].reason?.message === 'Nessun file PDF nell’archivio.') {
    [xmls, pdfs] = await Promise.all([entries(pdfZip, 'XML'), entries(xmlZip, 'PDF')]);
    swapped = true;
  } else {
    throw first.find(result => result.status === 'rejected').reason;
  }
  const invoices = [];
  for (const [id, xml] of xmls) {
    try { invoices.push({ id, xml, pdf: pdfs.get(id) || null, ...await parseInvoice(xml.content) }); }
    catch (error) { invoices.push({ id, xml, pdf: pdfs.get(id) || null, parseError: error.message }); }
  }
  const orphanPdfs = [...pdfs.values()].filter(pdf => !xmls.has(pdf.id));
  return { invoices, pdfs, orphanPdfs, pdfWithoutXml: orphanPdfs.length, swapped };
}

function classify(invoices, clients, monthlyRows, registrations, officialInvoices = [], selectedPeriod = null, separateDocuments = []) {
  const eligible = new Map(monthlyRows.map(row => [String(row.idCliente), row]));
  const fiscalCandidates = invoice => clients.filter(client =>
    invoice.vat && fiscal(client.partita_iva) === invoice.vat ||
    invoice.taxCode && fiscal(client.codice_fiscale) === invoice.taxCode);
  const fiscalConflict = (invoice, client) =>
    Boolean(invoice.vat && fiscal(client.partita_iva) && fiscal(client.partita_iva) !== invoice.vat ||
      invoice.taxCode && fiscal(client.codice_fiscale) && fiscal(client.codice_fiscale) !== invoice.taxCode);
  const prepared = invoices.map(invoice => {
    const candidates = invoice.parseError ? [] : fiscalCandidates(invoice);
    const matches = candidates.filter(candidate => !fiscalConflict(invoice, candidate));
    const conflictingIdentifiers = candidates.length > 0 && !matches.length;
    const client = matches.length === 1 ? matches[0] : null;
    const matchedBy = client ? [invoice.vat && fiscal(client.partita_iva) === invoice.vat && 'Partita IVA',
      invoice.taxCode && fiscal(client.codice_fiscale) === invoice.taxCode && 'Codice fiscale'].filter(Boolean).join(' e ') : null;
    const existing = client && registrations.find(record => record.cliente_id === client.id &&
      record.numero_fattura.trim() === invoice.numero && record.data_fattura === invoice.dataFattura);
    const separate = client && separateDocuments.find(record => record.cliente_id === client.id &&
      record.numero_fattura.trim() === invoice.numero && record.data_fattura === invoice.dataFattura);
    const officialCandidates = client ? officialInvoices.filter(record => record.cliente_id === client.id &&
      record.numero_fattura.trim() === invoice.numero &&
      record.data_fattura?.slice(0, 4) === invoice.dataFattura?.slice(0, 4)) : [];
    const official = officialCandidates.find(record => record.data_fattura === invoice.dataFattura);
    let stato = 'pronta', motivo = '';
    if (invoice.parseError) { stato = 'errore'; motivo = invoice.parseError; }
    else if (!invoice.pdf) { stato = 'senza_pdf'; motivo = 'PDF corrispondente assente.'; }
    else if (matches.length !== 1) { stato = 'cliente'; motivo = conflictingIdentifiers
      ? 'Partita IVA e codice fiscale non coincidono con la stessa anagrafica.'
      : matches.length ? 'Più clienti corrispondono ai dati XML.' : 'Cliente non trovato in anagrafica.'; }
    else if (!eligible.has(String(client.id))) { stato = 'mese'; motivo = 'Cliente non presente tra le righe blindate o chiuse del mese scelto.'; }
    else if (separate) { stato = 'presente'; motivo = 'Documento già allegato separatamente.'; }
    else if (existing && cents(existing.importo_totale) !== cents(invoice.tipoDocumento === 'TD04' ? -invoice.importoTotale : invoice.importoTotale)) {
      stato = 'conflitto'; motivo = 'Importo diverso dalla fattura già registrata.';
    } else if (officialCandidates.length && (!official || officialCandidates.length > 1 ||
      cents(official.importo_totale) !== cents(invoice.tipoDocumento === 'TD04' ? -invoice.importoTotale : invoice.importoTotale))) {
      stato = 'conflitto'; motivo = 'La fattura contabile esistente non coincide.';
    } else if (existing?.allegato_path && official?.allegato_fattura && existing.fattura_id === official.id) {
      stato = 'presente'; motivo = 'Dati contabili e PDF già registrati.';
    } else if (existing?.allegato_path) {
      stato = 'contabile'; motivo = 'PDF già allegato: saranno completati i dati XML e la riconciliazione.';
    }
    else if (existing) { stato = 'allega'; motivo = 'Fattura già registrata: sarà aggiunto il PDF.'; }
    else if (registrations.some(record => record.cliente_id === client.id && record.numero_fattura.trim() === invoice.numero)) {
      stato = 'conflitto'; motivo = 'Numero già registrato con un’altra data.';
    }
    const monthly = client && eligible.get(String(client.id));
    const expected = Number(monthly?.importoTotale);
    const alreadyRegistered = client ? registrations.filter(record => record.cliente_id === client.id)
      .reduce((sum, record) => sum + cents(record.importo_totale), 0) : 0;
    const remaining = Number.isFinite(expected) && monthly?.importoTotale != null
      ? (cents(expected) - alreadyRegistered) / 100 : null;
    const issues = [];
    const addIssue = (code, message) => issues.push({ code, message });
    if (invoice.parseError) addIssue('xml', invoice.parseError);
    if (!invoice.pdf) addIssue('pdf', 'PDF non abbinato automaticamente all’XML.');
    if (!invoice.parseError) {
      if (invoice.tipoDocumento === 'TD04') addIssue('nota_credito', 'Nota di credito: scegli come trattarla nel mese.');
      else if (invoice.tipoDocumento !== 'TD01') addIssue('tipo_documento', `Tipo documento ${invoice.tipoDocumento || 'non indicato'} da verificare.`);
      if (matches.length !== 1) addIssue('cliente', conflictingIdentifiers
        ? 'Partita IVA e codice fiscale dell’XML non coincidono con la stessa anagrafica.'
        : matches.length ? 'Più clienti hanno gli stessi dati fiscali.' : 'Cliente non trovato tramite partita IVA o codice fiscale.');
      if (client && !eligible.has(String(client.id))) addIssue('mese', 'Cliente assente dalla Fatturazione del mese scelto.');
      if (invoice.periodoAmbiguo) addIssue('periodo', 'L’XML cita più periodi.');
      else if (selectedPeriod && invoice.periodoDescrizione && invoice.periodoDescrizione !== selectedPeriod) {
        addIssue('periodo', `La descrizione indica ${invoice.periodoDescrizione}, diverso dal mese scelto.`);
      }
      if (stato === 'conflitto') addIssue('registrazione', motivo);
      if (stato === 'pronta' && remaining !== null && cents(remaining) !== cents(invoice.importoTotale)) {
        addIssue('importo', `Importo previsto residuo ${remaining.toFixed(2)} €, diverso dall’XML.`);
      }
      if (invoice.pdf) {
        const label = /\s+-\s+(.+)\.pdf$/i.exec(invoice.pdf.name)?.[1]?.replace(/_/g, '/').trim();
        if (label && nameKey(label) !== nameKey(invoice.numero)) addIssue('pdf_numero', 'Il numero nel nome del PDF differisce dall’XML.');
      }
    }
    return { ...invoice, client, matchedBy, stato, motivo, importoPrevisto: remaining, issues };
  });
  const byClient = new Map();
  for (const item of prepared.filter(item => item.stato === 'pronta')) {
    const key = String(item.client.id);
    byClient.set(key, (byClient.get(key) || 0) + 1);
  }
  for (const item of prepared) {
    if (item.client && prepared.filter(other => other.client?.id === item.client.id && !other.parseError).length > 1 &&
      !item.issues.some(issue => issue.code === 'duplicato_cliente')) {
      item.issues.push({ code: 'duplicato_cliente', message: 'Più fatture per lo stesso cliente nello ZIP.' });
    }
    if (['pronta', 'scelta'].includes(item.stato) && selectedPeriod &&
      (item.periodoAmbiguo || item.periodoDescrizione && item.periodoDescrizione !== selectedPeriod)) {
      item.stato = 'periodo';
      item.motivo = item.periodoAmbiguo ? 'L’XML cita più periodi: verifica il mese di riferimento.'
        : `La descrizione XML indica ${italianMonths[Number(item.periodoDescrizione.slice(5)) - 1]} ${item.periodoDescrizione.slice(0, 4)}: verifica prima di selezionare.`;
    } else if (item.stato === 'pronta' && byClient.get(String(item.client.id)) > 1) {
      item.stato = 'scelta'; item.motivo = 'Più fatture per lo stesso cliente: scegli esplicitamente quali registrare.';
    } else if (item.stato === 'pronta' && item.importoPrevisto !== null &&
      cents(item.importoPrevisto) !== cents(item.importoTotale)) {
      item.stato = 'differenza';
      item.motivo = `Importo previsto residuo ${item.importoPrevisto.toFixed(2)} €: verifica prima di selezionare.`;
    }
  }
  for (const item of prepared) {
    if (item.issues.length && item.stato !== 'presente') {
      item.stato = 'incongruenza';
      item.motivo = item.issues.map(issue => issue.message).join(' ');
    }
  }
  return prepared;
}

function createArubaZipService(knex, workflow) {
  async function analyze({ xmlZip, pdfZip, mese, anno }) {
    const period = workflow.period('cliente', mese, anno);
    const pair = await readPair(xmlZip, pdfZip);
    const [clients, rows, registrations, officialInvoices, separateDocuments] = await Promise.all([
      knex('clienti').select('id', 'ragione_sociale', 'partita_iva', 'codice_fiscale'),
      workflow.lockedRows('cliente', period.mese, period.anno),
      knex('fatture_aruba_elaborati').where({ mese: period.mese, anno: period.anno }),
      knex('fatture').select('id', 'cliente_id', 'numero_fattura', 'data_fattura', 'importo_totale', 'allegato_fattura'),
      knex('documenti_aruba_mese').where({ mese: period.mese, anno: period.anno })
    ]);
    const selectedPeriod = `${period.anno}-${String(period.mese).padStart(2, '0')}`;
    const classified = classify(pair.invoices, clients, rows, registrations, officialInvoices, selectedPeriod, separateDocuments);
    return { period, pair, classified, clients, rows };
  }

  async function preview(args) {
    const { pair, classified, clients, rows } = await analyze(args);
    const monthlyIds = new Set(rows.map(row => String(row.idCliente)));
    return { archiviInvertiti: pair.swapped, pdfSenzaXml: pair.pdfWithoutXml,
      pdfSenzaXmlDettaglio: pair.orphanPdfs.map(pdf => ({ id: pdf.id, nome: pdf.name })),
      pdfDisponibili: [...pair.pdfs.values()].map(pdf => ({ id: pdf.id, nome: pdf.name })),
      clientiDisponibili: clients.map(client => ({ id: client.id, nome: client.ragione_sociale,
        partitaIva: client.partita_iva || '', codiceFiscale: client.codice_fiscale || '',
        nelMese: monthlyIds.has(String(client.id)) })),
      fatture: classified.map(item => ({
      id: item.id, cliente: item.client?.ragione_sociale || item.clienteXml || 'Cliente sconosciuto',
      clienteXml: item.clienteXml || '', clienteId: item.client?.id || null,
      partitaIvaXml: item.vat || '', codiceFiscaleXml: item.taxCode || '',
      abbinamentoFiscale: item.matchedBy, tipoDocumento: item.tipoDocumento || '',
      numero: item.numero || '', data: item.dataFattura || '', importo: item.importoTotale ?? null,
      xml: item.xml?.name || null, pdf: item.pdf?.name || null, pdfId: item.pdf?.id || null,
      stato: item.stato, motivo: item.motivo, incongruenze: item.issues,
      selezionata: !item.issues.length && ['pronta', 'allega', 'contabile'].includes(item.stato)
    })) };
  }

  async function importSelected(args) {
    const selected = args.selected;
    if (!Array.isArray(selected) || !selected.length || selected.length > MAX_ENTRIES ||
      selected.some(row => !row || typeof (typeof row === 'string' ? row : row.id) !== 'string' ||
        (typeof row === 'string' ? row : row.id).length > 160) ||
      new Set(selected.map(row => typeof row === 'string' ? row : row.id)).size !== selected.length) {
      throw new Error('Selezione fatture non valida.');
    }
    const { period, pair, classified, clients, rows } = await analyze(args);
    const byId = new Map(classified.map(item => [item.id, item]));
    const monthlyIds = new Set(rows.map(row => String(row.idCliente)));
    const chosen = selected.map(row => {
      const choice = typeof row === 'string' ? { id: row } : row;
      const item = byId.get(choice.id);
      const client = clients.find(candidate => String(candidate.id) === String(choice.clienteId || item?.client?.id));
      const pdf = pair.pdfs.get(choice.pdfId || item?.pdf?.id);
      return item && { ...item, client, pdf, extra: choice.extra === true,
        creditMode: choice.creditMode || null, reviewed: choice.reviewed === true,
        suggestedClientId: item.client?.id, suggestedPdfId: item.pdf?.id };
    });
    if (chosen.some(item => !item || item.parseError || item.stato === 'presente' || !item.client || !item.pdf)) {
      throw new Error('Una fattura selezionata richiede ancora un cliente o PDF valido. Aggiorna l’anteprima.');
    }
    if (new Set(chosen.map(item => item.pdf.id)).size !== chosen.length) {
      throw new Error('Lo stesso PDF non può essere associato a più fatture.');
    }
    if (chosen.some(item => (item.issues.length || item.client?.id !== item.suggestedClientId ||
      item.pdf?.id !== item.suggestedPdfId) && !item.reviewed)) {
      throw new Error('Esamina e conferma le incongruenze di ogni documento selezionato.');
    }
    if (chosen.some(item => !monthlyIds.has(String(item.client.id)) && !item.extra)) {
      throw new Error('Per il cliente fuori mese scegli esplicitamente “Aggiungi come extra”.');
    }
    if (chosen.some(item => item.tipoDocumento === 'TD04' && !['deduci', 'solo_allegato'].includes(item.creditMode) ||
      !['TD01', 'TD04'].includes(item.tipoDocumento))) {
      throw new Error('Per ogni nota di credito scegli come trattarla nel mese.');
    }
    if (!process.env.DATA_DIR) throw new Error('DATA_DIR richiesto per conservare XML e PDF.');
    const results = [];
    for (const item of chosen) {
      const pdfRelative = path.join('uploads', 'fatture_aruba', `${crypto.randomUUID()}.pdf`);
      const xmlName = `${crypto.randomUUID()}.xml`;
      const pdfPath = path.join(process.env.DATA_DIR, pdfRelative);
      const xmlPath = path.join(process.env.DATA_DIR, 'uploads', 'unknown', xmlName);
      let keepPdf = false, keepXml = false;
      try {
        fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
        fs.mkdirSync(path.dirname(xmlPath), { recursive: true });
        fs.writeFileSync(pdfPath, item.pdf.content, { flag: 'wx' });
        fs.writeFileSync(xmlPath, item.xml.content, { flag: 'wx' });
        const outcome = await knex.transaction(async trx => {
          const key = { cliente_id: item.client.id, mese: period.mese, anno: period.anno };
          const signedTotal = item.tipoDocumento === 'TD04' ? -item.importoTotale : item.importoTotale;
          if (await trx('documenti_aruba_mese').where({ cliente_id: key.cliente_id,
            numero_fattura: item.numero, data_fattura: item.dataFattura }).first()) {
            throw new Error('Documento già allegato separatamente.');
          }
          if (item.tipoDocumento === 'TD04' && item.creditMode === 'solo_allegato') {
            if (await trx('fatture_aruba_elaborati').where({ cliente_id: key.cliente_id,
              numero_fattura: item.numero, data_fattura: item.dataFattura }).first()) {
              throw new Error('Nota di credito già registrata nel fatturato.');
            }
            await trx('documenti_aruba_mese').insert({ ...key, tipo_documento: 'TD04',
              numero_fattura: item.numero, data_fattura: item.dataFattura,
              importo_documento: item.importoTotale, pdf_path: pdfRelative,
              xml_name: xmlName, registrata_at: new Date().toISOString(),
              registrata_da: args.userId || null });
            keepPdf = true; keepXml = true;
            return { stato: 'solo_allegato', registrationId: null };
          }
          const registration = await trx('fatture_aruba_elaborati').where({ ...key,
            numero_fattura: item.numero, data_fattura: item.dataFattura }).first();
          if (registration && cents(registration.importo_totale) !== cents(signedTotal)) {
            throw new Error('Importo diverso dalla fattura già registrata.');
          }
          if (!registration && (await trx('fatture_aruba_elaborati').where({ cliente_id: key.cliente_id,
            numero_fattura: item.numero })).some(row => row.data_fattura?.slice(0, 4) === item.dataFattura.slice(0, 4))) {
            throw new Error('Numero già registrato con un’altra data.');
          }
          let registrationId = registration?.id;
          if (!registration) {
            const [id] = await trx('fatture_aruba_elaborati').insert({ ...key, numero_fattura: item.numero,
              data_fattura: item.dataFattura, importo_totale: signedTotal,
              tipo_documento: item.tipoDocumento,
              allegato_path: pdfRelative, registrata_at: new Date().toISOString(),
              registrata_da: args.userId || null });
            registrationId = id;
            keepPdf = true;
            if (item.tipoDocumento !== 'TD04') await transferSentReceipts(trx, key, { id, importo_totale: signedTotal });
          } else if (!registration.allegato_path) {
            await trx('fatture_aruba_elaborati').where({ id: registrationId }).update({ allegato_path: pdfRelative });
            keepPdf = true;
          }
          const candidates = (await trx('fatture').where({ cliente_id: key.cliente_id,
            numero_fattura: item.numero })).filter(row => row.data_fattura?.slice(0, 4) === item.dataFattura.slice(0, 4));
          const official = candidates.find(row => row.data_fattura === item.dataFattura);
          if (candidates.length && (!official || candidates.length > 1 || cents(official.importo_totale) !== cents(signedTotal))) {
            throw new Error('La fattura contabile esistente non coincide: verifica numero, data e importo.');
          }
          if (!official) {
            await trx('fatture').insert({ id: `FAT_${crypto.randomUUID()}`, cliente_id: key.cliente_id,
              numero_fattura: item.numero, data_fattura: item.dataFattura,
              importo_imponibile: item.tipoDocumento === 'TD04' ? -item.imponibile : item.imponibile,
              importo_iva: item.tipoDocumento === 'TD04' ? -item.iva : item.iva,
              importo_totale: signedTotal, importo_pagato: 0,
              stato_pagamento: item.tipoDocumento === 'TD04' ? 'Nota di credito' : 'Da Pagare',
              tipo_documento: item.tipoDocumento, allegato_fattura: xmlName });
            keepXml = true;
          } else if (!official.allegato_fattura) {
            await trx('fatture').where({ id: official.id }).update({ allegato_fattura: xmlName });
            keepXml = true;
          }
          const reconciliation = await reconcileRegistration(trx, { id: registrationId,
            cliente_id: key.cliente_id, numero_fattura: item.numero,
            data_fattura: item.dataFattura, importo_totale: signedTotal });
          return { stato: reconciliation.stato, registrationId };
        });
        results.push({ id: item.id, numero: item.numero, esito: outcome.stato, registrazioneId: outcome.registrationId });
      } catch (error) {
        keepPdf = false; keepXml = false;
        results.push({ id: item.id, numero: item.numero, errore: error.message });
      } finally {
        if (!keepPdf) fs.rmSync(pdfPath, { force: true });
        if (!keepXml) fs.rmSync(xmlPath, { force: true });
      }
    }
    return { risultati: results, importate: results.filter(result => !result.errore).length,
      daVerificare: results.filter(result => result.esito === 'da_verificare').length,
      errori: results.filter(result => result.errore).length };
  }

  return { preview, importSelected };
}

module.exports = { createArubaZipService, readPair, classify };
