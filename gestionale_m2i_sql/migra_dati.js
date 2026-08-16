const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const backupPath = path.join(__dirname, 'm2i_backup_db.json');
const dbPath = path.join(__dirname, 'gestionale.db');

if (!fs.existsSync(backupPath)) {
  console.error(`File di backup non trovato in ${backupPath}!`);
  console.error("Scarica il file 'm2i_backup_db.json' dal tuo Drive e incollalo in questa cartella, poi riavvia lo script.");
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Errore di apertura database:", err.message);
    process.exit(1);
  }
});

// Funzione di utilità per inserire in blocco
function insertBulk(tableName, columnsMap, rawSheetData) {
  return new Promise((resolve, reject) => {
    if (!rawSheetData || !rawSheetData.rows || rawSheetData.rows.length === 0) {
      console.log(`Tabella ${tableName}: nessun dato da migrare.`);
      return resolve();
    }

    const headers = rawSheetData.headers.map(h => String(h).trim());
    
    db.serialize(() => {
      // Disabilita temporaneamente FK per caricare senza ordinamenti rigidi
      db.run("PRAGMA foreign_keys = OFF;");
      
      db.run(`DELETE FROM ${tableName};`, (err) => {
        if (err) return reject(err);

        const sqlCols = Object.keys(columnsMap);
        const placeholders = sqlCols.map(() => '?').join(',');
        const query = `INSERT INTO ${tableName} (${sqlCols.join(',')}) VALUES (${placeholders})`;

        const stmt = db.prepare(query);
        let errorsCount = 0;

        rawSheetData.rows.forEach(row => {
          const values = sqlCols.map(col => {
            const sheetColName = columnsMap[col];
            const idx = headers.indexOf(sheetColName);
            if (idx === -1) return null;
            const val = row[idx];
            return val === undefined || val === "" ? null : val;
          });

          stmt.run(values, (err) => {
            if (err) {
              errorsCount++;
              console.error(`Errore di inserimento in ${tableName}:`, err.message);
            }
          });
        });

        stmt.finalize((err) => {
          db.run("PRAGMA foreign_keys = ON;");
          if (err) return reject(err);
          console.log(`Tabella ${tableName} migrata con successo: ${rawSheetData.rows.length} righe caricate (${errorsCount} errori).`);
          resolve();
        });
      });
    });
  });
}

async function run() {
  console.log("Inizio migrazione dati da JSON a SQLite...");

  // 1. Dipendenti
  await insertBulk("dipendenti", {
    id: "ID",
    cognome: "Cognome",
    nome: "Nome",
    codice_fiscale: "CodiceFiscale",
    data_nascita: "DataNascita",
    comune_nascita: "ComuneNascita",
    provincia_nascita: "ProvinciaNascita",
    indirizzo: "Indirizzo",
    citta: "Citta",
    cap: "CAP",
    telefono: "Telefono",
    email: "Email",
    iban: "IBAN",
    data_assunzione: "DataAssunzione",
    scadenza: "Scadenza",
    livello_inquadramento: "LivelloInquadramento",
    ruolo: "Ruolo",
    mansione: "Mansione",
    stato: "Stato",
    paga_oraria_reale: "PagaOrariaReale",
    data_trasformazione_indeterminato: "DataTrasformazioneIndeterminato",
    data_cessazione: "DataCessazione",
    note: "Note",
    allegato_documenti: "AllegatoDocumentiDip",
    allegato_contratto: "AllegatoContrattoFirmato",
    data_creazione: "DataCreazione",
    creato_da: "CreatoDa"
  }, rawData["Anagrafica Dipendenti GS"]);

  // 2. Clienti
  await insertBulk("clienti", {
    id: "ID Cliente",
    ragione_sociale: "Ragione Sociale",
    partita_iva: "P. IVA",
    sede_legale: "Sede Legale",
    sede_operativa: "Sede Operativa",
    telefono: "Telefono",
    email: "Email",
    referente: "Referente",
    telefono_referente: "Telefono Referente",
    tariffa_oraria_operatore: "Tariffa Oraria Operatore",
    tariffa_oraria_commerciale: "Tariffa Oraria Commerciale",
    data_firma_contratto: "Data Firma Contratto",
    scadenza_contratto: "Scadenza Contratto",
    tipo_contratto: "Tipo Contratto",
    metodo_pagamento: "Metodo Pagamento",
    iban: "IBAN",
    allegato_contratto_cliente: "Allegato Contratto Cliente",
    attivo: "Attivo",
    note: "Note",
    data_creazione: "DataCreazione",
    creato_da: "CreatoDa"
  }, rawData["Anagrafica Clienti GS"]);

  // 3. Registro Ore
  const oreColsMap = {
    mese: "Mese",
    anno: "Anno",
    dipendente_id: "ID Dipendente",
    cliente_id: "ID Cliente",
    ore_totali: "Ore Totali",
    costo_totale: "Costo Totale",
    causale_assenza: "Causale Assenza",
    note: "Note"
  };
  for (let i = 1; i <= 31; i++) {
    oreColsMap[`giorno_${i}`] = `Giorno${i}`;
  }
  await insertBulk("registro_ore", oreColsMap, rawData["Registro Ore GS"]);

  // 4. Fatture
  await insertBulk("fatture", {
    id: "ID Fattura",
    numero_fattura: "Numero Fattura",
    data_fattura: "Data Fattura",
    cliente_id: "ID Cliente",
    importo_imponibile: "Importo Imponibile",
    aliquota_iva: "Aliquota IVA",
    importo_iva: "Importo IVA",
    importo_totale: "Importo Totale",
    stato_pagamento: "Stato Pagamento",
    data_scadenza: "Data Scadenza",
    data_pagamento: "Data Pagamento",
    importo_pagato: "Importo Pagato",
    allegato_fattura: "Allegato Fattura",
    note: "Note",
    data_creazione: "DataCreazione",
    creato_da: "CreatoDa"
  }, rawData["Gestione Fatture GS"]);

  // 5. Buste Paga
  await insertBulk("buste_paga", {
    id: "ID Busta Paga",
    dipendente_id: "ID Dipendente",
    mese: "Mese",
    anno: "Anno",
    importo_netto: "Importo Netto",
    allegato_busta_paga: "Allegato Busta Paga",
    note: "Note",
    data_creazione: "DataCreazione",
    creato_da: "CreatoDa"
  }, rawData["Gestione Buste Paga GS"]);

  // 6. Programma Fisso
  await insertBulk("programma_fisso", {
    dipendente_id: "ID Dipendente",
    giorno_settimana: "Giorno Settimana",
    ora_inizio: "Ora Inizio",
    ora_fine: "Ora Fine",
    cliente_id: "ID Cliente",
    note: "Note"
  }, rawData["Programma Settimanale GS"]);

  // 7. Agenda Caposquadra
  await insertBulk("agenda_caposquadra", {
    dipendente_id: "ID Caposquadra",
    data: "Data",
    ora_inizio: "Ora Inizio",
    ora_fine: "Ora Fine",
    cliente_id: "ID Cliente",
    colore: "Colore",
    note: "Note"
  }, rawData["Programma Caposquadra GS"]);

  // 8. Preventivi Amministrativi
  await insertBulk("preventivi", {
    id: "ID Preventivo",
    numero_preventivo: "Numero Preventivo",
    data_preventivo: "Data Preventivo",
    cliente_prospect_id: "ID Cliente/Prospect",
    ragione_sociale_prospect: "Ragione Sociale/Prospect",
    indirizzo_locali: "Indirizzo Locali",
    costo_mensile: "Costo Mensile",
    commerciale: "Commerciale",
    servizi_inclusi: "Servizi Inclusi",
    stato: "Stato",
    allegato_preventivo: "Allegato Preventivo",
    data_creazione: "DataCreazione",
    creato_da: "CreatoDa"
  }, rawData["Gestione Preventivi GS"]);

  // 9. Tabelle CRM Commerciale
  await insertBulk("crm_outbound", {
    id_operatore: "ID Operatore",
    cognome: "Cognome",
    nome: "Nome",
    telefono: "Telefono",
    attivo: "Attivo",
    data_creazione: "DataCreazione"
  }, rawData["Anagrafica Outbound GS"]);

  await insertBulk("crm_commerciali", {
    id_commerciale: "ID Commerciale",
    cognome: "Cognome",
    nome: "Nome",
    telefono: "Telefono",
    attivo: "Attivo",
    data_creazione: "DataCreazione"
  }, rawData["Anagrafica Commerciali GS"]);

  await insertBulk("crm_pipeline", {
    id_lead: "ID Lead",
    data_creazione: "Data Creazione",
    ragione_sociale: "Ragione Sociale",
    referente: "Referente",
    telefono: "Telefono",
    email: "Email",
    indirizzo: "Indirizzo",
    citta: "Città",
    id_outbound: "ID Outbound",
    stato: "Stato",
    note_storiche: "Note Storiche"
  }, rawData["Pipeline Commerciale GS"]);

  await insertBulk("crm_appuntamenti_commerciali", {
    id_appuntamento: "ID Appuntamento",
    id_lead: "ID Lead",
    data_ora: "Data e Ora",
    id_commerciale: "ID Commerciale",
    conferma_tl: "Conferma TL",
    esito: "Esito",
    report_note: "Report Note",
    assegna_richiamo: "Assegna Richiamo",
    data_richiamo: "Data Richiamo"
  }, rawData["Appuntamenti Commerciali GS"]);

  await insertBulk("crm_preventivi_commerciali", {
    id_preventivo: "ID Preventivo",
    id_lead: "ID Lead",
    descrizione_servizi: "Descrizione Servizi",
    importo_imponibile: "Importo Imponibile",
    stato: "Stato",
    link_drive: "Link Drive",
    data_creazione: "DataCreazione"
  }, rawData["Preventivi Commerciali GS"]);

  // 10. Tabelle Storiche Chiusura Mesi
  await insertBulk("mesi_chiusi_dipendenti", {
    mese: "Mese",
    anno: "Anno",
    stato: "Stato",
    data_chiusura: "DataChiusura",
    chiuso_da: "ChiusoDa"
  }, rawData["Mesi Chiusi GS"]);

  await insertBulk("dettaglio_mesi_chiusi_dipendenti", {
    mese: "Mese",
    anno: "Anno",
    dipendente_id: "ID Dipendente",
    cognome_nome: "Cognome Nome",
    paga_registrata: "Paga Registrata",
    paga_oraria: "Paga Oraria",
    paga_mensile: "Paga Mensile",
    ore_lavorate: "Ore Lavorate",
    ore_ferie: "Ore Ferie",
    ore_permessi: "Ore Permessi",
    ore_malattia: "Ore Malattia",
    paga_lavorato: "Paga Lavorato",
    paga_ferie_permessi_malattia: "Paga Ferie Permessi Malattia",
    detrazioni: "Detrazioni",
    maggiorazioni: "Maggiorazioni",
    note_generali: "Note Generali",
    da_pagare: "Da Pagare",
    stipendio_netto: "Stipendio Netto",
    paga_oraria_reale: "Paga Oraria Reale",
    data_chiusura: "DataChiusura",
    chiuso_da: "ChiusoDa"
  }, rawData["Dettaglio Mesi Chiusi Dipendenti GS"]);

  await insertBulk("mesi_chiusi_clienti", {
    mese: "Mese",
    anno: "Anno",
    stato: "Stato",
    data_chiusura: "DataChiusura",
    chiuso_da: "ChiusoDa"
  }, rawData["Mesi Chiusi Clienti GS"]);

  await insertBulk("dettaglio_mesi_chiusi_clienti", {
    mese: "Mese",
    anno: "Anno",
    cliente_id: "ID Cliente",
    ragione_sociale: "Ragione Sociale",
    tipo_fatturazione: "Tipo Fatturazione",
    valore_contrattuale: "Valore Contrattuale",
    ore_lavorate: "Ore Lavorate",
    base_imponibile: "Base Imponibile",
    sconti: "Sconti",
    maggiorazioni: "Maggiorazioni",
    imponibile: "Imponibile",
    aliquota_iva: "Aliquota IVA",
    importo_iva: "Importo IVA",
    importo_totale: "Importo Totale",
    note: "Note",
    data_chiusura: "DataChiusura",
    chiuso_da: "ChiusoDa"
  }, rawData["Dettaglio Mesi Chiusi Clienti GS"]);

  await insertBulk("mesi_chiusi_provvigioni", {
    mese: "Mese",
    anno: "Anno",
    data_chiusura: "DataChiusura",
    chiuso_da: "ChiusoDa",
    perc_commerciale: "Perc Commerciale",
    perc_operatore: "Perc Operatore"
  }, rawData["Mesi Chiusi Provvigioni GS"]);

  await insertBulk("dettaglio_mesi_chiusi_provvigioni", {
    mese: "Mese",
    anno: "Anno",
    cliente_id: "ID Cliente",
    ragione_sociale: "Ragione Sociale",
    imponibile_cliente: "Imponibile Cliente",
    costo_dipendenti: "Costo Dipendenti",
    utile: "Utile",
    commerciale: "Commerciale",
    perc_comm: "Perc Comm",
    regolazione_comm: "Regolazione Comm",
    provvigione_comm_totale: "Provvigione Comm Totale",
    operatore: "Operatore",
    perc_oper: "Perc Oper",
    regolazione_oper: "Regolazione Oper",
    provvigione_oper_totale: "Provvigione Oper Totale",
    data_chiusura: "DataChiusura",
    chiuso_da: "ChiusoDa"
  }, rawData["Dettaglio Mesi Chiusi Provvigioni GS"]);

  // 11. Log Attivita Portale
  await insertBulk("log_attivita", {
    timestamp: "Timestamp",
    categoria: "Categoria",
    icona: "Icona",
    colore: "Colore",
    descrizione: "Descrizione",
    eseguito_da: "EseguitoDa"
  }, rawData["Registro Attivita Portale GS"]);

  console.log("Migrazione completata con successo!");
  db.close();
}

run().catch(err => {
  console.error("Errore critico durante la migrazione:", err);
  db.close();
});
