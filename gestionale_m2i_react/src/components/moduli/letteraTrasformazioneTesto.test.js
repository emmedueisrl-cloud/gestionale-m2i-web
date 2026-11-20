import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentiLetteraTrasformazione } from './letteraTrasformazioneTesto.js';

test('la lettera conserva i tre paragrafi richiesti e mette in grassetto le due date', () => {
  const paragraphs = segmentiLetteraTrasformazione({ dataAssunzione: '2026-04-01', dataTrasformazione: '2026-08-01' });
  assert.deepEqual(paragraphs.map(parts => parts.map(part => part.text).join('')), [
    "Con riferimento al contratto di lavoro a tempo determinato del 01.04.2026, siamo lieti di comunicarLe, ai sensi del D.LGS. n. 368/2001, della L. 247/2007 e secondo quanto previsto dall'art. 11 del CCNL di riferimento, che lo stesso viene trasformato a tempo indeterminato a far data dal 01.08.2026.",
    'Per tutto quanto non espressamente previsto nella presente lettera rimandiamo a quanto contenuto nel contratto di assunzione ed alle norme contrattuali e di legge applicate nella nostra azienda.',
    'Per presa visione ed accettazione.'
  ]);
  assert.deepEqual(paragraphs[0].filter(part => part.bold).map(part => part.text), ['01.04.2026', '01.08.2026']);
});
