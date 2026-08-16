const { knex, generaIDIncrementale, getVal } = require('../db');

module.exports = {
  async salvaBustaPaga(dati) {
    const id = await generaIDIncrementale("buste_paga", "BP");
    const dipId = getVal(dati, "idDipendente");
    const dip = await knex('dipendenti').select('cognome', 'nome').where('id', dipId).first();
    const name = dip ? `${dip.cognome} ${dip.nome}`.toUpperCase() : "Dipendente";
    
    await knex('buste_paga').insert({
      id,
      dipendente_id: dipId,
      mese: getVal(dati, "mese"),
      anno: getVal(dati, "anno"),
      importo_netto: parseFloat(getVal(dati, "importoNetto")) || 0,
      note: getVal(dati, "note"),
      creato_da: "LocalServer"
    });

    await knex('log_attivita').insert({
      categoria: "Buste Paga",
      icona: "📄",
      colore: "#10b981",
      descrizione: `Caricata busta paga per <b>${name}</b> (${getVal(dati, "mese")}/${getVal(dati, "anno")})`,
      eseguito_da: "LocalServer"
    });
    
    return id;
  },

  async ottieniRegolazioni(idDipendente, mese, anno) {
    return knex('regolazioni_stipendi')
      .select('id as idRegolazione', 'tipo', 'importo', 'motivazione')
      .where({ dipendente_id: idDipendente, mese, anno });
  },

  async aggiungiRegolazione(mese, anno, idDipendente, dipendente, tipo, importo, motivazione) {
    await knex('regolazioni_stipendi').insert({
      mese,
      anno,
      dipendente_id: idDipendente,
      tipo,
      importo: parseFloat(importo),
      motivazione,
      creato_da: "LocalServer"
    });
    await knex('log_attivita').insert({
      categoria: "Maggiorazioni", icona: "💰", colore: "#f59e0b",
      descrizione: `Aggiunta regolazione (${tipo}) di €${importo} per dipendente ${idDipendente}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async eliminaRegolazione(idRegolazione) {
    await knex('regolazioni_stipendi').where('id', idRegolazione).del();
    await knex('log_attivita').insert({
      categoria: "Maggiorazioni", icona: "🗑️", colore: "#ef4444",
      descrizione: `Eliminata regolazione dipendente ID: ${idRegolazione}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async ottieniRegolazioniClienti(idCliente, mese, anno) {
    let query = knex('regolazioni_clienti')
      .select('id as idRegolazione', 'cliente_id as idCliente', 'tipo', 'importo', 'motivazione')
      .where({ mese, anno });
      
    if (idCliente) {
      query = query.where({ cliente_id: idCliente });
    }
    
    return query;
  },

  async aggiungiRegolazioneCliente(mese, anno, idCliente, cliente, tipo, importo, motivazione) {
    await knex('regolazioni_clienti').insert({
      mese,
      anno,
      cliente_id: idCliente,
      tipo,
      importo: parseFloat(importo),
      motivazione,
      creato_da: "LocalServer"
    });
    await knex('log_attivita').insert({
      categoria: "Sconti Clienti", icona: "💵", colore: "#10b981",
      descrizione: `Aggiunta regolazione cliente (${tipo}) di €${importo} per cliente ${idCliente}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async eliminaRegolazioneCliente(idRegolazione) {
    await knex('regolazioni_clienti').where('id', idRegolazione).del();
    await knex('log_attivita').insert({
      categoria: "Sconti Clienti", icona: "🗑️", colore: "#ef4444",
      descrizione: `Eliminata regolazione cliente ID: ${idRegolazione}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async ottieniRegolazioniProvvigione(idCliente, mese, anno) {
    const row = await knex('regolazioni_provvigioni')
      .select('id as idRegolazione', 'regolazione_comm', 'regolazione_oper', 'note')
      .where({ cliente_id: idCliente, mese, anno })
      .first();
    return row ? [row] : [];
  },

  async aggiungiRegolazioneProvvigione(dati) {
    const cliId = getVal(dati, "idCliente");
    const mese = getVal(dati, "mese");
    const anno = getVal(dati, "anno");
    const regComm = parseFloat(getVal(dati, "regolazioneComm")) || 0;
    const regOper = parseFloat(getVal(dati, "regolazioneOper")) || 0;
    const note = getVal(dati, "note");
    
    await knex('regolazioni_provvigioni').where({ cliente_id: cliId, mese, anno }).del();
    
    await knex('regolazioni_provvigioni').insert({
      cliente_id: cliId,
      mese,
      anno,
      regolazione_comm: regComm,
      regolazione_oper: regOper,
      note
    });
    await knex('log_attivita').insert({
      categoria: "Provvigioni", icona: "💰", colore: "#8b5cf6",
      descrizione: `Modificate regolazioni provvigione per cliente ${cliId}`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async eliminaRegolazioneProvvigione(idReg) {
    await knex('regolazioni_provvigioni').where('id', idReg).del();
    await knex('log_attivita').insert({
      categoria: "Provvigioni", icona: "🗑️", colore: "#ef4444",
      descrizione: `Eliminata regolazione provvigione ID: ${idReg}`, eseguito_da: "LocalServer"
    });
    return true;
  }
};
