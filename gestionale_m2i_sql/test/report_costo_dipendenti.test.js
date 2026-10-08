const { test } = require('node:test');
const assert = require('node:assert/strict');
const knex = require('knex');
const { createEmployeeCostReport } = require('../report_costo_dipendenti');

test('report costo orario: somma netti, CC e F24 salvato e divide per le ore', async t => {
  const db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  let rows = [
    { nettoBusta: 1200, stipendioNetto: 1300, cc: 100, oreLavorate: 100,
      dettaglioFPM: { Ferie: 8, Assenza: 4 } },
    { nettoBusta: null, stipendioNetto: 800, cc: 50, oreLavorate: 100,
      dettaglioFPM: { Malattia: 10, 'Permesso Retribuito': 2 } }
  ];
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
    lockedRows: async () => clientRows
  };
  const report = createEmployeeCostReport(db, workflow);
  await report.initialize();
  const withoutF24 = await report.get(9, 2026);
  assert.equal(withoutF24.costoOrario, null);
  assert.equal(withoutF24.clientiDettaglio[0].costoDipendenti, null);
  assert.equal(withoutF24.imponibileDettaglio, 3920);
  assert.equal(withoutF24.rimanenzaTotale, null);
  const saved = await report.saveF24({ mese: 9, anno: 2026, importo: '850,00' });
  assert.equal(saved.totaleNetti, 2000);
  assert.equal(saved.totaleCc, 150);
  assert.equal(saved.f24, 850);
  assert.equal(saved.oreTotali, 200);
  assert.equal(saved.costoOrario, 15);
  assert.equal(saved.imponibileClienti, 3920);
  assert.equal(saved.clientiConOre, 2);
  assert.equal(saved.clientiEsclusiZeroOre, 1);
  assert.equal(saved.oreLavorateEffettive, 176);
  assert.equal(saved.oreFeriePermessiMalattia, 20);
  assert.equal(saved.oreTariffaClienti, 196);
  assert.equal(saved.tariffaMediaClienti, 20);
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
  clientRows.push({ idCliente: 'C4', ragioneSociale: 'Mezzora', oreLavorate: 0.5, imponibile: 50 });
  clientRows.push({ idCliente: 'C5', ragioneSociale: 'In perdita', oreLavorate: 20, imponibile: 200 });
  const withExtraClients = await report.get(9, 2026);
  assert.equal(withExtraClients.clientiDettaglio.some(row => row.id === 'C4'), false);
  assert.equal(withExtraClients.clientiDettaglio.find(row => row.id === 'C5').rimanenza, -100);
  assert.equal(withExtraClients.imponibileDettaglio, 4120);
  assert.equal(withExtraClients.rimanenzaTotale, 1270);
  assert.equal(saved.nettiProvvisori, 1);
  assert.equal((await report.get(9, 2026)).f24, 850);
  await report.saveF24({ mese: 9, anno: 2026, importo: '900.50' });
  assert.equal((await report.get(9, 2026)).f24, 900.5);
  assert.equal((await report.get(10, 2026)).f24, null);
  await assert.rejects(report.saveF24({ mese: 9, anno: 2026, importo: '-1' }), /F24/);
  await assert.rejects(report.saveF24({ mese: 9, anno: 2026, importo: '12,345' }), /F24/);
  rows = rows.map(row => ({ ...row, oreLavorate: 0, dettaglioFPM: {} }));
  assert.equal((await report.get(9, 2026)).costoOrario, null);
  assert.equal((await report.get(9, 2026)).tariffaMediaClienti, null);
});
