const { test } = require('node:test');
const assert = require('node:assert/strict');
const knex = require('knex');
const { createEmployeeCostReport } = require('../report_costo_dipendenti');

test('report costo orario: somma netti, CC e F24 salvato e divide per le ore', async t => {
  const db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  await db.schema.createTable('dipendenti', table => { table.text('id').primary(); });
  await db.schema.createTable('buste_paga', table => {
    table.text('id').primary(); table.text('dipendente_id'); table.text('mese'); table.text('anno');
    table.decimal('importo_netto', 14, 2);
  });
  await db('dipendenti').insert([{ id: 'D1' }, { id: 'D2' }, { id: 'D3' }]);
  await db('buste_paga').insert([
    { id: 'B1', dipendente_id: 'D1', mese: '9', anno: '2026', importo_netto: 1200 },
    { id: 'B2', dipendente_id: 'D2', mese: '9', anno: '2026', importo_netto: 800 }
  ]);
  let rows = [
    { idDipendente: 'D1', nettoBusta: 9999, stipendioNetto: 1300, cc: 100, oreLavorate: 100,
      dettaglioFPM: { Ferie: 8, Assenza: 4 } },
    { idDipendente: 'D2', nettoBusta: null, stipendioNetto: 900, cc: 50, oreLavorate: 100,
      dettaglioFPM: { Malattia: 10, 'Permesso Retribuito': 2 } }
  ];
  let monthlyRows = rows;
  const clientRows = [
    { idCliente: 'C1', ragioneSociale: 'Cliente Verde', oreLavorate: 120, imponibile: 3000 },
    { idCliente: 'C2', ragioneSociale: 'Cliente Rosso', oreLavorate: 50, imponibile: 920 },
    { idCliente: 'C3', ragioneSociale: 'Cliente Zero', oreLavorate: 0, imponibile: 9999 }
  ];
  const workflow = {
    period: (_, mese, anno) => {
      const m = Number(mese), y = Number(anno);
      if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y)) throw new Error('Periodo non valido.');
      return { mese: m, anno: y };
    },
    accountingRows: async () => rows,
    monthlyEmployeeRows: async () => monthlyRows,
    lockedRows: async () => clientRows
  };
  const report = createEmployeeCostReport(db, workflow);
  await report.initialize();
  const withoutF24 = await report.get(9, 2026);
  assert.equal(withoutF24.costoOrario, null);
  assert.equal(withoutF24.clientiDettaglio[0].costoDipendenti, null);
  assert.equal(withoutF24.imponibileDettaglio, 3920);
  assert.equal(withoutF24.rimanenzaTotale, null);
  const f24OnlyAdjustment = await report.addAdjustment({ mese: 9, anno: 2026, voce: 'f24',
    operazione: 'aggiungi', valore: '100', nota: 'F24 stimato nel report' });
  assert.equal(f24OnlyAdjustment.valoriBase.f24, null);
  assert.equal(f24OnlyAdjustment.f24, 100);
  assert.equal(f24OnlyAdjustment.costoOrario, 11.25);
  await report.deleteAdjustment({ mese: 9, anno: 2026, id: f24OnlyAdjustment.rettifiche[0].id });
  const saved = await report.saveF24({ mese: 9, anno: 2026, importo: '850,00' });
  assert.equal(saved.totaleNetti, 2000);
  assert.equal(saved.buste, 2);
  assert.equal(saved.totaleCc, 150);
  assert.equal(saved.f24, 850);
  assert.equal(saved.oreTotali, 200);
  assert.equal(saved.costoOrario, 15);
  assert.equal(saved.imponibileClienti, 3920);
  assert.equal(saved.clientiConOre, 2);
  assert.equal(saved.clientiEsclusiZeroOre, 1);
  assert.equal(saved.tariffaMediaClienti, 19.6);
  assert.deepEqual(saved.clientiDettaglio.map(row => row.id), ['C1', 'C2']);
  assert.deepEqual(saved.clientiDettaglio[0], {
    id: 'C1', cliente: 'Cliente Verde', ore: 120, imponibile: 3000,
    tariffaOraria: 25, costoOrarioDipendente: 15, differenzaOraria: 10,
    costoDipendenti: 1800, rimanenza: 1200
  });
  assert.equal(saved.clientiDettaglio[1].tariffaOraria, 18.4);
  assert.equal(saved.clientiDettaglio[1].costoDipendenti, 750);
  assert.equal(saved.clientiDettaglio[1].rimanenza, 170);
  assert.equal(saved.imponibileDettaglio, 3920);
  assert.equal(saved.rimanenzaTotale, 1370);
  let adjusted;
  for (const [voce, operazione, valore, nota] of [
    ['totaleNetti', 'aggiungi', '100', 'Conguaglio'],
    ['totaleNetti', 'aggiungi', '20', 'Seconda nota'],
    ['totaleCc', 'togli', '20', 'Correzione CC'],
    ['f24', 'aggiungi', '50', 'Quota F24'],
    ['oreTotali', 'aggiungi', '10', 'Ore integrative'],
    ['imponibileClienti', 'aggiungi', '200', 'Ricavo stimato']
  ]) adjusted = await report.addAdjustment({ mese: 9, anno: 2026, voce, operazione, valore, nota });
  assert.equal(adjusted.rettifiche.length, 6);
  assert.deepEqual(adjusted.rettifiche.filter(item => item.voce === 'totaleNetti').map(item => item.nota),
    ['Conguaglio', 'Seconda nota']);
  assert.equal(adjusted.totaleNetti, 2120);
  assert.equal(adjusted.totaleCc, 130);
  assert.equal(adjusted.f24, 900);
  assert.equal(adjusted.oreTotali, 210);
  assert.equal(adjusted.imponibileClienti, 4120);
  assert.equal(adjusted.costoTotale, 3150);
  assert.equal(adjusted.costoOrario, 15);
  assert.equal(adjusted.tariffaMediaClienti, 19.62);
  assert.equal(adjusted.imponibileDettaglio, 3920);
  assert.equal(adjusted.valoriBase.f24, 850);
  assert.equal((await db('buste_paga').where({ mese: '9', anno: '2026' }).sum({ totale: 'importo_netto' }).first()).totale, 2000);
  assert.equal((await db('report_f24_dipendenti').where({ mese: 9, anno: 2026 }).first()).importo_cent, 85000);
  assert.deepEqual((await report.get(10, 2026)).rettifiche, []);
  await assert.rejects(report.addAdjustment({ mese: 9, anno: 2026, voce: 'totaleNetti', operazione: 'aggiungi', valore: '10', nota: '' }), /nota/i);
  await assert.rejects(report.deleteAdjustment({ mese: 10, anno: 2026, id: adjusted.rettifiche[0].id }), /non trovata/i);
  for (const item of adjusted.rettifiche) await report.deleteAdjustment({ mese: 9, anno: 2026, id: item.id });
  const restored = await report.get(9, 2026);
  assert.deepEqual(restored.rettifiche, []);
  assert.equal(restored.costoOrario, saved.costoOrario);
  assert.equal(restored.tariffaMediaClienti, saved.tariffaMediaClienti);
  const changedHours = await report.saveClientAdjustment({ mese: 9, anno: 2026,
    clienteId: 'C1', voce: 'ore', valore: '100', nota: 'Ore corrette' });
  assert.equal(changedHours.oreTotali, 180);
  assert.equal(changedHours.costoOrario, 16.67);
  assert.equal(changedHours.clientiDettaglio[0].ore, 100);
  assert.equal(changedHours.clientiDettaglio[0].rimanenza, 1333);
  assert.equal(changedHours.rettificheClienti[0].differenza, -20);
  const changedAmount = await report.saveClientAdjustment({ mese: 9, anno: 2026,
    clienteId: 'C1', voce: 'imponibile', valore: '3200', nota: 'Imponibile corretto' });
  assert.equal(changedAmount.imponibileClienti, 4120);
  assert.equal(changedAmount.imponibileDettaglio, 4120);
  assert.equal(changedAmount.tariffaMediaClienti, 22.89);
  assert.equal(changedAmount.clientiDettaglio[0].imponibile, 3200);
  assert.equal(changedAmount.clientiDettaglio[0].rimanenza, 1533);
  assert.equal(changedAmount.rettificheClienti.find(item => item.voce === 'imponibile').differenza, 200);
  const zeroHours = await report.saveClientAdjustment({ mese: 9, anno: 2026,
    clienteId: 'C1', voce: 'ore', valore: '0', nota: 'Nessuna ora' });
  assert.equal(zeroHours.oreTotali, 80);
  assert.equal(zeroHours.imponibileClienti, 920);
  assert.equal(zeroHours.clientiDettaglio[0].ore, 0);
  assert.equal(zeroHours.clientiDettaglio[0].tariffaOraria, null);
  const editedNote = await report.saveClientAdjustment({ mese: 9, anno: 2026,
    clienteId: 'C1', voce: 'ore', valore: '95', nota: 'Nota modificata' });
  assert.equal(editedNote.oreTotali, 175);
  assert.equal(editedNote.rettificheClienti.filter(item => item.voce === 'ore').length, 1);
  assert.equal(editedNote.rettificheClienti.find(item => item.voce === 'ore').nota, 'Nota modificata');
  assert.deepEqual((await report.get(10, 2026)).rettificheClienti, []);
  assert.equal(clientRows[0].oreLavorate, 120);
  assert.equal(clientRows[0].imponibile, 3000);
  await report.deleteClientAdjustment({ mese: 9, anno: 2026, clienteId: 'C1', voce: 'ore' });
  await report.deleteClientAdjustment({ mese: 9, anno: 2026, clienteId: 'C1', voce: 'imponibile' });
  assert.equal((await report.get(9, 2026)).tariffaMediaClienti, saved.tariffaMediaClienti);
  clientRows.push({ idCliente: 'C4', ragioneSociale: 'Mezzora', oreLavorate: 0.5, imponibile: 50 });
  clientRows.push({ idCliente: 'C5', ragioneSociale: 'In perdita', oreLavorate: 20, imponibile: 200 });
  const withExtraClients = await report.get(9, 2026);
  assert.equal(withExtraClients.clientiDettaglio.some(row => row.id === 'C4'), false);
  assert.equal(withExtraClients.clientiDettaglio.find(row => row.id === 'C5').rimanenza, -100);
  assert.equal(withExtraClients.imponibileDettaglio, 4120);
  assert.equal(withExtraClients.rimanenzaTotale, 1270);
  await db('buste_paga').insert({ id: 'B3', dipendente_id: 'D3', mese: '9', anno: '2026', importo_netto: 1157 });
  const withUnmatchedPayroll = await report.get(9, 2026);
  assert.equal(withUnmatchedPayroll.totaleNetti, 3157);
  assert.equal(withUnmatchedPayroll.costoOrario, 20.79);
  monthlyRows = rows.map(row => ({ ...row, oreLavorate: row.oreLavorate + 10 }));
  const withMonthlyHours = await report.get(9, 2026);
  assert.equal(withMonthlyHours.oreTotali, 220);
  assert.equal(withMonthlyHours.totaleCc, 150);
  assert.equal(withMonthlyHours.costoOrario, 18.9);
  assert.equal(withMonthlyHours.tariffaMediaClienti, 18.95);
  monthlyRows = rows;
  assert.equal((await report.get(9, 2026)).f24, 850);
  await report.saveF24({ mese: 9, anno: 2026, importo: '900.50' });
  assert.equal((await report.get(9, 2026)).f24, 900.5);
  assert.equal((await report.get(10, 2026)).f24, null);
  await assert.rejects(report.saveF24({ mese: 9, anno: 2026, importo: '-1' }), /F24/);
  await assert.rejects(report.saveF24({ mese: 9, anno: 2026, importo: '12,345' }), /F24/);
  rows = rows.map(row => ({ ...row, oreLavorate: 0, dettaglioFPM: {} }));
  monthlyRows = rows;
  assert.equal((await report.get(9, 2026)).costoOrario, null);
  assert.equal((await report.get(9, 2026)).tariffaMediaClienti, null);
});
