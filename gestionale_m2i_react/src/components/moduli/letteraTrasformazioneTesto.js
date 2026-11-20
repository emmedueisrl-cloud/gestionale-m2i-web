export const dataTrasformazioneIt = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : '__.__.____';

const normale = text => ({ text, bold: false });
const variabile = text => ({ text, bold: true });

export function segmentiLetteraTrasformazione(data = {}) {
  return [
    [normale('Con riferimento al contratto di lavoro a tempo determinato del '),
      variabile(dataTrasformazioneIt(data.dataAssunzione)),
      normale(", siamo lieti di comunicarLe, ai sensi del D.LGS. n. 368/2001, della L. 247/2007 e secondo quanto previsto dall'art. 11 del CCNL di riferimento, che lo stesso viene trasformato a tempo indeterminato a far data dal "),
      variabile(dataTrasformazioneIt(data.dataTrasformazione)), normale('.')],
    [normale('Per tutto quanto non espressamente previsto nella presente lettera rimandiamo a quanto contenuto nel contratto di assunzione ed alle norme contrattuali e di legge applicate nella nostra azienda.')],
    [normale('Per presa visione ed accettazione.')]
  ];
}
