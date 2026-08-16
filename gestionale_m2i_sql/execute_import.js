const fs = require('fs');
const path = require('path');
const { knex } = require('./db');

async function run() {
  const csvPath = path.join(__dirname, '../gestionale_m2i_react/sheet.csv');
  let fileContent = fs.readFileSync(csvPath, 'utf8').replace(/\x00/g, '');
  
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

  // Dizionari
  const opMap = {
    'lola kaja verore   .': 'VERORE KAJA',
    'ada di stazio (velletri)  .': 'ADA DI STAZIO',
    'pino .': 'ZIO PINO'
  };

  const cliMap = {
    'dott. russo': 'CENTRO ODONTOIATRICO RUSSO S.T.P. S.R.L.',
    'coccoliamoci (1 volta al mese x3 ore)': 'PAPPANAMA APS',
    'centro estetico stefania mevoli': 'STEFANIA MEVOLI BEAUTY ADVANCE',
    'cond. via luce d\'eramo': 'CONDOMINIO VIA LUCE D\'ERAMO 67/103',
    'dott. letta': 'ROBERTO LETTA',
    'letta 07.00/09.00': 'ROBERTO LETTA',
    'condominio de\' marchesetti x 1,5 ore': 'CONDOMINIO VIA CARLO DE\' MARCHESETTI N.102 PAL.A1',
    'motus vita': 'MOTUSMEDICA SRL STP',
    'st. commentucci': 'STUDIO DENTISTICO DR. ANTONELLO COMMENTUCCI',
    'farm europea guadagno': 'GUADAGNO ANGELO',
    'st. angelini': 'FARMACIE ANGELINI S.R.L.',
    'farm. angelini': 'FARMACIE ANGELINI S.R.L.',
    'cond. pellini': 'CONDOMINIO VIA ERCOLE PELLINI N.15',
    '3 ore al.gi.dent': 'AL.GI.DENT DI TUFO GIUSEPPE E LAZZARA',
    '11.00 / 15.00 good time': 'GOOD TIME SRLS',
    'p. europa': 'GE.SPO.E. SRL',
    'aspmi': 'ASSOCIAZIONE SINDACALE PROFESSIONISTI MILITARI',
    'f. bardella': 'FARMACIA BARDELLA SNC',
    'scarno 07.30/09.30': 'FARMACIA MORENA DI SCARNO\' S.A.S.',
    'ribar': 'RIMINI BAR - SOCIETA A RESPONSABILITA LIMITATA',
    's. maria': 'FARMACIA SANTA MARIA DELLA DOTT.SSA VALENTINA TATA',
    'raspa riccardo': 'RICCARDO RASPA',
    'farm acquafredda': 'FARMACIA ACQUAFREDDA',
    'farm jungano': 'FARMACIA JUNGANO SNC',
    'st. ass. barnaba caracci (genzano)': 'STUDIO ASSOCIATO BARNABA CARACCI',
    'st. fisioterapico scannavini': 'STUDIO ASS.TO FISIOTERAPICO SCANNAVINI PAOLO',
    'st. medico ramundo 08.30/10.30 farmacia ramundo': 'FARMACIA TIBURTINA S.A.S DI UMBERTO RAMUNDO MONTARSOLO',
    'gr autoric. (06.45/08.45) vetri ogni 15gg': 'G.R. AUTORICAMBI S.N.C.',
    'condominio prenestina 07.00/11.00': 'CONDOMINIO VIA PRENESTINA N.376A',
    'condominio maculani 06.00/08.00': 'CONDOMINIO VIA MACULANI 16',
    'toscano alessandrino': 'PUNTO IMMOBILIARE ALESSANDRINO',
    'farm olimpia': 'FARMACIA OLIMPIA S.N.C.',
    'farmacia caffarella': 'FARMACIA DELLA CAFFARELLA',
    'tor vergata': 'ORIZZONTI BLU ITALIA S.S.D. A RESPONSABILITA\' LIMITATA',
    'delta': 'TAVANIELLO DAFNE NOEMI',
    'f. semplice': 'EXPERT ADVISOR'
  };

  const dbDips = await knex('dipendenti').select('id', 'nome', 'cognome', 'stato');
  const dbClis = await knex('clienti').select('id', 'ragione_sociale');

  function getDipendenteId(rawName) {
    let search = rawName.toLowerCase().replace(/[^a-z]/g, '');
    if (opMap[rawName.toLowerCase()]) {
      search = opMap[rawName.toLowerCase()].toLowerCase().replace(/[^a-z]/g, '');
    }
    for (const d of dbDips) {
      if (d.stato === 'Cessato') continue;
      const f1 = `${d.nome}${d.cognome}`.toLowerCase().replace(/[^a-z]/g, '');
      const f2 = `${d.cognome}${d.nome}`.toLowerCase().replace(/[^a-z]/g, '');
      if (search === f1 || search === f2) return d.id;
    }
    return null;
  }

  function getClienteId(rawName) {
    let search = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cliMap[rawName.toLowerCase()]) {
      search = cliMap[rawName.toLowerCase()].toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    for (const c of dbClis) {
      const dbC = c.ragione_sociale.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (search === dbC || dbC.includes(search) || search.includes(dbC)) return c.id;
    }
    return null;
  }

  const shiftsToInsert = [];
  const operatorsToClear = new Set();
  const giorniMap = ['LUNEDI', 'MARTEDI', 'MERCOLEDI', 'GIOVEDI', 'VENERDI', 'SABATO', 'DOMENICA'];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    
    if (r[0] && r[0].toUpperCase() === 'LUNEDI') {
      let currentOpRaw = null;
      let dipId = null;

      if (i > 0 && rows[i-1][0]) {
        currentOpRaw = rows[i-1][0].trim();
        dipId = getDipendenteId(currentOpRaw);
        if (dipId) operatorsToClear.add(dipId);
      }
      
      let j = i + 1;
      while (j < rows.length && rows[j] && (rows[j][0] !== 'LUNEDI' && (!rows[j][0] || !rows[j][0].endsWith('FERRAZZO')))) { 
        if (rows[j].length > 0 && rows[j].join('').trim() === '') { j++; continue; }
        
        let isOperator = rows[j][0] && rows[j][0].trim() !== '' && rows[j].slice(1).every(c => c === '');
        if (isOperator) break;

        for (let col = 0; col < 7; col++) {
          const cell = rows[j][col];
          if (!cell || !cell.trim() || !dipId) continue;

          // SPECIAL CASE 1: RAMUNDO DOUBLE SHIFT
          if (cell.includes('ST. MEDICO RAMUNDO') && cell.includes('FARMACIA RAMUNDO')) {
             shiftsToInsert.push({
               dipendente_id: dipId,
               giorno_settimana: giorniMap[col],
               ora_inizio: '06:30', ora_fine: '08:30',
               cliente_id: getClienteId('FARMACIA TIBURTINA S.A.S DI UMBERTO RAMUNDO MONTARSOLO'),
               note: cell, frequenza: 'Settimanale'
             });
             shiftsToInsert.push({
               dipendente_id: dipId,
               giorno_settimana: giorniMap[col],
               ora_inizio: '08:30', ora_fine: '10:30',
               cliente_id: getClienteId('FARMACIA TIBURTINA S.A.S DI UMBERTO RAMUNDO MONTARSOLO studio'),
               note: cell, frequenza: 'Settimanale'
             });
             continue;
          }

          // SPECIAL CASE 2: GR AUTORICAMBI (06.45/08.45) VETRI
          if (cell.includes('GR AUTORIC.') && cell.includes('VETRI')) {
             shiftsToInsert.push({
               dipendente_id: dipId,
               giorno_settimana: giorniMap[col],
               ora_inizio: '07:15', ora_fine: '09:15',
               cliente_id: getClienteId('G.R. AUTORICAMBI S.N.C.'),
               note: cell, frequenza: 'Settimanale'
             });
             continue;
          }

          const timeRegex = /([0-9]{1,2})[.:]([0-9]{2})\s*[/-]\s*([0-9]{1,2})[.:]([0-9]{2})/;
          const match = cell.trim().match(timeRegex);
          
          let clientName = cell.trim();
          let oIn = null; let oFin = null;
          if (match) {
            clientName = clientName.replace(timeRegex, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
            oIn = `${match[1].padStart(2, '0')}:${match[2]}`;
            oFin = `${match[3].padStart(2, '0')}:${match[4]}`;
          } else {
             // Formati strani (es: 3 ORE AL.GI.DENT)
             const oreRegex = /(?:([0-9]+(?:\.[0-9]+)?|\d+,\d+)\s*(?:ORE|ORA))|(?:X\s*([0-9]+(?:\.[0-9]+)?|\d+,\d+)\s*(?:ORE|ORA))/i;
             if (cell.match(oreRegex)) {
                // Impostiamo orario fittizio 08:00 - 11:00 se dice 3 ore
                oIn = '08:00'; oFin = '11:00'; // Default 3h per non lasciare vuoto
             } else {
                oIn = '08:00'; oFin = '10:00'; // Fallback
             }
          }
          
          const cid = getClienteId(clientName) || null;
          shiftsToInsert.push({
             dipendente_id: dipId,
             giorno_settimana: giorniMap[col],
             ora_inizio: oIn,
             ora_fine: oFin,
             cliente_id: cid,
             note: cell,
             frequenza: 'Settimanale'
          });
        }
        j++;
      }
    }
  }

  console.log(`Sto per cancellare i turni di ${operatorsToClear.size} dipendenti e inserire ${shiftsToInsert.length} nuovi turni.`);
  
  // Esecuzione su DB
  try {
     for (const d of operatorsToClear) {
        await knex('programma_fisso').where('dipendente_id', d).del();
     }
     if (shiftsToInsert.length > 0) {
        await knex('programma_fisso').insert(shiftsToInsert);
     }
     console.log('SUCCESS! Inserimento completato.');
  } catch (err) {
     console.error('ERRORE DATABASE:', err);
  }

  process.exit(0);
}

run().catch(console.error);
