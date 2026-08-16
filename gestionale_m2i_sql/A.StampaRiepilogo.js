/**
 * A.StampaRiepilogo.gs
 * Gestisce la logica di estrazione filtrata dei dipendenti e dei clienti, la generazione di nuovi fogli 
 * di calcolo e l'apertura delle relative finestre modali di anteprima/stampa.
 */

const NOME_FOGLIO_DIPENDENTI = "Anagrafica Dipendenti GS";

/**
 * Apre la modale di selezione dei filtri per il riepilogo.
 */
function apriStampaRiepilogo() {
  const html = HtmlService.createHtmlOutputFromFile("StampaRiepilogo")
    .setWidth(600)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, "📊 Riepilogo clienti e dipendenti");
}

/**
 * Ottiene l'elenco dei dipendenti che rispondono ai criteri di filtro impostati.
 */
function ottieniDipendentiFiltrati(datiFiltro, idSelezionati) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NOME_FOGLIO_DIPENDENTI);
  if (!sheet) {
    throw new Error("Il foglio '" + NOME_FOGLIO_DIPENDENTI + "' non è stato trovato nel foglio di calcolo.");
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  const headersLower = headers.map(h => String(h).toLowerCase().trim());
  const getColIdx = (name) => headersLower.indexOf(name.toLowerCase().trim());
  
  const idxID = getColIdx("ID");
  const idxCognome = getColIdx("Cognome");
  const idxNome = getColIdx("Nome");
  const idxCF = getColIdx("CodiceFiscale");
  const idxStato = getColIdx("Stato");
  const idxMansione = getColIdx("Mansione");
  const idxAssunzione = getColIdx("DataAssunzione");
  const idxScadenza = getColIdx("Scadenza");
  const idxPagaOraria = getColIdx("PagaOraria");
  const idxPagaMensile = getColIdx("PagaMensile");
  const idxTelefono = getColIdx("Telefono");
  const idxEmail = getColIdx("Email");
  const idxIBAN = getColIdx("IBAN");
  const idxResidenza = getColIdx("Residenza");
  const idxNote = getColIdx("Note");
  
  const idxAllegatoDocumenti = getColIdx("AllegatoDocumentiDip");
  const idxAllegatoContratto = getColIdx("AllegatoContrattoFirmato");
  const idxAllegatoProroga1 = getColIdx("AllegatoProroga1");
  const idxAllegatoProroga2 = getColIdx("AllegatoProroga2");
  const idxAllegatoProroga3 = getColIdx("AllegatoProroga3");
  const idxAllegatoProroga4 = getColIdx("AllegatoProroga4");
  const idxAllegatoTrasformazione = getColIdx("AllegatoTrasformazione");
  const idxAllegatoCessazione = getColIdx("AllegatoCessazione");
  
  const idxProrogaDate1 = getColIdx("Proroga1");
  const idxProrogaDate2 = getColIdx("Proroga2");
  const idxProrogaDate3 = getColIdx("Proroga3");
  const idxProrogaDate4 = getColIdx("Proroga4");
  
  if (idxID === -1 || idxCognome === -1 || idxStato === -1) {
    throw new Error("Colonne principali non trovate nel foglio dipendenti.");
  }
  
  const parseDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    const parts = String(val).split("/");
    if (parts.length === 3) {
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return new Date(val);
  };
  
  const oggi = new Date();
  oggi.setHours(0,0,0,0);
  
  const filtrati = [];
  
  data.forEach(row => {
    const id = row[idxID];
    if (!id || String(id).trim() === "") return;
    
    const getValRaw = (idx) => (idx > -1 && row[idx] !== undefined && row[idx] !== null) ? row[idx] : "";
    
    const formattaValoreData = (val) => {
      if (!val) return "";
      if (val instanceof Date) {
        return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
      }
      const sVal = String(val).trim();
      if (sVal === "") return "";
      
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(sVal)) {
        return sVal.split(" ")[0];
      }
      
      if (/^\d{4}-\d{2}-\d{2}/.test(sVal)) {
        const p = sVal.split(" ")[0].split("-");
        return p[2] + "/" + p[1] + "/" + p[0];
      }
      
      const parsedDate = new Date(sVal);
      if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
        return Utilities.formatDate(parsedDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
      }
      return sVal;
    };

    const d = {
      id: String(id).trim(),
      cognome: String(getValRaw(idxCognome)).trim(),
      nome: String(getValRaw(idxNome)).trim(),
      codiceFiscale: String(getValRaw(idxCF)).trim(),
      stato: String(getValRaw(idxStato)).trim(),
      mansione: String(getValRaw(idxMansione)).trim(),
      dataAssunzione: formattaValoreData(getValRaw(idxAssunzione)),
      scadenza: formattaValoreData(getValRaw(idxScadenza)),
      pagaOraria: parseFloat(getValRaw(idxPagaOraria)) || 0,
      pagaMensile: parseFloat(getValRaw(idxPagaMensile)) || 0,
      telefono: String(getValRaw(idxTelefono)).trim(),
      email: String(getValRaw(idxEmail)).trim(),
      iban: String(getValRaw(idxIBAN)).trim(),
      residenza: String(getValRaw(idxResidenza)).trim(),
      note: String(getValRaw(idxNote)).trim(),
      // Allegati
      allegatoDocumenti: String(getValRaw(idxAllegatoDocumenti)).trim(),
      allegatoContratto: String(getValRaw(idxAllegatoContratto)).trim(),
      allegatoProroga1: String(getValRaw(idxAllegatoProroga1)).trim(),
      allegatoProroga2: String(getValRaw(idxAllegatoProroga2)).trim(),
      allegatoProroga3: String(getValRaw(idxAllegatoProroga3)).trim(),
      allegatoProroga4: String(getValRaw(idxAllegatoProroga4)).trim(),
      allegatoTrasformazione: String(getValRaw(idxAllegatoTrasformazione)).trim(),
      allegatoCessazione: String(getValRaw(idxAllegatoCessazione)).trim(),
      // Proroghe (date)
      proroga1: formattaValoreData(getValRaw(idxProrogaDate1)),
      proroga2: formattaValoreData(getValRaw(idxProrogaDate2)),
      proroga3: formattaValoreData(getValRaw(idxProrogaDate3)),
      proroga4: formattaValoreData(getValRaw(idxProrogaDate4))
    };
    
    // 1. FILTRO STATO ANAGRAFICO (Attivi, Cessati, Tutti)
    if (datiFiltro.statoAnagrafico && datiFiltro.statoAnagrafico !== "Tutti") {
      const isCessato = d.stato.toLowerCase() === "cessato";
      if (datiFiltro.statoAnagrafico === "Cessati" && !isCessato) {
        return;
      }
      if (datiFiltro.statoAnagrafico === "Attivi" && isCessato) {
        return;
      }
    }
    
    // 2. FILTRO TIPO CONTRATTO (Indeterminato, Prova, Determinato, Tutti)
    if (datiFiltro.tipoContratto && datiFiltro.tipoContratto !== "Tutti") {
      if (d.stato.toLowerCase() !== String(datiFiltro.tipoContratto).toLowerCase().trim()) {
        return;
      }
    }
    
    // 3. FILTRO PAGA MINIMA (ORARIA O MENSILE)
    if (datiFiltro.pagaMinima !== undefined && datiFiltro.pagaMinima !== null && datiFiltro.pagaMinima !== "") {
      const minPay = parseFloat(datiFiltro.pagaMinima);
      if (d.pagaOraria < minPay && d.pagaMensile < minPay) {
        return;
      }
    }
    
    // 4. FILTRO SCADENZA ENTRO X GIORNI
    if (datiFiltro.giorniScadenza !== undefined && datiFiltro.giorniScadenza !== null && datiFiltro.giorniScadenza !== "") {
      const ggMax = parseInt(datiFiltro.giorniScadenza, 10);
      let dataScadenzaEffettiva = d.scadenza;
      
      const prorogheCols = ["Proroga1", "Proroga2", "Proroga3", "Proroga4"];
      prorogheCols.forEach(colName => {
        const colIdx = getColIdx(colName);
        if (colIdx > -1) {
          const valProroga = row[colIdx];
          if (valProroga && String(valProroga).trim() !== "") {
            dataScadenzaEffettiva = valProroga;
          }
        }
      });
      
      const dateScad = parseDate(dataScadenzaEffettiva);
      if (!dateScad) return;
      
      dateScad.setHours(0,0,0,0);
      const diffTime = dateScad.getTime() - oggi.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0 || diffDays > ggMax || d.stato.toLowerCase() === "cessato") {
        return;
      }
      
      d.giorniRimasti = diffDays;
      d.scadenzaEffettiva = Utilities.formatDate(dateScad, Session.getScriptTimeZone(), "dd/MM/yyyy");
    }
    
    filtrati.push(d);
  });
  
  const ordinati = filtrati.sort((a, b) => {
    const nomeCompletoA = `${a.cognome} ${a.nome}`.toUpperCase();
    const nomeCompletoB = `${b.cognome} ${b.nome}`.toUpperCase();
    return nomeCompletoA.localeCompare(nomeCompletoB);
  });

  if (idSelezionati && Array.isArray(idSelezionati)) {
    return ordinati.filter(d => idSelezionati.indexOf(d.id) > -1);
  }
  return ordinati;
}

/**
 * Ottiene l'elenco dei clienti che rispondono ai criteri di filtro impostati.
 */
function ottieniClientiFiltrati(datiFiltro, idSelezionati) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NOME_FOGLIO_CLIENTI);
  if (!sheet) {
    throw new Error("Il foglio '" + NOME_FOGLIO_CLIENTI + "' non è stato trovato nel foglio di calcolo.");
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  const headersLower = headers.map(h => String(h).toLowerCase().trim());
  const getColIdx = (name) => headersLower.indexOf(name.toLowerCase().trim());
  
  const idxID = getColIdx("id cliente") > -1 ? getColIdx("id cliente") : getColIdx("id");
  const idxRagioneSociale = getColIdx("ragione sociale");
  const idxPIVA = getColIdx("p. iva") > -1 ? getColIdx("p. iva") : getColIdx("p.iva");
  const idxPEC = getColIdx("pec / codice univoco");
  const idxSedeLegale = getColIdx("sede legale");
  const idxViaServizio = getColIdx("via servizio");
  const idxReferente = getColIdx("referente");
  const idxTel1 = getColIdx("telefono 1");
  const idxTel2 = getColIdx("telefono 2");
  const idxTel3 = getColIdx("telefono 3");
  const idxEmail = getColIdx("email");
  const idxOperatore = getColIdx("operatore");
  const idxCommerciale = getColIdx("commerciale");
  const idxTipoFatturazione = getColIdx("tipo fatturazione");
  const idxFissoMensile = getColIdx("fisso mensile");
  const idxTariffaOraria = getColIdx("tariffa oraria");
  const idxAliquotaIVA = getColIdx("aliquota iva") > -1 ? getColIdx("aliquota iva") : getColIdx("aliquotaiva");
  const idxPossessoChiavi = getColIdx("possesso chiavi");
  const idxCopie = getColIdx("copie");
  const idxInPossessoDi = getColIdx("in possesso di");
  const idxAttivo = getColIdx("attivo");
  const idxDataFirma = getColIdx("data firma contratto");
  const idxTipoContratto = getColIdx("tipo contratto");
  const idxAllegatoContratto = getColIdx("allegato contratto");
  const idxPagamentoCon = getColIdx("pagamento con");
  const idxNote = getColIdx("note");
  
  if (idxID === -1 || idxRagioneSociale === -1) {
    throw new Error("Colonne principali clienti non trovate nel foglio.");
  }
  
  const filtrati = [];
  
  data.forEach(row => {
    const id = row[idxID];
    if (!id || String(id).trim() === "") return;
    
    const getValRaw = (idx) => (idx > -1 && row[idx] !== undefined && row[idx] !== null) ? row[idx] : "";
    
    const formattaValoreData = (val) => {
      if (!val) return "";
      if (val instanceof Date) {
        return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
      }
      const sVal = String(val).trim();
      if (sVal === "") return "";
      
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(sVal)) {
        return sVal.split(" ")[0];
      }
      
      if (/^\d{4}-\d{2}-\d{2}/.test(sVal)) {
        const p = sVal.split(" ")[0].split("-");
        return p[2] + "/" + p[1] + "/" + p[0];
      }
      
      const parsedDate = new Date(sVal);
      if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
        return Utilities.formatDate(parsedDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
      }
      return sVal;
    };
    
    const c = {
      id: String(id).trim(),
      ragioneSociale: String(getValRaw(idxRagioneSociale)).trim(),
      pIva: String(getValRaw(idxPIVA)).trim(),
      pec: String(getValRaw(idxPEC)).trim(),
      sedeLegale: String(getValRaw(idxSedeLegale)).trim(),
      viaServizio: String(getValRaw(idxViaServizio)).trim(),
      referente: String(getValRaw(idxReferente)).trim(),
      telefono1: String(getValRaw(idxTel1)).trim(),
      telefono2: String(getValRaw(idxTel2)).trim(),
      telefono3: String(getValRaw(idxTel3)).trim(),
      email: String(getValRaw(idxEmail)).trim(),
      operatore: String(getValRaw(idxOperatore)).trim(),
      commerciale: String(getValRaw(idxCommerciale)).trim(),
      tipoFatturazione: String(getValRaw(idxTipoFatturazione)).trim(),
      fissoMensile: parseFloat(getValRaw(idxFissoMensile)) || 0,
      tariffaOraria: parseFloat(getValRaw(idxTariffaOraria)) || 0,
      aliquotaIva: getValRaw(idxAliquotaIVA),
      possessoChiavi: String(getValRaw(idxPossessoChiavi)).trim(),
      copie: getValRaw(idxCopie),
      inPossessoDi: String(getValRaw(idxInPossessoDi)).trim(),
      attivo: String(getValRaw(idxAttivo)).trim(),
      dataFirmaContratto: formattaValoreData(getValRaw(idxDataFirma)),
      tipoContratto: String(getValRaw(idxTipoContratto)).trim(),
      allegatoContratto: String(getValRaw(idxAllegatoContratto)).trim(),
      pagamentoCon: String(getValRaw(idxPagamentoCon)).trim(),
      note: String(getValRaw(idxNote)).trim()
    };
    
    // Filtro stato cliente (Attivi, Non Attivi, Tutti)
    if (datiFiltro.statoCliente && datiFiltro.statoCliente !== "Tutti") {
      const isActive = c.attivo.toUpperCase() === "SI";
      if (datiFiltro.statoCliente === "Attivi" && !isActive) {
        return;
      }
      if (datiFiltro.statoCliente === "Non Attivi" && isActive) {
        return;
      }
    }
    
    filtrati.push(c);
  });
  
  const ordinati = filtrati.sort((a, b) => a.ragioneSociale.localeCompare(b.ragioneSociale));
  
  if (idSelezionati && Array.isArray(idSelezionati)) {
    return ordinati.filter(x => idSelezionati.indexOf(x.id) > -1);
  }
  return ordinati;
}

/**
 * Crea un nuovo Google Sheet con i dati filtrati (clienti o dipendenti).
 */
function creaGoogleSheetFiltro(tipoReport, filtri, idSelezionati) {
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy_HH-mm");
  
  if (tipoReport === "clienti") {
    const clientiFiltrati = ottieniClientiFiltrati(filtri, idSelezionati);
    const nomeFile = `Riepilogo_Clienti_Filtro_${timestamp}`;
    const ssNuovo = SpreadsheetApp.create(nomeFile);
    const sheet = ssNuovo.getActiveSheet();
    sheet.setName("Clienti Filtrati");
    
    const headers = [
      "ID Cliente", "Ragione Sociale", "P. IVA", "PEC / Codice Univoco", "Sede Legale", 
      "Via Servizio", "Referente", "Telefono 1", "Telefono 2", "Telefono 3", 
      "Email", "Operatore", "Commerciale", "Tipo Fatturazione", "Fisso Mensile (€)", 
      "Tariffa Oraria (€)", "Aliquota IVA (%)", "Possesso Chiavi", "Copie", "In Possesso di", 
      "Attivo", "Data Firma Contratto", "Tipo Contratto", "Allegato Contratto (Presente/Assente)", 
      "Pagamento con", "Note"
    ];
    sheet.appendRow(headers);
    
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#4f46e5")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
               
    const righeDati = [];
    clientiFiltrati.forEach(c => {
      righeDati.push([
        c.id, c.ragioneSociale, c.pIva, c.pec, c.sedeLegale,
        c.viaServizio, c.referente, c.telefono1, c.telefono2, c.telefono3,
        c.email, c.operatore, c.commerciale, c.tipoFatturazione, c.fissoMensile || "",
        c.tariffaOraria || "", c.aliquotaIva || "", c.possessoChiavi, c.copie || "", c.inPossessoDi,
        c.attivo, c.dataFirmaContratto, c.tipoContratto, c.allegatoContratto && c.allegatoContratto.trim() !== "" ? "SI" : "", c.pagamentoCon,
        c.note
      ]);
    });
    
    if (righeDati.length > 0) {
      sheet.getRange(2, 1, righeDati.length, headers.length).setValues(righeDati);
      sheet.getRange(2, 15, righeDati.length, 2).setNumberFormat("#,##0.00");
    }
    
    sheet.autoResizeColumns(1, headers.length);
    return ssNuovo.getUrl();
    
  } else {
    // dipendenti
    const dipendentiFiltrati = ottieniDipendentiFiltrati(filtri, idSelezionati);
    const nomeFile = `Riepilogo_Dipendenti_Filtro_${timestamp}`;
    const ssNuovo = SpreadsheetApp.create(nomeFile);
    const sheet = ssNuovo.getActiveSheet();
    sheet.setName("Dipendenti Filtrati");
    
    const headers = [
      "ID", "Cognome", "Nome", "Codice Fiscale", "Stato", "Mansione", 
      "Data Assunzione", "Scadenza Contratto", "Paga Oraria (€)", "Paga Mensile (€)", 
      "Telefono", "Email", "IBAN", "Residenza", "Note", 
      "Allegato Documenti (Presente/Assente)", "Allegato Contratto (Presente/Assente)", "Allegato Proroga 1 (Presente/Assente)", 
      "Allegato Proroga 2 (Presente/Assente)", "Allegato Proroga 3 (Presente/Assente)", "Allegato Proroga 4 (Presente/Assente)", 
      "Allegato Trasformazione (Presente/Assente)", "Allegato Cessazione (Presente/Assente)",
      "Proroga 1 (Data)", "Proroga 2 (Data)", "Proroga 3 (Data)", "Proroga 4 (Data)"
    ];
    sheet.appendRow(headers);
    
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#10b981")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
               
    const righeDati = [];
    dipendentiFiltrati.forEach(d => {
      const hasDoc = d.allegatoDocumenti && d.allegatoDocumenti.trim() !== "" ? "SI" : "";
      const hasContratto = d.allegatoContratto && d.allegatoContratto.trim() !== "" ? "SI" : "";
      const hasP1 = d.allegatoProroga1 && d.allegatoProroga1.trim() !== "" ? "SI" : "";
      const hasP2 = d.allegatoProroga2 && d.allegatoProroga2.trim() !== "" ? "SI" : "";
      const hasP3 = d.allegatoProroga3 && d.allegatoProroga3.trim() !== "" ? "SI" : "";
      const hasP4 = d.allegatoProroga4 && d.allegatoProroga4.trim() !== "" ? "SI" : "";
      const hasTrasf = d.allegatoTrasformazione && d.allegatoTrasformazione.trim() !== "" ? "SI" : "";
      const hasCess = d.allegatoCessazione && d.allegatoCessazione.trim() !== "" ? "SI" : "";

      righeDati.push([
        d.id, d.cognome, d.nome, d.codiceFiscale, d.stato, d.mansione,
        d.dataAssunzione, d.scadenzaEffettiva || d.scadenza || "-", d.pagaOraria || "", d.pagaMensile || "",
        d.telefono, d.email, d.iban, d.residenza, d.note,
        hasDoc, hasContratto, hasP1, hasP2, hasP3, hasP4, hasTrasf, hasCess,
        d.proroga1 || "", d.proroga2 || "", d.proroga3 || "", d.proroga4 || ""
      ]);
    });
    
    if (righeDati.length > 0) {
      sheet.getRange(2, 1, righeDati.length, headers.length).setValues(righeDati);
      sheet.getRange(2, 9, righeDati.length, 2).setNumberFormat("#,##0.00");
    }
    
    sheet.autoResizeColumns(1, headers.length);
    return ssNuovo.getUrl();
  }
}

/**
 * Apre la schermata di visualizzazione ed anteprima di stampa del riepilogo.
 */
function apriAnteprimaRiepilogo(tipoReport, filtri, idSelezionati) {
  const template = HtmlService.createTemplateFromFile("SchedaRiepilogoStampa");
  template.tipoReport = tipoReport;
  template.filtri = filtri;
  template.elenco = (tipoReport === "clienti") ? ottieniClientiFiltrati(filtri, idSelezionati) : ottieniDipendentiFiltrati(filtri, idSelezionati);
  
  const html = template.evaluate()
    .setWidth(1000)
    .setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, "📊 Anteprima Stampa Riepilogo");
}

/**
 * Ritorna informazioni diagnostiche sul foglio di calcolo attivo.
 */
function ottieniDiagnosticaStampa() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().map(s => s.getName());
  const targetSheet = ss.getSheetByName(NOME_FOGLIO_DIPENDENTI);
  
  const result = {
    allSheets: sheets,
    targetSheetExists: !!targetSheet,
    nomeCercato: NOME_FOGLIO_DIPENDENTI
  };
  
  if (targetSheet) {
    result.lastRow = targetSheet.getLastRow();
    result.lastColumn = targetSheet.getLastColumn();
    if (result.lastRow > 0) {
      const headers = targetSheet.getRange(1, 1, 1, Math.max(1, targetSheet.getLastColumn())).getValues()[0];
      result.headers = headers.map(h => String(h || ""));
    }
    if (result.lastRow > 1) {
      const firstRow = targetSheet.getRange(2, 1, 1, Math.max(1, targetSheet.getLastColumn())).getValues()[0];
      result.firstRowData = firstRow.map(v => String(v || ""));
    }
  }
  return result;
}
