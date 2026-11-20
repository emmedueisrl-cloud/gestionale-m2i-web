const pdfParse = require('pdf-parse');
const { ocrVisura } = require('./visura_camerale');

const tidy = value => String(value || '').replace(/\s+/g, ' ').trim();
const withoutPageFooter = value => tidy(String(value || '').replace(/Registro Imprese\s+Archivio ufficiale della CCIAA\s+Documento n[\s\S]*?Visura ordinaria societa' di capitale\s*•\s*di\s*\d+/gi, ' '));
const capture = (text, pattern) => tidy(text.match(pattern)?.[1]);
const after = (text, label) => capture(text, new RegExp(`${label}\\s*:?\\s*([^\\n]+)`, 'i'));
const date = value => tidy(value).match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0] || '';
const section = (text, start, end) => tidy(text.match(new RegExp(`${start}\\s*([\\s\\S]*?)\\s*${end}`, 'i'))?.[1]);

function parseVisuraAzienda(text) {
  if (!/VISURA\s+(?:ORDINARIA|STORICA)|Registro Imprese/i.test(text)) {
    throw new Error('Il PDF non sembra una visura camerale.');
  }
  const denominazione = capture(text, /Denominazione:\s*([^\n]+)/i)
    || capture(text, /VISURA\s+ORDINARIA\s+SOCIETA'\s+DI\s+CAPITALE\s+([^\n]+)/i);
  const partitaIva = capture(text, /Partita IVA\s*:?\s*(\d{11})/i);
  const codiceFiscale = capture(text, /Codice fiscale e (?:n\.iscr\.|numero di iscrizione|numero d'iscrizione)[^\n]*\n?\s*(\d{11})/i)
    || capture(text, /Codice fiscale e numero di iscrizione:\s*(\d{11})/i)
    || capture(text, /Codice Fiscale\s+(\d{11})/i);
  if (!denominazione || (!partitaIva && !codiceFiscale)) {
    throw new Error('Denominazione o identificativi fiscali non leggibili nella visura.');
  }
  const sede = capture(text, /Indirizzo Sede legale\s*\n\s*([^\n]+(?:\n\s*VIA[^\n]+)?)/i)
    || section(text, /^ 1  Sede$/m.source, 'Domicilio digitale');
  const sedeLine = section(text, 'Indirizzo Sede legale', 'Domicilio digitale') || sede;
  const sedeComune = capture(sedeLine, /^([A-ZÀ-Ü' ]+)\s*\([A-Z]{2}\)/i);
  const sedeProvincia = capture(sedeLine, /^[A-ZÀ-Ü' ]+\s*\(([A-Z]{2})\)/i);
  const sedeCap = capture(sedeLine, /\bCAP\s*(\d{5})/i);
  const sedeIndirizzo = capture(sedeLine, /\([A-Z]{2}\)\s*(.*?)\s*CAP\s*\d{5}/i);
  const unitaLocale = section(text, "Unita' Locale n\\. [^\\n]+\\s+Sede Operativa", "Attivita' esercitata");
  const ammStart = text.indexOf('Elenco amministratori');
  const ammEnd = ammStart >= 0 ? text.indexOf(' 6  Titolari di altre cariche', ammStart) : -1;
  const ammSection = ammStart >= 0 ? text.slice(ammStart, ammEnd > ammStart ? ammEnd : undefined) : '';
  const ammName = capture(ammSection, /Amministratore Unico\s+([A-ZÀ-Ü' ]{5,})Rappresentante/i)
    || capture(text, /Amministratore Unico\s*\n\s*([A-ZÀ-Ü' ]{5,})\s*\n\s*Rappresentante/i)
    || capture(text, /Amministratore Unico\s*([A-ZÀ-Ü' ]{5,})\s+Rappresentante dell'Impresa/i);
  const capital = section(text, 'Capitale sociale in Euro', 'Conferimenti in denaro');
  const oggettoStart = text.lastIndexOf('Oggetto sociale\nLA SOCIETA');
  const oggettoEnd = oggettoStart >= 0 ? text.indexOf('\nPoteri\n', oggettoStart) : -1;
  const oggetto = oggettoStart >= 0 && oggettoEnd > oggettoStart
    ? withoutPageFooter(text.slice(oggettoStart + 'Oggetto sociale\n'.length, oggettoEnd)) : '';
  const addetti = capture(text, /Addetti al\s+\d{2}\/\d{2}\/\d{4}\s*(\d+)/i);
  const numeroUnitaLocali = capture(text, /Unità locali\s*(\d+)/i);
  const sedeOperativa = capture(text, /Unita' Locale n\. [^\n]+\s+Sede Operativa\s+Data apertura:[^\n]+\s+Indirizzo\s+([^\n]+\n[^\n]+)/i)
    || capture(text, /Unita' Locale n\. [^\n]+\s+(VIA[^\n]+)/i);
  const sedeOperativaCap = capture(sedeOperativa, /\bCAP\s*(\d{5})/i);
  const sedeOperativaIndirizzo = capture(sedeOperativa, /\([A-Z]{2}\)\s*(.*?)\s*CAP\s*\d{5}/i);
  const attivitaPrevalente = section(text, "attività prevalente esercitata\\s+dall'impresa", 'Classificazione ATECO 2025')
    || section(text, 'Attività prevalente\\s*\\n', 'Classificazione ATECO 2025');
  const soci = section(text, 'Sintesi della composizione societaria', 'Elenco dei soci');
  const abilitazioni = section(text, 'Abilitazioni\\s*\\n', " 8  Sedi secondarie");
  return {
    ragioneSociale: denominazione, partitaIva, codiceFiscale,
    sedeLegale: tidy(sedeLine), sedeOperativa: tidy(sedeOperativa || unitaLocale),
    sedeLegaleIndirizzo: sedeIndirizzo, sedeLegaleCap: sedeCap,
    sedeLegaleComune: sedeComune, sedeLegaleProvincia: sedeProvincia,
    sedeOperativaIndirizzo, sedeOperativaCap,
    pec: capture(text, /(?:Domicilio digitale\/PEC|Domicilio digitale\/PEC\s*\n)\s*([^\s]+@[^\s]+)/i),
    rea: capture(text, /(?:Numero REA|Numero repertorio economico\s+amministrativo \(REA\))\s*([A-Z]{2}\s*-?\s*\d+)/i),
    formaGiuridica: capture(text, /Forma giuridica\s*([^\n]+)/i).replace(/^societa/i, 'societa'),
    dataCostituzione: date(after(text, 'Data atto di costituzione')),
    amministratoreUnico: tidy(ammName),
    capitaleSociale: capture(capital, /Sottoscritto:\s*([\d.,]+)/i) || capture(text, /Capitale sociale\s+sottoscritto\s*([\d.,]+)/i),
    codiceAteco: capture(text, /Codice ATECO\s*(\d{2}\.\d{2}(?:\.\d{1,2})?)/i)
      || capture(text, /Classificazione ATECO 2025[\s\S]{0,120}?Codice:\s*(\d{2}\.\d{2}(?:\.\d{1,2})?)/i),
    dataIscrizione: date(after(text, 'Data iscrizione')),
    dataInizioAttivita: date(after(text, 'Data inizio attività')),
    statoAttivita: after(text, 'Stato attività'),
    attivitaPrevalente: tidy(attivitaPrevalente),
    oggettoSociale: tidy(oggetto),
    capitaleVersato: capture(capital, /Versato:\s*([\d.,]+)/i),
    numeroAddetti: addetti, numeroUnitaLocali,
    numeroSoci: capture(text, /Soci e titolari di diritti su\s+azioni e quote\s*(\d+)/i),
    numeroAmministratori: capture(text, /Amministratori\s*(\d+)/i),
    codiceNace: capture(text, /Codice NACE 2\.1\s*(\d{2}\.\d{2})/i),
    codiceAtecoPrecedente: capture(text, /Classificazione ATECORI 2007-2022[\s\S]{0,120}?Codice:\s*(\d{2}\.\d{1,2}(?:\.\d{1,2})?)/i),
    dataUltimoProtocollo: date(after(text, 'Data ultimo protocollo')),
    durataSocieta: capture(text, /\bDurata:\s*([^\n]+)/i),
    rappresentanteCodiceFiscale: capture(ammSection, /Codice fiscale:\s*([A-Z0-9]{16})/i),
    rappresentanteLuogoNascita: capture(ammSection, /Nato a\s+([^\n]+?)\s+il\s+\d{2}\/\d{2}\/\d{4}/i),
    rappresentanteDataNascita: date(capture(ammSection, /Nato a[^\n]+?il\s*(\d{2}\/\d{2}\/\d{4})/i)),
    rappresentanteDomicilio: capture(ammSection, /domicilio\s*\n\s*([^\n]+\n[^\n]+)/i),
    rappresentantePec: capture(ammSection, /Indirizzo di posta elettronica certificata:\s*([^\s]+@[^\s]+)/i),
    dataAperturaUnitaLocale: date(capture(text, /Unita' Locale n\.[\s\S]{0,160}?Data apertura:\s*(\d{2}\/\d{2}\/\d{4})/i)),
    attivitaUnitaLocale: capture(text, /Sede Operativa[\s\S]*?Attivita' esercitata\s*([^\n]+(?:\n[^\n]+)?)/i),
    codiceAtecoUnitaLocale: capture(text, /Sede Operativa[\s\S]*?Classificazione ATECO 2025[\s\S]{0,100}?Codice:\s*(\d{2}\.\d{2}(?:\.\d{1,2})?)/i),
    soci: withoutPageFooter(soci), abilitazioni: withoutPageFooter(abilitazioni),
    prepostoTecnico: capture(text, /Preposta Alla Gestione Tecnica Ai\s+Sensi Del D\.m\. 274\/97\s+([A-ZÀ-Ü' ]+)/i),
    dataVisura: date(capture(text, /estratto dal Registro Imprese in data\s*(\d{2}\/\d{2}\/\d{4})/i)),
    numeroDocumentoVisura: capture(text, /Documento n\s*\.\s*([A-Z]\s*\d+)/i)
  };
}

async function previewVisuraAzienda(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Carica una visura camerale PDF.');
  const pdf = await pdfParse(buffer);
  let text = pdf.text;
  let dati;
  try { dati = parseVisuraAzienda(text); } catch { /* Possibile scansione. */ }
  if (!dati?.ragioneSociale || (!dati.partitaIva && !dati.codiceFiscale)) {
    text += `\n${await ocrVisura(buffer, pdf.numpages)}`;
    dati = parseVisuraAzienda(text);
  }
  return { dati, pagine: pdf.numpages, letturaOcr: text.length > pdf.text.length + 1 };
}

module.exports = { parseVisuraAzienda, previewVisuraAzienda };
