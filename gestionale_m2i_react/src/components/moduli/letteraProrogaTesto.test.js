import test from 'node:test';
import assert from 'node:assert/strict';
import { dataProrogaIt, oggettoLetteraProroga, presaVisioneProroga, segmentiLetteraProroga } from './letteraProrogaTesto.js';

test('oggetto e paragrafi riproducono il Word della proroga', () => {
  assert.equal(oggettoLetteraProroga,
    'Oggetto: COMUNICAZIONE DI PROROGA DEL CONTRATTO DI LAVORO A TEMPO DETERMINATO AI SENSI DEL D.LGS. N. 81 DEL 15.06.2015 E ART. 17 D.L. 22 MARZO 2021 N. 41');
  const paragraphs = segmentiLetteraProroga({ dataAssunzione: '2026-07-10', nuovaScadenza: '2027-03-31' });
  assert.deepEqual(paragraphs.map(parts => parts.map(part => part.text).join('')), [
    'In relazione ai colloqui verbali intercorsi, con riferimento alla sua assunzione del 10/07/2026, siamo lieti di comunicarLe il rinnovo del Suo contratto di lavoro sino al 31/03/2027 alle medesime condizioni.',
    'Per quanto non espressamente previsto nella presente lettera, si rimanda alla contrattazione collettiva ed alle normative vigenti in materia.'
  ]);
  assert.deepEqual(paragraphs[0].filter(part => part.bold).map(part => part.text), ['10/07/2026', '31/03/2027']);
  assert.equal(dataProrogaIt('2026-07-10'), '10/07/2026');
  assert.equal(presaVisioneProroga, 'Per presa visione ed accettazione');
});
