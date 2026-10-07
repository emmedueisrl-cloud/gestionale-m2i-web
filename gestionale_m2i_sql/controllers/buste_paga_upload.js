const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { knex } = require('../db');
const { createPayrollStore } = require('../payroll_store');
const { resolvePayrollAttachment } = require('../payroll_attachment');
const { extractNet, matchEmployee } = require('../payroll_extraction');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..');
const store = createPayrollStore(knex, dataDir);

async function preview(req, res) {
  const staged = [];
  try {
    if (!Array.isArray(req.files) || !req.files.length) return res.status(400).json({ success: false, error: 'Nessun file inviato.' });
    const employees = await knex('dipendenti').select('id', 'nome', 'cognome', 'codice_fiscale');
    const results = [];
    let totalPages = 0;
    for (const file of req.files) {
      const bytes = file.buffer || fs.readFileSync(file.path);
      let document;
      try { document = await PDFDocument.load(bytes); }
      catch { throw new Error('PDF non leggibile o protetto: ' + file.originalname); }
      const count = document.getPageCount();
      totalPages += count;
      if (!count || totalPages > 200) throw new Error('Caricare al massimo 200 pagine per lotto');
      const texts = Array(count).fill(null);
      try {
        // Uint8Array dedicato: i Buffer Node possono avere un byteOffset nel pool.
        await pdfParse(new Uint8Array(bytes), { version: 'v2.0.550', pagerender: async page => {
          const content = await page.getTextContent({ normalizeWhitespace: true });
          const items = content.items.map(item => ({ text: item.str, x: item.transform[4], y: item.transform[5] }));
          items.sort((a,b) => Math.abs(b.y-a.y) > 5 ? b.y-a.y : a.x-b.x);
          const text = items.map(item => item.text).join(' ');
          texts[page.pageNumber - 1] = text;
          return text;
        } });
      } catch (error) {
        console.error('Estrazione PDF non riuscita:', error.message);
        throw new Error('Estrazione fallita: ' + file.originalname);
      }
      if (texts.some(text => text === null)) throw new Error('Estrazione incompleta: impossibile garantire la corrispondenza delle pagine');
      const groups = new Map();
      for (let index = 0; index < count; index++) {
        const match = matchEmployee(texts[index], employees);
        const key = match.employee ? match.employee.id : 'manual-' + index;
        if (!groups.has(key)) groups.set(key, { pages: [], texts: [], match });
        groups.get(key).pages.push(index);
        groups.get(key).texts.push(texts[index]);
      }
      for (const group of groups.values()) {
        const output = await PDFDocument.create();
        const pages = await output.copyPages(document, group.pages);
        pages.forEach(page => output.addPage(page));
        const token = store.stage(await output.save(), req.authUser.id);
        staged.push(token);
        const amounts = [...new Set(group.texts.map(extractNet).filter(value => value !== null))];
        const warnings = [];
        if (!group.match.employee) warnings.push('Associazione manuale richiesta: CF assente, sconosciuto o ambiguo.');
        if (amounts.length !== 1) warnings.push('Netto non riconosciuto o discordante: controllare il PDF.');
        if (group.texts.every(text => !text.trim())) warnings.push('PDF senza testo: potrebbe essere una scansione. OCR non disponibile.');
        results.push({ tempFilename: token, originalName: file.originalname + ' - pagine ' + group.pages.map(i=>i+1).join(', '),
          extractedCF: group.match.cf || '', extractedNetto: amounts.length === 1 ? amounts[0] : '',
          dipendenteId: group.match.employee?.id || '',
          dipendenteNome: group.match.employee ? group.match.employee.cognome + ' ' + group.match.employee.nome : '',
          pages: group.pages.map(i=>i+1), warnings });
      }
    }
    res.json({ success: true, files: results });
  } catch (error) {
    for (const filename of staged) {
      fs.rmSync(path.join(store.staging, filename), { force: true });
      fs.rmSync(path.join(store.staging, filename.replace('.pdf', '.json')), { force: true });
    }
    res.status(400).json({ success: false, error: error.message });
  }
}

async function remove(where) {
  const archiveDir = path.join(dataDir, '.payroll-trash', crypto.randomUUID());
  const originals = [];
  let count = 0;
  await knex.transaction(async trx => {
    const rows = await trx('buste_paga').where(where);
    count = rows.length;
    if (!count) return;
    fs.mkdirSync(archiveDir, { recursive: true });
    const archive = [];
    for (const row of rows) {
      const record = { ...row, recoveryFile: null };
      if (row.allegato_busta_paga) {
        try {
          const original = resolvePayrollAttachment(dataDir, row.allegato_busta_paga);
          record.recoveryFile = crypto.randomUUID() + '.pdf';
          fs.copyFileSync(original, path.join(archiveDir, record.recoveryFile));
          originals.push({ original, storedPath: row.allegato_busta_paga });
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      archive.push(record);
    }
    fs.writeFileSync(path.join(archiveDir, 'records.json'), JSON.stringify(archive, null, 2));
    await trx('buste_paga').where(where).del();
    await trx('log_attivita').insert({ categoria: 'Buste Paga', icona: '🗑️', colore: '#ef4444',
      descrizione: 'Rimosse ' + count + ' buste; recupero ' + path.basename(archiveDir), eseguito_da: 'LocalServer' });
  });
  let retainedFiles = 0;
  for (const { original, storedPath } of originals) {
    // Non cancellare il PDF se un'altra busta lo usa ancora.
    if (await knex('buste_paga').where('allegato_busta_paga', storedPath).first()) { retainedFiles++; continue; }
    try { fs.unlinkSync(original); } catch { retainedFiles++; }
  }
  return { success: true, count, retainedFiles };
}

module.exports = {
  anteprimaBustePaga: preview,
  async confermaBustePaga(req,res) {
    try { res.json(await store.confirm(req.body, req.authUser.id)); }
    catch (error) { res.status(400).json({ success: false, error: error.code === 'ENOENT' ? 'Anteprima non disponibile: ricaricare il PDF' : error.message }); }
  },
  async getBusteMese(req,res) {
    try {
      const buste = await knex('buste_paga').join('dipendenti','buste_paga.dipendente_id','=','dipendenti.id')
        .select('buste_paga.*','dipendenti.nome','dipendenti.cognome','dipendenti.codice_fiscale','dipendenti.iban')
        .where('buste_paga.mese',req.query.mese).where('buste_paga.anno',req.query.anno);
      const notes = await knex('note_elaborati').select('soggetto_id', 'testo')
        .where({ tipo: 'ufficio_paghe', mese: Number(req.query.mese), anno: Number(req.query.anno) });
      const noteByEmployee = new Map(notes.map(note => [String(note.soggetto_id), note.testo || '']));
      const paid = buste.length ? await knex('pagamenti_ufficio_paghe').select('busta_id', 'pagato_at').whereIn('busta_id', buste.map(busta => busta.id)) : [];
      const paidByPayroll = new Map(paid.map(row => [String(row.busta_id), row.pagato_at]));
      buste.forEach(busta => {
        busta.nota_ufficio_paghe = noteByEmployee.get(String(busta.dipendente_id)) || '';
        busta.pagato_ufficio_at = paidByPayroll.get(String(busta.id)) || null;
      });
      res.json({ success:true,buste });
    } catch(error) { res.status(500).json({success:false,error:error.message}); }
  },
  async getBusteDipendente(req,res) {
    try {
      const buste = await knex('buste_paga').where('dipendente_id',req.params.dipendenteId)
        .orderByRaw('CAST(anno AS INTEGER) DESC, CAST(mese AS INTEGER) DESC');
      res.json({success:true,buste});
    } catch(error) { res.status(500).json({success:false,error:error.message}); }
  },
  async eliminaBustaPaga(req,res) {
    try { const result=await remove({id:req.params.id}); res.status(result.count?200:404).json(result.count?result:{success:false,error:'Busta paga non trovata'}); }
    catch(error) { res.status(500).json({success:false,error:error.message}); }
  },
  async eliminaBusteMese(req,res) {
    try { res.json(await remove({anno:req.params.anno,mese:req.params.mese})); }
    catch(error) { res.status(500).json({success:false,error:error.message}); }
  }
};
