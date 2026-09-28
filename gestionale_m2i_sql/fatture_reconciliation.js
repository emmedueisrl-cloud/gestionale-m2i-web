function normalizedDate(value) {
  const text = String(value || '').trim();
  const italian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const iso = italian ? `${italian[3]}-${italian[2]}-${italian[1]}` : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : '';
}

function matches(operational, official) {
  const operationDate = normalizedDate(operational.data_fattura);
  return Boolean(operationDate) && operationDate === normalizedDate(official.data_fattura) &&
    Number.isFinite(Number(official.importo_totale)) &&
    Math.abs(Number(operational.importo_totale) - Number(official.importo_totale)) < 0.011;
}

async function reconcileOfficial(trx, official) {
  const year = normalizedDate(official.data_fattura).slice(0, 4);
  if (!year) return { stato: 'da_verificare' };
  const records = (await trx('fatture_aruba_elaborati').where({ cliente_id: official.cliente_id })
    .whereRaw('TRIM(numero_fattura) = ?', [String(official.numero_fattura).trim()]))
    .filter(record => normalizedDate(record.data_fattura).startsWith(year));
  if (!records.length) return { stato: 'nessuna_registrazione' };
  const exact = records.filter(record => matches(record, official));
  if (exact.length !== 1 || records.length !== 1) return { stato: 'da_verificare' };
  const record = exact[0];
  if (record.fattura_id && record.fattura_id !== official.id) return { stato: 'da_verificare' };
  const other = await trx('fatture_aruba_elaborati').where({ fattura_id: official.id }).whereNot({ id: record.id }).first();
  if (other) return { stato: 'da_verificare' };
  await trx('fatture_aruba_elaborati').where({ id: record.id }).update({ fattura_id: official.id });
  return { stato: 'riconciliata', registrazioneId: record.id };
}

async function reconcileRegistration(trx, record) {
  const year = normalizedDate(record.data_fattura).slice(0, 4);
  if (!year) return { stato: 'da_verificare' };
  const official = (await trx('fatture').where({ cliente_id: record.cliente_id })
    .whereRaw('TRIM(numero_fattura) = ?', [String(record.numero_fattura).trim()]))
    .filter(invoice => normalizedDate(invoice.data_fattura).startsWith(year));
  if (!official.length) return { stato: 'in_attesa_importazione' };
  if (official.length !== 1) return { stato: 'da_verificare' };
  return reconcileOfficial(trx, official[0]);
}

async function registrationStatuses(trx, records) {
  if (!records.length) return records;
  const ids = [...new Set(records.map(record => record.cliente_id))];
  const official = await trx('fatture').whereIn('cliente_id', ids).select('id', 'cliente_id', 'numero_fattura', 'data_fattura', 'importo_totale');
  return records.map(record => {
    const candidates = official.filter(invoice => invoice.cliente_id === record.cliente_id &&
      String(invoice.numero_fattura).trim() === String(record.numero_fattura).trim() &&
      normalizedDate(invoice.data_fattura).slice(0, 4) === normalizedDate(record.data_fattura).slice(0, 4));
    const valid = candidates.length === 1 && matches(record, candidates[0]) && record.fattura_id === candidates[0].id;
    return { ...record, stato_riconciliazione: valid ? 'riconciliata' :
      candidates.length ? 'da_verificare' : 'in_attesa_importazione' };
  });
}

module.exports = { normalizedDate, reconcileOfficial, reconcileRegistration, registrationStatuses };
