const { knex, getVal } = require('../db');
const { dataIso, registraCessazioneDipendente, statoAllaData } = require('../cessazioni_dipendenti');
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
    return knex.transaction(async trx => {
      const dip = await trx('dipendenti').where('id', id).first();
      if (!dip) throw new Error("Dipendente non trovato");

      await trx('proroghe_contratti').insert({
        dipendente_id: id,
        scadenza_precedente: dip.scadenza,
        nuova_scadenza: scadenza,
        note
      });

      await trx('dipendenti').where('id', id).update({ scadenza, note });
      await trx('log_attivita').insert({
        categoria: "Contratti", icona: "⏳", colore: "#f59e0b",
        descrizione: `Prorogato contratto dipendente ${id} fino al ${scadenza}`, eseguito_da: "LocalServer"
      });

      return true;
    });
  },

  async trasformaIndeterminato(dati) {
    const id = getVal(dati, "idDipendente");
    const dataTrasf = getVal(dati, "dataTrasformazione") || new Date().toISOString().split('T')[0];
    
    return knex.transaction(async trx => {
      const dipendente = await trx('dipendenti').where({ id }).first();
      if (!dipendente) throw new Error('Dipendente non trovato.');
      if (statoAllaData(dipendente) === 'Cessato') throw new Error('Il rapporto è già cessato.');
      if (dipendente.data_cessazione && dataIso(dataTrasf) > dataIso(dipendente.data_cessazione)) {
        throw new Error('La data di trasformazione è successiva alla cessazione registrata.');
      }
      await trx('dipendenti').where({ id }).update({
        stato: 'Indeterminato',
        scadenza: null,
        data_trasformazione_indeterminato: dataTrasf,
        ...(dipendente.data_cessazione ? { stato_pre_cessazione: 'Indeterminato' } : {})
      });
      await trx('log_attivita').insert({
        categoria: "Contratti", icona: "✨", colore: "#3b82f6",
        descrizione: `Trasformato contratto dipendente ${id} in Indeterminato (dal ${dataTrasf})`, eseguito_da: "LocalServer"
      });
      return true;
    });
  },

  async registraCessazione(dati) {
    const id = getVal(dati, "idDipendente");
    const dataCess = getVal(dati, "dataCessazione");
    const note = getVal(dati, "note");
    
    return knex.transaction(async trx => {
      const dipendente = await trx('dipendenti').where({ id }).first();
      await registraCessazioneDipendente(trx, dipendente, dataCess, getVal(dati, 'motivoCessazione') || note);
      if (note) await trx('dipendenti').where({ id }).update({ note });
      await trx('log_attivita').insert({
        categoria: "Contratti", icona: "⛔", colore: "#ef4444",
        descrizione: `Registrata cessazione contratto dipendente ${id} (ultimo giorno ${dataCess})`, eseguito_da: "LocalServer"
      });
      return true;
    });
  },

  async riattivaDipendenteServer(dati) {
    const id = getVal(dati, "idDipendente");
    const stato = getVal(dati, "nuovoStato") || "Determinato";
    const assunzione = getVal(dati, "nuovaDataAssunzione");
    const scadenza = getVal(dati, "nuovaScadenza");
    
    return knex.transaction(async trx => {
      const updated = await trx('dipendenti')
        .where('id', id)
        .update({
        stato,
        data_assunzione: assunzione,
        scadenza,
        data_cessazione: null,
        motivo_cessazione: null,
        stato_pre_cessazione: null
      });
      if (updated !== 1) throw new Error("Dipendente non trovato");
      await trx('log_attivita').insert({
        categoria: "Contratti", icona: "♻️", colore: "#10b981",
        descrizione: `Riattivato dipendente ${id} (${stato})`, eseguito_da: "LocalServer"
      });
      return true;
    });
  }
};
