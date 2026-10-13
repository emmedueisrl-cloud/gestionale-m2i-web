import test from 'node:test';
import assert from 'node:assert/strict';
import { sortRows } from './sortRows.js';

test('ordina importi numerici e lascia i preventivi senza importo in fondo', () => {
  const rows = [{ importo: null }, { importo: 100 }, { importo: 9 }];
  assert.deepEqual(sortRows(rows, row => row.importo, 'asc', true).map(row => row.importo), [9, 100, null]);
  assert.deepEqual(sortRows(rows, row => row.importo, 'desc', true).map(row => row.importo), [100, 9, null]);
});

test('ordina date e numeri preventivo nel verso selezionato', () => {
  const rows = [{ numero: '2026-10', data: '2026-10-08' }, { numero: '2026-2', data: '2026-10-07' }];
  assert.deepEqual(sortRows(rows, row => row.numero).map(row => row.numero), ['2026-2', '2026-10']);
  assert.deepEqual(sortRows(rows, row => row.data, 'desc').map(row => row.data), ['2026-10-08', '2026-10-07']);
});
