const crypto = require('crypto');
const getKnex = () => require('./db').knex;

const STATI = new Set(['nuovo', 'verificato', 'risolto']);
let ensurePromise;

function ensureTable() {
  if (!ensurePromise) {
    const knex = getKnex();
    ensurePromise = knex.schema.hasTable('autodiagnosi_errori').then(exists => {
      if (exists) return;
      return knex.schema.createTable('autodiagnosi_errori', table => {
        table.increments('id').primary();
        table.text('fingerprint').notNullable().unique();
        table.text('area').notNullable();
        table.text('operazione').notNullable();
        table.text('messaggio').notNullable();
        table.text('spiegazione').notNullable();
        table.text('causa').notNullable();
        table.text('soluzione').notNullable();
        table.text('gravita').notNullable().defaultTo('errore');
        table.text('stato').notNullable().defaultTo('nuovo');
        table.integer('occorrenze').notNullable().defaultTo(1);
        table.text('prima_occorrenza').notNullable();
        table.text('ultima_occorrenza').notNullable();
        table.text('ultimo_contesto');
        table.text('risolto_at');
        table.text('aggiornato_da');
      });
    }).catch(error => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

function sanitize(value, maxLength = 900) {
  let text = String(value || 'Errore non specificato');
  text = text
    .replace(/(password|token|secret|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[nascosto]')
    .replace(/[A-Za-z]:\\[^\n\r]+/g, '[percorso locale nascosto]')
    .replace(/\/(?:home|var|usr|app|opt)\/[^\n\r]+/g, '[percorso server nascosto]')
    .replace(/\s+at\s+[^\n\r]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maxLength);
}

function classify(message) {
  const value = String(message || '').toLowerCase();
  if (/unique|duplicat|già esistent/.test(value)) return {
    area: 'Dati', gravita: 'avviso', spiegazione: 'Il gestionale ha rilevato un dato già presente.',
    causa: 'È stato tentato un inserimento con un valore che deve essere univoco.',
    soluzione: 'Controllare il record esistente e modificarlo invece di crearne uno duplicato.'
  };
  if (/foreign key|vincolo|collegat/.test(value)) return {
    area: 'Dati', gravita: 'errore', spiegazione: 'L’operazione coinvolge dati collegati tra loro.',
    causa: 'Un elemento richiesto manca oppure il record è ancora utilizzato da altri dati.',
    soluzione: 'Verificare i dati collegati prima di ripetere l’operazione.'
  };
  if (/blindat|mese chiuso|sola lettura|sblocca/.test(value)) return {
    area: 'Elaborati', gravita: 'avviso', spiegazione: 'La modifica è stata bloccata per proteggere dati consolidati.',
    causa: 'La riga o il mese risulta blindato o chiuso.',
    soluzione: 'Sbloccare la riga o riaprire il periodo, se l’operazione è autorizzata.'
  };
  if (/busta paga|allegato|file|pdf|upload/.test(value)) return {
    area: 'Documenti', gravita: 'errore', spiegazione: 'Non è stato possibile leggere, salvare o recuperare un documento.',
    causa: 'Il file può essere assente, non valido, troppo grande o non accessibile.',
    soluzione: 'Controllare il file e ripetere il caricamento; se persiste, verificare lo spazio di archiviazione.'
  };
  if (/auth|accesso|autorizz|permess|credenzial/.test(value)) return {
    area: 'Accessi', gravita: 'avviso', spiegazione: 'L’operazione non è consentita all’utente corrente.',
    causa: 'La sessione è scaduta oppure il profilo non dispone dei permessi richiesti.',
    soluzione: 'Accedere nuovamente o verificare il ruolo assegnato all’utente.'
  };
  if (/sqlite_busy|database is locked|database|sql|no such table/.test(value)) return {
    area: 'Database', gravita: 'critico', spiegazione: 'Il database non ha completato correttamente una richiesta.',
    causa: 'Il database può essere occupato, non aggiornato o temporaneamente non disponibile.',
    soluzione: 'Non ripetere molte volte l’operazione; verificare database e log tecnici.'
  };
  return {
    area: 'Applicazione', gravita: 'errore', spiegazione: 'Il gestionale non ha completato l’operazione richiesta.',
    causa: 'La causa non è riconoscibile automaticamente dai dati disponibili.',
    soluzione: 'Aprire il dettaglio, annotare operazione e orario e verificare il log di sistema.'
  };
}

function fingerprint(area, operazione, message) {
  const normalized = sanitize(message, 500).toLowerCase().replace(/\b\d+\b/g, '#');
  return crypto.createHash('sha256').update(`${area}|${operazione}|${normalized}`).digest('hex');
}

async function recordError(error, context = {}) {
  try {
    await ensureTable();
    const knex = getKnex();
    const message = sanitize(error?.message || error);
    const classification = classify(message);
    const area = sanitize(context.area || classification.area, 80);
    const operazione = sanitize(context.operazione || 'Operazione non identificata', 160);
    const key = fingerprint(area, operazione, message);
    const now = new Date().toISOString();
    const existing = await knex('autodiagnosi_errori').where({ fingerprint: key }).first();
    const safeContext = JSON.stringify({
      metodo: sanitize(context.metodo || '', 12),
      percorso: sanitize(context.percorso || '', 180),
      utente: sanitize(context.utente || '', 80)
    });
    if (existing) {
      await knex('autodiagnosi_errori').where({ id: existing.id }).update({
        occorrenze: Number(existing.occorrenze || 0) + 1,
        ultima_occorrenza: now,
        ultimo_contesto: safeContext,
        stato: existing.stato === 'risolto' ? 'nuovo' : existing.stato,
        risolto_at: existing.stato === 'risolto' ? null : existing.risolto_at
      });
      return existing.id;
    }
    const [id] = await knex('autodiagnosi_errori').insert({
      fingerprint: key, area, operazione, messaggio: message,
      spiegazione: classification.spiegazione, causa: classification.causa,
      soluzione: classification.soluzione, gravita: classification.gravita,
      stato: 'nuovo', occorrenze: 1, prima_occorrenza: now,
      ultima_occorrenza: now, ultimo_contesto: safeContext
    });
    return id;
  } catch (recordingError) {
    console.error('[AUTODIAGNOSI] Registrazione non riuscita:', recordingError.message);
    return null;
  }
}

async function listErrors(filters = {}) {
  await ensureTable();
  const knex = getKnex();
  const query = knex('autodiagnosi_errori').select('*').orderBy('ultima_occorrenza', 'desc');
  if (filters.stato && filters.stato !== 'tutti') query.where('stato', filters.stato);
  if (filters.gravita && filters.gravita !== 'tutte') query.where('gravita', filters.gravita);
  if (filters.area && filters.area !== 'tutte') query.where('area', filters.area);
  const records = await query.limit(500);
  const riepilogoRows = await knex('autodiagnosi_errori').select('stato').count('* as totale').groupBy('stato');
  const riepilogo = { nuovo: 0, verificato: 0, risolto: 0 };
  riepilogoRows.forEach(row => { riepilogo[row.stato] = Number(row.totale); });
  return { records, riepilogo, aree: [...new Set(records.map(record => record.area))].sort() };
}

async function updateStatus(id, stato, userId) {
  await ensureTable();
  const knex = getKnex();
  if (!STATI.has(stato)) throw new Error('Stato autodiagnosi non valido.');
  const updated = await knex('autodiagnosi_errori').where({ id }).update({
    stato,
    risolto_at: stato === 'risolto' ? new Date().toISOString() : null,
    aggiornato_da: userId || null
  });
  if (!updated) throw new Error('Segnalazione di autodiagnosi non trovata.');
  return knex('autodiagnosi_errori').where({ id }).first();
}

module.exports = { ensureTable, sanitize, classify, fingerprint, recordError, listErrors, updateStatus };
