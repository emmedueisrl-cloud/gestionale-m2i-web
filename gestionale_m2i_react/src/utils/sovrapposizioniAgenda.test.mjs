import test from 'node:test';
import assert from 'node:assert/strict';
import { trovaSovrapposizioniAgenda } from './sovrapposizioniAgenda.js';

const existing = { id: 1, idDipendente: 'D1', data: '2026-10-07', oraInizio: '08:00', oraFine: '10:00', senzaOrario: false };
const candidate = overrides => ({ idDipendente: 'D1', data: '2026-10-07', oraInizio: '09:00', oraFine: '', senzaOrario: false, ...overrides });

test('segnala lo stesso orario e un inizio dentro un intervallo', () => {
  assert.equal(trovaSovrapposizioniAgenda(candidate({ oraInizio: '08:00' }), [existing]).length, 1);
  assert.equal(trovaSovrapposizioniAgenda(candidate(), [existing]).length, 1);
  assert.equal(trovaSovrapposizioniAgenda(candidate({ oraInizio: '07:00', oraFine: '09:00' }), [existing]).length, 1);
});

test('ignora orari adiacenti, altre persone, altri giorni e l’impegno modificato', () => {
  assert.equal(trovaSovrapposizioniAgenda(candidate({ oraInizio: '10:00' }), [existing]).length, 0);
  assert.equal(trovaSovrapposizioniAgenda(candidate({ idDipendente: 'D2' }), [existing]).length, 0);
  assert.equal(trovaSovrapposizioniAgenda(candidate({ data: '2026-10-08' }), [existing]).length, 0);
  assert.equal(trovaSovrapposizioniAgenda(candidate({ id: 1 }), [existing]).length, 0);
  assert.equal(trovaSovrapposizioniAgenda(candidate({ senzaOrario: true }), [existing]).length, 0);
});
