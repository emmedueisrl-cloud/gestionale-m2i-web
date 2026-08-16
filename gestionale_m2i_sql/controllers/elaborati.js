const { knex } = require('../db');

module.exports = {
  // ==========================================
  // DIPENDENTI
  // ==========================================
  async ottieniElaboratoMensile(mese, anno) {
    // Controllo se il mese è chiuso
    const chiuso = await knex('mesi_chiusi_dipendenti').where({ mese, anno }).first();
    
    if (chiuso) {
      // Carica dallo storico
      const rows = await knex('dettaglio_mesi_chiusi_dipendenti as d')
        .leftJoin('dipendenti as dip', 'd.dipendente_id', 'dip.id')
        .select('d.*', 'dip.iban')
        .where({ 'd.mese': mese, 'd.anno': anno })
        .andWhere(function() {
          this.where('dip.divisione', 'Esterno').orWhereNull('dip.divisione');
        });
      return {
        chiuso: true,
        dataChiusura: chiuso.data_chiusura,
        dati: rows.map(r => ({
          idDipendente: r.dipendente_id,
          cognomeNome: r.cognome_nome,
          iban: r.iban,
          pagaOraria: r.paga_oraria_reale,
          oreLavorate: r.ore_lavorate,
          pagaLavorato: r.paga_lavorato,
          pagaFPM: r.paga_ferie_permessi_malattia || 0,
          maggiorazioni: r.maggiorazioni,
          detrazioni: r.detrazioni,
          stipendioNetto: r.stipendio_netto,
          noteGenerali: r.note_generali || ""
        }))
      };
    }

    // Calcolo al volo
    const dip = await knex('dipendenti')
      .select('id', 'cognome', 'nome', 'paga_oraria_reale', 'tipo_paga', 'iban')
      .whereNot('stato', 'Cessato')
      .andWhere('cestinato', 0)
      .andWhere('divisione', 'Esterno');
      
    const rows = [];
    for (const d of dip) {
      const oreRecords = await knex('registro_ore')
        .select('causale_assenza')
        .sum('ore_totali as s')
        .where({ dipendente_id: d.id, mese, anno })
        .groupBy('causale_assenza');

      let oreLavorateOrd = 0;
      let oreFPM = 0;
      const dettaglioFPM = {}; // { 'Malattia': 8, 'Permesso': 4, ... }

      for (const rec of oreRecords) {
        const causale = (rec.causale_assenza || 'Ordinario').trim().toLowerCase();
        const causaleOriginale = (rec.causale_assenza || 'Ordinario').trim();
        if (causale === 'ordinario' || causale === 'straordinario' || causale === 'extra') {
          oreLavorateOrd += (rec.s || 0);
        } else {
          oreFPM += (rec.s || 0);
          dettaglioFPM[causaleOriginale] = (dettaglioFPM[causaleOriginale] || 0) + (rec.s || 0);
        }
      }
      
      const oreTotali = oreLavorateOrd + oreFPM;
      
      const reg = await knex('regolazioni_stipendi')
        .select('tipo', 'importo', 'motivazione')
        .where({ dipendente_id: d.id, mese, anno });
        
      let magg = 0, detr = 0;
      let noteMagg = [];
      let noteDetr = [];
      reg.forEach(r => {
        if (r.tipo === "Maggiorazione") {
          magg += r.importo;
          if (r.motivazione) noteMagg.push(r.motivazione);
        } else {
          detr += r.importo;
          if (r.motivazione) noteDetr.push(r.motivazione);
        }
      });

      const isMensile = (d.tipo_paga || '').toLowerCase() === 'mensile';

      let pagaLavorato, pagaFPM;
      const pagaReale = Number(d.paga_oraria_reale) || 0;
      if (isMensile) {
        // Paga mensile fissa: non dipende dalle ore lavorate
        // La paga FPM è proporzionale: (stipendio / ore_totali) * ore_fpm (se ci sono ore totali)
        pagaLavorato = pagaReale; // lo stipendio mensile
        pagaFPM = 0; // già incluso nel mensile
      } else {
        // Paga oraria: moltiplica le ore per la tariffa
        pagaLavorato = oreLavorateOrd * pagaReale;
        pagaFPM = oreFPM * pagaReale;
      }
      const totaleSpettante = pagaLavorato + pagaFPM + magg - detr;

      rows.push({
        idDipendente: d.id,
        cognomeNome: `${d.cognome} ${d.nome}`.toUpperCase(),
        iban: d.iban,
        pagaOraria: d.paga_oraria_reale,
        tipoPaga: d.tipo_paga || 'Oraria',
        oreLavorate: oreTotali,
        pagaLavorato: pagaLavorato,
        pagaFPM: pagaFPM,
        dettaglioFPM: dettaglioFPM,
        maggiorazioni: magg,
        detrazioni: detr,
        noteMaggiorazioni: noteMagg.join(" | "),
        noteDetrazioni: noteDetr.join(" | "),
        stipendioNetto: totaleSpettante,
        noteGenerali: ""
      });
    }
    return { chiuso: false, dati: rows };
  },

  async chiudiMeseDipendenti(mese, anno, datiElaborati) {
    const today = new Date().toISOString();
    await knex.transaction(async trx => {
      // Elimina eventuale storico precedente
      await trx('mesi_chiusi_dipendenti').where({ mese, anno }).del();
      await trx('dettaglio_mesi_chiusi_dipendenti').where({ mese, anno }).del();

      await trx('mesi_chiusi_dipendenti').insert({
        mese, anno, stato: "Chiuso", data_chiusura: today, chiuso_da: "LocalServer"
      });

      for (const d of datiElaborati) {
        await trx('dettaglio_mesi_chiusi_dipendenti').insert({
          mese, anno,
          dipendente_id: d.idDipendente,
          cognome_nome: d.cognomeNome,
          paga_oraria_reale: d.pagaOraria,
          ore_lavorate: d.oreLavorate,
          paga_lavorato: d.pagaLavorato,
          paga_ferie_permessi_malattia: d.pagaFPM || 0,
          maggiorazioni: d.maggiorazioni,
          detrazioni: d.detrazioni,
          stipendio_netto: d.stipendioNetto,
          data_chiusura: today,
          chiuso_da: "LocalServer"
        });
      }
    });
    await knex('log_attivita').insert({
      categoria: "Elaborati", icona: "🔒", colore: "#10b981",
      descrizione: `Chiuso elaborato Dipendenti per il mese di ${mese}/${anno}`, eseguito_da: "LocalServer"
    });
    return { success: true };
  },

  async sbloccaMeseDipendenti(mese, anno) {
    // Controllo giorni trascorsi dalla chiusura
    const chiuso = await knex('mesi_chiusi_dipendenti').where({ mese, anno }).first();
    if (!chiuso) return { success: true }; // Già aperto

    const closeDate = new Date(chiuso.data_chiusura);
    const now = new Date();
    const diffTime = Math.abs(now - closeDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
      throw new Error(`Non puoi sbloccare questo mese perché sono passati ${diffDays} giorni (limite 30 giorni).`);
    }

    await knex.transaction(async trx => {
      await trx('mesi_chiusi_dipendenti').where({ mese, anno }).del();
      await trx('dettaglio_mesi_chiusi_dipendenti').where({ mese, anno }).del();
    });
    await knex('log_attivita').insert({
      categoria: "Elaborati", icona: "🔓", colore: "#f59e0b",
      descrizione: `Sbloccato elaborato Dipendenti per il mese di ${mese}/${anno}`, eseguito_da: "LocalServer"
    });
    return { success: true };
  },

  // ==========================================
  // CLIENTI
  // ==========================================
  async ottieniElaboratoClienti(mese, anno) {
    const chiuso = await knex('mesi_chiusi_clienti').where({ mese, anno }).first();
    
    if (chiuso) {
      const rows = await knex('dettaglio_mesi_chiusi_clienti as d')
        .leftJoin('clienti as c', 'd.cliente_id', 'c.id')
        .select('d.*', 'c.tipo_tassazione', 'c.percentuale_tassazione')
        .where({ 'd.mese': mese, 'd.anno': anno });
      
      return {
        chiuso: true,
        dataChiusura: chiuso.data_chiusura,
        dati: rows.map(r => ({
          idCliente: r.cliente_id,
          ragioneSociale: r.ragione_sociale,
          oreLavorate: r.ore_lavorate,
          tariffaOraria: r.valore_contrattuale || 0,
          baseImponibile: r.base_imponibile,
          maggiorazioni: r.maggiorazioni,
          sconti: r.sconti,
          imponibile: r.imponibile,
          tipoTassazione: r.tipo_tassazione || 'IVA',
          percentualeTassazione: parseFloat(r.percentuale_tassazione) || 0,
          importoIva: r.importo_iva,
          importoTotale: r.importo_totale,
          note: r.note_generali || ""
        }))
      };
    }

    const cli = await knex('clienti')
      .select('id', 'ragione_sociale', 'tariffa_oraria_operatore', 'quotazione_tipo', 'quotazione_importo', 'tipo_tassazione', 'percentuale_tassazione')
      .where('attivo', 'SI');
      
    const rows = [];
    for (const c of cli) {
      const o = await knex('registro_ore')
        .sum('ore_totali as s')
        .where({ cliente_id: c.id, mese, anno })
        .first();
      const ore = o ? o.s || 0 : 0;
      
      const reg = await knex('regolazioni_clienti')
        .select('tipo', 'importo', 'motivazione')
        .where({ cliente_id: c.id, mese, anno });
        
      let magg = 0, sconti = 0;
      let noteMagg = [];
      let noteSconti = [];
      reg.forEach(r => {
        if (r.tipo === "Maggiorazione") {
          magg += r.importo;
          if (r.motivazione) noteMagg.push(r.motivazione);
        } else {
          sconti += r.importo;
          if (r.motivazione) noteSconti.push(r.motivazione);
        }
      });

      const tipoQuotazione = (c.quotazione_tipo || '').toLowerCase().trim();
      const isMensile = tipoQuotazione === 'mensile' || tipoQuotazione === 'fisso' || tipoQuotazione === 'mensile fisso';
      
      if (!tipoQuotazione) {
        console.warn(`[ELABORATO] Cliente ${c.ragione_sociale} (${c.id}): quotazione_tipo non definito, verrà trattato come ORARIO.`);
      } else if (!isMensile && tipoQuotazione !== 'orario' && tipoQuotazione !== 'oraria') {
        console.warn(`[ELABORATO] Cliente ${c.ragione_sociale} (${c.id}): quotazione_tipo='${c.quotazione_tipo}' non riconosciuto, verrà trattato come ORARIO.`);
      }

      let baseImponibile = 0;
      let tariffaOraria = 0;
      
      if (isMensile) {
        // Se mensile, l'imponibile è fisso, la tariffa oraria è calcolata a ritroso
        baseImponibile = c.quotazione_importo || 0;
        tariffaOraria = ore > 0 ? (baseImponibile / ore) : 0;
      } else {
        // Se oraria, la tariffa è fissa, l'imponibile si calcola dalle ore
        tariffaOraria = c.quotazione_importo || c.tariffa_oraria_operatore || 0;
        baseImponibile = ore * tariffaOraria;
      }

      const imponibile = baseImponibile + magg - sconti;

      // Calcolo tassazione in base al regime fiscale del cliente
      const tipoTassazione = (c.tipo_tassazione || 'IVA').toUpperCase().trim();
      const percTassazione = parseFloat(c.percentuale_tassazione) || 0;

      let importoIva = 0;
      let importoTotale = imponibile;

      if (tipoTassazione === 'REVERSE CHARGE') {
        // Reverse Charge: IVA = 0, totale = imponibile
        importoIva = 0;
        importoTotale = imponibile;
      } else if (tipoTassazione === 'TRAT. ACC.' || tipoTassazione === 'TRATTENUTA ACCONTO') {
        // Trattenuta acconto: si somma la percentuale
        importoIva = (imponibile * percTassazione / 100);
        importoTotale = imponibile + importoIva;
      } else {
        // IVA normale
        const aliquota = percTassazione > 0 ? percTassazione : 22;
        importoIva = imponibile * aliquota / 100;
        importoTotale = imponibile + importoIva;
      }

      rows.push({
        idCliente: c.id,
        ragioneSociale: c.ragione_sociale,
        oreLavorate: ore,
        tariffaOraria: tariffaOraria,
        baseImponibile: baseImponibile,
        maggiorazioni: magg,
        sconti: sconti,
        noteMaggiorazioni: noteMagg.join(" | "),
        noteSconti: noteSconti.join(" | "),
        imponibile: imponibile,
        tipoTassazione: c.tipo_tassazione || 'IVA',
        percentualeTassazione: parseFloat(c.percentuale_tassazione) || 0,
        importoIva: importoIva,
        importoTotale: importoTotale,
        note: ""
      });
    }
    return { chiuso: false, dati: rows };
  },

  async chiudiMeseClienti(mese, anno, datiElaborati) {
    const today = new Date().toISOString();
    await knex.transaction(async trx => {
      await trx('mesi_chiusi_clienti').where({ mese, anno }).del();
      await trx('dettaglio_mesi_chiusi_clienti').where({ mese, anno }).del();

      await trx('mesi_chiusi_clienti').insert({
        mese, anno, stato: "Chiuso", data_chiusura: today, chiuso_da: "LocalServer"
      });

      for (const d of datiElaborati) {
        await trx('dettaglio_mesi_chiusi_clienti').insert({
          mese, anno,
          cliente_id: d.idCliente,
          ragione_sociale: d.ragioneSociale,
          valore_contrattuale: d.tariffaOraria,
          ore_lavorate: d.oreLavorate,
          base_imponibile: d.baseImponibile,
          maggiorazioni: d.maggiorazioni,
          sconti: d.sconti,
          imponibile: d.imponibile,
          importo_iva: d.importoIva,
          importo_totale: d.importoTotale,
          data_chiusura: today,
          chiuso_da: "LocalServer"
        });
      }
    });
    await knex('log_attivita').insert({
      categoria: "Elaborati", icona: "🔒", colore: "#10b981",
      descrizione: `Chiuso elaborato Clienti per il mese di ${mese}/${anno}`, eseguito_da: "LocalServer"
    });
    return { success: true };
  },

  async sbloccaMeseClienti(mese, anno) {
    const chiuso = await knex('mesi_chiusi_clienti').where({ mese, anno }).first();
    if (!chiuso) return { success: true };

    const closeDate = new Date(chiuso.data_chiusura);
    const now = new Date();
    const diffTime = Math.abs(now - closeDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
      throw new Error(`Non puoi sbloccare questo mese perché sono passati ${diffDays} giorni (limite 30 giorni).`);
    }

    await knex.transaction(async trx => {
      await trx('mesi_chiusi_clienti').where({ mese, anno }).del();
      await trx('dettaglio_mesi_chiusi_clienti').where({ mese, anno }).del();
    });
    await knex('log_attivita').insert({
      categoria: "Elaborati", icona: "🔓", colore: "#f59e0b",
      descrizione: `Sbloccato elaborato Clienti per il mese di ${mese}/${anno}`, eseguito_da: "LocalServer"
    });
    return { success: true };
  },

  // ==========================================
  // PROVVIGIONI
  // ==========================================
  async ottieniElaboratoProvvigioni(mese, anno) {
    const clienti = await knex('clienti')
      .select('id', 'ragione_sociale', 'referente')
      .where('attivo', 'SI');
      
    const rows = [];
    
    for (const c of clienti) {
      const meseStr = String(mese).padStart(2, '0');
      const annoStr = String(anno);
      
      const invInfo = await knex('fatture')
        .sum('importo_imponibile as s')
        .where('cliente_id', c.id)
        .whereRaw("strftime('%m', data_fattura) = ?", [meseStr])
        .whereRaw("strftime('%Y', data_fattura) = ?", [annoStr])
        .first();
      const imponibile = invInfo ? invInfo.s || 0 : 0;

      const hourInfo = await knex('registro_ore')
        .sum('costo_totale as c')
        .where({ cliente_id: c.id, mese, anno })
        .first();
      const costo = hourInfo ? hourInfo.c || 0 : 0;
      const utile = imponibile - costo;

      const reg = await knex('regolazioni_provvigioni')
        .sum('regolazione_comm as rc')
        .sum('regolazione_oper as ro')
        .where({ cliente_id: c.id, mese, anno })
        .first();
      const regComm = reg ? reg.rc || 0 : 0;
      const regOper = reg ? reg.ro || 0 : 0;

      const percComm = 10.0;
      const percOper = 1.0;

      const provComm = (utile * percComm / 100) + regComm;
      const provOper = (utile * percOper / 100) + regOper;

      rows.push({
        idCliente: c.id,
        ragioneSociale: c.ragione_sociale.toUpperCase(),
        imponibile: imponibile,
        costoDipendenti: costo,
        utile: utile,
        commerciale: c.referente || "Senza Agente",
        percComm: percComm,
        regolazioneComm: regComm,
        provvigioneComm: provComm,
        operatore: "Gestore",
        percOper: percOper,
        regolazioneOper: regOper,
        provvigioneOper: provOper
      });
    }
    return rows;
  },

  async calendarioClienteOre(mese, anno, idCliente) {
    // Recupera tutti i record di registro_ore per quel cliente, con i dettagli del dipendente
    const records = await knex('registro_ore as r')
      .leftJoin('dipendenti as d', 'r.dipendente_id', 'd.id')
      .select('r.*', 'd.nome', 'd.cognome')
      .where({ 'r.mese': mese, 'r.anno': anno, 'r.cliente_id': idCliente });
    
    // Per restituire qualcosa di facile da usare lato frontend, riorganizziamo i dati per giorno
    // formattiamo in un array di 31 elementi
    const giorni = Array.from({ length: 31 }, () => []);
    
    records.forEach(row => {
      const operatore = row.dipendente_id ? `${row.cognome} ${row.nome}` : "Operatore Non Assegnato";
      for (let i = 1; i <= 31; i++) {
        const ore = row[`giorno_${i}`];
        if (ore && ore > 0) {
          giorni[i - 1].push({
            dipendente_id: row.dipendente_id,
            operatore: operatore,
            ore: ore
          });
        }
      }
    });

    return giorni;
  },

  // ==========================================
  // NOTE ELABORATI (Clienti e Dipendenti)
  // ==========================================

  async recuperaNoteElaborato(tipo, mese, anno) {
    // Ritorna tutte le note per un certo tipo (cliente/dipendente) e mese/anno
    return knex('note_elaborati')
      .where({ tipo, mese, anno })
      .select('soggetto_id', 'testo', 'data_modifica');
  },

  async salvaNoteElaborato(tipo, soggettoId, mese, anno, testo) {
    // INSERT OR REPLACE: crea o aggiorna la nota per quel soggetto/mese/anno
    await knex('note_elaborati')
      .insert({
        tipo,
        soggetto_id: soggettoId,
        mese,
        anno,
        testo: testo || '',
        data_modifica: new Date().toISOString()
      })
      .onConflict(['tipo', 'soggetto_id', 'mese', 'anno'])
      .merge({ testo: testo || '', data_modifica: new Date().toISOString() });
    await knex('log_attivita').insert({
      categoria: "Elaborati", icona: "📝", colore: "#3b82f6",
      descrizione: `Modificate note elaborato (${tipo}) per soggetto ${soggettoId} (${mese}/${anno})`, eseguito_da: "LocalServer"
    });
    return { success: true };
  }
};
