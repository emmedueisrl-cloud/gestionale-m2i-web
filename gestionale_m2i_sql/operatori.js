const { knex } = require('./db');

let ensurePromise;

async function ensureTables() {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    if (!await knex.schema.hasTable('operatori')) {
      await knex.schema.createTable('operatori', table => {
        table.increments('id').primary();
        table.text('nome').notNullable();
        table.integer('attivo').notNullable().defaultTo(1);
        table.text('data_cessazione');
        table.timestamp('creato_at').defaultTo(knex.fn.now());
      });
      await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS operatori_nome_nocase ON operatori(nome COLLATE NOCASE)');
    }
    if (!await knex.schema.hasTable('operatori_periodi')) {
      await knex.schema.createTable('operatori_periodi', table => {
        table.increments('id').primary();
        table.integer('operatore_id').notNullable().references('id').inTable('operatori').onDelete('CASCADE');
        table.text('data_inizio');
        table.text('data_fine');
      });
    }

    // Reset richiesto per l'avvio del nuovo metodo Outbound. La marcatura nel DB
    // lo esegue una sola volta, anche dopo futuri deploy e riavvii.
    if (!await knex.schema.hasTable('operatori_migrazioni')) {
      await knex.schema.createTable('operatori_migrazioni', table => {
        table.text('chiave').primary();
        table.text('eseguita_at').notNullable();
      });
    }
    if (!await knex.schema.hasTable('operatori_assegnazioni_pre_reset')) {
      await knex.schema.createTable('operatori_assegnazioni_pre_reset', table => {
        table.text('cliente_id').primary();
        table.text('outbound');
        table.text('operatore_assegnato');
        table.text('salvato_at').notNullable();
      });
    }
    await knex.transaction(async trx => {
      const chiave = 'reset_outbound_clienti_2026_10';
      if (await trx('operatori_migrazioni').where({ chiave }).first()) return;
      await trx.raw(`INSERT INTO operatori_assegnazioni_pre_reset
        (cliente_id, outbound, operatore_assegnato, salvato_at)
        SELECT id, operatore, operatore_assegnato, datetime('now') FROM clienti
        WHERE TRIM(COALESCE(operatore, '')) <> ''
           OR TRIM(COALESCE(operatore_assegnato, '')) <> ''`);
      await trx('clienti').update({ operatore: '', operatore_assegnato: '' });
      await trx('operatori_migrazioni').insert({ chiave, eseguita_at: new Date().toISOString() });
    });

    const senzaPeriodo = await knex('operatori as o')
      .leftJoin('operatori_periodi as p', 'p.operatore_id', 'o.id')
      .whereNull('p.id').select('o.id', 'o.attivo', 'o.data_cessazione');
    for (const operatore of senzaPeriodo) {
      await knex('operatori_periodi').insert({
        operatore_id: operatore.id,
        data_inizio: null,
        data_fine: operatore.attivo ? null : operatore.data_cessazione
      });
    }
  })().catch(error => { ensurePromise = null; throw error; });
  return ensurePromise;
}

const dataIso = (valore, etichetta) => {
  const testo = String(valore || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testo) || Number.isNaN(new Date(`${testo}T00:00:00Z`).getTime())) {
    throw new Error(`${etichetta} non valida.`);
  }
  return testo;
};

async function elencaOperatori(includiCessati = true) {
  await ensureTables();
  const query = knex('operatori').select('id', 'nome', 'attivo', 'data_cessazione').orderByRaw('nome COLLATE NOCASE');
  if (!includiCessati) query.where('attivo', 1);
  const [righe, clienti] = await Promise.all([
    query,
    knex('clienti')
      .select('id', 'ragione_sociale', 'operatore')
      .where(q => q.where('attivo', 'SI').orWhereNull('attivo').orWhere('attivo', ''))
      .andWhere(q => q.where('cestinato', 0).orWhereNull('cestinato'))
      .orderByRaw('ragione_sociale COLLATE NOCASE')
  ]);
  return righe.map(row => {
    const chiave = String(row.nome).trim().toLocaleLowerCase('it-IT');
    const clientiAttivi = clienti
      .filter(cliente => String(cliente.operatore || '').trim().toLocaleLowerCase('it-IT') === chiave)
      .map(cliente => ({ id: cliente.id, ragioneSociale: cliente.ragione_sociale }));
    return { ...row, attivo: Boolean(row.attivo), clientiAttivi };
  });
}

async function creaOperatore(nome) {
  await ensureTables();
  const pulito = String(nome || '').trim().replace(/\s+/g, ' ');
  if (!pulito) throw new Error('Inserisci il nome dell’operatore.');
  const presente = await knex('operatori').whereRaw('nome = ? COLLATE NOCASE', [pulito]).first();
  if (presente) {
    if (!presente.attivo) throw new Error('Operatore già presente ma cessato: riattivalo dalle impostazioni.');
    return presente;
  }
  return knex.transaction(async trx => {
    const [id] = await trx('operatori').insert({ nome: pulito, attivo: 1 });
    await trx('operatori_periodi').insert({ operatore_id: id, data_inizio: null, data_fine: null });
    return { id, nome: pulito, attivo: true, data_cessazione: null };
  });
}

async function validaOutbound(nome, precedente = '') {
  const pulito = String(nome || '').trim();
  if (!pulito || pulito.toLocaleLowerCase('it-IT') === String(precedente || '').trim().toLocaleLowerCase('it-IT')) return pulito;
  await ensureTables();
  const operatore = await knex('operatori').whereRaw('nome = ? COLLATE NOCASE', [pulito]).first();
  if (!operatore || !operatore.attivo) throw new Error('Seleziona un Outbound attivo da Impostazioni → Operatori.');
  return operatore.nome;
}

async function cessaOperatore(id, dataCessazione) {
  await ensureTables();
  const data = dataIso(dataCessazione, 'Data di cessazione');
  return knex.transaction(async trx => {
    const operatore = await trx('operatori').where({ id }).first();
    if (!operatore) throw new Error('Operatore non trovato.');
    if (!operatore.attivo) throw new Error('Operatore già cessato.');
    const periodo = await trx('operatori_periodi').where({ operatore_id: id }).whereNull('data_fine').orderBy('id', 'desc').first();
    if (periodo?.data_inizio && data < periodo.data_inizio) throw new Error('La cessazione non può precedere l’ultima riattivazione.');
    if (periodo) await trx('operatori_periodi').where({ id: periodo.id }).update({ data_fine: data });
    else await trx('operatori_periodi').insert({ operatore_id: id, data_inizio: null, data_fine: data });
    await trx('operatori').where({ id }).update({ attivo: 0, data_cessazione: data });
    return { success: true };
  });
}

async function riattivaOperatore(id, dataRiattivazione) {
  await ensureTables();
  const data = dataIso(dataRiattivazione, 'Data di riattivazione');
  return knex.transaction(async trx => {
    const operatore = await trx('operatori').where({ id }).first();
    if (!operatore) throw new Error('Operatore non trovato.');
    if (operatore.attivo) throw new Error('Operatore già attivo.');
    if (operatore.data_cessazione && data <= operatore.data_cessazione) throw new Error('La riattivazione deve essere successiva alla cessazione.');
    await trx('operatori_periodi').insert({ operatore_id: id, data_inizio: data, data_fine: null });
    await trx('operatori').where({ id }).update({ attivo: 1, data_cessazione: null });
    return { success: true };
  });
}

async function nomiAttiviNelMese(mese, anno) {
  await ensureTables();
  const ultimo = new Date(Date.UTC(Number(anno), Number(mese), 0)).getUTCDate();
  const inizio = `${anno}-${String(mese).padStart(2, '0')}-01`;
  const fine = `${anno}-${String(mese).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
  const righe = await knex('operatori as o').join('operatori_periodi as p', 'p.operatore_id', 'o.id')
    .where(q => q.whereNull('p.data_inizio').orWhere('p.data_inizio', '<=', fine))
    .andWhere(q => q.whereNull('p.data_fine').orWhere('p.data_fine', '>=', inizio))
    .distinct('o.nome');
  return new Set(righe.map(r => String(r.nome).trim().toLocaleLowerCase('it-IT')));
}

module.exports = { ensureTables, elencaOperatori, creaOperatore, validaOutbound, cessaOperatore, riattivaOperatore, nomiAttiviNelMese };
