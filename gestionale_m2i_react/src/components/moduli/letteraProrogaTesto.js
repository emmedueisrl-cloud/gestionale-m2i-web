export const dataProrogaIt = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '__/__/____';

export const oggettoLetteraProroga = 'Oggetto: COMUNICAZIONE DI PROROGA DEL CONTRATTO DI LAVORO A TEMPO DETERMINATO AI SENSI DEL D.LGS. N. 81 DEL 15.06.2015 E ART. 17 D.L. 22 MARZO 2021 N. 41';
export const presaVisioneProroga = 'Per presa visione ed accettazione';

const normale = text => ({ text, bold: false });
const variabile = text => ({ text, bold: true });

export function segmentiLetteraProroga(data = {}) {
  return [
    [normale('In relazione ai colloqui verbali intercorsi, con riferimento alla sua assunzione del '),
      variabile(dataProrogaIt(data.dataAssunzione)),
      normale(', siamo lieti di comunicarLe il rinnovo del Suo contratto di lavoro sino al '),
      variabile(dataProrogaIt(data.nuovaScadenza)), normale(' alle medesime condizioni.')],
    [normale('Per quanto non espressamente previsto nella presente lettera, si rimanda alla contrattazione collettiva ed alle normative vigenti in materia.')]
  ];
}
