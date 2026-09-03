const { knex, getVal } = require('../db');

module.exports = {
  async recuperaOreMensili(idDipendente, mese, anno) {
    const rows = await knex('registro_ore as r')
      .leftJoin('clienti as c', 'r.cliente_id', 'c.id')
      .select('r.*', 'c.ragione_sociale as clienteNome')
      .where({
        'r.dipendente_id': idDipendente,
        'r.mese': mese,
        'r.anno': anno
      });

    let metodo = null;
    if (rows.length > 0) {
      metodo = rows[0].metodo_inserimento || 'Calendarizzata';
    }

    const righe = rows.map(r => {
      const entry = {
        id: r.id,
        idCliente: r.cliente_id,
        cliente: r.clienteNome || "Nessuno",
        causale: r.causale_assenza || "Ordinario",
        note: r.note || "",
        giorni: [],
        ore_totali: r.ore_totali || 0
      };
      for (let i = 1; i <= 31; i++) {
        entry.giorni.push(r[`giorno_${i}`] || 0);
      }
      return entry;
    });
    
    return { metodo, righe };
  },

  async svuotaRegistroOreMensili(idDipendente, mese, anno) {
    await knex('registro_ore')
      .where({ dipendente_id: idDipendente, mese, anno })
      .del();
    await knex('log_attivita').insert({
      categoria: "Ore Mensili", icona: "🗑️", colore: "#ef4444",
      descrizione: `Svuotato registro ore di ${mese}/${anno} per dipendente ${idDipendente}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async salvaRegistroOreMensili(dati) {
    return this.salvaPresenzeMensili(dati);
  },

  async salvaPresenzeMensili(dati) {
    const idDipendente = getVal(dati, "idDipendente");
    const mese = parseInt(getVal(dati, "mese"), 10);
    const anno = parseInt(getVal(dati, "anno"), 10);
    const righe = getVal(dati, "righe") || [];
    const metodoInserimento = getVal(dati, "metodoInserimento") || 'Calendarizzata';
    
    await knex('registro_ore')
      .where({ dipendente_id: idDipendente, mese, anno })
      .del();

    const dipInfo = await knex('dipendenti').select('paga_oraria_reale').where('id', idDipendente).first();
    const pagaOraria = dipInfo ? dipInfo.paga_oraria_reale : 0;

    for (const r of righe) {
      const dbRow = {
        mese,
        anno,
        dipendente_id: idDipendente,
        cliente_id: r.idCliente || null,
        causale_assenza: r.causale || null,
        note: r.note || "",
        metodo_inserimento: metodoInserimento,
        ore_totali: 0,
        costo_totale: 0
      };
      
      let oreTot = 0;
      if (metodoInserimento === 'Mensile Totale') {
        oreTot = parseFloat(r.ore_totali) || 0;
      } else {
        for (let i = 1; i <= 31; i++) {
          const oreGiorno = parseFloat(r.giorni[i - 1]) || 0;
          dbRow[`giorno_${i}`] = oreGiorno;
          oreTot += oreGiorno;
        }
      }
      
      dbRow.ore_totali = oreTot;
      dbRow.costo_totale = oreTot * pagaOraria;

      await knex('registro_ore').insert(dbRow);
    }
    await knex('log_attivita').insert({
      categoria: "Ore Mensili", icona: "⏰", colore: "#3b82f6",
      descrizione: `Salvate ore mensili (${metodoInserimento}) di ${mese}/${anno} per dipendente ${idDipendente}`, eseguito_da: "LocalServer"
    });

    return true;
  },

  async precompilaDaProgrammaFisso(idDipendente, mese, anno) {
    const prog = await knex('programma_fisso').where('dipendente_id', idDipendente);
    if (prog.length === 0) return [];

    const mapGiorni = { "Lunedì": 1, "Martedì": 2, "Mercoledì": 3, "Giovedì": 4, "Venerdì": 5, "Sabato": 6, "Domenica": 7 };
    const numGiorniMese = new Date(anno, mese, 0).getDate();
    const result = {};

    for (const p of prog) {
      const targetGiorno = mapGiorni[p.giorno_settimana];
      if (!targetGiorno) continue;

      const cliInfo = await knex('clienti').select('ragione_sociale').where('id', p.cliente_id).first();
      const key = `${p.cliente_id}_Ordinario`;
      if (!result[key]) {
        result[key] = {
          idCliente: p.cliente_id,
          cliente: cliInfo ? cliInfo.ragione_sociale.toUpperCase() : "Sconosciuto",
          causale: "Ordinario",
          note: "Da programma fisso",
          giorni: Array(31).fill(0)
        };
      }

      const iniParts = (p.ora_inizio || "00:00").split(':');
      const finParts = (p.ora_fine || "00:00").split(':');
      const hIni = Number(iniParts[0]) || 0;
      const mIni = Number(iniParts[1]) || 0;
      const hFin = Number(finParts[0]) || 0;
      const mFin = Number(finParts[1]) || 0;
      const ore = (hFin + mFin/60) - (hIni + mIni/60);

      for (let g = 1; g <= numGiorniMese; g++) {
        const d = new Date(anno, mese - 1, g);
        let dayOfWeek = d.getDay();
        if (dayOfWeek === 0) dayOfWeek = 7;
        
        if (dayOfWeek === targetGiorno) {
          result[key].giorni[g - 1] = ore;
        }
      }
    }

    return Object.values(result);
  },

  async recuperaDatiProgramma(idDipendente) {
    const prog = await knex('programma_fisso as p')
      .leftJoin('clienti as c', 'p.cliente_id', 'c.id')
      .select('p.*', 'c.ragione_sociale as clienteNome')
      .where('p.dipendente_id', idDipendente);
      
    return prog.map(p => ({
      id: p.id,
      giornoSettimana: p.giorno_settimana,
      oraInizio: p.ora_inizio,
      oraFine: p.ora_fine,
      idCliente: p.cliente_id,
      cliente: p.clienteNome || "Nessuno",
      frequenza: p.frequenza || "Settimanale",
      note: p.note || ""
    }));
  },

  async salvaProgrammaFisso(dati) {
    const idDipendente = getVal(dati, "idDipendente");
    const impegni = getVal(dati, "impegni") || [];
    
    await knex('programma_fisso').where('dipendente_id', idDipendente).del();
    
    const rowsToInsert = impegni.map(imp => ({
      dipendente_id: idDipendente,
      giorno_settimana: imp.giornoSettimana,
      ora_inizio: imp.oraInizio,
      ora_fine: imp.oraFine,
      cliente_id: imp.idCliente,
      frequenza: imp.frequenza || 'Settimanale',
      note: imp.note
    }));
    
    if (rowsToInsert.length > 0) {
      await knex('programma_fisso').insert(rowsToInsert);
    }
    await knex('log_attivita').insert({
      categoria: "Ore Mensili", icona: "⚙️", colore: "#f59e0b",
      descrizione: `Aggiornato programma fisso settimanale per dipendente ${idDipendente}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async recuperaDatiAgenda(idDipendente, dataLunedi) {
    const start = new Date(dataLunedi);
    const dateArray = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateArray.push(`${year}-${month}-${day}`);
    }

    const rows = await knex('agenda_caposquadra as a')
      .leftJoin('clienti as c', 'a.cliente_id', 'c.id')
      .select('a.*', 'c.ragione_sociale as clienteNome')
      .where('a.dipendente_id', idDipendente)
      .whereIn('a.data', dateArray);
      
    return rows.map(r => ({
      id: r.id,
      data: r.data,
      oraInizio: r.ora_inizio,
      oraFine: r.ora_fine,
      idCliente: r.cliente_id,
      cliente: r.clienteNome || r.note || "Servizio",
      colore: r.colore,
      note: r.note || ""
    }));
  },

  async salvaImpegnoAgenda(imp) {
    await knex('agenda_caposquadra').insert({
      dipendente_id: imp.idDipendente,
      data: imp.data,
      ora_inizio: imp.oraInizio,
      ora_fine: imp.oraFine,
      cliente_id: imp.idCliente || null,
      colore: imp.colore,
      note: imp.note
    });
    await knex('log_attivita').insert({
      categoria: "Agenda", icona: "📅", colore: "#8b5cf6",
      descrizione: `Aggiunto impegno in agenda il ${imp.data} per dipendente ${imp.idDipendente}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async eliminaImpegnoAgenda(idImpegno) {
    await knex('agenda_caposquadra').where('id', idImpegno).del();
    await knex('log_attivita').insert({
      categoria: "Agenda", icona: "🗑️", colore: "#ef4444",
      descrizione: `Eliminato impegno in agenda ID: ${idImpegno}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async svuotaSettimanaAgenda(idDipendente, dataInizioSettimana) {
    const start = new Date(dataInizioSettimana);
    const dateArray = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateArray.push(`${year}-${month}-${day}`);
    }

    await knex('agenda_caposquadra')
      .where('dipendente_id', idDipendente)
      .whereIn('data', dateArray)
      .del();

    await knex('log_attivita').insert({
      categoria: "Agenda", icona: "🗑️", colore: "#ef4444",
      descrizione: `Svuotata settimana agenda (dal ${dataInizioSettimana}) per dipendente ${idDipendente}`, eseguito_da: "LocalServer"
    });

    return true;
  },

  async importaProgrammaFissoAgenda(idDipendente, dataInizioSettimana) {
    const prog = await knex('programma_fisso').where('dipendente_id', idDipendente);
    if (prog.length === 0) return true;

    // Normalizziamo le chiavi togliendo accenti e maiuscole per maggiore sicurezza
    const normalizeDay = (d) => d.toLowerCase().replace(/ì/g, 'i').trim();
    const mapGiorni = { "lunedi": 0, "martedi": 1, "mercoledi": 2, "giovedi": 3, "venerdi": 4, "sabato": 5, "domenica": 6 };

    const start = new Date(dataInizioSettimana);
    const rowsToInsert = [];

    for (const p of prog) {
      const dayKey = normalizeDay(p.giorno_settimana);
      const offset = mapGiorni[dayKey];
      
      if (offset !== undefined) {
        const d = new Date(start);
        d.setDate(start.getDate() + offset);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dataStr = `${year}-${month}-${day}`;

        rowsToInsert.push({
          dipendente_id: idDipendente,
          data: dataStr,
          ora_inizio: p.ora_inizio,
          ora_fine: p.ora_fine,
          cliente_id: p.cliente_id || null,
          colore: '#4f46e5', // Indaco di default
          note: p.note ? p.note : "Da programma fisso"
        });
      }
    }

    if (rowsToInsert.length > 0) {
      await knex('agenda_caposquadra').insert(rowsToInsert);
    }
    
    return true;
  },

  async recuperaProspettoGlobale() {
    const rows = await knex('dipendenti as d')
      .leftJoin('programma_fisso as p', 'd.id', 'p.dipendente_id')
      .leftJoin('clienti as c', 'p.cliente_id', 'c.id')
      .select(
        'p.id',
        'p.giorno_settimana',
        'p.ora_inizio',
        'p.ora_fine',
        'p.frequenza',
        'p.note',
        'd.id as dipendente_id',
        'd.nome',
        'd.cognome',
        'd.stato as stato_dipendente',
        'p.cliente_id',
        'c.ragione_sociale as clienteNome'
      )
      .where('d.cestinato', 0)
      .andWhereNot('d.stato', 'Cessato');

    return rows.map(r => ({
      id: r.id,
      dipendenteId: r.dipendente_id,
      dipendenteNome: `${r.cognome} ${r.nome}`.trim().toUpperCase(),
      giorno: (r.giorno_settimana || '').toLowerCase().trim(),
      oraInizio: r.ora_inizio,
      oraFine: r.ora_fine,
      frequenza: r.frequenza || 'Settimanale',
      clienteNome: r.clienteNome || r.note || 'Senza Cliente',
      note: r.note
    }));
  }
};
