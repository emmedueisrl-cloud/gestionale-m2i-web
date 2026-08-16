//======================================================
// MODULO REPORTISTICA MULTIMESE DIPENDENTI E CLIENTI
//======================================================

const MESI_ORDINATI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

/**
 * Apre la modale del report ore e presenze.
 */
function apriReportOre() {
  assicuraFoglioOre();
  
  const html = HtmlService.createHtmlOutputFromFile("ReportOre")
    .setWidth(1280)
    .setHeight(820)
    .setTitle("📊 Report & Analisi Multimese");
  SpreadsheetApp.getUi().showModalDialog(html, "📊 Report & Analisi Multimese");
}

/**
 * Genera il report multimese per i dipendenti.
 */
function generaReportMultimeseDipendenti(filtri) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Carica i dipendenti
  const sheetDip = ss.getSheetByName("Anagrafica Dipendenti GS");
  if (!sheetDip) throw new Error("Anagrafica Dipendenti non trovata.");
  const headersDip = sheetDip.getRange(1, 1, 1, sheetDip.getLastColumn()).getValues()[0];
  const rawDip = sheetDip.getRange(2, 1, sheetDip.getLastRow() - 1, sheetDip.getLastColumn()).getValues();
  
  const idxDipID = headersDip.indexOf("ID");
  const idxDipCognome = headersDip.indexOf("Cognome");
  const idxDipNome = headersDip.indexOf("Nome");
  const idxDipPagaOraria = headersDip.indexOf("PagaOraria");
  const idxDipPagaMensile = headersDip.indexOf("PagaMensile");
  const idxDipTipoContratto = headersDip.indexOf("Tipo Contratto");
  
  const dipMap = {};
  rawDip.forEach(row => {
    const id = String(row[idxDipID]).trim();
    if (id) {
      dipMap[id] = {
        id: id,
        nomeCompleto: `${row[idxDipCognome]} ${row[idxDipNome]}`.toUpperCase(),
        pagaOraria: parseFloat(row[idxDipPagaOraria]) || 0,
        pagaMensile: parseFloat(row[idxDipPagaMensile]) || 0,
        tipoContratto: String(row[idxDipTipoContratto]).trim()
      };
    }
  });
  
  // 2. Determina l'intervallo di mesi
  const idxInizio = MESI_ORDINATI.indexOf(filtri.meseInizio);
  const idxFine = MESI_ORDINATI.indexOf(filtri.meseFine);
  if (idxInizio === -1 || idxFine === -1 || idxInizio > idxFine) {
    throw new Error("Intervallo di mesi non valido.");
  }
  
  const mesiTarget = MESI_ORDINATI.slice(idxInizio, idxFine + 1);
  const anno = String(filtri.anno).trim();
  
  // 3. Carica il registro ore
  const sheetOre = ss.getSheetByName("Registro Ore GS");
  if (!sheetOre) throw new Error("Registro Ore non trovato.");
  const headersOre = sheetOre.getRange(1, 1, 1, sheetOre.getLastColumn()).getValues()[0];
  const lastRowOre = sheetOre.getLastRow();
  const rawOre = lastRowOre > 1 ? sheetOre.getRange(2, 1, lastRowOre - 1, sheetOre.getLastColumn()).getValues() : [];
  
  const idxOreMese = headersOre.indexOf("Mese Competenza");
  const idxOreAnno = headersOre.indexOf("Anno Competenza");
  const idxOreDip = headersOre.indexOf("ID Dipendente");
  const idxOreCli = headersOre.indexOf("ID Cliente");
  const idxOreQta = headersOre.indexOf("Ore Lavorate");
  const idxOreTipo = headersOre.indexOf("Tipo Ore");
  
  // 4. Carica regolazioni stipendi
  const sheetReg = ss.getSheetByName("Regolazioni Stipendi GS");
  const regData = (sheetReg && sheetReg.getLastRow() > 1) ? sheetReg.getRange(2, 1, sheetReg.getLastRow() - 1, sheetReg.getLastColumn()).getValues() : [];
  let headersReg = sheetReg ? sheetReg.getRange(1, 1, 1, sheetReg.getLastColumn()).getValues()[0] : [];
  
  const idxRegMese = headersReg.indexOf("Mese");
  const idxRegAnno = headersReg.indexOf("Anno");
  const idxRegDip = headersReg.indexOf("ID Dipendente");
  const idxRegTipo = headersReg.indexOf("Tipo");
  const idxRegImporto = headersReg.indexOf("Importo");
  
  const righeReport = [];
  
  mesiTarget.forEach(mese => {
    // Filtriamo ore e regolazioni per questo mese/anno
    const oreMese = rawOre.filter(row => String(row[idxOreMese]).trim() === mese && String(row[idxOreAnno]).trim() === anno);
    const regMese = regData.filter(row => String(row[idxRegMese]).trim() === mese && String(row[idxRegAnno]).trim() === anno);
    
    // Raggruppa ore lavorate per dipendente per questo specifico mese
    // Mappa: ID_DIP -> { lavorateTotali, lavorateFiltroCliente, fpm }
    const oreMappa = {};
    oreMese.forEach(row => {
      const idDip = String(row[idxOreDip]).trim();
      const idCli = String(row[idxOreCli]).trim();
      const ore = parseFloat(row[idxOreQta]) || 0;
      const tipo = String(row[idxOreTipo]).trim().toLowerCase();
      
      if (!oreMappa[idDip]) {
        oreMappa[idDip] = { lavorateTotali: 0, lavorateFiltroCliente: 0, fpm: 0 };
      }
      
      const isLavoro = (tipo === "lavoro ordinario" || tipo === "straordinario");
      const isFPM = (tipo === "ferie" || tipo === "permesso retribuito" || tipo === "malattia" || tipo === "infortunio");
      
      if (isLavoro) {
        oreMappa[idDip].lavorateTotali += ore;
        if (filtri.idCliente === "TUTTI" || idCli === filtri.idCliente) {
          oreMappa[idDip].lavorateFiltroCliente += ore;
        }
      } else if (isFPM) {
        oreMappa[idDip].fpm += ore;
      }
    });
    
    // Calcola regolazioni per questo mese
    // Mappa: ID_DIP -> { detrazioni, maggiorazioni }
    const regMappa = {};
    regMese.forEach(row => {
      const idDip = String(row[idxRegDip]).trim();
      const tipo = String(row[idxRegTipo]).trim();
      const importo = parseFloat(row[idxRegImporto]) || 0;
      
      if (!regMappa[idDip]) {
        regMappa[idDip] = { detrazioni: 0, maggiorazioni: 0 };
      }
      if (tipo === "Detrazione") {
        regMappa[idDip].detrazioni += importo;
      } else if (tipo === "Maggiorazione") {
        regMappa[idDip].maggiorazioni += importo;
      }
    });
    
    // Elabora per ciascun dipendente
    Object.keys(dipMap).forEach(idDip => {
      if (filtri.idDipendente !== "TUTTI" && idDip !== filtri.idDipendente) return;
      
      const d = dipMap[idDip];
      const o = oreMappa[idDip] || { lavorateTotali: 0, lavorateFiltroCliente: 0, fpm: 0 };
      const r = regMappa[idDip] || { detrazioni: 0, maggiorazioni: 0 };
      
      // Se il dipendente non ha ore lavorate filtrate e non stiamo chiedendo un dipendente specifico, saltiamo
      if (o.lavorateFiltroCliente === 0 && o.fpm === 0 && filtri.idDipendente === "TUTTI") return;
      
      // Calcolo paga
      let pagaLavorato = 0;
      let pagaFPM = 0;
      let valoreContratto = "";
      
      if (d.pagaMensile > 0) {
        // Flat rate mensile
        valoreContratto = `${d.pagaMensile.toFixed(2)} €/mese`;
        
        // Se c'è filtro cliente, proporzioniamo sullo stipendio mensile rispetto alle ore lavorate sul cliente
        if (filtri.idCliente !== "TUTTI") {
          pagaLavorato = o.lavorateTotali > 0 ? (o.lavorateFiltroCliente / o.lavorateTotali) * d.pagaMensile : 0;
          pagaFPM = 0; // FPM non fa parte del cliente specifico
        } else {
          pagaLavorato = d.pagaMensile;
          pagaFPM = 0; // compreso nel mensile flat
        }
      } else {
        // Hourly rate
        valoreContratto = `${d.pagaOraria.toFixed(2)} €/ora`;
        pagaLavorato = o.lavorateFiltroCliente * d.pagaOraria;
        
        // Se cliente è "TUTTI", calcoliamo anche FPM
        if (filtri.idCliente === "TUTTI") {
          pagaFPM = o.fpm * d.pagaOraria;
        } else {
          pagaFPM = 0;
        }
      }
      
      // Regolazioni proporzionate o azzerate se filtrato per cliente (le regolazioni sono generali sul mese!)
      const detrazioni = filtri.idCliente === "TUTTI" ? r.detrazioni : 0;
      const maggiorazioni = filtri.idCliente === "TUTTI" ? r.maggiorazioni : 0;
      
      const netto = pagaLavorato + pagaFPM + maggiorazioni - detrazioni;
      const pagaOrariaReale = o.lavorateFiltroCliente > 0 ? (netto / o.lavorateFiltroCliente) : 0;
      
      righeReport.push({
        mese: mese,
        anno: anno,
        idDipendente: d.id,
        dipendente: d.nomeCompleto,
        oreLavorate: o.lavorateFiltroCliente,
        oreFpm: filtri.idCliente === "TUTTI" ? o.fpm : 0,
        valoreContratto: valoreContratto,
        pagaBase: pagaLavorato + pagaFPM,
        detrazioni: detrazioni,
        maggiorazioni: maggiorazioni,
        netto: netto,
        pagaOrariaReale: pagaOrariaReale
      });
    });
  });
  
  return righeReport;
}

/**
 * Genera il report multimese per i clienti.
 */
function generaReportMultimeseClienti(filtri) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Carica i clienti
  const sheetCli = ss.getSheetByName("Anagrafica Clienti GS");
  if (!sheetCli) throw new Error("Anagrafica Clienti non trovata.");
  const headersCli = sheetCli.getRange(1, 1, 1, sheetCli.getLastColumn()).getValues()[0];
  const rawCli = sheetCli.getRange(2, 1, sheetCli.getLastRow() - 1, sheetCli.getLastColumn()).getValues();
  
  const idxCliID = headersCli.indexOf("ID Cliente");
  const idxCliRagSoc = headersCli.indexOf("Ragione Sociale");
  const idxCliTipo = headersCli.indexOf("Tipo Fatturazione");
  const idxCliFisso = headersCli.indexOf("Fisso Mensile");
  const idxCliTariffa = headersCli.indexOf("Tariffa Oraria");
  const idxCliIva = headersCli.indexOf("Aliquota IVA");
  
  const cliMap = {};
  rawCli.forEach(row => {
    const id = String(row[idxCliID]).trim();
    if (id) {
      cliMap[id] = {
        id: id,
        ragioneSociale: String(row[idxCliRagSoc]).trim().toUpperCase(),
        tipoFatturazione: String(row[idxCliTipo]).trim(),
        fissoMensile: parseFloat(row[idxCliFisso]) || 0,
        tariffaOraria: parseFloat(row[idxCliTariffa]) || 0,
        aliquotaIva: parseFloat(row[idxCliIva]) || 22
      };
    }
  });
  
  // 2. Determina intervallo mesi
  const idxInizio = MESI_ORDINATI.indexOf(filtri.meseInizio);
  const idxFine = MESI_ORDINATI.indexOf(filtri.meseFine);
  if (idxInizio === -1 || idxFine === -1 || idxInizio > idxFine) {
    throw new Error("Intervallo di mesi non valido.");
  }
  
  const mesiTarget = MESI_ORDINATI.slice(idxInizio, idxFine + 1);
  const anno = String(filtri.anno).trim();
  
  // 3. Carica il registro ore
  const sheetOre = ss.getSheetByName("Registro Ore GS");
  if (!sheetOre) throw new Error("Registro Ore non trovato.");
  const headersOre = sheetOre.getRange(1, 1, 1, sheetOre.getLastColumn()).getValues()[0];
  const lastRowOre = sheetOre.getLastRow();
  const rawOre = lastRowOre > 1 ? sheetOre.getRange(2, 1, lastRowOre - 1, sheetOre.getLastColumn()).getValues() : [];
  
  const idxOreMese = headersOre.indexOf("Mese Competenza");
  const idxOreAnno = headersOre.indexOf("Anno Competenza");
  const idxOreCli = headersOre.indexOf("ID Cliente");
  const idxOreQta = headersOre.indexOf("Ore Lavorate");
  const idxOreTipo = headersOre.indexOf("Tipo Ore");
  
  // 4. Carica regolazioni clienti
  const sheetReg = ss.getSheetByName("Regolazioni Clienti GS");
  const regData = (sheetReg && sheetReg.getLastRow() > 1) ? sheetReg.getRange(2, 1, sheetReg.getLastRow() - 1, sheetReg.getLastColumn()).getValues() : [];
  let headersReg = sheetReg ? sheetReg.getRange(1, 1, 1, sheetReg.getLastColumn()).getValues()[0] : [];
  
  const idxRegMese = headersReg.indexOf("Mese");
  const idxRegAnno = headersReg.indexOf("Anno");
  const idxRegCli = headersReg.indexOf("ID Cliente");
  const idxRegTipo = headersReg.indexOf("Tipo");
  const idxRegImporto = headersReg.indexOf("Importo");
  
  const righeReport = [];
  
  mesiTarget.forEach(mese => {
    const oreMese = rawOre.filter(row => String(row[idxOreMese]).trim() === mese && String(row[idxOreAnno]).trim() === anno);
    const regMese = regData.filter(row => String(row[idxRegMese]).trim() === mese && String(row[idxRegAnno]).trim() === anno);
    
    // Ore per cliente
    const oreMappa = {};
    oreMese.forEach(row => {
      const idCli = String(row[idxOreCli]).trim();
      const ore = parseFloat(row[idxOreQta]) || 0;
      const tipo = String(row[idxOreTipo]).trim().toLowerCase();
      
      if (idCli && (tipo === "lavoro ordinario" || tipo === "straordinario")) {
        if (!oreMappa[idCli]) oreMappa[idCli] = 0;
        oreMappa[idCli] += ore;
      }
    });
    
    // Regolazioni per cliente
    const regMappa = {};
    regMese.forEach(row => {
      const idCli = String(row[idxRegCli]).trim();
      const tipo = String(row[idxRegTipo]).trim();
      const importo = parseFloat(row[idxRegImporto]) || 0;
      
      if (!regMappa[idCli]) {
        regMappa[idCli] = { sconti: 0, maggiorazioni: 0 };
      }
      if (tipo === "Sconto") {
        regMappa[idCli].sconti += importo;
      } else if (tipo === "Maggiorazione") {
        regMappa[idCli].maggiorazioni += importo;
      }
    });
    
    // Elabora ciascun cliente
    Object.keys(cliMap).forEach(idCli => {
      if (filtri.idCliente !== "TUTTI" && idCli !== filtri.idCliente) return;
      
      const c = cliMap[idCli];
      const ore = oreMappa[idCli] || 0;
      const r = regMappa[idCli] || { sconti: 0, maggiorazioni: 0 };
      
      if (ore === 0 && filtri.idCliente === "TUTTI") return; // salta se nessun dato
      
      let baseImponibile = 0;
      if (c.tipoFatturazione === "Fisso") {
        baseImponibile = c.fissoMensile;
      } else {
        baseImponibile = ore * c.tariffaOraria;
      }
      
      const imponibileNetto = baseImponibile + r.maggiorazioni - r.sconti;
      const iva = imponibileNetto * (c.aliquotaIva / 100);
      const totale = imponibileNetto + iva;
      const costoOrario = ore > 0 ? (imponibileNetto / ore) : 0;
      
      righeReport.push({
        mese: mese,
        anno: anno,
        idCliente: c.id,
        cliente: c.ragioneSociale,
        oreLavorate: ore,
        tipoFatturazione: c.tipoFatturazione,
        baseImponibile: baseImponibile,
        sconti: r.sconti,
        maggiorazioni: r.maggiorazioni,
        imponibileNetto: imponibileNetto,
        aliquotaIva: c.aliquotaIva,
        iva: iva,
        totale: totale,
        costoOrario: costoOrario
      });
    });
  });
  
  return righeReport;
}

/**
 * Esporta il report multimese dipendenti in Google Sheets.
 */
function esportaSheetReportDipendenti(filtri, righe) {
  try {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const nomeFile = `Report_Stipendi_Dipendenti_${filtri.meseInizio}_${filtri.meseFine}_${filtri.anno}_${timestamp}`;
    const ss = SpreadsheetApp.create(nomeFile);
    const sheet = ss.getActiveSheet();
    sheet.setName("Riepilogo Stipendi Multimese");
    sheet.setHiddenGridlines(false);
    
    sheet.getRange(1, 1).setValue(`M2I S.r.l. - Report Stipendi Dipendenti (${filtri.meseInizio}-${filtri.meseFine} ${filtri.anno})`).setFontWeight("bold").setFontSize(13);
    
    const headers = [
      "MESE", "DIPENDENTE", "ORE LAVORATE", "ORE FERIE/PERM/MAL", "VALORE CONTRATTO",
      "PAGA BASE CALCOLATA", "DETRAZIONI (-)", "MAGGIORAZIONI (+)", "STIPENDIO NETTO", "PAGA ORARIA REALE"
    ];
    
    sheet.appendRow(new Array(headers.length).fill(""));
    sheet.appendRow(headers);
    
    const headerRange = sheet.getRange(3, 1, 1, headers.length);
    headerRange.setBackground("#4f46e5").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
    
    const dataRows = [];
    righe.forEach(r => {
      dataRows.push([
        r.mese,
        r.dipendente,
        r.oreLavorate,
        r.oreFpm,
        r.valoreContratto,
        r.pagaBase,
        r.detrazioni,
        r.maggiorazioni,
        r.netto,
        r.pagaOrariaReale
      ]);
    });
    
    if (dataRows.length > 0) {
      sheet.getRange(4, 1, dataRows.length, headers.length).setValues(dataRows);
      sheet.getRange(4, 3, dataRows.length, 2).setNumberFormat("#,##0.00");
      sheet.getRange(4, 6, dataRows.length, 4).setNumberFormat("€ #,##0.00");
      sheet.getRange(4, 10, dataRows.length, 1).setNumberFormat("€ #,##0.00");
      
      const lastRow = sheet.getLastRow();
      const formulaSum = (col) => `=SUM(${col}4:${col}${lastRow})`;
      const sumRow = [
        "TOTALE GENERALE",
        "",
        formulaSum("C"),
        formulaSum("D"),
        "",
        formulaSum("F"),
        formulaSum("G"),
        formulaSum("H"),
        formulaSum("I"),
        ""
      ];
      sheet.appendRow(sumRow);
      
      const totalRowRange = sheet.getRange(lastRow + 1, 1, 1, headers.length);
      totalRowRange.setBackground("#e2e8f0").setFontWeight("bold");
    }
    
    sheet.autoResizeColumns(1, headers.length);
    return ss.getUrl();
  } catch(err) {
    throw new Error("Errore durante la creazione dello Spreadsheet: " + err.message);
  }
}

/**
 * Esporta il report multimese clienti in Google Sheets.
 */
function esportaSheetReportClienti(filtri, righe) {
  try {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const nomeFile = `Report_Fatturazione_Clienti_${filtri.meseInizio}_${filtri.meseFine}_${filtri.anno}_${timestamp}`;
    const ss = SpreadsheetApp.create(nomeFile);
    const sheet = ss.getActiveSheet();
    sheet.setName("Riepilogo Fatture Multimese");
    sheet.setHiddenGridlines(false);
    
    sheet.getRange(1, 1).setValue(`M2I S.r.l. - Report Fatturazione Clienti (${filtri.meseInizio}-${filtri.meseFine} ${filtri.anno})`).setFontWeight("bold").setFontSize(13);
    
    const headers = [
      "MESE", "CLIENTE", "ORE LAVORATE", "TIPO FATTURAZIONE", "BASE IMPONIBILE",
      "SCONTI (-)", "MAGGIORAZIONI (+)", "IMPONIBILE NETTO", "IVA %", "IVA APPLICATA",
      "TOTALE FATTURA", "COSTO ORARIO EFFETTIVO"
    ];
    
    sheet.appendRow(new Array(headers.length).fill(""));
    sheet.appendRow(headers);
    
    const headerRange = sheet.getRange(3, 1, 1, headers.length);
    headerRange.setBackground("#059669").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
    
    const dataRows = [];
    righe.forEach(r => {
      dataRows.push([
        r.mese,
        r.cliente,
        r.oreLavorate,
        r.tipoFatturazione,
        r.baseImponibile,
        r.sconti,
        r.maggiorazioni,
        r.imponibileNetto,
        r.aliquotaIva,
        r.iva,
        r.totale,
        r.costoOrario
      ]);
    });
    
    if (dataRows.length > 0) {
      sheet.getRange(4, 1, dataRows.length, headers.length).setValues(dataRows);
      sheet.getRange(4, 3, dataRows.length, 1).setNumberFormat("#,##0.00");
      sheet.getRange(4, 5, dataRows.length, 4).setNumberFormat("€ #,##0.00");
      sheet.getRange(4, 9, dataRows.length, 1).setNumberFormat("0'%'");
      sheet.getRange(4, 10, dataRows.length, 3).setNumberFormat("€ #,##0.00");
      
      const lastRow = sheet.getLastRow();
      const formulaSum = (col) => `=SUM(${col}4:${col}${lastRow})`;
      const sumRow = [
        "TOTALE GENERALE",
        "",
        formulaSum("C"),
        "",
        formulaSum("E"),
        formulaSum("F"),
        formulaSum("G"),
        formulaSum("H"),
        "",
        formulaSum("J"),
        formulaSum("K"),
        ""
      ];
      sheet.appendRow(sumRow);
      
      const totalRowRange = sheet.getRange(lastRow + 1, 1, 1, headers.length);
      totalRowRange.setBackground("#e2e8f0").setFontWeight("bold");
    }
    
    sheet.autoResizeColumns(1, headers.length);
    return ss.getUrl();
  } catch(err) {
    throw new Error("Errore durante la creazione dello Spreadsheet: " + err.message);
  }
}
