const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { readPair, readSingle } = require('./fatture_aruba_zip');

const fiscal = value => String(value || '').trim().toUpperCase().replace(/^IT(?=\d{11}$)/, '').replace(/\s/g, '');
const invoiceKey = row => `${String(row.numero_fattura || row.numero || '').trim().toUpperCase()}|${String(row.data_fattura || row.dataFattura || '').slice(0, 4)}`;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const cents = value => Math.round(Number(value || 0) * 100);

function matchClient(invoice, clients) {
  const vat = fiscal(invoice.vat), code = fiscal(invoice.taxCode);
  const matches = clients.filter(client => vat && fiscal(client.partita_iva) === vat ||
    code && fiscal(client.codice_fiscale) === code);
  if (matches.length > 1) return { ambiguous: true };
  const client = matches[0] || null;
  if (client && (vat && fiscal(client.partita_iva) && fiscal(client.partita_iva) !== vat ||
    code && fiscal(client.codice_fiscale) && fiscal(client.codice_fiscale) !== code)) return { ambiguous: true };
  return { client };
}

function classify(invoice, clients, existing, issuerVat, repeated) {
  if (invoice.parseError) return { stato: 'errore', motivo: invoice.parseError };
  if (invoice.tipoDocumento === 'TD04') return { stato: 'nota_credito', motivo: 'Nota di credito: non viene caricata come insoluto.' };
  if (invoice.tipoDocumento !== 'TD01') return { stato: 'tipo_non_supportato', motivo: `Documento ${invoice.tipoDocumento || 'non indicato'} da verificare.` };
  if (!invoice.pdf) return { stato: 'senza_pdf', motivo: 'PDF corrispondente non trovato.' };
  if (!invoice.issuerVat || fiscal(invoice.issuerVat) !== issuerVat) return { stato: 'emittente', motivo: 'Emittente diverso dalla partita IVA M2I.' };
  if (repeated.has(invoiceKey(invoice))) return { stato: 'duplicato_zip', motivo: 'Numero fattura ripetuto nello ZIP.' };
  const duplicate = existing.find(row => invoiceKey(row) === invoiceKey(invoice));
  if (duplicate) return { stato: 'presente', motivo: 'Numero già registrato per l’anno della fattura.' };
  const match = matchClient(invoice, clients);
  if (match.ambiguous) return { stato: 'cliente_ambiguo', motivo: 'Partita IVA e codice fiscale corrispondono a più anagrafiche o sono incoerenti.' };
  if (!match.client && (!invoice.clienteXml || ![invoice.vat, invoice.taxCode].some(value =>
    /^(?:\d{11}|[A-Z0-9]{16})$/.test(value || '')))) {
    return { stato: 'cliente_incompleto', motivo: 'Dati fiscali o ragione sociale insufficienti per creare il cliente.' };
  }
  if (invoice.scadenzeMultiple || !invoice.dataScadenza) {
    return { stato: 'scadenza', motivo: invoice.scadenzeMultiple ? 'Più scadenze nell’XML: scegli la scadenza da usare.' : 'Scadenza assente nell’XML: inseriscila prima di importare.',
      clienteId: match.client?.id || null, nuovoCliente: !match.client };
  }
  return { stato: 'pronta', motivo: '', clienteId: match.client?.id || null, nuovoCliente: !match.client };
}

function createHistoricalInvoiceService(knex, options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR;

  async function initialize() {
    if (await knex.schema.hasTable('fatture_storiche_insoluti')) return;
    await knex.schema.createTable('fatture_storiche_insoluti', table => {
      table.text('fattura_id').primary().references('id').inTable('fatture').onDelete('RESTRICT');
      table.text('pdf_path').notNullable();
      table.text('xml_name').notNullable();
      table.text('descrizione');
      table.text('emittente_iva').notNullable();
      table.text('importata_at').notNullable();
      table.text('importata_da');
    });
  }

  async function analyze(args) {
    const pair = args.zip ? await readPair(args.zip) : await readSingle(args.xml, args.pdf);
    const [company, clients, official, aruba] = await Promise.all([
      knex('m2i_azienda_dati').first('partita_iva'),
      knex('clienti').select('id', 'ragione_sociale', 'partita_iva', 'codice_fiscale'),
      knex('fatture').select('numero_fattura', 'data_fattura'),
      knex('fatture_aruba_elaborati').select('numero_fattura', 'data_fattura')
    ]);
    const issuerVat = fiscal(company?.partita_iva);
    if (!issuerVat) throw new Error('Compila la partita IVA nella Scheda M2I prima dell’importazione.');
    const seen = new Set(), repeated = new Set();
    for (const invoice of pair.invoices.filter(item => !item.parseError)) {
      const key = invoiceKey(invoice);
      if (seen.has(key)) repeated.add(key);
      seen.add(key);
    }
    const prepared = pair.invoices.map(invoice => ({ ...invoice,
      ...classify(invoice, clients, [...official, ...aruba], issuerVat, repeated) }));
    return { pair, prepared, issuerVat };
  }

  async function preview(args) {
    const { pair, prepared } = await analyze(args);
    return { pdfSenzaXml: pair.pdfWithoutXml,
      fatture: prepared.map(item => ({ id: item.id, numero: item.numero || '', data: item.dataFattura || '',
        cliente: item.clienteXml || '', clienteId: item.clienteId || null, nuovoCliente: Boolean(item.nuovoCliente),
        tipoDocumento: item.tipoDocumento || '', totale: item.importoTotale ?? null,
        scadenza: item.dataScadenza || '', scadenzeMultiple: Boolean(item.scadenzeMultiple),
        xml: item.xml?.name || '', pdf: item.pdf?.name || '', stato: item.stato, motivo: item.motivo,
        selezionata: item.stato === 'pronta' })) };
  }

  async function importSelected(args) {
    if (!Array.isArray(args.selected) || !args.selected.length || args.selected.length > 300) {
      throw new Error('Seleziona almeno una fattura da importare.');
    }
    if (!dataDir) throw new Error('DATA_DIR richiesto per conservare XML e PDF.');
    const { prepared, issuerVat } = await analyze(args);
    const byId = new Map(prepared.map(item => [item.id, item]));
    const ids = args.selected.map(item => String(item.id || ''));
    if (new Set(ids).size !== ids.length) throw new Error('Selezione duplicata.');
    const chosen = args.selected.map(choice => {
      const item = byId.get(String(choice.id || ''));
      if (item?.stato === 'presente') return { ...item, skip: true };
      const due = String(choice.scadenza || item?.dataScadenza || '');
      if (!item || !['pronta', 'scadenza'].includes(item.stato) || !validDate(due)) {
        throw new Error(`Controlla la fattura ${item?.numero || choice.id}: documento o scadenza non validi.`);
      }
      return { ...item, due };
    });
    const results = [];
    for (const item of chosen) {
      if (item.skip) { results.push({ id: item.id, numero: item.numero, esito: 'presente' }); continue; }
      const pdfRelative = path.join('uploads', 'fatture_storiche', `${crypto.randomUUID()}.pdf`);
      const xmlName = `${crypto.randomUUID()}.xml`;
      const pdfPath = path.join(dataDir, pdfRelative);
      const xmlPath = path.join(dataDir, 'uploads', 'unknown', xmlName);
      let committed = false;
      try {
        fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
        fs.mkdirSync(path.dirname(xmlPath), { recursive: true });
        fs.writeFileSync(pdfPath, item.pdf.content, { flag: 'wx' });
        fs.writeFileSync(xmlPath, item.xml.content, { flag: 'wx' });
        const result = await knex.transaction(async trx => {
          const [official, aruba, clients] = await Promise.all([
            trx('fatture').select('numero_fattura', 'data_fattura'),
            trx('fatture_aruba_elaborati').select('numero_fattura', 'data_fattura'),
            trx('clienti').select('id', 'ragione_sociale', 'partita_iva', 'codice_fiscale')
          ]);
          if ([...official, ...aruba].some(row => invoiceKey(row) === invoiceKey(item))) return { esito: 'presente' };
          const match = matchClient(item, clients);
          if (match.ambiguous) throw new Error('Anagrafica cliente ambigua.');
          let clientId = match.client?.id;
          let newClient = false;
          if (!clientId) {
            clientId = `CLI_STOR_${crypto.randomUUID()}`;
            const address = item.clienteSede || {};
            await trx('clienti').insert({ id: clientId, ragione_sociale: item.clienteXml,
              partita_iva: item.vat || null, codice_fiscale: item.taxCode || null,
              tipo_cliente: item.vat ? 'PARTITA_IVA' : 'PRIVATO', attivo: 'NO',
              indirizzo_sede: address.indirizzo || null, civico_sede: address.civico || null,
              cap: address.cap || null, citta: address.citta || null, provincia: address.provincia || null,
              sede_legale: [address.indirizzo, address.civico, address.cap, address.citta,
                address.provincia ? `(${address.provincia})` : ''].filter(Boolean).join(' '),
              codice_sdi: item.clienteCodiceSdi || null, pec: item.clientePec || null,
              note: 'Anagrafica creata da importazione fattura storica insoluta.' });
            newClient = true;
          }
          const invoiceId = `FAT_STOR_${crypto.randomUUID()}`;
          await trx('fatture').insert({ id: invoiceId, cliente_id: clientId,
            numero_fattura: item.numero, data_fattura: item.dataFattura,
            importo_imponibile: item.imponibile, importo_iva: item.iva,
            importo_totale: item.importoTotale, importo_pagato: 0,
            stato_pagamento: 'Da Pagare', data_scadenza: item.due,
            tipo_documento: 'TD01', allegato_fattura: xmlName,
            note: 'Importata nello storico insoluti; stato di pagamento confermato durante l’importazione.',
            creato_da: args.userId || null });
          await trx('fatture_storiche_insoluti').insert({ fattura_id: invoiceId,
            pdf_path: pdfRelative, xml_name: xmlName, descrizione: item.descrizione || null,
            emittente_iva: issuerVat, importata_at: new Date().toISOString(), importata_da: args.userId || null });
          return { esito: 'importata', fatturaId: invoiceId, nuovoCliente: newClient };
        });
        committed = result.esito === 'importata';
        results.push({ id: item.id, numero: item.numero, ...result });
      } catch (error) {
        results.push({ id: item.id, numero: item.numero, esito: 'errore', errore: error.message });
      } finally {
        if (!committed) { fs.rmSync(pdfPath, { force: true }); fs.rmSync(xmlPath, { force: true }); }
      }
    }
    return { importate: results.filter(row => row.esito === 'importata').length,
      ignorate: results.filter(row => row.esito === 'presente').length,
      clientiCreati: results.filter(row => row.nuovoCliente).length,
      risultati: results };
  }

  async function pdf(invoiceId) {
    const row = await knex('fatture_storiche_insoluti').where({ fattura_id: invoiceId }).first('pdf_path');
    if (!row || !dataDir) return null;
    const root = path.resolve(dataDir, 'uploads', 'fatture_storiche');
    const file = path.resolve(dataDir, row.pdf_path);
    return file.startsWith(root + path.sep) && path.extname(file).toLowerCase() === '.pdf' && fs.existsSync(file) ? file : null;
  }

  return { initialize, preview, importSelected, pdf };
}

module.exports = { createHistoricalInvoiceService, matchClient, invoiceKey };
