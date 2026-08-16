const fs = require('fs');
const path = require('path');
const { knex } = require('./db');

async function run() {
  const csvPath = path.join(__dirname, '../gestionale_m2i_react/sheet.csv');
  let fileContent = fs.readFileSync(csvPath, 'utf8');
  fileContent = fileContent.replace(/\x00/g, '');
  
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;
  
  for (let i = 0; i < fileContent.length; i++) {
    const char = fileContent[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && fileContent[i+1] === '\n') i++; 
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  const operatorsFound = new Set();
  const clientsFound = new Set();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    
    // Se la riga attuale è LUNEDI, MARTEDI, ecc...
    if (r[0] && r[0].toUpperCase() === 'LUNEDI') {
      // La riga precedente contiene l'operatore in r[0]
      if (i > 0 && rows[i-1][0]) {
        operatorsFound.add(rows[i-1][0].trim());
      }
      
      // Le righe successive (fino a una riga vuota o a un nuovo operatore) contengono i turni
      let j = i + 1;
      while (j < rows.length && rows[j] && (rows[j][0] !== 'LUNEDI' && (!rows[j][0] || !rows[j][0].endsWith('FERRAZZO')))) { 
        // Stop condition could be improved, but reading next few lines is enough
        if (rows[j].length > 0 && rows[j].join('').trim() === '') {
           j++; continue; // riga vuota
        }
        
        // Check if the next line is an operator (single value in col 0, others empty)
        let isOperator = rows[j][0] && rows[j][0].trim() !== '' && rows[j].slice(1).every(c => c === '');
        if (isOperator) break;

        for (let col = 0; col < 7; col++) {
          const cell = rows[j][col];
          if (cell && cell.trim()) {
            // Cerca un orario nel formato HH.MM / HH.MM o HH:MM-HH:MM
            const timeRegex = /([0-9]{1,2}[.:][0-9]{2})\s*[/-]\s*([0-9]{1,2}[.:][0-9]{2})/;
            const match = cell.trim().match(timeRegex);
            
            let clientName = cell.trim();
            if (match) {
              // Rimuove l'orario e pulisce eventuali spazi doppi o parentesi vuote rimaste
              clientName = clientName.replace(timeRegex, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
            } else {
              // Cerca se ci sono diciture tipo "3 ORE" o "X 1,5 ORE" e le rimuove opzionalmente, 
              // ma per ora consideriamo tutto il resto come nome cliente
            }
            
            if (clientName) {
              clientsFound.add(clientName);
            }
          }
        }
        j++;
      }
    }
  }

  console.log(`\n=== TROVATI NEL FILE ===`);
  console.log(`Operatori univoci: ${operatorsFound.size}`);
  console.log(`Clienti univoci: ${clientsFound.size}\n`);

  // Confronto con Database
  const dbDips = await knex('dipendenti').select('id', 'nome', 'cognome', 'stato');
  const dbClis = await knex('clienti').select('id', 'ragione_sociale');

  const unmatchedOps = [];
  for (const op of operatorsFound) {
    const opClean = op.toLowerCase().replace(/[^a-z]/g, '');
    let matched = false;
    for (const d of dbDips) {
      if (d.stato === 'Cessato') continue;
      const fullname1 = `${d.nome}${d.cognome}`.toLowerCase().replace(/[^a-z]/g, '');
      const fullname2 = `${d.cognome}${d.nome}`.toLowerCase().replace(/[^a-z]/g, '');
      if (opClean === fullname1 || opClean === fullname2) {
        matched = true; break;
      }
    }
    if (!matched) unmatchedOps.push(op);
  }

  const unmatchedClis = [];
  for (const cli of clientsFound) {
    const cliClean = cli.toLowerCase().replace(/[^a-z0-9]/g, '');
    let matched = false;
    for (const c of dbClis) {
      const cClean = c.ragione_sociale.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cliClean === cClean || cClean.includes(cliClean) || cliClean.includes(cClean)) {
        matched = true; break;
      }
    }
    if (!matched) unmatchedClis.push(cli);
  }

  console.log('=== DA MAPPARE (NON TROVATI ESATTAMENTE NEL DB) ===');
  console.log('\nOPERATORI:');
  unmatchedOps.forEach(o => console.log(`- ${o}`));
  
  console.log('\nCLIENTI:');
  unmatchedClis.forEach(c => console.log(`- ${c}`));

  process.exit(0);
}

run().catch(console.error);
