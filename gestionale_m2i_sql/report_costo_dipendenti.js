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
  }

  async function get(mese, anno) {
    const period = workflow.period('dipendente', mese, anno);
    const [rows, clientRows, f24] = await Promise.all([
      workflow.accountingRows('dipendente', period.mese, period.anno),
      workflow.lockedRows('cliente', period.mese, period.anno),
      knex('report_f24_dipendenti').where({ mese: period.mese, anno: period.anno }).first()
    ]);
    let nettiCent = 0, ccCent = 0, oreTotali = 0, nettiProvvisori = 0, nettiMancanti = 0;
    let oreLavorateEffettive = 0, oreFeriePermessiMalattia = 0;
    for (const row of rows) {
      const nettoBusta = row.nettoBusta;
      const netto = nettoBusta == null ? row.stipendioNetto : nettoBusta;
      if (netto == null || !Number.isFinite(Number(netto))) nettiMancanti++;
      else {
        nettiCent += Math.round(Number(netto) * 100);
        if (nettoBusta == null) nettiProvvisori++;
      }
      ccCent += Math.round(Number(row.cc || 0) * 100);
      const employeeHours = Number(row.oreLavorate || 0);
      const absences = Object.entries(row.dettaglioFPM || {});
      const allAbsenceHours = absences.reduce((sum, [, hours]) => sum + Number(hours || 0), 0);
      oreLavorateEffettive += Math.max(0, employeeHours - allAbsenceHours);
      oreFeriePermessiMalattia += absences.reduce((sum, [cause, hours]) =>
        sum + (/ferie|permess|malatt/i.test(cause) ? Number(hours || 0) : 0), 0);
      oreTotali += employeeHours;
    }
    const clientiConOre = clientRows.filter(row => Number(row.oreLavorate || 0) > 0);
    const imponibileClientiCent = clientiConOre.reduce((sum, row) =>
      sum + Math.round(Number(row.imponibile || 0) * 100), 0);
    const oreTariffaClienti = oreLavorateEffettive + oreFeriePermessiMalattia;
    const f24Cent = f24?.importo_cent ?? null;
    const costoCent = f24Cent == null ? null : nettiCent + ccCent + f24Cent;
    const costoOrarioCent = costoCent == null || oreTotali <= 0 || nettiMancanti ? null :
      Math.round(costoCent / oreTotali);
    const clientiDettaglio = clientRows.filter(row => Number(row.oreLavorate || 0) >= 1).map(row => {
      const oreCliente = Math.round(Number(row.oreLavorate) * 100) / 100;
      const imponibileCent = Math.round(Number(row.imponibile || 0) * 100);
      const tariffaCent = Math.round(imponibileCent / oreCliente);
      const costoDipendentiCent = costoOrarioCent == null ? null : Math.round(oreCliente * costoOrarioCent);
      const rimanenzaCent = costoDipendentiCent == null ? null : imponibileCent - costoDipendentiCent;
      return {
        id: String(row.idCliente), cliente: row.ragioneSociale || 'Cliente senza nome',
        ore: oreCliente, imponibile: imponibileCent / 100,
        tariffaOraria: tariffaCent / 100,
        costoOrarioDipendente: costoOrarioCent == null ? null : costoOrarioCent / 100,
        differenzaOraria: costoOrarioCent == null ? null : (tariffaCent - costoOrarioCent) / 100,
        costoDipendenti: costoDipendentiCent == null ? null : costoDipendentiCent / 100,
        rimanenza: rimanenzaCent == null ? null : rimanenzaCent / 100
      };
    });
    const imponibileDettaglioCent = clientiDettaglio.reduce((sum, row) => sum + Math.round(row.imponibile * 100), 0);
    const rimanenzaTotaleCent = costoOrarioCent == null ? null :
      clientiDettaglio.reduce((sum, row) => sum + Math.round(row.rimanenza * 100), 0);
    return {
      mese: period.mese, anno: period.anno, dipendenti: rows.length,
      totaleNetti: nettiCent / 100, totaleCc: ccCent / 100,
      f24: f24Cent == null ? null : f24Cent / 100,
      oreTotali: Math.round(oreTotali * 100) / 100,
      costoTotale: costoCent == null ? null : costoCent / 100,
      costoOrario: costoOrarioCent == null ? null : costoOrarioCent / 100,
      imponibileClienti: imponibileClientiCent / 100,
      clientiConOre: clientiConOre.length,
      clientiEsclusiZeroOre: clientRows.length - clientiConOre.length,
      oreLavorateEffettive: Math.round(oreLavorateEffettive * 100) / 100,
      oreFeriePermessiMalattia: Math.round(oreFeriePermessiMalattia * 100) / 100,
      oreTariffaClienti: Math.round(oreTariffaClienti * 100) / 100,
      tariffaMediaClienti: oreTariffaClienti > 0 ?
        Math.round(imponibileClientiCent / oreTariffaClienti) / 100 : null,
      imponibileDettaglio: imponibileDettaglioCent / 100,
      rimanenzaTotale: rimanenzaTotaleCent == null ? null : rimanenzaTotaleCent / 100,
      clientiDettaglio,
      nettiProvvisori, nettiMancanti
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

  return { initialize, get, saveF24 };
}

module.exports = { createEmployeeCostReport };
