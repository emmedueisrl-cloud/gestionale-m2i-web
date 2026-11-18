import test from 'node:test';
import assert from 'node:assert/strict';
import { importoInLettere } from './importoInLettere.js';

test('converte euro e centesimi nei formati usati nel contratto', () => {
  assert.equal(importoInLettere('1.234,56'), 'milleduecentotrentaquattro/56');
  assert.equal(importoInLettere('1000,5'), 'mille/50');
  assert.equal(importoInLettere('1.000'), 'mille/00');
  assert.equal(importoInLettere('€ 21,08'), 'ventuno/08');
  assert.equal(importoInLettere('180'), 'centottanta/00');
  assert.equal(importoInLettere('2.000.000,00'), 'due milioni/00');
});

test('rifiuta importi non validi o non positivi', () => {
  assert.equal(importoInLettere(''), '');
  assert.equal(importoInLettere('0'), '');
  assert.equal(importoInLettere('abc'), '');
  assert.equal(importoInLettere('12,3456'), '');
});
