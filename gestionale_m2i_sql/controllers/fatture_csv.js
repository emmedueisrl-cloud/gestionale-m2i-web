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
    const { fatture, risoluzioni = {}, mese, anno } = req.body;
    if (!Array.isArray(fatture)) {
      return res.status(400).json({ success: false, error: 'Dati non validi.' });
    }

    let inserite = 0;
    let riconciliate = 0;
    const mantenute = [];
    const { reconcileOfficial, normalizedDate } = require('../fatture_reconciliation');
    const { inspectChoice, requireChoices, replaceRegistration, sameOfficialInvoice } = require('../fatture_import_choice');
    
    await knex.transaction(async (trx) => {
      const inspected = [];
      const seen = new Set();
      for (const f of fatture) {
        if (!f.cliente_id) throw new Error('Ogni fattura deve avere un cliente associato.');
        const key = `${f.cliente_id}|${String(f.numero_fattura || '').trim()}|${normalizedDate(f.data_fattura).slice(0, 4)}`;
        if (seen.has(key)) throw new Error(`Il file contiene due volte la fattura ${f.numero_fattura} per lo stesso cliente.`);
        seen.add(key);
        inspected.push(await inspectChoice(trx, { ...f, mese, anno }));
      }
      requireChoices(inspected, risoluzioni);
      for (const item of inspected) if (item?.conflict && risoluzioni[item.conflict.key] === 'sostituisci' && !item.conflict.sostituibile) {
        const error = new Error(`La fattura ${item.conflict.numero_fattura} non può essere sostituita: manca la registrazione dell’addetto o risultano incassi.`);
        error.status = 409;
        throw error;
      }
      for (const f of fatture) {
        const item = inspected[fatture.indexOf(f)];
        if (item?.conflict && risoluzioni[item.conflict.key] === 'mantieni') {
          mantenute.push(f.numero_fattura);
          continue;
        }
        const dataFatturaFormat = normalizedDate(f.data_fattura);
        if (!dataFatturaFormat || !Number.isFinite(Number(f.importo_totale))) throw new Error(`Data o totale non valido per la fattura ${f.numero_fattura}.`);
        if (item?.conflict) await replaceRegistration(trx, item.registration, f, 'CSV', req.authUser?.id, item.official);
        const ext = item?.official;
        if (ext) {
          if (!sameOfficialInvoice(ext, f)) {
            await trx('fatture').where({ id: ext.id }).update({ data_fattura: dataFatturaFormat,
              importo_imponibile: f.importo_imponibile, importo_iva: f.importo_iva,
              importo_totale: f.importo_totale, data_scadenza: dataFatturaFormat });
          }
          const outcome = await reconcileOfficial(trx, { ...ext, data_fattura: dataFatturaFormat, importo_totale: f.importo_totale });
          if (outcome.stato === 'riconciliata') riconciliate++;
          continue;
        }

        const idFattura = "FAT_" + Date.now() + Math.floor(Math.random() * 1000);

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
        const outcome = await reconcileOfficial(trx, { id: idFattura, cliente_id: f.cliente_id, numero_fattura: f.numero_fattura, data_fattura: dataFatturaFormat, importo_totale: f.importo_totale });
        if (outcome.stato === 'riconciliata') riconciliate++;
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

    res.json({ success: true, inserite, riconciliate, mantenute });

  } catch (error) {
    if (error.status !== 409) console.error("[CSV CONFERMA ERROR]", error);
    res.status(error.status || 500).json({ success: false, error: error.message, conflitti: error.conflicts });
  }
}

module.exports = { anteprimaFattureCsv, confermaFattureCsv };
