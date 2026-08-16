const { knex } = require('../db');

module.exports = {
  async recuperaDatiInizialiCrm() {
    return { commerciali: [], outbound: [], pipeline: [], appuntamenti: [] };
  },
  async apriAnteprimaRiepilogo() { return []; },
  async recuperaPreloadId() { return ""; },
  async elaboraDomandaBot(req) {
    const q = req.body && req.body.domanda ? req.body.domanda.toLowerCase() : "";
    if (!q) return "Scrivi una domanda per ricevere assistenza.";

    if (q.includes("ore") && q.includes("dipendente")) {
      return "Per visualizzare le ore di un dipendente, vai nella sezione 'Personale' -> 'Ore e Cedolini'. Lì potrai selezionare il dipendente dal menu a tendina, scegliere il mese e l'anno, e visualizzare la tabella con il riepilogo delle ore lavorate e dei permessi.";
    }
    if (q.includes("preventivo") || q.includes("preventivi")) {
      return "Puoi generare e gestire i preventivi nella sezione 'Commerciale'. Cliccando su 'Nuovo Preventivo' potrai inserire i dati del cliente, i servizi offerti e generare un PDF impaginato pronto per essere inviato.";
    }
    if (q.includes("fattura") || q.includes("fatture")) {
      return "Le fatture si trovano nella sezione 'Amministrazione' -> 'Fatturazione'. Puoi generare nuove fatture proforma, chiudere il mese e scaricare il documento in formato PDF o Excel.";
    }
    if (q.includes("cliente") || q.includes("clienti")) {
      return "Trovi l'anagrafica clienti nella sezione 'Clienti'. Da lì puoi visualizzare i cantieri attivi, modificare i dati fiscali e i contatti aziendali.";
    }
    if (q.includes("busta paga") || q.includes("cedolino")) {
      return "Le buste paga possono essere caricate nella sezione 'Personale' -> 'Ore e Cedolini' cliccando sul pulsante 'Carica Busta Paga' dopo aver selezionato un dipendente.";
    }
    if (q.includes("dashboard") || q.includes("riepilogo")) {
      return "La Dashboard ti mostra il riepilogo generale del gestionale M2I: numero di dipendenti attivi, clienti, preventivi in corso e fatture emesse nel mese.";
    }
    if (q.includes("ciao") || q.includes("buongiorno") || q.includes("salve")) {
      return "Ciao! Sono l'assistente virtuale M2I. Come posso aiutarti oggi? Chiedimi come gestire ore, preventivi, fatture o clienti.";
    }

    return "Non ho capito esattamente la tua richiesta. Prova a formulare la domanda usando parole chiave come 'ore dipendente', 'generare preventivo', 'clienti', o 'fatture'.";
  },
  async generaReportDirezionalePdf() { return "http://localhost:3000/App.html"; },
  async esportaGoogleSheetElaborato() { return "http://localhost:3000/"; },
  async esportaGoogleSheetElaboratoClienti() { return "http://localhost:3000/"; },

  // Svuota tutte le tabelle per i test di collaudo
  async resetDatabaseForTest() {
    console.log("[TEST] Svuotamento di tutte le tabelle in corso...");
    await knex.raw("PRAGMA foreign_keys = OFF;");
    const tables = [
      "dipendenti", "clienti", "registro_ore", "fatture", "buste_paga",
      "programma_fisso", "agenda_caposquadra", "preventivi",
      "crm_outbound", "crm_commerciali", "crm_pipeline", "crm_appuntamenti_commerciali", "crm_preventivi_commerciali",
      "mesi_chiusi_dipendenti", "dettaglio_mesi_chiusi_dipendenti", "mesi_chiusi_clienti", "dettaglio_mesi_chiusi_clienti",
      "mesi_chiusi_provvigioni", "dettaglio_mesi_chiusi_provvigioni", "log_attivita",
      "regolazioni_stipendi", "regolazioni_clienti", "regolazioni_provvigioni"
    ];
    for (const t of tables) {
      await knex(t).del();
      await knex.raw(`DELETE FROM sqlite_sequence WHERE name='${t}'`);
    }
    await knex.raw("PRAGMA foreign_keys = ON;");
    console.log("[TEST] Svuotamento completato.");
    return true;
  }
};
