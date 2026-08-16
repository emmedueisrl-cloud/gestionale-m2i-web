const fs = require('fs');
const path = require('path');
const { knex } = require('./db');

const CSV_FILE = 'import_clienti.csv';
const csvPath = path.join(__dirname, CSV_FILE);

if (!fs.existsSync(csvPath)) {
  console.error(`\n[ERRORE] Il file '${CSV_FILE}' non è stato trovato!`);
  console.log(`\nIstruzioni per l'importazione:`);
  console.log(`1. Esporta il foglio Excel dei clienti in formato CSV.`);
  console.log(`2. Salva il file rinominandolo in '${CSV_FILE}'.`);
  console.log(`3. Copia il file '${CSV_FILE}' all'interno di questa cartella:`);
  console.log(`   ${__dirname}`);
  console.log(`4. Esegui nuovamente questo script con il comando: node import_clienti_csv.js\n`);
  process.exit(1);
}

// Funzione intelligente per separare i numeri di telefono dalle note di testo
function parsePhoneField(field) {
  if (!field) return { phone: '', notes: '' };
  const str = field.trim();
  if (!str) return { phone: '', notes: '' };

  // Regex per cercare sequenze numeriche che ricordano telefoni (almeno 5 cifre consecutive con spazi/punti/trattini)
  const phoneRegex = /(\+?\d[\d\s./-]{4,}\d)/g;
  const matches = [...str.matchAll(phoneRegex)];
  
  if (matches.length === 0) {
    return { phone: '', notes: str };
  }

  const phones = matches.map(m => m[0].trim().replace(/\s+/g, ' '));
  const phone = phones.join(' / ');

  let notes = str;
  for (const p of phones) {
    notes = notes.replace(p, '');
  }
  notes = notes.replace(/^[\s,;./()-]+|[\s,;./()-]+$/g, '').replace(/\s+/g, ' ').trim();

  return { phone, notes };
}

/**
 * Funzione intelligente per parsare la colonna "Chiavi".
 * 
 * Gestisce formati come:
 *   - "NO"
 *   - "SI (studio medico) 1 COPIA MARISA"
 *   - "SI, 1 COPIA ROSSELLA CON ALLARME (NON DUPLICABILE)"
 *   - "NO, LE CHIAVI SI PRENDONO AL GARAGE CHE APRE ALLE 06.00"
 *   - "SI 1 COPIA ANTONELLA F, 1 COPIA MANUELA, 1 COPIA ALESSIA LEUTI"
 * 
 * Restituisce: { possesso: 'SI'|'NO', copie: Number, inPossessoDi: String, note: String }
 */
function parseChiaviField(field) {
  if (!field) return { possesso: 'NO', copie: 0, inPossessoDi: '', note: '' };
  const str = field.trim().toUpperCase();
  if (!str || str === 'NO' || str === '-' || str === '') {
    return { possesso: 'NO', copie: 0, inPossessoDi: '', note: '' };
  }

  const possesso = str.startsWith('SI') ? 'SI' : 'NO';

  // Rimuovi il prefisso SI/NO (incluso eventuale virgola o parentesi dopo)
  let resto = field.trim();
  resto = resto.replace(/^SI[,\s]*/i, '').replace(/^NO[,\s]*/i, '').trim();

  // Se era NO, tutto il testo restante è una nota operativa
  if (possesso === 'NO') {
    return { possesso: 'NO', copie: 0, inPossessoDi: '', note: resto };
  }

  // Estrai tutte le occorrenze di "N COPIA/COPIE <chi>" 
  // Il nome si ferma alle parole-chiave note (CON, NON, CMQ, ecc.) o punteggiatura
  const copiaRegex = /(\d+)?\s*COPI[AE]\s+([A-ZÀ-Ü](?:(?!\b(?:CON|NON|CHE|CMQ|PER|SOLO|DEVONO|TOGLIERE)\b)[^,()0-9])*?)(?=\s*(?:CON|NON|CHE|CMQ|PER|SOLO|DEVONO|TOGLIERE|\(|,|\d|$))/gi;
  const copiaMatches = [...resto.matchAll(copiaRegex)];

  let totaleCopie = 0;
  const possessori = [];
  const noteExtra = [];

  if (copiaMatches.length > 0) {
    for (const m of copiaMatches) {
      const numCopie = m[1] ? parseInt(m[1], 10) : 1;
      totaleCopie += numCopie;
      const nome = m[2].trim().replace(/\s+/g, ' ');
      if (nome) possessori.push(nome);
    }

    // Dopo aver estratto i blocchi COPIA, prendi il testo rimanente come nota
    // Rimuoviamo i match trovati per estrarre le note residue
    let restoNote = resto;
    for (const m of copiaMatches) {
      restoNote = restoNote.replace(m[0], '');
    }
    // Pulisci testo residuo che non è possessore o numero
    restoNote = restoNote
      .replace(/[\d]+\s*COPI[AE]/gi, '')
      .replace(/^[\s,;./()-]+|[\s,;./()-]+$/g, '')
      .trim();

    if (restoNote) {
      // Pulisci parentesi non chiuse o testo sporco e aggiungi alle note
      const notePulita = restoNote.replace(/\(/g, '').replace(/\)/g, '').replace(/^[\s,;./()-]+|[\s,;./()-]+$/g, '').trim();
      if (notePulita) noteExtra.push(notePulita);
    }
  } else {
    // Nessun pattern "COPIA" trovato: metti tutto in note
    noteExtra.push(resto);
  }

  return {
    possesso: 'SI',
    copie: totaleCopie || 1,
    inPossessoDi: possessori.join(' / '),
    note: noteExtra.filter(Boolean).join(' | ')
  };
}

// Helper per ripulire le virgolette e gli spazi
function cleanValue(str) {
  if (!str) return '';
  return str.replace(/^["']|["']$/g, '').trim();
}

async function run() {
  console.log(`Lettura del file ${CSV_FILE}...`);
  const content = fs.readFileSync(csvPath, 'utf8');
  
  // Split in righe
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

  // Splitta la riga rispettando i campi tra virgolette
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

  const headers = splitCsvLine(headerLine).map(h => h.toUpperCase().trim());
  console.log('Colonne trovate nel CSV:', headers);

  // Mappa gli indici delle colonne necessarie
  const getIndex = (possibleNames) => {
    for (const name of possibleNames) {
      const idx = headers.indexOf(name.toUpperCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxRagioneSociale = getIndex(['RAGIONE SOCIALE', 'CLIENTE']);
  const idxReferente = getIndex(['REFERENTE']);
  const idxTel1 = getIndex(['TELEFONO 1', 'TELEFONO1', 'TEL 1', 'TELEFONO']);
  const idxTel2 = getIndex(['TELEFONO 2', 'TELEFONO2', 'TEL 2']);
  const idxTel3 = getIndex(['TELEFONO 3', 'TELEFONO3', 'TEL 3']);
  const idxEmail = getIndex(['EMAIL', 'E-MAIL', 'MAIL']);
  const idxViaServizio = getIndex(['VIA SERVIZIO', 'VIA_SERVIZIO', 'INDIRIZZO', 'SEDE OPERATIVA']);
  const idxPIva = getIndex(['P. IVA', 'P.IVA', 'PARTITA IVA', 'PARTITA_IVA']);
  const idxSedeLegale = getIndex(['SEDE LEGALE', 'SEDE_LEGALE']);
  const idxPecSdi = getIndex(['PEC/ CODICE UNIVOCO', 'PEC/CODICE UNIVOCO', 'PEC', 'CODICE UNIVOCO', 'CODICE_UNIVOCO']);
  const idxQuotazione = getIndex(['QUOTAZIONE', 'TARIFFA', 'PREZZO', 'IMPORTOMESE']);
  const idxNote1 = headers.indexOf('NOTE'); // prima colonna note (colonna 9 dell'immagine)
  const idxNote2 = headers.lastIndexOf('NOTE'); // seconda colonna note (colonna 17 dell'immagine)
  const idxChiavi = getIndex(['CHIAVI']);
  const idxCopie = getIndex(['COPIE']);
  const idxInPossessoDi = getIndex(['IN POSSESSO DI', 'IN POSSESSO']);

  if (idxRagioneSociale === -1) {
    console.error("[ERRORE] Colonna 'RAGIONE SOCIALE' obbligatoria non trovata nel file CSV!");
    process.exit(1);
  }

  // Recupera l'ultimo ID cliente presente per generare i successivi
  const lastRow = await knex('clienti').select('id').orderBy('id', 'desc').first();
  let currentIdNum = 0;
  if (lastRow && lastRow.id) {
    const match = lastRow.id.match(/\d+/);
    if (match) {
      currentIdNum = parseInt(match[0], 10);
    }
  }

  function generaSuccessivoID() {
    currentIdNum++;
    return 'C' + String(currentIdNum).padStart(4, '0');
  }

  console.log(`\nInizio elaborazione clienti...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    if (!line.trim()) continue;

    const cells = splitCsvLine(line);
    const ragioneSociale = cells[idxRagioneSociale];

    if (!ragioneSociale || !ragioneSociale.trim()) {
      continue; // Salta righe vuote
    }

    const pIva = idxPIva !== -1 ? cells[idxPIva].trim() : '';
    // Genera p.iva fittizia se mancante, in quanto PARTITA_IVA deve essere UNIQUE nel DB
    let partitaIvaFinal = pIva;
    if (!partitaIvaFinal) {
      partitaIvaFinal = `FITTIZIA_IVA_${Date.now().toString().slice(-6)}_${r}`;
    }

    // Estrai i telefoni e raccogli le relative note descrittive
    const tel1Raw = idxTel1 !== -1 ? cells[idxTel1] : '';
    const tel2Raw = idxTel2 !== -1 ? cells[idxTel2] : '';
    const tel3Raw = idxTel3 !== -1 ? cells[idxTel3] : '';
    
    const parsedTel1 = parsePhoneField(tel1Raw);
    const parsedTel2 = parsePhoneField(tel2Raw);
    const parsedTel3 = parsePhoneField(tel3Raw);

    // Unisce i telefoni validi trovati
    const telefoniList = [parsedTel1.phone, parsedTel2.phone, parsedTel3.phone].filter(Boolean);
    const telefonoFinal = telefoniList.join(' / ');

    // Raccoglie le note provenienti dalle colonne di telefono
    const noteTelefoni = [];
    if (parsedTel1.notes) noteTelefoni.push(`Tel1: ${parsedTel1.notes}`);
    if (parsedTel2.notes) noteTelefoni.push(`Tel2: ${parsedTel2.notes}`);
    if (parsedTel3.notes) noteTelefoni.push(`Tel3: ${parsedTel3.notes}`);

    // Dati generali
    const referente = idxReferente !== -1 ? cells[idxReferente].trim() : '';
    const email = idxEmail !== -1 ? cells[idxEmail].trim() : '';
    const sedeOperativa = idxViaServizio !== -1 ? cells[idxViaServizio].trim() : '';
    const sedeLegale = idxSedeLegale !== -1 ? cells[idxSedeLegale].trim() : '';
    
    // Gestione chiavi — parsing intelligente dell'intera cella
    const chiaviRaw = idxChiavi !== -1 ? cells[idxChiavi] : '';
    const chiaviParsed = parseChiaviField(chiaviRaw);

    const possessoChiavi = chiaviParsed.possesso;
    // Se c'è una colonna COPIE separata, usa quella; altrimenti usa quanto estratto dalla cella Chiavi
    let copie = chiaviParsed.copie;
    if (idxCopie !== -1 && cells[idxCopie]) {
      const copieNum = parseInt(cells[idxCopie].replace(/[^0-9]/g, ''), 10);
      if (!isNaN(copieNum)) copie = copieNum;
    }
    // Se c'è una colonna IN_POSSESSO_DI separata, usa quella; altrimenti usa quanto estratto dalla cella Chiavi
    let inPossessoDi = chiaviParsed.inPossessoDi;
    if (idxInPossessoDi !== -1 && cells[idxInPossessoDi] && cells[idxInPossessoDi].trim()) {
      inPossessoDi = cells[idxInPossessoDi].trim();
    }

    // Gestione quotazione / tariffazione
    const quotazioneRaw = idxQuotazione !== -1 ? cells[idxQuotazione].trim() : '';
    let tariffaOrariaOperatore = 0.0;
    let tariffaOrariaCommerciale = 0.0;
    let noteQuotazione = '';

    if (quotazioneRaw) {
      const isOraria = quotazioneRaw.toLowerCase().includes('/h') || quotazioneRaw.toLowerCase().includes('/ora');
      const valNum = parseFloat(quotazioneRaw.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0.0;
      
      if (isOraria) {
        tariffaOrariaOperatore = valNum;
        tariffaOrariaCommerciale = valNum;
      } else {
        noteQuotazione = `Quotazione originaria: ${quotazioneRaw}`;
      }
    }

    // Gestione Note generali (uniamo le colonne Note e le note estratte dai telefoni/sdi)
    const noteGeneraliList = [];
    
    // Note colonna 1
    if (idxNote1 !== -1 && cells[idxNote1]) {
      noteGeneraliList.push(cells[idxNote1].trim());
    }
    // Note colonna 2 (se diversa)
    if (idxNote2 !== -1 && idxNote2 !== idxNote1 && cells[idxNote2]) {
      noteGeneraliList.push(cells[idxNote2].trim());
    }
    // Note estratte dai telefoni
    if (noteTelefoni.length > 0) {
      noteGeneraliList.push(`[Info Telefoni] ${noteTelefoni.join(', ')}`);
    }
    // Note estratte dalla colonna Chiavi (es. allarmi, non duplicabile, garage, orari)
    if (chiaviParsed.note) {
      noteGeneraliList.push(`[Chiavi] ${chiaviParsed.note}`);
    }
    // Pec / Codice Univoco
    if (idxPecSdi !== -1 && cells[idxPecSdi]) {
      noteGeneraliList.push(`[PEC/SDI] ${cells[idxPecSdi].trim()}`);
    }
    // Quotazione mensile
    if (noteQuotazione) {
      noteGeneraliList.push(`[Fatturazione] ${noteQuotazione}`);
    }

    const noteFinal = noteGeneraliList.filter(Boolean).join(' | ');

    const idCliente = generaSuccessivoID();

    try {
      await knex('clienti')
        .insert({
          id: idCliente,
          ragione_sociale: ragioneSociale.trim(),
          partita_iva: partitaIvaFinal,
          sede_legale: sedeLegale || null,
          sede_operativa: sedeOperativa || null,
          telefono: telefonoFinal || null,
          email: email || null,
          referente: referente || null,
          tariffa_oraria_operatore: tariffaOrariaOperatore,
          tariffa_oraria_commerciale: tariffaOrariaCommerciale,
          possesso_chiavi: possessoChiavi,
          copie: copie,
          in_possesso_di: inPossessoDi || null,
          note: noteFinal || null,
          attivo: 'SI',
          creato_da: 'ImportazioneCSV'
        })
        .onConflict('partita_iva')
        .ignore();

      // Controlla se è stato effettivamente inserito
      const inserito = await knex('clienti').where('partita_iva', partitaIvaFinal).first();
      if (inserito && inserito.id === idCliente) {
        successCount++;
        console.log(`[OK] Importato Cliente: ${idCliente} - ${ragioneSociale.trim()} | Tel: ${telefonoFinal || 'Nessuno'} | Chiavi: ${possessoChiavi} (${copie} cop.) → ${inPossessoDi || '-'}`);
      } else {
        console.log(`[SALTO] Già presente nel DB: ${ragioneSociale.trim()} (P.IVA: ${partitaIvaFinal})`);
      }
    } catch (err) {
      console.error(`[ERRORE] Riga ${r + 1} (${ragioneSociale}):`, err.message);
      errorCount++;
    }
  }

  console.log(`\nImportazione clienti terminata!`);
  console.log(`- Clienti importati con successo: ${successCount}`);
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
