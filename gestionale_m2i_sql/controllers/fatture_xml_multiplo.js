const fs = require('fs');
const xml2js = require('xml2js');
const { knex } = require('../db');
const { ottieniElaboratoClienti } = require('./elaborati');

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
  const { righe, aggiornamenti_clienti } = req.body;
  if (!righe || !Array.isArray(righe)) {
    return res.status(400).json({ success: false, error: 'Dati mancanti' });
  }

  try {
    for (const riga of righe) {
      if (!riga.cliente_id && riga.xmlData) {
        // Create new client
        const idStr = "CLI_" + Date.now() + Math.floor(Math.random() * 1000);
        await knex('clienti').insert({
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
        
        await knex('clienti').where('id', riga.cliente_id).update(updateData);
      }

      // Check if already exists
      const ext = await knex('fatture').where({ numero_fattura: riga.numero_fattura, cliente_id: riga.cliente_id }).first();
      if (!ext) {
        const idFattura = "FAT_" + Date.now() + Math.floor(Math.random() * 1000);
        await knex('fatture').insert({
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
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { anteprimaFattureXml, confermaFattureXml };
