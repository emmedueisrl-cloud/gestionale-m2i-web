const fs = require('fs');
const path = require('path');
const { knex, generaIDIncrementale, getVal } = require('../db');

module.exports = {
  async recuperaDipendentiAttivi() {
    const list = await knex('dipendenti')
      .select('id', 'cognome', 'nome', 'codice_fiscale', 'stato', 'is_caposquadra')
      .whereNot('stato', 'Cessato')
      .andWhere('cestinato', 0);
      
    return list.map(d => ({
      id: d.id,
      nomeCompleto: `${d.cognome} ${d.nome}`.toUpperCase(),
      codiceFiscale: d.codice_fiscale,
      is_caposquadra: d.is_caposquadra
    }));
  },

  async elencoDipendentiAttivi() {
    return this.recuperaDipendentiAttivi();
  },

  async elencoTuttiIDipendenti() {
    const list = await knex('dipendenti')
      .select('id', 'cognome', 'nome', 'codice_fiscale', 'stato', 'email')
      .where('cestinato', 0);
      
    return list.map(d => ({
      id: d.id,
      nomeCompleto: `${d.cognome} ${d.nome}`.toUpperCase(),
      codiceFiscale: d.codice_fiscale,
      stato: d.stato,
      email: d.email
    }));
  },

  async recuperaDipendentiCestinati() {
    const list = await knex('dipendenti')
      .select('id', 'cognome', 'nome', 'codice_fiscale', 'stato')
      .where('cestinato', 1);
      
    return list.map(d => ({
      id: d.id,
      nomeCompleto: `${d.cognome} ${d.nome}`.toUpperCase(),
      codiceFiscale: d.codice_fiscale,
      stato: d.stato
    }));
  },

  async recuperaDatiCompletiDipendente(id) {
    const row = await knex('dipendenti').where('id', id).first();
    if (!row) throw new Error("Dipendente non trovato.");
    
    const proroghe = await knex('proroghe_contratti').where('dipendente_id', id).orderBy('id', 'asc');
    row.proroghe = proroghe || [];
    
    return row;
  },

  async recuperaDocumentiDipendente(id) {
    const safeId = path.basename(String(id));
    const dir = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads', safeId);
    if (!fs.existsSync(dir)) return [];
    
    const files = fs.readdirSync(dir);
    return files.map(file => {
      let tipo = 'Documento Generico';
      if (file.toLowerCase().includes('contratto')) tipo = 'Contratto';
      else if (file.toLowerCase().includes('unilav')) tipo = 'UNILAV';
      else if (file.toLowerCase().includes('doc')) tipo = 'Documento Identità';
      
      return {
        nome: file,
        path: `/uploads/${id}/${file}`,
        tipo: tipo
      };
    });
  },

  async eliminaDocumentoDipendente(id, nomeFile) {
    if (!nomeFile || nomeFile.includes('..') || nomeFile.includes('/')) {
      throw new Error('Nome file non valido');
    }
    const safeId = path.basename(String(id));
    const filePath = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads', safeId, nomeFile);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await knex('log_attivita').insert({
      categoria: "Documenti", icona: "🗑️", colore: "#ef4444",
      descrizione: `Eliminato documento <b>${nomeFile}</b> (Dipendente ${id})`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async salvaDipendente(dati) {
    const cognome = getVal(dati, "cognome");
    const nome = getVal(dati, "nome");
    const codiceFiscale = getVal(dati, "codiceFiscale");
    const isBozza = getVal(dati, "isBozza") === true;

    if (!cognome || !nome) {
      throw new Error("Cognome e Nome sono obbligatori.");
    }
    if (!isBozza && !codiceFiscale) {
      throw new Error("Il Codice Fiscale è obbligatorio (a meno di non salvare in Bozza).");
    }

    if (!isBozza && codiceFiscale) {
      const exist = await knex('dipendenti').where('codice_fiscale', codiceFiscale.toUpperCase()).first();
      if (exist) {
        throw new Error(`C'è un altro dipendente: ${exist.nome} ${exist.cognome} con lo stesso CF, controlla.`);
      }
    }

    const id = await generaIDIncrementale("dipendenti", "D");
    await knex('dipendenti').insert({
      id,
      cognome,
      nome,
      codice_fiscale: codiceFiscale ? codiceFiscale.toUpperCase() : (isBozza ? `BOZZA_${Date.now()}` : ""),
      data_nascita: getVal(dati, "dataNascita") || getVal(dati, "DataNascita"),
      comune_nascita: getVal(dati, "comuneNascita") || getVal(dati, "ComuneNascita"),
      provincia_nascita: getVal(dati, "provinciaNascita") || getVal(dati, "ProvinciaNascita"),
      indirizzo: getVal(dati, "indirizzo") || getVal(dati, "Residenza"),
      citta: getVal(dati, "citta") || getVal(dati, "Citta"),
      cap: getVal(dati, "cap") || getVal(dati, "Cap"),
      telefono: getVal(dati, "telefono") || getVal(dati, "Telefono"),
      email: getVal(dati, "email") || getVal(dati, "Email"),
      iban: getVal(dati, "iban") || getVal(dati, "IBAN"),
      data_assunzione: getVal(dati, "dataAssunzione") || getVal(dati, "DataAssunzione") || (isBozza ? new Date().toISOString().split('T')[0] : ""),
      scadenza: getVal(dati, "scadenza") || getVal(dati, "Scadenza"),
      livello_inquadramento: getVal(dati, "livelloInquadramento") || getVal(dati, "LivelloInquadramento"),
      ruolo: getVal(dati, "ruolo") || getVal(dati, "Ruolo"),
      mansione: getVal(dati, "mansione") || getVal(dati, "Mansione"),
      stato: isBozza ? 'Bozza' : (getVal(dati, "stato") || getVal(dati, "TipoContratto") || 'Determinato'),
      tipo_paga: getVal(dati, "tipoPaga") || getVal(dati, "TipoPaga") || 'Oraria',
      paga_oraria_reale: getVal(dati, "pagaOrariaReale") || getVal(dati, "Importo") || getVal(dati, "pagaOraria") || 0,
      note: getVal(dati, "note") || getVal(dati, "Note"),
      divisione: getVal(dati, "divisione") || getVal(dati, "Tipo") || 'Esterno',
      note_fisse_elaborato: getVal(dati, "noteFisseElaborato") || getVal(dati, "noteFisseElaborato"),
      creato_da: "LocalServer"
    });

    await knex('log_attivita').insert({
      categoria: "Dipendenti",
      icona: "👤",
      colore: "#10b981",
      descrizione: isBozza ? `Creata bozza dipendente: <b>${cognome.toUpperCase()} ${nome.toUpperCase()}</b>` : `Registrato nuovo dipendente: <b>${cognome.toUpperCase()} ${nome.toUpperCase()}</b>`,
      eseguito_da: "LocalServer"
    });

    return id;
  },

  async salvaModificheDipendente(dati) {
    const id = getVal(dati, "id") || getVal(dati, "IdDipendente");
    const cognome = getVal(dati, "cognome");
    const nome = getVal(dati, "nome");
    const isBozza = getVal(dati, "isBozza") === true;

    if (!id || !cognome || !nome) {
      throw new Error("ID, Cognome e Nome sono obbligatori.");
    }

    const codFisc = getVal(dati, "codiceFiscale");

    if (!isBozza && !codFisc) {
      throw new Error("Il Codice Fiscale è obbligatorio (a meno di non salvare in Bozza).");
    }

    if (!isBozza && codFisc) {
      const exist = await knex('dipendenti').where('codice_fiscale', codFisc.toUpperCase()).andWhereNot('id', id).first();
      if (exist) {
        throw new Error(`C'è un altro dipendente: ${exist.nome} ${exist.cognome} con lo stesso CF, controlla.`);
      }
    }

    const currentState = await knex('dipendenti').where('id', id).select('stato').first();
    let newStato = currentState ? currentState.stato : 'Determinato';
    if (isBozza) {
      newStato = 'Bozza';
    } else if (newStato === 'Bozza') {
      newStato = getVal(dati, "stato") || getVal(dati, "TipoContratto") || 'Determinato';
    } else {
      newStato = getVal(dati, "stato") || getVal(dati, "TipoContratto") || newStato;
    }

    await knex('dipendenti')
      .where('id', id)
      .update({
        cognome,
        nome,
        codice_fiscale: codFisc ? codFisc.toUpperCase() : (isBozza ? `BOZZA_${Date.now()}` : ""),
        data_nascita: getVal(dati, "dataNascita") || getVal(dati, "DataNascita"),
        comune_nascita: getVal(dati, "comuneNascita") || getVal(dati, "ComuneNascita"),
        provincia_nascita: getVal(dati, "provinciaNascita") || getVal(dati, "ProvinciaNascita"),
        indirizzo: getVal(dati, "indirizzo") || getVal(dati, "Residenza"),
        citta: getVal(dati, "citta") || getVal(dati, "Citta"),
        cap: getVal(dati, "cap") || getVal(dati, "Cap"),
        telefono: getVal(dati, "telefono") || getVal(dati, "Telefono"),
        email: getVal(dati, "email") || getVal(dati, "Email"),
        iban: getVal(dati, "iban") || getVal(dati, "IBAN"),
        data_assunzione: getVal(dati, "dataAssunzione") || getVal(dati, "DataAssunzione"),
        scadenza: getVal(dati, "scadenza") || getVal(dati, "Scadenza"),
        livello_inquadramento: getVal(dati, "livelloInquadramento") || getVal(dati, "LivelloInquadramento"),
        ruolo: getVal(dati, "ruolo") || getVal(dati, "Ruolo"),
        mansione: getVal(dati, "mansione") || getVal(dati, "Mansione"),
        stato: newStato,
        tipo_paga: getVal(dati, "tipoPaga") || getVal(dati, "TipoPaga") || 'Oraria',
        paga_oraria_reale: getVal(dati, "pagaOrariaReale") || getVal(dati, "Importo") || getVal(dati, "pagaOraria") || 0,
        note: getVal(dati, "note") || getVal(dati, "Note"),
        divisione: getVal(dati, "divisione") || getVal(dati, "Tipo") || 'Esterno',
        note_fisse_elaborato: getVal(dati, "noteFisseElaborato") || getVal(dati, "noteFisseElaborato")
      });

    await knex('log_attivita').insert({
      categoria: "Dipendenti", icona: "✏️", colore: "#3b82f6",
      descrizione: `Modificata anagrafica dipendente: <b>${cognome.toUpperCase()} ${nome.toUpperCase()}</b>`, eseguito_da: "LocalServer"
    });

    return id;
  },

  async salvaIbanDipendente(idDipendente, iban) {
    await knex('dipendenti').where('id', idDipendente).update({ iban });
    await knex('log_attivita').insert({
      categoria: "Dipendenti", icona: "💳", colore: "#f59e0b",
      descrizione: `Aggiornato IBAN dipendente: <b>${idDipendente}</b>`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async eliminaDipendente(id) {
    // 1. Verifica se ci sono ore lavorate nel registro_ore
    const oreLavorate = await knex('registro_ore')
      .where('dipendente_id', id)
      .andWhere('ore_totali', '>', 0)
      .first();

    // 2. Verifica se ci sono mesi chiusi per questo dipendente
    const mesiChiusi = await knex('dettaglio_mesi_chiusi_dipendenti')
      .where('dipendente_id', id)
      .first();

    const haLavorato = !!oreLavorate || !!mesiChiusi;

    if (haLavorato) {
      // Soft Delete
      await knex('dipendenti').where('id', id).update({ cestinato: 1 });
      await knex('log_attivita').insert({
        categoria: "Dipendenti", icona: "🗑️", colore: "#ef4444",
        descrizione: `Dipendente spostato nel cestino (Soft Delete): <b>${id}</b>`, eseguito_da: "LocalServer"
      });
      return { success: true, type: 'soft', message: 'Il dipendente aveva uno storico ed è stato spostato nel Cestino.' };
    } else {
      // Hard Delete
      await knex('dipendenti').where('id', id).del();
      
      // Elimina anche le eventuali proroghe collegate
      await knex('proroghe_contratti').where('dipendente_id', id).del();

      // Elimina fisicamente i documenti
      const safeId = path.basename(String(id));
      const dir = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads', safeId);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }

      await knex('log_attivita').insert({
        categoria: "Dipendenti", icona: "☠️", colore: "#dc2626",
        descrizione: `Eliminazione definitiva dipendente (Hard Delete): <b>${id}</b>`, eseguito_da: "LocalServer"
      });

      return { success: true, type: 'hard', message: 'Il dipendente e tutti i suoi file sono stati eliminati definitivamente.' };
    }
  },

  async ripristinaDipendente(id) {
    await knex('dipendenti').where('id', id).update({ cestinato: 0 });
    await knex('log_attivita').insert({
      categoria: "Dipendenti", icona: "♻️", colore: "#10b981",
      descrizione: `Ripristinato dipendente dal cestino: <b>${id}</b>`, eseguito_da: "LocalServer"
    });
    return { success: true, message: 'Dipendente ripristinato con successo.' };
  },

  async recuperaChiaviDipendente(id) {
    const chiavi = await knex('chiavi_assegnazioni')
      .join('clienti', 'chiavi_assegnazioni.cliente_id', '=', 'clienti.id')
      .select(
        'chiavi_assegnazioni.*',
        'clienti.ragione_sociale as cliente_nome',
        'clienti.indirizzo_sede as cliente_indirizzo'
      )
      .where('chiavi_assegnazioni.dipendente_id', id)
      .where('chiavi_assegnazioni.attivo', 1)
      .orderBy('clienti.ragione_sociale', 'asc');
    
    return chiavi;
  },

  async recuperaStoricoChiaviDipendente(id) {
    const chiavi = await knex('chiavi_assegnazioni')
      .join('clienti', 'chiavi_assegnazioni.cliente_id', '=', 'clienti.id')
      .select(
        'chiavi_assegnazioni.*',
        'clienti.ragione_sociale as cliente_nome',
        'clienti.indirizzo_sede as cliente_indirizzo'
      )
      .where('chiavi_assegnazioni.dipendente_id', id)
      .orderBy('chiavi_assegnazioni.data_assegnazione', 'desc');
    
    return chiavi;
  },

  async impostaCaposquadra(id, isCaposquadra) {
    const dip = await knex('dipendenti').where('id', id).first();
    if (!dip) throw new Error("Dipendente non trovato.");
    
    await knex('dipendenti').where('id', id).update({ is_caposquadra: isCaposquadra ? 1 : 0 });
    await knex('log_attivita').insert({
      categoria: "Dipendenti", icona: "👑", colore: "#8b5cf6",
      descrizione: `Impostato ruolo Caposquadra a <b>${isCaposquadra ? 'SI' : 'NO'}</b> per ${dip.cognome} ${dip.nome}`, eseguito_da: "LocalServer"
    });
    return { success: true };
  }
};
