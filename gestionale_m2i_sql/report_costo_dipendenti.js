const adjustmentFields = new Set(['totaleNetti', 'totaleCc', 'f24', 'oreTotali', 'imponibileClienti']);
const clientAdjustmentFields = new Set(['ore', 'imponibile']);
const employeeAdjustmentFields = new Set(['ore', 'netto']);
const { randomUUID } = require('node:crypto');
const workCauses = new Set(['ordinario', 'straordinario', 'extra']);

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
    if (!await knex.schema.hasTable('report_f24c_dipendenti')) {
      await knex.schema.createTable('report_f24c_dipendenti', table => {
        table.integer('mese').notNullable();
        table.integer('anno').notNullable();
        table.integer('importo_cent').notNullable();
        table.text('modificato_at').notNullable();
        table.primary(['mese', 'anno']);
      });
    }
    if (!await knex.schema.hasTable('report_rettifiche_dipendenti')) {
      await knex.schema.createTable('report_rettifiche_dipendenti', table => {
        table.integer('mese').notNullable();
        table.integer('anno').notNullable();
        table.text('dipendente_id').notNullable();
        table.text('voce').notNullable();
        table.integer('valore_cent').notNullable();
        table.text('nota').notNullable();
        table.text('modificato_at').notNullable();
        table.primary(['mese', 'anno', 'dipendente_id', 'voce']);
      });
    }
    if (!await knex.schema.hasTable('report_ore_abbinate')) {
      await knex.schema.createTable('report_ore_abbinate', table => {
        table.increments('id').primary();
        table.integer('mese').notNullable();
        table.integer('anno').notNullable();
        table.text('gruppo_id').notNullable();
        table.text('dipendente_id').notNullable();
        table.text('cliente_id').notNullable();
        table.integer('delta_cent').notNullable();
        table.text('nota').notNullable();
        table.text('creato_at').notNullable();
        table.index(['mese', 'anno', 'gruppo_id']);
      });
    }
  }

  async function get(mese, anno) {
    const period = workflow.period('dipendente', mese, anno);
    const [rows, monthlyRows, clientRows, payrollRows, f24, adjustments, clientAdjustments, f24c, hoursByClient, employeeAdjustments, pairedHours] = await Promise.all([
      workflow.accountingRows('dipendente', period.mese, period.anno),
      workflow.monthlyEmployeeRows(period.mese, period.anno),
      workflow.lockedRows('cliente', period.mese, period.anno),
      knex('buste_paga as b').join('dipendenti as d', 'b.dipendente_id', 'd.id')
        .select('b.dipendente_id', 'b.importo_netto')
        .where({ 'b.mese': String(period.mese), 'b.anno': String(period.anno) }),
      knex('report_f24_dipendenti').where({ mese: period.mese, anno: period.anno }).first(),
      knex('report_rettifiche').where({ mese: period.mese, anno: period.anno }).orderBy('id'),
      knex('report_rettifiche_clienti').where({ mese: period.mese, anno: period.anno }),
      knex('report_f24c_dipendenti').where({ mese: period.mese, anno: period.anno }).first(),
      knex('registro_ore').select('dipendente_id', 'cliente_id', 'ore_totali', 'causale_assenza')
        .where({ mese: period.mese, anno: period.anno }),
      knex('report_rettifiche_dipendenti').where({ mese: period.mese, anno: period.anno }),
      knex('report_ore_abbinate').where({ mese: period.mese, anno: period.anno }).orderBy('id')
    ]);
    const baseNettiCent = payrollRows.reduce((sum, row) => sum + Math.round(Number(row.importo_netto) * 100), 0);
    const baseCcCent = rows.reduce((sum, row) => sum + Math.round(Number(row.cc || 0) * 100), 0);
    const baseOreCent = Math.round(monthlyRows.reduce((sum, row) => sum + Number(row.oreLavorate || 0), 0) * 100);
    const payrollByEmployee = new Map();
    for (const row of payrollRows) {
      const id = String(row.dipendente_id);
      payrollByEmployee.set(id, (payrollByEmployee.get(id) || 0) + Math.round(Number(row.importo_netto || 0) * 100));
    }
    const illnessHoursByEmployee = new Map();
    for (const row of hoursByClient) {
      if (!String(row.causale_assenza || '').toLowerCase().includes('malatt')) continue;
      const id = String(row.dipendente_id);
      illnessHoursByEmployee.set(id, (illnessHoursByEmployee.get(id) || 0) + Math.round(Number(row.ore_totali || 0) * 100));
    }
    const employeeAdjustmentMap = new Map(employeeAdjustments.map(row => [`${row.dipendente_id}:${row.voce}`, row]));
    const pairedEmployeeDeltas = new Map(), pairedClientDeltas = new Map();
    for (const item of pairedHours) {
      const employeeId = String(item.dipendente_id), clientId = String(item.cliente_id);
      pairedEmployeeDeltas.set(employeeId, (pairedEmployeeDeltas.get(employeeId) || 0) + Number(item.delta_cent));
      pairedClientDeltas.set(clientId, (pairedClientDeltas.get(clientId) || 0) + Number(item.delta_cent));
    }
    const pairedTotalCent = [...pairedEmployeeDeltas.values()].reduce((sum, value) => sum + value, 0);
    const adjustedEmployeeRows = monthlyRows.map(row => {
      const id = String(row.idDipendente);
      const baseHoursCent = Math.round(Number(row.oreLavorate || 0) * 100);
      const baseNetCent = payrollByEmployee.get(id) || 0;
      const reportHoursCent = Number(employeeAdjustmentMap.get(`${id}:ore`)?.valore_cent ?? baseHoursCent) + (pairedEmployeeDeltas.get(id) || 0);
      const reportNetCent = Number(employeeAdjustmentMap.get(`${id}:netto`)?.valore_cent ?? baseNetCent);
      const illnessHoursCent = Math.min(Math.max(reportHoursCent, 0), illnessHoursByEmployee.get(id) || 0);
      const illnessCostCent = reportHoursCent > 0 ? Math.round(reportNetCent * illnessHoursCent / reportHoursCent) : 0;
      return { ...row, baseHoursCent, baseNetCent, reportHoursCent, reportNetCent,
        illnessHoursCent, illnessCostCent, productiveHoursCent: reportHoursCent - illnessHoursCent };
    });
    const illnessHoursCent = adjustedEmployeeRows.reduce((sum, row) => sum + row.illnessHoursCent, 0);
    const illnessCostCent = adjustedEmployeeRows.reduce((sum, row) => sum + row.illnessCostCent, 0);
    const employeeHoursDeltaCent = adjustedEmployeeRows.reduce((sum, row) => sum + row.reportHoursCent - row.baseHoursCent, 0);
    const employeeNetDeltaCent = adjustedEmployeeRows.reduce((sum, row) => sum + row.reportNetCent - row.baseNetCent, 0);
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
        oreLavorate: ((oreAdjustment ? Number(oreAdjustment.valore_cent) : baseOreCent) + (pairedClientDeltas.get(id) || 0)) / 100,
        imponibile: (imponibileAdjustment ? Number(imponibileAdjustment.valore_cent) : baseImponibileCent) / 100 };
    });
    const adjustedClientsById = new Map(adjustedClientRows.map(row => [String(row.idCliente), row]));
    const clientiConOre = adjustedClientRows.filter(row => Number(row.oreLavorate || 0) > 0);
    const clientHoursDeltaCent = adjustedClientRows.reduce((sum, row) =>
      sum + Math.round(Number(row.oreLavorate || 0) * 100) - row.baseOreCent, 0);
    const baseF24Cent = f24?.importo_cent ?? null;
    const adjustmentTotals = Object.fromEntries([...adjustmentFields].map(field => [field, 0]));
    for (const adjustment of adjustments) adjustmentTotals[adjustment.voce] += Number(adjustment.delta_cent);
    const nettiCent = baseNettiCent + adjustmentTotals.totaleNetti + employeeNetDeltaCent;
    const ccCent = baseCcCent + adjustmentTotals.totaleCc;
    const oreTotali = (baseOreCent + adjustmentTotals.oreTotali + clientHoursDeltaCent + employeeHoursDeltaCent - pairedTotalCent) / 100;
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
    const f24cCent = f24c?.importo_cent ?? null;
    const f24cWithIllnessCent = f24cCent == null ? null : Number(f24cCent) + illnessCostCent;
    const employeeAllocationHours = Math.max(0, oreTotali - illnessHoursCent / 100);
    const ccByEmployee = new Map(rows.map(row => [String(row.idDipendente), Math.round(Number(row.cc || 0) * 100)]));
    const clientTariffs = new Map(adjustedClientRows.filter(row => Number(row.oreLavorate || 0) > 0)
      .map(row => [String(row.idCliente), Math.round(Math.round(Number(row.imponibile || 0) * 100) / Number(row.oreLavorate))]));
    const employeeClientHours = new Map();
    for (const row of hoursByClient) {
      if (!String(row.cliente_id || '').trim() || !String(row.dipendente_id || '').trim()) continue;
      const cause = String(row.causale_assenza || 'Ordinario').trim().toLowerCase();
      if (!workCauses.has(cause)) continue;
      const employeeId = String(row.dipendente_id), clientId = String(row.cliente_id);
      if (!employeeClientHours.has(employeeId)) employeeClientHours.set(employeeId, new Map());
      const hours = employeeClientHours.get(employeeId);
      hours.set(clientId, (hours.get(clientId) || 0) + Number(row.ore_totali || 0));
    }
    for (const item of pairedHours) {
      const employeeId = String(item.dipendente_id), clientId = String(item.cliente_id);
      if (!employeeClientHours.has(employeeId)) employeeClientHours.set(employeeId, new Map());
      const hours = employeeClientHours.get(employeeId);
      hours.set(clientId, (hours.get(clientId) || 0) + Number(item.delta_cent) / 100);
    }
    const dipendentiDettaglio = adjustedEmployeeRows.filter(row => row.productiveHoursCent > 0).map(row => {
      const id = String(row.idDipendente);
      const oreDipendente = row.productiveHoursCent / 100;
      const nettoCent = row.reportNetCent;
      const ccDipendenteCent = ccByEmployee.get(id) || 0;
      const stipendioCent = nettoCent + ccDipendenteCent - row.illnessCostCent;
      const clientHours = employeeClientHours.get(id) || new Map();
      let valoreClientiCent = 0, oreClienti = 0;
      const clientiSenzaTariffa = [];
      for (const [clientId, hours] of clientHours) {
        if (hours <= 0) continue;
        oreClienti += hours;
        const tariffaCent = clientTariffs.get(clientId);
        if (tariffaCent == null) {
          clientiSenzaTariffa.push(adjustedClientsById.get(clientId)?.ragioneSociale || clientId);
          continue;
        }
        valoreClientiCent += Math.round(hours * tariffaCent);
      }
      const costoOrarioDipendenteCent = f24cWithIllnessCent == null || employeeAllocationHours <= 0 ? null :
        Math.round(f24cWithIllnessCent / employeeAllocationHours + stipendioCent / oreDipendente);
      const costoDipendenteCent = f24cWithIllnessCent == null || employeeAllocationHours <= 0 ? null :
        Math.round(stipendioCent + f24cWithIllnessCent * oreDipendente / employeeAllocationHours);
      const resaCent = costoDipendenteCent == null || clientiSenzaTariffa.length ? null :
        valoreClientiCent - costoDipendenteCent;
      return { id, dipendente: row.cognomeNome || id,
        ore: oreDipendente, oreTotaliConMalattia: row.reportHoursCent / 100,
        oreMalattia: row.illnessHoursCent / 100, quotaMalattia: row.illnessCostCent / 100,
        nettoBusta: nettoCent / 100, cc: ccDipendenteCent / 100,
        stipendio: stipendioCent / 100, oreClienti: Math.round(oreClienti * 100) / 100,
        valoreClienti: valoreClientiCent / 100,
        costoOrario: costoOrarioDipendenteCent == null ? null : costoOrarioDipendenteCent / 100,
        costoDipendente: costoDipendenteCent == null ? null : costoDipendenteCent / 100,
        resa: resaCent == null ? null : resaCent / 100, clientiSenzaTariffa };
    });
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
      rettificheDipendenti: employeeAdjustments.filter(item => adjustedEmployeeRows.some(row => String(row.idDipendente) === String(item.dipendente_id))).map(item => {
        const employee = adjustedEmployeeRows.find(row => String(row.idDipendente) === String(item.dipendente_id));
        const baseCent = item.voce === 'ore' ? employee.baseHoursCent : employee.baseNetCent;
        return { dipendenteId: String(item.dipendente_id), dipendente: employee.cognomeNome || String(item.dipendente_id),
          voce: item.voce, valore: Number(item.valore_cent) / 100, valoreBase: baseCent / 100,
          differenza: (Number(item.valore_cent) - baseCent) / 100,
          nota: item.nota, modificatoAt: item.modificato_at };
      }),
      abbinamentiOre: [...employeeClientHours].flatMap(([dipendenteId, clients]) => [...clients].map(([clienteId, hours]) => ({
        dipendenteId, clienteId, ore: Math.round(hours * 100) / 100 }))),
      rettificheOreAbbinate: [...new Map(pairedHours.map(item => [item.gruppo_id, item])).values()].map(item => ({
        id: item.gruppo_id, nota: item.nota, creatoAt: item.creato_at,
        abbinamenti: pairedHours.filter(row => row.gruppo_id === item.gruppo_id).map(row => ({
          dipendenteId: String(row.dipendente_id), clienteId: String(row.cliente_id), differenza: Number(row.delta_cent) / 100 }))
      })),
      tariffaMediaClienti: oreTotali > 0 ?
        Math.round(imponibileClientiCent / oreTotali) / 100 : null,
      imponibileDettaglio: imponibileDettaglioCent / 100,
      rimanenzaTotale: rimanenzaTotaleCent == null ? null : rimanenzaTotaleCent / 100,
      clientiDettaglio,
      f24c: f24cCent == null ? null : Number(f24cCent) / 100,
      costoMalattia: illnessCostCent / 100,
      oreMalattia: illnessHoursCent / 100,
      oreRipartizioneDipendenti: employeeAllocationHours,
      f24cConMalattia: f24cWithIllnessCent == null ? null : f24cWithIllnessCent / 100,
      dipendentiDettaglio
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

  async function saveF24c({ mese, anno, importo }) {
    const period = workflow.period('dipendente', mese, anno);
    const value = String(importo ?? '').trim();
    if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(value)) {
      throw new Error('Inserisci l’importo F24C in euro, con massimo due decimali.');
    }
    const cents = Math.round(Number(value.replace(',', '.')) * 100);
    if (!Number.isSafeInteger(cents)) throw new Error('Importo F24C non valido.');
    await knex('report_f24c_dipendenti').insert({ mese: period.mese, anno: period.anno,
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

  async function saveEmployeeAdjustment({ mese, anno, dipendenteId, voce, valore, nota }) {
    const period = workflow.period('dipendente', mese, anno);
    if (!employeeAdjustmentFields.has(voce)) throw new Error('Si possono rettificare solo ore e netto del dipendente.');
    const id = String(dipendenteId ?? '');
    const employees = await workflow.monthlyEmployeeRows(period.mese, period.anno);
    if (!employees.some(row => String(row.idDipendente) === id && Number(row.oreLavorate || 0) > 0)) {
      throw new Error('Dipendente non presente nella tabella del mese.');
    }
    const amount = String(valore ?? '').trim();
    if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(amount)) throw new Error('Inserisci un importo o numero di ore valido, con massimo due decimali.');
    const cents = Math.round(Number(amount.replace(',', '.')) * 100);
    if (!Number.isSafeInteger(cents)) throw new Error('Valore non valido.');
    const note = String(nota ?? '').trim();
    if (!note || note.length > 500) throw new Error('Inserisci una nota di massimo 500 caratteri.');
    await knex('report_rettifiche_dipendenti').insert({ mese: period.mese, anno: period.anno,
      dipendente_id: id, voce, valore_cent: cents, nota: note, modificato_at: new Date().toISOString() })
      .onConflict(['mese', 'anno', 'dipendente_id', 'voce']).merge(['valore_cent', 'nota', 'modificato_at']);
    return get(period.mese, period.anno);
  }

  async function deleteEmployeeAdjustment({ mese, anno, dipendenteId, voce }) {
    const period = workflow.period('dipendente', mese, anno);
    if (!employeeAdjustmentFields.has(voce)) throw new Error('Voce del dipendente non valida.');
    const deleted = await knex('report_rettifiche_dipendenti').where({ mese: period.mese,
      anno: period.anno, dipendente_id: String(dipendenteId), voce }).del();
    if (!deleted) throw new Error('Rettifica del dipendente non trovata.');
    return get(period.mese, period.anno);
  }

  async function savePairedHours({ mese, anno, origine, soggettoId, valore, abbinamenti, nota }) {
    const period = workflow.period('dipendente', mese, anno);
    if (!['cliente', 'dipendente'].includes(origine)) throw new Error('Origine della rettifica ore non valida.');
    const id = String(soggettoId ?? '');
    const amount = String(valore ?? '').trim();
    if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(amount)) throw new Error('Inserisci le ore totali con massimo due decimali.');
    const targetCent = Math.round(Number(amount.replace(',', '.')) * 100);
    const note = String(nota ?? '').trim();
    if (!note || note.length > 500) throw new Error('Inserisci una nota di massimo 500 caratteri.');
    const snapshot = await get(period.mese, period.anno);
    if (snapshot.rettificheClienti.some(item => item.voce === 'ore') ||
      snapshot.rettificheDipendenti.some(item => item.voce === 'ore')) {
      throw new Error('Elimina prima le vecchie rettifiche ore non abbinate visibili nei riquadri del Report.');
    }
    const originRows = origine === 'cliente' ? snapshot.clientiDettaglio : snapshot.dipendentiDettaglio;
    const origin = originRows.find(row => row.id === id);
    if (!origin) throw new Error('Riga non presente nella tabella del Report.');
    const currentCent = Math.round(Number(origin.ore) * 100);
    const difference = targetCent - currentCent;
    if (!difference) throw new Error('Inserisci un numero di ore diverso da quello attuale.');
    if (!Array.isArray(abbinamenti) || !abbinamenti.length) throw new Error('Indica a quali righe abbinare le ore.');
    const partnerRows = origine === 'cliente' ? snapshot.dipendentiDettaglio : snapshot.clientiDettaglio;
    const partners = new Map(partnerRows.map(row => [row.id, row]));
    const seen = new Set(), lines = [];
    let allocatedCent = 0;
    for (const item of abbinamenti) {
      const partnerId = String(item?.id ?? '');
      const hours = String(item?.ore ?? '').trim();
      if (!partners.has(partnerId) || seen.has(partnerId)) throw new Error('Abbinamento non valido o ripetuto.');
      seen.add(partnerId);
      if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(hours)) throw new Error('Indica ore valide per ogni abbinamento.');
      const cents = Math.round(Number(hours.replace(',', '.')) * 100);
      if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Le ore abbinate devono essere maggiori di zero.');
      allocatedCent += cents;
      const employeeId = origine === 'cliente' ? partnerId : id;
      const clientId = origine === 'cliente' ? id : partnerId;
      const pairCent = Math.round(Number(snapshot.abbinamentiOre.find(row => row.dipendenteId === employeeId && row.clienteId === clientId)?.ore || 0) * 100);
      if (difference < 0 && pairCent < cents) throw new Error('Non puoi sottrarre più ore di quelle attribuite al dipendente presso il cliente selezionato.');
      if (difference < 0 && Math.round(Number(partners.get(partnerId).ore) * 100) < cents) {
        throw new Error('Le ore del dipendente o cliente abbinato non possono diventare negative.');
      }
      lines.push({ employeeId, clientId, deltaCent: Math.sign(difference) * cents });
    }
    if (allocatedCent !== Math.abs(difference)) throw new Error('La somma delle ore abbinate deve coincidere con la differenza delle ore modificate.');
    const groupId = randomUUID(), createdAt = new Date().toISOString();
    await knex.transaction(async trx => {
      for (const line of lines) await trx('report_ore_abbinate').insert({ mese: period.mese, anno: period.anno,
        gruppo_id: groupId, dipendente_id: line.employeeId, cliente_id: line.clientId,
        delta_cent: line.deltaCent, nota: note, creato_at: createdAt });
    });
    return get(period.mese, period.anno);
  }

  async function deletePairedHours({ mese, anno, id }) {
    const period = workflow.period('dipendente', mese, anno);
    const group = await knex('report_ore_abbinate').where({ mese: period.mese, anno: period.anno, gruppo_id: String(id) });
    if (!group.length) throw new Error('Rettifica ore abbinata non trovata.');
    const snapshot = await get(period.mese, period.anno);
    for (const item of group) {
      const employeeId = String(item.dipendente_id), clientId = String(item.cliente_id);
      const pairCent = Math.round(Number(snapshot.abbinamentiOre.find(row => row.dipendenteId === employeeId && row.clienteId === clientId)?.ore || 0) * 100);
      if (pairCent - Number(item.delta_cent) < 0) throw new Error('Non puoi eliminare questa rettifica: togli prima le rettifiche successive che usano le stesse ore.');
    }
    const byEmployee = new Map(), byClient = new Map();
    for (const item of group) {
      const employeeId = String(item.dipendente_id), clientId = String(item.cliente_id);
      byEmployee.set(employeeId, (byEmployee.get(employeeId) || 0) + Number(item.delta_cent));
      byClient.set(clientId, (byClient.get(clientId) || 0) + Number(item.delta_cent));
    }
    for (const [employeeId, delta] of byEmployee) {
      if (Math.round(Number(snapshot.dipendentiDettaglio.find(row => row.id === employeeId)?.ore || 0) * 100) - delta < 0) {
        throw new Error('Non puoi eliminare questa rettifica: le ore del dipendente diventerebbero negative.');
      }
    }
    for (const [clientId, delta] of byClient) {
      if (Math.round(Number(snapshot.clientiDettaglio.find(row => row.id === clientId)?.ore || 0) * 100) - delta < 0) {
        throw new Error('Non puoi eliminare questa rettifica: le ore del cliente diventerebbero negative.');
      }
    }
    await knex('report_ore_abbinate').where({ mese: period.mese, anno: period.anno, gruppo_id: String(id) }).del();
    return get(period.mese, period.anno);
  }

  async function updatePairedHoursNote({ mese, anno, id, nota }) {
    const period = workflow.period('dipendente', mese, anno);
    const note = String(nota ?? '').trim();
    if (!note || note.length > 500) throw new Error('Inserisci una nota di massimo 500 caratteri.');
    const updated = await knex('report_ore_abbinate').where({ mese: period.mese, anno: period.anno,
      gruppo_id: String(id) }).update({ nota: note });
    if (!updated) throw new Error('Rettifica ore abbinata non trovata.');
    return get(period.mese, period.anno);
  }

  return { initialize, get, saveF24, saveF24c, addAdjustment, deleteAdjustment,
    saveClientAdjustment, deleteClientAdjustment, saveEmployeeAdjustment, deleteEmployeeAdjustment,
    savePairedHours, deletePairedHours, updatePairedHoursNote };
}

module.exports = { createEmployeeCostReport };
