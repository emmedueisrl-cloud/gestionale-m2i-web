const crypto = require('node:crypto');

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
const statusFor = (invoice, today) => {
  const remaining = Math.max(0, cents(invoice.importo_totale) - cents(invoice.importo_pagato));
  if (!remaining) return 'Incassata';
  if (validDate(invoice.data_scadenza)) {
    if (invoice.data_scadenza < today) return 'Insoluta';
  } else if (invoice.stato_pagamento === 'Insoluto') return 'Insoluta';
  return cents(invoice.importo_pagato) > 0 ? 'Parziale' : 'Da incassare';
};

function createReceiptsService(knex) {
  async function initialize() {
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
  }

  async function list() {
    const pendingRegistrations = await knex.schema.hasTable('fatture_aruba_elaborati')
      ? await knex('fatture_aruba_elaborati as f').leftJoin('clienti as c', 'f.cliente_id', 'c.id')
        .whereNull('f.fattura_id').select('f.id', 'f.numero_fattura', 'f.data_fattura', 'f.importo_totale', 'c.ragione_sociale')
        .orderBy('f.data_fattura', 'desc') : [];
    const [invoices, receipts] = await Promise.all([
      knex('fatture as f').leftJoin('clienti as c', 'f.cliente_id', 'c.id')
        .select('f.id', 'f.cliente_id', 'c.ragione_sociale', 'f.numero_fattura', 'f.data_fattura', 'f.data_scadenza',
          'f.data_pagamento', 'f.importo_totale', 'f.importo_pagato', 'f.stato_pagamento')
        .select(knex.raw(`EXISTS (
          SELECT 1 FROM fatture_aruba_elaborati a
          WHERE a.fattura_id = f.id OR (
            a.cliente_id = f.cliente_id AND TRIM(a.numero_fattura) = TRIM(f.numero_fattura)
            AND a.data_fattura = f.data_fattura
          )
        ) AS registrata`))
        .orderBy('f.data_fattura', 'desc').orderBy('f.numero_fattura', 'desc'),
      knex('incassi_fatture').select('id', 'fattura_id', 'data_incasso', 'importo_cent', 'nota', 'origine',
        'registrato_at', 'annullato_at', 'motivo_annullamento').orderBy('registrato_at', 'desc')
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
    const today = todayInItaly();
    const rows = invoices.map(invoice => {
      const history = byInvoice.get(String(invoice.id)) || [];
      const paid = money(invoice.importo_pagato);
      const total = money(invoice.importo_totale);
      const activeLedgerCents = history.filter(row => !row.annullatoAt).reduce((sum, row) => sum + cents(row.importo), 0);
      return {
        id: invoice.id, clienteId: invoice.cliente_id, cliente: invoice.ragione_sociale || 'Cliente non disponibile',
        numero: invoice.numero_fattura, registrata: Boolean(invoice.registrata),
        dataFattura: invoice.data_fattura, scadenza: invoice.data_scadenza,
        totale: total, incassato: paid, residuo: Math.max(0, (cents(total) - cents(paid)) / 100),
        stato: statusFor(invoice, today),
        incongruenza: activeLedgerCents !== cents(paid) || cents(paid) > cents(total) || cents(paid) < 0 ||
          (invoice.stato_pagamento === 'Pagata' && cents(paid) < cents(total)),
        storico: history
      };
    });
    const sum = selector => rows.reduce((total, row) => total + cents(selector(row)), 0) / 100;
    return { fatture: rows, fattureDaRiconciliare: pendingRegistrations.map(row => ({
      id: row.id, numero: row.numero_fattura, dataFattura: row.data_fattura,
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
      if (!receipt) throw new Error('Incasso non trovato.');
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
