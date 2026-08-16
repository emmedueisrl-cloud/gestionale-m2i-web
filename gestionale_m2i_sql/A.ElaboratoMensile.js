//======================================================
// MODULO ELABORATO MENSILE DIPENDENTI
//======================================================

const NOME_FOGLIO_ELABORATO = "Elaborato Mensile GS";
const NOME_FOGLIO_REGOLAZIONI = "Regolazioni Stipendi GS";
const NOME_FOGLIO_MESI_CHIUSI = "Mesi Chiusi GS";
const NOME_FOGLIO_DETTAGLIO_MESI_CHIUSI_DIP = "Dettaglio Mesi Chiusi Dipendenti GS";

/**
 * Apre la finestra modale per l'elaborato mensile dipendenti.
 */
function apriElaboratoMensile() {
  const html = HtmlService.createHtmlOutputFromFile("ElaboratoMensile")
    .setWidth(1250)
    .setHeight(750)
    .setTitle("Elaborato Mensile Dipendenti");
  SpreadsheetApp.getUi().showModalDialog(html, "Elaborato Mensile Dipendenti");
}

/**
 * Assicura l'esistenza del foglio di calcolo delle regolazioni (maggiorazioni/detrazioni).
 */
function assicuraRegolazioniSheet(ss) {
  let sheet = ss.getSheetByName(NOME_FOGLIO_REGOLAZIONI);
  if (!sheet) {
    sheet = ss.insertSheet(NOME_FOGLIO_REGOLAZIONI);
    const headers = [
      "ID Regolazione", "Mese", "Anno", "ID Dipendente", "Dipendente", 
      "Tipo", "Importo", "Motivazione", "DataCreazione", "CreatoDa"
    ];
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#475569").setFontColor("#ffffff").setFontWeight("bold");
    SpreadsheetApp.flush();
  }
  return sheet;
}

/**
 * Assicura l'esistenza del foglio di log dei mesi chiusi.
 */
function assicuraMesiChiusiSheet(ss) {
  let sheet = ss.getSheetByName(NOME_FOGLIO_MESI_CHIUSI);
  if (!sheet) {
    sheet = ss.insertSheet(NOME_FOGLIO_MESI_CHIUSI);
    const headers = ["Mese", "Anno", "Stato", "DataChiusura", "ChiusoDa"];
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#475569").setFontColor("#ffffff").setFontWeight("bold");
    SpreadsheetApp.flush();
  }
  return sheet;
}

/**
 * Assicura l'esistenza del foglio contenente il dettaglio storico dei mesi chiusi per i dipendenti.
 */
function assicuraDettaglioMesiChiusiDipSheet(ss) {
  let sheet = ss.getSheetByName(NOME_FOGLIO_DETTAGLIO_MESI_CHIUSI_DIP);
  if (!sheet) {
    sheet = ss.insertSheet(NOME_FOGLIO_DETTAGLIO_MESI_CHIUSI_DIP);
    const headers = [
      "Mese", "Anno", "ID Dipendente", "Cognome Nome", "Paga Registrata", 
      "Paga Oraria", "Paga Mensile", "Ore Lavorate", "Ore Ferie", "Ore Permessi", 
      "Ore Malattia", "Paga Lavorato", "Paga Ferie Permessi Malattia", 
      "Detrazioni", "Maggiorazioni", "Note Generali", "Da Pagare", 
      "Stipendio Netto", "Paga Oraria Reale", "DataChiusura", "ChiusoDa"
    ];
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#7c3aed").setFontColor("#ffffff").setFontWeight("bold"); // Colore Viola
    SpreadsheetApp.flush();
  }
  return sheet;
}

/**
 * Verifica se un determinato mese ed anno è contrassegnato come Chiuso.
 */
function isMeseChiuso(mese, anno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = assicuraMesiChiusiSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  const idxMese = headers.indexOf("Mese");
  const idxAnno = headers.indexOf("Anno");
  const idxStato = headers.indexOf("Stato");
  
  const trovato = data.some(row => {
    return String(row[idxMese]).trim() === String(mese).trim() &&
           String(row[idxAnno]).trim() === String(anno).trim() &&
           String(row[idxStato]).trim() === "Chiuso";
  });
  
  return trovato;
}

/**
 * Registra lo stato "Chiuso" per il mese/anno selezionato e genera il PDF degli stipendi.
 */
function chiudiMeseElaborato(mese, anno, righe) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = assicuraMesiChiusiSheet(ss);
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch(e) {}
  
  try {
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    
    let utente = "Sistema";
    try {
      const email = Session.getActiveUser().getEmail();
      if (email) utente = email;
    } catch(err) {}
    
    // Rimuovi eventuali record precedenti per lo stesso mese ed anno
    if (lastRow > 1) {
      const idxMese = headers.indexOf("Mese");
      const idxAnno = headers.indexOf("Anno");
      const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
      for (let i = data.length - 1; i >= 0; i--) {
        if (String(data[i][idxMese]).trim() === String(mese).trim() && String(data[i][idxAnno]).trim() === String(anno).trim()) {
          sheet.deleteRow(i + 2);
        }
      }
    }
    
    const row = new Array(headers.length).fill("");
    row[headers.indexOf("Mese")] = mese;
    row[headers.indexOf("Anno")] = anno;
    row[headers.indexOf("Stato")] = "Chiuso";
    row[headers.indexOf("DataChiusura")] = timestamp;
    row[headers.indexOf("ChiusoDa")] = utente;
    sheet.appendRow(row);
    SpreadsheetApp.flush();

    // 1. Inizializza il foglio di dettaglio storico dipendenti
    const sheetDet = assicuraDettaglioMesiChiusiDipSheet(ss);
    
    // 2. Rimuovi record storici preesistenti dello stesso mese/anno per sovrascrittura pulita
    const lastRowDet = sheetDet.getLastRow();
    const headersDet = sheetDet.getRange(1, 1, 1, sheetDet.getLastColumn()).getValues()[0];
    if (lastRowDet > 1) {
      const idxMeseDet = headersDet.indexOf("Mese");
      const idxAnnoDet = headersDet.indexOf("Anno");
      const dataDet = sheetDet.getRange(2, 1, lastRowDet - 1, sheetDet.getLastColumn()).getValues();
      for (let i = dataDet.length - 1; i >= 0; i--) {
        if (String(dataDet[i][idxMeseDet]).trim() === String(mese).trim() && 
            String(dataDet[i][idxAnnoDet]).trim() === String(anno).trim()) {
          sheetDet.deleteRow(i + 2);
        }
      }
    }
    
    // 3. Salva ciascuna delle righe elaborate dipendenti
    if (righe && righe.length > 0) {
      righe.forEach(r => {
        const rowDet = new Array(headersDet.length).fill("");
        rowDet[headersDet.indexOf("Mese")] = mese;
        rowDet[headersDet.indexOf("Anno")] = anno;
        rowDet[headersDet.indexOf("ID Dipendente")] = r.idDipendente;
        rowDet[headersDet.indexOf("Cognome Nome")] = r.dipendente;
        rowDet[headersDet.indexOf("Paga Registrata")] = r.pagaRegistrata;
        rowDet[headersDet.indexOf("Paga Oraria")] = parseFloat(r.pagaOraria) || 0;
        rowDet[headersDet.indexOf("Paga Mensile")] = parseFloat(r.pagaMensile) || 0;
        rowDet[headersDet.indexOf("Ore Lavorate")] = parseFloat(r.lavorate) || 0;
        rowDet[headersDet.indexOf("Ore Ferie")] = parseFloat(r.ferie) || 0;
        rowDet[headersDet.indexOf("Ore Permessi")] = parseFloat(r.permessi) || 0;
        rowDet[headersDet.indexOf("Ore Malattia")] = parseFloat(r.malattia) || 0;
        rowDet[headersDet.indexOf("Paga Lavorato")] = parseFloat(r.pagaPerLavorato) || 0;
        rowDet[headersDet.indexOf("Paga Ferie Permessi Malattia")] = parseFloat(r.pagaPerFPM) || 0;
        rowDet[headersDet.indexOf("Detrazioni")] = parseFloat(r.detrazioni) || 0;
        rowDet[headersDet.indexOf("Maggiorazioni")] = parseFloat(r.maggiorazioni) || 0;
        rowDet[headersDet.indexOf("Note Generali")] = r.noteGenerali || "";
        rowDet[headersDet.indexOf("Da Pagare")] = parseFloat(r.daPagare) || 0;
        rowDet[headersDet.indexOf("Stipendio Netto")] = parseFloat(r.stipendioNetto) || 0;
        rowDet[headersDet.indexOf("Paga Oraria Reale")] = parseFloat(r.pagaOrariaReale) || 0;
        rowDet[headersDet.indexOf("DataChiusura")] = timestamp;
        rowDet[headersDet.indexOf("ChiusoDa")] = utente;
        sheetDet.appendRow(rowDet);
      });
    }
    SpreadsheetApp.flush();
    
    // Registra attività
    registraAttivita(
      "Contabilità",
      "🔒",
      "#ef4444",
      `Paghe dipendenti blindate per il mese di <b>${mese} ${anno}</b>`
    );
    
    // Genera il file PDF stipendi su Google Drive
    const pdfUrl = generaPdfStipendi(mese, anno, righe);
    return pdfUrl;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Rimuove il flag 'Chiuso' per il mese/anno selezionato consentendo la modifica,
 * ma mantiene i dettagli storici nel foglio 'Dettaglio Mesi Chiusi Dipendenti GS'.
 */
function sbloccaMeseElaborato(mese, anno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = assicuraMesiChiusiSheet(ss);
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch(e) {}
  
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idxMese = headers.indexOf("Mese");
    const idxAnno = headers.indexOf("Anno");
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    
    let eliminati = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (String(data[i][idxMese]).trim() === String(mese).trim() && 
          String(data[i][idxAnno]).trim() === String(anno).trim()) {
        sheet.deleteRow(i + 2);
        eliminati++;
      }
    }
    SpreadsheetApp.flush();
    
    if (eliminati > 0) {
      // Registra attività
      registraAttivita(
        "Contabilità",
        "🔓",
        "#eab308",
        `Paghe dipendenti sbloccate per il mese di <b>${mese} ${anno}</b>`
      );
    }
    
    return eliminati > 0;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Genera un file PDF contenente stipendi, IBAN ed importo netto per il mese selezionato.
 */
function generaPdfStipendi(mese, anno, righe) {
  const nomeFile = `Stipendi_Mese_Di_${mese}_${anno}`;
  const ssTemp = SpreadsheetApp.create(nomeFile + "_temp");
  const sheet = ssTemp.getActiveSheet();
  sheet.setHiddenGridlines(false);
  
  // Intestazione
  sheet.getRange(1, 1).setValue(`STIPENDI MESE DI: ${mese.toUpperCase()} ${anno}`).setFontWeight("bold").setFontSize(14);
  
  const headers = ["NOME E COGNOME", "IBAN", "IMPORTO DA PAGARE"];
  sheet.appendRow(["", "", ""]); // Riga vuota
  sheet.appendRow(headers);
  
  const headerRange = sheet.getRange(3, 1, 1, headers.length);
  headerRange.setBackground("#334155").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("left");
  
  // Carica IBAN dei dipendenti
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDip = ss.getSheetByName("Anagrafica Dipendenti GS");
  const mappingIban = {};
  if (sheetDip) {
    const headersDip = sheetDip.getRange(1, 1, 1, sheetDip.getLastColumn()).getValues()[0];
    const rawDip = sheetDip.getRange(2, 1, sheetDip.getLastRow() - 1, sheetDip.getLastColumn()).getValues();
    const idxID = headersDip.indexOf("ID");
    const idxIBAN = headersDip.indexOf("IBAN");
    rawDip.forEach(row => {
      const id = String(row[idxID]).trim();
      const iban = idxIBAN > -1 ? String(row[idxIBAN]).trim() : "";
      if (id) mappingIban[id] = iban;
    });
  }
  
  const dataRows = [];
  righe.forEach(r => {
    const iban = mappingIban[r.idDipendente] || "";
    dataRows.push([
      r.dipendente,
      iban,
      r.stipendioNetto || 0
    ]);
  });
  
  if (dataRows.length > 0) {
    sheet.getRange(4, 1, dataRows.length, headers.length).setValues(dataRows);
    sheet.getRange(4, 3, dataRows.length, 1).setNumberFormat("€ #,##0.00");
    
    // Riga Totale Generale
    const lastRow = sheet.getLastRow();
    const sumRow = ["TOTALE GENERALE", "", `=SUM(C4:C${lastRow})`];
    sheet.appendRow(sumRow);
    
    const totalRowRange = sheet.getRange(lastRow + 1, 1, 1, headers.length);
    totalRowRange.setBackground("#cbd5e1").setFontWeight("bold");
  }
  
  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidth(2, 230);
  sheet.setColumnWidth(3, 150);
  
  SpreadsheetApp.flush();
  
  // Converti ed esporta in PDF
  const token = ScriptApp.getOAuthToken();
  const idTemp = ssTemp.getId();
  const url = "https://docs.google.com/spreadsheets/d/" + idTemp + "/export?exportFormat=pdf&format=pdf" +
              "&size=A4&portrait=true&fitw=true&gridlines=true&printtitle=false&sheetnames=false&fzr=false&gid=0";
              
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  
  const blob = response.getBlob().setName(`${nomeFile}.pdf`);
  
  // Salva il PDF in Google Drive
  const cartella = DriveApp.getRootFolder();
  const filePdf = cartella.createFile(blob);
  
  // Condividi in lettura
  filePdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // Cancella il file temporaneo spreadsheet
  DriveApp.getFileById(idTemp).setTrashed(true);
  
  return filePdf.getUrl();
}

/**
 * Recupera l'elenco delle regolazioni per un determinato dipendente, mese ed anno.
 */
function ottieniRegolazioni(idDipendente, mese, anno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = assicuraRegolazioniSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  const idxIDDip = headers.indexOf("ID Dipendente");
  const idxMese = headers.indexOf("Mese");
  const idxAnno = headers.indexOf("Anno");
  
  const filtrate = data.filter(row => {
    return String(row[idxIDDip]).trim() === String(idDipendente).trim() &&
           String(row[idxMese]).trim() === String(mese).trim() &&
           String(row[idxAnno]).trim() === String(anno).trim();
  });
  
  return filtrate.map(row => {
    const getVal = (col) => row[headers.indexOf(col)] !== undefined ? row[headers.indexOf(col)] : "";
    return {
      idRegolazione: getVal("ID Regolazione"),
      mese: getVal("Mese"),
      anno: getVal("Anno"),
      idDipendente: getVal("ID Dipendente"),
      dipendente: getVal("Dipendente"),
      tipo: getVal("Tipo"),
      importo: parseFloat(getVal("Importo")) || 0,
      motivazione: getVal("Motivazione")
    };
  });
}

/**
 * Aggiunge una nuova regolazione di stipendio (maggiorazione o detrazione) per un mese.
 */
function aggiungiRegolazione(mese, anno, idDipendente, dipendente, tipo, importo, motivazione) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = assicuraRegolazioniSheet(ss);
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch(e) {}
  
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    
    let utente = "Sistema";
    try {
      const email = Session.getActiveUser().getEmail();
      if (email) utente = email;
    } catch(err) {}
    
    const idReg = "REG-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss") + "-" + Math.floor(Math.random() * 1000);
    
    const row = new Array(headers.length).fill("");
    row[headers.indexOf("ID Regolazione")] = idReg;
    row[headers.indexOf("Mese")] = mese;
    row[headers.indexOf("Anno")] = anno;
    row[headers.indexOf("ID Dipendente")] = idDipendente;
    row[headers.indexOf("Dipendente")] = dipendente;
    row[headers.indexOf("Tipo")] = tipo;
    row[headers.indexOf("Importo")] = parseFloat(importo) || 0;
    row[headers.indexOf("Motivazione")] = motivazione;
    row[headers.indexOf("DataCreazione")] = timestamp;
    row[headers.indexOf("CreatoDa")] = utente;
    
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return true;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Elimina una regolazione di stipendio specifica tramite ID.
 */
function eliminaRegolazione(idRegolazione) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NOME_FOGLIO_REGOLAZIONI);
  if (!sheet) return false;
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch(e) {}
  
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idxID = headers.indexOf("ID Regolazione");
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    
    for (let i = data.length - 1; i >= 0; i--) {
      if (String(data[i][idxID]).trim() === String(idRegolazione).trim()) {
        sheet.deleteRow(i + 2);
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
 * Recupera i dati dell'elaborato mensile per un determinato mese ed anno.
 * Tutti i conteggi e le note sono assemblati dinamicamente.
 */
function ottieniElaboratoMensile(mese, anno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const chiuso = isMeseChiuso(mese, anno);
  
  if (chiuso) {
    const sheetDet = assicuraDettaglioMesiChiusiDipSheet(ss);
    const lastRowDet = sheetDet.getLastRow();
    if (lastRowDet > 1) {
      const headersDet = sheetDet.getRange(1, 1, 1, sheetDet.getLastColumn()).getValues()[0];
      const dataDet = sheetDet.getRange(2, 1, lastRowDet - 1, sheetDet.getLastColumn()).getValues();
      
      const idxMese = headersDet.indexOf("Mese");
      const idxAnno = headersDet.indexOf("Anno");
      
      const righeStoriche = [];
      dataDet.forEach(row => {
        const m = String(row[idxMese]).trim();
        const a = String(row[idxAnno]).trim();
        if (m === String(mese) && a === String(anno)) {
          const getVal = (col) => row[headersDet.indexOf(col)] !== undefined ? row[headersDet.indexOf(col)] : "";
          
          righeStoriche.push({
            idDipendente: getVal("ID Dipendente"),
            dipendente: getVal("Cognome Nome"),
            pagaRegistrata: getVal("Paga Registrata"),
            pagaOraria: parseFloat(getVal("Paga Oraria")) || 0,
            pagaMensile: parseFloat(getVal("Paga Mensile")) || 0,
            lavorate: parseFloat(getVal("Ore Lavorate")) || 0,
            ferie: parseFloat(getVal("Ore Ferie")) || 0,
            permessi: parseFloat(getVal("Ore Permessi")) || 0,
            malattia: parseFloat(getVal("Ore Malattia")) || 0,
            pagaPerLavorato: parseFloat(getVal("Paga Lavorato")) || 0,
            pagaPerFPM: parseFloat(getVal("Paga Ferie Permessi Malattia")) || 0,
            detrazioni: parseFloat(getVal("Detrazioni")) || 0,
            maggiorazioni: parseFloat(getVal("Maggiorazioni")) || 0,
            noteGenerali: getVal("Note Generali"),
            daPagare: parseFloat(getVal("Da Pagare")) || 0,
            stipendioNetto: parseFloat(getVal("Stipendio Netto")) || 0,
            pagaOrariaReale: parseFloat(getVal("Paga Oraria Reale")) || 0
          });
        }
      });
      return { righe: righeStoriche, chiuso: true };
    }
  }
  
  // 1. Carica i dipendenti ed ore fresche dal registro presenze (Mese Aperto -> Calcolo dinamico)
  const datiFreschi = compilaNuovoElaborato(mese, anno);
  if (datiFreschi.length === 0) return { righe: [], chiuso: false };
  
  // 2. Carica tutte le regolazioni stipendi per il mese e anno corrente
  const sheetReg = assicuraRegolazioniSheet(ss);
  const lastRowReg = sheetReg.getLastRow();
  const regMappa = {}; // ID_DIP -> [ { tipo, importo, motivazione } ]
  
  if (lastRowReg > 1) {
    const headersReg = sheetReg.getRange(1, 1, 1, sheetReg.getLastColumn()).getValues()[0];
    const dataReg = sheetReg.getRange(2, 1, lastRowReg - 1, sheetReg.getLastColumn()).getValues();
    
    const idxMese = headersReg.indexOf("Mese");
    const idxAnno = headersReg.indexOf("Anno");
    const idxIDDip = headersReg.indexOf("ID Dipendente");
    const idxTipo = headersReg.indexOf("Tipo");
    const idxImporto = headersReg.indexOf("Importo");
    const idxMotivazione = headersReg.indexOf("Motivazione");
    
    dataReg.forEach(row => {
      const m = String(row[idxMese]).trim();
      const a = String(row[idxAnno]).trim();
      if (m !== String(mese) || a !== String(anno)) return;
      
      const idDip = String(row[idxIDDip]).trim();
      const tipo = String(row[idxTipo]).trim();
      const importo = parseFloat(row[idxImporto]) || 0;
      const motivazione = String(row[idxMotivazione]).trim();
      
      if (!regMappa[idDip]) {
        regMappa[idDip] = [];
      }
      regMappa[idDip].push({ tipo, importo, motivazione });
    });
  }
  
  // 3. Unisci i dati freschi con le regolazioni
  const righeFinali = datiFreschi.map(fresco => {
    const regolazioni = regMappa[fresco.idDipendente] || [];
    
    let sumDetrazioni = 0;
    let sumMaggiorazioni = 0;
    const noteParti = [];
    
    regolazioni.forEach(reg => {
      if (reg.tipo === "Detrazione") {
        sumDetrazioni += reg.importo;
        noteParti.push(`-${reg.importo.toFixed(2)} € (${reg.motivazione})`);
      } else if (reg.tipo === "Maggiorazione") {
        sumMaggiorazioni += reg.importo;
        noteParti.push(`+${reg.importo.toFixed(2)} € (${reg.motivazione})`);
      }
    });
    
    fresco.detrazioni = sumDetrazioni;
    fresco.maggiorazioni = sumMaggiorazioni;
    fresco.noteGenerali = noteParti.join(", ");
    
    // Calcoliamo i totali finali non modificabili
    fresco.daPagare = fresco.pagaPerLavorato + fresco.pagaPerFPM + sumMaggiorazioni - sumDetrazioni;
    fresco.stipendioNetto = fresco.daPagare;
    fresco.pagaOrariaReale = fresco.lavorate > 0 ? (fresco.stipendioNetto / fresco.lavorate) : 0;
    
    return fresco;
  });
  
  return {
    righe: righeFinali,
    chiuso: chiuso
  };
}

/**
 * Compila una nuova elaborazione stipendi leggendo le ore lavorate ed i dettagli anagrafici.
 */
function compilaNuovoElaborato(mese, anno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Carica i dipendenti attivi o in forza
  const sheetDip = ss.getSheetByName("Anagrafica Dipendenti GS");
  if (!sheetDip) return [];
  
  const headersDip = sheetDip.getRange(1, 1, 1, sheetDip.getLastColumn()).getValues()[0];
  const lastRowDip = sheetDip.getLastRow();
  if (lastRowDip <= 1) return [];
  
  const rawDip = sheetDip.getRange(2, 1, lastRowDip - 1, sheetDip.getLastColumn()).getValues();
  
  const idxID = headersDip.indexOf("ID");
  const idxCognome = headersDip.indexOf("Cognome");
  const idxNome = headersDip.indexOf("Nome");
  const idxStato = headersDip.indexOf("Stato");
  const idxPagaOraria = headersDip.indexOf("PagaOraria");
  const idxPagaMensile = headersDip.indexOf("PagaMensile");
  const idxDataCessazione = headersDip.indexOf("DataCessazione");
  
  // Recupera tariffe/paghe storiche se questo mese era stato precedentemente chiuso ed è ora sbloccato
  const mapTariffeStoriche = {};
  const sheetDet = assicuraDettaglioMesiChiusiDipSheet(ss);
  const lastRowDet = sheetDet.getLastRow();
  if (lastRowDet > 1) {
    const headersDet = sheetDet.getRange(1, 1, 1, sheetDet.getLastColumn()).getValues()[0];
    const dataDet = sheetDet.getRange(2, 1, lastRowDet - 1, sheetDet.getLastColumn()).getValues();
    const idxMeseDet = headersDet.indexOf("Mese");
    const idxAnnoDet = headersDet.indexOf("Anno");
    const idxIDDipDet = headersDet.indexOf("ID Dipendente");
    const idxPagaRegDet = headersDet.indexOf("Paga Registrata");
    const idxPagaOrDet = headersDet.indexOf("Paga Oraria");
    const idxPagaMenDet = headersDet.indexOf("Paga Mensile");
    
    dataDet.forEach(row => {
      const m = String(row[idxMeseDet]).trim();
      const a = String(row[idxAnnoDet]).trim();
      if (m === String(mese) && a === String(anno)) {
        const idDip = String(row[idxIDDipDet]).trim();
        const pagaReg = String(row[idxPagaRegDet]).trim();
        const pagaOr = parseFloat(row[idxPagaOrDet]) || 0;
        const pagaMen = parseFloat(row[idxPagaMenDet]) || 0;
        
        mapTariffeStoriche[idDip] = {
          pagaRegistrata: pagaReg,
          pagaOraria: pagaOr,
          pagaMensile: pagaMen
        };
      }
    });
  }

  const dipendenti = [];
  rawDip.forEach(row => {
    const id = row[idxID];
    if (!id || String(id).trim() === "") return;
    
    const stato = String(row[idxStato]).trim();
    if (stato.toLowerCase() === "cessato") {
      // Controlla se la data di cessazione è nel futuro o nello stesso mese selezionato
      const dataCessazioneVal = idxDataCessazione > -1 ? row[idxDataCessazione] : "";
      if (dataCessazioneVal) {
        let dataCess = null;
        if (dataCessazioneVal instanceof Date) {
          dataCess = dataCessazioneVal;
        } else {
          const parts = String(dataCessazioneVal).split("/");
          if (parts.length === 3) {
            dataCess = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          }
        }
        if (dataCess) {
          const mesiNomi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
          const meseIdxSelezionato = mesiNomi.indexOf(mese);
          const annoSelezionato = parseInt(anno, 10);
          
          const cessAnno = dataCess.getFullYear();
          const cessMese = dataCess.getMonth();
          
          // Se la data di cessazione è antecedente al mese selezionato, allora escludiamo il dipendente
          if (cessAnno < annoSelezionato || (cessAnno === annoSelezionato && cessMese < meseIdxSelezionato)) {
            return;
          }
        } else {
          return; // Salta se cessato con data non valida
        }
      } else {
        return; // Salta se cessato senza data
      }
    }
    
    const idStr = String(id).trim();
    let pagaOraria = parseFloat(row[idxPagaOraria]) || 0;
    let pagaMensile = parseFloat(row[idxPagaMensile]) || 0;
    let pagaRegistrata = "";
    
    // Override se esiste la paga storica congelata
    if (mapTariffeStoriche[idStr]) {
      const stor = mapTariffeStoriche[idStr];
      pagaOraria = stor.pagaOraria;
      pagaMensile = stor.pagaMensile;
      pagaRegistrata = stor.pagaRegistrata;
    } else {
      if (pagaMensile > 0) {
        pagaRegistrata = pagaMensile.toFixed(2) + " €/mese";
      } else if (pagaOraria > 0) {
        pagaRegistrata = pagaOraria.toFixed(2) + " €/ora";
      } else {
        pagaRegistrata = "-";
      }
    }
    
    dipendenti.push({
      id: idStr,
      nomeCompleto: (String(row[idxCognome]).trim() + " " + String(row[idxNome]).trim()).toUpperCase(),
      pagaRegistrata: pagaRegistrata,
      pagaOraria: pagaOraria,
      pagaMensile: pagaMensile
    });
  });
  
  // 2. Carica le ore dal Registro Ore GS per il mese e anno specificati
  const sheetOre = ss.getSheetByName("Registro Ore GS");
  const oreMappa = {}; // ID_DIP -> { lavorate, ferie, permessi, malattia }
  
  if (sheetOre && sheetOre.getLastRow() > 1) {
    const headersOre = sheetOre.getRange(1, 1, 1, sheetOre.getLastColumn()).getValues()[0];
    const rawOre = sheetOre.getRange(2, 1, sheetOre.getLastRow() - 1, sheetOre.getLastColumn()).getValues();
    
    const idxMese = headersOre.indexOf("Mese Competenza");
    const idxAnno = headersOre.indexOf("Anno Competenza");
    const idxIDDip = headersOre.indexOf("ID Dipendente");
    const idxTipoOre = headersOre.indexOf("Tipo Ore");
    const idxOreLavorate = headersOre.indexOf("Ore Lavorate");
    
    rawOre.forEach(row => {
      const m = String(row[idxMese]).trim();
      const a = String(row[idxAnno]).trim();
      if (m !== String(mese) || a !== String(anno)) return;
      
      const idDip = String(row[idxIDDip]).trim();
      const tipoOre = String(row[idxTipoOre]).trim();
      const ore = parseFloat(row[idxOreLavorate]) || 0;
      
      if (!oreMappa[idDip]) {
        oreMappa[idDip] = { lavorate: 0, ferie: 0, permessi: 0, malattia: 0 };
      }
      
      const tipoLower = tipoOre.toLowerCase();
      if (tipoLower === "lavoro ordinario") {
        oreMappa[idDip].lavorate += ore;
      } else if (tipoLower === "ferie") {
        oreMappa[idDip].ferie += ore;
      } else if (tipoLower.indexOf("permesso") > -1) {
        oreMappa[idDip].permessi += ore;
      } else if (tipoLower === "malattia" || tipoLower === "infortunio") {
        oreMappa[idDip].malattia += ore;
      }
    });
  }
  
  // 3. Uniamo le informazioni e calcoliamo i totali preliminari
  const result = dipendenti.map(d => {
    const ore = oreMappa[d.id] || { lavorate: 0, ferie: 0, permessi: 0, malattia: 0 };
    
    let pagaPerLavorato = 0;
    let pagaPerFPM = 0;
    
    if (d.pagaMensile > 0) {
      pagaPerLavorato = d.pagaMensile;
      pagaPerFPM = 0;
    } else if (d.pagaOraria > 0) {
      pagaPerLavorato = ore.lavorate * d.pagaOraria;
      pagaPerFPM = (ore.ferie + ore.permessi + ore.malattia) * d.pagaOraria;
    }
    
    const daPagare = pagaPerLavorato + pagaPerFPM;
    
    return {
      mese: mese,
      anno: anno,
      idDipendente: d.id,
      dipendente: d.nomeCompleto,
      ferie: ore.ferie,
      permessi: ore.permessi,
      malattia: ore.malattia,
      lavorate: ore.lavorate,
      pagaRegistrata: d.pagaRegistrata,
      pagaOraria: d.pagaOraria,
      pagaMensile: d.pagaMensile,
      pagaPerLavorato: pagaPerLavorato,
      pagaPerFPM: pagaPerFPM,
      detrazioni: 0,
      notaDetrazioni: "",
      maggiorazioni: 0,
      notaMaggiorazioni: "",
      daPagare: daPagare,
      stipendioNetto: daPagare,
      pagaOrariaReale: ore.lavorate > 0 ? (daPagare / ore.lavorate) : 0,
      noteGenerali: ""
    };
  });
  
  return result;
}

/**
 * Esporta il report mensile in un nuovo Google Spreadsheet standalone.
 */
function esportaGoogleSheetElaborato(mese, anno, righe) {
  try {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const nomeFile = `Elaborato_Mensile_${mese}_${anno}_${timestamp}`;
    const ssNuovo = SpreadsheetApp.create(nomeFile);
    const sheet = ssNuovo.getActiveSheet();
    sheet.setName("Riepilogo Stipendi");
    sheet.setHiddenGridlines(false);
    
    // Titolo
    sheet.getRange(1, 1).setValue(`M2I S.r.l. - Elaborato Mensile Dipendenti (${mese} ${anno})`).setFontWeight("bold").setFontSize(13);
    
    const headers = [
      "RIEPILOGO DIPENDENTI", "FERIE", "PERMESSI", "MALATTIA", "LAVORATE", 
      "PAGA REGISTRATA", "PAGA PER LAVORATO", "PAGA PER F P M", "DETRAZIONI", "MAGGIORAZIONI",
      "DA PAGARE", "STIPENDIO NETTO", "PAGA ORARIA REALE", "NOTE"
    ];
    
    sheet.appendRow(new Array(headers.length).fill("")); // riga vuota
    sheet.appendRow(headers);
    
    const headerRange = sheet.getRange(3, 1, 1, headers.length);
    headerRange.setBackground("#10b981")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
               
    const dataRows = [];
    righe.forEach(r => {
      dataRows.push([
        r.dipendente,
        r.ferie || 0,
        r.permessi || 0,
        r.malattia || 0,
        r.lavorate || 0,
        r.pagaRegistrata,
        r.pagaPerLavorato || 0,
        r.pagaPerFPM || 0,
        r.detrazioni || 0,
        r.maggiorazioni || 0,
        r.daPagare || 0,
        r.stipendioNetto || 0,
        r.pagaOrariaReale || 0,
        r.noteGenerali || ""
      ]);
    });
    
    if (dataRows.length > 0) {
      sheet.getRange(4, 1, dataRows.length, headers.length).setValues(dataRows);
      sheet.getRange(4, 2, dataRows.length, 4).setNumberFormat("#,##0.00");
      sheet.getRange(4, 7, dataRows.length, 7).setNumberFormat("€ #,##0.00");
      
      const lastRow = sheet.getLastRow();
      const formulaSum = (col) => `=SUM(${col}4:${col}${lastRow})`;
      const sumRow = [
        "TOTALE GENERALE",
        formulaSum("B"),
        formulaSum("C"),
        formulaSum("D"),
        formulaSum("E"),
        "",
        formulaSum("G"),
        formulaSum("H"),
        formulaSum("I"),
        formulaSum("J"),
        formulaSum("K"),
        formulaSum("L"),
        "",
        ""
      ];
      sheet.appendRow(sumRow);
      
      const totalRowRange = sheet.getRange(lastRow + 1, 1, 1, headers.length);
      totalRowRange.setBackground("#e2e8f0").setFontWeight("bold");
    }
    
    sheet.autoResizeColumns(1, headers.length);
    return ssNuovo.getUrl();
  } catch (err) {
    throw new Error("Errore durante la creazione del file Google Sheet: " + err.message);
  }
}

/**
 * Apre la modale standalone per la gestione delle variazioni (maggiorazioni/detrazioni) dipendente.
 */
function apriMagDetDipendente() {
  const html = HtmlService.createHtmlOutputFromFile("MagDetDipendente")
    .setWidth(650)
    .setHeight(600)
    .setTitle("Mag. o det. dipendente");
  SpreadsheetApp.getUi().showModalDialog(html, "Mag. o det. dipendente");
}

/**
 * Recupera l'elenco dei dipendenti attivi ordinarli in ordine alfabetico.
 */
function recuperaDipendentiAttivi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDip = ss.getSheetByName("Anagrafica Dipendenti GS");
  if (!sheetDip) return [];
  
  const headers = sheetDip.getRange(1, 1, 1, sheetDip.getLastColumn()).getValues()[0];
  const lastRow = sheetDip.getLastRow();
  if (lastRow <= 1) return [];
  
  const rawDip = sheetDip.getRange(2, 1, lastRow - 1, sheetDip.getLastColumn()).getValues();
  const idxID = headers.indexOf("ID");
  const idxCognome = headers.indexOf("Cognome");
  const idxNome = headers.indexOf("Nome");
  const idxStato = headers.indexOf("Stato");
  
  const dipendenti = [];
  rawDip.forEach(row => {
    const id = row[idxID];
    const stato = String(row[idxStato]).trim();
    if (id && stato.toLowerCase() !== "cessato") {
      const nomeCompleto = (String(row[idxCognome]).trim() + " " + String(row[idxNome]).trim()).toUpperCase();
      dipendenti.push({ id: String(id).trim(), nome: nomeCompleto });
    }
  });
  
  return dipendenti.sort((a,b) => a.nome.localeCompare(b.nome));
}
