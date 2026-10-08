const adjustmentFields = new Set(['totaleNetti', 'totaleCc', 'f24', 'oreTotali', 'imponibileClienti']);
const clientAdjustmentFields = new Set(['ore', 'imponibile']);

function createEmployeeCostReport(knex, workflow) {
  async function initialize() {
    if (!await knex.schema.hasTable('report_f24_dipendenti')) {
      await knex.schema.createTable('report_f24_dipendenti', table => {
        table.integer('mese').notNullable();
        table.integer('anno').notNullable();
        table.integer('importo_cent').notNullable();
        table.text('modificato_at').notNullable();
        table.primary(['mese', 'anno']);
      });
    }
    if (!await knex.schema.hasTable('report_rettifiche')) {
      await knex.schema.createTable('report_rettifiche', table => {
        table.increments('id').primary();
        table.integer('mese').notNullable();
        table.integer('anno').notNullable();
        table.text('voce').notNullable();
        table.integer('delta_cent').notNullable();
        table.text('nota').notNullable();
        table.text('creato_at').notNullable();
        table.index(['mese', 'anno']);
      });
    }
    if (!await knex.schema.hasTable('report_rettifiche_clienti')) {
      await knex.schema.createTable('report_rettifiche_clienti', table => {
        table.integer('mese').notNullable();
        table.integer('anno').notNullable();
        table.text('cliente_id').notNullable();
        table.text('voce').notNullable();
        table.integer('valore_cent').notNullable();
        table.text('nota').notNullable();
        table.text('modificato_at').notNullable();
        table.primary(['mese', 'anno', 'cliente_id', 'voce']);
      });
    }
  }

  async function get(mese, anno) {
    const period = workflow.period('dipendente', mese, anno);
    const [rows, monthlyRows, clientRows, payrollRows, f24, adjustments, clientAdjustments] = await Promise.all([
      workflow.accountingRows('dipendente', period.mese, period.anno),
      workflow.monthlyEmployeeRows(period.mese, period.anno),
      workflow.lockedRows('cliente', period.mese, period.anno),
      knex('buste_paga as b').join('dipendenti as d', 'b.dipendente_id', 'd.id')
        .select('b.dipendente_id', 'b.importo_netto')
        .where({ 'b.mese': String(period.mese), 'b.anno': String(period.anno) }),
      knex('report_f24_dipendenti').where({ mese: period.mese, anno: period.anno }).first(),
      knex('report_rettifiche').where({ mese: period.mese, anno: period.anno }).orderBy('id'),
      knex('report_rettifiche_clienti').where({ mese: period.mese, anno: period.anno })
    ]);
    const baseNettiCent = payrollRows.reduce((sum, row) => sum + Math.round(Number(row.importo_netto) * 100), 0);
    const baseCcCent = rows.reduce((sum, row) => sum + Math.round(Number(row.cc || 0) * 100), 0);
    const baseOreCent = Math.round(monthlyRows.reduce((sum, row) => sum + Number(row.oreLavorate || 0), 0) * 100);
    const baseImponibileClientiCent = clientRows.filter(row => Number(row.oreLavorate || 0) > 0).reduce((sum, row) =>
      sum + Math.round(Number(row.imponibile || 0) * 100), 0);
    const clientAdjustmentMap = new Map(clientAdjustments.map(row => [`${row.cliente_id}:${row.voce}`, row]));
    const adjustedClientRows = clientRows.map(row => {
      const id = String(row.idCliente);
      const baseOreCent = Math.round(Number(row.oreLavorate || 0) * 100);
      const baseImponibileCent = Math.round(Number(row.imponibile || 0) * 100);
      const oreAdjustment = clientAdjustmentMap.get(`${id}:ore`);
      const imponibileAdjustment = clientAdjustmentMap.get(`${id}:imponibile`);
      return { ...row, baseOreCent, baseImponibileCent,
        oreLavorate: (oreAdjustment ? Number(oreAdjustment.valore_cent) : baseOreCent) / 100,
        imponibile: (imponibileAdjustment ? Number(imponibileAdjustment.valore_cent) : baseImponibileCent) / 100 };
    });
    const adjustedClientsById = new Map(adjustedClientRows.map(row => [String(row.idCliente), row]));
    const clientiConOre = adjustedClientRows.filter(row => Number(row.oreLavorate || 0) > 0);
    const clientHoursDeltaCent = adjustedClientRows.reduce((sum, row) =>
      sum + Math.round(Number(row.oreLavorate || 0) * 100) - row.baseOreCent, 0);
    const baseF24Cent = f24?.importo_cent ?? null;
    const adjustmentTotals = Object.fromEntries([...adjustmentFields].map(field => [field, 0]));
    for (const adjustment of adjustments) adjustmentTotals[adjustment.voce] += Number(adjustment.delta_cent);
    const nettiCent = baseNettiCent + adjustmentTotals.totaleNetti;
    const ccCent = baseCcCent + adjustmentTotals.totaleCc;
    const oreTotali = (baseOreCent + adjustmentTotals.oreTotali + clientHoursDeltaCent) / 100;
    const imponibileClientiCent = clientiConOre.reduce((sum, row) =>
      sum + Math.round(Number(row.imponibile || 0) * 100), 0) + adjustmentTotals.imponibileClienti;
    const hasF24Adjustment = adjustments.some(adjustment => adjustment.voce === 'f24');
    const f24Cent = baseF24Cent == null && !hasF24Adjustment ? null : Number(baseF24Cent || 0) + adjustmentTotals.f24;
    const costoCent = f24Cent == null ? null : nettiCent + ccCent + f24Cent;
    const costoOrarioCent = costoCent == null || oreTotali <= 0 ? null :
      Math.round(costoCent / oreTotali);
    const clientiDettaglio = adjustedClientRows.filter(row => Number(row.oreLavorate || 0) >= 1 ||
      (row.baseOreCent >= 100 && clientAdjustmentMap.has(`${row.idCliente}:ore`))).map(row => {
      const oreCliente = Math.round(Number(row.oreLavorate) * 100) / 100;
      const imponibileCent = Math.round(Number(row.imponibile || 0) * 100);
      const tariffaCent = oreCliente > 0 ? Math.round(imponibileCent / oreCliente) : null;
      const costoDipendentiCent = costoOrarioCent == null ? null : Math.round(oreCliente * costoOrarioCent);
      const rimanenzaCent = costoDipendentiCent == null ? null : imponibileCent - costoDipendentiCent;
      return {
        id: String(row.idCliente), cliente: row.ragioneSociale || 'Cliente senza nome',
        ore: oreCliente, imponibile: imponibileCent / 100,
        tariffaOraria: tariffaCent == null ? null : tariffaCent / 100,
        costoOrarioDipendente: costoOrarioCent == null ? null : costoOrarioCent / 100,
        differenzaOraria: costoOrarioCent == null || tariffaCent == null ? null : (tariffaCent - costoOrarioCent) / 100,
        costoDipendenti: costoDipendentiCent == null ? null : costoDipendentiCent / 100,
        rimanenza: rimanenzaCent == null ? null : rimanenzaCent / 100
      };
    });
    const imponibileDettaglioCent = clientiDettaglio.reduce((sum, row) => sum + Math.round(row.imponibile * 100), 0);
    const rimanenzaTotaleCent = costoOrarioCent == null ? null :
      clientiDettaglio.reduce((sum, row) => sum + Math.round(row.rimanenza * 100), 0);
    return {
      mese: period.mese, anno: period.anno, dipendenti: monthlyRows.length,
      buste: payrollRows.length,
      totaleNetti: nettiCent / 100, totaleCc: ccCent / 100,
      f24: f24Cent == null ? null : f24Cent / 100,
      oreTotali,
      valoriBase: {
        totaleNetti: baseNettiCent / 100, totaleCc: baseCcCent / 100,
        f24: baseF24Cent == null ? null : baseF24Cent / 100,
        oreTotali: baseOreCent / 100, imponibileClienti: baseImponibileClientiCent / 100
      },
      rettifiche: adjustments.map(row => ({ id: row.id, voce: row.voce,
        valore: Number(row.delta_cent) / 100, nota: row.nota, creatoAt: row.creato_at })),
      costoTotale: costoCent == null ? null : costoCent / 100,
      costoOrario: costoOrarioCent == null ? null : costoOrarioCent / 100,
      imponibileClienti: imponibileClientiCent / 100,
      clientiConOre: clientiConOre.length,
      clientiEsclusiZeroOre: clientRows.length - clientiConOre.length,
      rettificheClienti: clientAdjustments.filter(item => adjustedClientsById.has(String(item.cliente_id))).map(item => {
        const client = adjustedClientsById.get(String(item.cliente_id));
        const baseCent = item.voce === 'ore' ? client?.baseOreCent : client?.baseImponibileCent;
        return { clienteId: String(item.cliente_id), cliente: client?.ragioneSociale || 'Cliente',
          voce: item.voce, valore: Number(item.valore_cent) / 100, valoreBase: (baseCent || 0) / 100,
          differenza: (Number(item.valore_cent) - (baseCent || 0)) / 100,
          nota: item.nota, modificatoAt: item.modificato_at };
      }),
      tariffaMediaClienti: oreTotali > 0 ?
        Math.round(imponibileClientiCent / oreTotali) / 100 : null,
      imponibileDettaglio: imponibileDettaglioCent / 100,
      rimanenzaTotale: rimanenzaTotaleCent == null ? null : rimanenzaTotaleCent / 100,
      clientiDettaglio
    };
  }

  async function saveF24({ mese, anno, importo }) {
    const period = workflow.period('dipendente', mese, anno);
    const value = String(importo ?? '').trim();
    if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(value)) {
      throw new Error('Inserisci l’importo F24 in euro, con massimo due decimali.');
    }
    const cents = Math.round(Number(value.replace(',', '.')) * 100);
    if (!Number.isSafeInteger(cents)) throw new Error('Importo F24 non valido.');
    await knex('report_f24_dipendenti').insert({ mese: period.mese, anno: period.anno,
      importo_cent: cents, modificato_at: new Date().toISOString() })
      .onConflict(['mese', 'anno']).merge(['importo_cent', 'modificato_at']);
    return get(period.mese, period.anno);
  }

  async function addAdjustment({ mese, anno, voce, operazione, valore, nota }) {
    const period = workflow.period('dipendente', mese, anno);
    if (!adjustmentFields.has(voce)) throw new Error('Voce del report non valida.');
    if (operazione !== 'aggiungi' && operazione !== 'togli') throw new Error('Scegli se aggiungere o togliere.');
    const amount = String(valore ?? '').trim();
    if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(amount)) throw new Error('Inserisci un importo o numero di ore valido, con massimo due decimali.');
    const cents = Math.round(Number(amount.replace(',', '.')) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('La rettifica deve essere maggiore di zero.');
    const note = String(nota ?? '').trim();
    if (!note || note.length > 500) throw new Error('Inserisci una nota di massimo 500 caratteri.');
    await knex('report_rettifiche').insert({ mese: period.mese, anno: period.anno,
      voce, delta_cent: operazione === 'togli' ? -cents : cents,
      nota: note, creato_at: new Date().toISOString() });
    return get(period.mese, period.anno);
  }

  async function deleteAdjustment({ mese, anno, id }) {
    const period = workflow.period('dipendente', mese, anno);
    const adjustmentId = Number(id);
    if (!Number.isSafeInteger(adjustmentId) || adjustmentId <= 0) throw new Error('Rettifica non valida.');
    const deleted = await knex('report_rettifiche').where({ id: adjustmentId,
      mese: period.mese, anno: period.anno }).del();
    if (!deleted) throw new Error('Rettifica non trovata per il mese selezionato.');
    return get(period.mese, period.anno);
  }

  async function saveClientAdjustment({ mese, anno, clienteId, voce, valore, nota }) {
    const period = workflow.period('cliente', mese, anno);
    if (!clientAdjustmentFields.has(voce)) throw new Error('Si possono rettificare solo ore e imponibile del cliente.');
    const id = String(clienteId ?? '');
    const clients = await workflow.lockedRows('cliente', period.mese, period.anno);
    if (!clients.some(row => String(row.idCliente) === id)) throw new Error('Cliente non presente nell’elaborato del mese.');
    const amount = String(valore ?? '').trim();
    if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(amount)) throw new Error('Inserisci un importo o numero di ore valido, con massimo due decimali.');
    const cents = Math.round(Number(amount.replace(',', '.')) * 100);
    if (!Number.isSafeInteger(cents)) throw new Error('Valore non valido.');
    const note = String(nota ?? '').trim();
    if (!note || note.length > 500) throw new Error('Inserisci una nota di massimo 500 caratteri.');
    await knex('report_rettifiche_clienti').insert({ mese: period.mese, anno: period.anno,
      cliente_id: id, voce, valore_cent: cents, nota: note, modificato_at: new Date().toISOString() })
      .onConflict(['mese', 'anno', 'cliente_id', 'voce']).merge(['valore_cent', 'nota', 'modificato_at']);
    return get(period.mese, period.anno);
  }

  async function deleteClientAdjustment({ mese, anno, clienteId, voce }) {
    const period = workflow.period('cliente', mese, anno);
    if (!clientAdjustmentFields.has(voce)) throw new Error('Voce del cliente non valida.');
    const deleted = await knex('report_rettifiche_clienti').where({ mese: period.mese,
      anno: period.anno, cliente_id: String(clienteId), voce }).del();
    if (!deleted) throw new Error('Rettifica del cliente non trovata.');
    return get(period.mese, period.anno);
  }

  return { initialize, get, saveF24, addAdjustment, deleteAdjustment,
    saveClientAdjustment, deleteClientAdjustment };
}

module.exports = { createEmployeeCostReport };
