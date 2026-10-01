import test from 'node:test';
import assert from 'node:assert/strict';
import { raggruppaPagamenti, totaleDaPagare, totalePagato } from './gruppiPagamenti.js';

test('separa i pagati dai non pagati senza nascondere i netti non positivi', () => {
  const rows = [
    { idDipendente: '1', stipendioNetto: 100, pagamento: null },
    { idDipendente: '2', stipendioNetto: 0, pagamento: null },
    { idDipendente: '3', stipendioNetto: -5, pagamento: null },
    { idDipendente: '4', stipendioNetto: 80, pagamento: { importo: 75 } }
  ];
  const { daPagare, pagati } = raggruppaPagamenti(rows);
  assert.deepEqual(daPagare.map(row => row.idDipendente), ['1', '2', '3']);
  assert.deepEqual(pagati.map(row => row.idDipendente), ['4']);
  assert.equal(totaleDaPagare(daPagare), 100);
  assert.equal(totalePagato(pagati), 75);
});
