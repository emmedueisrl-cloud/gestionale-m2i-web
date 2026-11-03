const fs = require('node:fs');
const path = require('node:path');

const paidStatuses = new Set(['PAGATA', 'PAGATO', 'INCASSATA', 'INCASSATO',
  'PARZIALMENTE PAGATA', 'PARZIALMENTE PAGATO']);
const importedInvoiceId = /^FAT_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const importedXmlName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.xml$/i;

function createInvoiceUploadCleanup(db, dataDir) {
  function period(mese, anno) {
    const m = Number(mese), y = Number(anno);
    if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 2000 || y > 2100) {
      throw new Error('Periodo non valido.');
    }
    return { mese: m, anno: y };
  }

  async function ifPresent(trx, table, query) {
    return await trx.schema.hasTable(table) ? trx(table).where(query).first() : null;
  }

  async function inspect(trx, registration) {
    const key = { cliente_id: registration.cliente_id, mese: registration.mese, anno: registration.anno };
    const official = registration.fattura_id
      ? await trx('fatture').where({ id: registration.fattura_id }).first() : null;
    const groups = await trx.schema.hasTable('gruppi_fatturazione_extra')
      ? await trx('gruppi_fatturazione_extra').where({ fattura_registrazione_id: registration.id }) : [];
    let groupPayment = false;
    for (const group of groups.filter(group => group.tipo === 'extra')) {
      if (await ifPresent(trx, 'incassi_gruppi_extra', { gruppo_id: group.id })) groupPayment = true;
    }
    let reason = null;
    if (registration.fattura_id && !official) reason = 'Fattura contabile collegata non trovata.';
    else if (await ifPresent(trx, 'incassi_fatture_aruba', { registrazione_id: registration.id }) ||
      official && (Number(official.importo_pagato || 0) > 0 ||
        Boolean(official.data_pagamento) ||
        paidStatuses.has(String(official.stato_pagamento || '').trim().toUpperCase()) ||
        await ifPresent(trx, 'incassi_fatture', { fattura_id: official.id })) ||
      groupPayment ||
      !groups.some(group => group.tipo === 'extra') && await ifPresent(trx, 'incassi_fatture_inviate', key)) {
      reason = 'Pagamento o incasso già registrato: pulizia non consentita.';
    } else if (await ifPresent(trx, 'rettifiche_fatture_aruba', { registrazione_id: registration.id }) ||
      await ifPresent(trx, 'documenti_rettifica_extra', { fattura_origine_id: registration.id }) ||
      await ifPresent(trx, 'documenti_rettifica_extra', { nota_registrazione_id: registration.id })) {
      reason = 'Fattura con storico di rettifiche: pulizia non consentita.';
    } else if (groups.some(group => group.tipo === 'mensile') &&
      await trx('gruppi_fatturazione_extra').where(key).where({ tipo: 'mensile' })
        .whereNull('fattura_registrazione_id').first()) {
      reason = 'Esiste già un altro gruppo mensile senza fattura: verifica il collegamento prima della pulizia.';
    }
    const removeOfficial = Boolean(official && importedInvoiceId.test(official.id) &&
      importedXmlName.test(String(official.allegato_fattura || '')));
    return { reason, official, groups, removeOfficial };
  }

  async function list({ mese, anno }) {
    const p = period(mese, anno);
    return db.transaction(async trx => {
      const registrations = await trx('fatture_aruba_elaborati').where(p).orderBy('id');
      const clientIds = [...new Set(registrations.map(row => row.cliente_id))];
      const clients = clientIds.length ? await trx('clienti').whereIn('id', clientIds).select('id', 'ragione_sociale') : [];
      const names = new Map(clients.map(row => [String(row.id), row.ragione_sociale]));
      const result = [];
      for (const registration of registrations) {
        const check = await inspect(trx, registration);
        result.push({ id: registration.id, cliente: names.get(String(registration.cliente_id)) || registration.cliente_id,
          numero: registration.numero_fattura, data: registration.data_fattura,
          registrataAt: registration.registrata_at,
          importo: Number(registration.importo_totale), tipoDocumento: registration.tipo_documento || 'TD01',
          bloccata: Boolean(check.reason), motivo: check.reason });
      }
      return result;
    });
  }

  function storedPath(root, relative, folder, extension) {
    if (!root || !relative) return null;
    const base = path.resolve(root, 'uploads', folder);
    const target = path.resolve(root, relative);
    if (!target.startsWith(base + path.sep) || path.extname(target).toLowerCase() !== extension) return null;
    return target;
  }

  async function remove({ mese, anno, ids, userId }) {
    const p = period(mese, anno);
    if (!Array.isArray(ids) || !ids.length ||
      ids.some(id => !Number.isSafeInteger(Number(id)) || Number(id) <= 0) ||
      new Set(ids.map(Number)).size !== ids.length) throw new Error('Seleziona almeno una fattura, senza duplicati.');
    const files = [];
    const result = await db.transaction(async trx => {
      const registrations = [];
      for (let offset = 0; offset < ids.length; offset += 500) {
        registrations.push(...await trx('fatture_aruba_elaborati').where(p)
          .whereIn('id', ids.slice(offset, offset + 500).map(Number)));
      }
      if (registrations.length !== ids.length) throw new Error('Una fattura selezionata non è più presente nel mese. Aggiorna l’elenco.');
      const checks = [];
      for (const registration of registrations) {
        const check = await inspect(trx, registration);
        if (check.reason) throw new Error(`${registration.numero_fattura}: ${check.reason}`);
        checks.push({ registration, check });
      }
      for (const { registration, check } of checks) {
        if (check.groups.length) await trx('gruppi_fatturazione_extra')
          .where({ fattura_registrazione_id: registration.id }).update({ fattura_registrazione_id: null });
        await trx('fatture_aruba_elaborati').where({ id: registration.id }).del();
        if (check.removeOfficial) await trx('fatture').where({ id: check.official.id }).del();
        const extension = path.extname(registration.allegato_path || '').toLowerCase();
        if (['.pdf', '.xml'].includes(extension)) {
          const attachment = storedPath(dataDir, registration.allegato_path, 'fatture_aruba', extension);
          if (attachment) files.push(attachment);
        }
        if (check.removeOfficial) {
          const xml = storedPath(dataDir, path.join('uploads', 'unknown', check.official.allegato_fattura), 'unknown', '.xml');
          if (xml) files.push(xml);
        }
      }
      await trx('log_attivita').insert({ categoria: 'Fatture', icona: '🧹', colore: '#b91c1c',
        descrizione: `Ripuliti ${registrations.length} caricamenti fattura ${p.mese}/${p.anno}: ${registrations.map(row => row.numero_fattura).join(', ')}`,
        eseguito_da: String(userId || 'Contabilita') });
      return { rimosse: registrations.length };
    });
    for (const file of files) {
      try { fs.rmSync(file, { force: true }); } catch (error) { console.error('Allegato fattura non eliminato:', error.message); }
    }
    return result;
  }

  return { list, remove };
}

module.exports = { createInvoiceUploadCleanup };
