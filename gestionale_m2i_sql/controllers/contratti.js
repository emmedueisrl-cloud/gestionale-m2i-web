const { knex, getVal } = require('../db');
const { recuperaDatiCompletiDipendente, recuperaDipendentiAttivi } = require('./dipendenti');

module.exports = {
  async apriProrogheConDipendente(id) { return { id }; },
  async apriTrasformazioneConDipendente(id) { return { id }; },
  async apriCessazioneConDipendente(id) { return { id }; },

  async datiProroga(idDipendente) { return recuperaDatiCompletiDipendente(idDipendente); },
  async datiTrasformazione(idDipendente) { return recuperaDatiCompletiDipendente(idDipendente); },
  async datiCessazione(idDipendente) { return recuperaDatiCompletiDipendente(idDipendente); },

  async elencoDipendentiProroghe() { return recuperaDipendentiAttivi(); },
  async elencoDipendentiTrasformazione() { return recuperaDipendentiAttivi(); },

  async salvaProroga(dati) {
    const id = getVal(dati, "idDipendente");
    const scadenza = getVal(dati, "nuovaScadenza");
    const note = getVal(dati, "note") || "Proroga contratto";
    
    const dip = await knex('dipendenti').where('id', id).first();
    if (!dip) throw new Error("Dipendente non trovato");
    
    const scadenza_precedente = dip.scadenza;
    
    await knex('proroghe_contratti').insert({
      dipendente_id: id,
      scadenza_precedente,
      nuova_scadenza: scadenza,
      note
    });
    
    await knex('dipendenti')
      .where('id', id)
      .update({
        scadenza,
        note
      });
      
    await knex('log_attivita').insert({
      categoria: "Contratti", icona: "⏳", colore: "#f59e0b",
      descrizione: `Prorogato contratto dipendente ${id} fino al ${scadenza}`, eseguito_da: "LocalServer"
    });

    return true;
  },

  async trasformaIndeterminato(dati) {
    const id = getVal(dati, "idDipendente");
    const dataTrasf = getVal(dati, "dataTrasformazione") || new Date().toISOString().split('T')[0];
    
    await knex('dipendenti')
      .where('id', id)
      .update({
        stato: 'Indeterminato',
        scadenza: null,
        data_trasformazione_indeterminato: dataTrasf
      });
      
    await knex('log_attivita').insert({
      categoria: "Contratti", icona: "✨", colore: "#3b82f6",
      descrizione: `Trasformato contratto dipendente ${id} in Indeterminato (dal ${dataTrasf})`, eseguito_da: "LocalServer"
    });

    return true;
  },

  async registraCessazione(dati) {
    const id = getVal(dati, "idDipendente");
    const dataCess = getVal(dati, "dataCessazione");
    const note = getVal(dati, "note");
    
    await knex('dipendenti')
      .where('id', id)
      .update({
        stato: 'Cessato',
        data_cessazione: dataCess,
        note
      });
      
    await knex('log_attivita').insert({
      categoria: "Contratti", icona: "⛔", colore: "#ef4444",
      descrizione: `Registrata cessazione contratto dipendente ${id} (dal ${dataCess})`, eseguito_da: "LocalServer"
    });

    return true;
  },

  async riattivaDipendenteServer(dati) {
    const id = getVal(dati, "idDipendente");
    const stato = getVal(dati, "nuovoStato") || "Determinato";
    const assunzione = getVal(dati, "nuovaDataAssunzione");
    const scadenza = getVal(dati, "nuovaScadenza");
    
    await knex('dipendenti')
      .where('id', id)
      .update({
        stato,
        data_assunzione: assunzione,
        scadenza,
        data_cessazione: null
      });
      
    await knex('log_attivita').insert({
      categoria: "Contratti", icona: "♻️", colore: "#10b981",
      descrizione: `Riattivato dipendente ${id} (${stato})`, eseguito_da: "LocalServer"
    });

    return true;
  }
};
