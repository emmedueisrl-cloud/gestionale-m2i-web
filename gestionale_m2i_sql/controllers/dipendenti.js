const { statoAllaData } = require('../cessazioni_dipendenti');
const { ownerFolder } = require('../upload_paths');
const { deleteAttachment } = require('../attachment_delete');
const fs = require('fs');
const path = require('path');
const { knex, generaIDIncrementale, getVal } = require('../db');
const extraPersonalKeys = ['sesso', 'cittadinanza', 'titoloSoggiorno', 'motivoSoggiorno', 'numeroSoggiorno', 'scadenzaSoggiorno', 'questura'];
const extraWorkKeys = ['sedeLavoro', 'ccnl', 'tipoOrario', 'oreSettimanaliMedie', 'entePrevidenziale', 'patInail', 'retribuzioneUnilav'];
const pickExtra = (source, keys) => Object.fromEntries(keys.map(key => [key, String(source?.[key] || '').trim()]));
async function saveExtraData(id, input) {
  if (!input || !await knex.schema.hasTable('unilav_dati_dipendenti')) return;
  const anagrafica = pickExtra(input.anagrafica, extraPersonalKeys);
  const rapporto = pickExtra(input.rapporto, extraWorkKeys);
  const current = await knex('unilav_dati_dipendenti').where({ dipendente_id: id }).first();
  if (!current && ![...Object.values(anagrafica), ...Object.values(rapporto)].some(Boolean)) return;
  const row = { anagrafica_json: JSON.stringify(anagrafica), rapporto_json: JSON.stringify(rapporto), aggiornato_at: new Date().toISOString() };
  if (current) await knex('unilav_dati_dipendenti').where({ dipendente_id: id }).update(row);
  else await knex('unilav_dati_dipendenti').insert({ dipendente_id: id, ...row });
}

module.exports = {
  async recuperaDipendentiAttivi() {
    const list = await knex('dipendenti')
      .select('id', 'cognome', 'nome', 'codice_fiscale', 'stato', 'is_caposquadra', 'mansione')
      .whereNot('stato', 'Cessato')
      .andWhere('cestinato', 0);
      
    return list.map(d => ({
      id: d.id,
      nomeCompleto: `${d.cognome} ${d.nome}`.toUpperCase(),
      nome: d.nome,
      cognome: d.cognome,
      codiceFiscale: d.codice_fiscale,
      codice_fiscale: d.codice_fiscale,
      mansione: d.mansione,
      is_caposquadra: d.is_caposquadra
    }));
  },

  async elencoDipendentiAttivi() {
    return this.recuperaDipendentiAttivi();
  },

  async elencoTuttiIDipendenti() {
    const list = await knex('dipendenti')
      .select('id', 'cognome', 'nome', 'codice_fiscale', 'stato', 'email', 'mansione', 'scadenza', 'data_assunzione', 'data_cessazione', 'motivo_cessazione', 'link_cv', 'link_documenti', 'allegato_documenti')
      .where('cestinato', 0);
      
    return list.map(d => ({
      id: d.id,
      nomeCompleto: `${d.cognome} ${d.nome}`.toUpperCase(),
      nome: d.nome,
      cognome: d.cognome,
      codiceFiscale: d.codice_fiscale,
      codice_fiscale: d.codice_fiscale,
      mansione: d.mansione,
      stato: d.stato,
      dataAssunzione: d.data_assunzione,
      dataCessazione: d.data_cessazione,
      motivoCessazione: d.motivo_cessazione,
      email: d.email,
      link_cv: d.link_cv,
      link_documenti: d.link_documenti || d.allegato_documenti,
      scadenza: d.scadenza
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
    if (await knex.schema.hasTable('unilav_dati_dipendenti')) {
      const extra = await knex('unilav_dati_dipendenti').where({ dipendente_id: id }).first();
      row.unilavDati = extra ? {
        anagrafica: pickExtra(JSON.parse(extra.anagrafica_json), extraPersonalKeys),
        rapporto: pickExtra(JSON.parse(extra.rapporto_json), extraWorkKeys),
        aggiornatoAt: extra.aggiornato_at
      } : null;
    }
    row.unilavComunicazioni = await knex.schema.hasTable('unilav_comunicazioni')
      ? await knex('unilav_comunicazioni').where({ dipendente_id: id })
        .select('codice_comunicazione as codice', 'tipo', 'data_operazione as dataOperazione',
          'motivo', 'protocollo', 'file_path as filePath', 'file_name as fileName',
          'confermata_at as confermataAt', 'dati_json as datiJson').orderBy('confermata_at', 'desc')
      : [];
    row.unilavComunicazioni = row.unilavComunicazioni.map(({ datiJson, ...communication }) => {
      let details = {};
      try { details = JSON.parse(datiJson || '{}'); } catch { /* Comunicazione storica senza dettagli leggibili. */ }
      return { ...communication, dataInvio: details.dataInvio || null, oraInvio: details.oraInvio || '',
        tipoComunicazione: details.tipoComunicazione || '', socioLavoratore: details.socioLavoratore || '',
        lavoratoreMobilita: details.lavoratoreMobilita || '', assunzioneForzaMaggiore: details.assunzioneForzaMaggiore || '',
        motivoCessazione: details.rapporto?.motivoCessazione || '', codiceTrasformazione: details.rapporto?.codiceTrasformazione || '' };
    });
    
    return row;
  },

  async recuperaDocumentiDipendente(id) {
    const safeId = ownerFolder(id);
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
    return deleteAttachment(knex, process.env.DATA_DIR || path.join(__dirname, '..'), 'dipendenti', id, nomeFile);
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
    await saveExtraData(id, dati.unilavDati);

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

    const currentState = await knex('dipendenti').where('id', id).select('stato', 'data_cessazione', 'stato_pre_cessazione', 'scadenza', 'data_trasformazione_indeterminato').first();
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
        stato: currentState?.data_cessazione ? statoAllaData({ ...currentState, stato: newStato }) : newStato,
        ...(currentState?.data_cessazione && ['Determinato', 'Indeterminato', 'In Prova'].includes(newStato)
          ? { stato_pre_cessazione: newStato } : {}),
        tipo_paga: getVal(dati, "tipoPaga") || getVal(dati, "TipoPaga") || 'Oraria',
        paga_oraria_reale: getVal(dati, "pagaOrariaReale") || getVal(dati, "Importo") || getVal(dati, "pagaOraria") || 0,
        note: getVal(dati, "note") || getVal(dati, "Note"),
        divisione: getVal(dati, "divisione") || getVal(dati, "Tipo") || 'Esterno',
        note_fisse_elaborato: getVal(dati, "noteFisseElaborato") || getVal(dati, "noteFisseElaborato")
      });
    await saveExtraData(id, dati.unilavDati);

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
    // Ora il cliente vuole che i dipendenti vengano SEMPRE messi nel cestino,
    // a prescindere dal fatto che abbiano lavorato o meno.
    await knex('dipendenti').where('id', id).update({ cestinato: 1 });
    await knex('log_attivita').insert({
      categoria: "Dipendenti", icona: "🗑️", colore: "#ef4444",
      descrizione: `Dipendente spostato nel cestino: <b>${id}</b>`, eseguito_da: "LocalServer"
    });
    return { success: true, type: 'soft', message: 'Il dipendente è stato spostato nel Cestino.' };
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
