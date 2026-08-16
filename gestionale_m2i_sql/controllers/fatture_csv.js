const fs = require('fs');
const csv = require('csv-parser');
const { knex } = require('../db');
const { ottieniElaboratoClienti } = require('./elaborati');

function parseCurrency(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    return parseFloat(val.replace(/€/g, '').replace(/\./g, '').replace(',', '.').trim()) || 0;
  }
  return 0;
}

// Calcola distanza di Levenshtein per fuzzy matching
function levenshtein(a, b) {
  if(a.length === 0) return b.length; 
  if(b.length === 0) return a.length; 
  var matrix = [];
  for(var i = 0; i <= b.length; i++){ matrix[i] = [i]; }
  for(var j = 0; j <= a.length; j++){ matrix[0][j] = j; }
  for(var i = 1; i <= b.length; i++){
    for(var j = 1; j <= a.length; j++){
      if(b.charAt(i-1) == a.charAt(j-1)){
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

async function anteprimaFattureCsv(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Nessun file inviato.' });
  }

  const { mese, anno } = req.body;
  if (!mese || !anno) {
    return res.status(400).json({ success: false, error: 'Mese e anno di riferimento obbligatori.' });
  }
  
  const meseInt = parseInt(mese, 10);
  const annoInt = parseInt(anno, 10);
  
  try {
    const clientiDb = await knex('clienti').select('*');
    
    // Recupero elaborato (chiuso o aperto calcolato al volo)
    const elaboratoResult = await ottieniElaboratoClienti(meseInt, annoInt);
    const elaboratiDb = elaboratoResult.dati || [];

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        // Clean up uploaded file
        try { fs.unlinkSync(req.file.path); } catch(e){}

        const anteprima = [];

        for (const row of results) {
          // Salta le Note di Credito se presenti, o righe vuote
          const numeroDoc = row['Numero'] ? row['Numero'].toString() : '';
          const tipoDoc = row['Tipo documento'] ? row['Tipo documento'].toString() : '';
          
          if (!numeroDoc || tipoDoc.includes('Nota di credito')) continue;

          let pIva = (row['P.IVA'] ? row['P.IVA'].toString() : '').trim();
          let cf = (row['Codice Fiscale'] ? row['Codice Fiscale'].toString() : '').trim();
          let clienteNomeCSV = (row['Cliente'] ? row['Cliente'].toString() : '').trim();

          let matchedCliente = null;

          // 1. Exact Match incrociato per P.IVA o CF
          if (pIva || cf) {
            matchedCliente = clientiDb.find(c => 
              (pIva && (c.partita_iva === pIva || c.codice_fiscale === pIva)) || 
              (cf && (c.codice_fiscale === cf || c.partita_iva === cf))
            );
          }

          // 2. Fuzzy Match sul nome se non trovato
          if (!matchedCliente && clienteNomeCSV) {
            let bestScore = 999;
            let bestMatch = null;
            for (const c of clientiDb) {
              const score = levenshtein(clienteNomeCSV.toLowerCase(), c.ragione_sociale.toLowerCase());
              if (score < bestScore && score < 5) {
                bestScore = score;
                bestMatch = c;
              } else if (c.ragione_sociale.toLowerCase().includes(clienteNomeCSV.toLowerCase()) || clienteNomeCSV.toLowerCase().includes(c.ragione_sociale.toLowerCase())) {
                 if(Math.abs(c.ragione_sociale.length - clienteNomeCSV.length) < 10) {
                    bestMatch = c;
                 }
              }
            }
            if (bestMatch) matchedCliente = bestMatch;
          }

          // 3. Estrazione Importi
          const totaleFattura = parseCurrency(row['Totale documento'] || row['Netto a pagare']);
          const imponibileFattura = parseCurrency(row['Totale imponibile']) + parseCurrency(row['Totale inversione contabile (N6)']);
          const ivaFattura = parseCurrency(row['Totale IVA']);

          // 4. Controllo Elaborato
          let importoElaborato = null;
          let squadratura = false;

          if (matchedCliente) {
            const el = elaboratiDb.find(e => e.idCliente === matchedCliente.id);
            if (el) {
              importoElaborato = parseFloat(el.imponibile);
              if (Math.abs(importoElaborato - imponibileFattura) > 0.05 && Math.abs(importoElaborato - totaleFattura) > 0.05) {
                squadratura = true;
              }
            } else {
              squadratura = true;
            }
          }
          
          let dataDocFormattata = row['Data documento'];
          if (typeof dataDocFormattata === 'string' && dataDocFormattata.includes('/')) {
             const parts = dataDocFormattata.split('/');
             if(parts.length === 3) dataDocFormattata = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }

          anteprima.push({
            idRow: "TMP_" + Math.random().toString(36).substr(2, 9),
            numero_fattura: numeroDoc,
            data_fattura: dataDocFormattata || '',
            clienteCSV: clienteNomeCSV,
            pIvaCSV: pIva || cf,
            cliente_id: matchedCliente ? matchedCliente.id : null,
            cliente_nome: matchedCliente ? matchedCliente.ragione_sociale : null,
            importo_imponibile: imponibileFattura,
            importo_iva: ivaFattura,
            importo_totale: totaleFattura,
            importo_elaborato: importoElaborato,
            squadratura: squadratura,
            data_scadenza: dataDocFormattata || ''
          });
        }

        res.json({ success: true, dati: anteprima, clienti_disponibili: clientiDb, elaborati_disponibili: elaboratiDb });
      });

  } catch (error) {
    console.error("[CSV ANTEPRIMA ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function confermaFattureCsv(req, res) {
  try {
    const { fatture } = req.body;
    if (!Array.isArray(fatture)) {
      return res.status(400).json({ success: false, error: 'Dati non validi.' });
    }

    let inserite = 0;
    
    await knex.transaction(async (trx) => {
      for (const f of fatture) {
        if (!f.cliente_id) continue; // Salta chi non ha un cliente associato
        
        // Verifica se esiste già
        const ext = await trx('fatture').where({ numero_fattura: f.numero_fattura, cliente_id: f.cliente_id }).first();
        if (ext) continue;

        const idFattura = "FAT_" + Date.now() + Math.floor(Math.random() * 1000);
        
        // Conversione data da DD/MM/YYYY a YYYY-MM-DD
        let dataFatturaFormat = f.data_fattura;
        if (dataFatturaFormat && dataFatturaFormat.includes('/')) {
            const parts = dataFatturaFormat.split('/');
            if(parts.length === 3) dataFatturaFormat = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }

        await trx('fatture').insert({
          id: idFattura,
          numero_fattura: f.numero_fattura,
          data_fattura: dataFatturaFormat,
          cliente_id: f.cliente_id,
          importo_imponibile: f.importo_imponibile,
          importo_iva: f.importo_iva,
          importo_totale: f.importo_totale,
          data_scadenza: dataFatturaFormat, // Come default
          stato_pagamento: 'Emessa'
        });
        inserite++;
      }
      
      if(inserite > 0) {
        await trx('log_attivita').insert({
          categoria: "Fatture",
          icona: "📊",
          colore: "#10b981",
          descrizione: `Importate ${inserite} fatture da file CSV Aruba`,
          eseguito_da: "Importatore"
        });
      }
    });

    res.json({ success: true, inserite });

  } catch (error) {
    console.error("[CSV CONFERMA ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { anteprimaFattureCsv, confermaFattureCsv };
