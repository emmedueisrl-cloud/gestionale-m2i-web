const { normalizedDate } = require('./fatture_reconciliation');
const crypto = require('crypto');

function sameDocument(a, b) {
  const date = normalizedDate(a.data_fattura);
  return Boolean(date) && date === normalizedDate(b.data_fattura) &&
    Number.isFinite(Number(a.importo_totale)) && Number.isFinite(Number(b.importo_totale)) &&
    Math.abs(Number(a.importo_totale) - Number(b.importo_totale)) < 0.011;
}

function sameOfficialInvoice(a, b) {
  if (!sameDocument(a, b)) return false;
  for (const field of ['importo_imponibile', 'importo_iva']) {
    if (a[field] != null && b[field] != null &&
        (!Number.isFinite(Number(a[field])) || !Number.isFinite(Number(b[field])) ||
        Math.abs(Number(a[field]) - Number(b[field])) >= 0.011)) return false;
  }
  return true;
}

function rowKey(row, registration, official) {
  const values = [row.cliente_id, String(row.numero_fattura || '').trim(), normalizedDate(row.data_fattura), Number(row.importo_totale),
    Number(row.importo_imponibile), Number(row.importo_iva),
    registration?.id, registration?.data_fattura, registration?.importo_totale,
    official?.id, official?.data_fattura, official?.importo_totale, official?.importo_imponibile,
    official?.importo_iva, official?.importo_pagato, official?.stato_pagamento];
  return crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

async function inspectChoice(trx, row) {
  if (!row.cliente_id || !String(row.numero_fattura || '').trim()) return null;
  const year = normalizedDate(row.data_fattura).slice(0, 4);
  if (!year) throw new Error(`Data non valida per la fattura ${row.numero_fattura}.`);
  const whereNumber = table => trx(table).where({ cliente_id: row.cliente_id })
    .whereRaw('TRIM(numero_fattura) = ?', [String(row.numero_fattura).trim()]);
  const registrations = (await whereNumber('fatture_aruba_elaborati'))
    .filter(record => row.mese != null && row.anno != null
      ? Number(record.mese) === Number(row.mese) && Number(record.anno) === Number(row.anno)
      : normalizedDate(record.data_fattura).startsWith(year));
  const official = (await whereNumber('fatture'))
    .filter(record => normalizedDate(record.data_fattura).startsWith(year));
  if (registrations.length > 1 || official.length > 1) {
    const error = new Error(`Più fatture con numero ${row.numero_fattura} per lo stesso cliente: verifica manuale obbligatoria.`);
    error.status = 409;
    throw error;
  }
  const registration = registrations[0] || null;
  const currentOfficial = official[0] || null;
  const differs = (registration && !sameDocument(registration, row)) ||
    (currentOfficial && !sameOfficialInvoice(currentOfficial, row));
  if (!differs) return { registration, official: currentOfficial, conflict: null };
  return { registration, official: currentOfficial, conflict: {
    key: rowKey(row, registration, currentOfficial), cliente_id: row.cliente_id, numero_fattura: row.numero_fattura,
    caricata: registration ? { data: registration.data_fattura, importo: Number(registration.importo_totale), origine: 'addetto' } :
      { data: currentOfficial.data_fattura, importo: Number(currentOfficial.importo_totale), origine: 'archivio' },
    contabile: currentOfficial ? { data: currentOfficial.data_fattura, importo: Number(currentOfficial.importo_totale),
      imponibile: Number(currentOfficial.importo_imponibile), iva: Number(currentOfficial.importo_iva) } : null,
    file: { data: normalizedDate(row.data_fattura), importo: Number(row.importo_totale),
      imponibile: Number(row.importo_imponibile), iva: Number(row.importo_iva) },
    sostituibile: Boolean(registration) && !(currentOfficial &&
      (Number(currentOfficial.importo_pagato || 0) > 0 || ['Pagata', 'Parzialmente Pagata'].includes(currentOfficial.stato_pagamento)))
  } };
}

function requireChoices(inspected, choices) {
  const pending = inspected.map(item => item?.conflict).filter(Boolean)
    .filter(conflict => !['mantieni', 'sostituisci'].includes(choices?.[conflict.key]));
  if (!pending.length) return;
  const error = new Error('Scegli esplicitamente quale fattura mantenere per ogni discordanza.');
  error.status = 409;
  error.conflicts = pending;
  throw error;
}

async function replaceRegistration(trx, registration, row, source, userId, currentOfficial = null) {
  if (!registration || (sameDocument(registration, row) && (!currentOfficial || sameOfficialInvoice(currentOfficial, row)))) return;
  if (!Number.isFinite(Number(row.importo_totale)) || Number(row.importo_totale) < 0) {
    const error = new Error('Una fattura registrata dall’addetto non può essere sostituita con un importo negativo.');
    error.status = 400;
    throw error;
  }
  await trx('rettifiche_fatture_aruba').insert({
    registrazione_id: registration.id,
    precedente: JSON.stringify({ numero_fattura: registration.numero_fattura, data_fattura: registration.data_fattura,
      importo_totale: registration.importo_totale, allegato_path: registration.allegato_path,
      fattura_id: registration.fattura_id, fattura_contabile: currentOfficial }),
    successivo: JSON.stringify({ data_fattura: normalizedDate(row.data_fattura), importo_totale: Number(row.importo_totale) }),
    fonte: source, rettificata_at: new Date().toISOString(), rettificata_da: userId || null
  });
  // Il vecchio allegato resta conservato nello storico; non rappresenta più la fattura corrente.
  await trx('fatture_aruba_elaborati').where({ id: registration.id }).update({
    data_fattura: normalizedDate(row.data_fattura), importo_totale: Number(row.importo_totale),
    allegato_path: null, fattura_id: null
  });
}

async function replacementBlocked(trx, registration) {
  if (!registration || (registration.tipo_documento && registration.tipo_documento !== 'TD01')) {
    return 'La fattura non può essere sostituita da questa riga.';
  }
  const official = registration.fattura_id
    ? await trx('fatture').where({ id: registration.fattura_id }).first() : null;
  if (registration.fattura_id && !official) return 'Fattura contabile collegata non trovata: verifica la riconciliazione.';
  if (!official && await trx('fatture').where({ cliente_id: registration.cliente_id })
    .whereRaw('TRIM(numero_fattura) = ?', [String(registration.numero_fattura || '').trim()]).first()) {
    return 'Fattura contabile non riconciliata: verifica prima di sostituire.';
  }
  if (official && (Number(official.importo_pagato || 0) > 0 ||
    ['PAGATA', 'INCASSATA', 'PARZIALMENTE PAGATA'].includes(String(official.stato_pagamento || '').trim().toUpperCase()))) {
    return 'Fattura già pagata o parzialmente pagata.';
  }
  if (official && await trx.schema.hasTable('incassi_fatture') &&
    await trx('incassi_fatture').where({ fattura_id: official.id }).whereNull('annullato_at').first()) {
    return 'Fattura con incassi registrati.';
  }
  if (await trx.schema.hasTable('incassi_fatture_aruba') &&
    await trx('incassi_fatture_aruba').where({ registrazione_id: registration.id }).whereNull('annullato_at').first()) {
    return 'Fattura con incassi Aruba registrati.';
  }
  if (await trx.schema.hasTable('incassi_fatture_inviate') &&
    await trx('incassi_fatture_inviate').where({ cliente_id: registration.cliente_id,
    mese: registration.mese, anno: registration.anno }).whereNull('annullato_at').first()) {
    return 'Fattura inviata con incassi già registrati.';
  }
  return null;
}

module.exports = { sameDocument, sameOfficialInvoice, rowKey, inspectChoice, requireChoices, replaceRegistration,
  replacementBlocked };
