const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ownerFolder, filename } = require('./upload_paths');

async function deleteAttachment(knex, dataDir, table, id, name) {
  if (!['dipendenti', 'clienti'].includes(table)) throw new Error('Archivio non valido');
  const relative = `uploads/${ownerFolder(id)}/${filename(name)}`;
  const original = path.join(dataDir, relative);
  const updates = {};
  let archive;
  await knex.transaction(async trx => {
    const row = await trx(table).where('id', id).first();
    if (!row) throw new Error('Scheda non trovata');
    for (const [key, value] of Object.entries(row)) {
      if (/^(allegato_|link_)/.test(key) && typeof value === 'string' && value.replace(/^\/+/, '') === relative) updates[key] = null;
    }
    if (fs.existsSync(original)) {
      const uploadRoot = fs.realpathSync(path.join(dataDir, 'uploads'));
      const root = fs.realpathSync(path.join(dataDir, 'uploads', id));
      if (path.dirname(root) !== uploadRoot) throw new Error('Cartella documento non valida');
      if (fs.realpathSync(original) !== path.join(root, name) || !fs.statSync(original).isFile()) throw new Error('Percorso documento non valido');
      archive = path.join(dataDir, '.attachment-trash', crypto.randomUUID());
      fs.mkdirSync(archive, { recursive: true });
      fs.copyFileSync(original, path.join(archive, 'attachment.bin'), fs.constants.COPYFILE_EXCL);
      fs.writeFileSync(path.join(archive, 'record.json'), JSON.stringify({ table, row, relative, file: 'attachment.bin', originalName: name }, null, 2));
    }
    if (Object.keys(updates).length) await trx(table).where('id', id).update(updates);
    await trx('log_attivita').insert({categoria:'Documenti',icona:'🗑️',colore:'#ef4444',
      descrizione:`Rimosso documento ${name} (${table} ${id}); recupero ${archive ? path.basename(archive) : 'file già assente'}`,eseguito_da:'LocalServer'});
  });
  // Solo dopo che il commit è riuscito si rimuove l'originale.
  if (archive) fs.unlinkSync(original);
  return true;
}
module.exports = { deleteAttachment };
