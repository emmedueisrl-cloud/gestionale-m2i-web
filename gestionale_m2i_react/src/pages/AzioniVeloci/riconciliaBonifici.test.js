import test from 'node:test';
import assert from 'node:assert/strict';
import { leggiBonifici, suggerisciFatture } from './riconciliaBonifici.js';

test('legge più bonifici e non scambia la data della fattura per la data incasso', () => {
  const messages = leggiBonifici(`Importo: 338,00 €
Data valuta: OGGI
Descrizione: COD.DISP.: 0126111725596579 CASH NOTPROVIDED Saldo ft. FPR 596/26 del 02/10/2026
Bonifico a Vostro favore disposto da: MITT.: ASSOCIAZIONE SINDACALE DEI PROFESSI
BENEF.: M2I SRL
Importo: 414,00 €
IN CORSO
Data valuta: OGGI
Descrizione: Bonifico Istantaneo ricevuto: 0126111778340547 disposto da INTER CAR SRL in data 2026-11-17 alle ore 12.33`, '2026-11-18');
  assert.equal(messages.length, 2);
  assert.equal(messages[0].amount, 338);
  assert.equal(messages[0].date, '2026-11-18');
  assert.equal(messages[0].dateInferred, true);
  assert.equal(messages[0].disposition, '0126111725596579');
  assert.equal(messages[0].numero, 'fpr59626');
  assert.equal(messages[1].date, '2026-11-17');
  assert.equal(messages[1].payer, 'INTER CAR SRL');
});

test('suggerisce anche il cliente simile e mostra le fatture aperte dello stesso cliente', () => {
  const transfer = leggiBonifici('Importo: 378,00 €\nDescrizione: servizio di pulizie ottobre 2026 ft. 657/26\nBonifico disposto da: MITT.: RIMINI BAR SR', '2026-11-18')[0];
  const invoices = [
    { id: 1, clienteId: 1, cliente: 'RIMINI BAR SRL', numero: '657/26', periodo: '2026-10', residuo: 378, totale: 378, gestibile: true },
    { id: 2, clienteId: 1, cliente: 'RIMINI BAR SRL', numero: '658/26', periodo: '2026-11', residuo: 100, totale: 100, gestibile: true },
    { id: 3, clienteId: 2, cliente: 'Altro cliente', numero: '12/26', periodo: '2026-10', residuo: 378, totale: 378, gestibile: true },
    { id: 4, clienteId: 1, cliente: 'RIMINI BAR SRL', numero: '650/26', periodo: '2026-10', residuo: 0, totale: 100, gestibile: true }
  ];
  const result = suggerisciFatture(transfer, invoices);
  assert.equal(result.proposed.id, 1);
  assert.deepEqual(result.suggestions.filter(row => row.clienteId === 1).map(row => row.id).sort(), [1, 2]);
  assert.equal(result.open.some(row => row.id === 4), false);
});

test('propone insieme due fatture citate nello stesso bonifico', () => {
  const [transfer] = leggiBonifici(`Importo: 920,00 €
Data valuta: OGGI
Descrizione: COD. DISP.: 0126111373517215 CASH NOTPROVIDED SALDO FT N. 595 E N. 661
Bonifico a Vostro favore disposto da: MITT.: STUDIO ASSOCIATO ODONTOIATRICO BARN
BENEF.: M2I`, '2026-11-18');
  assert.deepEqual(transfer.numeri, ['595', '661']);
  const invoices = [
    { id: 1, clienteId: 7, cliente: 'STUDIO ASSOCIATO ODONTOIATRICO BARN', numero: '595', residuo: 500, totale: 500, gestibile: true },
    { id: 2, clienteId: 7, cliente: 'STUDIO ASSOCIATO ODONTOIATRICO BARN', numero: '661', residuo: 420, totale: 420, gestibile: true }
  ];
  assert.deepEqual(suggerisciFatture(transfer, invoices).proposedGroup.map(invoice => invoice.id), [1, 2]);
});
