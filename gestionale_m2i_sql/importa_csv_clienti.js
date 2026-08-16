const fs = require('fs');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'gestionale.db');
const db = new sqlite3.Database(dbPath);

const csvFilePath = process.argv[2] || path.join(require('os').homedir(), 'Desktop', 'Modello_Importazione_Clienti.csv');

if (!fs.existsSync(csvFilePath)) {
  console.error(`Errore: File CSV non trovato: ${csvFilePath}`);
  console.error('Passa il percorso del file come parametro: node importa_csv_clienti.js "C:\\percorso\\file.csv"');
  process.exit(1);
}

const risultati = [];

fs.createReadStream(csvFilePath)
  .pipe(csv({ separator: ',' }))
  .on('data', (row) => {
    risultati.push(row);
  })
  .on('end', async () => {
    console.log(`Trovate ${risultati.length} righe da importare.`);
    
    let countSuccess = 0;
    let countErrors = 0;

    for (let i = 0; i < risultati.length; i++) {
      const row = risultati[i];
      try {
        const id = `C${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        const rs = (row['Ragione Sociale'] || '').trim();
        if (!rs) continue; // Salta righe vuote o senza Ragione Sociale

        let pIva = (row['Partita IVA'] || '').trim();
        if (!pIva) {
            pIva = 'NOPIVA_' + id;
        }
        
        const isNomeAttivitaUguale = (row['Nome Attivita Uguale a Ragione Sociale? (SI/NO)'] || '').toUpperCase() === 'SI';
        const nomeAttivita = isNomeAttivitaUguale ? rs : (row['Nome Attivita (se diverso)'] || '').trim();

        const isCfUguale = (row['Codice Fiscale Uguale a P.IVA? (SI/NO)'] || '').toUpperCase() === 'SI';
        const cf = isCfUguale ? pIva : (row['Codice Fiscale (se diverso)'] || '').trim();

        const indSede = (row['Indirizzo Sede Legale'] || '').trim();
        const civSede = (row['Civico Sede Legale'] || '').trim();
        const cap = (row['CAP'] || '').trim();
        const citta = (row['Citta'] || '').trim();
        const prov = (row['Provincia'] || '').trim();

        // Sedi operative
        const sediOp = [];
        const isSedeOpUguale = (row['Sede Operativa 1 Uguale a Sede Legale? (SI/NO)'] || '').toUpperCase() === 'SI';
        if (isSedeOpUguale) {
          sediOp.push(`${indSede} ${civSede} ${cap} ${citta} ${prov}`.replace(/\s+/g, ' ').trim());
        } else if (row['Sede Operativa 1 (Indirizzo Civico CAP Citta Prov)']) {
          sediOp.push(row['Sede Operativa 1 (Indirizzo Civico CAP Citta Prov)'].trim());
        }
        if (row['Sede Operativa 2']) sediOp.push(row['Sede Operativa 2'].trim());
        if (row['Sede Operativa 3']) sediOp.push(row['Sede Operativa 3'].trim());
        const sedeOperativaJoined = sediOp.join('|');

        // Telefoni
        const telefoniProcessati = [];
        for (let j = 1; j <= 4; j++) {
          const num = (row[`Numero Telefono ${j}`] || '').trim();
          const ref = (row[`Referente Telefono ${j}`] || '').trim();
          if (num) {
            telefoniProcessati.push(ref ? `${num} (${ref})` : num);
          }
        }
        const telefoniJoined = telefoniProcessati.join(', ');

        const pec = (row['PEC'] || '').trim();
        const sdi = (row['Codice SDI'] || '').trim();
        const titolare = (row['Nome e Cognome Titolare'] || '').trim();
        const telTitolare = (row['Telefono Titolare'] || '').trim();
        const refPrin = (row['Referente Principale'] || '').trim();
        const ruoloRef = (row['Ruolo Referente Principale'] || '').trim();
        const email = (row['Email Cortesia'] || '').trim();
        const emailSecondaria = (row['Email Cortesia 2'] || '').trim();
        const banca = (row['Banca'] || '').trim();
        const iban = (row['IBAN'] || '').trim();
        const condPag = (row['Condizioni Pagamento'] || '').trim();
        const note = (row['Note'] || '').trim();

        const qImporto = parseFloat((row['Importo Quotazione'] || '').replace(',', '.')) || 0;
        const qTipo = (row['Tipo Quotazione (Mensile/Annuale)'] || 'Mensile').trim();
        const tTipo = (row['Tipo Tassazione (IVA/TRAT. ACC./REVERSE CHARGE/ALTRO)'] || 'IVA').trim();
        const tAltro = (row['Tassazione Altro (se ALTRO)'] || '').trim();
        const tPerc = parseFloat((row['Percentuale Tassazione'] || '22').replace(',', '.')) || 0;

        await new Promise((resolve, reject) => {
          const stmt = db.prepare(`
            INSERT INTO clienti (
              id, ragione_sociale, nome_attivita, partita_iva, codice_fiscale,
              indirizzo_sede, civico_sede, cap, citta, provincia, sede_operativa,
              pec, codice_sdi, titolare, telefono_titolare, referente, ruolo_referente,
              telefono, email, email_secondaria, banca, iban, metodo_pagamento, note, 
              quotazione_importo, quotazione_tipo, tipo_tassazione, tassazione_altro, percentuale_tassazione
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            id, rs, nomeAttivita, pIva, cf,
            indSede, civSede, cap, citta, prov, sedeOperativaJoined,
            pec, sdi, titolare, telTitolare, refPrin, ruoloRef,
            telefoniJoined, email, emailSecondaria, banca, iban, condPag, note,
            qImporto, qTipo, tTipo, tAltro, tPerc,
            function (err) {
              if (err) {
                console.error(`Errore importazione cliente '${rs}' (PIVA: ${pIva}): ${err.message}`);
                countErrors++;
                reject(err);
              } else {
                countSuccess++;
                resolve();
              }
            }
          );
          stmt.finalize();
        });
      } catch (err) {
        // Errore loggato nel blocco, prosegue con il prossimo
      }
    }
    
    console.log('---');
    console.log(`Importazione completata: ${countSuccess} inseriti con successo, ${countErrors} errori.`);
    db.close();
  });
