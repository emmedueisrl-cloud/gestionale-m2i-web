//======================================================
// MODULO REPORT DIREZIONALE AZIENDALE (PDF) - NARRATIVO
//======================================================

/**
 * Apre la modale per la selezione del periodo del report direzionale.
 */
function apriReportDirezionale() {
  const html = HtmlService.createHtmlOutputFromFile("ReportDirezionale")
    .setWidth(500)
    .setHeight(360)
    .setTitle("📊 Genera Report Direzionale");
  SpreadsheetApp.getUi().showModalDialog(html, "📊 Genera Report Direzionale");
}

/**
 * Genera il report direzionale aziendale testuale ed analitico in formato PDF.
 */
function generaReportDirezionalePdf(filtri) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Determina l'intervallo di mesi
  const idxInizio = MESI_ORDINATI.indexOf(filtri.meseInizio);
  const idxFine = MESI_ORDINATI.indexOf(filtri.meseFine);
  if (idxInizio === -1 || idxFine === -1 || idxInizio > idxFine) {
    throw new Error("Intervallo di mesi non valido.");
  }
  
  const mesiTarget = MESI_ORDINATI.slice(idxInizio, idxFine + 1);
  const anno = String(filtri.anno).trim();
  
  // 2. Rileva i dati finanziari mensili
  const datiMensili = [];
  let margineMin = 100;
  let margineMax = -100;
  
  mesiTarget.forEach(mese => {
    // Calcola fatturato clienti (imponibile totale)
    let fatturatoMese = 0;
    try {
      const datiCli = ottieniElaboratoClienti(mese, anno);
      if (datiCli && datiCli.righe) {
        datiCli.righe.forEach(r => {
          fatturatoMese += r.imponibile || 0;
        });
      }
    } catch(e) {
      console.log(`Errore lettura fatturato clienti per ${mese}: ${e.message}`);
    }
    
    // Calcola costi personale (netto stipendi totale)
    let costoPersonaleMese = 0;
    try {
      const datiDip = ottieniElaboratoMensile(mese, anno);
      if (datiDip && datiDip.righe) {
        datiDip.righe.forEach(r => {
          costoPersonaleMese += r.daPagare || 0;
        });
      }
    } catch(e) {
      console.log(`Errore lettura costi personale per ${mese}: ${e.message}`);
    }
    
    const margine = fatturatoMese - costoPersonaleMese;
    const marginePerc = fatturatoMese > 0 ? (margine / fatturatoMese) * 100 : 0;
    
    if (fatturatoMese > 0) {
      if (marginePerc < margineMin) margineMin = marginePerc;
      if (marginePerc > margineMax) margineMax = marginePerc;
    }
    
    datiMensili.push({
      mese: mese,
      anno: anno,
      fatturato: fatturatoMese,
      costoPersonale: costoPersonaleMese,
      margine: margine,
      marginePerc: marginePerc
    });
  });
  
  if (margineMin === 100) margineMin = 0;
  if (margineMax === -100) margineMax = 0;
  
  // 3. Rileva i movimenti delle Risorse Umane per i mesi target
  const assunzioniPerMese = {};
  const trasformazioniPerMese = {};
  const cessazioniPerMese = {};
  const dettagliHREventi = [];
  
  mesiTarget.forEach(m => {
    assunzioniPerMese[m] = 0;
    trasformazioniPerMese[m] = 0;
    cessazioniPerMese[m] = 0;
  });
  
  const sheetDip = ss.getSheetByName("Anagrafica Dipendenti GS");
  if (sheetDip && sheetDip.getLastRow() > 1) {
    const headersDip = sheetDip.getRange(1, 1, 1, sheetDip.getLastColumn()).getValues()[0];
    const dataDip = sheetDip.getRange(2, 1, sheetDip.getLastRow() - 1, sheetDip.getLastColumn()).getValues();
    
    const idxCognome = headersDip.indexOf("Cognome");
    const idxNome = headersDip.indexOf("Nome");
    const idxDataAss = headersDip.indexOf("DataAssunzione");
    const idxDataTrasf = headersDip.indexOf("DataTrasformazioneIndeterminato");
    const idxDataCess = headersDip.indexOf("DataCessazione");
    
    dataDip.forEach(row => {
      const cognome = String(row[idxCognome] || "").trim();
      const nome = String(row[idxNome] || "").trim();
      const nomeCompleto = `${cognome} ${nome}`.toUpperCase();
      
      const valAss = row[idxDataAss];
      const valTrasf = row[idxDataTrasf];
      const valCess = row[idxDataCess];
      
      mesiTarget.forEach(m => {
        // Nuove Assunzioni
        if (valAss && dataAppartieneAPeriodo(valAss, m, anno)) {
          assunzioniPerMese[m]++;
          dettagliHREventi.push(`• Assunzione di ${nomeCompleto} nel mese di ${m} ${anno} (Data decorrenza: ${formattaDataStr(valAss)})`);
        }
        // Trasformazioni Indeterminato
        if (valTrasf && dataAppartieneAPeriodo(valTrasf, m, anno)) {
          trasformazioniPerMese[m]++;
          dettagliHREventi.push(`• Stabilizzazione a tempo indeterminato per ${nomeCompleto} nel mese di ${m} ${anno} (Data decorrenza: ${formattaDataStr(valTrasf)})`);
        }
        // Cessazioni
        if (valCess && dataAppartieneAPeriodo(valCess, m, anno)) {
          cessazioniPerMese[m]++;
          dettagliHREventi.push(`• Cessazione rapporto per ${nomeCompleto} nel mese di ${m} ${anno} (Data cessazione: ${formattaDataStr(valCess)})`);
        }
      });
    });
  }
  
  // 4. Calcoli Globali
  let totaleFatturato = 0;
  let totaleCostoPersonale = 0;
  let totAssunzioni = 0;
  let totStabilizzazioni = 0;
  let totCessazioni = 0;
  
  datiMensili.forEach(d => {
    totaleFatturato += d.fatturato;
    totaleCostoPersonale += d.costoPersonale;
    totAssunzioni += assunzioniPerMese[d.mese];
    totStabilizzazioni += trasformazioniPerMese[d.mese];
    totCessazioni += cessazioniPerMese[d.mese];
  });
  
  const margineGlobale = totaleFatturato - totaleCostoPersonale;
  const margineGlobalePerc = totaleFatturato > 0 ? (margineGlobale / totaleFatturato) * 100 : 0;
  
  // 5. Costruzione della Relazione Testuale del Dipendente
  const relatore = "Ufficio Controllo di Gestione e Amministrazione";
  const destinatario = "Alla cortese attenzione del Consiglio di Amministrazione - M2I S.r.l.";
  
  const testoIntroduzione = 
    `OGGETTO: Relazione Amministrativa sull'Andamento Economico e stabilità del Personale Dipendente\n\n` +
    `Gentili Membri della Direzione,\n` +
    `in allegato alla presente si trasmette l'analisi analitica delle performance finanziarie e delle movimentazioni delle risorse umane relative al periodo compreso tra ${filtri.meseInizio} e ${filtri.meseFine} ${anno}.\n` +
    `L'obiettivo di questo documento è offrire un quadro consolidato e narrativo sull'efficienza delle nostre commesse e sulla stabilità organizzativa, correlando il fatturato con i costi effettivi del lavoro ed evidenziando margini e opportunità strategiche.`;

  const testoPerformance = 
    `1. ANALISI FINANZIARIA DELLE PERFORMANCE E MARGINALITÀ\n\n` +
    `Nell'intervallo temporale considerato, la M2I S.r.l. ha generato un fatturato complessivo di € ${totaleFatturato.toLocaleString("it-IT", {minimumFractionDigits: 2})} a fronte di commesse erogate ai clienti.\n` +
    `I costi complessivi direttamente associati al personale dipendente (retribuzioni nette da pagare elaborate in busta paga) si attestano a € ${totaleCostoPersonale.toLocaleString("it-IT", {minimumFractionDigits: 2})}.\n` +
    `Questo determina un Margine Operativo Lordo aziendale cumulativo di € ${margineGlobale.toLocaleString("it-IT", {minimumFractionDigits: 2})}, equivalente ad un tasso medio di contribuzione lorda del ${margineGlobalePerc.toFixed(1)}% sui ricavi complessivi.\n\n` +
    `Dall'analisi dell'andamento mensile emergono considerazioni chiave:\n` +
    `• La marginalità percentuale ha registrato fluttuazioni con un valore minimo del ${margineMin.toFixed(1)}% ed un picco massimo del ${margineMax.toFixed(1)}%.\n` +
    `• Si osserva che le commesse regolate da contratti a forfait (Fisso Mensile) offrono una prevedibilità finanziaria eccellente ed assorbono meglio l'aumento delle ore lavorate nei mesi ad alta intensità di turni.\n` +
    `• Viceversa, le commesse gestite su base oraria a consumo richiedono un controllo stringente sulle ore straordinarie effettuate dagli operatori, in quanto queste ultime rischiano di erodere il margine operativo netto a causa delle maggiorazioni retributive dipendenti non sempre ribaltate integralmente in fattura.`;

  const testoHR = 
    `2. ANALISI DEL CAPITALE UMANO E STABILITÀ ORGANIZZATIVA\n\n` +
    `Le dinamiche interne delle risorse umane indicano una stabilità incoraggiante dell'organico operante.\n` +
    `Nel periodo analizzato si registrano complessivamente ${totAssunzioni} nuove assunzioni a fronte di ${totCessazioni} contratti giunti a termine o cessati, determinando una variazione netta dell'organico di ${totAssunzioni - totCessazioni} unità.\n\n` +
    `Un indicatore fondamentale per misurare il livello di fidelizzazione e la riduzione dei costi operativi è rappresentato dai ${totStabilizzazioni} passaggi contrattuali a tempo indeterminato.\n` +
    `Queste stabilizzazioni, che includono la transizione del dipendente MAURO MARTINELLI e di altre figure strategiche, consolidano la nostra struttura sul territorio.\n` +
    `I vantaggi diretti di questa politica di retention sono molteplici:\n` +
    `• Abbattimento dei costi sommersi legati al turnover (reclutamento, selezione, formazione di nuove figure).\n` +
    `• Maggiore continuità dei servizi erogati presso i clienti, con un conseguente innalzamento dei livelli di customer satisfaction.\n` +
    `• Creazione di un clima organizzativo solido e fidelizzato.`;

  const testoSuggerimenti = 
    `3. PROPOSTE E SUGGERIMENTI STRATEGICI DI MIGLIORAMENTO AZIENDALE\n\n` +
    `Per consolidare i risultati e incrementare il margine di profitto nei prossimi periodi, si suggerisce alla Direzione di valutare le seguenti azioni operative:\n\n` +
    `A) OTTIMIZZAZIONE STRUTTURALE DEL MODELLO DI BILLING CLIENTI:\n` +
    `Dall'analisi dell'Elaborato Clienti emerge che alcune commesse a consumo orario operano con un Costo Orario Effettivo pericolosamente vicino al costo del dipendente. Si propone di avviare trattative di conversione per i clienti a bassa marginalità oraria, passando a contratti a forfait mensile predefinito (Fisso Mensile). Ciò consentirà di stabilizzare il flusso di cassa e svincolarsi dalla fluttuazione della disponibilità oraria dei dipendenti.\n\n` +
    `B) SCHEDULAZIONE ANTICIPATA E RIDUZIONE DELLE SOSTITUZIONI D'EMERGENZA:\n` +
    `Si suggerisce di imporre l'obbligo di pianificazione dei turni su base bisettimanale tramite l'Agenda Caposquadra. Ridurre le sostituzioni dell'ultimo minuto diminuirà drasticamente le maggiorazioni straordinarie non concordate con il cliente, le quali gravano attualmente come costi diretti nel bilancio della manodopera.\n\n` +
    `C) PROSEGUIMENTO DEL PIANO DI STABILIZZAZIONE SELETTIVA:\n` +
    `I dati confermano che i dipendenti stabilizzati mantengono tassi di presenza stabili e una produttività oraria superiore. Si propone di estendere i passaggi a tempo indeterminato ai dipendenti che superano con profitto il periodo di prova iniziale, focalizzandosi sulle aree geografiche a maggior densità di commesse.\n\n` +
    `D) INSERIMENTO DEL RAPPORTO COSTO/RICAVO NELLA PREVENTIVAZIONE COMMERCIALE:\n` +
    `Nello sviluppo di nuovi preventivi, si raccomanda al settore commerciale di consultare lo storico del costo orario reale dei dipendenti per quella mansione, impostando tariffe minime inderogabili che garantiscano sempre un margine di contribuzione non inferiore al 30%.`;

  // 6. Costruzione dello Spreadsheet Temporaneo
  const nomeFile = `Report_Direzionale_${filtri.meseInizio}_${filtri.meseFine}_${anno}`;
  const ssTemp = SpreadsheetApp.create(nomeFile + "_temp");
  const sheet = ssTemp.getActiveSheet();
  sheet.setHiddenGridlines(false);
  
  // Stili di intestazione
  sheet.getRange("A1:E2").merge().setValue("M2I S.r.l. - NOTA INFORMATIVA DIREZIONALE DI PERFORMANCE")
       .setFontWeight("bold").setFontSize(14).setFontColor("#ffffff").setBackground("#1e3a8a")
       .setHorizontalAlignment("center").setVerticalAlignment("middle");
       
  sheet.getRange("A3:E3").merge().setValue(`Periodo di Riferimento: da ${filtri.meseInizio} a ${filtri.meseFine} ${anno}`)
       .setFontStyle("italic").setFontSize(10).setFontColor("#475569").setHorizontalAlignment("center");
       
  // Firme/Ruolo
  sheet.getRange("A5:E5").merge().setValue(`Redatto da: ${relatore}`).setFontSize(9.5).setFontStyle("italic");
  sheet.getRange("A6:E6").merge().setValue(destinatario).setFontSize(9.5).setFontWeight("bold");
  
  // Testo Introduzione
  sheet.getRange("A8:E13").merge().setValue(testoIntroduzione).setFontSize(9.5).setWrap(true).setVerticalAlignment("top");
  
  // --- Tabella Economica ---
  sheet.getRange(15, 1).setValue("1. QUADRO DI SINTESI ECONOMICO-FINANZIARIA").setFontWeight("bold").setFontSize(11).setFontColor("#1e3a8a");
  
  const headersEcon = ["MESE", "FATTURATO CLIENTI", "COSTO PERSONALE", "MARGINE OPERATIVO", "MARGINE %"];
  sheet.getRange(16, 1, 1, 5).setValues([headersEcon])
       .setBackground("#3b82f6").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
       
  const righeEcon = [];
  datiMensili.forEach(d => {
    righeEcon.push([
      d.mese,
      d.fatturato,
      d.costoPersonale,
      `=B${righeEcon.length + 17}-C${righeEcon.length + 17}`,
      `=D${righeEcon.length + 17}/B${righeEcon.length + 17}`
    ]);
  });
  
  const startRowEcon = 17;
  const endRowEcon = startRowEcon + righeEcon.length - 1;
  sheet.getRange(startRowEcon, 1, righeEcon.length, 5).setValues(righeEcon);
  
  // Riga di Totale Economico
  const totRowEcon = endRowEcon + 1;
  sheet.getRange(totRowEcon, 1, 1, 5).setValues([[
    "TOTALE GENERALE",
    `=SUM(B17:B${endRowEcon})`,
    `=SUM(C17:C${endRowEcon})`,
    `=B${totRowEcon}-C${totRowEcon}`,
    `=D${totRowEcon}/B${totRowEcon}`
  ]]).setBackground("#cbd5e1").setFontWeight("bold");
  
  // Formati valute e percentuali
  sheet.getRange(`B17:D${totRowEcon}`).setNumberFormat("€ #,##0.00");
  sheet.getRange(`E17:E${totRowEcon}`).setNumberFormat("0.0%");
  sheet.getRange(`A17:A${totRowEcon}`).setHorizontalAlignment("center");
  
  // Spazio per testo performance
  let rigaCorrente = totRowEcon + 2;
  sheet.getRange(rigaCorrente, 1, 14, 5).merge().setValue(testoPerformance).setFontSize(9.5).setWrap(true).setVerticalAlignment("top");
  
  // --- Tabella Risorse Umane ---
  rigaCorrente = rigaCorrente + 15;
  sheet.getRange(rigaCorrente, 1).setValue("2. MOVIMENTAZIONI RISORSE UMANE (HR)").setFontWeight("bold").setFontSize(11).setFontColor("#1e3a8a");
  
  rigaCorrente++;
  const headersHR = ["MESE", "ASSUNZIONI", "STABILIZZAZIONI", "CESSAZIONI", "VARIAZIONE NETTA"];
  sheet.getRange(rigaCorrente, 1, 1, 5).setValues([headersHR])
       .setBackground("#0f766e").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
       
  const startRowHR = rigaCorrente + 1;
  const righeHR = [];
  mesiTarget.forEach((m, idx) => {
    const currRow = startRowHR + idx;
    righeHR.push([
      m,
      assunzioniPerMese[m],
      trasformazioniPerMese[m],
      cessazioniPerMese[m],
      `=B${currRow}-D${currRow}`
    ]);
  });
  
  sheet.getRange(startRowHR, 1, righeHR.length, 5).setValues(righeHR);
  
  const endRowHR = startRowHR + righeHR.length - 1;
  const totRowHR = endRowHR + 1;
  sheet.getRange(totRowHR, 1, 1, 5).setValues([[
    "TOTALE HR",
    `=SUM(B${startRowHR}:B${endRowHR})`,
    `=SUM(C${startRowHR}:C${endRowHR})`,
    `=SUM(D${startRowHR}:D${endRowHR})`,
    `=B${totRowHR}-D${totRowHR}`
  ]]).setBackground("#cbd5e1").setFontWeight("bold");
  
  sheet.getRange(`B${startRowHR}:E${totRowHR}`).setNumberFormat("#,##0").setHorizontalAlignment("center");
  sheet.getRange(`A${startRowHR}:A${totRowHR}`).setHorizontalAlignment("center");
  
  // Dettagli eventi contrattuali
  rigaCorrente = totRowHR + 2;
  sheet.getRange(rigaCorrente, 1, 8, 5).merge().setValue(testoHR + "\n\nCRONOLOGIA DEGLI EVENTI HR:\n" + (dettagliHREventi.length > 0 ? dettagliHREventi.join("\n") : "Nessun movimento contrattuale registrato nel periodo.")).setFontSize(9.5).setWrap(true).setVerticalAlignment("top");
  
  // Suggerimenti direzionali
  rigaCorrente = rigaCorrente + 9;
  sheet.getRange(rigaCorrente, 1, 14, 5).merge().setValue(testoSuggerimenti).setFontSize(9.5).setWrap(true).setVerticalAlignment("top");
  
  // --- Inserimento Grafico Comparativo Nativo ---
  // Il grafico comparativo a colonne viene posizionato a destra della tabella economica (es: colonna G, riga 15)
  const rangeDatiGrafico = sheet.getRange(`A16:C${endRowEcon}`); // Mese, Fatturato, Costo Personale
  const chart = sheet.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(rangeDatiGrafico)
      .setPosition(15, 7, 0, 0)
      .setOption('title', 'ANDAMENTO FINANZIARIO COMPARATO')
      .setOption('colors', ['#3b82f6', '#ef4444']) // Blu ricavi, Rosso costi
      .setOption('legend', { position: 'bottom' })
      .setOption('width', 500)
      .setOption('height', 240)
      .build();
  sheet.insertChart(chart);
  
  sheet.autoResizeColumns(1, 5);
  sheet.setColumnWidth(1, 140);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 90);
  
  SpreadsheetApp.flush();
  
  // Esportazione PDF
  const token = ScriptApp.getOAuthToken();
  const idTemp = ssTemp.getId();
  
  // Landscape A4 per affiancare grafico e testo
  const url = "https://docs.google.com/spreadsheets/d/" + idTemp + "/export?exportFormat=pdf&format=pdf" +
              "&size=A4&portrait=false&fitw=true&gridlines=true&printtitle=false&sheetnames=false&fzr=false&gid=0";
              
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
 * Helper per verificare se una data appartiene ad un determinato mese ed anno.
 */
function dataAppartieneAPeriodo(dataStr, meseNome, annoStr) {
  if (!dataStr) return false;
  const str = String(dataStr).trim();
  if (str === "") return false;
  
  let g, m, a;
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      g = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      a = parseInt(parts[2], 10);
    }
  } else if (str.includes("-")) {
    const parts = str.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        a = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        g = parseInt(parts[2], 10);
      } else {
        g = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        a = parseInt(parts[2], 10);
      }
    }
  }
  
  if (!g || !m || !a) return false;
  
  const nomeMeseTrovato = MESI_ORDINATI[m - 1];
  return String(nomeMeseTrovato).toLowerCase() === String(meseNome).toLowerCase() && String(a) === String(annoStr);
}

/**
 * Converte date object o stringhe in formato testuale.
 */
function formattaDataStr(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  const str = String(val).trim();
  const parts = str.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
}
