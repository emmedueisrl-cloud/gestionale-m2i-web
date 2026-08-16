const fs = require('fs');
const xml2js = require('xml2js');
const { knex } = require('../db');

async function processFatturaXml(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Nessun file inviato.' });
  }

  try {
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Parse XML
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    const result = await parser.parseStringPromise(fileContent);

    // Extract the root element which can be something like p:FatturaElettronica
    const rootKey = Object.keys(result).find(k => k.includes('FatturaElettronica'));
    if (!rootKey) {
      throw new Error("File non riconosciuto come Fattura Elettronica.");
    }
    const root = result[rootKey];

    // Dati Generali Documento
    const datiGenerali = root?.FatturaElettronicaBody?.DatiGenerali?.DatiGeneraliDocumento;
    if (!datiGenerali) throw new Error("DatiGeneraliDocumento mancanti.");
    
    // Check if it's an array (multiple documents in one XML)
    const doc = Array.isArray(datiGenerali) ? datiGenerali[0] : datiGenerali;
    const numero = doc.Numero;
    const dataFattura = doc.Data;

    // Totali (can be sum of DatiRiepilogo or directly from ImportoTotaleDocumento)
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
    
    let importoTotale = parseFloat(doc.ImportoTotaleDocumento || 0);
    if (!importoTotale) importoTotale = imponibile + iva;

    // Scadenza
    let dataScadenza = dataFattura; // Fallback
    const datiPagamento = root?.FatturaElettronicaBody?.DatiPagamento;
    if (datiPagamento) {
      const pag = Array.isArray(datiPagamento) ? datiPagamento[0] : datiPagamento;
      const dettPag = pag.DettaglioPagamento;
      const d = Array.isArray(dettPag) ? dettPag[0] : dettPag;
      if (d && d.DataScadenzaPagamento) {
        dataScadenza = d.DataScadenzaPagamento;
      }
    }

    // Cliente (Cessionario/Committente)
    // Wait, se l'utente emette fattura, l'utente è CedentePrestatore, il cliente è CessionarioCommittente.
    // Se è una fattura ricevuta (passiva), l'utente è Cessionario, e il fornitore è Cedente.
    // Presumiamo siano fatture attive (Gestione Fatture - Ciclo Attivo).
    const clienteDati = root?.FatturaElettronicaHeader?.CessionarioCommittente?.DatiAnagrafici;
    const sedeDati = root?.FatturaElettronicaHeader?.CessionarioCommittente?.Sede;
    
    if (!clienteDati) throw new Error("Dati cliente (CessionarioCommittente) mancanti.");
    
    const pIva = clienteDati.IdFiscaleIVA?.IdCodice || '';
    const cf = clienteDati.CodiceFiscale || pIva;
    const anagrafica = clienteDati.Anagrafica;
    const ragioneSociale = anagrafica?.Denominazione || `${anagrafica?.Cognome || ''} ${anagrafica?.Nome || ''}`.trim();

    // Check if client exists
    let clienteId = null;
    let clienteRow = await knex('clienti')
      .where(function() {
        if(pIva) this.where('partita_iva', pIva);
        if(cf) this.orWhere('codice_fiscale', cf);
      })
      .first();
    
    if (clienteRow && (pIva || cf)) {
      clienteId = clienteRow.id;
    } else {
      // Create new client
      const idStr = "CLI_" + Date.now() + Math.floor(Math.random() * 1000);
      await knex('clienti').insert({
        id: idStr,
        ragione_sociale: ragioneSociale,
        partita_iva: pIva,
        codice_fiscale: cf,
        indirizzo_sede: sedeDati?.Indirizzo || '',
        citta: sedeDati?.Comune || '',
        cap: sedeDati?.CAP || '',
        provincia: sedeDati?.Provincia || '',
        attivo: 'SI'
      });
      clienteId = idStr;
    }

    // Check if fattura already exists
    const ext = await knex('fatture').where({ numero_fattura: numero, cliente_id: clienteId }).first();
    if (ext) {
      return res.status(400).json({ success: false, error: `La fattura n. ${numero} è già presente nel sistema.` });
    }

    // Insert Fattura
    const idFattura = "FAT_" + Date.now() + Math.floor(Math.random() * 1000);
    await knex('fatture').insert({
      id: idFattura,
      numero_fattura: numero,
      data_fattura: dataFattura,
      cliente_id: clienteId,
      importo_imponibile: imponibile,
      importo_iva: iva,
      importo_totale: importoTotale,
      data_scadenza: dataScadenza,
      stato_pagamento: 'Da Pagare',
      allegato_fattura: req.file.filename,
      stato: 'Emessa'
    });
    
    await knex('log_attivita').insert({
      categoria: "Fatture",
      icona: "📄",
      colore: "#10b981",
      descrizione: `Caricata fattura XML n. ${numero} per ${ragioneSociale}`,
      eseguito_da: "Upload"
    });

    res.json({ success: true, message: `Fattura ${numero} caricata con successo per ${ragioneSociale}` });

  } catch (error) {
    console.error("[FATTURA XML ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { processFatturaXml };
