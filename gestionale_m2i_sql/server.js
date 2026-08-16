const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const api = require('./backend_api');
const multer = require('multer');
const excelGenerator = require('./excel_generator');
const { knex } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Security Headers Base
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve i file statici del frontend (abilita l'accesso se il percorso contiene cartelle con il punto come .gemini)
const reactDistPath = path.join(__dirname, '../gestionale_m2i_react/dist');
app.use(express.static(reactDistPath, { dotfiles: 'allow' }));
const baseUploadPath = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'uploads') : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(baseUploadPath));

// Configurazione Multer per l'upload dei file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const rawId = req.body.idCliente || req.body.idDipendente || 'unknown';
    // Fix: Path Traversal prevention (solo alfanumerici e trattini)
    const idSafe = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    const uploadDir = path.join(baseUploadPath, idSafe);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = require('path').extname(file.originalname);
    if (req.body.tipoDocumento && (req.body.nome || req.body.cognome)) {
      const safeTipo = req.body.tipoDocumento.replace(/[^a-zA-Z0-9_-]/g, '');
      const safeCognome = (req.body.cognome || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
      const safeNome = (req.body.nome || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
      const timestamp = Date.now();
      
      const parts = [safeTipo, safeCognome, safeNome].filter(Boolean).join(' ');
      cb(null, `${parts}_${timestamp}${ext}`);
    } else {
      const timestamp = Date.now();
      cb(null, `${timestamp}_${file.originalname}`);
    }
  }
});
const upload = multer({ storage: storage });

const { processFatturaXml } = require('./controllers/fatture_xml');
const { anteprimaFattureCsv, confermaFattureCsv } = require('./controllers/fatture_csv');

// Endpoint per importazione Fattura XML singola (vecchio)
app.post('/api/upload-fattura-xml', upload.single('file'), processFatturaXml);

// Endpoints per importazione massiva XML (nuovo)
const { anteprimaFattureXml, confermaFattureXml } = require('./controllers/fatture_xml_multiplo');
app.post('/api/anteprima-fatture-xml', upload.array('files', 100), anteprimaFattureXml);
app.post('/api/conferma-fatture-xml', confermaFattureXml);

// Endpoints per importazione massiva CSV
app.post('/api/anteprima-fatture-csv', upload.single('file'), anteprimaFattureCsv);
app.post('/api/conferma-fatture-csv', confermaFattureCsv);

// Endpoint per l'upload di singoli file
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nessun file inviato.' });
    }
    
    const rawId = req.body.idCliente || req.body.idDipendente || 'unknown';
    const idSafe = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = `uploads/${idSafe}/${req.file.filename}`;
    
    console.log(`[API UPLOAD] Salvato file: ${filePath}`);
    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error(`[API UPLOAD ERROR]:`, error);
    res.status(500).json({ success: false, error: 'Errore interno durante il caricamento del file.' });
  }
});

// Endpoint per l'upload di file multipli (es. per foto clienti)
app.post('/api/upload-multiple', upload.array('files', 20), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Nessun file inviato.' });
    }
    
    const rawId = req.body.idCliente || req.body.idDipendente || 'unknown';
    const idSafe = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    
    const filePaths = req.files.map(file => `uploads/${idSafe}/${file.filename}`);
    
    console.log(`[API UPLOAD-MULTIPLE] Salvati ${req.files.length} file in uploads/${idSafe}`);
    res.json({ success: true, paths: filePaths });
  } catch (error) {
    console.error(`[API UPLOAD-MULTIPLE ERROR]:`, error);
    res.status(500).json({ success: false, error: 'Errore interno durante il caricamento dei file.' });
  }
});

const magazzinoCtrl = require('./controllers/magazzino');

// Endpoint Magazzino
app.get('/api/magazzino', magazzinoCtrl.getTuttoMagazzino);
app.get('/api/magazzino/cliente/:idCliente', magazzinoCtrl.getAttrezzatureCliente);
app.post('/api/magazzino', upload.array('foto', 5), magazzinoCtrl.creaAttrezzatura);
app.put('/api/magazzino/:id/assegna', magazzinoCtrl.assegnaAttrezzatura);
app.delete('/api/magazzino/:id', magazzinoCtrl.eliminaAttrezzatura);

// Route principale per aprire l'applicazione
app.get('/', (req, res) => {
  const filePath = path.resolve(__dirname, '../gestionale_m2i_react/dist/index.html');
  console.log(`[ROUTE /] Servendo file: ${filePath}`);
  if (fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.sendFile(filePath, { dotfiles: 'allow' });
  } else {
    res.status(404).send(`File index.html non trovato nel percorso: ${filePath}`);
  }
});

// Endpoint proxy centralizzato per le chiamate client-side google.script.run
app.post('/api/run', async (req, res) => {
  const { functionName, args } = req.body;
  console.log(`[API CALL] Chiamata a funzione: ${functionName}`, args ? JSON.stringify(args) : '');

  try {
    // Intercetta speciale per il caricamento dei moduli HTML (Single Page Application)
    if (functionName === "prendiHtmlContenutoInApp") {
      const moduleName = args ? args[0] : null;
      if (!moduleName) return res.json({ success: false, error: "Modulo HTML mancante" });
      const filePath = path.join(__dirname, `${moduleName}.html`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return res.json({ success: true, data: content });
      } else {
        return res.json({ success: false, error: `Modulo HTML ${moduleName} non trovato.` });
      }
    }

    // Verifica se la funzione è definita nel nostro backend SQL
    if (Object.prototype.hasOwnProperty.call(api, functionName) && typeof api[functionName] === 'function') {
      const safeArgs = Array.isArray(args) ? args : [];
      const result = await api[functionName](...safeArgs);
      return res.json({ success: true, data: result });
    }

    // Risposta mockata di successo per le funzioni non vitali o puramente estetiche
    const mockFunctions = [
      "nascondiFogliFrazionati", "configuraFoglioIngressoEstetico", 
      "mostraTuttiIFogli", "riparaDatabaseClienti", "registraAttivita"
    ];

    if (mockFunctions.includes(functionName)) {
      console.log(`[MOCK] Risposta automatica Mock per ${functionName}`);
      return res.json({ success: true, data: null });
    }

    console.warn(`[WARNING] Funzione backend '${functionName}' non ancora implementata.`);
    return res.json({ success: false, error: `Funzione '${functionName}' non ancora implementata nel server locale.` });

  } catch (error) {
    console.error(`[ERROR] Errore nell'esecuzione di ${functionName}:`, error.message);
    return res.json({ success: false, error: error.message });
  }
});

// ==========================================
// ENDPOINT GENERAZIONE PDF (Fase 6)
// ==========================================
const pdfGenerator = require('./pdf_generator');

app.get('/api/pdf/fattura/:id', async (req, res) => {
  try {
    const fattura = await knex('fatture').where({ id: req.params.id }).first();
    if (!fattura) return res.status(404).send('Fattura non trovata');
    
    const cliente = await knex('clienti').where({ id: fattura.cliente_id }).first();
    fattura.cliente = cliente ? cliente.ragione_sociale : 'Cliente Sconosciuto';
    
    const doc = pdfGenerator.buildFatturaPDF(fattura);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Fattura_${fattura.numero}.pdf"`);
    const buffer = await doc.getBuffer(); res.send(buffer);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/pdf/provvigioni', async (req, res) => {
  try {
    const { mese, anno, cliente_id } = req.query;
    const data = await knex('dettaglio_mesi_chiusi_provvigioni')
      .where({ mese, anno, cliente_id }).first();
    
    if (!data) return res.status(404).send('Dati non trovati');
    
    const doc = pdfGenerator.buildProvvigioniPDF(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Provvigioni_${mese}_${anno}.pdf"`);
    const buffer = await doc.getBuffer(); res.send(buffer);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/pdf/elaborato-dipendente', async (req, res) => {
  try {
    const { mese, anno, dipendente_id } = req.query;
    const data = await knex('dettaglio_mesi_chiusi_dipendenti')
      .where({ mese, anno, dipendente_id }).first();
    
    if (!data) return res.status(404).send('Dati non trovati');
    
    const doc = pdfGenerator.buildElaboratoDipendentePDF(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BustaPaga_${data.cognome_nome.replace(/\s+/g, '_')}_${mese}_${anno}.pdf"`);
    const buffer = await doc.getBuffer(); res.send(buffer);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/pdf/elaborato-cliente', async (req, res) => {
  try {
    const { mese, anno, cliente_id } = req.query;
    const data = await knex('dettaglio_mesi_chiusi_clienti')
      .where({ mese, anno, cliente_id }).first();
    
    if (!data) return res.status(404).send('Dati non trovati');
    
    const doc = pdfGenerator.buildElaboratoClientePDF(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Fattura_Cortesia_${data.ragione_sociale.replace(/\s+/g, '_')}_${mese}_${anno}.pdf"`);
    const buffer = await doc.getBuffer(); res.send(buffer);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/pdf/stampa-elaborato-clienti', async (req, res) => {
  try {
    const { mese, anno } = req.query;
    const elaborato = await api.ottieniElaboratoClienti(mese, anno);
    const dati = elaborato.dati;
    
    const noteMensili = await knex('note_elaborati').where({ tipo: 'cliente', mese, anno });
    const noteFisse = await knex('clienti').select('id', 'note_fisse_elaborato');
    
    const datiCompleti = dati.map(d => {
      const notaMensile = noteMensili.find(n => n.soggetto_id == d.idCliente)?.testo || '';
      const notaFissa = noteFisse.find(n => n.id == d.idCliente)?.note_fisse_elaborato || '';
      return { ...d, notaMensile, notaFissa };
    });
    
    const doc = pdfGenerator.buildStampaElaboratoClientiPDF(datiCompleti, mese, anno);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Stampa_Elaborato_Clienti_${mese}_${anno}.pdf"`);
    const buffer = await doc.getBuffer(); res.send(buffer);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/pdf/stampa-elaborato-dipendenti', async (req, res) => {
  try {
    const { mese, anno } = req.query;
    const elaborato = await api.ottieniElaboratoMensile(mese, anno);
    const dati = elaborato.dati;
    
    const noteMensili = await knex('note_elaborati').where({ tipo: 'dipendente', mese, anno });
    const noteFisse = await knex('dipendenti').select('id', 'note_fisse_elaborato');
    
    const datiCompleti = dati.map(d => {
      const notaMensile = noteMensili.find(n => n.soggetto_id == d.idDipendente)?.testo || '';
      const notaFissa = noteFisse.find(n => n.id == d.idDipendente)?.note_fisse_elaborato || '';
      return { ...d, notaMensile, notaFissa };
    });
    
    const doc = pdfGenerator.buildStampaElaboratoDipendentiPDF(datiCompleti, mese, anno);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Stampa_Elaborato_Dipendenti_${mese}_${anno}.pdf"`);
    const buffer = await doc.getBuffer(); res.send(buffer);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/excel/scarica-presenze', async (req, res) => {
  try {
    const { mese, anno, dipendente_id, precompila } = req.query;
    
    // Fetch dipendente info
    const dip = await knex('dipendenti').where({ id: dipendente_id }).first();
    if (!dip) return res.status(404).send('Dipendente non trovato');

    const clientiRows = await knex('clienti').select('ragione_sociale').where({ attivo: 'SI', cestinato: 0 }).orderBy('ragione_sociale', 'asc');
    const clientiValidi = clientiRows.map(c => c.ragione_sociale.toUpperCase());

    let colonne = [];
    
    if (precompila === 'true') {
      const progData = await api.precompilaDaProgrammaFisso(dipendente_id, mese, anno);
      colonne = progData.map(p => ({
        clienteId: p.idCliente,
        clienteNome: p.cliente,
        ore: p.giorni
      }));
      const extraCols = Math.max(5 - colonne.length, 0);
      for (let i = 0; i < extraCols; i++) {
        colonne.push({ clienteId: null, clienteNome: "", ore: Array(31).fill(0) });
      }
    } else {
      // 5 colonne vuote
      for (let i = 0; i < 5; i++) {
        colonne.push({ clienteId: null, clienteNome: "", ore: Array(31).fill(0) });
      }
    }

    const data = {
      dipendente: `${dip.nome} ${dip.cognome}`,
      mese: parseInt(mese, 10),
      anno: parseInt(anno, 10),
      clientiValidi,
      colonne
    };
    
    const workbook = await excelGenerator.buildFoglioPresenzeExcel(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="FoglioPresenze_${data.dipendente.replace(/\s+/g, '_')}_${mese}_${anno}.xlsx"`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

const uploadMem = multer({ storage: multer.memoryStorage() });

const bustePagaUploadCtrl = require('./controllers/buste_paga_upload');
app.post('/api/buste-paga/upload', uploadMem.array('files', 100), bustePagaUploadCtrl.anteprimaBustePaga);
app.post('/api/buste-paga/conferma', bustePagaUploadCtrl.confermaBustePaga);
app.get('/api/buste-paga/mese', bustePagaUploadCtrl.getBusteMese);
app.get('/api/buste-paga/dipendente/:dipendenteId', bustePagaUploadCtrl.getBusteDipendente);
app.delete('/api/buste-paga/mese/:anno/:mese', bustePagaUploadCtrl.eliminaBusteMese);
app.delete('/api/buste-paga/:id', bustePagaUploadCtrl.eliminaBustaPaga);



app.post('/api/excel/carica-presenze', uploadMem.single('file'), async (req, res) => {
  try {
    const { dipendente_id, mese, anno } = req.body;
    if (!req.file) return res.status(400).send('Nessun file caricato');

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const presenzeSheet = workbook.worksheets.find(ws => ws.name.startsWith('Presenze'));
    if (!presenzeSheet) {
      return res.status(400).send('Foglio "Presenze" non trovato nel file.');
    }

    const headerRow = presenzeSheet.getRow(1);
    const colMap = {};
    for (let colIndex = 2; colIndex <= presenzeSheet.columnCount; colIndex++) {
      const cellValue = headerRow.getCell(colIndex).value;
      if (cellValue) {
        let val = typeof cellValue === 'string' ? cellValue.trim() : cellValue.toString().trim();
        colMap[colIndex] = val.toUpperCase();
      }
    }

    if (Object.keys(colMap).length === 0) {
      return res.status(400).send('Nessun cliente o causale specificato nelle intestazioni delle colonne.');
    }

    const righeMap = {};
    const numGiorniMese = new Date(anno, mese, 0).getDate();

    for (const [colIndex, nomeCol] of Object.entries(colMap)) {
      const clienteRow = await knex('clienti').whereRaw('UPPER(ragione_sociale) = ?', [nomeCol]).first();
      let idCliente = null;
      let causale = "Ordinario";
      
      if (clienteRow) {
        idCliente = clienteRow.id;
      } else {
        causale = nomeCol;
      }

      const key = `${idCliente || 'null'}_${causale}`;
      if (!righeMap[key]) {
        righeMap[key] = {
          idCliente: idCliente,
          cliente: nomeCol,
          causale: causale,
          note: "Da Excel",
          giorni: Array(31).fill(0)
        };
      }
      
      colMap[colIndex] = key;
    }

    for (let giorno = 1; giorno <= numGiorniMese; giorno++) {
      const rowIndex = giorno + 1;
      const row = presenzeSheet.getRow(rowIndex);
      
      for (const [colIndex, key] of Object.entries(colMap)) {
        const cell = row.getCell(Number(colIndex));
        let val = 0;
        if (cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) {
            val = parseFloat(cell.value.result);
        } else {
            val = parseFloat(cell.value);
        }
        if (isNaN(val)) val = 0;
        
        if (val > 0) {
          righeMap[key].giorni[giorno - 1] += val;
        }
      }
    }

    const righeDaSalvare = Object.values(righeMap).filter(r => r.giorni.some(h => h > 0));
    console.log("COL MAP:", colMap);
    console.log("RIGHE DA SALVARE:", JSON.stringify(righeDaSalvare, null, 2));

    if (righeDaSalvare.length === 0) {
      if (Object.keys(colMap).length === 0) {
        return res.status(400).send('Il file non contiene intestazioni di colonna. Apri il file Excel e seleziona il cliente nel menu a tendina della riga 1, poi inserisci le ore e ricarica il file.');
      }
      return res.status(400).send('Il file non contiene ore inserite. Inserisci le ore nei giorni del mese e ricarica il file.');
    }

    const meseNum = parseInt(mese, 10);
    const annoNum = parseInt(anno, 10);

    // Cancella righe esistenti
    await knex('registro_ore').where({ dipendente_id, mese: meseNum, anno: annoNum }).del();

    // Recupera paga oraria del dipendente
    const dipInfo = await knex('dipendenti').select('paga_oraria_reale').where('id', dipendente_id).first();
    const pagaOraria = dipInfo ? (parseFloat(dipInfo.paga_oraria_reale) || 0) : 0;

    // Inserisce le righe
    for (const r of righeDaSalvare) {
      const dbRow = {
        mese: meseNum,
        anno: annoNum,
        dipendente_id: dipendente_id,
        cliente_id: r.idCliente || null,
        causale_assenza: (r.idCliente ? 'Ordinario' : r.causale) || null,
        note: 'Da Excel',
        metodo_inserimento: 'Calendarizzata',
        ore_totali: 0,
        costo_totale: 0
      };

      let oreTot = 0;
      for (let i = 1; i <= 31; i++) {
        const ore = parseFloat(r.giorni[i - 1]) || 0;
        dbRow[`giorno_${i}`] = ore;
        oreTot += ore;
      }
      dbRow.ore_totali = oreTot;
      dbRow.costo_totale = oreTot * pagaOraria;

      await knex('registro_ore').insert(dbRow);
    }

    res.json({ success: true, message: 'Dati caricati con successo' });
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});



const emailCtrl = require('./controllers/emailController');

// --- EMAIL ROUTES ---
app.get('/api/configurazione-email', emailCtrl.getConfigurazione);
app.post('/api/configurazione-email', emailCtrl.salvaConfigurazione);
app.get('/api/emails', emailCtrl.getEmails);
app.post('/api/emails/sync', emailCtrl.syncEmails);
app.post('/api/emails/send', emailCtrl.sendEmail);
app.put('/api/emails/:id/letto', emailCtrl.toggleLetto);
app.put('/api/emails/:id/preferito', emailCtrl.togglePreferito);
app.put('/api/emails/:id/cartella', emailCtrl.setCartella);
app.put('/api/emails/:id/snooze', emailCtrl.snooze);
app.delete('/api/emails/:id', emailCtrl.deleteEmail);
app.post('/api/buste-paga/invia-email', emailCtrl.sendBustaPagaEmail);
// --- PREVENTIVI ROUTES ---
const preventiviCtrl = require('./controllers/preventiviController');
app.get('/api/preventivi', preventiviCtrl.getAllPreventivi);
app.get('/api/clienti/:id/preventivi', preventiviCtrl.getPreventiviByCliente);
app.post('/api/preventivi/generate', preventiviCtrl.generatePreventivo);
app.put('/api/preventivi/:id/stato', preventiviCtrl.updateStato);

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    const filePath = path.resolve(__dirname, '../gestionale_m2i_react/dist/index.html');
    if (fs.existsSync(filePath)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.sendFile(filePath, { dotfiles: 'allow' });
    } else {
      res.status(404).send(`File index.html non trovato: ${filePath}`);
    }
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log("====================================================");
  console.log(`âœ¨ GESTIONALE M2I SQL ATTIVO IN LOCALE âœ¨`);
  console.log(`Apri il browser all'indirizzo: http://localhost:${PORT}`);
  console.log("====================================================");
});


// ==========================================
// ENDPOINTS REPORT IA (GEMINI)
// ==========================================
const aiController = require('./controllers/ai');
app.get('/api/ai/settings', async (req, res) => {
  try { res.json(await aiController.getSettings()); } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/ai/settings', async (req, res) => {
  try { res.json(await aiController.saveSettings(req.body)); } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/ai/ask', async (req, res) => {
  try { res.json(await aiController.askChat(req.body)); } catch(e) { res.status(500).json({ error: e.message }); }
});


