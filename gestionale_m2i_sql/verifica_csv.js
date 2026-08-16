const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const csvFilePath = path.join(require('os').homedir(), 'Desktop', 'Modello_Importazione_Clienti.csv');

console.log("Inizio verifica del file CSV: " + csvFilePath);

const risultati = [];
let headersFound = [];

fs.createReadStream(csvFilePath)
  .pipe(csv({ separator: ',' }))
  .on('headers', (headers) => {
    headersFound = headers;
    console.log(`Trovate ${headers.length} colonne.`);
    if (!headers.includes('Email Cortesia 2')) {
      console.log("ATTENZIONE: La colonna 'Email Cortesia 2' NON è stata trovata esattamente con questo nome.");
    } else {
      console.log("OK: Colonna 'Email Cortesia 2' trovata correttamente.");
    }
  })
  .on('data', (row) => {
    risultati.push(row);
  })
  .on('end', () => {
    console.log(`Trovate ${risultati.length} righe dati.`);
    
    let erroriCritici = 0;
    let avvisi = 0;

    for (let i = 0; i < risultati.length; i++) {
      const row = risultati[i];
      const rigaNum = i + 2; // Riga 1 è l'intestazione
      
      const rs = (row['Ragione Sociale'] || '').trim();
      const pIva = (row['Partita IVA'] || '').trim();
      
      // Controllo Righe Vuote
      if (!rs && !pIva) {
         continue; // Riga totalmente vuota
      }
      
      if (!rs) {
        console.log(`[ERRORE CRITICO] Riga ${rigaNum}: Ragione Sociale mancante.`);
        erroriCritici++;
      }
      
      if (pIva && pIva.length !== 11) {
        console.log(`[AVVISO] Riga ${rigaNum}: La Partita IVA '${pIva}' non è di 11 caratteri.`);
        avvisi++;
      }
      
      // Controllo mail
      const email1 = (row['Email Cortesia'] || '').trim();
      if (email1 && !email1.includes('@')) {
        console.log(`[AVVISO] Riga ${rigaNum}: L'email 1 '${email1}' non sembra valida.`);
        avvisi++;
      }
      
      const email2 = (row['Email Cortesia 2'] || '').trim();
      if (email2 && !email2.includes('@')) {
        console.log(`[AVVISO] Riga ${rigaNum}: L'email 2 '${email2}' non sembra valida.`);
        avvisi++;
      }
    }
    
    console.log("-----------------------------------------");
    console.log("RISULTATO VERIFICA:");
    console.log(`Errori critici (impediscono l'importazione): ${erroriCritici}`);
    console.log(`Avvisi (si può importare, ma controlla i dati): ${avvisi}`);
    console.log("-----------------------------------------");
  });
