const fs = require('fs');
const xml2js = require('xml2js');
const { knex } = require('../db');
const { ottieniElaboratoClienti } = require('./elaborati');
const path = require('path');
const { sameDocument, sameOfficialInvoice } = require('../fatture_import_choice');

async function verifyReplacementXml(row) {
  const filename = String(row.filename || '');
  if (!filename || path.basename(filename) !== filename || path.extname(filename).toLowerCase() !== '.xml') {
    throw new Error('XML di sostituzione non valido. Ricarica il file.');
  }
  const root = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'uploads') : path.join(__dirname, '..', 'uploads');
  const file = path.join(root, 'unknown', filename);
  if (!fs.existsSync(file)) throw new Error('XML di sostituzione non disponibile. Ricarica il file.');
  const parsed = await parseSingoloXml(file);
  if (String(parsed.numero).trim() !== String(row.numero_fattura).trim() ||
      !sameDocument({ data_fattura: parsed.dataFattura, importo_totale: parsed.importoTotale }, row) ||
      Math.abs(Number(parsed.imponibile) - Number(row.importo_imponibile)) >= 0.011 ||
      Math.abs(Number(parsed.iva) - Number(row.importo_iva)) >= 0.011) {
    throw new Error('I dati della fattura non corrispondono al file XML originale. Ricarica il file.');
  }
}

async function parseSingoloXml(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
  const result = await parser.parseStringPromise(fileContent);

  const rootKey = Object.keys(result).find(k => k.includes('FatturaElettronica'));
  if (!rootKey) throw new Error("File non riconosciuto come Fattura Elettronica.");
  const root = result[rootKey];

  const datiGenerali = root?.FatturaElettronicaBody?.DatiGenerali?.DatiGeneraliDocumento;
  if (!datiGenerali) throw new Error("DatiGeneraliDocumento mancanti.");
  
  const doc = Array.isArray(datiGenerali) ? datiGenerali[0] : datiGenerali;
  const numero = doc.Numero;
  const dataFattura = doc.Data;

  // Causale
  let causaleTesto = '';
  if (doc.Causale) {
    if (Array.isArray(doc.Causale)) {
      causaleTesto = doc.Causale.join('\n');
    } else {
      causaleTesto = doc.Causale;
    }
  }

  // Importi
  let imponibile = 0;
  let iva = 0;
  let riepilogo = root?.FatturaElettronicaBody?.DatiBeniServizi?.DatiRiepilogo;
  if (riepilogo) {
    const riepilogoArray = Array.isArray(riepilogo) ? riepilogo : [riepilogo];
    riepilogoArray.forEach(r => {
      imponibile += parseFloat(r.ImponibileImporto || 0);
      iva += parseFloat(r.Imposta || 0);
    });
  }
  
  // Dettaglio Linee per estrarre la descrizione se Causale è vuota
  const dettaglioLinee = root?.FatturaElettronicaBody?.DatiBeniServizi?.DettaglioLinee;
  if (!causaleTesto && dettaglioLinee) {
    const linee = Array.isArray(dettaglioLinee) ? dettaglioLinee : [dettaglioLinee];
    causaleTesto = linee.map(l => l.Descrizione).filter(Boolean).join('; ');
  }

  let importoTotale = parseFloat(doc.ImportoTotaleDocumento || 0);
  if (!importoTotale) importoTotale = imponibile + iva;

  // Scadenza
  let dataScadenza = dataFattura;
  const datiPagamento = root?.FatturaElettronicaBody?.DatiPagamento;
  if (datiPagamento) {
    const pag = Array.isArray(datiPagamento) ? datiPagamento[0] : datiPagamento;
    const dettPag = pag.DettaglioPagamento;
    const d = Array.isArray(dettPag) ? dettPag[0] : dettPag;
    if (d && d.DataScadenzaPagamento) dataScadenza = d.DataScadenzaPagamento;
  }

  // Cliente
  const clienteDati = root?.FatturaElettronicaHeader?.CessionarioCommittente?.DatiAnagrafici;
  const sedeDati = root?.FatturaElettronicaHeader?.CessionarioCommittente?.Sede;
  
  if (!clienteDati) throw new Error("Dati cliente mancanti.");
  
  const pIva = clienteDati.IdFiscaleIVA?.IdCodice || '';
  const cf = clienteDati.CodiceFiscale || pIva;
  const anagrafica = clienteDati.Anagrafica;
  const ragioneSociale = anagrafica?.Denominazione || `${anagrafica?.Cognome || ''} ${anagrafica?.Nome || ''}`.trim();

  return {
    numero,
    dataFattura,
    dataScadenza,
    imponibile,
    iva,
    importoTotale,
    causale: causaleTesto,
    cliente: {
      pIva,
      cf,
      ragioneSociale,
      indirizzo: sedeDati?.Indirizzo || '',
      comune: sedeDati?.Comune || '',
      cap: sedeDati?.CAP || '',
      provincia: sedeDati?.Provincia || ''
    }
  };
}

async function anteprimaFattureXml(req, res) {
  if (!req.files || req.files.length === 0) {
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
    const elaboratoResult = await ottieniElaboratoClienti(meseInt, annoInt);
    const elaboratiDb = elaboratoResult.dati || [];

    const anteprima = [];
    
    for (const file of req.files) {
      try {
        const parsed = await parseSingoloXml(file.path);
        
        let matchedCliente = null;
        let discrepancy = false;
        
        // Match cliente
        if (parsed.cliente.pIva || parsed.cliente.cf) {
          matchedCliente = clientiDb.find(c => 
            (parsed.cliente.pIva && (c.partita_iva === parsed.cliente.pIva || c.codice_fiscale === parsed.cliente.pIva)) || 
            (parsed.cliente.cf && (c.codice_fiscale === parsed.cliente.cf || c.partita_iva === parsed.cliente.cf))
          );
        }
        
        if (!matchedCliente) {
          matchedCliente = clientiDb.find(c => 
            c.ragione_sociale.toLowerCase() === parsed.cliente.ragioneSociale.toLowerCase()
          );
        }

        if (matchedCliente) {
          // Check for discrepancies
          const pIvaXml = parsed.cliente.pIva || parsed.cliente.cf;
          const pIvaDb = matchedCliente.partita_iva || matchedCliente.codice_fiscale;
          if (pIvaXml && pIvaDb && pIvaXml !== pIvaDb) discrepancy = true;
          
          if (parsed.cliente.indirizzo && matchedCliente.indirizzo_sede && parsed.cliente.indirizzo.toLowerCase() !== matchedCliente.indirizzo_sede.toLowerCase()) {
            discrepancy = true;
          }
        }

        // Check elaborato
        let importoElaborato = null;
        let squadratura = false;
        if (matchedCliente) {
          const el = elaboratiDb.find(e => e.idCliente === matchedCliente.id);
          if (el) {
            importoElaborato = parseFloat(el.imponibile);
            if (Math.abs(importoElaborato - parsed.imponibile) > 0.50 && Math.abs(importoElaborato - parsed.importoTotale) > 0.50) {
              squadratura = true;
            }
          } else {
            squadratura = true;
          }
        } else {
          squadratura = true; // No client matched, so no elaborato possible
        }

        anteprima.push({
          idRow: "TMP_" + Math.random().toString(36).substr(2, 9),
          filename: file.filename, // keep track of the uploaded file to process later
          numero_fattura: parsed.numero,
          data_fattura: parsed.dataFattura,
          clienteCSV: parsed.cliente.ragioneSociale,
          pIvaCSV: parsed.cliente.pIva || parsed.cliente.cf,
          cliente_id: matchedCliente ? matchedCliente.id : null,
          cliente_nome: matchedCliente ? matchedCliente.ragione_sociale : null,
          importo_imponibile: parsed.imponibile,
          importo_iva: parsed.iva,
          importo_totale: parsed.importoTotale,
          importo_elaborato: importoElaborato,
          squadratura: squadratura,
          data_scadenza: parsed.dataScadenza,
          note: parsed.causale,
          xmlData: parsed.cliente,
          discrepancy: discrepancy
        });

      } catch (err) {
        console.error(`Errore parsing ${file.originalname}:`, err);
        // Clean up file if error
        try { fs.unlinkSync(file.path); } catch(e){}
      }
    }

    res.json({ success: true, dati: anteprima, clienti_disponibili: clientiDb, elaborati_disponibili: elaboratiDb });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function confermaFattureXml(req, res) {
  const { righe, aggiornamenti_clienti, risoluzioni = {}, mese, anno } = req.body;
  if (!righe || !Array.isArray(righe)) {
    return res.status(400).json({ success: false, error: 'Dati mancanti' });
  }

  try {
    const { reconcileOfficial, normalizedDate } = require('../fatture_reconciliation');
    const { inspectChoice, requireChoices, replaceRegistration } = require('../fatture_import_choice');
    const mantenute = [];
    let riconciliate = 0;
    await knex.transaction(async trx => {
    const inspected = [];
    const seen = new Set();
    for (const riga of righe) {
      if (!riga.cliente_id) { inspected.push(null); continue; }
      const key = `${riga.cliente_id}|${String(riga.numero_fattura || '').trim()}|${normalizedDate(riga.data_fattura).slice(0, 4)}`;
      if (seen.has(key)) throw new Error(`Il file contiene due volte la fattura ${riga.numero_fattura} per lo stesso cliente.`);
      seen.add(key);
      inspected.push(await inspectChoice(trx, { ...riga, mese, anno }));
    }
    requireChoices(inspected, risoluzioni);
    for (const item of inspected) if (item?.conflict && risoluzioni[item.conflict.key] === 'sostituisci' && !item.conflict.sostituibile) {
      const error = new Error(`La fattura ${item.conflict.numero_fattura} non può essere sostituita: manca la registrazione dell’addetto o risultano incassi.`);
      error.status = 409;
      throw error;
    }
    for (const riga of righe) {
      const item = inspected[righe.indexOf(riga)];
      if (item?.conflict && risoluzioni[item.conflict.key] === 'mantieni') {
        mantenute.push(riga.numero_fattura);
        continue;
      }
      if (!riga.cliente_id && riga.xmlData) {
        // Create new client
        const idStr = "CLI_" + Date.now() + Math.floor(Math.random() * 1000);
        await trx('clienti').insert({
          id: idStr,
          ragione_sociale: riga.xmlData.ragioneSociale,
          partita_iva: riga.xmlData.pIva || `MISSING_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          codice_fiscale: riga.xmlData.cf || null,
          indirizzo_sede: riga.xmlData.indirizzo,
          citta: riga.xmlData.comune,
          cap: riga.xmlData.cap,
          provincia: riga.xmlData.provincia,
          attivo: 'SI',
          cestinato: 0,
          creato_da: 'XML Import'
        });
        riga.cliente_id = idStr;
      }
      
      // Update client if user requested
      if (aggiornamenti_clienti && aggiornamenti_clienti[riga.idRow]) {
        const updateData = {
          ragione_sociale: riga.xmlData.ragioneSociale,
          indirizzo_sede: riga.xmlData.indirizzo,
          citta: riga.xmlData.comune,
          cap: riga.xmlData.cap,
          provincia: riga.xmlData.provincia
        };
        if (riga.xmlData.pIva) updateData.partita_iva = riga.xmlData.pIva;
        if (riga.xmlData.cf) updateData.codice_fiscale = riga.xmlData.cf;
        
        await trx('clienti').where('id', riga.cliente_id).update(updateData);
      }

      // Check if already exists
      if (!normalizedDate(riga.data_fattura) || !Number.isFinite(Number(riga.importo_totale))) throw new Error(`Data o totale non valido per la fattura ${riga.numero_fattura}.`);
      if (item?.conflict) {
        await verifyReplacementXml(riga);
        await replaceRegistration(trx, item.registration, riga, 'XML', req.authUser?.id, item.official);
      }
      const ext = item?.official || null;
      if (!ext) {
        const idFattura = "FAT_" + Date.now() + Math.floor(Math.random() * 1000);
        await trx('fatture').insert({
          id: idFattura,
          numero_fattura: riga.numero_fattura,
          data_fattura: riga.data_fattura,
          cliente_id: riga.cliente_id,
          importo_imponibile: riga.importo_imponibile,
          importo_iva: riga.importo_iva,
          importo_totale: riga.importo_totale,
          data_scadenza: riga.data_scadenza,
          stato_pagamento: 'Da Pagare',
          allegato_fattura: riga.filename, // link to the uploaded file
          note: riga.note
        });
        const outcome = await reconcileOfficial(trx, { id: idFattura, cliente_id: riga.cliente_id, numero_fattura: riga.numero_fattura, data_fattura: riga.data_fattura, importo_totale: riga.importo_totale });
        if (outcome.stato === 'riconciliata') riconciliate++;
      } else {
        if (!sameOfficialInvoice(ext, riga)) {
          await trx('fatture').where({ id: ext.id }).update({ data_fattura: normalizedDate(riga.data_fattura),
            importo_imponibile: riga.importo_imponibile, importo_iva: riga.importo_iva,
            importo_totale: riga.importo_totale, data_scadenza: riga.data_scadenza,
            allegato_fattura: riga.filename, note: riga.note });
        }
        const outcome = await reconcileOfficial(trx, { ...ext, data_fattura: riga.data_fattura, importo_totale: riga.importo_totale });
        if (outcome.stato === 'riconciliata') riconciliate++;
      }
    }
    });
    
    res.json({ success: true, riconciliate, mantenute });
  } catch (error) {
    if (error.status !== 409) console.error(error);
    res.status(error.status || 500).json({ success: false, error: error.message, conflitti: error.conflicts });
  }
}

module.exports = { anteprimaFattureXml, confermaFattureXml };
