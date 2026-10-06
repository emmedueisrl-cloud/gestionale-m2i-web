const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const api = require('./backend_api');
const multer = require('multer');
const { ownerFolder, finalizeUpload } = require('./upload_paths');
const excelGenerator = require('./excel_generator');
const { knex } = require('./db');
const { createAuth } = require('./auth');
const { ensureAttachmentColumns, createAttachmentLinkHandler } = require('./email_attachment_link');
const { ensureElaboratiNoteStoriche } = require('./elaborati_note_storiche');
const workflowElaborati = require('./workflow_elaborati');
const { ensureIndexes } = require('./db_indexes');
const autodiagnosi = require('./autodiagnosi');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.set('trust proxy', 1);

// Le richieste mutative devono provenire dallo stesso host del gestionale.
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin) {
      try {
        const expectedOrigin = `${process.env.NODE_ENV === 'production' ? 'https' : req.protocol}://${req.get('host')}`;
        if (new URL(origin).origin !== expectedOrigin) {
          return res.status(403).json({ error: 'Origine non autorizzata.' });
        }
      } catch {
        return res.status(403).json({ error: 'Origine non autorizzata.' });
      }
    }
  }
  next();
});

// Security Headers Base
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve i file statici del frontend (abilita l'accesso se il percorso contiene cartelle con il punto come .gemini)
const reactDistPath = path.join(__dirname, '../gestionale_m2i_react/dist');
app.use(express.static(reactDistPath));
const baseUploadPath = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'uploads') : path.join(__dirname, 'uploads');
const auth = createAuth(knex);
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', auth.router);
app.use('/api', auth.requireAuth);
// L'account amministrativo non accede alle altre API, neppure digitando URL diretti.
app.use('/api', (req, res, next) => {
  if (req.authUser.role === 'contabilita' && !req.path.startsWith('/contabilita/')) {
    return res.status(403).json({ error: 'Accesso limitato alla sezione amministrativa.' });
  }
  next();
});
app.use('/uploads', auth.requireAuth, (req, res, next) => {
  if (req.authUser.role === 'contabilita') return res.status(403).send('Accesso non consentito.');
  next();
}, express.static(baseUploadPath));

autodiagnosi.ensureTable().catch(error => console.error('[AUTODIAGNOSI] Inizializzazione non riuscita:', error.message));

const errorContext = (req, operazione) => ({
  area: req.path.includes('/contabilita') ? 'Contabilità' : undefined,
  operazione,
  metodo: req.method,
  percorso: req.path,
  utente: req.authUser?.username || req.authUser?.email || req.authUser?.id
});

const handleWorkflow = (action, operationName) => async (req, res) => {
  try { res.json(await action(req)); }
  catch (error) {
    await autodiagnosi.recordError(error, errorContext(req, operationName || `${req.method} ${req.path}`));
    res.status(400).json({ error: error.message });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.authUser?.role !== 'admin') return res.status(403).json({ error: 'Permesso amministratore richiesto.' });
  next();
};

app.get('/api/autodiagnosi', requireAdmin, async (req, res) => {
  try {
    res.json(await autodiagnosi.listErrors(req.query));
  } catch (error) {
    await autodiagnosi.recordError(error, errorContext(req, 'Consultazione autodiagnosi'));
    res.status(500).json({ error: 'Impossibile caricare l’autodiagnosi.' });
  }
});

app.patch('/api/autodiagnosi/:id/stato', requireAdmin, async (req, res) => {
  try {
    res.json(await autodiagnosi.updateStatus(req.params.id, req.body.stato, req.authUser?.id));
  } catch (error) {
    await autodiagnosi.recordError(error, errorContext(req, 'Aggiornamento stato autodiagnosi'));
    res.status(400).json({ error: error.message });
  }
});
const { tipo, anno, mese } = { tipo: ':tipo', anno: ':anno', mese: ':mese' };
app.get(`/api/elaborati-workflow/${tipo}/${anno}/${mese}/stato`, handleWorkflow(req =>
  workflowElaborati.status(req.params.tipo, req.params.mese, req.params.anno)));
app.post(`/api/elaborati-workflow/${tipo}/${anno}/${mese}/righe/:id/blinda`, handleWorkflow(req =>
  workflowElaborati.lockRow(req.params.tipo, req.params.mese, req.params.anno, req.params.id)));
app.post(`/api/elaborati-workflow/${tipo}/${anno}/${mese}/righe/:id/sblocca`, handleWorkflow(req =>
  workflowElaborati.unlockRow(req.params.tipo, req.params.mese, req.params.anno, req.params.id)));

app.get('/api/contabilita/fatture', handleWorkflow(async () => {
  const { registrationStatuses } = require('./fatture_reconciliation');
  const rows = await knex('fatture_aruba_elaborati as f').leftJoin('clienti as c', 'f.cliente_id', 'c.id')
    .select('f.id', 'f.cliente_id', 'c.ragione_sociale', 'f.mese', 'f.anno', 'f.numero_fattura', 'f.data_fattura', 'f.importo_totale', 'f.registrata_at', 'f.fattura_id')
    .select(knex.raw('(SELECT COUNT(*) FROM rettifiche_fatture_aruba r WHERE r.registrazione_id = f.id) AS rettifiche'))
    .select(knex.raw('CASE WHEN f.allegato_path IS NULL THEN 0 ELSE 1 END AS allegato'))
    .orderBy('f.registrata_at', 'desc');
  return registrationStatuses(knex, rows);
}));
app.get('/api/contabilita/fatture/:id/rettifiche', handleWorkflow(async req => {
  const records = await knex('rettifiche_fatture_aruba').where({ registrazione_id: req.params.id }).orderBy('id', 'desc');
  return records.map(record => {
    const previous = JSON.parse(record.precedente);
    const next = JSON.parse(record.successivo);
    return { id: record.id, fonte: record.fonte, rettificataAt: record.rettificata_at,
      precedente: { numero: previous.numero_fattura, data: previous.data_fattura, importo: Number(previous.importo_totale),
        allegato: Boolean(previous.allegato_path),
        xmlContabile: path.extname(previous.fattura_contabile?.allegato_fattura || '').toLowerCase() === '.xml' },
      successivo: { data: next.data_fattura, importo: Number(next.importo_totale) } };
  });
}));
app.get('/api/contabilita/fatture/:id/rettifiche/:revisionId/xml-precedente', async (req, res) => {
  try {
    const record = await knex('rettifiche_fatture_aruba').where({ id: req.params.revisionId, registrazione_id: req.params.id }).first();
    const filename = record && JSON.parse(record.precedente).fattura_contabile?.allegato_fattura;
    if (!filename || path.basename(filename) !== filename || path.extname(filename).toLowerCase() !== '.xml') {
      return res.status(404).send('XML precedente non trovato.');
    }
    const root = path.resolve(baseUploadPath, 'unknown');
    const file = path.resolve(root, filename);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return res.status(404).send('XML precedente non disponibile.');
    res.download(file, `Fattura_contabile_precedente_${record.id}.xml`);
  } catch (error) { res.status(500).send(error.message); }
});
app.get('/api/contabilita/fatture/:id/rettifiche/:revisionId/allegato', async (req, res) => {
  try {
    const record = await knex('rettifiche_fatture_aruba').where({ id: req.params.revisionId, registrazione_id: req.params.id }).first();
    const relative = record && JSON.parse(record.precedente).allegato_path;
    if (!relative || !process.env.DATA_DIR) return res.status(404).send('Allegato storico non trovato.');
    const root = path.resolve(process.env.DATA_DIR, 'uploads', 'fatture_aruba');
    const file = path.resolve(process.env.DATA_DIR, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return res.status(404).send('Allegato storico non disponibile.');
    res.download(file, `Fattura_precedente_${record.id}${path.extname(file)}`);
  } catch (error) { res.status(500).send(error.message); }
});
app.get('/api/contabilita/fatture/:id/allegato', async (req, res) => {
  try {
    const invoice = await knex('fatture_aruba_elaborati').where({ id: req.params.id }).first();
    if (!invoice?.allegato_path || !process.env.DATA_DIR) return res.status(404).send('Allegato non trovato.');
    const root = path.resolve(process.env.DATA_DIR, 'uploads', 'fatture_aruba');
    const file = path.resolve(process.env.DATA_DIR, invoice.allegato_path);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return res.status(404).send('Allegato non disponibile.');
    res.download(file, `Fattura_${invoice.id}${path.extname(file)}`);
  } catch (error) { res.status(500).send(error.message); }
});
app.get(`/api/contabilita/${tipo}/${anno}/${mese}`, handleWorkflow(req =>
  workflowElaborati.accountingRows(req.params.tipo, req.params.mese, req.params.anno)));
app.get(`/api/contabilita/${tipo}/${anno}/${mese}/mancanti`, handleWorkflow(req =>
  workflowElaborati.missingCount(req.params.tipo, req.params.mese, req.params.anno)));
app.post('/api/contabilita/fatture/inviata', handleWorkflow(req =>
  workflowElaborati.markInvoiceSent({ ...req.body, userId: req.authUser.id })));
const invoiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
app.post('/api/contabilita/fatture', invoiceUpload.single('allegato'), handleWorkflow(req =>
  workflowElaborati.registerInvoice({ ...req.body, file: req.file, userId: req.authUser.id })));
app.post('/api/contabilita/pagamenti', handleWorkflow(req =>
  workflowElaborati.registerPayment({ ...req.body, userId: req.authUser.id })));
app.post('/api/dipendenti/:id/collega-allegato', createAttachmentLinkHandler(knex, baseUploadPath));

// Configurazione Multer per l'upload dei file


// HEALTH CHECK - Verifica stato DB persistente
// GET /api/health → restituisce percorso DB, dimensione, conteggio clienti/dipendenti
// ============================================================
app.get('/api/health', auth.requireAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const dbFilePath = process.env.DATA_DIR
      ? require('path').join(process.env.DATA_DIR.trim(), 'gestionale.db')
      : require('path').join(__dirname, 'gestionale.db');

    const exists = fs.existsSync(dbFilePath);
    const sizeKB = exists ? Math.round(fs.statSync(dbFilePath).size / 1024) : 0;

    const [clientiRow] = await knex('clienti').count('* as cnt');
    const [dipenRow]   = await knex('dipendenti').count('* as cnt');

    // Cerca i record chiave per verificare il restore
    const fisiocast  = await knex('clienti').where('partita_iva', '05701431008').first();
    const condominio = await knex('clienti').whereRaw("ragione_sociale LIKE '%TOR DE%SCHIAVI%'").first();
    const zappadu    = await knex('dipendenti').whereRaw("UPPER(cognome) LIKE '%ZAPPADU%'").first();
    const giacinti   = await knex('dipendenti').whereRaw("UPPER(cognome) LIKE '%GIACINTI%'").first();

    res.json({
      status: 'OK',
      db_path: dbFilePath,
      db_exists: exists,
      db_size_kb: sizeKB,
      data_dir_env: process.env.DATA_DIR || '(non impostato - sviluppo locale)',
      totale_clienti: clientiRow.cnt,
      totale_dipendenti: dipenRow.cnt,
      verifica_dati: {
        'Fisio.Cast (partita_iva 05701431008)': fisiocast ? `✅ TROVATO (ID: ${fisiocast.id})` : '❌ NON TROVATO',
        'Condominio Via Tor de Schiavi':        condominio ? `✅ TROVATO (ID: ${condominio.id})` : '❌ NON TROVATO',
        'Zappadu (dipendente)':                 zappadu   ? `✅ TROVATO (ID: ${zappadu.id})` : '❌ NON TROVATO',
        'Di Giacinti (deve essere ELIMINATO)':  giacinti  ? `⚠️ ANCORA PRESENTE (ID: ${giacinti.id})` : '✅ CORRETTAMENTE ELIMINATO',
      }
    });
  } catch(e) {
    res.status(500).json({ status: 'ERRORE', message: e.message });
  }
});
// ============================================================
// INSPECT DISK
app.get('/api/inspect-disk', auth.requireAdmin, (req, res) => {
  const fs = require('fs');
  const path = require('path');
  function getFiles(dir) {
    try {
      return fs.readdirSync(dir).map(f => {
        const p = path.join(dir, f);
        const stats = fs.statSync(p);
        return { file: f, size: stats.size, mtime: stats.mtime };
      });
    } catch(e) { return e.message; }
  }
  res.json({
    var_lib_data: getFiles('/var/lib/data'),
    data_dir: getFiles(path.join(__dirname, 'DATA_DIR'))
  });
});
// ============================================================

// ============================================================
// BACKUP DATABASE LOCALE
// ============================================================
app.get('/api/backup-db', auth.requireAdmin, async (req, res) => {
  let snapshotDir;
  let snapshotPath;
  const cleanupSnapshot = () => {
    if (snapshotPath) fs.rmSync(snapshotPath, { force: true });
    if (snapshotDir) fs.rmdirSync(snapshotDir);
  };
  try {
    const dbFilePath = process.env.DATA_DIR
      ? path.join(process.env.DATA_DIR.trim(), 'gestionale.db')
      : path.join(__dirname, 'gestionale.db');

    if (fs.existsSync(dbFilePath)) {
      snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-backup-'));
      snapshotPath = path.join(snapshotDir, 'gestionale.db');
      // VACUUM INTO crea una copia transazionalmente coerente anche se il DB è in uso.
      await knex.raw('VACUUM INTO ?', [snapshotPath]);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.download(snapshotPath, `gestionale_backup_${timestamp}.db`, (err) => {
        try { cleanupSnapshot(); } catch (cleanupError) { console.error('Pulizia backup temporaneo fallita:', cleanupError); }
        if (err) {
          console.error("Errore nel download del backup:", err);
          if (!res.headersSent) {
            res.status(500).send("Errore nel download del database.");
          }
        }
      });
    } else {
      res.status(404).send("Database non trovato.");
    }
  } catch (error) {
    try { cleanupSnapshot(); } catch (cleanupError) { console.error('Pulizia backup temporaneo fallita:', cleanupError); }
    console.error("Errore durante la generazione del backup:", error);
    res.status(500).send("Errore interno del server.");
  }
});
// ============================================================

// ============================================================
// BACKUP DATABASE IN EXCEL
// ============================================================
app.get('/api/backup-excel', auth.requireAdmin, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gestionale M2I';
    workbook.created = new Date();

    // Recupera tutte le tabelle dal database
    const tables = await knex.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tableNames = tables.map(t => t.name);

    for (const tableName of tableNames) {
      const data = await knex(tableName).select('*');
      if (data.length > 0) {
        const sheet = workbook.addWorksheet(tableName);
        
        // Estrai intestazioni dalle chiavi del primo record
        const columns = Object.keys(data[0]).map(key => ({
          header: key,
          key: key,
          width: 20
        }));
        sheet.columns = columns;

        // Aggiungi i dati
        sheet.addRows(data);
      } else {
        // Se la tabella è vuota, aggiungi solo un foglio vuoto con un messaggio
        const sheet = workbook.addWorksheet(tableName);
        sheet.getCell('A1').value = 'Nessun dato presente in questa tabella.';
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="gestionale_backup_${timestamp}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Errore durante la generazione del backup Excel:", error);
    if (!res.headersSent) {
      res.status(500).send("Errore interno del server durante la generazione del file Excel.");
    }
  }
});
// ============================================================


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const rawId = req.path === '/api/magazzino' ? 'magazzino' : (req.body.idCliente || req.body.idDipendente || req.body.idAzienda || 'unknown');
    let idSafe;
    try { idSafe = ownerFolder(rawId); } catch (error) { return cb(error); }
    const uploadDir = path.join(baseUploadPath, idSafe);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const originalName = file.originalname || 'documento';
    // Un suffisso casuale evita di sovrascrivere un allegato omonimo già presente.
    const extension = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9\-_ ]/g, '').trim().slice(0, 100) || 'documento';
    const safeName = `${baseName}_${crypto.randomBytes(8).toString('hex')}${extension}`;
    cb(null, safeName);
  }
});
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const DOCUMENT_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.odt']);
function allowedExtensions(req) {
  if (req.path === '/api/upload-fattura-xml' || req.path === '/api/anteprima-fatture-xml') return new Set(['.xml']);
  if (req.path === '/api/anteprima-fatture-csv') return new Set(['.csv']);
  if (req.path === '/api/magazzino' || req.path === '/api/upload-multiple') return IMAGE_EXTENSIONS;
  return DOCUMENT_EXTENSIONS;
}
function uploadFilter(req, file, cb) {
  if (!allowedExtensions(req).has(path.extname(file.originalname || '').toLowerCase())) {
    const error = new Error('Formato file non consentito per questa funzione.');
    error.code = 'UNSUPPORTED_FILE_TYPE';
    return cb(error);
  }
  cb(null, true);
}
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const upload = multer({
  storage,
  fileFilter: uploadFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: 100, fields: 20, fieldSize: 64 * 1024, parts: 120 }
});

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
    
    const rawId = req.body.idCliente || req.body.idDipendente || req.body.idAzienda || 'unknown';
    // I campi multipart possono arrivare dopo il file: finalizza nella cartella corretta.
    const filePath = finalizeUpload(baseUploadPath, req.file, rawId);
    
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
    
    const rawId = req.body.idCliente || req.body.idDipendente || req.body.idAzienda || 'unknown';
    const filePaths = req.files.map(file => finalizeUpload(baseUploadPath, file, rawId));
    
    console.log(`[API UPLOAD-MULTIPLE] Salvati ${req.files.length} file`);
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

// Le route React interne devono funzionare anche dopo un refresh o un link diretto.
app.get(/^\/admin(?:\/.*)?$/, (req, res) => {
  const filePath = path.join(reactDistPath, 'index.html');
  if (!fs.existsSync(filePath)) return res.status(404).send('Frontend non compilato.');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(filePath);
});

// Endpoint proxy centralizzato per le chiamate client-side google.script.run
app.post('/api/run', async (req, res) => {
  const { functionName, args } = req.body;
  console.log(`[API CALL] Chiamata a funzione: ${functionName}`);

  try {
    if (functionName === 'svuotaLogSistema' && req.authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Permesso amministratore richiesto.' });
    }
    // Intercetta speciale per il caricamento dei moduli HTML (Single Page Application)
    if (functionName === "prendiHtmlContenutoInApp") {
      const moduleName = args ? args[0] : null;
      if (typeof moduleName !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(moduleName)) {
        return res.status(400).json({ success: false, error: "Nome modulo HTML non valido" });
      }
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
      "mostraTuttiIFogli"
    ];

    if (mockFunctions.includes(functionName)) {
      console.log(`[MOCK] Risposta automatica Mock per ${functionName}`);
      return res.json({ success: true, data: null });
    }

    console.warn(`[WARNING] Funzione backend '${functionName}' non ancora implementata.`);
    return res.json({ success: false, error: `Funzione '${functionName}' non ancora implementata nel server locale.` });

  } catch (error) {
    console.error(`[ERROR] Errore nell'esecuzione di ${functionName}:`, error.message);
    await autodiagnosi.recordError(error, errorContext(req, functionName || 'Chiamata API'));
    return res.json({ success: false, error: error.message });
  }
});

// ==========================================
// ENDPOINT GENERAZIONE PDF (Fase 6)
// ==========================================
const pdfGenerator = require('./pdf_generator');
const { buildReportContabilitaClientiPDF } = require('./report_contabilita_clienti_pdf');
const { buildReportContabilitaDipendentiPDF } = require('./report_contabilita_dipendenti_pdf');

app.get('/api/contabilita/pdf/report-clienti/:anno/:mese', async (req, res) => {
  try {
    const { anno, mese } = req.params;
    workflowElaborati.period('cliente', mese, anno);
    const [rows, missing] = await Promise.all([
      workflowElaborati.accountingRows('cliente', mese, anno),
      workflowElaborati.missingCount('cliente', mese, anno)
    ]);
    const doc = buildReportContabilitaClientiPDF(rows, mese, anno, missing.mancanti);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Report_Fatture_Clienti_${mese}_${anno}.pdf"`);
    res.send(await doc.getBuffer());
  } catch (error) { res.status(400).send(error.message); }
});

app.get('/api/contabilita/pdf/report-dipendenti/:anno/:mese', async (req, res) => {
  try {
    const { anno, mese } = req.params;
    workflowElaborati.period('dipendente', mese, anno);
    const [rows, missing] = await Promise.all([
      workflowElaborati.accountingRows('dipendente', mese, anno),
      workflowElaborati.missingCount('dipendente', mese, anno)
    ]);
    const doc = buildReportContabilitaDipendentiPDF(rows, mese, anno, missing.mancanti);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Report_Stipendi_Dipendenti_${mese}_${anno}.pdf"`);
    res.send(await doc.getBuffer());
  } catch (error) { res.status(400).send(error.message); }
});

app.get(['/api/contabilita/pdf/:tipo/:anno/:mese', '/api/contabilita/pdf/:tipo/:anno/:mese/:id'], async (req, res) => {
  try {
    const { tipo, anno, mese, id } = req.params;
    workflowElaborati.period(tipo, mese, anno);
    const rows = await workflowElaborati.lockedRows(tipo, mese, anno);
    const one = id ? rows.find(r => String(tipo === 'cliente' ? r.idCliente : r.idDipendente) === id) : null;
    if (id && !one) return res.status(404).send('Riga non disponibile.');
    let doc;
    if (!id) doc = tipo === 'cliente'
      ? pdfGenerator.buildStampaElaboratoClientiPDF(rows, mese, anno)
      : pdfGenerator.buildStampaElaboratoDipendentiPDF(rows, mese, anno);
    else if (tipo === 'cliente') doc = pdfGenerator.buildElaboratoClientePDF({
      mese, anno, ragione_sociale: one.ragioneSociale, ore_lavorate: one.oreLavorate,
      imponibile: one.imponibile, notaFissa: one.notaFissa, notaMensile: one.notaMensile
    });
    else doc = pdfGenerator.buildElaboratoDipendentePDF({
      mese, anno, cognome_nome: one.cognomeNome, paga_lavorato: one.pagaLavorato,
      paga_ferie_permessi_malattia: one.pagaFPM, maggiorazioni: one.maggiorazioni,
      detrazioni: one.detrazioni, stipendio_netto: one.stipendioNetto,
      notaFissa: one.notaFissa, notaMensile: one.notaMensile
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Elaborato_${tipo}_${mese}_${anno}.pdf"`);
    res.send(await doc.getBuffer());
  } catch (error) { res.status(400).send(error.message); }
});

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
    
    const doc = pdfGenerator.buildElaboratoDipendentePDF({
      ...data, notaFissa: data.nota_fissa_storica || '', notaMensile: data.nota_mensile_storica || ''
    });
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
    
    const doc = pdfGenerator.buildElaboratoClientePDF({
      ...data, notaFissa: data.nota_fissa_storica || '', notaMensile: data.nota_mensile_storica || ''
    });
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
    const dati = elaborato.chiuso ? await workflowElaborati.lockedRows('cliente', mese, anno) : elaborato.dati;
    const reportGrafico = req.query.grafico === '1';
    const contabilita = reportGrafico ? await workflowElaborati.accountingRows('cliente', mese, anno) : [];
    const fatturatoPerCliente = new Map(contabilita.map(row => [String(row.idCliente), row.importoRealmenteFatturato]));
    const righePDF = reportGrafico
      ? dati.map(row => ({ ...row, importoRealmenteFatturato: fatturatoPerCliente.get(String(row.idCliente)) || 0 }))
      : dati;
    const doc = reportGrafico
      ? pdfGenerator.buildReportGraficoClientiPDF(righePDF, mese, anno)
      : pdfGenerator.buildStampaElaboratoClientiPDF(dati, mese, anno);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportGrafico ? 'Report_Grafico_Clienti' : 'Stampa_Elaborato_Clienti'}_${mese}_${anno}.pdf"`);
    const buffer = await doc.getBuffer(); res.send(buffer);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/pdf/stampa-elaborato-dipendenti', async (req, res) => {
  try {
    const { mese, anno, dipendente_id } = req.query;
    const reportGrafico = req.query.grafico === '1';
    const elaborato = await api.ottieniElaboratoMensile(mese, anno);
    const dati = dipendente_id
      ? elaborato.dati
      : elaborato.chiuso ? await workflowElaborati.lockedRows('dipendente', mese, anno) : elaborato.dati;
    const righeDaStampare = dipendente_id
      ? dati.filter(row => String(row.idDipendente) === String(dipendente_id))
      : dati;
    if (dipendente_id && !righeDaStampare.length) return res.status(404).send('Dipendente non trovato nell’elaborato.');

    // Nei mesi chiusi il dettaglio F.P.M. non è nello storico dell'elaborato:
    // recupera le causali dal registro ore anche per la stampa retrospettiva.
    const senzaDettaglio = righeDaStampare.filter(row => !row.dettaglioFPM).map(row => row.idDipendente);
    const oreFPM = senzaDettaglio.length ? await knex('registro_ore')
      .select('dipendente_id', 'causale_assenza')
      .sum('ore_totali as ore')
      .where({ mese, anno })
      .whereIn('dipendente_id', senzaDettaglio)
      .groupBy('dipendente_id', 'causale_assenza') : [];
    const dettagliPerDipendente = new Map();
    for (const record of oreFPM) {
      const causale = (record.causale_assenza || 'Ordinario').trim();
      if (['ordinario', 'straordinario', 'extra'].includes(causale.toLowerCase())) continue;
      if (!dettagliPerDipendente.has(record.dipendente_id)) dettagliPerDipendente.set(record.dipendente_id, {});
      dettagliPerDipendente.get(record.dipendente_id)[causale] = Number(record.ore) || 0;
    }
    const righePDF = righeDaStampare.map(row => ({
      ...row,
      dettaglioFPM: row.dettaglioFPM || dettagliPerDipendente.get(row.idDipendente) || {}
    }));
    if (reportGrafico) {
      const buste = await knex('buste_paga')
        .select('dipendente_id', 'importo_netto')
        .where({ mese: String(mese), anno: String(anno) });
      const nettiBusta = new Map(buste.map(busta => [String(busta.dipendente_id), busta.importo_netto]));
      righePDF.forEach(row => { row.nettoBusta = nettiBusta.has(String(row.idDipendente)) ? nettiBusta.get(String(row.idDipendente)) : null; });
    }
    const doc = reportGrafico
      ? pdfGenerator.buildReportGraficoDipendentiPDF(righePDF, mese, anno)
      : pdfGenerator.buildStampaElaboratoDipendentiPDF(righePDF, mese, anno);
    res.setHeader('Content-Type', 'application/pdf');
    const filename = reportGrafico ? `Report_Grafico_Dipendenti_${mese}_${anno}.pdf` : `Stampa_Elaborato_Dipendenti_${mese}_${anno}.pdf`;
    res.setHeader('Content-Disposition', `${dipendente_id ? 'inline' : 'attachment'}; filename="${filename}"`);
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

const uploadMem = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!new Set(['.xlsx', '.xls']).has(path.extname(file.originalname || '').toLowerCase())) {
      const error = new Error('Caricare un file Excel.');
      error.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(error);
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 10, parts: 11 }
});

const payrollStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!req.payrollTempDir) req.payrollTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-payroll-'));
      cb(null, req.payrollTempDir);
    } catch (error) { cb(error); }
  },
  filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}.pdf`)
});
const uploadPayroll = multer({
  storage: payrollStorage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname || '').toLowerCase() !== '.pdf') {
      const error = new Error('Per le buste paga sono ammessi solo file PDF.');
      error.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(error);
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_FILE_BYTES, files: 100, fields: 10, parts: 110 }
});
async function cleanupPayrollUpload(req) {
  const dir = req.payrollTempDir && path.resolve(req.payrollTempDir);
  const tempRoot = path.resolve(os.tmpdir());
  if (dir && dir.startsWith(`${tempRoot}${path.sep}`) && path.basename(dir).startsWith('m2i-payroll-')) {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

const bustePagaUploadCtrl = require('./controllers/buste_paga_upload');
app.post('/api/buste-paga/upload', uploadPayroll.array('files', 100), async (req, res, next) => {
  try { await bustePagaUploadCtrl.anteprimaBustePaga(req, res); }
  catch (error) { next(error); }
  finally { await cleanupPayrollUpload(req); }
});
app.post('/api/buste-paga/conferma', bustePagaUploadCtrl.confermaBustePaga);
app.get('/api/buste-paga/mese', bustePagaUploadCtrl.getBusteMese);
app.get('/api/buste-paga/dipendente/:dipendenteId', bustePagaUploadCtrl.getBusteDipendente);
app.delete('/api/buste-paga/mese/:anno/:mese', bustePagaUploadCtrl.eliminaBusteMese);
app.delete('/api/buste-paga/:id', bustePagaUploadCtrl.eliminaBustaPaga);



app.post('/api/excel/carica-presenze', uploadMem.single('file'), async (req, res) => {
  try {
    const { dipendente_id, mese, anno } = req.body;
    if (!req.file) return res.status(400).send('Nessun file caricato');
    const meseNum = Number(mese);
    const annoNum = Number(anno);
    if (!dipendente_id || !Number.isInteger(meseNum) || meseNum < 1 || meseNum > 12 || !Number.isInteger(annoNum) || annoNum < 2000) {
      return res.status(400).send('Dipendente o periodo non valido');
    }

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
    const numGiorniMese = new Date(annoNum, meseNum, 0).getDate();

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
        let rawValue = cell.value;
        if (cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) {
            rawValue = cell.value.result;
        }
        const val = rawValue === null || rawValue === undefined || rawValue === '' ? 0 : Number(rawValue);
        if (!Number.isFinite(val) || val < 0) {
          return res.status(400).send(`Ore non valide al giorno ${giorno}`);
        }
        
        if (val > 0) {
          righeMap[key].giorni[giorno - 1] += val;
        }
      }
    }

    const righeDaSalvare = Object.values(righeMap).filter(r => r.giorni.some(h => h > 0));

    if (righeDaSalvare.length === 0) {
      if (Object.keys(colMap).length === 0) {
        return res.status(400).send('Il file non contiene intestazioni di colonna. Apri il file Excel e seleziona il cliente nel menu a tendina della riga 1, poi inserisci le ore e ricarica il file.');
      }
      return res.status(400).send('Il file non contiene ore inserite. Inserisci le ore nei giorni del mese e ricarica il file.');
    }

    // Riusa la validazione e la transazione del salvataggio manuale.
    await api.salvaPresenzeMensili({
      idDipendente: dipendente_id,
      mese: meseNum,
      anno: annoNum,
      metodoInserimento: 'Calendarizzata',
      revisione: req.body.revisione,
      importazioneExcel: true,
      // Keep zero-filled columns until the lock comparison: zeroing a protected
      // client's column is an attempted edit, not an omitted client.
      righe: Object.values(righeMap)
    });

    res.json({ success: true, message: 'Dati caricati con successo' });
  } catch (e) {
    console.error(e);
    res.status(/ore|periodo|dipendente|giorn/i.test(e.message) ? 400 : 500).send(e.message);
  }
});



const emailCtrl = require('./controllers/emailController');

// --- EMAIL ROUTES ---
app.get('/api/configurazione-email', auth.requireAdmin, emailCtrl.getConfigurazione);
app.post('/api/configurazione-email', auth.requireAdmin, emailCtrl.salvaConfigurazione);
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
      res.sendFile(filePath);
    } else {
      res.status(404).send(`File index.html non trovato: ${filePath}`);
    }
  } else {
    next();
  }
});

Promise.resolve().then(async () => {
  await auth.initialize();
  await ensureAttachmentColumns(knex);
  await ensureElaboratiNoteStoriche(knex);
  await workflowElaborati.initialize();
  await ensureIndexes(knex);
  app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
    console.log(`Gestionale M2I attivo sulla porta ${PORT}`);
  });
}).catch(error => {
  console.error('Avvio bloccato: inizializzazione database non riuscita.', error.message);
  process.exitCode = 1;
});


// ==========================================
// ENDPOINTS REPORT IA (GEMINI)
// ==========================================
const aiController = require('./controllers/ai');
app.get('/api/ai/settings', auth.requireAdmin, async (req, res) => {
  try { res.json(await aiController.getSettings()); } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/ai/settings', auth.requireAdmin, async (req, res) => {
  try { res.json(await aiController.saveSettings(req.body)); } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/ai/ask', async (req, res) => {
  try { res.json(await aiController.askChat(req.body)); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.use(async (error, req, res, next) => {
  if (req.payrollTempDir) await cleanupPayrollUpload(req);
  await autodiagnosi.recordError(error, errorContext(req, `${req.method} ${req.path}`));
  if (error instanceof multer.MulterError) {
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, error: error.message });
  }
  if (error.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(415).json({ success: false, error: error.message });
  }
  console.error('[ERRORE NON GESTITO]', error);
  return res.status(500).json({ success: false, error: 'Errore interno del gestionale. Il dettaglio è stato registrato in Autodiagnosi.' });
});


