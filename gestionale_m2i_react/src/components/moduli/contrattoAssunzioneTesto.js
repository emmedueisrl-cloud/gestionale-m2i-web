import origine from './contrattoAssunzioneOriginale.json' with { type: 'json' };

export const dataItContratto = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value || '____/____/________';

const originale = index => origine.paragrafi[index].trim();
const normale = text => ({ text, bold: false });
const variabile = text => ({ text: String(text), bold: true });

function sostituisci(index, replacements = []) {
  const source = originale(index);
  const parts = [];
  let position = 0;
  for (const [literal, value] of replacements) {
    const found = source.indexOf(literal, position);
    if (found < 0) throw new Error(`Campo non trovato nel modello di assunzione: ${index} / ${literal}`);
    if (found > position) parts.push(normale(source.slice(position, found)));
    parts.push(variabile(value));
    position = found + literal.length;
  }
  if (position < source.length) parts.push(normale(source.slice(position)));
  return parts;
}

export function paragrafoOriginaleContrattoAssunzione(index, azienda) {
  if (index !== 59 || !azienda) return originale(index);
  return originale(index)
    .replace('Mauro MARTINELLI', String(azienda.amministratore_unico || '').trim() || '________________')
    .replace('“_______________________________________________”', `“${String(azienda.sede_legale || '').trim() || '________________'}”`);
}

export function titoloContrattoAssunzione(data = {}) {
  const durata = /indeterminato/i.test(data.tipoContratto || '') ? 'TEMPO INDETERMINATO' : 'TEMPO DETERMINATO';
  const orario = String(data.tipoOrario || data.oreSettimanali || '');
  const regime = /parziale|part[ -]?time/i.test(orario) ? ' PART TIME'
    : /tempo pieno|full[ -]?time/i.test(orario) ? ' TEMPO PIENO' : '';
  return originale(11).replace('TEMPO DETERMINATO PART TIME', `${durata}${regime}`);
}

function qualificaCategoria(data) {
  const qualifica = String(data.qualifica || '').trim();
  const mansioni = String(data.mansioni || '').trim();
  if (!qualifica) return mansioni || '________________';
  if (!mansioni || qualifica.toLowerCase().includes(mansioni.toLowerCase()) ||
      mansioni.toLowerCase() === qualifica.toLowerCase()) return qualifica;
  return `${qualifica} - ${mansioni}`;
}

export function segmentiContrattoAssunzione(data = {}, azienda = {}) {
  const femmina = data.sesso === 'F';
  const determinato = !/indeterminato/i.test(data.tipoContratto || '');
  const orario = /pieno|full[ -]?time/i.test(data.tipoOrario || '') ? 'Full Time' : 'Part Time';
  const ccnl = data.ccnlRetribuzione || String(data.livelloCCNL || '').match(/C\.C\.N\.L\..*$/i)?.[0] || 'CCNL PULIZIA';
  const livello = String(data.livelloCCNL || '').replace(/\s*C\.C\.N\.L\..*$/i, '').trim() || '________________';
  const sede = data.sedeLavoro || azienda.sede_legale || '____________________________';
  const ore = String(data.oreSettimanali || '').trim().toUpperCase() || '________________ ORE SETTIMANALI';
  const corpo = {
    13: [['Part Time', orario]],
    15: [['02/07/2026', dataItContratto(data.dataInizio)], ['assunta', femmina ? 'assunta' : 'assunto'],
      ['a tempo determinato', determinato ? 'a tempo determinato' : 'a tempo indeterminato'],
      ['07/08/2026', determinato ? dataItContratto(data.dataFine) : '__________'],
      ['0000000000000000', data.codiceComunicazione || '________________']],
    17: [['via del Fontanile Anagnino 138 – 00118 Roma', sede],
      ['inviarla', femmina ? 'inviarla' : 'inviarlo']],
    19: [['PART TIME 8 ORE SETTIMANALI', ore]],
    21: [['OPERAIO ADDETTO ALLE PULIZIE', qualificaCategoria(data).toUpperCase()]],
    23: [['1°', livello]],
    27: [['10 GIORNI', `${data.periodoProva || '____'} GIORNI`]],
    29: [['CCNL PULIZIA', ccnl]]
  };
  return [13, 15, 17, 19, 21, 23, 25, 27, 29, 32, 33, 34, 35, 36, 38]
    .map(index => sostituisci(index, corpo[index] || []));
}

export function segmentiRecapitiContrattoAssunzione(data = {}) {
  return [
    sostituisci(50),
    sostituisci(52, [['________________________________________________________', data.telefono?.trim() || '________________________________________________________']]),
    sostituisci(53, [['____________________________________________________________', data.email?.trim() || '____________________________________________________________']]),
    sostituisci(54, [['_____________________________________________________', data.iban?.trim() || '_____________________________________________________']])
  ];
}

export function paragrafiContrattoAssunzione(data = {}, azienda = {}) {
  return segmentiContrattoAssunzione(data, azienda).map(paragraph => paragraph.map(part => part.text).join(''));
}
