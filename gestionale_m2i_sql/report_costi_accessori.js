const { createHash } = require('node:crypto');
const JSZip = require('jszip');
const xml2js = require('xml2js');

const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];
const cents = value => {
  const raw = String(value ?? '').trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Imponibile XML non valido.');
  return Math.round(Number(raw) * 100);
};

async function expandUploads(files) {
  const expanded = [];
  for (const file of files) {
    if (/\.xml$/i.test(file.originalname || '')) {
      expanded.push(file);
    } else if (/\.zip$/i.test(file.originalname || '')) {
      const archive = await JSZip.loadAsync(file.buffer, { checkCRC32: true })
        .catch(() => { throw new Error(`ZIP non leggibile: ${file.originalname}.`); });
      const entries = Object.values(archive.files).filter(entry => !entry.dir && /\.xml$/i.test(entry.name));
      if (!entries.length) throw new Error(`Lo ZIP ${file.originalname} non contiene fatture XML.`);
      if (expanded.length + entries.length > 100) throw new Error('Carica al massimo 100 fatture XML per volta.');
      for (const entry of entries) {
        if (entry._data?.uncompressedSize > 10 * 1024 * 1024) throw new Error('Un XML nello ZIP supera 10 MB.');
        const buffer = await entry.async('nodebuffer');
        if (buffer.length > 10 * 1024 * 1024) throw new Error('Un XML nello ZIP supera 10 MB.');
        expanded.push({ originalname: entry.name.split('/').pop(), buffer });
      }
    } else throw new Error('Carica solo file XML o ZIP di fatture XML.');
  }
  if (expanded.length > 100) throw new Error('Carica al massimo 100 fatture XML per volta.');
  return expanded;
}

async function parseAccessoryInvoice(file) {
  if (!file?.buffer || !/\.xml$/i.test(file.originalname || '')) throw new Error('Carica solo fatture in formato XML.');
  const parsed = await xml2js.parseStringPromise(file.buffer.toString('utf8'), {
    explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix]
  }).catch(() => { throw new Error(`XML non leggibile: ${file.originalname}.`); });
  const invoice = parsed?.FatturaElettronica;
  const bodies = asArray(invoice?.FatturaElettronicaBody);
  const supplier = invoice?.FatturaElettronicaHeader?.CedentePrestatore?.DatiAnagrafici;
  if (!bodies.length || !supplier) throw new Error(`Il file ${file.originalname} non è una fattura elettronica valida.`);
  const supplierId = String(supplier.IdFiscaleIVA?.IdCodice || supplier.CodiceFiscale || '').trim();
  const supplierName = String(supplier.Anagrafica?.Denominazione ||
    [supplier.Anagrafica?.Nome, supplier.Anagrafica?.Cognome].filter(Boolean).join(' ') || supplierId).trim();
  const documents = bodies.map(body => {
    const general = body.DatiGenerali?.DatiGeneraliDocumento;
    const number = String(general?.Numero || '').trim();
    const date = String(general?.Data || '').trim();
    const type = String(general?.TipoDocumento || '').trim().toUpperCase();
    const summaries = asArray(body.DatiBeniServizi?.DatiRiepilogo);
    if (!number || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !summaries.length) {
      throw new Error(`Numero, data o riepilogo imponibile mancanti in ${file.originalname}.`);
    }
    const taxable = summaries.reduce((sum, summary) => sum + cents(summary.ImponibileImporto), 0);
    return { number, date, type, taxable: type === 'TD04' ? -Math.abs(taxable) : taxable };
  });
  if (!supplierId && !supplierName) throw new Error(`Fornitore non identificabile in ${file.originalname}.`);
  if (documents.length !== 1) throw new Error(`Il file ${file.originalname} contiene più fatture: caricale separatamente.`);
  const document = documents[0];
  return {
    filename: String(file.originalname).slice(0, 255),
    hash: createHash('sha256').update(file.buffer).digest('hex'),
    documentKey: [supplierId || supplierName.toLowerCase(), document.date, document.number, document.type].join('|'),
    supplierName: supplierName || supplierId,
    invoiceNumber: document.number,
    invoiceDate: document.date,
    taxableCent: document.taxable
  };
}

function createReportAccessoryCosts(knex) {
  async function initialize() {
    if (!await knex.schema.hasTable('report_costi_accessori')) {
      await knex.schema.createTable('report_costi_accessori', table => {
        table.increments('id').primary();
        table.integer('mese').notNullable();
        table.integer('anno').notNullable();
        table.text('nome_file').notNullable();
        table.text('hash_file').notNullable().unique();
        table.text('chiave_documento').notNullable().unique();
        table.text('fornitore').notNullable();
        table.text('numero_fattura').notNullable();
        table.text('data_fattura').notNullable();
        table.integer('imponibile_cent').notNullable();
        table.text('caricato_at').notNullable();
        table.index(['anno', 'mese']);
      });
    }
  }

  async function list(mese, anno) {
    const rows = await knex('report_costi_accessori').where({ mese: Number(mese), anno: Number(anno) })
      .orderBy('data_fattura').orderBy('id');
    return {
      total: rows.reduce((sum, row) => sum + Number(row.imponibile_cent), 0) / 100,
      invoices: rows.map(row => ({ id: row.id, file: row.nome_file, supplier: row.fornitore,
        number: row.numero_fattura, date: row.data_fattura,
        taxable: Number(row.imponibile_cent) / 100, uploadedAt: row.caricato_at }))
    };
  }

  async function importXml(mese, anno, files) {
    if (!Array.isArray(files) || !files.length) throw new Error('Seleziona almeno una fattura XML.');
    const documents = await Promise.all((await expandUploads(files)).map(parseAccessoryInvoice));
    if (new Set(documents.map(item => item.documentKey)).size !== documents.length) {
      throw new Error('Hai selezionato due volte la stessa fattura.');
    }
    await knex.transaction(async trx => {
      for (const document of documents) {
        const existing = await trx('report_costi_accessori').where('chiave_documento', document.documentKey)
          .orWhere('hash_file', document.hash).first('mese', 'anno');
        if (existing) throw new Error(`Fattura ${document.invoiceNumber} già caricata nel Report di ${existing.mese}/${existing.anno}.`);
        await trx('report_costi_accessori').insert({ mese: Number(mese), anno: Number(anno),
          nome_file: document.filename, hash_file: document.hash, chiave_documento: document.documentKey,
          fornitore: document.supplierName, numero_fattura: document.invoiceNumber,
          data_fattura: document.invoiceDate, imponibile_cent: document.taxableCent,
          caricato_at: new Date().toISOString() });
      }
    });
  }

  async function remove(mese, anno, id) {
    const removed = await knex('report_costi_accessori').where({ id: Number(id),
      mese: Number(mese), anno: Number(anno) }).del();
    if (!removed) throw new Error('Fattura di costo accessorio non trovata in questo mese.');
  }

  return { initialize, list, importXml, remove };
}

module.exports = { createReportAccessoryCosts, parseAccessoryInvoice };
