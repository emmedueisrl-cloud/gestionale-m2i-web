import test from 'node:test';
import assert from 'node:assert/strict';
import { mesePredefinitoElaborati } from './mesePredefinitoElaborati.js';

test('preseleziona il mese precedente fino al giorno 9 e quello corrente dal 10', () => {
  assert.deepEqual(mesePredefinitoElaborati(new Date(2026, 9, 1)), { mese: 9, anno: 2026 });
  assert.deepEqual(mesePredefinitoElaborati(new Date(2026, 9, 9)), { mese: 9, anno: 2026 });
  assert.deepEqual(mesePredefinitoElaborati(new Date(2026, 9, 10)), { mese: 10, anno: 2026 });
  assert.deepEqual(mesePredefinitoElaborati(new Date(2026, 9, 15)), { mese: 10, anno: 2026 });
});

test('gestisce il passaggio da gennaio a dicembre dell’anno precedente', () => {
  assert.deepEqual(mesePredefinitoElaborati(new Date(2027, 0, 1)), { mese: 12, anno: 2026 });
  assert.deepEqual(mesePredefinitoElaborati(new Date(2027, 0, 9)), { mese: 12, anno: 2026 });
  assert.deepEqual(mesePredefinitoElaborati(new Date(2027, 0, 10)), { mese: 1, anno: 2027 });
});
