const fs = require('fs');
const path = require('path');
const { knex } = require('./db');

const CSV_FILE = 'import_dipendenti.csv';
const csvPath = path.join(__dirname, CSV_FILE);

if (!fs.existsSync(csvPath)) {
  console.error(`\n[ERRORE] Il file '${CSV_FILE}' non è stato trovato!`);
  console.log(`\nIstruzioni per l'importazione:`);
  console.log(`1. Esporta il foglio Excel dei dipendenti in formato CSV.`);
  console.log(`2. Salva il file rinominandolo in '${CSV_FILE}'.`);
  console.log(`3. Copia il file '${CSV_FILE}' all'interno di questa cartella:`);
  console.log(`   ${__dirname}`);
  console.log(`4. Esegui nuovamente questo script con il comando: node import_dipendenti_csv.js\n`);
  process.exit(1);
}

// Funzione di utilità per pulire e formattare le date da DD/MM/YYYY a YYYY-MM-DD
function formatDate(str) {
  if (!str) return null;
  let trimmed = str.trim();
  if (!trimmed) return null;
  
  // Se contiene un range tipo "21/11/2022 - 31/12/2022", prendi l'ultima data (la scadenza effettiva)
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    trimmed = parts[parts.length - 1].trim();
  }
  
  // Rimuovi eventuali trattini spuri all'inizio (es. -31/05/2023)
  trimmed = trimmed.replace(/^[-]+/g, '').trim();
  
  // Se è già YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Se è DD/MM/YYYY o DD/MM/YY
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) {
      year = '20' + year; // Assumi secolo 2000 per anni a 2 cifre
    }
    return `${year}-${month}-${day}`;
  }
  
  return null; // Ritorna null per stringhe non convertibili (es. "INDETERMINATO")
}

// Helper per ripulire le virgolette e gli spazi
function cleanValue(str) {
  if (!str) return '';
  return str.replace(/^["']|["']$/g, '').trim();
}

async function run() {
  console.log(`Lettura del file ${CSV_FILE}...`);
  const content = fs.readFileSync(csvPath, 'utf8');
  
  // Split in righe mantenendo le righe vuote per rilevare la fine della prima tabella
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) {
    console.error('[ERRORE] Il file CSV sembra vuoto o non contiene righe di dati.');
    process.exit(1);
  }

  // Rileva il delimitatore (, o ;) basandosi sulla riga di intestazione
  const headerLine = lines[0];
  const countComma = (headerLine.match(/,/g) || []).length;
  const countSemicolon = (headerLine.match(/;/g) || []).length;
  const delimiter = countSemicolon >= countComma ? ';' : ',';
  
  console.log(`Delimitatore rilevato: '${delimiter}' (punto e virgola: ${countSemicolon}, virgola: ${countComma})`);

  // Funzione helper per splittare una riga rispettando eventuali campi racchiusi tra virgolette
  function splitCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(cleanValue);
  }

  const headers = splitCsvLine(headerLine).map(h => h.toUpperCase());
  console.log('Colonne trovate nel CSV:', headers);

  // Mappa gli indici delle colonne necessarie
  const getIndex = (possibleNames) => {
    for (const name of possibleNames) {
      const idx = headers.indexOf(name.toUpperCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxCognome = getIndex(['COGNOME']);
  const idxNome = getIndex(['NOME']);
  const idxCF = getIndex(['CODICE FISCALE', 'CODICE_FISCALE', 'CF']);
  const idxRecapito = getIndex(['RECAPITO', 'TELEFONO', 'TEL']);
  const idxEmail = getIndex(['EMAIL', 'E-MAIL']);
  const idxIban = getIndex(['IBAN']);
  const idxTipoPaga = getIndex(['TIPO PAGA', 'TIPO_PAGA']);
  const idxPaga = getIndex(['PAGA', 'PAGA ORARIA', 'PAGA_ORARIA']);
  const idxAssunzione = getIndex(['ASSUNZIONE', 'DATA ASSUNZIONE', 'DATA_ASSUNZIONE']);
  const idxScadenzaOriginale = getIndex(['1 SCADENZA', 'SCADENZA', 'DATA SCADENZA']);
  
  // Trova le colonne delle proroghe in ordine
  const idxProroghe = [];
  for (let i = 1; i <= 10; i++) {
    const idx = getIndex([`${i} PROROGA`, `${i}° PROROGA`, `PROROGA ${i}`, `PROROGA_${i}`]);
    if (idx !== -1) {
      idxProroghe.push({ numero: i, index: idx });
    }
  }

  if (idxCognome === -1 || idxNome === -1) {
    console.error("[ERRORE] Colonne 'COGNOME' e 'NOME' obbligatorie non trovate nel file CSV!");
    process.exit(1);
  }

  console.log('\nMappatura Colonne:');
  console.log(`- Cognome: Colonna #${idxCognome}`);
  console.log(`- Nome: Colonna #${idxNome}`);
  console.log(`- Codice Fiscale: ${idxCF !== -1 ? `Colonna #${idxCF}` : 'NON TROVATO (autogenerato)'}`);
  console.log(`- Recapito: ${idxRecapito !== -1 ? `Colonna #${idxRecapito}` : 'Non mappato'}`);
  console.log(`- Email: ${idxEmail !== -1 ? `Colonna #${idxEmail}` : 'Non mappato'}`);
  console.log(`- IBAN: ${idxIban !== -1 ? `Colonna #${idxIban}` : 'Non mappato'}`);
  console.log(`- Assunzione: ${idxAssunzione !== -1 ? `Colonna #${idxAssunzione}` : 'Non mappato'}`);
  console.log(`- 1° Scadenza: ${idxScadenzaOriginale !== -1 ? `Colonna #${idxScadenzaOriginale}` : 'Non mappato'}`);
  console.log(`- Proroghe trovate: ${idxProroghe.map(p => `${p.numero}° (Col #${p.index})`).join(', ') || 'Nessuna'}`);

  // Recupera l'ultimo ID dipendente presente per generare i successivi
  const lastRow = await knex('dipendenti').select('id').orderBy('id', 'desc').first();
  let currentIdNum = 0;
  if (lastRow && lastRow.id) {
    const match = lastRow.id.match(/\d+/);
    if (match) {
      currentIdNum = parseInt(match[0], 10);
    }
  }

  function generaSuccessivoID() {
    currentIdNum++;
    return 'D' + String(currentIdNum).padStart(4, '0');
  }

  console.log(`\nInizio elaborazione righe...`);
  
  let successCount = 0;
  let errorCount = 0;

  // Eseguiamo gli inserimenti uno alla volta (senza transazione globale bloccante)
  // in modo che se una riga ha errori le altre vengano comunque salvate
  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    if (!line.trim()) {
      // Se la riga è completamente vuota, abbiamo finito la prima tabella
      console.log(`[INFO] Rilevata riga vuota alla riga ${r + 1}. Termine lettura anagrafica.`);
      break;
    }

    const cells = splitCsvLine(line);
    const cognome = cells[idxCognome];
    const nome = cells[idxNome];

    // Se mancano sia cognome che nome o sono solo delimitatori, siamo fuori dalla tabella utile
    if (!cognome && !nome) {
      console.log(`[INFO] Rilevati campi Nome e Cognome vuoti alla riga ${r + 1}. Termine lettura anagrafica.`);
      break;
    }

    // Se solo uno dei due manca, potrebbe essere un errore di compilazione
    if (!cognome || !nome) {
      console.warn(`[RIGA ${r + 1}] Saltata: Cognome o Nome mancanti.`);
      errorCount++;
      continue;
    }

    // Estrai e formatta i campi
    const telefono = idxRecapito !== -1 ? cells[idxRecapito] : null;
    const email = idxEmail !== -1 ? cells[idxEmail] : null;
    const iban = idxIban !== -1 ? cells[idxIban] : null;
    const tipoPaga = idxTipoPaga !== -1 ? (cells[idxTipoPaga] || 'Oraria') : 'Oraria';
    
    let pagaOrariaReale = 0.0;
    if (idxPaga !== -1 && cells[idxPaga]) {
      const rawPaga = cells[idxPaga].replace(/[^0-9,.]/g, '').replace(',', '.');
      pagaOrariaReale = parseFloat(rawPaga) || 0.0;
    }

    // Formatta la data di assunzione (obbligatoria)
    let dataAssunzione = idxAssunzione !== -1 ? formatDate(cells[idxAssunzione]) : null;
    if (!dataAssunzione) {
      dataAssunzione = new Date().toISOString().split('T')[0]; // Fallback oggi
    }
    
    const scadenzaOriginale = idxScadenzaOriginale !== -1 ? formatDate(cells[idxScadenzaOriginale]) : null;

    // Generazione del Codice Fiscale se mancante (univoco)
    let codiceFiscale = idxCF !== -1 ? cells[idxCF] : null;
    if (!codiceFiscale || !codiceFiscale.trim()) {
      codiceFiscale = `FITTIZIO_${cognome.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3)}_${nome.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3)}_${Date.now().toString().slice(-6)}`;
    }
    codiceFiscale = codiceFiscale.trim().toUpperCase();

    // Rilevamento dello stato del contratto
    // Se non c'è una scadenza impostata, assume Indeterminato, altrimenti Determinato
    let stato = 'Determinato';
    if (!scadenzaOriginale) {
      stato = 'Indeterminato';
    }

    // Costruisci le proroghe
    const prorogheDate = [];
    for (const p of idxProroghe) {
      const dataProroga = formatDate(cells[p.index]);
      if (dataProroga) {
        prorogheDate.push(dataProroga);
      }
    }

    // La scadenza finale salvata sul dipendente è l'ultima data disponibile (o la scadenza originale o l'ultima proroga)
    let scadenzaFinale = scadenzaOriginale;
    if (prorogheDate.length > 0) {
      scadenzaFinale = prorogheDate[prorogheDate.length - 1];
    }

    const idDipendente = generaSuccessivoID();

    try {
      // Inserisci dipendente (ignora se c'è conflitto sul codice fiscale già inserito)
      await knex('dipendenti')
        .insert({
          id: idDipendente,
          cognome: cognome.trim(),
          nome: nome.trim(),
          codice_fiscale: codiceFiscale,
          telefono: telefono ? telefono.trim() : null,
          email: email ? email.trim() : null,
          iban: iban ? iban.trim() : null,
          tipo_paga: tipoPaga.trim(),
          paga_oraria_reale: pagaOrariaReale,
          data_assunzione: dataAssunzione,
          scadenza: scadenzaFinale,
          stato: stato,
          creato_da: 'ImportazioneCSV'
        })
        .onConflict('codice_fiscale')
        .ignore(); // Se esiste già lo ignora, evitando duplicati

      // Verifica se l'inserimento è andato a buon fine (se l'ID è stato effettivamente usato)
      const inserito = await knex('dipendenti').where('codice_fiscale', codiceFiscale).first();
      if (inserito && inserito.id === idDipendente) {
        // Inserisci lo storico delle proroghe solo se abbiamo inserito un NUOVO dipendente
        let dataPrecedente = scadenzaOriginale;
        for (let i = 0; i < prorogheDate.length; i++) {
          const nuovaScadenza = prorogheDate[i];
          await knex('proroghe_contratti').insert({
            dipendente_id: idDipendente,
            scadenza_precedente: dataPrecedente,
            nuova_scadenza: nuovaScadenza,
            note: `Proroga #${i + 1} importata in blocco`
          });
          dataPrecedente = nuovaScadenza;
        }
        successCount++;
        console.log(`[OK] Importato: ${idDipendente} - ${cognome} ${nome} (Stato: ${stato}, Scadenza: ${scadenzaFinale || 'Nessuna'})`);
      } else {
        console.log(`[SALTO] Già presente nel DB: ${cognome} ${nome} (CF: ${codiceFiscale})`);
      }
    } catch (err) {
      console.error(`[ERRORE] Impossibile importare la riga ${r + 1} (${cognome} ${nome}):`, err.message);
      errorCount++;
    }
  }

  console.log(`\nImportazione terminata!`);
  console.log(`- Dipendenti importati con successo: ${successCount}`);
  console.log(`- Righe con errori o saltate: ${errorCount}`);
}

run()
  .then(() => {
    console.log('Processo terminato.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Errore critico durante l\'importazione:', err);
    process.exit(1);
  });
