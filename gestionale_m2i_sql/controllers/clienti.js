const { ownerFolder } = require('../upload_paths');
const { deleteAttachment } = require('../attachment_delete');
const { knex, generaIDIncrementale, getVal } = require('../db');
const { validaOutbound } = require('../operatori');
const fs = require('fs');
const path = require('path');

function validaDataCessazione(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error('Inserisci una data di cessazione valida (AAAA-MM-GG).');
  }
  return value;
}

function dataOdiernaItaliana() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date());
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

async function meseBlindatoCliente(trx, id) {
  const riga = await trx('righe_bloccate_elaborati').where({ tipo: 'cliente', soggetto_id: id }).first();
  if (riga) return riga;
  return trx('dettaglio_mesi_chiusi_clienti').where({ cliente_id: id }).first();
}

async function chiudiPeriodoAttivo(trx, cliente, data) {
  const periodi = await trx('clienti_periodi_attivita').where({ cliente_id: cliente.id }).orderBy('id');
  const aperto = periodi.find(periodo => !periodo.data_fine);
  const valoriFine = { data_fine: data };
  if (aperto && (!aperto.data_inizio || data >= aperto.data_inizio)) {
    await trx('clienti_periodi_attivita').where({ id: aperto.id }).update(valoriFine);
  } else if (aperto) {
    // Correzione di una riattivazione inserita per errore: elimina i periodi successivi
    // e riporta la cessazione sul periodo che comprende la data scelta.
    const destinazione = [...periodi]
      .filter(periodo => periodo.id !== aperto.id && (!periodo.data_inizio || periodo.data_inizio <= data))
      .pop();
    if (!destinazione) throw new Error('La cessazione precede il primo periodo di attività registrato.');
    await trx('clienti_periodi_attivita').where({ cliente_id: cliente.id }).andWhere('id', '>', destinazione.id).del();
    await trx('clienti_periodi_attivita').where({ id: destinazione.id }).update(valoriFine);
  } else if (cliente.attivo === 'SI' && !await trx('clienti_periodi_attivita').where({ cliente_id: cliente.id }).first()) {
    // Cliente creato dopo l'avvio: il primo periodo non ha una data iniziale storica affidabile.
    await trx('clienti_periodi_attivita').insert({ cliente_id: cliente.id, data_inizio: null, ...valoriFine });
  } else if (cliente.attivo === 'SI') {
    throw new Error('Storico attività incoerente: manca il periodo attivo.');
  }
}

module.exports = {
  async recuperaClientiAttivi() {
    const list = await knex('clienti')
      .select('id', 'ragione_sociale', 'partita_iva', 'citta', 'telefono', 'email', 'referente', 'tariffa_oraria_operatore', 'tariffa_oraria_commerciale', 'scadenza_contratto', 'note', 'note_fisse_elaborato', 'indirizzo_sede', 'civico_sede', 'cap', 'provincia', 'sede_legale', 'sede_operativa')
      .where(function() {
        this.where('attivo', 'SI').orWhereNull('attivo').orWhere('attivo', '');
      })
      .where(function() {
        this.where('cestinato', 0).orWhereNull('cestinato');
      });
      
    return list.map(c => ({
      id: c.id,
      ragioneSociale: c.ragione_sociale ? c.ragione_sociale.toUpperCase() : '',
      ragione_sociale: c.ragione_sociale ? c.ragione_sociale.toUpperCase() : '',
      partitaIva: c.partita_iva,
      partita_iva: c.partita_iva,
      citta: c.citta,
      indirizzo_sede: c.indirizzo_sede,
      civico_sede: c.civico_sede,
      cap: c.cap,
      provincia: c.provincia,
      sedeOperativa: (() => {
        if (!c.sede_operativa) return [];
        if (typeof c.sede_operativa !== 'string') return c.sede_operativa;
        try { return JSON.parse(c.sede_operativa); } catch(e) { return []; }
      })(),
      sede_legale: c.sede_legale,
      telefono: c.telefono,
      email: c.email,
      referente: c.referente,
      tariffaOrariaOperatore: c.tariffa_oraria_operatore,
      tariffaOrariaCommerciale: c.tariffa_oraria_commerciale,
      scadenzaContratto: c.scadenza_contratto,
      note: c.note,
      noteFisseElaborato: c.note_fisse_elaborato
    }));
  },

  async recuperaElencoClientiModifica() {
    return knex('clienti')
      .where(function() {
        this.where('cestinato', 0).orWhereNull('cestinato');
      })
      .orderBy('ragione_sociale', 'asc');
  },

  async recuperaClientiCestinati() {
    return knex('clienti').where('cestinato', 1).orderBy('ragione_sociale', 'asc');
  },

  async recuperaDatiCompletiCliente(id) {
    const cliente = await knex('clienti').where('id', id).first();
    if (cliente && typeof cliente.foto_servizio === 'string') {
      try {
        cliente.foto_servizio = JSON.parse(cliente.foto_servizio);
      } catch(e) {
        cliente.foto_servizio = [];
      }
    }
    if (cliente) {
      const assegnazioni = await knex('chiavi_assegnazioni')
        .leftJoin('dipendenti', 'chiavi_assegnazioni.dipendente_id', 'dipendenti.id')
        .where('chiavi_assegnazioni.cliente_id', id)
        .where('chiavi_assegnazioni.attivo', 1)
        .select(
          'chiavi_assegnazioni.*',
          'dipendenti.nome as dipendente_nome',
          'dipendenti.cognome as dipendente_cognome'
        )
        .orderBy('chiavi_assegnazioni.num_copia', 'asc');
      cliente.chiavi_assegnazioni = assegnazioni;
    }
    return cliente;
  },

  async recuperaDocumentiCliente(id) {
    const fs = require('fs');
    const path = require('path');
    const safeId = ownerFolder(id);
    const dir = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads', safeId);
    if (!fs.existsSync(dir)) return [];
    
    // Fetch cliente to know which files are photos
    const cliente = await knex('clienti').where('id', id).first();
    let fotoServizio = [];
    if (cliente && typeof cliente.foto_servizio === 'string') {
      try {
        fotoServizio = JSON.parse(cliente.foto_servizio) || [];
      } catch (e) {}
    }
    
    // Normalize fotoServizio paths to just filenames for easy comparison
    const fotoFilenames = fotoServizio.map(f => {
      // f might be "uploads/C0001/filename.jpg"
      return path.basename(f);
    });
    
    const files = fs.readdirSync(dir);
    // Ignore files that are in fotoFilenames
    const validFiles = files.filter(file => !fotoFilenames.includes(file));

    return validFiles.map(file => {
      let tipo = 'Documento Generico';
      if (file.toLowerCase().includes('contratto')) tipo = 'Contratto';
      else if (file.toLowerCase().includes('amministratore')) tipo = 'Documenti Amministratore';
      else if (file.toLowerCase().includes('doc')) tipo = 'Documento';
      
      return {
        nome: file,
        path: `/uploads/${id}/${file}`,
        tipo: tipo
      };
    });
  },

  async eliminaDocumentoCliente(id, nomeFile) {
    return deleteAttachment(knex, process.env.DATA_DIR || path.join(__dirname, '..'), 'clienti', id, nomeFile);
  },

  async eliminaCliente(id) {
    return knex.transaction(async trx => {
      const cliente = await trx('clienti').where({ id }).first();
      if (!cliente) throw new Error('Cliente non trovato.');
      if (cliente.cestinato) throw new Error('Cliente già nel cestino.');
      if (await meseBlindatoCliente(trx, id)) {
        throw new Error('Cliente presente in un mese blindato: può essere solo cessato, non eliminato.');
      }
      const dataFine = cliente.data_cessazione || dataOdiernaItaliana();
      if (cliente.attivo === 'SI') await chiudiPeriodoAttivo(trx, cliente, dataFine);
      await trx('clienti').where({ id }).update({
        cestinato: 1, attivo: 'Cessato', data_cessazione: dataFine
      });
      await trx('log_attivita').insert({
        categoria: 'Clienti', icona: '🗑️', colore: '#ef4444',
        descrizione: `Cliente cessato e spostato nel cestino: <b>${id}</b>`, eseguito_da: 'LocalServer'
      });
      return { cestinato: true };
    });
  },

  async cessaCliente(id, dataCessazione) {
    const data = validaDataCessazione(dataCessazione);
    if (data > dataOdiernaItaliana()) throw new Error('La data di cessazione non può essere futura.');
    return knex.transaction(async trx => {
      const cliente = await trx('clienti').where({ id }).first();
      if (!cliente || cliente.cestinato) throw new Error('Cliente non disponibile.');
      if (cliente.attivo !== 'SI') throw new Error('Solo un cliente attivo può essere cessato.');
      const bloccate = await trx('righe_bloccate_elaborati').where({ tipo: 'cliente', soggetto_id: id }).select('mese', 'anno');
      const storiche = await trx('dettaglio_mesi_chiusi_clienti').where({ cliente_id: id }).select('mese', 'anno');
      const primoGiorno = r => `${r.anno}-${String(r.mese).padStart(2, '0')}-01`;
      const inizioUltimoMeseBlindato = [...bloccate, ...storiche].map(primoGiorno).sort().pop();
      if (inizioUltimoMeseBlindato && data < inizioUltimoMeseBlindato) {
        throw new Error(`La cessazione non può precedere il primo giorno dell’ultimo mese blindato (${inizioUltimoMeseBlindato.split('-').reverse().join('/')}).`);
      }
      await chiudiPeriodoAttivo(trx, cliente, data);
      await trx('clienti').where({ id }).update({ attivo: 'Cessato', data_cessazione: data });
      await trx('log_attivita').insert({
        categoria: 'Clienti', icona: '🛑', colore: '#f97316',
        descrizione: `Cliente cessato dal ${data}: <b>${id}</b>`, eseguito_da: 'LocalServer'
      });
      return true;
    });
  },

  async riattivaCliente(id, dataRiattivazione) {
    const data = validaDataCessazione(dataRiattivazione);
    if (data > dataOdiernaItaliana()) throw new Error('La data di riattivazione non può essere futura.');
    return knex.transaction(async trx => {
      const cliente = await trx('clienti').where({ id }).first();
      if (!cliente || cliente.cestinato) throw new Error('Cliente non disponibile.');
      if (cliente.attivo !== 'Cessato') throw new Error('Solo un cliente cessato può essere riattivato.');
      const ultimo = await trx('clienti_periodi_attivita').where({ cliente_id: id }).orderBy('id', 'desc').first();
      const ultimaCessazione = ultimo?.data_fine || cliente.data_cessazione;
      if (ultimo && !ultimo.data_fine) throw new Error('Il cliente ha già un periodo di attività aperto.');
      if (ultimaCessazione && data < ultimaCessazione) {
        throw new Error('La riattivazione non può precedere l’ultima cessazione.');
      }
      const meseInizio = Number(data.slice(0, 4)) * 12 + Number(data.slice(5, 7));
      const mesiChiusi = await trx('mesi_chiusi_clienti').select('mese', 'anno');
      for (const mese of mesiChiusi) {
        if (mese.anno * 12 + mese.mese < meseInizio) continue;
        const nelloStorico = await trx('dettaglio_mesi_chiusi_clienti')
          .where({ cliente_id: id, mese: mese.mese, anno: mese.anno }).first();
        if (!nelloStorico) {
          throw new Error('La riattivazione coinvolge un mese già chiuso senza questo cliente: scegli una data successiva.');
        }
      }
      await trx('clienti_periodi_attivita').insert({ cliente_id: id, data_inizio: data, data_fine: null });
      await trx('clienti').where({ id }).update({ attivo: 'SI', data_cessazione: null });
      await trx('log_attivita').insert({
        categoria: 'Clienti', icona: '✅', colore: '#10b981',
        descrizione: `Cliente riattivato dal ${data}: <b>${id}</b>`, eseguito_da: 'LocalServer'
      });
      return true;
    });
  },

  async ripristinaCliente(id) {
    await knex('clienti').where('id', id).update({ cestinato: 0 });
    await knex('log_attivita').insert({
      categoria: "Clienti", icona: "♻️", colore: "#10b981",
      descrizione: `Ripristinato cliente dal cestino: <b>${id}</b>`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async salvaCliente(dati) {
    const ragioneSociale = getVal(dati, "ragioneSociale");
    const partitaIva = getVal(dati, "partitaIva");
    const isBozza = getVal(dati, "isBozza") === true;

    if (!ragioneSociale) {
      throw new Error("La Ragione Sociale è obbligatoria.");
    }
    if (!isBozza && !partitaIva) {
      throw new Error("La Partita IVA è obbligatoria (a meno di non salvare in Bozza).");
    }
    const outbound = await validaOutbound(getVal(dati, "operatore"));

    const id = await generaIDIncrementale("clienti", "C");
    try {
      await knex('clienti').insert({
        id,
        ragione_sociale: ragioneSociale,
        nome_attivita: getVal(dati, "nomeAttivita") || "",
        partita_iva: partitaIva ? partitaIva : (isBozza ? `BOZZA_${Date.now()}` : ""),
        codice_fiscale: getVal(dati, "codiceFiscale"),
        indirizzo_sede: getVal(dati, "indirizzoSede"),
        civico_sede: getVal(dati, "civicoSede"),
        cap: getVal(dati, "cap"),
        citta: getVal(dati, "citta"),
        provincia: getVal(dati, "provincia"),
        sede_legale: getVal(dati, "sedeLegale"),
        sede_operativa: typeof getVal(dati, "sedeOperativa") === 'object' ? JSON.stringify(getVal(dati, "sedeOperativa")) : getVal(dati, "sedeOperativa"),
        titolare: getVal(dati, "titolare"),
        telefono_titolare: getVal(dati, "telefonoTitolare"),
        telefono: getVal(dati, "telefono"),
        email: getVal(dati, "email"),
        email_secondaria: getVal(dati, "emailSecondaria"),
        banca: getVal(dati, "banca"),
        referente: getVal(dati, "referente"),
        ruolo_referente: getVal(dati, "ruoloReferente"),
        telefono_referente: getVal(dati, "telefonoReferente"),
        tariffa_oraria_operatore: getVal(dati, "tariffaOrariaOperatore") || 0,
        tariffa_oraria_commerciale: getVal(dati, "tariffaOrariaCommerciale") || 0,
        attivo: isBozza ? "Bozza" : "SI",
        cestinato: 0,
        creato_da: "LocalServer",
        data_firma_contratto: getVal(dati, "dataFirmaContratto"),
        scadenza_contratto: getVal(dati, "scadenzaContratto"),
        tipo_contratto: getVal(dati, "tipoContratto") || 'Rinnovo Tacito',
        metodo_pagamento: getVal(dati, "metodoPagamento"),
        iban: getVal(dati, "iban"),
        pec: getVal(dati, "pec"),
        codice_sdi: getVal(dati, "sdi"),
        note: getVal(dati, "note"),
        note_fisse_elaborato: getVal(dati, "noteFisseElaborato"),
        foto_servizio: JSON.stringify(getVal(dati, "fotoServizio") || []),
        possesso_chiavi: getVal(dati, "possessoChiavi") || "NO",
        copie: parseInt(getVal(dati, "copie"), 10) || 0,
        in_possesso_di: getVal(dati, "possessoChiavi") === "SI" ? (getVal(dati, "inPossessoDi") || "") : "",
        note_chiavi: getVal(dati, "noteChiavi") || "",
        operatore: outbound,
        operatore_assegnato: "",
        commerciale: getVal(dati, "commerciale") || "",
        quotazione_importo: getVal(dati, "quotazioneImporto") ? parseFloat(getVal(dati, "quotazioneImporto")) : null,
        quotazione_tipo: getVal(dati, "quotazioneTipo") || "Mensile",
        tipo_tassazione: getVal(dati, "tipoTassazione") || "IVA",
        percentuale_tassazione: getVal(dati, "percentualeTassazione") !== '' && getVal(dati, "percentualeTassazione") !== undefined && getVal(dati, "percentualeTassazione") !== null ? parseFloat(getVal(dati, "percentualeTassazione")) : null,
        tassazione_altro: getVal(dati, "tassazioneAltro") || ""
      });
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE constraint failed: clienti.partita_iva')) {
        throw new Error(`Esiste già un cliente con la Partita IVA ${partitaIva}.`);
      }
      if (e.message && e.message.includes('UNIQUE constraint failed: clienti.ragione_sociale')) {
        throw new Error(`Esiste già un cliente con la Ragione Sociale "${ragioneSociale}".`);
      }
      throw e;
    }

    await knex('log_attivita').insert({
      categoria: "Clienti",
      icona: "🏢",
      colore: "#3b82f6",
      descrizione: isBozza ? `Creata bozza cliente: <b>${ragioneSociale.toUpperCase()}</b>` : `Registrato nuovo cliente: <b>${ragioneSociale.toUpperCase()}</b>`,
      eseguito_da: "LocalServer"
    });

    return id;
  },

  async aggiornaRagioneSocialeCliente(idCliente, nuovaRagioneSociale) {
    if (!idCliente || !nuovaRagioneSociale) {
      throw new Error("ID e Ragione Sociale sono obbligatori.");
    }
    await knex('clienti').where('id', idCliente).update({
      ragione_sociale: nuovaRagioneSociale
    });
    await knex('log_attivita').insert({
      categoria: "Clienti", icona: "✏️", colore: "#3b82f6",
      descrizione: `Aggiornata ragione sociale cliente ${idCliente} in: <b>${nuovaRagioneSociale.toUpperCase()}</b>`, eseguito_da: "LocalServer"
    });
    return { success: true };
  },

  async aggiornaDatiCliente(dati) {
    const id = getVal(dati, "id");
    const ragioneSociale = getVal(dati, "ragioneSociale");
    const partitaIva = getVal(dati, "partitaIva");
    const isBozza = getVal(dati, "isBozza") === true;

    if (!id || !ragioneSociale) {
      throw new Error("ID e Ragione Sociale sono obbligatori.");
    }
    if (!isBozza && !partitaIva) {
      throw new Error("La Partita IVA è obbligatoria (a meno di non salvare in Bozza).");
    }
    
    // Check current state, to not overwrite 'NO' with 'SI' unless we specifically handle it.
    // Wait, let's just make sure that if it was 'Bozza' and now isBozza is false, we set it to 'SI'.
    const currentState = await knex('clienti').where('id', id).select('attivo', 'operatore').first();
    const outbound = await validaOutbound(getVal(dati, "operatore"), currentState?.operatore);
    let newStato = currentState ? currentState.attivo : 'SI';
    if (isBozza) {
      newStato = 'Bozza';
    } else if (newStato === 'Bozza') {
      newStato = 'SI';
    }

    try {
      await knex('clienti')
        .where('id', id)
        .update({
          ragione_sociale: ragioneSociale,
          nome_attivita: getVal(dati, "nomeAttivita") || "",
          attivo: newStato,
          partita_iva: partitaIva ? partitaIva : (isBozza ? `BOZZA_${Date.now()}` : ""),
          codice_fiscale: getVal(dati, "codiceFiscale"),
          indirizzo_sede: getVal(dati, "indirizzoSede"),
          civico_sede: getVal(dati, "civicoSede"),
          cap: getVal(dati, "cap"),
          citta: getVal(dati, "citta"),
          provincia: getVal(dati, "provincia"),
          sede_legale: getVal(dati, "sedeLegale"),
          sede_operativa: typeof getVal(dati, "sedeOperativa") === 'object' ? JSON.stringify(getVal(dati, "sedeOperativa")) : getVal(dati, "sedeOperativa"),
          titolare: getVal(dati, "titolare"),
          telefono_titolare: getVal(dati, "telefonoTitolare"),
          telefono: getVal(dati, "telefono"),
          email: getVal(dati, "email"),
          email_secondaria: getVal(dati, "emailSecondaria"),
          banca: getVal(dati, "banca"),
          referente: getVal(dati, "referente"),
          ruolo_referente: getVal(dati, "ruoloReferente"),
          telefono_referente: getVal(dati, "telefonoReferente"),
          tariffa_oraria_operatore: getVal(dati, "tariffaOrariaOperatore"),
          tariffa_oraria_commerciale: getVal(dati, "tariffaOrariaCommerciale"),
          data_firma_contratto: getVal(dati, "dataFirmaContratto"),
          scadenza_contratto: getVal(dati, "scadenzaContratto"),
          tipo_contratto: getVal(dati, "tipoContratto"),
          metodo_pagamento: getVal(dati, "metodoPagamento"),
          iban: getVal(dati, "iban"),
          pec: getVal(dati, "pec"),
          codice_sdi: getVal(dati, "sdi"),
          note: getVal(dati, "note"),
          note_fisse_elaborato: getVal(dati, "noteFisseElaborato"),
          foto_servizio: JSON.stringify(getVal(dati, "fotoServizio") || []),
          possesso_chiavi: getVal(dati, "possessoChiavi") || "NO",
          copie: parseInt(getVal(dati, "copie"), 10) || 0,
          in_possesso_di: getVal(dati, "possessoChiavi") === "SI" ? (getVal(dati, "inPossessoDi") || "") : "",
          note_chiavi: getVal(dati, "noteChiavi") || "",
          operatore: outbound,
          operatore_assegnato: "",
          commerciale: getVal(dati, "commerciale") || "",
          quotazione_importo: getVal(dati, "quotazioneImporto") ? parseFloat(getVal(dati, "quotazioneImporto")) : null,
          quotazione_tipo: getVal(dati, "quotazioneTipo") || "Mensile",
          tipo_tassazione: getVal(dati, "tipoTassazione") || "IVA",
          percentuale_tassazione: getVal(dati, "percentualeTassazione") !== '' && getVal(dati, "percentualeTassazione") !== undefined && getVal(dati, "percentualeTassazione") !== null ? parseFloat(getVal(dati, "percentualeTassazione")) : null,
          tassazione_altro: getVal(dati, "tassazioneAltro") || ""
        });
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE constraint failed: clienti.partita_iva')) {
        throw new Error(`Esiste già un cliente con la Partita IVA ${partitaIva}.`);
      }
      if (e.message && e.message.includes('UNIQUE constraint failed: clienti.ragione_sociale')) {
        throw new Error(`Esiste già un cliente con la Ragione Sociale "${ragioneSociale}".`);
      }
      throw e;
    }

    await knex('log_attivita').insert({
      categoria: "Clienti", icona: "✏️", colore: "#3b82f6",
      descrizione: `Modificata anagrafica cliente: <b>${ragioneSociale.toUpperCase()}</b>`, eseguito_da: "LocalServer"
    });

    return id;
  },

  async recuperaStatoChiavi() {
    const clienti = await knex('clienti')
      .select('id', 'ragione_sociale', 'possesso_chiavi', 'copie', 'in_possesso_di', 'note_chiavi')
      .where('attivo', 'SI');
      
    const dipendenti = await knex('dipendenti')
      .select('id', 'cognome', 'nome')
      .whereNot('stato', 'Cessato');
    
    return {
      clienti: clienti.map(c => ({
        id: c.id,
        ragioneSociale: c.ragione_sociale.toUpperCase(),
        possessoChiavi: c.possesso_chiavi || "NO",
        copie: c.copie || 0,
        inPossessoDi: c.in_possesso_di || "",
        noteChiavi: c.note_chiavi || ""
      })),
      dipendenti: dipendenti.map(d => ({
        id: d.id,
        nomeCompleto: `${d.cognome} ${d.nome}`.toUpperCase()
      }))
    };
  },

  async salvaCambioChiavi(dati) {
    const id = getVal(dati, "idCliente");
    const possesso = getVal(dati, "possessoChiavi") || "NO";
    const copie = parseInt(getVal(dati, "copie"), 10) || 0;
    const possessore = getVal(dati, "inPossessoDi") || "";
    
    await knex('clienti')
      .where('id', id)
      .update({
        possesso_chiavi: possesso,
        copie: copie,
        in_possesso_di: possessore,
        note_chiavi: getVal(dati, "noteChiavi") || ""
      });
      
    await knex('log_attivita').insert({
      categoria: "Clienti", icona: "🔑", colore: "#f59e0b",
      descrizione: `Modificato possesso chiavi cliente ${id}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async salvaNuovaAssegnazioneChiavi(dati) {
    const { clienteId, dipendenteId, assegnatoATesto, numCopia, dataAssegnazione, note, moduloClientePath, moduloDipendentePath } = dati;
    
    await knex('chiavi_assegnazioni').insert({
      cliente_id: clienteId,
      dipendente_id: dipendenteId || null,
      assegnato_a_testo: assegnatoATesto || null,
      num_copia: parseInt(numCopia, 10) || 1,
      data_assegnazione: dataAssegnazione || new Date().toISOString().split('T')[0],
      attivo: 1,
      note: note || null,
      indirizzo: dati.indirizzo || null,
      modulo_cliente_path: moduloClientePath || null,
      modulo_dipendente_path: moduloDipendentePath || null
    });

    // Aggiorna anche clienti.possesso_chiavi = SI
    await knex('clienti').where('id', clienteId).update({ possesso_chiavi: 'SI' });
    
    await knex('log_attivita').insert({
      categoria: "Clienti", icona: "🔑", colore: "#f59e0b",
      descrizione: `Assegnata copia chiave ${numCopia} del cliente ${clienteId} a ${dipendenteId || assegnatoATesto}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async assegnaAdAltroOperatore(dati) {
    const { idAssegnazione, dipendenteId, assegnatoATesto, dataSpostamento, note, moduloDipendentePath } = dati;
    
    const vecchia = await knex('chiavi_assegnazioni').where('id', idAssegnazione).first();
    if (!vecchia) throw new Error("Assegnazione non trovata");

    // Chiudi la vecchia
    await knex('chiavi_assegnazioni').where('id', idAssegnazione).update({
      attivo: 0,
      data_restituzione: dataSpostamento || new Date().toISOString().split('T')[0]
    });

    // Crea la nuova per la stessa copia
    await knex('chiavi_assegnazioni').insert({
      cliente_id: vecchia.cliente_id,
      dipendente_id: dipendenteId || null,
      assegnato_a_testo: assegnatoATesto || null,
      num_copia: vecchia.num_copia,
      data_assegnazione: dataSpostamento || new Date().toISOString().split('T')[0],
      attivo: 1,
      note: note || null,
      indirizzo: vecchia.indirizzo || null, // <- Added indirizzo
      modulo_cliente_path: vecchia.modulo_cliente_path, // eredita il modulo cliente (se c'era)
      modulo_dipendente_path: moduloDipendentePath || null
    });

    await knex('log_attivita').insert({
      categoria: "Clienti", icona: "🔑", colore: "#f59e0b",
      descrizione: `Assegnazione chiave ${idAssegnazione} spostata al dipendente ${dipendenteId || assegnatoATesto}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async riconsegnaChiaveAlCliente(dati) {
    const { idAssegnazione, dataRestituzione, note } = dati;
    await knex('chiavi_assegnazioni').where('id', idAssegnazione).update({
      attivo: 0,
      data_restituzione: dataRestituzione || new Date().toISOString().split('T')[0],
      note: note ? knex.raw('COALESCE(note, "") || ?', ['\nRestituzione: ' + note]) : undefined
    });
    await knex('log_attivita').insert({
      categoria: "Clienti", icona: "🔑", colore: "#10b981",
      descrizione: `Riconsegnata chiave (assegnazione ${idAssegnazione}) al cliente`, eseguito_da: "LocalServer"
    });
    return true;
  },
  
  async recuperaStoricoChiaviCliente(idCliente) {
    const assegnazioni = await knex('chiavi_assegnazioni')
      .leftJoin('dipendenti', 'chiavi_assegnazioni.dipendente_id', '=', 'dipendenti.id')
      .select(
        'chiavi_assegnazioni.*',
        'dipendenti.nome',
        'dipendenti.cognome'
      )
      .where('chiavi_assegnazioni.cliente_id', idCliente)
      .orderBy('chiavi_assegnazioni.num_copia', 'asc')
      .orderBy('chiavi_assegnazioni.data_assegnazione', 'asc');
      
    return assegnazioni.map(a => ({
      ...a,
      possessore_nome: a.assegnato_a_testo || (a.nome ? `${a.nome} ${a.cognome}` : 'Sconosciuto')
    }));
  },

  async recuperaTutteAssegnazioniChiavi() {
    const assegnazioni = await knex('chiavi_assegnazioni')
      .join('clienti', 'chiavi_assegnazioni.cliente_id', '=', 'clienti.id')
      .leftJoin('dipendenti', 'chiavi_assegnazioni.dipendente_id', '=', 'dipendenti.id')
      .select(
        'chiavi_assegnazioni.*',
        'clienti.ragione_sociale as cliente_nome',
        'dipendenti.nome',
        'dipendenti.cognome'
      )
      .where('chiavi_assegnazioni.attivo', 1)
      .orderBy('clienti.ragione_sociale', 'asc')
      .orderBy('chiavi_assegnazioni.num_copia', 'asc');
    
    return assegnazioni.map(a => ({
      ...a,
      possessore_nome: a.assegnato_a_testo || (a.nome ? `${a.nome} ${a.cognome}` : 'Sconosciuto')
    }));
  },

  async recuperaListaOperatoriCommerciali() {
    const operatoriRaw = await knex('clienti').distinct('operatore').whereNotNull('operatore').andWhere('operatore', '!=', '');
    const commercialiRaw = await knex('clienti').distinct('commerciale').whereNotNull('commerciale').andWhere('commerciale', '!=', '');
    
    return {
      operatori: operatoriRaw.map(r => r.operatore),
      commerciali: commercialiRaw.map(r => r.commerciale)
    };
  }
};
