const pdfParse = require('pdf-parse');
const path = require('node:path');
const { createWorker } = require('tesseract.js');
const { createCanvas } = require('@napi-rs/canvas');

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  .replace(/[^A-Z0-9]/g, ' ').replace(/\b(SOCIETA|S R L|SRL|S P A|SPA|S A S|SAS)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const linesOf = text => String(text || '').replace(/\r/g, '').split('\n').map(clean).filter(Boolean);
const field = (lines, pattern) => {
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (!match) continue;
    const value = clean(match[1] || '');
    if (value && !/^(?:dati|indirizzo|sede|codice|partita)$/i.test(value)) return value;
    if (lines[i + 1]) return lines[i + 1];
  }
  return '';
};
const taxCode = value => clean(value).replace(/[^A-Z0-9]/gi, '').toUpperCase();
const taxFromLabel = (lines, pattern, digitsOnly = false) => {
  const expected = digitsOnly ? /\d{11}/ : /(?:[A-Z0-9]{16}|\d{11})/i;
  for (let index = 0; index < lines.length; index++) {
    if (!pattern.test(lines[index])) continue;
    const found = lines.slice(index, index + 4).join(' ').match(expected)?.[0];
    if (found) return taxCode(found);
  }
  return '';
};

function legalAddress(lines) {
  const candidates = [];
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(?:indirizzo\s+)?sede\s*legale\s*[:\-]?\s*(.*)$/i);
    if (!match) continue;
    let value = clean(match[1]);
    for (const next of lines.slice(index + 1, index + 5)) {
      if (/^(?:domicilio|numero rea|codice|partita|forma giuridica|sezione\b|indirizzo sede legale)/i.test(next)) break;
      const street = /^(?:VIA|VIALE|PIAZZA|CORSO|LARGO|STRADA|VICOLO|PIAZZALE|VIA DELLA|VIA DEL)\b/i.test(next);
      const cap = /^CAP\s*\d{5}\b/i.test(next);
      const streetContinuation = /\b(?:VIA|VIALE|PIAZZA|CORSO|LARGO|STRADA|VICOLO)\s+(?:DEL|DELLA|DI)\s*$/i.test(value)
        && /\b\d{1,4}\b/.test(next);
      const courtesy = /\bC\/O\s*$/i.test(value);
      if (!street && !cap && !streetContinuation && !courtesy) break;
      value = clean(`${value} ${next}`);
    }
    if (!value) continue;
    const score = Number(/\bCAP\s*\d{5}\b/i.test(value)) * 100
      + Number(/\b(?:VIA|VIALE|PIAZZA|CORSO|LARGO|STRADA|VICOLO|PIAZZALE)\b/i.test(value)) * 30
      + Number(/\b\d{1,4}\b/.test(value.replace(/\bCAP\s*\d{5}\b/ig, ''))) * 10;
    candidates.push({ value, score, index });
  }
  candidates.sort((a, b) => b.score - a.score || b.index - a.index);
  return candidates[0]?.value || '';
}

async function ocrVisura(buffer, pages) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const documentTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  const document = await documentTask.promise;
  let worker;
  try {
    worker = await createWorker('ita', 1, { langPath: path.join(__dirname, 'ocr'), cacheMethod: 'none' });
    const results = [];
    for (let number = 1; number <= Math.min(pages || document.numPages, document.numPages, 3); number++) {
      const page = await document.getPage(number);
      const base = page.getViewport({ scale: 1 });
      // 1600 px mantengono leggibili le visure scansionate senza rallentare inutilmente l'OCR.
      const viewport = page.getViewport({ scale: 1600 / Math.max(base.width, base.height) });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
      results.push((await worker.recognize(canvas.toBuffer('image/png'))).data.text);
      page.cleanup();
    }
    return results.join('\n');
  } finally {
    if (worker) await worker.terminate();
    await documentTask.destroy();
  }
}

function parseVisuraText(text) {
  const lines = linesOf(text);
  if (lines.join(' ').length < 150 || !/visura|registro delle imprese|camera di commercio/i.test(text)) {
    throw new Error('Il PDF non contiene una visura camerale con testo leggibile. Carica una visura digitale con testo selezionabile.');
  }
  const nameIndex = lines.findIndex(line => /(?:denominazione|ragione sociale|nome impresa)\s*:/i.test(line));
  let ragioneSociale = nameIndex >= 0 ? clean(lines[nameIndex].split(/(?:denominazione|ragione sociale|nome impresa)\s*:/i)[1])
    : field(lines, /^(?:denominazione|ragione sociale|nome impresa)\s*[:\-]?\s*(.*)$/i);
  if (nameIndex >= 0 && /(?:&|\bDI|\bDEL|\bDELLA)\s*$/i.test(ragioneSociale)
    && /^[A-ZÀ-Ü0-9 &'.,-]{3,100}$/.test(lines[nameIndex + 1] || '')) {
    ragioneSociale = clean(`${ragioneSociale} ${lines[nameIndex + 1]}`);
  }
  const partitaIva = taxFromLabel(lines, /partita\s*i\.?v\.?a\.?/i, true);
  const codiceFiscale = taxFromLabel(lines, /codice\s*fiscale/i);
  if (!ragioneSociale && !partitaIva && !codiceFiscale) {
    throw new Error('I dati anagrafici non sono leggibili nella visura. Verifica che il PDF sia completo.');
  }
  const sede = legalAddress(lines);
  const indirizzo = field(lines, /^(?:indirizzo|indirizzo\s*sede)\s*[:\-]?\s*(.*)$/i);
  const sedeCompleta = clean([sede, sede && !/\b(?:VIA|VIALE|PIAZZA|CORSO|LARGO|STRADA|VICOLO)\b/i.test(sede) ? indirizzo : ''].filter(Boolean).join(' '));
  const cap = (sedeCompleta.match(/\b(?:CAP\s*)?(\d{5})\b/i) || [])[1] || '';
  const cityMatch = sede.match(/^([A-ZÀ-Ü][A-ZÀ-Ü'\s]+)\s*\(([A-Z]{2})\)/i)
    || sedeCompleta.match(/\d{5}\s+([A-ZÀ-Ü][A-ZÀ-Ü'\s]+)\s*\(([A-Z]{2})\)/i);
  const citta = cityMatch?.[1]?.trim() || '';
  const provincia = cityMatch?.[2] || '';
  const via = clean(sedeCompleta.replace(/\bCAP\s*\d{5}\b/ig, '').replace(/\b\d{5}\b/g, '')
    .replace(cityMatch?.[0] || /$^/, '').replace(/^[,\s-]+|[,\s-]+$/g, ''));
  const pec = field(lines, /^(?:indirizzo\s*pec|pec|domicilio\s*digitale(?:\s*\/\s*pec)?)\s*[:\-]?\s*(.*)$/i)
    .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const rappresentante = field(lines, /^(?:legale\s*rappresentante|amministratore\s*unico|socio\s*amministratore|titolare\s*dell.impresa)\s*[:\-]?\s*(.*)$/i);
  const numeroRea = (field(lines, /^(?:numero\s*)?r\.?e\.?a\.?\s*[:\-]?\s*(.*)$/i)
    .match(/\b[A-Z]{2}\s*[-/]?\s*\d{3,9}\b/i) || [])[0] || '';
  const formaGiuridica = field(lines, /^forma\s+giuridica\s*[:\-]?\s*(.*)$/i);
  const codiceAteco = (field(lines, /^(?:codice\s*)?ateco\s*[:\-]?\s*(.*)$/i)
    .match(/\b\d{2}(?:\.\d{1,2}){1,2}\b/) || [])[0] || '';
  const attivita = field(lines, /^(?:attivit[aà]\s+(?:prevalente|esercitata)|oggetto\s+dell.attivit[aà])\s*[:\-]?\s*(.*)$/i);
  return {
    ragioneSociale, partitaIva, codiceFiscale, sedeLegale: sedeCompleta,
    indirizzoSede: via, cap, citta, provincia, pec, rappresentante,
    numeroRea, formaGiuridica, codiceAteco, attivita
  };
}

function createVisuraService(knex) {
  return {
    async preview(buffer) {
      if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Carica una visura camerale PDF.');
      const parsed = await pdfParse(buffer);
      let text = parsed.text;
      let dati;
      try { dati = parseVisuraText(text); } catch { /* La visura può essere una scansione. */ }
      if (!dati?.ragioneSociale || (!dati.partitaIva && !dati.codiceFiscale)) {
        text = `${text}\n${await ocrVisura(buffer, parsed.numpages)}`;
        dati = parseVisuraText(text);
      }
      const clienti = await knex('clienti').where(function () { this.where('cestinato', 0).orWhereNull('cestinato'); })
        .select('id', 'ragione_sociale', 'partita_iva', 'codice_fiscale', 'attivo', 'sede_legale');
      const candidati = clienti.map(cliente => {
        const ivaUguale = Boolean(dati.partitaIva && dati.partitaIva === taxCode(cliente.partita_iva));
        const cfUguale = Boolean(dati.codiceFiscale && dati.codiceFiscale === taxCode(cliente.codice_fiscale));
        const nomeUguale = normalize(dati.ragioneSociale) === normalize(cliente.ragione_sociale);
        return { ...cliente, match: ivaUguale ? 'Partita IVA identica' : cfUguale ? 'Codice fiscale identico' : nomeUguale ? 'Denominazione identica' : '' };
      }).filter(cliente => cliente.match);
      return { dati, candidati, pagine: parsed.numpages, letturaOcr: text.length > parsed.text.length + 1 };
    }
  };
}

module.exports = { parseVisuraText, createVisuraService, ocrVisura };
