const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVisuraText } = require('../visura_camerale');

test('legge i dati fiscali e la sede da una visura camerale testuale', () => {
  const text = [
    'VISURA ORDINARIA - REGISTRO DELLE IMPRESE',
    'Denominazione INN URBE COLOSSEO S.R.L.',
    'Partita IVA 12345678901',
    'Codice fiscale 12345678901',
    'Sede legale ROMA (RM) VIA DEL COLOSSEO 3 CAP 00184',
    'PEC innurbe@pec.it',
    'Amministratore unico MARIO ROSSI',
    'Dati identificativi dell impresa e sede legale in Roma capitale'
  ].join('\n');
  assert.deepEqual(parseVisuraText(text), {
    ragioneSociale: 'INN URBE COLOSSEO S.R.L.', partitaIva: '12345678901', codiceFiscale: '12345678901',
    sedeLegale: 'ROMA (RM) VIA DEL COLOSSEO 3 CAP 00184', indirizzoSede: 'VIA DEL COLOSSEO 3',
    cap: '00184', citta: 'ROMA', provincia: 'RM', pec: 'innurbe@pec.it', rappresentante: 'MARIO ROSSI',
    numeroRea: '', formaGiuridica: '', codiceAteco: '', attivita: ''
  });
});

test('rifiuta PDF senza testo di visura riconoscibile', () => {
  assert.throws(() => parseVisuraText('Documento senza dati fiscali'), /visura camerale/);
});

test('conserva anche REA, forma giuridica, ATECO e attività quando leggibili', () => {
  const text = [
    'VISURA ORDINARIA - REGISTRO DELLE IMPRESE',
    'Denominazione PULIZIE ESEMPIO SRL',
    'Partita IVA 12345678901',
    'Sede legale ROMA (RM) VIA ROMA 10 CAP 00100',
    'Numero REA RM - 123456',
    'Forma giuridica SOCIETA A RESPONSABILITA LIMITATA',
    'Codice ATECO 81.21.00',
    'Attività prevalente Pulizia generale di edifici'
  ].join('\n');
  const result = parseVisuraText(text);
  assert.equal(result.numeroRea, 'RM - 123456');
  assert.equal(result.formaGiuridica, 'SOCIETA A RESPONSABILITA LIMITATA');
  assert.equal(result.codiceAteco, '81.21.00');
  assert.equal(result.attivita, 'Pulizia generale di edifici');
});

test('preferisce la sede completa nella sezione Sede quando il riepilogo OCR è troncato', () => {
  const text = [
    'VISURA ORDINARIA - REGISTRO DELLE IMPRESE',
    'Denominazione FARMACIA JUNGANO SNC',
    'Partita IVA 16963181009',
    'Indirizzo Sede legale ROMA (RM) VIA DELLA',
    'DELLA DR.SSA MARIA VITA PISANA 116 MIN/L/E GAP',
    'Domicilio digitale/PEC 09606@pec.federfarma.it',
    '1 Sede',
    'Indirizzo Sede legale ROMA (RM)',
    'VIA DELLA PISANA 116 M/N/L/E CAP 00163',
    'Domicilio digitale/PEC 09606@pec.federfarma.it'
  ].join('\n');
  const result = parseVisuraText(text);
  assert.equal(result.sedeLegale, 'ROMA (RM) VIA DELLA PISANA 116 M/N/L/E CAP 00163');
  assert.equal(result.indirizzoSede, 'VIA DELLA PISANA 116 M/N/L/E');
  assert.equal(result.cap, '00163');
});
