//======================================================
// MODULO ELABORATO MENSILE CLIENTI
//======================================================

const NOME_FOGLIO_REGOLAZIONI_CLIENTI = "Regolazioni Clienti GS";
const NOME_FOGLIO_MESI_CHIUSI_CLIENTI = "Mesi Chiusi Clienti GS";
const NOME_FOGLIO_DETTAGLIO_MESI_CHIUSI = "Dettaglio Mesi Chiusi Clienti GS";

/**
 * Apre la finestra modale per l'elaborato mensile clienti.
 */
function apriElaboratoClienti() {
  const html = HtmlService.createHtmlOutputFromFile("ElaboratoClienti")
    .setWidth(1250)
    .setHeight(750)
    .setTitle("Elaborato Mensile Clienti");
  SpreadsheetApp.getUi().showModalDialog(html, "Elaborato Mensile Clienti");
}

/**
 * Apre la modale standalone per sconti/maggiorazioni clienti.
 */
function apriMagDetCliente() {
  const html = HtmlService.createHtmlOutputFromFile("MagDetCliente")
    .setWidth(650)
    .setHeight(600)
    .setTitle("Sconti o Magg. Cliente");
  SpreadsheetApp.getUi().showModalDialog(html, "Sconti o Magg. Cliente");
}

/**
 * Assicura l'esistenza del foglio di calcolo delle regolazioni clienti (sconti/maggiorazioni).
 */
function assicuraRegolazioniClientiSheet(ss) {
  let sheet = ss.getSheetByName(NOME_FOGLIO_REGOLAZIONI_CLIENTI);
  if (!sheet) {
    sheet = ss.insertSheet(NOME_FOGLIO_REGOLAZIONI_CLIENTI);
    const headers = [
      "ID Regolazione", "Mese", "Anno", "ID Cliente", "Cliente", 
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
 * Assicura l'esistenza del foglio di log dei mesi chiusi per i clienti.
 */
function assicuraMesiChiusiClientiSheet(ss) {
  let sheet = ss.getSheetByName(NOME_FOGLIO_MESI_CHIUSI_CLIENTI);
  if (!sheet) {
    sheet = ss.insertSheet(NOME_FOGLIO_MESI_CHIUSI_CLIENTI);
    const headers = ["Mese", "Anno", "Stato", "DataChiusura", "ChiusoDa"];
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#475569").setFontColor("#ffffff").setFontWeight("bold");
    SpreadsheetApp.flush();
  }
  return sheet;
}

/**
 * Assicura l'esistenza del foglio contenente il dettaglio storico dei mesi chiusi per i clienti.
 */
function assicuraDettaglioMesiChiusiSheet(ss) {
  let sheet = ss.getSheetByName(NOME_FOGLIO_DETTAGLIO_MESI_CHIUSI);
  if (!sheet) {
    sheet = ss.insertSheet(NOME_FOGLIO_DETTAGLIO_MESI_CHIUSI);
    const headers = [
      "Mese", "Anno", "ID Cliente", "Ragione Sociale", "Tipo Fatturazione", 
      "Valore Contrattuale", "Ore Lavorate", "Base Imponibile", "Sconti", 
      "Maggiorazioni", "Imponibile", "Aliquota IVA", "Importo IVA", "Importo Totale", 
      "Note", "DataChiusura", "ChiusoDa"
    ];
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#4f46e5").setFontColor("#ffffff").setFontWeight("bold");
    SpreadsheetApp.flush();
  }
  return sheet;
}

/**
 * Verifica se un determinato mese ed anno è contrassegnato come Chiuso per i clienti.
 */
function isMeseChiusoClienti(mese, anno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = assicuraMesiChiusiClientiSheet(ss);
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
 * Registra lo stato "Chiuso" per il mese/anno selezionato e genera il PDF di fatturazione.
 */
function chiudiMeseClienti(mese, anno, righe) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = assicuraMesiChiusiClientiSheet(ss);
  
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
    
    // Rimuovi record duplicati precedenti
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

    // 1. Inizializza il foglio di dettaglio storico
    const sheetDet = assicuraDettaglioMesiChiusiSheet(ss);
    
    // 2. Rimuovi record di dettaglio storici preesistenti dello stesso mese/anno per sovrascrittura pulita
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
    
    // 3. Salva riga per riga ciascuna delle righe elaborate
    if (righe && righe.length > 0) {
      righe.forEach(r => {
        const rowDet = new Array(headersDet.length).fill("");
        rowDet[headersDet.indexOf("Mese")] = mese;
        rowDet[headersDet.indexOf("Anno")] = anno;
        rowDet[headersDet.indexOf("ID Cliente")] = r.idCliente;
        rowDet[headersDet.indexOf("Ragione Sociale")] = r.cliente;
        rowDet[headersDet.indexOf("Tipo Fatturazione")] = r.tipoFatturazione;
        rowDet[headersDet.indexOf("Valore Contrattuale")] = r.valoreContrattuale;
        rowDet[headersDet.indexOf("Ore Lavorate")] = parseFloat(r.oreLavorate) || 0;
        rowDet[headersDet.indexOf("Base Imponibile")] = parseFloat(r.baseImponibile) || 0;
        rowDet[headersDet.indexOf("Sconti")] = parseFloat(r.sconto) || 0;
        rowDet[headersDet.indexOf("Maggiorazioni")] = parseFloat(r.maggiorazione) || 0;
        rowDet[headersDet.indexOf("Imponibile")] = parseFloat(r.imponibile) || 0;
        rowDet[headersDet.indexOf("Aliquota IVA")] = parseFloat(r.aliquotaIva) || 0;
        rowDet[headersDet.indexOf("Importo IVA")] = parseFloat(r.iva) || 0;
        rowDet[headersDet.indexOf("Importo Totale")] = parseFloat(r.totale) || 0;
        rowDet[headersDet.indexOf("Note")] = r.noteGenerali || "";
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
      `Fatturazione clienti blindata per il mese di <b>${mese} ${anno}</b>`
    );
    
    // Genera il PDF delle fatturazioni clienti
    const pdfUrl = generaPdfClienti(mese, anno, righe);
    return pdfUrl;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Rimuove il flag 'Chiuso' per il mese/anno selezionato consentendo la modifica,
 * ma mantiene i dettagli storici nel foglio 'Dettaglio Mesi Chiusi Clienti GS'.
 */
function sbloccaMeseClienti(mese, anno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = assicuraMesiChiusiClientiSheet(ss);
  
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
        `Fatturazione clienti sbloccata per il mese di <b>${mese} ${anno}</b>`
      );
    }
    
    return eliminati > 0;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Genera il file PDF per la fatturazione del mese.
 */
function generaPdfClienti(mese, anno, righe) {
  const nomeFile = `Fatturazione_Mese_Di_${mese}_${anno}`;
  const ssTemp = SpreadsheetApp.create(nomeFile + "_temp");
  const sheet = ssTemp.getActiveSheet();
  sheet.setHiddenGridlines(false);
  
  // Intestazione
  sheet.getRange(1, 1).setValue(`FATTURAZIONE MESE DI: ${mese.toUpperCase()} ${anno}`).setFontWeight("bold").setFontSize(14);
  
  const headers = ["CLIENTE", "PARTITA IVA", "PEC / CODICE UNIVOCO", "IMPONIBILE", "IVA", "TOTALE FATTURA"];
  sheet.appendRow(["", "", "", "", "", ""]); // riga vuota
  sheet.appendRow(headers);
  
  const headerRange = sheet.getRange(3, 1, 1, headers.length);
  headerRange.setBackground("#334155").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("left");
  
  // Carica anagrafica clienti per PEC e P.IVA
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetCli = ss.getSheetByName("Anagrafica Clienti GS");
  const mappingDati = {}; // ID -> { pIva, pec }
  
  if (sheetCli) {
    const headersCli = sheetCli.getRange(1, 1, 1, sheetCli.getLastColumn()).getValues()[0];
    const rawCli = sheetCli.getRange(2, 1, sheetCli.getLastRow() - 1, sheetCli.getLastColumn()).getValues();
    const idxID = headersCli.indexOf("ID Cliente");
    const idxPIva = headersCli.indexOf("P. IVA");
    const idxPec = headersCli.indexOf("PEC / Codice Univoco");
    
    rawCli.forEach(row => {
      const id = String(row[idxID]).trim();
      const pIva = idxPIva > -1 ? String(row[idxPIva]).trim() : "";
      const pec = idxPec > -1 ? String(row[idxPec]).trim() : "";
      if (id) {
        mappingDati[id] = { pIva, pec };
      }
    });
  }
  
  const dataRows = [];
  righe.forEach(r => {
    const d = mappingDati[r.idCliente] || { pIva: "", pec: "" };
    dataRows.push([
      r.cliente,
      d.pIva,
      d.pec,
      r.imponibile || 0,
      r.iva || 0,
      r.totale || 0
    ]);
  });
  
  if (dataRows.length > 0) {
    sheet.getRange(4, 1, dataRows.length, headers.length).setValues(dataRows);
    sheet.getRange(4, 4, dataRows.length, 3).setNumberFormat("€ #,##0.00");
    
    // Riga Totale Generale
    const lastRow = sheet.getLastRow();
    const sumRow = ["TOTALE GENERALE", "", "", `=SUM(D4:D${lastRow})`, `=SUM(E4:E${lastRow})`, `=SUM(F4:F${lastRow})`];
    sheet.appendRow(sumRow);
    
    const totalRowRange = sheet.getRange(lastRow + 1, 1, 1, headers.length);
    totalRowRange.setBackground("#cbd5e1").setFontWeight("bold");
  }
  
  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 130);
  
  SpreadsheetApp.flush();
  
  // Esportazione PDF
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
  
  const cartella = DriveApp.getRootFolder();
  const filePdf = cartella.createFile(blob);
  filePdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  DriveApp.getFileById(idTemp).setTrashed(true);
  
  return filePdf.getUrl();
}

/**
 * Inserisce o rimuove regolazioni per i clienti.
 */
function ottieniRegolazioniClienti(idCliente, mese, anno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = assicuraRegolazioniClientiSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  const idxID = headers.indexOf("ID Cliente");
  const idxMese = headers.indexOf("Mese");
  const idxAnno = headers.indexOf("Anno");
  
  const filtrate = data.filter(row => {
    return String(row[idxID]).trim() === String(idCliente).trim() &&
           String(row[idxMese]).trim() === String(mese).trim() &&
           String(row[idxAnno]).trim() === String(anno).trim();
  });
  
  return filtrate.map(row => {
    const getVal = (col) => row[headers.indexOf(col)] !== undefined ? row[headers.indexOf(col)] : "";
    return {
      idRegolazione: getVal("ID Regolazione"),
      mese: getVal("Mese"),
      anno: getVal("Anno"),
      idCliente: getVal("ID Cliente"),
      cliente: getVal("Cliente"),
      tipo: getVal("Tipo"),
      importo: parseFloat(getVal("Importo")) || 0,
      motivazione: getVal("Motivazione")
    };
  });
}

function aggiungiRegolazioneCliente(mese, anno, idCliente, cliente, tipo, importo, motivazione) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = assicuraRegolazioniClientiSheet(ss);
  
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
    
    const idReg = "REGCLI-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss") + "-" + Math.floor(Math.random() * 1000);
    
    const row = new Array(headers.length).fill("");
    row[headers.indexOf("ID Regolazione")] = idReg;
    row[headers.indexOf("Mese")] = mese;
    row[headers.indexOf("Anno")] = anno;
    row[headers.indexOf("ID Cliente")] = idCliente;
    row[headers.indexOf("Cliente")] = cliente;
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

function eliminaRegolazioneCliente(idRegolazione) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NOME_FOGLIO_REGOLAZIONI_CLIENTI);
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
 * Ottiene l'elaborato mensile per i clienti.
 */
function ottieniElaboratoClienti(mese, anno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const chiuso = isMeseChiusoClienti(mese, anno);
  
  if (chiuso) {
    const sheetDet = assicuraDettaglioMesiChiusiSheet(ss);
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
            idCliente: getVal("ID Cliente"),
            cliente: getVal("Ragione Sociale"),
            tipoFatturazione: getVal("Tipo Fatturazione"),
            valoreContrattuale: getVal("Valore Contrattuale"),
            oreLavorate: parseFloat(getVal("Ore Lavorate")) || 0,
            baseImponibile: parseFloat(getVal("Base Imponibile")) || 0,
            sconto: parseFloat(getVal("Sconti")) || 0,
            maggiorazione: parseFloat(getVal("Maggiorazioni")) || 0,
            imponibile: parseFloat(getVal("Imponibile")) || 0,
            aliquotaIva: parseFloat(getVal("Aliquota IVA")) || 0,
            iva: parseFloat(getVal("Importo IVA")) || 0,
            totale: parseFloat(getVal("Importo Totale")) || 0,
            costoOrario: parseFloat(getVal("Ore Lavorate")) > 0 ? (parseFloat(getVal("Imponibile")) / parseFloat(getVal("Ore Lavorate"))) : 0,
            noteGenerali: getVal("Note")
          });
        }
      });
      return { righe: righeStoriche, chiuso: true };
    }
  }
  
  // 1. Carica i clienti attivi (Mese ancora Aperto -> Calcolo dinamico)
  const sheetCli = ss.getSheetByName("Anagrafica Clienti GS");
  if (!sheetCli) return { righe: [], chiuso: false };
  
  const headersCli = sheetCli.getRange(1, 1, 1, sheetCli.getLastColumn()).getValues()[0];
  const lastRowCli = sheetCli.getLastRow();
  if (lastRowCli <= 1) return { righe: [], chiuso: false };
  
  const rawCli = sheetCli.getRange(2, 1, lastRowCli - 1, sheetCli.getLastColumn()).getValues();
  
  const idxID = headersCli.indexOf("ID Cliente");
  const idxRagSoc = headersCli.indexOf("Ragione Sociale");
  const idxTipoFat = headersCli.indexOf("Tipo Fatturazione");
  const idxFisso = headersCli.indexOf("Fisso Mensile");
  const idxTariffa = headersCli.indexOf("Tariffa Oraria");
  const idxIva = headersCli.indexOf("Aliquota IVA");
  const idxAttivo = headersCli.indexOf("Attivo");

  // Recupera tariffe storiche se questo mese era stato precedentemente chiuso ed è ora sbloccato
  const mapTariffeStoriche = {};
  const sheetDet = assicuraDettaglioMesiChiusiSheet(ss);
  const lastRowDet = sheetDet.getLastRow();
  if (lastRowDet > 1) {
    const headersDet = sheetDet.getRange(1, 1, 1, sheetDet.getLastColumn()).getValues()[0];
    const dataDet = sheetDet.getRange(2, 1, lastRowDet - 1, sheetDet.getLastColumn()).getValues();
    const idxMeseDet = headersDet.indexOf("Mese");
    const idxAnnoDet = headersDet.indexOf("Anno");
    const idxIDCliDet = headersDet.indexOf("ID Cliente");
    const idxTipoFatDet = headersDet.indexOf("Tipo Fatturazione");
    const idxValoreContrDet = headersDet.indexOf("Valore Contrattuale");
    const idxIvaDet = headersDet.indexOf("Aliquota IVA");
    
    dataDet.forEach(row => {
      const m = String(row[idxMeseDet]).trim();
      const a = String(row[idxAnnoDet]).trim();
      if (m === String(mese) && a === String(anno)) {
        const idCli = String(row[idxIDCliDet]).trim();
        const tipoFat = String(row[idxTipoFatDet]).trim();
        const valoreContr = String(row[idxValoreContrDet]).trim();
        const alIva = parseFloat(row[idxIvaDet]) || 22;
        
        // Esegui il parsing della tariffa numerica (es. "350.00 €/mese" -> 350)
        const parts = valoreContr.split(" ");
        const tariffa = parseFloat(parts[0]) || 0;
        
        mapTariffeStoriche[idCli] = {
          tipoFatturazione: tipoFat,
          valoreTariffa: tariffa,
          aliquotaIva: alIva
        };
      }
    });
  }
  
  const clienti = [];
  rawCli.forEach(row => {
    const id = row[idxID];
    const attivo = String(row[idxAttivo]).trim().toUpperCase();
    if (id && (attivo === "SI" || attivo === "SÌ" || attivo === "")) {
      const idStr = String(id).trim();
      let tipoFat = String(row[idxTipoFat]).trim();
      let fissoMensile = parseFloat(row[idxFisso]) || 0;
      let tariffaOraria = parseFloat(row[idxTariffa]) || 0;
      let aliquotaIva = parseFloat(row[idxIva]) || 22;
      
      // Override se esiste la tariffa storica congelata
      if (mapTariffeStoriche[idStr]) {
        const stor = mapTariffeStoriche[idStr];
        tipoFat = stor.tipoFatturazione;
        if (tipoFat === "Fisso" || tipoFat === "Fisso Mensile" || tipoFat === "Bimestrale") {
          fissoMensile = stor.valoreTariffa;
        } else {
          tariffaOraria = stor.valoreTariffa;
        }
        aliquotaIva = stor.aliquotaIva;
      }
      
      clienti.push({
        id: idStr,
        ragioneSociale: String(row[idxRagSoc]).trim().toUpperCase(),
        tipoFatturazione: tipoFat,
        fissoMensile: fissoMensile,
        tariffaOraria: tariffaOraria,
        aliquotaIva: aliquotaIva
      });
    }
  });
  
  // 2. Carica le ore dal Registro Ore GS
  const sheetOre = ss.getSheetByName("Registro Ore GS");
  const oreMappa = {}; // ID_CLIENTE -> ore
  if (sheetOre && sheetOre.getLastRow() > 1) {
    const headersOre = sheetOre.getRange(1, 1, 1, sheetOre.getLastColumn()).getValues()[0];
    const rawOre = sheetOre.getRange(2, 1, sheetOre.getLastRow() - 1, sheetOre.getLastColumn()).getValues();
    
    const idxMese = headersOre.indexOf("Mese Competenza");
    const idxAnno = headersOre.indexOf("Anno Competenza");
    const idxIDCli = headersOre.indexOf("ID Cliente");
    const idxOre = headersOre.indexOf("Ore Lavorate");
    const idxTipoOre = headersOre.indexOf("Tipo Ore");
    
    rawOre.forEach(row => {
      const m = String(row[idxMese]).trim();
      const a = String(row[idxAnno]).trim();
      if (m !== String(mese) || a !== String(anno)) return;
      
      const idCli = String(row[idxIDCli]).trim();
      const ore = parseFloat(row[idxOre]) || 0;
      const tipoOre = String(row[idxTipoOre]).trim().toLowerCase();
      
      // Contiamo solo ore di lavoro effettivo (escludiamo ferie, permessi, malattia per i clienti!)
      if (idCli && (tipoOre === "lavoro ordinario" || tipoOre === "straordinario")) {
        if (!oreMappa[idCli]) oreMappa[idCli] = 0;
        oreMappa[idCli] += ore;
      }
    });
  }
  
  // 3. Carica le regolazioni
  const sheetReg = assicuraRegolazioniClientiSheet(ss);
  const lastRowReg = sheetReg.getLastRow();
  const regMappa = {}; // ID_CLIENTE -> [ { tipo, importo, motivazione } ]
  
  if (lastRowReg > 1) {
    const headersReg = sheetReg.getRange(1, 1, 1, sheetReg.getLastColumn()).getValues()[0];
    const dataReg = sheetReg.getRange(2, 1, lastRowReg - 1, sheetReg.getLastColumn()).getValues();
    
    const idxRegMese = headersReg.indexOf("Mese");
    const idxRegAnno = headersReg.indexOf("Anno");
    const idxRegIDCli = headersReg.indexOf("ID Cliente");
    const idxRegTipo = headersReg.indexOf("Tipo");
    const idxRegImporto = headersReg.indexOf("Importo");
    const idxRegMotivazione = headersReg.indexOf("Motivazione");
    
    dataReg.forEach(row => {
      const m = String(row[idxRegMese]).trim();
      const a = String(row[idxRegAnno]).trim();
      if (m !== String(mese) || a !== String(anno)) return;
      
      const idCli = String(row[idxRegIDCli]).trim();
      const tipo = String(row[idxRegTipo]).trim();
      const importo = parseFloat(row[idxRegImporto]) || 0;
      const motivazione = String(row[idxRegMotivazione]).trim();
      
      if (!regMappa[idCli]) regMappa[idCli] = [];
      regMappa[idCli].push({ tipo, importo, motivazione });
    });
  }
  
  // 4. Unisci i dati
  const righeConCalcoli = clienti.map(c => {
    const ore = oreMappa[c.id] || 0;
    const regolazioni = regMappa[c.id] || [];
    
    let baseImponibile = 0;
    if (c.tipoFatturazione === "Fisso") {
      baseImponibile = c.fissoMensile;
    } else {
      baseImponibile = ore * c.tariffaOraria;
    }
    
    let sconti = 0;
    let maggiorazioni = 0;
    const noteParti = [];
    
    regolazioni.forEach(r => {
      if (r.tipo === "Sconto") {
        sconti += r.importo;
        noteParti.push(`-${r.importo.toFixed(2)} € (${r.motivazione})`);
      } else if (r.tipo === "Maggiorazione") {
        maggiorazioni += r.importo;
        noteParti.push(`+${r.importo.toFixed(2)} € (${r.motivazione})`);
      }
    });
    
    const imponibile = baseImponibile + maggiorazioni - sconti;
    const aliquotaIva = c.aliquotaIva;
    const iva = imponibile * (aliquotaIva / 100);
    const totale = imponibile + iva;
    
    const costoOrario = ore > 0 ? (imponibile / ore) : 0;
    
    return {
      idCliente: c.id,
      cliente: c.ragioneSociale,
      tipoFatturazione: c.tipoFatturazione,
      valoreContrattuale: c.tipoFatturazione === "Fisso" ? c.fissoMensile.toFixed(2) + " €/mese" : c.tariffaOraria.toFixed(2) + " €/ora",
      oreLavorate: ore,
      baseImponibile: baseImponibile,
      sconto: sconti,
      maggiorazione: maggiorazioni,
      imponibile: imponibile,
      aliquotaIva: aliquotaIva,
      iva: iva,
      totale: totale,
      costoOrario: costoOrario,
      noteGenerali: noteParti.join(", ")
    };
  });
  
  return {
    righe: righeConCalcoli,
    chiuso: chiuso
  };
}

/**
 * Esporta il report mensile clienti in un nuovo Google Sheet standalone.
 */
function esportaGoogleSheetElaboratoClienti(mese, anno, righe) {
  try {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const nomeFile = `Elaborato_Clienti_${mese}_${anno}_${timestamp}`;
    const ssNuovo = SpreadsheetApp.create(nomeFile);
    const sheet = ssNuovo.getActiveSheet();
    sheet.setName("Riepilogo Fatture Clienti");
    sheet.setHiddenGridlines(false);
    
    // Titolo
    sheet.getRange(1, 1).setValue(`M2I S.r.l. - Elaborato Mensile Fatturazione Clienti (${mese} ${anno})`).setFontWeight("bold").setFontSize(13);
    
    const headers = [
      "RIEPILOGO CLIENTI", "ORE LAVORATE", "TIPO FATTURAZIONE", "VALORE CONTRATTUALE",
      "BASE IMPONIBILE", "SCONTI", "MAGGIORAZIONI", "IMPONIBILE", "IVA %", "IVA APPLICATA",
      "TOTALE FATTURA", "COSTO ORARIO EFFETTIVO", "NOTE"
    ];
    
    sheet.appendRow(new Array(headers.length).fill("")); // riga vuota
    sheet.appendRow(headers);
    
    const headerRange = sheet.getRange(3, 1, 1, headers.length);
    headerRange.setBackground("#3b82f6")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
               
    const dataRows = [];
    righe.forEach(r => {
      dataRows.push([
        r.cliente,
        r.oreLavorate || 0,
        r.tipoFatturazione,
        r.valoreContrattuale,
        r.baseImponibile || 0,
        r.sconto || 0,
        r.maggiorazione || 0,
        r.imponibile || 0,
        r.aliquotaIva || 0,
        r.iva || 0,
        r.totale || 0,
        r.costoOrario || 0,
        r.noteGenerali || ""
      ]);
    });
    
    if (dataRows.length > 0) {
      sheet.getRange(4, 1, dataRows.length, headers.length).setValues(dataRows);
      sheet.getRange(4, 2, dataRows.length, 1).setNumberFormat("#,##0.00");
      sheet.getRange(4, 5, dataRows.length, 4).setNumberFormat("€ #,##0.00");
      sheet.getRange(4, 9, dataRows.length, 1).setNumberFormat("0'%'");
      sheet.getRange(4, 10, dataRows.length, 3).setNumberFormat("€ #,##0.00");
      
      const lastRow = sheet.getLastRow();
      const formulaSum = (col) => `=SUM(${col}4:${col}${lastRow})`;
      const sumRow = [
        "TOTALE GENERALE",
        formulaSum("B"),
        "",
        "",
        formulaSum("E"),
        formulaSum("F"),
        formulaSum("G"),
        formulaSum("H"),
        "",
        formulaSum("J"),
        formulaSum("K"),
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
 * Recupera l'elenco dei clienti attivi ordinarli in ordine alfabetico.
 */
function recuperaClientiAttivi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Anagrafica Clienti GS");
  if (!sheet) return [];
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const rawCli = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const idxID = headers.indexOf("ID Cliente");
  const idxRagSoc = headers.indexOf("Ragione Sociale");
  const idxAttivo = headers.indexOf("Attivo");
  
  const clienti = [];
  rawCli.forEach(row => {
    const id = row[idxID];
    const attivo = String(row[idxAttivo]).trim().toUpperCase();
    if (id && (attivo === "SI" || attivo === "SÌ" || attivo === "")) {
      clienti.push({ id: String(id).trim(), nome: String(row[idxRagSoc]).trim().toUpperCase() });
    }
  });
  
  return clienti.sort((a,b) => a.nome.localeCompare(b.nome));
}
