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
  await db.schema.createTable('registro_ore', table => {
    table.integer('mese'); table.integer('anno'); table.text('dipendente_id'); table.text('cliente_id');
    table.decimal('ore_totali', 10, 2); table.text('causale_assenza');
  });
  await db('dipendenti').insert([{ id: 'D1' }, { id: 'D2' }, { id: 'D3' }]);
  await db('buste_paga').insert([
    { id: 'B1', dipendente_id: 'D1', mese: '9', anno: '2026', importo_netto: 1200 },
    { id: 'B2', dipendente_id: 'D2', mese: '9', anno: '2026', importo_netto: 800 }
  ]);
  await db('registro_ore').insert([
    { mese: 9, anno: 2026, dipendente_id: 'D1', cliente_id: 'C1', ore_totali: 60 },
    { mese: 9, anno: 2026, dipendente_id: 'D1', cliente_id: 'C2', ore_totali: 20, causale_assenza: 'Extra' },
    { mese: 9, anno: 2026, dipendente_id: 'D2', cliente_id: 'C1', ore_totali: 30 },
    { mese: 9, anno: 2026, dipendente_id: 'D2', cliente_id: 'C2', ore_totali: 20 },
    { mese: 9, anno: 2026, dipendente_id: 'D1', cliente_id: 'C1', ore_totali: 5, causale_assenza: 'Malattia' }
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
  assert.equal(withoutF24.dipendentiDettaglio[0].stipendio, 1300);
  assert.equal(withoutF24.dipendentiDettaglio[0].costoOrario, null);
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
  const withF24c = await report.saveF24c({ mese: 9, anno: 2026, importo: '400,00' });
  assert.equal(withF24c.f24c, 400);
  assert.deepEqual(withF24c.dipendentiDettaglio.map(row => [row.ore, row.stipendio, row.costoOrario, row.valoreClienti, row.resa]), [
    [100, 1300, 15, 1868, 368],
    [100, 850, 10.5, 1118, 68]
  ]);
  const pairedFromEmployee = await report.savePairedHours({ mese: 9, anno: 2026, origine: 'dipendente',
    soggettoId: 'D1', valore: '90', abbinamenti: [{ id: 'C1', ore: '5' }, { id: 'C2', ore: '5' }], nota: 'Ore ridotte' });
  assert.equal(pairedFromEmployee.oreTotali, 190);
  assert.equal(pairedFromEmployee.dipendentiDettaglio[0].ore, 90);
  assert.deepEqual(pairedFromEmployee.clientiDettaglio.map(row => row.ore), [115, 45]);
  assert.equal(pairedFromEmployee.abbinamentiOre.find(row => row.dipendenteId === 'D1' && row.clienteId === 'C1').ore, 55);
  assert.equal(pairedFromEmployee.rettificheOreAbbinate.length, 1);
  const pairedFromClient = await report.savePairedHours({ mese: 9, anno: 2026, origine: 'cliente',
    soggettoId: 'C1', valore: '110', abbinamenti: [{ id: 'D2', ore: '5' }], nota: 'Cliente ridotto' });
  assert.equal(pairedFromClient.oreTotali, 185);
  assert.equal(pairedFromClient.clientiDettaglio[0].ore, 110);
  assert.deepEqual(pairedFromClient.dipendentiDettaglio.map(row => row.ore), [90, 95]);
  assert.notEqual(pairedFromClient.dipendentiDettaglio[0].resa, withF24c.dipendentiDettaglio[0].resa);
  await assert.rejects(report.savePairedHours({ mese: 9, anno: 2026, origine: 'cliente',
    soggettoId: 'C1', valore: '100', abbinamenti: [{ id: 'D2', ore: '9' }], nota: 'Errore' }), /somma/i);
  await assert.rejects(report.savePairedHours({ mese: 9, anno: 2026, origine: 'dipendente',
    soggettoId: 'D1', valore: '30', abbinamenti: [{ id: 'C2', ore: '60' }], nota: 'Errore' }), /più ore/i);
  const firstPairedId = pairedFromEmployee.rettificheOreAbbinate[0].id;
  const secondPairedId = pairedFromClient.rettificheOreAbbinate[1].id;
  const editedPairedNote = await report.updatePairedHoursNote({ mese: 9, anno: 2026, id: firstPairedId, nota: 'Nota corretta' });
  assert.equal(editedPairedNote.rettificheOreAbbinate[0].nota, 'Nota corretta');
  await report.deletePairedHours({ mese: 9, anno: 2026, id: firstPairedId });
  const restoredPaired = await report.deletePairedHours({ mese: 9, anno: 2026, id: secondPairedId });
  assert.equal(restoredPaired.oreTotali, 200);
  assert.deepEqual(restoredPaired.clientiDettaglio.map(row => row.ore), [120, 50]);
  assert.deepEqual(restoredPaired.dipendentiDettaglio.map(row => row.ore), [100, 100]);
  assert.equal((await db('registro_ore').where({ dipendente_id: 'D1', cliente_id: 'C1' }).sum({ ore: 'ore_totali' }).first()).ore, 65);
  const changedEmployeeHours = await report.saveEmployeeAdjustment({ mese: 9, anno: 2026,
    dipendenteId: 'D1', voce: 'ore', valore: '110', nota: 'Ore complessive corrette' });
  assert.equal(changedEmployeeHours.oreTotali, 210);
  assert.equal(changedEmployeeHours.dipendentiDettaglio[0].ore, 110);
  assert.equal(changedEmployeeHours.rettificheDipendenti[0].differenza, 10);
  assert.equal(changedEmployeeHours.costoOrario, 14.29);
  const changedEmployeeNet = await report.saveEmployeeAdjustment({ mese: 9, anno: 2026,
    dipendenteId: 'D1', voce: 'netto', valore: '1250', nota: 'Netto corretto' });
  assert.equal(changedEmployeeNet.totaleNetti, 2050);
  assert.equal(changedEmployeeNet.costoTotale, 3050);
  assert.equal(changedEmployeeNet.dipendentiDettaglio[0].nettoBusta, 1250);
  assert.equal(changedEmployeeNet.dipendentiDettaglio[0].stipendio, 1350);
  assert.equal(changedEmployeeNet.dipendentiDettaglio[0].resa, 308.48);
  const editedEmployeeNote = await report.saveEmployeeAdjustment({ mese: 9, anno: 2026,
    dipendenteId: 'D1', voce: 'netto', valore: '1250', nota: 'Nota aggiornata' });
  assert.equal(editedEmployeeNote.rettificheDipendenti.length, 2);
  assert.equal(editedEmployeeNote.rettificheDipendenti.find(item => item.voce === 'netto').nota, 'Nota aggiornata');
  const zeroEmployeeHours = await report.saveEmployeeAdjustment({ mese: 9, anno: 2026,
    dipendenteId: 'D1', voce: 'ore', valore: '0', nota: 'Nessuna ora nel Report' });
  assert.equal(zeroEmployeeHours.oreTotali, 100);
  assert.deepEqual(zeroEmployeeHours.dipendentiDettaglio.map(row => row.id), ['D2']);
  assert.equal(zeroEmployeeHours.rettificheDipendenti.find(item => item.voce === 'ore').nota, 'Nessuna ora nel Report');
  assert.deepEqual((await report.get(10, 2026)).rettificheDipendenti, []);
  assert.equal((await db('buste_paga').where({ id: 'B1' }).first()).importo_netto, 1200);
  assert.equal(rows[0].oreLavorate, 100);
  await assert.rejects(report.saveEmployeeAdjustment({ mese: 9, anno: 2026,
    dipendenteId: 'D1', voce: 'ore', valore: '-1', nota: 'Non valido' }), /valido/i);
  await report.deleteEmployeeAdjustment({ mese: 9, anno: 2026, dipendenteId: 'D1', voce: 'ore' });
  const restoredEmployee = await report.deleteEmployeeAdjustment({ mese: 9, anno: 2026, dipendenteId: 'D1', voce: 'netto' });
  assert.equal(restoredEmployee.oreTotali, 200);
  assert.equal(restoredEmployee.totaleNetti, 2000);
  assert.deepEqual(restoredEmployee.rettificheDipendenti, []);
  assert.equal((await report.get(10, 2026)).f24c, null);
  assert.equal((await db('report_f24_dipendenti').where({ mese: 9, anno: 2026 }).first()).importo_cent, 85000);
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
  assert.equal(changedHours.dipendentiDettaglio[0].resa, 645.78);
  assert.equal(changedHours.rettificheClienti[0].differenza, -20);
  await assert.rejects(report.savePairedHours({ mese: 9, anno: 2026, origine: 'cliente',
    soggettoId: 'C1', valore: '95', abbinamenti: [{ id: 'D1', ore: '5' }], nota: 'Vecchia rettifica' }), /vecchie rettifiche/i);
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
  const withZeroHours = await report.get(9, 2026);
  assert.equal(withZeroHours.costoOrario, null);
  assert.deepEqual(withZeroHours.dipendentiDettaglio, []);
  assert.equal((await report.get(9, 2026)).tariffaMediaClienti, null);
  rows.push({ idDipendente: 'D4', cc: 40, oreLavorate: 50 });
  monthlyRows = rows;
  const withOneEmployee = await report.get(9, 2026);
  assert.deepEqual(withOneEmployee.dipendentiDettaglio.map(row => row.id), ['D4']);
  const withoutPayslip = withOneEmployee.dipendentiDettaglio[0];
  assert.equal(withoutPayslip.nettoBusta, 0);
  assert.equal(withoutPayslip.stipendio, 40);
  await db('registro_ore').insert({ mese: 9, anno: 2026, dipendente_id: 'D4',
    cliente_id: 'C_SCONOSCIUTO', ore_totali: 5 });
  const missingTariff = (await report.get(9, 2026)).dipendentiDettaglio.find(row => row.id === 'D4');
  assert.equal(missingTariff.resa, null);
  assert.deepEqual(missingTariff.clientiSenzaTariffa, ['C_SCONOSCIUTO']);
});
