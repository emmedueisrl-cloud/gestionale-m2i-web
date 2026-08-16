const { knex } = require('../db');

module.exports = {
  async recuperaDatiDashboard() {
    const tTot = await knex('dipendenti').count('* as c').first();
    const totali = tTot ? tTot.c : 0;
    
    const tAtt = await knex('dipendenti').count('* as c').whereNot('stato', 'Cessato').first();
    const attivi = tAtt ? tAtt.c : 0;
    
    const tPrv = await knex('dipendenti').count('* as c').where('stato', 'Prova').first();
    const prova = tPrv ? tPrv.c : 0;
    
    const tCes = await knex('dipendenti').count('* as c').where('stato', 'Cessato').first();
    const cessati = tCes ? tCes.c : 0;
    
    const scadenze = await knex('dipendenti')
      .select('id', 'cognome', 'nome', 'scadenza', 'ruolo')
      .whereNot('stato', 'Cessato')
      .whereNotNull('scadenza')
      .whereNot('scadenza', '');
    
    const dipList = await knex('dipendenti')
      .select('id', 'cognome', 'nome', 'allegato_documenti', 'allegato_contratto', 'iban')
      .whereNot('stato', 'Cessato');
      
    const checklist = dipList.map(d => ({
      id: d.id,
      nomeCompleto: `${d.cognome} ${d.nome}`.toUpperCase(),
      docsMancanti: [
        (!d.allegato_documenti ? "Documento Identità" : null),
        (!d.allegato_contratto ? "Contratto Firmato" : null),
        (!d.iban ? "IBAN Mancante" : null)
      ].filter(Boolean)
    })).filter(c => c.docsMancanti.length > 0);

    return {
      kpi: { totali, attivi, prova, cessati, scaduti: 0 },
      scadenze: scadenze.map(s => ({ id: s.id, dipendente: `${s.cognome} ${s.nome}`.toUpperCase(), scadenza: s.scadenza, ruolo: s.ruolo })),
      checklist: checklist
    };
  },

  async caricaKpiDashboard() {
    const tPrev = await knex('preventivi').count('* as c').first();
    const totaliPrev = tPrev ? tPrev.c : 0;
    
    const activeDips = await knex('dipendenti').whereNot('stato', 'Cessato');
    const activeClis = await knex('clienti').where('attivo', 'SI');
    const recentLogs = await knex('log_attivita').orderBy('id', 'desc').limit(5);

    // Fatturato e ore del mese precedente
    const dataRiferimento = new Date();
    dataRiferimento.setDate(1);
    dataRiferimento.setMonth(dataRiferimento.getMonth() - 1);
    const mesePrev = dataRiferimento.getMonth() + 1;
    const annoPrev = dataRiferimento.getFullYear();
    const mesiBase = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    const nomeMesePrecedente = mesiBase[dataRiferimento.getMonth()].toUpperCase();

    const fatturatoRow = await knex('dettaglio_mesi_chiusi_clienti')
      .where({ mese: mesePrev, anno: annoPrev })
      .sum('imponibile as totale')
      .first()
      .catch(() => ({ totale: null }));
    const totaleFatturato = fatturatoRow?.totale || 0;

    const oreRow = await knex('registro_ore')
      .where({ mese: mesePrev, anno: annoPrev })
      .sum('ore_totali as totale')
      .first()
      .catch(() => ({ totale: null }));
    const totaleOreMese = oreRow?.totale || 0;

    let countDeterminato = 0;
    let countIndeterminato = 0;
    let countProva = 0;
    let allertScadenze = [];
    let checklistDip = [];
    const oggi = new Date();

    activeDips.forEach(d => {
      const stato = d.stato || "";
      if (stato === "Determinato") countDeterminato++;
      else if (stato === "Indeterminato") countIndeterminato++;
      else if (stato === "Prova") countProva++;

      // Checklist dipendenti
      let docsMancanti = [];
      if (!d.allegato_documenti) docsMancanti.push("Documento Identità/CF");
      if (!d.iban) docsMancanti.push("Codice IBAN");
      if (!d.allegato_contratto) docsMancanti.push("Contratto Assunzione Firmato");
      
      if (docsMancanti.length > 0) {
        checklistDip.push({
          id: d.id,
          nomeCompleto: `${d.cognome} ${d.nome}`.toUpperCase(),
          documentiMancanti: docsMancanti
        });
      }

      // Scadenze contratti determinati
      if (stato === "Determinato" && typeof d.scadenza === 'string') {
        const parts = d.scadenza.split("-");
        let scadDate;
        if (parts.length === 3) {
          scadDate = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
          const partsSlash = d.scadenza.split("/");
          if (partsSlash.length === 3) {
            scadDate = new Date(partsSlash[2], partsSlash[1] - 1, partsSlash[0]);
          }
        }
        if (scadDate && !isNaN(scadDate.getTime())) {
          const diffTime = scadDate.getTime() - oggi.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 30) {
            allertScadenze.push({
              tipo: "Contratto Dipendente",
              oggetto: `${d.cognome} ${d.nome}`.toUpperCase(),
              scadenza: d.scadenza,
              giorniRimasti: diffDays
            });
          }
        }
      }
    });

    let checklistCli = [];
    activeClis.forEach(c => {
      if (!c.allegato_contratto_cliente) {
        checklistCli.push({
          id: c.id,
          ragioneSociale: (c.ragione_sociale || "Senza Nome").toUpperCase(),
          documentiMancanti: ["Contratto Cliente Firmato"]
        });
      }
    });

    const attivitaRecenti = recentLogs.map(l => {
      let dataFormattata = "";
      let dataCompleta = "";
      try {
        const utcTimestamp = l.timestamp.includes('Z') ? l.timestamp : l.timestamp.replace(' ', 'T') + 'Z';
        const d = new Date(utcTimestamp);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        dataFormattata = `${dd}/${mm} ${hh}:${min}`;
        dataCompleta = l.timestamp;
      } catch(e) {
        dataFormattata = "-";
        dataCompleta = "-";
      }

      return {
        icona: l.icona || "📝",
        colore: l.colore || "#6b7280",
        testo: l.descrizione || "",
        dataFormattata,
        dataCompleta,
        categoria: l.categoria || "",
        eseguitoDa: l.eseguito_da || "Sistema"
      };
    });

    return {
      dipendentiAttivi: activeDips.length,
      clientiAttivi: activeClis.length,
      preventiviTotali: totaliPrev,
      totaleFatturato,
      totaleOreMese,
      nomeMesePrecedente,
      scadenzeDipendenti: allertScadenze,
      checklistDipendenti: checklistDip,
      checklistClienti: checklistCli,
      countsContratti: {
        determinato: countDeterminato,
        indeterminato: countIndeterminato,
        prova: countProva
      },
      attivitaRecenti: attivitaRecenti
    };
  },

  async recuperaTuttiLogs(req, res) {
    // If called directly via API without req/res destructuring it gets args as array
    let page = 1;
    let limit = 50;
    
    // Check if arguments were passed
    if (Array.isArray(req) && req.length > 0) {
      page = req[0] || 1;
      limit = req[1] || 50;
    } else if (req && req.page) {
      page = req.page;
      limit = req.limit || 50;
    }

    const offset = (page - 1) * limit;

    const totalCountRes = await knex('log_attivita').count('id as count').first();
    const totalCount = totalCountRes ? totalCountRes.count : 0;

    const logs = await knex('log_attivita').orderBy('id', 'desc').limit(limit).offset(offset);
    const mappedLogs = logs.map(l => {
      let dataFormattata = "";
      let dataCompleta = "";
      try {
        // Il DB salva in UTC (CURRENT_TIMESTAMP). Aggiungiamo 'Z' per forzare il parsing come UTC in JS.
        const utcTimestamp = l.timestamp.includes('Z') ? l.timestamp : l.timestamp.replace(' ', 'T') + 'Z';
        const d = new Date(utcTimestamp);
        dataFormattata = d.toLocaleDateString('it-IT') + " " + d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
        dataCompleta = d.toISOString();
      } catch(e) {
        dataFormattata = "-";
        dataCompleta = "-";
      }

      return {
        id: l.id,
        icona: l.icona || "📝",
        colore: l.colore || "#6b7280",
        testo: l.descrizione || "",
        dataFormattata,
        dataCompleta,
        categoria: l.categoria || "",
        eseguitoDa: l.eseguito_da || "Sistema"
      };
    });

    return {
      logs: mappedLogs,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  },

  async svuotaLogSistema(password) {
    if (password !== '8989') {
      throw new Error("Password non valida per il reset dei log.");
    }
    await knex('log_attivita').del();
    return { success: true, message: "Log svuotati con successo." };
  }
};
