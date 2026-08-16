const { knex, generaIDIncrementale, getVal } = require('../db');

module.exports = {
  async salvaFattura(dati) {
    const id = await generaIDIncrementale("fatture", "FT");
    const cliId = getVal(dati, "idCliente");
    const cli = await knex('clienti').select('ragione_sociale').where('id', cliId).first();
    const name = cli ? cli.ragione_sociale : "Cliente";
    
    const imponibile = parseFloat(getVal(dati, "importoImponibile")) || 0;
    const aliquota = parseFloat(getVal(dati, "aliquotaIva")) || 22.00;
    const iva = imponibile * aliquota / 100;
    const totale = imponibile + iva;

    await knex('fatture').insert({
      id,
      numero_fattura: getVal(dati, "numeroFattura"),
      data_fattura: getVal(dati, "dataFattura"),
      cliente_id: cliId,
      importo_imponibile: imponibile,
      aliquota_iva: aliquota,
      importo_iva: iva,
      importo_totale: totale,
      stato_pagamento: getVal(dati, "statoPagamento") || 'Da Pagare',
      note: getVal(dati, "note"),
      creato_da: "LocalServer"
    });

    await knex('log_attivita').insert({
      categoria: "Fatture",
      icona: "🧾",
      colore: "#8b5cf6",
      descrizione: `Generata fattura <b>${getVal(dati, "numeroFattura")}</b> per <b>${name.toUpperCase()}</b>`,
      eseguito_da: "LocalServer"
    });

    return id;
  },

  async recuperaDatiPagamenti() {
    const rows = await knex('fatture as f')
      .leftJoin('clienti as c', 'f.cliente_id', 'c.id')
      .select('f.*', 'c.ragione_sociale as clienteNome')
      .orderBy('f.data_fattura', 'desc');
    
    let totaleFatturato = 0;
    let totaleIncassato = 0;
    let totaleInsoluto = 0;
    let totalePendente = 0;
    const clientiSet = new Set();

    const fatture = rows.map(r => {
      const importoTot = r.importo_totale || 0;
      const importoPag = r.importo_pagato || 0;
      let stato = r.stato_pagamento || "Emessa";
      
      if (stato === "Da Pagare" || stato === "Emessa") {
        const dataFattura = new Date(r.data_fattura);
        const diffTime = Date.now() - dataFattura.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 30) {
          stato = "Insoluto";
        } else {
          stato = "Emessa";
        }
      }

      const ragSoc = r.clienteNome || "Sconosciuto";
      clientiSet.add(ragSoc);

      totaleFatturato += importoTot;
      totaleIncassato += importoPag;

      if (stato === "Insoluto") {
        totaleInsoluto += (importoTot - importoPag);
      } else if (stato === "Emessa" || stato === "Da Pagare" || stato === "Parzialmente Pagata") {
        totalePendente += (importoTot - importoPag);
      }

      return {
        id: r.id,
        idCliente: r.cliente_id,
        ragioneSociale: ragSoc,
        numeroFattura: r.numero_fattura,
        dataFattura: r.data_fattura,
        importoTotale: importoTot,
        statoPagamento: stato,
        runtimeStato: stato,
        dataScadenza: r.data_scadenza,
        dataPagamento: r.data_pagamento,
        importoPagato: importoPag,
        allegatoFattura: r.allegato_fattura || "",
        note: r.note || ""
      };
    });

    return {
      fatture: fatture,
      clienti: Array.from(clientiSet).sort(),
      kpi: {
        totaleFatturato: totaleFatturato,
        totaleIncassato: totaleIncassato,
        totaleInsoluto: totaleInsoluto,
        totalePendente: totalePendente
      }
    };
  },

  async registraIncassoServer(idFattura, dataPagamento, importoIncassato) {
    const fatt = await knex('fatture').select('importo_totale', 'importo_pagato').where('id', idFattura).first();
    if (!fatt) throw new Error("Fattura non trovata.");
    
    const importoPagatoFinale = (fatt.importo_pagato || 0) + parseFloat(importoIncassato);
    const stato = importoPagatoFinale >= fatt.importo_totale ? "Pagata" : "Parzialmente Pagata";
    
    await knex('fatture')
      .where('id', idFattura)
      .update({
        importo_pagato: importoPagatoFinale,
        data_pagamento: dataPagamento,
        stato_pagamento: stato
      });
      
    await knex('log_attivita').insert({
      categoria: "Fatture", icona: "💶", colore: "#10b981",
      descrizione: `Registrato incasso di €${importoIncassato} per fattura ${idFattura}. Stato: ${stato}`, eseguito_da: "LocalServer"
    });

    return true;
  },

  async segnalaInsolutoServer(idFattura) {
    await knex('fatture').where('id', idFattura).update({ stato_pagamento: 'Insoluto' });
    await knex('log_attivita').insert({
      categoria: "Fatture", icona: "⚠️", colore: "#ef4444",
      descrizione: `Fattura ${idFattura} contrassegnata come Insoluta`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async recuperaFatture(mese, anno) {
    let query = knex('fatture as f')
      .leftJoin('clienti as c', 'f.cliente_id', 'c.id')
      .select('f.*', 'c.ragione_sociale as clienteNome')
      .orderBy('f.data_fattura', 'desc');
      
    if (anno) {
      query = query.whereRaw("strftime('%Y', f.data_fattura) = ?", [anno.toString()]);
    }
    if (mese) {
      const meseStr = mese.toString().padStart(2, '0');
      query = query.whereRaw("strftime('%m', f.data_fattura) = ?", [meseStr]);
    }
    
    const rows = await query;
    return rows.map(r => {
      let stato = r.stato_pagamento || "Emessa";
      if (stato === "Da Pagare" || stato === "Emessa") {
        const dataFattura = new Date(r.data_fattura);
        const diffTime = Date.now() - dataFattura.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 30) {
          stato = "Insoluto";
        } else {
          stato = "Emessa";
        }
      }
      return { ...r, stato_pagamento: stato };
    });
  },

  async aggiornaStatoFattura(idFattura, stato) {
    await knex('fatture')
      .where('id', idFattura)
      .update({ stato_pagamento: stato });
    await knex('log_attivita').insert({
      categoria: "Fatture", icona: "📝", colore: "#3b82f6",
      descrizione: `Modificato stato fattura ${idFattura} in: ${stato}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async eliminaFattureMulti(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const deletedCount = await knex('fatture').whereIn('id', ids).delete();
    await knex('log_attivita').insert({
      categoria: "Fatture", icona: "🗑️", colore: "#ef4444",
      descrizione: `Eliminate ${deletedCount} fatture.`, eseguito_da: "LocalServer"
    });
    return deletedCount;
  }
};
