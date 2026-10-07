const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolvePayrollAttachment } = require('./payroll_attachment');

function createPayrollStore(knex, dataDir) {
  const staging = path.join(dataDir, '.payroll-staging');
  let initialized;
  const initialize = () => initialized ||= (async () => {
    if (!(await knex.schema.hasTable('payroll_imports'))) {
      await knex.schema.createTable('payroll_imports', table => {
        table.string('token').primary();
        table.string('owner').notNullable();
        table.string('signature').notNullable();
        table.string('busta_id').notNullable();
      });
    }
  })();
  function stage(bytes, owner) {
    fs.mkdirSync(staging, { recursive: true });
    const token = crypto.randomBytes(24).toString('hex');
    fs.writeFileSync(path.join(staging, token + '.pdf'), bytes, { flag: 'wx' });
    fs.writeFileSync(path.join(staging, token + '.json'), JSON.stringify({ owner: String(owner), created: Date.now() }), { flag: 'wx' });
    return token + '.pdf';
  }
  function stagedFile(filename, owner) {
    if (!/^[a-f0-9]{48}\.pdf$/.test(filename || '')) throw new Error('Anteprima non valida: ricaricare il PDF');
    const token = filename.slice(0, -4);
    const meta = JSON.parse(fs.readFileSync(path.join(staging, token + '.json'), 'utf8'));
    if (meta.owner !== String(owner)) throw new Error('Anteprima appartenente a un altro account');
    return { token, file: path.join(staging, filename) };
  }
  async function confirm(body, owner) {
    const month = Number(body.mese), year = Number(body.anno), rows = body.bustePaga;
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2200 || !Array.isArray(rows) || !rows.length || rows.length > 200) {
      throw new Error('Periodo o elenco buste paga non valido');
    }
    const employees = new Set(), tokens = new Set();
    const prepared = rows.map(row => {
      if (!row || !/^[A-Za-z0-9_-]+$/.test(row.dipendenteId || '') || employees.has(row.dipendenteId)) throw new Error('Dipendente mancante o duplicato: nessuna busta è stata salvata');
      employees.add(row.dipendenteId);
      const amount = Number(String(row.extractedNetto ?? '').replace(',', '.'));
      if (row.extractedNetto === null || row.extractedNetto === undefined || String(row.extractedNetto).trim() === '' || !Number.isFinite(amount)) throw new Error('Netto mancante o non valido: verificare prima di confermare');
      const staged = stagedFile(row.tempFilename, owner);
      if (tokens.has(staged.token)) throw new Error('Anteprima duplicata');
      tokens.add(staged.token);
      const signature = JSON.stringify([row.dipendenteId, month, year, amount, !!row.updateCF, row.updateCF ? row.extractedCF : null]);
      return { ...staged, row, amount, signature };
    });
    await initialize();
    const createdFiles = [];
    try {
      return await knex.transaction(async trx => {
        let saved = 0, repeated = 0;
        for (const item of prepared) {
          const previous = await trx('payroll_imports').where('token', item.token).first();
          if (previous) {
            if (previous.owner !== String(owner) || previous.signature !== item.signature) throw new Error('Anteprima già confermata con dati diversi: ricaricare il PDF');
            const current = await trx('buste_paga').where('id', previous.busta_id).first();
            if (!current?.allegato_busta_paga?.includes('_' + item.token + '_')) throw new Error('Busta successivamente sostituita o eliminata: ricaricare il PDF');
            resolvePayrollAttachment(dataDir, current.allegato_busta_paga);
            repeated++;
            continue;
          }
          const employee = await trx('dipendenti').where('id', item.row.dipendenteId).first();
          if (!employee) throw new Error('Dipendente non trovato');
          if (String(employee.stato || '').trim().toLowerCase() === 'in prova') throw new Error('Il dipendente in prova non ha una busta paga.');
          if (!fs.existsSync(item.file)) throw new Error('PDF temporaneo mancante: ricaricare il documento');
          const existing = await trx('buste_paga').where({ dipendente_id: employee.id, mese: String(month), anno: String(year) });
          if (existing.length) throw new Error('Busta paga già caricata per questo dipendente e mese: eliminala prima di caricarne una nuova.');
          const folder = `uploads/buste_paga/${year}_${month}`;
          fs.mkdirSync(path.join(dataDir, folder), { recursive: true });
          // Un'interruzione prima del commit non deve bloccare il prossimo tentativo.
          const relativePath = `${folder}/Busta_${item.row.dipendenteId}_${item.token}_${crypto.randomBytes(8).toString('hex')}.pdf`;
          const target = path.join(dataDir, relativePath);
          fs.copyFileSync(item.file, target, fs.constants.COPYFILE_EXCL);
          createdFiles.push(target);
          const id = `BP_${crypto.randomUUID()}`;
          const values = { importo_netto: item.amount, allegato_busta_paga: relativePath, email_inviata: 0, data_invio_email: null };
          await trx('buste_paga').insert({ id, dipendente_id: employee.id, mese: String(month), anno: String(year), ...values, creato_da: 'System' });
          if (item.row.updateCF) {
            if (!/^[A-Z0-9]{16}$/.test(item.row.extractedCF || '')) throw new Error('Codice fiscale estratto non valido');
            const duplicate = await trx('dipendenti').whereRaw('UPPER(TRIM(codice_fiscale)) = ?', [item.row.extractedCF]).whereNot('id', employee.id).first();
            if (duplicate) throw new Error('Codice fiscale già associato a un altro dipendente');
            await trx('dipendenti').where('id', employee.id).update({ codice_fiscale: item.row.extractedCF });
          }
          await trx('payroll_imports').insert({ token: item.token, owner: String(owner), signature: item.signature, busta_id: id });
          saved++;
        }
        if (saved) await trx('log_attivita').insert({ categoria: 'Buste Paga', icona: '📄', colore: '#10b981', descrizione: `Salvate ${saved} buste paga per ${month}/${year}`, eseguito_da: String(owner) });
        return { success: true, saved, repeated };
      });
    } catch (error) {
      for (const file of createdFiles) fs.rmSync(file, { force: true });
      throw error;
    }
  }
  return { stage, confirm, staging };
}
module.exports = { createPayrollStore };
