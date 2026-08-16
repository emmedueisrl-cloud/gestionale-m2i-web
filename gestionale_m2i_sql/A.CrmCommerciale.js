//======================================================
// BACKEND CRM PIPELINE & COMMERCIAL WORKFLOW
//======================================================

const SHEET_OUTBOUND = "Anagrafica Outbound GS";
const SHEET_COMMERCIALI = "Anagrafica Commerciali GS";
const SHEET_PIPELINE = "Pipeline Commerciale GS";
const SHEET_APPUNTAMENTI = "Appuntamenti Commerciali GS";
const SHEET_PREVENTIVI = "Preventivi Commerciali GS";

/**
 * Apre l'interfaccia unificata del CRM.
 */
function apriCrmCommerciale() {
  assicuraFogliCrm();
  
  const html = HtmlService.createHtmlOutputFromFile("CrmCommerciale")
    .setWidth(1280)
    .setHeight(820)
    .setTitle("💼 Pipeline CRM Commerciale");
  SpreadsheetApp.getUi().showModalDialog(html, "💼 Pipeline CRM Commerciale");
}

/**
 * Assicura l'esistenza di tutti i fogli del CRM e ne crea la struttura iniziale con formattazione.
 */
function assicuraFogliCrm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Anagrafica Outbound
  let sheetOut = ss.getSheetByName(SHEET_OUTBOUND);
  if (!sheetOut) {
    sheetOut = ss.insertSheet(SHEET_OUTBOUND);
    const headers = ["ID Operatore", "Cognome", "Nome", "Telefono", "Attivo", "DataCreazione"];
    sheetOut.appendRow(headers);
    sheetOut.getRange(1, 1, 1, headers.length).setBackground("#0f766e").setFontColor("#ffffff").setFontWeight("bold");
    
    // Inseriamo dei dati di test per outbound
    sheetOut.appendRow(["OUT0001", "Rossi", "Chiara", "3331111111", "SI", "01/01/2026"]);
    sheetOut.appendRow(["OUT0002", "Bianchi", "Giulia", "3332222222", "SI", "01/01/2026"]);
  }
  
  // 2. Anagrafica Commerciali
  let sheetCom = ss.getSheetByName(SHEET_COMMERCIALI);
  if (!sheetCom) {
    sheetCom = ss.insertSheet(SHEET_COMMERCIALI);
    const headers = ["ID Commerciale", "Cognome", "Nome", "Telefono", "Attivo", "DataCreazione"];
    sheetCom.appendRow(headers);
    sheetCom.getRange(1, 1, 1, headers.length).setBackground("#1e3a8a").setFontColor("#ffffff").setFontWeight("bold");
    
    // Inseriamo dei dati di test per commerciali
    sheetCom.appendRow(["COM0001", "Verdi", "Alessandro", "3343333333", "SI", "01/01/2026"]);
    sheetCom.appendRow(["COM0002", "Neri", "Marco", "3344444444", "SI", "01/01/2026"]);
  }
  
  // 3. Pipeline Commerciale
  let sheetPipe = ss.getSheetByName(SHEET_PIPELINE);
  if (!sheetPipe) {
    sheetPipe = ss.insertSheet(SHEET_PIPELINE);
    const headers = ["ID Lead", "Data Creazione", "Ragione Sociale", "Referente", "Telefono", "Email", "Indirizzo", "Città", "ID Outbound", "Stato", "Note Storiche"];
    sheetPipe.appendRow(headers);
    sheetPipe.getRange(1, 1, 1, headers.length).setBackground("#4f46e5").setFontColor("#ffffff").setFontWeight("bold");
  }
  
  // 4. Appuntamenti
  let sheetApp = ss.getSheetByName(SHEET_APPUNTAMENTI);
  if (!sheetApp) {
    sheetApp = ss.insertSheet(SHEET_APPUNTAMENTI);
    const headers = ["ID Appuntamento", "ID Lead", "Data e Ora", "ID Commerciale", "Conferma TL", "Esito", "Report Note", "Assegna Richiamo", "Data Richiamo"];
    sheetApp.appendRow(headers);
    sheetApp.getRange(1, 1, 1, headers.length).setBackground("#b45309").setFontColor("#ffffff").setFontWeight("bold");
  }
  
  // 5. Preventivi
  let sheetPrev = ss.getSheetByName(SHEET_PREVENTIVI);
  if (!sheetPrev) {
    sheetPrev = ss.insertSheet(SHEET_PREVENTIVI);
    const headers = ["ID Preventivo", "ID Lead", "Descrizione Servizi", "Importo Imponibile", "Stato", "Link Drive", "DataCreazione"];
    sheetPrev.appendRow(headers);
    sheetPrev.getRange(1, 1, 1, headers.length).setBackground("#65a30d").setFontColor("#ffffff").setFontWeight("bold");
  }
  
  SpreadsheetApp.flush();
}

/**
 * Recupera i dati iniziali per popolare la UI della dashboard CRM.
 */
function recuperaDatiInizialiCrm() {
  assicuraFogliCrm();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Outbound
  const sheetOut = ss.getSheetByName(SHEET_OUTBOUND);
  const outList = [];
  if (sheetOut && sheetOut.getLastRow() > 1) {
    const raw = sheetOut.getRange(2, 1, sheetOut.getLastRow() - 1, sheetOut.getLastColumn()).getValues();
    raw.forEach(r => {
      if (r[0] && String(r[4]).trim().toUpperCase() === "SI") {
        outList.push({ id: String(r[0]), nome: `${r[1]} ${r[2]}`.toUpperCase() });
      }
    });
  }
  
  // Commerciali
  const sheetCom = ss.getSheetByName(SHEET_COMMERCIALI);
  const comList = [];
  if (sheetCom && sheetCom.getLastRow() > 1) {
    const raw = sheetCom.getRange(2, 1, sheetCom.getLastRow() - 1, sheetCom.getLastColumn()).getValues();
    raw.forEach(r => {
      if (r[0] && String(r[4]).trim().toUpperCase() === "SI") {
        comList.push({ id: String(r[0]), nome: `${r[1]} ${r[2]}`.toUpperCase() });
      }
    });
  }
  
  return {
    outbound: outList.sort((a,b) => a.nome.localeCompare(b.nome)),
    commerciali: comList.sort((a,b) => a.nome.localeCompare(b.nome))
  };
}

/**
 * Salva una nuova opportunità (Lead) e pianifica il primo appuntamento.
 */
function salvaNuovoLeadEAppuntamento(dati) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetPipe = ss.getSheetByName(SHEET_PIPELINE);
  const sheetApp = ss.getSheetByName(SHEET_APPUNTAMENTI);
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch(e) {}
  
  try {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    
    // 1. Genera ID Lead
    const idLead = "LEAD-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd") + "-" + Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    
    // Salva Lead in Pipeline
    const headersPipe = sheetPipe.getRange(1, 1, 1, sheetPipe.getLastColumn()).getValues()[0];
    const rowPipe = new Array(headersPipe.length).fill("");
    rowPipe[headersPipe.indexOf("ID Lead")] = idLead;
    rowPipe[headersPipe.indexOf("Data Creazione")] = timestamp;
    rowPipe[headersPipe.indexOf("Ragione Sociale")] = String(dati.ragioneSociale).toUpperCase().trim();
    rowPipe[headersPipe.indexOf("Referente")] = String(dati.referente).trim();
    rowPipe[headersPipe.indexOf("Telefono")] = String(dati.telefono).trim();
    rowPipe[headersPipe.indexOf("Email")] = String(dati.email).trim();
    rowPipe[headersPipe.indexOf("Indirizzo")] = String(dati.indirizzo).trim();
    rowPipe[headersPipe.indexOf("Città")] = String(dati.citta).trim();
    rowPipe[headersPipe.indexOf("ID Outbound")] = dati.idOutbound;
    rowPipe[headersPipe.indexOf("Stato")] = "Appuntamento Fissato";
    rowPipe[headersPipe.indexOf("Note/Storico Attività")] = `${timestamp}: Appuntamento pianificato per il ${dati.dataOraApp} con il commerciale ${dati.idCommerciale}`;
    
    sheetPipe.appendRow(rowPipe);
    
    // 2. Salva Appuntamento
    const idApp = "APP-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd") + "-" + Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    const headersApp = sheetApp.getRange(1, 1, 1, sheetApp.getLastColumn()).getValues()[0];
    const rowApp = new Array(headersApp.length).fill("");
    rowApp[headersApp.indexOf("ID Appuntamento")] = idApp;
    rowApp[headersApp.indexOf("ID Lead")] = idLead;
    rowApp[headersApp.indexOf("Data e Ora")] = dati.dataOraApp; // Formato YYYY-MM-DDTHH:MM
    rowApp[headersApp.indexOf("ID Commerciale")] = dati.idCommerciale;
    rowApp[headersApp.indexOf("Conferma TL")] = "Da Confermare";
    rowApp[headersApp.indexOf("Esito")] = "In Attesa";
    rowApp[headersApp.indexOf("Report Note")] = "";
    rowApp[headersApp.indexOf("Assegna Richiamo")] = "Nessuno";
    rowApp[headersApp.indexOf("Data Richiamo")] = "";
    
    sheetApp.appendRow(rowApp);
    
    SpreadsheetApp.flush();
    return idLead;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ottiene gli appuntamenti del giorno selezionato (es. domani) per le chiamate di conferma TL.
 */
function ottieniAppuntamentiPerTL(dataFiltro) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetApp = ss.getSheetByName(SHEET_APPUNTAMENTI);
  const sheetPipe = ss.getSheetByName(SHEET_PIPELINE);
  if (!sheetApp || sheetApp.getLastRow() <= 1) return [];
  
  const headersApp = sheetApp.getRange(1, 1, 1, sheetApp.getLastColumn()).getValues()[0];
  const rawApp = sheetApp.getRange(2, 1, sheetApp.getLastRow() - 1, sheetApp.getLastColumn()).getValues();
  
  const headersPipe = sheetPipe.getRange(1, 1, 1, sheetPipe.getLastColumn()).getValues()[0];
  const rawPipe = sheetPipe.getRange(2, 1, sheetPipe.getLastRow() - 1, sheetPipe.getLastColumn()).getValues();
  
  // Mappa Lead
  const leadMap = {};
  rawPipe.forEach(row => {
    const id = String(row[headersPipe.indexOf("ID Lead")]).trim();
    if (id) {
      leadMap[id] = {
        ragioneSociale: row[headersPipe.indexOf("Ragione Sociale")],
        referente: row[headersPipe.indexOf("Referente")],
        telefono: row[headersPipe.indexOf("Telefono")],
        indirizzo: `${row[headersPipe.indexOf("Indirizzo")]}, ${row[headersPipe.indexOf("Città")]}`,
        idOutbound: row[headersPipe.indexOf("ID Outbound")]
      };
    }
  });
  
  // Filtriamo appuntamenti
  const filtrate = [];
  rawApp.forEach(row => {
    const dataOra = String(row[headersApp.indexOf("Data e Ora")]); // es: "2026-07-05T14:30"
    if (dataOra.startsWith(dataFiltro)) {
      const idLead = String(row[headersApp.indexOf("ID Lead")]).trim();
      const ld = leadMap[idLead] || { ragioneSociale: "Sconosciuto", referente: "", telefono: "", indirizzo: "" };
      
      filtrate.push({
        idAppuntamento: row[headersApp.indexOf("ID Appuntamento")],
        idLead: idLead,
        cliente: ld.ragioneSociale,
        referente: ld.referente,
        telefono: ld.telefono,
        indirizzo: ld.indirizzo,
        dataOra: dataOra.replace("T", " alle ore "),
        idCommerciale: row[headersApp.indexOf("ID Commerciale")],
        confermaTl: row[headersApp.indexOf("Conferma TL")],
        esito: row[headersApp.indexOf("Esito")]
      });
    }
  });
  
  return filtrate;
}

/**
 * Aggiorna lo stato di conferma telefonica TL di domani.
 */
function aggiornaConfermaTL(idApp, statoConferma) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetApp = ss.getSheetByName(SHEET_APPUNTAMENTI);
  const sheetPipe = ss.getSheetByName(SHEET_PIPELINE);
  if (!sheetApp) return false;
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch(e) {}
  
  try {
    const headersApp = sheetApp.getRange(1, 1, 1, sheetApp.getLastColumn()).getValues()[0];
    const dataApp = sheetApp.getRange(2, 1, sheetApp.getLastRow() - 1, sheetApp.getLastColumn()).getValues();
    const idxID = headersApp.indexOf("ID Appuntamento");
    const idxLead = headersApp.indexOf("ID Lead");
    
    for (let i = 0; i < dataApp.length; i++) {
      if (String(dataApp[i][idxID]).trim() === String(idApp).trim()) {
        const rowNum = i + 2;
        sheetApp.getRange(rowNum, headersApp.indexOf("Conferma TL") + 1).setValue(statoConferma);
        
        const idLead = String(dataApp[i][idxLead]).trim();
        
        // Aggiorna stato in Pipeline
        if (sheetPipe) {
          const headersPipe = sheetPipe.getRange(1, 1, 1, sheetPipe.getLastColumn()).getValues()[0];
          const dataPipe = sheetPipe.getRange(2, 1, sheetPipe.getLastRow() - 1, sheetPipe.getLastColumn()).getValues();
          const idxPipeID = headersPipe.indexOf("ID Lead");
          
          for (let k = 0; k < dataPipe.length; k++) {
            if (String(dataPipe[k][idxPipeID]).trim() === idLead) {
              const pipeRow = k + 2;
              const nuovoStato = statoConferma === "Confermato" ? "Appuntamento Confermato TL" : "Appuntamento Annullato";
              sheetPipe.getRange(pipeRow, headersPipe.indexOf("Stato") + 1).setValue(nuovoStato);
              
              const noteCol = headersPipe.indexOf("Note/Storico Attività") + 1;
              const noteAttuali = String(sheetPipe.getRange(pipeRow, noteCol).getValue());
              const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
              sheetPipe.getRange(pipeRow, noteCol).setValue(`${noteAttuali}\n${timestamp}: TL imposta appuntamento come ${statoConferma}`);
              break;
            }
          }
        }
        SpreadsheetApp.flush();
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ottiene gli appuntamenti assegnati ad un determinato commerciale (agente) che sono in attesa di report.
 */
function ottieniAppuntamentiPerAgente(idCommerciale) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetApp = ss.getSheetByName(SHEET_APPUNTAMENTI);
  const sheetPipe = ss.getSheetByName(SHEET_PIPELINE);
  if (!sheetApp || sheetApp.getLastRow() <= 1) return [];
  
  const headersApp = sheetApp.getRange(1, 1, 1, sheetApp.getLastColumn()).getValues()[0];
  const rawApp = sheetApp.getRange(2, 1, sheetApp.getLastRow() - 1, sheetApp.getLastColumn()).getValues();
  
  const headersPipe = sheetPipe.getRange(1, 1, 1, sheetPipe.getLastColumn()).getValues()[0];
  const rawPipe = sheetPipe.getRange(2, 1, sheetPipe.getLastRow() - 1, sheetPipe.getLastColumn()).getValues();
  
  const leadMap = {};
  rawPipe.forEach(row => {
    const id = String(row[headersPipe.indexOf("ID Lead")]).trim();
    if (id) {
      leadMap[id] = {
        ragioneSociale: row[headersPipe.indexOf("Ragione Sociale")],
        referente: row[headersPipe.indexOf("Referente")],
        telefono: row[headersPipe.indexOf("Telefono")],
        indirizzo: `${row[headersPipe.indexOf("Indirizzo")]}, ${row[headersPipe.indexOf("Città")]}`
      };
    }
  });
  
  const filtrate = [];
  rawApp.forEach(row => {
    const comId = String(row[headersApp.indexOf("ID Commerciale")]).trim();
    const esito = String(row[headersApp.indexOf("Esito")]).trim();
    const conf = String(row[headersApp.indexOf("Conferma TL")]).trim();
    
    // Mostriamo gli appuntamenti del commerciale che sono stati Confermati dalla TL e sono in attesa di esito/report
    if (comId === String(idCommerciale).trim() && esito === "In Attesa" && conf === "Confermato") {
      const idLead = String(row[headersApp.indexOf("ID Lead")]).trim();
      const ld = leadMap[idLead] || { ragioneSociale: "Sconosciuto", referente: "", telefono: "", indirizzo: "" };
      
      filtrate.push({
        idAppuntamento: row[headersApp.indexOf("ID Appuntamento")],
        idLead: idLead,
        cliente: ld.ragioneSociale,
        referente: ld.referente,
        telefono: ld.telefono,
        indirizzo: ld.indirizzo,
        dataOra: String(row[headersApp.indexOf("Data e Ora")]).replace("T", " alle ore ")
      });
    }
  });
  
  return filtrate;
}

/**
 * Salva l'esito della visita (report) inserito dall'agente commerciale.
 */
function salvaReportCommerciale(dati) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetApp = ss.getSheetByName(SHEET_APPUNTAMENTI);
  const sheetPipe = ss.getSheetByName(SHEET_PIPELINE);
  if (!sheetApp) return false;
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch(e) {}
  
  try {
    const headersApp = sheetApp.getRange(1, 1, 1, sheetApp.getLastColumn()).getValues()[0];
    const dataApp = sheetApp.getRange(2, 1, sheetApp.getLastRow() - 1, sheetApp.getLastColumn()).getValues();
    const idxID = headersApp.indexOf("ID Appuntamento");
    const idxLead = headersApp.indexOf("ID Lead");
    
    for (let i = 0; i < dataApp.length; i++) {
      if (String(dataApp[i][idxID]).trim() === String(dati.idAppuntamento).trim()) {
        const rowNum = i + 2;
        
        sheetApp.getRange(rowNum, headersApp.indexOf("Esito") + 1).setValue(dati.esito);
        sheetApp.getRange(rowNum, headersApp.indexOf("Report Note") + 1).setValue(dati.reportNote);
        sheetApp.getRange(rowNum, headersApp.indexOf("Assegna Richiamo") + 1).setValue(dati.richiamoSuccessivo);
        sheetApp.getRange(rowNum, headersApp.indexOf("Data Richiamo") + 1).setValue(dati.dataRichiamo || "");
        
        const idLead = String(dataApp[i][idxLead]).trim();
        
        // Aggiorna stato in Pipeline
        if (sheetPipe) {
          const headersPipe = sheetPipe.getRange(1, 1, 1, sheetPipe.getLastColumn()).getValues()[0];
          const dataPipe = sheetPipe.getRange(2, 1, sheetPipe.getLastRow() - 1, sheetPipe.getLastColumn()).getValues();
          const idxPipeID = headersPipe.indexOf("ID Lead");
          
          for (let k = 0; k < dataPipe.length; k++) {
            if (String(dataPipe[k][idxPipeID]).trim() === idLead) {
              const pipeRow = k + 2;
              
              let nuovoStato = "Preventivo Presentato";
              if (dati.esito === "Cliente Assente" || dati.esito === "Commerciale non Andato") {
                nuovoStato = "Appuntamento Mancato";
              } else if (dati.esito === "Contratto Firmato") {
                nuovoStato = "Contratto Firmato";
              } else if (dati.richiamoSuccessivo !== "Nessuno") {
                nuovoStato = "Richiamo Programmato";
              }
              
              sheetPipe.getRange(pipeRow, headersPipe.indexOf("Stato") + 1).setValue(nuovoStato);
              
              const noteCol = headersPipe.indexOf("Note/Storico Attività") + 1;
              const noteAttuali = String(sheetPipe.getRange(pipeRow, noteCol).getValue());
              const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
              
              const logEvt = `${timestamp}: Agente inserisce report esito [${dati.esito}]. Note: ${dati.reportNote}. Prossimo Richiamo: ${dati.richiamoSuccessivo} per il ${dati.dataRichiamo || 'N.D.'}`;
              sheetPipe.getRange(pipeRow, noteCol).setValue(`${noteAttuali}\n${logEvt}`);
              break;
            }
          }
        }
        
        SpreadsheetApp.flush();
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ottiene i report commerciali da elaborare (es. creare preventivo o passare ad amministrazione) per la Team Leader.
 */
function ottieniReportPerTL() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetApp = ss.getSheetByName(SHEET_APPUNTAMENTI);
  const sheetPipe = ss.getSheetByName(SHEET_PIPELINE);
  if (!sheetApp || sheetApp.getLastRow() <= 1) return [];
  
  const headersApp = sheetApp.getRange(1, 1, 1, sheetApp.getLastColumn()).getValues()[0];
  const rawApp = sheetApp.getRange(2, 1, sheetApp.getLastRow() - 1, sheetApp.getLastColumn()).getValues();
  
  const headersPipe = sheetPipe.getRange(1, 1, 1, sheetPipe.getLastColumn()).getValues()[0];
  const rawPipe = sheetPipe.getRange(2, 1, sheetPipe.getLastRow() - 1, sheetPipe.getLastColumn()).getValues();
  
  const leadMap = {};
  rawPipe.forEach(row => {
    const id = String(row[headersPipe.indexOf("ID Lead")]).trim();
    if (id) {
      leadMap[id] = {
        ragioneSociale: row[headersPipe.indexOf("Ragione Sociale")],
        referente: row[headersPipe.indexOf("Referente")],
        telefono: row[headersPipe.indexOf("Telefono")],
        indirizzo: `${row[headersPipe.indexOf("Indirizzo")]}, ${row[headersPipe.indexOf("Città")]}`,
        stato: row[headersPipe.indexOf("Stato")],
        idOutbound: row[headersPipe.indexOf("ID Outbound")]
      };
    }
  });
  
  const filtrate = [];
  rawApp.forEach(row => {
    const esito = String(row[headersApp.indexOf("Esito")]).trim();
    
    // Filtriamo gli appuntamenti eseguiti (quindi con esito inserito che non siano ancora passati in amministrazione)
    if (esito !== "In Attesa" && esito !== "Cliente Assente" && esito !== "Commerciale non Andato") {
      const idLead = String(row[headersApp.indexOf("ID Lead")]).trim();
      const ld = leadMap[idLead] || { ragioneSociale: "Sconosciuto", referente: "", telefono: "", indirizzo: "", stato: "Sconosciuto" };
      
      if (ld.stato !== "Passato in Amministrazione") {
        filtrate.push({
          idAppuntamento: row[headersApp.indexOf("ID Appuntamento")],
          idLead: idLead,
          cliente: ld.ragioneSociale,
          referente: ld.referente,
          telefono: ld.telefono,
          indirizzo: ld.indirizzo,
          statoLead: ld.stato,
          dataOra: String(row[headersApp.indexOf("Data e Ora")]),
          idCommerciale: row[headersApp.indexOf("ID Commerciale")],
          esito: esito,
          reportNote: row[headersApp.indexOf("Report Note")],
          richiamoSuccessivo: row[headersApp.indexOf("Assegna Richiamo")],
          dataRichiamo: row[headersApp.indexOf("Data Richiamo")]
        });
      }
    }
  });
  
  return filtrate;
}

/**
 * Associa un preventivo compilato dalla TL all'opportunità nel CRM.
 */
function creaNuovoPreventivoCrm(idLead, dati) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetPrev = ss.getSheetByName(SHEET_PREVENTIVI);
  const sheetPipe = ss.getSheetByName(SHEET_PIPELINE);
  if (!sheetPrev) return false;
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch(e) {}
  
  try {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    const idPrev = "PREV-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd") + "-" + Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    
    // Inserisce record preventivo
    const headersPrev = sheetPrev.getRange(1, 1, 1, sheetPrev.getLastColumn()).getValues()[0];
    const row = new Array(headersPrev.length).fill("");
    row[headersPrev.indexOf("ID Preventivo")] = idPrev;
    row[headersPrev.indexOf("ID Lead")] = idLead;
    row[headersPrev.indexOf("Descrizione Servizi")] = dati.descrizione;
    row[headersPrev.indexOf("Importo Imponibile")] = parseFloat(dati.importo) || 0;
    row[headersPrev.indexOf("Stato")] = "Inviato";
    row[headersPrev.indexOf("Link Drive")] = "https://drive.google.com/open?id=demo_quote_" + idPrev;
    row[headersPrev.indexOf("DataCreazione")] = timestamp;
    
    sheetPrev.appendRow(row);
    
    // Aggiorna lo stato della Pipeline
    if (sheetPipe) {
      const headersPipe = sheetPipe.getRange(1, 1, 1, sheetPipe.getLastColumn()).getValues()[0];
      const dataPipe = sheetPipe.getRange(2, 1, sheetPipe.getLastRow() - 1, sheetPipe.getLastColumn()).getValues();
      const idxPipeID = headersPipe.indexOf("ID Lead");
      
      for (let k = 0; k < dataPipe.length; k++) {
        if (String(dataPipe[k][idxPipeID]).trim() === String(idLead).trim()) {
          const pipeRow = k + 2;
          sheetPipe.getRange(pipeRow, headersPipe.indexOf("Stato") + 1).setValue("Preventivo Inviato");
          
          const noteCol = headersPipe.indexOf("Note/Storico Attività") + 1;
          const noteAttuali = String(sheetPipe.getRange(pipeRow, noteCol).getValue());
          sheetPipe.getRange(pipeRow, noteCol).setValue(`${noteAttuali}\n${timestamp}: TL invia preventivo ${idPrev} di € ${dati.importo}`);
          break;
        }
      }
    }
    
    SpreadsheetApp.flush();
    return idPrev;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ottiene i preventivi associati ad un determinato lead.
 */
function ottieniPreventiviLead(idLead) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetPrev = ss.getSheetByName(SHEET_PREVENTIVI);
  if (!sheetPrev || sheetPrev.getLastRow() <= 1) return [];
  
  const headers = sheetPrev.getRange(1, 1, 1, sheetPrev.getLastColumn()).getValues()[0];
  const data = sheetPrev.getRange(2, 1, sheetPrev.getLastRow() - 1, sheetPrev.getLastColumn()).getValues();
  
  const idxLead = headers.indexOf("ID Lead");
  const filtrate = data.filter(row => String(row[idxLead]).trim() === String(idLead).trim());
  
  return filtrate.map(row => {
    return {
      idPreventivo: row[headers.indexOf("ID Preventivo")],
      descrizione: row[headers.indexOf("Descrizione Servizi")],
      importo: parseFloat(row[headers.indexOf("Importo Imponibile")]) || 0,
      stato: row[headers.indexOf("Stato")],
      link: row[headers.indexOf("Link Drive")],
      dataCreazione: row[headers.indexOf("DataCreazione")]
    };
  });
}

/**
 * Quando il contratto è firmato, "promuove" il Lead inserendolo automaticamente nell'Anagrafica Clienti amministrativa.
 */
function promuoviLeadAdAmministrazione(idLead) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetPipe = ss.getSheetByName(SHEET_PIPELINE);
  const sheetCli = ss.getSheetByName("Anagrafica Clienti GS");
  if (!sheetPipe || !sheetCli) throw new Error("Tabelle necessarie non trovate.");
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch(e) {
    throw new Error("Sistema momentaneamente occupato.");
  }
  
  try {
    // 1. Legge i dati del lead dalla Pipeline
    const headersPipe = sheetPipe.getRange(1, 1, 1, sheetPipe.getLastColumn()).getValues()[0];
    const dataPipe = sheetPipe.getRange(2, 1, sheetPipe.getLastRow() - 1, sheetPipe.getLastColumn()).getValues();
    const idxPipeID = headersPipe.indexOf("ID Lead");
    
    let leadRow = null;
    let rigaLeadNum = -1;
    for (let k = 0; k < dataPipe.length; k++) {
      if (String(dataPipe[k][idxPipeID]).trim() === String(idLead).trim()) {
        leadRow = dataPipe[k];
        rigaLeadNum = k + 2;
        break;
      }
    }
    
    if (!leadRow) throw new Error("Lead non trovato.");
    
    const ragioneSociale = String(leadRow[headersPipe.indexOf("Ragione Sociale")]).trim();
    const referente = String(leadRow[headersPipe.indexOf("Referente")]).trim();
    const telefono = String(leadRow[headersPipe.indexOf("Telefono")]).trim();
    const email = String(leadRow[headersPipe.indexOf("Email")]).trim();
    const indirizzo = String(leadRow[headersPipe.indexOf("Indirizzo")]).trim();
    const citta = String(leadRow[headersPipe.indexOf("Città")]).trim();
    
    // Trova l'importo dell'ultimo preventivo accettato (se c'è)
    const preventivi = ottieniPreventiviLead(idLead);
    let fissoMensile = 500; // Default di fallback
    if (preventivi.length > 0) {
      // Prendi l'importo dell'ultimo preventivo inviato o accettato
      fissoMensile = preventivi[preventivi.length - 1].importo || 500;
    }
    
    // 2. Verifica se il cliente esiste già in Anagrafica Clienti
    const headersCli = sheetCli.getRange(1, 1, 1, sheetCli.getLastColumn()).getValues()[0];
    const dataCli = sheetCli.getRange(2, 1, sheetCli.getLastRow() - 1, sheetCli.getLastColumn()).getValues();
    const idxCliRagSoc = headersCli.indexOf("Ragione Sociale");
    
    const giaPresente = dataCli.some(row => {
      return String(row[idxCliRagSoc]).trim().toUpperCase() === ragioneSociale.toUpperCase();
    });
    
    if (giaPresente) {
      throw new Error(`Il cliente "${ragioneSociale}" è già presente nell'Anagrafica Clienti amministrativa.`);
    }
    
    // 3. Crea il nuovo cliente in Anagrafica Clienti
    const nextIdCli = generaIDCliente(sheetCli);
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    
    let utente = "CRM Automazione";
    try {
      const mail = Session.getActiveUser().getEmail();
      if (mail) utente = mail;
    } catch(err) {}
    
    const rowCli = new Array(headersCli.length).fill("");
    rowCli[headersCli.indexOf("ID Cliente")] = nextIdCli;
    rowCli[headersCli.indexOf("Ragione Sociale")] = ragioneSociale;
    rowCli[headersCli.indexOf("P. IVA")] = "Da Inserire";
    rowCli[headersCli.indexOf("PEC / Codice Univoco")] = email;
    rowCli[headersCli.indexOf("Sede Legale")] = `${indirizzo}, ${citta}`;
    rowCli[headersCli.indexOf("Via Servizio")] = `${indirizzo}, ${citta}`;
    rowCli[headersCli.indexOf("Referente")] = referente;
    rowCli[headersCli.indexOf("Telefono 1")] = telefono;
    rowCli[headersCli.indexOf("Email")] = email;
    rowCli[headersCli.indexOf("Tipo Fatturazione")] = "Fisso"; // Default
    rowCli[headersCli.indexOf("Fisso Mensile")] = fissoMensile;
    rowCli[headersCli.indexOf("Tariffa Oraria")] = 0;
    rowCli[headersCli.indexOf("Aliquota IVA")] = 22;
    rowCli[headersCli.indexOf("Possesso Chiavi")] = "NO";
    rowCli[headersCli.indexOf("Attivo")] = "SI";
    rowCli[headersCli.indexOf("Data Firma Contratto")] = timestamp.split(" ")[0];
    rowCli[headersCli.indexOf("Tipo Contratto")] = "Annuale";
    rowCli[headersCli.indexOf("Pagamento con")] = "Bonifico 30gg";
    rowCli[headersCli.indexOf("DataCreazione")] = timestamp;
    rowCli[headersCli.indexOf("CreatoDa")] = utente;
    
    sheetCli.appendRow(rowCli);
    
    // 4. Aggiorna lo stato del Lead in Pipeline
    sheetPipe.getRange(rigaLeadNum, headersPipe.indexOf("Stato") + 1).setValue("Passato in Amministrazione");
    const noteCol = headersPipe.indexOf("Note/Storico Attività") + 1;
    const noteAttuali = String(sheetPipe.getRange(rigaLeadNum, noteCol).getValue());
    sheetPipe.getRange(rigaLeadNum, noteCol).setValue(`${noteAttuali}\n${timestamp}: Contratto formalizzato ed inserito automaticamente in Amministrazione con ID ${nextIdCli}`);
    
    SpreadsheetApp.flush();
    return nextIdCli;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ottiene i richiami assegnati (a operatore outbound o commerciale agente) per il giorno corrente.
 */
function ottieniRichiamiGiornalieri(ruolo, idSoggetto) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetApp = ss.getSheetByName(SHEET_APPUNTAMENTI);
  const sheetPipe = ss.getSheetByName(SHEET_PIPELINE);
  if (!sheetApp || sheetApp.getLastRow() <= 1) return [];
  
  const headersApp = sheetApp.getRange(1, 1, 1, sheetApp.getLastColumn()).getValues()[0];
  const rawApp = sheetApp.getRange(2, 1, sheetApp.getLastRow() - 1, sheetApp.getLastColumn()).getValues();
  
  const headersPipe = sheetPipe.getRange(1, 1, 1, sheetPipe.getLastColumn()).getValues()[0];
  const rawPipe = sheetPipe.getRange(2, 1, sheetPipe.getLastRow() - 1, sheetPipe.getLastColumn()).getValues();
  
  const leadMap = {};
  rawPipe.forEach(row => {
    const id = String(row[headersPipe.indexOf("ID Lead")]).trim();
    if (id) {
      leadMap[id] = {
        ragioneSociale: row[headersPipe.indexOf("Ragione Sociale")],
        referente: row[headersPipe.indexOf("Referente")],
        telefono: row[headersPipe.indexOf("Telefono")],
        indirizzo: `${row[headersPipe.indexOf("Indirizzo")]}, ${row[headersPipe.indexOf("Città")]}`,
        idOutbound: row[headersPipe.indexOf("ID Outbound")]
      };
    }
  });
  
  const oggiStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const richiami = [];
  
  rawApp.forEach(row => {
    const chiAssegna = String(row[headersApp.indexOf("Assegna Richiamo")]).trim(); // "Outbound", "Commerciale"
    const dataRichiamo = String(row[headersApp.indexOf("Data Richiamo")]).trim(); // "YYYY-MM-DD"
    
    if (dataRichiamo && chiAssegna === ruolo) {
      const idLead = String(row[headersApp.indexOf("ID Lead")]).trim();
      const ld = leadMap[idLead] || { ragioneSociale: "Sconosciuto", referente: "", telefono: "", indirizzo: "", idOutbound: "" };
      
      let corrisponde = false;
      if (ruolo === "Outbound" && ld.idOutbound === idSoggetto) corrisponde = true;
      if (ruolo === "Commerciale" && String(row[headersApp.indexOf("ID Commerciale")]).trim() === idSoggetto) corrisponde = true;
      
      if (corrisponde) {
        richiami.push({
          idAppuntamento: row[headersApp.indexOf("ID Appuntamento")],
          idLead: idLead,
          cliente: ld.ragioneSociale,
          referente: ld.referente,
          telefono: ld.telefono,
          indirizzo: ld.indirizzo,
          dataRichiamo: dataRichiamo,
          esitoPrecedente: row[headersApp.indexOf("Esito")],
          notePrecedenti: row[headersApp.indexOf("Report Note")]
        });
      }
    }
  });
  
  return richiami;
}
