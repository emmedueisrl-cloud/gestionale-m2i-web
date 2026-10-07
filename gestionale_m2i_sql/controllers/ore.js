const { knex, getVal } = require('../db');
const { registroState, assertRevision } = require('../registro_ore_state');
const appuntamentiPreventivi = require('../appuntamenti_preventivi');
const tipiImpegno = new Set(['Pulizie Ordinarie', 'Sgrosso', 'Affiancamento', 'Sopralluogo', 'Consegna prodotti', 'Ufficio', 'Acquisto prodotti']);

function durataDiurna(oraInizio, oraFine) {
  const valida = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (typeof oraInizio !== 'string' || typeof oraFine !== 'string' || !valida.test(oraInizio) || !valida.test(oraFine)) {
    throw new Error('Orario non valido: usa il formato HH:MM tra 00:00 e 23:59.');
  }
  const minuti = ora => Number(ora.slice(0, 2)) * 60 + Number(ora.slice(3));
  const durata = minuti(oraFine) - minuti(oraInizio);
  if (durata <= 0) throw new Error('L’ora di fine deve essere successiva all’inizio nello stesso giorno.');
  if (durata > 12 * 60) throw new Error('Non sono consentite più di 12 ore nello stesso giorno.');
  return durata / 60;
}

function validaOrarioAgenda(oraInizio, oraFine, senzaOrario) {
  if (senzaOrario === true) {
    if (oraInizio || oraFine) throw new Error('Un impegno da fare in giornata non può avere orari.');
    return;
  }
  if (oraFine === '' || oraFine == null) {
    if (typeof oraInizio !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(oraInizio)) {
      throw new Error('Orario di inizio non valido: usa il formato HH:MM.');
    }
    return;
  }
  durataDiurna(oraInizio, oraFine);
}

function dettagliImpegnoAgenda(imp) {
  const testo = (campo, maxLength) => {
    const valore = imp[campo] == null ? '' : imp[campo];
    if (typeof valore !== 'string' || valore.length > maxLength) throw new Error(`${campo} non valido`);
    return valore.trim();
  };
  const sopralluogo = imp.tipoImpegno === 'Sopralluogo';
  const acquisto = imp.tipoImpegno === 'Acquisto prodotti';
  const attivita = sopralluogo ? testo('attivita', 300) : '';
  const nomeReferente = sopralluogo ? testo('nomeReferente', 200) : '';
  const indirizzo = sopralluogo ? testo('indirizzo', 500) : '';
  if (sopralluogo && (!attivita || !nomeReferente || !indirizzo)) {
    throw new Error('Per il sopralluogo compila attività, nome referente e indirizzo.');
  }
  return {
    cliente_id: sopralluogo || imp.tipoImpegno === 'Ufficio' || acquisto ? null : (imp.idCliente || null),
    attivita,
    nome_referente: nomeReferente,
    indirizzo,
    luogo_acquisto: acquisto ? testo('luogoAcquisto', 300) : '',
    nominativo_appuntamento: '',
    luogo_appuntamento: ''
  };
}

module.exports = {
  async recuperaOreMensili(idDipendente, mese, anno) {
    return knex.transaction(async trx => {
      const state = await registroState(trx, idDipendente, Number(mese), Number(anno));
      const names = new Map((await trx('clienti').select('id', 'ragione_sociale')).map(c => [c.id, c.ragione_sociale]));
      const rows = state.rows.map(r => ({ ...r, clienteNome: names.get(r.cliente_id) }));

      let metodo = null;
      if (rows.length > 0) {
        metodo = rows[0].metodo_inserimento || 'Calendarizzata';
      }

      const righe = rows.map(r => {
        const entry = {
          id: r.id,
          bloccata: state.solaLettura || state.clienteBloccato(r.cliente_id),
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
      return { metodo, righe, revisione: state.revisione, solaLettura: state.solaLettura,
        clientiBloccati: state.clientiBloccati, meseClientiChiuso: state.meseClientiChiuso };
    });
  },

  async svuotaRegistroOreMensili(idDipendente, mese, anno, revisione) {
    return knex.transaction(async trx => {
      const state = await registroState(trx, idDipendente, Number(mese), Number(anno));
      assertRevision(state, revisione);
      if (state.protectedRows.length) throw new Error('Sono presenti ore blindate: non puoi svuotare il mese o cambiare metodo.');
      await trx('registro_ore').where({ dipendente_id: idDipendente, mese, anno }).del();
      await trx('log_attivita').insert({
        categoria: 'Ore Mensili', icona: '🗑️', colore: '#ef4444',
        descrizione: `Svuotato registro ore di ${mese}/${anno} per dipendente ${idDipendente}`, eseguito_da: 'LocalServer'
      });
      return { success: true, revisione: (await registroState(trx, idDipendente, Number(mese), Number(anno))).revisione };
    });
  },

  async salvaRegistroOreMensili(dati) {
    return this.salvaPresenzeMensili(dati);
  },

  async salvaPresenzeMensili(dati) {
    const idDipendente = getVal(dati, "idDipendente");
    const mese = Number(getVal(dati, "mese"));
    const anno = Number(getVal(dati, "anno"));
    let righe = getVal(dati, "righe");
    const metodoInserimento = getVal(dati, "metodoInserimento") || 'Calendarizzata';
    if (!Number.isInteger(mese) || mese < 1 || mese > 12 || !Number.isInteger(anno) || anno < 2000 || !Array.isArray(righe)) {
      throw new Error('Dati del registro ore non validi');
    }
    if (!['Calendarizzata', 'Mensile Totale'].includes(metodoInserimento)) throw new Error('Metodo di inserimento non valido');
    return knex.transaction(async trx => {
      const state = await registroState(trx, idDipendente, mese, anno);
      assertRevision(state, getVal(dati, 'revisione'));
      if (state.protectedRows.some(r => (r.metodo_inserimento || 'Calendarizzata') !== metodoInserimento)) {
        throw new Error('Sono presenti ore blindate: non puoi cambiare metodo.');
      }
      if (getVal(dati, 'importazioneExcel') === true) {
        // A complete Excel sheet may repeat protected hours, but cannot change them.
        const aggregate = entries => {
          const map = new Map();
          for (const r of entries) {
            const key = JSON.stringify([r.idCliente, r.causale || 'Ordinario']);
            const values = map.get(key) || Array(31).fill(0);
            for (let i = 0; i < 31; i++) values[i] += Number(r.giorni?.[i] || 0);
            map.set(key, values);
          }
          return JSON.stringify([...map].sort(([a], [b]) => a.localeCompare(b)));
        };
        const incoming = righe.filter(r => state.clienteBloccato(r?.idCliente));
        const included = new Set(incoming.map(r => r.idCliente));
        const stored = state.protectedRows.filter(r => included.has(r.cliente_id)).map(r => ({
          idCliente: r.cliente_id, causale: r.causale_assenza,
          giorni: Array.from({ length: 31 }, (_, i) => r[`giorno_${i + 1}`])
        }));
        if (aggregate(incoming) !== aggregate(stored)) throw new Error('Il file Excel modifica ore di un cliente blindato: importazione annullata.');
        righe = righe.filter(r => !state.clienteBloccato(r?.idCliente) && r.giorni?.some(h => Number(h) !== 0));
      }
      if (righe.some(r => state.clienteBloccato(r?.idCliente))) {
        throw new Error('Non puoi inserire o modificare ore di un cliente blindato.');
      }
      const giorniNelMese = new Date(anno, mese, 0).getDate();
      const totaliGiornalieri = Array(31).fill(0);
      let totaleMensile = 0;
      const daValidare = [...righe, ...state.protectedRows.map(r => ({
        ore_totali: r.ore_totali, giorni: Array.from({ length: 31 }, (_, i) => r[`giorno_${i + 1}`])
      }))];
      for (const r of daValidare) {
        if (!r || typeof r !== 'object') throw new Error('Riga ore non valida');
        if (metodoInserimento === 'Mensile Totale') {
          const ore = Number(r.ore_totali || 0);
          totaleMensile += ore;
          if (!Number.isFinite(ore) || ore < 0 || totaleMensile > giorniNelMese * 12) throw new Error('Ore mensili non valide');
        } else {
          if (!Array.isArray(r.giorni)) throw new Error('Giorni del registro ore non validi');
          for (let i = 0; i < 31; i++) {
            const ore = Number(r.giorni[i] || 0);
            if (!Number.isFinite(ore) || ore < 0 || (i >= giorniNelMese && ore !== 0)) throw new Error(`Ore non valide al giorno ${i + 1}`);
            totaliGiornalieri[i] += ore;
            if (totaliGiornalieri[i] > 12) throw new Error(`Il giorno ${i + 1} supera il limite di 12 ore complessive`);
          }
        }
      }

      const dipInfo = state.employee;
      if (!dipInfo) throw new Error('Dipendente non trovato');
      const pagaOraria = Number(dipInfo.paga_oraria_reale) || 0;

      await trx('registro_ore')
        .where({ dipendente_id: idDipendente, mese, anno })
        .whereNotIn('id', state.protectedRows.map(r => r.id))
        .del();

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

        await trx('registro_ore').insert(dbRow);
      }
      await trx('log_attivita').insert({
        categoria: "Ore Mensili", icona: "⏰", colore: "#3b82f6",
        descrizione: `Salvate ore mensili (${metodoInserimento}) di ${mese}/${anno} per dipendente ${idDipendente}`, eseguito_da: "LocalServer"
      });

      return { success: true, revisione: (await registroState(trx, idDipendente, mese, anno)).revisione };
    });
  },

  async precompilaDaProgrammaFisso(idDipendente, mese, anno) {
    const state = await knex.transaction(trx => registroState(trx, idDipendente, Number(mese), Number(anno)));
    if (state.solaLettura) throw new Error('Registro in sola lettura.');
    const prog = (await knex('programma_fisso').where('dipendente_id', idDipendente))
      .filter(r => !state.clienteBloccato(r.cliente_id));
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

      const ore = durataDiurna(p.ora_inizio, p.ora_fine);

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
    const impegni = getVal(dati, "impegni");
    if (!idDipendente || !Array.isArray(impegni) || impegni.some(imp => !imp || typeof imp !== 'object' || Array.isArray(imp))) {
      throw new Error('Dati del programma fisso non validi');
    }
    impegni.forEach(imp => durataDiurna(imp.oraInizio, imp.oraFine));
    
    const rowsToInsert = impegni.map(imp => ({
      dipendente_id: idDipendente,
      giorno_settimana: imp.giornoSettimana,
      ora_inizio: imp.oraInizio,
      ora_fine: imp.oraFine,
      cliente_id: imp.idCliente,
      frequenza: imp.frequenza || 'Settimanale',
      note: imp.note
    }));
    
    return knex.transaction(async trx => {
      const employee = await trx('dipendenti').select('id').where('id', idDipendente).first();
      if (!employee) throw new Error('Dipendente non trovato');
      await trx('programma_fisso').where('dipendente_id', idDipendente).del();
      if (rowsToInsert.length > 0) {
        await trx('programma_fisso').insert(rowsToInsert);
      }
      await trx('log_attivita').insert({
        categoria: "Ore Mensili", icona: "⚙️", colore: "#f59e0b",
        descrizione: `Aggiornato programma fisso settimanale per dipendente ${idDipendente}`, eseguito_da: "LocalServer"
      });
      return true;
    });
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

    const query = knex('agenda_caposquadra as a')
      .join('dipendenti as d', 'a.dipendente_id', 'd.id')
      .leftJoin('clienti as c', 'a.cliente_id', 'c.id')
      .leftJoin('appuntamenti_preventivi as ap', 'ap.agenda_impegno_id', 'a.id')
      .select('a.*', 'd.cognome as cognomeCaposquadra', 'd.nome as nomeCaposquadra', 'c.ragione_sociale as clienteNome', 'ap.stato as statoAppuntamento')
      .whereIn('a.data', dateArray);
    if (idDipendente === 'all') query.where('d.is_caposquadra', 1).whereNot('d.stato', 'Cessato').where('d.cestinato', 0);
    else query.where('a.dipendente_id', idDipendente);
    const rows = await query;
      
    return rows.map(r => ({
      id: r.id,
      idDipendente: r.dipendente_id,
      nomeCaposquadra: `${r.cognomeCaposquadra || ''} ${r.nomeCaposquadra || ''}`.trim(),
      data: r.data,
      oraInizio: r.ora_inizio,
      oraFine: r.ora_fine,
      senzaOrario: !r.ora_inizio,
      idCliente: r.cliente_id,
      cliente: r.tipo_impegno === 'Ufficio' ? 'Ufficio M2I'
        : r.tipo_impegno === 'Sopralluogo' ? ''
          : r.tipo_impegno === 'Acquisto prodotti' ? (r.luogo_acquisto || '')
            : (r.clienteNome || r.note || 'Servizio'),
      tipoImpegno: r.tipo_impegno || '',
      statoAppuntamento: r.statoAppuntamento || '',
      attivita: r.attivita || '',
      nomeReferente: r.nome_referente || '',
      indirizzo: r.indirizzo || '',
      luogoAcquisto: r.luogo_acquisto || '',
      nominativoAppuntamento: r.nominativo_appuntamento || '',
      luogoAppuntamento: r.luogo_appuntamento || '',
      colore: r.colore,
      note: r.note || ""
    }));
  },

  async salvaImpegnoAgenda(imp) {
    if (!imp || typeof imp !== 'object') throw new Error('Impegno agenda non valido');
    validaOrarioAgenda(imp.oraInizio, imp.oraFine, imp.senzaOrario);
    if (!tipiImpegno.has(imp.tipoImpegno)) throw new Error('Seleziona un tipo di impegno valido');
    const dettagli = dettagliImpegnoAgenda(imp);
    await knex.transaction(async trx => {
      const [agendaId] = await trx('agenda_caposquadra').insert({
        dipendente_id: imp.idDipendente,
        data: imp.data,
        ora_inizio: imp.senzaOrario ? '' : imp.oraInizio,
        ora_fine: imp.senzaOrario ? '' : (imp.oraFine || ''),
        ...dettagli,
        tipo_impegno: imp.tipoImpegno,
        colore: imp.colore,
        note: imp.note
      });
      if (imp.tipoImpegno === 'Sopralluogo') await appuntamentiPreventivi.syncFromAgenda(trx, agendaId, imp);
      await trx('log_attivita').insert({
        categoria: "Agenda", icona: "📅", colore: "#8b5cf6",
        descrizione: `Aggiunto impegno in agenda il ${imp.data} per dipendente ${imp.idDipendente}`, eseguito_da: "LocalServer"
      });
    });
    return true;
  },

  async modificaImpegnoAgenda(idImpegno, imp) {
    const id = Number(idImpegno);
    if (!Number.isSafeInteger(id) || id <= 0 || !imp || typeof imp !== 'object') {
      throw new Error('Impegno agenda non valido');
    }
    const data = imp.data;
    const giorno = typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T12:00:00Z`) : null;
    if (!giorno || Number.isNaN(giorno.getTime()) || giorno.toISOString().slice(0, 10) !== data) {
      throw new Error('Data impegno non valida');
    }
    validaOrarioAgenda(imp.oraInizio, imp.oraFine, imp.senzaOrario);
    if (typeof imp.idDipendente !== 'string' || !imp.idDipendente.trim()) throw new Error('Caposquadra non valido');
    if (typeof imp.colore !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(imp.colore)) throw new Error('Colore non valido');
    if (typeof imp.note !== 'string' || imp.note.length > 2000) throw new Error('Note non valide');
    if (!tipiImpegno.has(imp.tipoImpegno)) throw new Error('Seleziona un tipo di impegno valido');
    const dettagli = dettagliImpegnoAgenda(imp);
    return knex.transaction(async trx => {
      const caposquadra = await trx('dipendenti').where({ id: imp.idDipendente, is_caposquadra: 1 }).first('id');
      if (!caposquadra) throw new Error('Caposquadra non trovato');
      if (dettagli.cliente_id) {
        const cliente = await trx('clienti').where('id', dettagli.cliente_id).first('id');
        if (!cliente) throw new Error('Cliente non trovato');
      }
      const aggiornati = await trx('agenda_caposquadra').where('id', id).update({
        dipendente_id: imp.idDipendente,
        data,
        ora_inizio: imp.senzaOrario ? '' : imp.oraInizio,
        ora_fine: imp.senzaOrario ? '' : (imp.oraFine || ''),
        ...dettagli,
        tipo_impegno: imp.tipoImpegno,
        colore: imp.colore,
        note: imp.note
      });
      if (!aggiornati) throw new Error('Impegno non trovato');
      if (imp.tipoImpegno === 'Sopralluogo') await appuntamentiPreventivi.syncFromAgenda(trx, id, imp);
      else await appuntamentiPreventivi.removeForAgenda(trx, [id]);
      await trx('log_attivita').insert({
        categoria: 'Agenda', icona: '✏️', colore: '#8b5cf6',
        descrizione: `Modificato impegno in agenda ID: ${id}`, eseguito_da: 'LocalServer'
      });
      return true;
    });
  },

  async eliminaImpegnoAgenda(idImpegno) {
    await knex.transaction(async trx => {
      await appuntamentiPreventivi.removeForAgenda(trx, [idImpegno]);
      await trx('agenda_caposquadra').where('id', idImpegno).del();
      await trx('log_attivita').insert({
        categoria: "Agenda", icona: "🗑️", colore: "#ef4444",
        descrizione: `Eliminato impegno in agenda ID: ${idImpegno}`, eseguito_da: "LocalServer"
      });
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

    await knex.transaction(async trx => {
      const agendaIds = (await trx('agenda_caposquadra').where('dipendente_id', idDipendente).whereIn('data', dateArray).select('id')).map(row => row.id);
      await appuntamentiPreventivi.removeForAgenda(trx, agendaIds);
      await trx('agenda_caposquadra').whereIn('id', agendaIds).del();
      await trx('log_attivita').insert({
        categoria: "Agenda", icona: "🗑️", colore: "#ef4444",
        descrizione: `Svuotata settimana agenda (dal ${dataInizioSettimana}) per dipendente ${idDipendente}`, eseguito_da: "LocalServer"
      });
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
          tipo_impegno: 'Pulizie Ordinarie',
          colore: '#4f46e5', // Indaco di default
          note: p.note ? p.note : "Da programma fisso"
        });
      }
    }

    if (rowsToInsert.length > 0) {
      await knex.transaction(async trx => {
        for (const row of rowsToInsert) {
          durataDiurna(row.ora_inizio, row.ora_fine);
          const esistente = await trx('agenda_caposquadra').where({
            dipendente_id: row.dipendente_id, data: row.data,
            ora_inizio: row.ora_inizio, ora_fine: row.ora_fine,
            cliente_id: row.cliente_id
          }).first();
          if (!esistente) await trx('agenda_caposquadra').insert(row);
        }
      });
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
