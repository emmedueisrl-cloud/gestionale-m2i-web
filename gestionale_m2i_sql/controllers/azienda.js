const { knex } = require('../db');

module.exports = {
  async recuperaDatiAzienda() {
    const dati = await knex('m2i_azienda_dati').where('id', 1).first();
    return dati || {};
  },

  async salvaDatiAzienda(dati) {
    const updateData = {
      ragione_sociale: dati.ragioneSociale,
      sede_legale: dati.sedeLegale,
      sede_operativa: dati.sedeOperativa,
      pec: dati.pec,
      email: dati.email,
      telefono: dati.telefono,
      rea: dati.rea,
      partita_iva: dati.partitaIva,
      codice_fiscale: dati.codiceFiscale,
      forma_giuridica: dati.formaGiuridica,
      data_costituzione: dati.dataCostituzione,
      amministratore_unico: dati.amministratoreUnico,
      capitale_sociale: dati.capitaleSociale,
      codice_ateco: dati.codiceAteco
    };

    if (dati.timbro_path) {
      updateData.timbro_path = dati.timbro_path;
    }

    await knex('m2i_azienda_dati').where('id', 1).update(updateData);
    
    await knex('log_attivita').insert({
      categoria: "Azienda",
      icona: "🏢",
      colore: "#f59e0b",
      descrizione: "Modificati dati e impostazioni azienda M2I S.R.L.",
      eseguito_da: "LocalServer"
    });
    
    return true;
  },

  async recuperaDocumentiAzienda() {
    return await knex('m2i_azienda_documenti').orderBy('data_caricamento', 'desc');
  },
  
  async salvaDocumentoAzienda(nome, filePath, dataCaricamento) {
    await knex('m2i_azienda_documenti').insert({
      nome,
      file_path: filePath,
      data_caricamento: dataCaricamento
    });
    await knex('log_attivita').insert({
      categoria: "Azienda", icona: "📄", colore: "#10b981",
      descrizione: `Caricato nuovo documento aziendale: <b>${nome}</b>`, eseguito_da: "LocalServer"
    });
    return true;
  },
  
  async eliminaDocumentoAzienda(idDoc) {
    await knex('m2i_azienda_documenti').where('id', idDoc).del();
    await knex('log_attivita').insert({
      categoria: "Azienda", icona: "🗑️", colore: "#ef4444",
      descrizione: `Eliminato documento aziendale (ID: ${idDoc})`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async recuperaModuliStandard() {
    return await knex('moduli_standard').orderBy('id', 'desc');
  },

  async salvaModuloStandard(nome, fileUrl, tipo, dimensione, dataCaricamento) {
    await knex('moduli_standard').insert({
      nome,
      url: fileUrl,
      tipo,
      dimensione,
      data_caricamento: dataCaricamento
    });
    await knex('log_attivita').insert({
      categoria: "Moduli", icona: "📋", colore: "#10b981",
      descrizione: `Caricato nuovo modulo standard: <b>${nome}</b>`, eseguito_da: "LocalServer"
    });
    return true;
  },

  async eliminaModuloStandard(id) {
    await knex('moduli_standard').where('id', id).del();
    await knex('log_attivita').insert({
      categoria: "Moduli", icona: "🗑️", colore: "#ef4444",
      descrizione: `Eliminato modulo standard (ID: ${id})`, eseguito_da: "LocalServer"
    });
    return true;
  }
};
