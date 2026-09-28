const fs = require('node:fs/promises');
const path = require('node:path');

async function ensureAttachmentColumns(knex) {
  for (const column of ['link_cv', 'link_documenti']) {
    if (!await knex.schema.hasColumn('dipendenti', column)) {
      await knex.schema.alterTable('dipendenti', table => table.text(column));
    }
  }
}

function createAttachmentLinkHandler(knex, uploadsDir) {
  return async (req, res) => {
    try {
      const id = req.params.id;
      const { localName, tipo_documento: type, overwrite } = req.body || {};
      if (!/^D\d{4,}$/.test(id) || typeof localName !== 'string' ||
          localName.length > 255 || !/^[A-Za-z0-9_.-]+$/.test(localName) ||
          localName.includes('..') || !['cv', 'doc'].includes(type) ||
          (overwrite !== undefined && typeof overwrite !== 'boolean')) {
        return res.status(400).json({ success: false, error: 'Dati di collegamento non validi.' });
      }

      const source = path.join(uploadsDir, 'doc', localName);
      const sourceStat = await fs.stat(source).catch(() => null);
      if (!sourceStat?.isFile()) {
        return res.status(404).json({ success: false, error: 'Allegato e-mail non trovato.' });
      }
      const dipendente = await knex('dipendenti').where({ id }).first();
      if (!dipendente) return res.status(404).json({ success: false, error: 'Dipendente non trovato.' });

      const existing = type === 'cv' ? dipendente.link_cv : (dipendente.link_documenti || dipendente.allegato_documenti);
      if (existing && !overwrite) {
        return res.status(409).json({
          success: false, error: 'already_exists',
          message: 'Questo dipendente ha già un allegato collegato in questa categoria. Vuoi sostituire il collegamento?'
        });
      }

      const targetDir = path.join(uploadsDir, id);
      await fs.mkdir(targetDir, { recursive: true });
      const targetName = `email_${localName}`;
      const target = path.join(targetDir, targetName);
      try {
        await fs.copyFile(source, target, require('node:fs').constants.COPYFILE_EXCL);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      const url = `/uploads/${id}/${targetName}`;
      const update = type === 'cv' ? { link_cv: url } : { link_documenti: url, allegato_documenti: url };
      await knex('dipendenti').where({ id }).update(update);
      res.json({ success: true, path: url });
    } catch (error) {
      console.error('Errore collegamento allegato e-mail:', error);
      res.status(500).json({ success: false, error: 'Impossibile collegare l’allegato.' });
    }
  };
}

module.exports = { ensureAttachmentColumns, createAttachmentLinkHandler };
