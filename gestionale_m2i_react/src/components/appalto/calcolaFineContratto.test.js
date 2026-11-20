import test from 'node:test';
import assert from 'node:assert/strict';
import { calcolaFineContratto } from './calcolaFineContratto.js';

test('calcola la fine inclusiva da inizio e durata', () => {
  assert.equal(calcolaFineContratto('2020-05-03', '4 MESI'), '2020-09-02');
  assert.equal(calcolaFineContratto('2024-02-29', '1 ANNO'), '2025-02-28');
  assert.equal(calcolaFineContratto('2026-01-31', '1 MESE'), '2026-02-28');
  assert.equal(calcolaFineContratto('2026-12-28', '2 SETTIMANE'), '2027-01-10');
  assert.equal(calcolaFineContratto('2026-11-19', '1 GIORNO'), '2026-11-19');
  assert.equal(calcolaFineContratto('2026-11-19', ''), '');
  assert.equal(calcolaFineContratto('2026-11-19', 'durata libera'), '');
});
