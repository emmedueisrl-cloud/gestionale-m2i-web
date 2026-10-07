const crypto = require('node:crypto');
const { transferArubaReceipts } = require('./fatture_reconciliation');

const cents = value => Math.round(Number(value || 0) * 100);
const money = value => cents(value) / 100;
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return year >= 2000 && year <= 2100 && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};
const todayInItaly = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const dateInItaly = timestamp => {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const statusFor = (invoice, today) => {
  const remaining = Math.max(0, cents(invoice.importo_totale) - cents(invoice.importo_pagato));
  if (!remaining) return 'Incassata';
  if (validDate(invoice.data_scadenza)) {
    if (invoice.data_scadenza < today) return 'Insoluta';
  } else if (invoice.stato_pagamento === 'Insoluto') return 'Insoluta';
  return cents(invoice.importo_pagato) > 0 ? 'Parziale' : 'Da incassare';
};
const arubaId = value => /^aruba:([1-9]\d*)$/.exec(String(value || ''))?.[1] || null;

function createReceiptsService(knex) {
  async function initialize() {
    if (!await knex.schema.hasColumn('fatture_aruba_elaborati', 'data_scadenza')) {
      await knex.raw('ALTER TABLE fatture_aruba_elaborati ADD COLUMN data_scadenza TEXT');
    }
    if (!await knex.schema.hasTable('incassi_fatture_aruba')) {
      await knex.schema.createTable('incassi_fatture_aruba', table => {
        table.text('id').primary();
        table.integer('registrazione_id').notNullable().references('id').inTable('fatture_aruba_elaborati').onDelete('RESTRICT');
        table.text('data_incasso').notNullable();
        table.integer('importo_cent').notNullable();
        table.text('nota');
        table.text('origine').notNullable().defaultTo('manuale');
        table.text('registrato_at').notNullable();
        table.text('registrato_da');
        table.text('annullato_at');
        table.text('annullato_da');
        table.text('motivo_annullamento');
        table.text('idempotency_key').unique();
        table.index(['registrazione_id', 'data_incasso']);
      });
    }
    if (!await knex.schema.hasTable('incassi_fatture')) {
      await knex.schema.createTable('incassi_fatture', table => {
        table.text('id').primary();
        table.text('fattura_id').notNullable().references('id').inTable('fatture').onDelete('RESTRICT');
        table.text('data_incasso');
        table.integer('importo_cent').notNullable();
        table.text('nota');
        table.text('origine').notNullable().defaultTo('manuale');
        table.text('registrato_at').notNullable();
        table.text('registrato_da');
        table.text('annullato_at');
        table.text('annullato_da');
        table.text('motivo_annullamento');
        table.text('idempotency_key').unique();
        table.index(['fattura_id', 'data_incasso']);
      });
    }
    // Un importo storico cumulativo non contiene il dettaglio delle singole rate.
    const invoices = await knex('fatture').select('id', 'importo_pagato', 'data_pagamento');
    const recorded = new Set((await knex('incassi_fatture').distinct('fattura_id')).map(row => String(row.fattura_id)));
    for (const invoice of invoices) {
      if (cents(invoice.importo_pagato) <= 0 || recorded.has(String(invoice.id))) continue;
      await knex('incassi_fatture').insert({
        id: crypto.randomUUID(), fattura_id: invoice.id,
        data_incasso: validDate(invoice.data_pagamento) ? invoice.data_pagamento : null,
        importo_cent: cents(invoice.importo_pagato), origine: 'storico',
        nota: 'Totale cumulativo precedente al registro incassi; le singole rate non sono disponibili.',
        registrato_at: new Date().toISOString()
      });
    }
    const linked = await knex('fatture_aruba_elaborati').whereNotNull('fattura_id').select('id', 'fattura_id');
    for (const registration of linked) {
      if (!await knex('incassi_fatture_aruba').where({ registrazione_id: registration.id }).first()) continue;
      await knex.transaction(async trx => {
        const official = await trx('fatture').where({ id: registration.fattura_id }).first();
        if (official) await transferArubaReceipts(trx, registration, official);
      });
    }
  }

  async function list() {
    // Solo le registrazioni della sezione Fatturazione appartengono a questo flusso.
    // La tabella generale fatture contiene anche importazioni storiche non elaborate qui.
    const [registrations, sentInvoices, receipts, arubaReceipts] = await Promise.all([
      knex('fatture_aruba_elaborati as a')
        .leftJoin('clienti as c', 'a.cliente_id', 'c.id')
        .leftJoin('fatture as f', 'a.fattura_id', 'f.id')
        .select('a.id as registrazione_id', 'a.fattura_id', 'a.cliente_id', 'c.ragione_sociale',
          'a.mese', 'a.anno', 'a.numero_fattura', 'a.data_fattura', 'a.importo_totale',
          'a.data_scadenza as scadenza_aruba', 'f.data_scadenza',
          'f.data_pagamento', 'f.importo_pagato', 'f.stato_pagamento')
        .orderBy('a.data_fattura', 'desc').orderBy('a.numero_fattura', 'desc'),
      knex('fatture_inviate_elaborati as s')
        .leftJoin('clienti as c', 's.cliente_id', 'c.id')
        .leftJoin('righe_bloccate_elaborati as b', function () {
          this.on('b.tipo', knex.raw('?', ['cliente'])).andOn('b.mese', 's.mese')
            .andOn('b.anno', 's.anno').andOn('b.soggetto_id', 's.cliente_id');
        })
        .leftJoin('dettaglio_mesi_chiusi_clienti as d', function () {
          this.on('d.mese', 's.mese').andOn('d.anno', 's.anno').andOn('d.cliente_id', 's.cliente_id');
        })
        .select('s.cliente_id', 's.mese', 's.anno', 's.inviata_at', 'c.ragione_sociale',
          'b.snapshot', 'd.importo_totale as importo_storico'),
      knex('incassi_fatture').select('id', 'fattura_id', 'data_incasso', 'importo_cent', 'nota', 'origine',
        'registrato_at', 'annullato_at', 'motivo_annullamento').orderBy('registrato_at', 'desc'),
      knex('incassi_fatture_aruba').select('id', 'registrazione_id', 'data_incasso', 'importo_cent',
        'nota', 'origine', 'registrato_at', 'annullato_at', 'motivo_annullamento').orderBy('registrato_at', 'desc')
    ]);
    const byInvoice = new Map();
    for (const receipt of receipts) {
      const key = String(receipt.fattura_id);
      if (!byInvoice.has(key)) byInvoice.set(key, []);
      byInvoice.get(key).push({
        id: receipt.id, data: receipt.data_incasso, importo: receipt.importo_cent / 100,
        nota: receipt.nota || '', origine: receipt.origine, registratoAt: receipt.registrato_at,
        annullatoAt: receipt.annullato_at, motivoAnnullamento: receipt.motivo_annullamento
      });
    }
    const byRegistration = new Map();
    for (const receipt of arubaReceipts) {
      const key = String(receipt.registrazione_id);
      if (!byRegistration.has(key)) byRegistration.set(key, []);
      byRegistration.get(key).push({
        id: receipt.id, data: receipt.data_incasso, importo: receipt.importo_cent / 100,
        nota: receipt.nota || '', origine: receipt.origine, registratoAt: receipt.registrato_at,
        annullatoAt: receipt.annullato_at, motivoAnnullamento: receipt.motivo_annullamento
      });
    }
    const today = todayInItaly();
    const rows = registrations.map(invoice => {
      const linked = Boolean(invoice.fattura_id);
      const pendingHistory = byRegistration.get(String(invoice.registrazione_id)) || [];
      const awaitingTransfer = linked && pendingHistory.length > 0;
      const history = linked && !awaitingTransfer ? byInvoice.get(String(invoice.fattura_id)) || [] : pendingHistory;
      const paid = linked && !awaitingTransfer ? money(invoice.importo_pagato)
        : history.filter(row => !row.annullatoAt).reduce((sum, row) => sum + row.importo, 0);
      const total = money(invoice.importo_totale);
      const activeLedgerCents = history.filter(row => !row.annullatoAt).reduce((sum, row) => sum + cents(row.importo), 0);
      const scadenza = linked && !awaitingTransfer ? invoice.data_scadenza : invoice.scadenza_aruba;
      return {
        id: linked && !awaitingTransfer ? invoice.fattura_id : `aruba:${invoice.registrazione_id}`,
        clienteId: invoice.cliente_id, cliente: invoice.ragione_sociale || 'Cliente non disponibile',
        numero: invoice.numero_fattura, registrata: true, gestibile: !awaitingTransfer,
        sincronizzazioneDaVerificare: awaitingTransfer,
        periodo: `${invoice.anno}-${String(invoice.mese).padStart(2, '0')}`,
        dataFattura: invoice.data_fattura, scadenza,
        totale: total, incassato: paid, residuo: Math.max(0, (cents(total) - cents(paid)) / 100),
        stato: statusFor({ ...invoice, importo_pagato: paid, data_scadenza: scadenza }, today),
        incongruenza: awaitingTransfer || cents(paid) > cents(total) || (linked && (activeLedgerCents !== cents(paid) || cents(paid) < 0 ||
          (invoice.stato_pagamento === 'Pagata' && cents(paid) < cents(total)))),
        storico: history
      };
    });
    const registeredPeriods = new Set(registrations.map(row => `${row.cliente_id}:${row.anno}:${row.mese}`));
    for (const sent of sentInvoices) {
      if (registeredPeriods.has(`${sent.cliente_id}:${sent.anno}:${sent.mese}`)) continue;
      let snapshot = null;
      try { snapshot = sent.snapshot ? JSON.parse(sent.snapshot) : null; } catch { /* Storico senza snapshot leggibile. */ }
      const rawTotal = snapshot?.importoTotale ?? sent.importo_storico;
      const validTotal = rawTotal !== null && rawTotal !== undefined && Number.isFinite(Number(rawTotal));
      const total = validTotal ? money(rawTotal) : 0;
      rows.push({
        id: `inviata:${sent.cliente_id}:${sent.anno}:${sent.mese}`,
        clienteId: sent.cliente_id, cliente: sent.ragione_sociale || 'Cliente non disponibile',
        numero: '', registrata: false, gestibile: false,
        periodo: `${sent.anno}-${String(sent.mese).padStart(2, '0')}`,
        dataFattura: dateInItaly(sent.inviata_at), scadenza: null,
        totale: total, incassato: 0, residuo: total,
        stato: validTotal ? 'Da incassare' : 'Importo da verificare',
        incongruenza: !validTotal, storico: []
      });
    }
    const sum = selector => rows.reduce((total, row) => total + cents(selector(row)), 0) / 100;
    return { fatture: rows, fattureDaRiconciliare: registrations.filter(row => !row.fattura_id).map(row => ({
      id: row.registrazione_id, numero: row.numero_fattura, dataFattura: row.data_fattura,
      totale: money(row.importo_totale), cliente: row.ragione_sociale || 'Cliente non disponibile'
    })), riepilogo: {
      fatturato: sum(row => row.totale), incassato: sum(row => row.incassato),
      daIncassare: sum(row => row.residuo), insoluto: sum(row => row.stato === 'Insoluta' ? row.residuo : 0)
    }, oggi: today };
  }

  async function register({ fatturaId, data, importo, nota, userId, idempotencyKey }) {
    if (!validDate(data) || data > todayInItaly()) throw new Error('Inserisci una data di incasso valida, non futura.');
    const raw = String(importo ?? '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || !Number.isSafeInteger(cents(raw)) || cents(raw) <= 0) {
      throw new Error('Inserisci un importo positivo con massimo due decimali.');
    }
    if (typeof nota !== 'undefined' && (typeof nota !== 'string' || nota.length > 2000)) throw new Error('La nota supera il limite di 2000 caratteri.');
    if (idempotencyKey && (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(idempotencyKey))) throw new Error('Identificativo richiesta non valido.');
    const registrationId = arubaId(fatturaId);
    if (registrationId) return knex.transaction(async trx => {
      const registration = await trx('fatture_aruba_elaborati').where({ id: registrationId }).first();
      if (!registration) throw new Error('Fattura elaborata non trovata.');
      if (idempotencyKey) {
        const existing = await trx('incassi_fatture_aruba').where({ idempotency_key: idempotencyKey }).first();
        if (existing) {
          if (String(existing.registrazione_id) !== String(registrationId)) throw new Error('Richiesta già usata per un’altra fattura.');
          return { id: existing.id, alreadyRegistered: true };
        }
        const transferred = await trx('incassi_fatture').where({ idempotency_key: idempotencyKey }).first();
        if (transferred) {
          if (String(transferred.fattura_id) !== String(registration.fattura_id)) throw new Error('Richiesta già usata per un’altra fattura.');
          return { id: transferred.id, alreadyRegistered: true };
        }
      }
      if (registration.fattura_id) throw new Error('La fattura è stata collegata all’archivio. Aggiorna la pagina e riprova.');
      const recorded = await trx('incassi_fatture_aruba').where({ registrazione_id: registrationId });
      const paid = recorded.filter(row => !row.annullato_at).reduce((sum, row) => sum + Number(row.importo_cent), 0);
      const remaining = cents(registration.importo_totale) - paid;
      const amount = cents(raw);
      if (remaining <= 0) throw new Error('La fattura risulta già interamente incassata.');
      if (amount > remaining) throw new Error(`Importo superiore al residuo di ${(remaining / 100).toFixed(2)} €.`);
      const id = crypto.randomUUID();
      await trx('incassi_fatture_aruba').insert({
        id, registrazione_id: registrationId, data_incasso: data, importo_cent: amount,
        nota: (nota || '').trim(), origine: 'manuale', registrato_at: new Date().toISOString(),
        registrato_da: userId || null, idempotency_key: idempotencyKey || null
      });
      await trx('log_attivita').insert({ categoria: 'Incassi', icona: '💶', colore: '#059669',
        descrizione: `Registrato incasso di ${(amount / 100).toFixed(2)} € per fattura ${registration.numero_fattura}.`,
        eseguito_da: String(userId || 'LocalServer') });
      return { id, incassato: (paid + amount) / 100, residuo: (remaining - amount) / 100 };
    });
    return knex.transaction(async trx => {
      if (idempotencyKey) {
        const existing = await trx('incassi_fatture').where({ idempotency_key: idempotencyKey }).first();
        if (existing) {
          if (String(existing.fattura_id) !== String(fatturaId)) throw new Error('Richiesta già usata per un’altra fattura.');
          return { id: existing.id, alreadyRegistered: true };
        }
      }
      const invoice = await trx('fatture').where({ id: fatturaId }).first();
      if (!invoice) throw new Error('Fattura non trovata.');
      const recorded = await trx('incassi_fatture').where({ fattura_id: fatturaId });
      if (!recorded.length && cents(invoice.importo_pagato) > 0) {
        await trx('incassi_fatture').insert({
          id: crypto.randomUUID(), fattura_id: fatturaId,
          data_incasso: validDate(invoice.data_pagamento) ? invoice.data_pagamento : null,
          importo_cent: cents(invoice.importo_pagato), origine: 'storico',
          nota: 'Totale cumulativo precedente al registro incassi; le singole rate non sono disponibili.',
          registrato_at: new Date().toISOString()
        });
      } else if (recorded.length && recorded.filter(row => !row.annullato_at)
        .reduce((sum, row) => sum + Number(row.importo_cent), 0) !== cents(invoice.importo_pagato)) {
        throw new Error('Gli incassi registrati non coincidono con il totale della fattura. Verifica prima di aggiungerne altri.');
      }
      const remaining = cents(invoice.importo_totale) - cents(invoice.importo_pagato);
      const amount = cents(raw);
      if (remaining <= 0) throw new Error('La fattura risulta già interamente incassata.');
      if (amount > remaining) throw new Error(`Importo superiore al residuo di ${(remaining / 100).toFixed(2)} €.`);
      const paid = cents(invoice.importo_pagato) + amount;
      const id = crypto.randomUUID();
      await trx('incassi_fatture').insert({ id, fattura_id: fatturaId, data_incasso: data,
        importo_cent: amount, nota: (nota || '').trim(), origine: 'manuale',
        registrato_at: new Date().toISOString(), registrato_da: userId || null,
        idempotency_key: idempotencyKey || null });
      await trx('fatture').where({ id: fatturaId }).update({
        importo_pagato: paid / 100, data_pagamento: data,
        stato_pagamento: paid === cents(invoice.importo_totale) ? 'Pagata' : 'Parzialmente Pagata'
      });
      await trx('log_attivita').insert({ categoria: 'Incassi', icona: '💶', colore: '#059669',
        descrizione: `Registrato incasso di ${(amount / 100).toFixed(2)} € per fattura ${invoice.numero_fattura}.`,
        eseguito_da: String(userId || 'LocalServer') });
      return { id, incassato: paid / 100, residuo: (remaining - amount) / 100 };
    });
  }

  async function cancel({ receiptId, reason, userId }) {
    if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 1000) throw new Error('Indica il motivo dell’annullamento.');
    return knex.transaction(async trx => {
      const receipt = await trx('incassi_fatture').where({ id: receiptId }).first();
      if (!receipt) {
        const arubaReceipt = await trx('incassi_fatture_aruba').where({ id: receiptId }).first();
        if (!arubaReceipt) throw new Error('Incasso non trovato.');
        if (arubaReceipt.annullato_at) throw new Error('Incasso già annullato.');
        const registration = await trx('fatture_aruba_elaborati').where({ id: arubaReceipt.registrazione_id }).first();
        if (!registration || registration.fattura_id) throw new Error('La fattura è stata collegata all’archivio. Aggiorna la pagina e riprova.');
        await trx('incassi_fatture_aruba').where({ id: receiptId }).update({
          annullato_at: new Date().toISOString(), annullato_da: userId || null,
          motivo_annullamento: reason.trim()
        });
        await trx('log_attivita').insert({ categoria: 'Incassi', icona: '↩️', colore: '#dc2626',
          descrizione: `Annullato incasso ${receiptId} della fattura ${registration.numero_fattura}. Motivo: ${reason.trim()}`,
          eseguito_da: String(userId || 'LocalServer') });
        return { success: true };
      }
      if (receipt.annullato_at) throw new Error('Incasso già annullato.');
      if (receipt.origine === 'storico') throw new Error('Il totale storico non può essere annullato come singola rata.');
      const invoice = await trx('fatture').where({ id: receipt.fattura_id }).first();
      if (!invoice) throw new Error('Fattura non trovata.');
      const active = await trx('incassi_fatture').where({ fattura_id: receipt.fattura_id }).whereNull('annullato_at');
      if (active.reduce((sum, row) => sum + Number(row.importo_cent), 0) !== cents(invoice.importo_pagato)) {
        throw new Error('Gli incassi registrati non coincidono con il totale della fattura. Verifica prima di annullarne uno.');
      }
      const paid = cents(invoice.importo_pagato) - Number(receipt.importo_cent);
      if (paid < 0) throw new Error('Il totale incassato non è coerente con il registro.');
      await trx('incassi_fatture').where({ id: receiptId }).update({
        annullato_at: new Date().toISOString(), annullato_da: userId || null,
        motivo_annullamento: reason.trim()
      });
      const previous = await trx('incassi_fatture').where({ fattura_id: receipt.fattura_id }).whereNull('annullato_at')
        .whereNotNull('data_incasso').orderBy('data_incasso', 'desc').first();
      await trx('fatture').where({ id: receipt.fattura_id }).update({
        importo_pagato: paid / 100, data_pagamento: previous?.data_incasso || null,
        stato_pagamento: paid === 0 ? 'Da Pagare' : paid >= cents(invoice.importo_totale) ? 'Pagata' : 'Parzialmente Pagata'
      });
      await trx('log_attivita').insert({ categoria: 'Incassi', icona: '↩️', colore: '#dc2626',
        descrizione: `Annullato incasso ${receiptId} della fattura ${invoice.numero_fattura}. Motivo: ${reason.trim()}`,
        eseguito_da: String(userId || 'LocalServer') });
      return { success: true };
    });
  }

  async function setDueDate({ fatturaId, date, userId }) {
    if (date !== null && date !== '' && !validDate(date)) throw new Error('Data di scadenza non valida.');
    return knex.transaction(async trx => {
      const registrationId = arubaId(fatturaId);
      if (registrationId) {
        const registration = await trx('fatture_aruba_elaborati').where({ id: registrationId }).first();
        if (!registration) throw new Error('Fattura elaborata non trovata.');
        if (registration.fattura_id) throw new Error('La fattura è stata collegata all’archivio. Aggiorna la pagina e riprova.');
        await trx('fatture_aruba_elaborati').where({ id: registrationId }).update({ data_scadenza: date || null });
        await trx('log_attivita').insert({ categoria: 'Incassi', icona: '📅', colore: '#4f46e5',
          descrizione: `Aggiornata scadenza della fattura ${registration.numero_fattura}: ${date || 'rimossa'}.`,
          eseguito_da: String(userId || 'LocalServer') });
        return { success: true };
      }
      const invoice = await trx('fatture').where({ id: fatturaId }).first();
      if (!invoice) throw new Error('Fattura non trovata.');
      const updates = { data_scadenza: date || null };
      if (invoice.stato_pagamento === 'Insoluto') {
        updates.stato_pagamento = cents(invoice.importo_pagato) > 0 ? 'Parzialmente Pagata' : 'Da Pagare';
      }
      await trx('fatture').where({ id: fatturaId }).update(updates);
      await trx('log_attivita').insert({ categoria: 'Incassi', icona: '📅', colore: '#4f46e5',
        descrizione: `Aggiornata scadenza della fattura ${fatturaId}: ${date || 'rimossa'}.`,
        eseguito_da: String(userId || 'LocalServer') });
      return { success: true };
    });
  }

  return { initialize, list, register, cancel, setDueDate };
}

module.exports = { createReceiptsService, validDate, todayInItaly };
