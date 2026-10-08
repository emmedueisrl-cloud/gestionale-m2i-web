import test from 'node:test';
import assert from 'node:assert/strict';
import { notePostAppuntamento } from './noteAppuntamento.js';

test('separa la copia storica della nota iniziale per un appuntamento interno', () => {
  const note = [
    { id: 1, testo: '  Da chiamare  ', tipo: 'post', autore: 'M2I' },
    { id: 2, testo: 'Cliente interessato', tipo: 'post', autore: 'Marketing' },
    { id: 3, testo: 'Da chiamare', tipo: 'post', autore: 'M2I' }
  ];
  assert.deepEqual(notePostAppuntamento('Da chiamare', note).map(note => note.id), [2, 3]);
});

test('mantiene le note post quando la nota iniziale è già classificata', () => {
  const note = [
    { id: 1, testo: 'Da chiamare', tipo: 'scheda' },
    { id: 2, testo: 'Da chiamare', tipo: 'post', autore: 'Marketing' }
  ];
  assert.deepEqual(notePostAppuntamento('Da chiamare', note).map(note => note.id), [2]);
});
