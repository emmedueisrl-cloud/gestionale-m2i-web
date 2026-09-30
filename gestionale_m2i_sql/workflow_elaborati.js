const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { knex } = require('./db');
const elaborati = require('./controllers/elaborati');
const { calcolaCostoPersonalePerCliente, statoCostoPersonalePerCliente } = require('./costo_personale_clienti');
const { calcolaValoriContabilitaCliente } = require('./valori_contabilita_clienti');
const { reconcileRegistration, registrationStatuses } = require('./fatture_reconciliation');

const kinds = {
  cliente: { read: 'ottieniElaboratoClienti', id: 'idCliente', detail: 'dettaglio_mesi_chiusi_clienti', header: 'mesi_chiusi_clienti' },
  dipendente: { read: 'ottieniElaboratoMensile', id: 'idDipendente', detail: 'dettaglio_mesi_chiusi_dipendenti', header: 'mesi_chiusi_dipendenti' }
};

function period(tipo, mese, anno) {
  const cfg = kinds[tipo];
  const m = Number(mese), y = Number(anno);
  if (!cfg || !Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 2000 || y > 2100) {
    throw new Error('Tipo o periodo non valido.');
  }
  return { cfg, tipo, mese: m, anno: y };
}

async function initialize() {
  if (!await knex.schema.hasTable('periodi_elaborati')) {
    await knex.schema.createTable('periodi_elaborati', t => {
      t.string('tipo', 20).notNullable(); t.integer('mese').notNullable(); t.integer('anno').notNullable();
      t.text('elenco_confermato_at').notNullable(); t.primary(['tipo', 'mese', 'anno']);
    });
  }
  if (!await knex.schema.hasTable('righe_attese_elaborati')) {
    await knex.schema.createTable('righe_attese_elaborati', t => {
      t.string('tipo', 20).notNullable(); t.integer('mese').notNullable(); t.integer('anno').notNullable();
      t.string('soggetto_id').notNullable(); t.primary(['tipo', 'mese', 'anno', 'soggetto_id']);
    });
  }
  if (!await knex.schema.hasTable('righe_bloccate_elaborati')) {
    await knex.schema.createTable('righe_bloccate_elaborati', t => {
      t.string('tipo', 20).notNullable(); t.integer('mese').notNullable(); t.integer('anno').notNullable();
      t.string('soggetto_id').notNullable(); t.text('snapshot').notNullable(); t.text('bloccata_at').notNullable();
      t.primary(['tipo', 'mese', 'anno', 'soggetto_id']);
    });
  }
  if (!await knex.schema.hasTable('fatture_aruba_elaborati')) {
    await knex.schema.createTable('fatture_aruba_elaborati', t => {
      t.increments('id').primary(); t.string('cliente_id').notNullable().references('id').inTable('clienti').onDelete('RESTRICT'); t.integer('mese').notNullable(); t.integer('anno').notNullable();
      t.text('numero_fattura').notNullable(); t.text('data_fattura').notNullable(); t.decimal('importo_totale', 14, 2).notNullable();
      t.text('allegato_path'); t.text('registrata_at').notNullable(); t.integer('registrata_da');
      t.string('fattura_id').unique().references('id').inTable('fatture').onDelete('SET NULL');
      t.unique(['cliente_id', 'numero_fattura', 'data_fattura']);
    });
  }
  if (!await knex.schema.hasTable('fatture_inviate_elaborati')) {
    await knex.schema.createTable('fatture_inviate_elaborati', t => {
      t.string('cliente_id').notNullable().references('id').inTable('clienti').onDelete('RESTRICT');
      t.integer('mese').notNullable(); t.integer('anno').notNullable();
      t.text('inviata_at').notNullable(); t.integer('inviata_da');
      t.primary(['cliente_id', 'mese', 'anno']);
    });
  }
  if (!await knex.schema.hasColumn('fatture_aruba_elaborati', 'fattura_id')) {
    // ALTER TABLE diretto: Knex ricostruirebbe la tabella e fallirebbe sui vecchi FK orfani.
    await knex.raw('ALTER TABLE fatture_aruba_elaborati ADD COLUMN fattura_id TEXT REFERENCES fatture(id) ON DELETE SET NULL');
  }
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_fatture_aruba_fattura_id ON fatture_aruba_elaborati(fattura_id)');
  if (!await knex.schema.hasTable('rettifiche_fatture_aruba')) {
    await knex.schema.createTable('rettifiche_fatture_aruba', t => {
      t.increments('id').primary(); t.integer('registrazione_id').notNullable().references('id').inTable('fatture_aruba_elaborati').onDelete('RESTRICT');
      t.text('precedente').notNullable(); t.text('successivo').notNullable();
      t.text('fonte').notNullable(); t.text('rettificata_at').notNullable(); t.integer('rettificata_da');
    });
  }
  const unlinked = await knex('fatture_aruba_elaborati').whereNull('fattura_id');
  for (const record of unlinked) await reconcileRegistration(knex, record);
  if (!await knex.schema.hasTable('pagamenti_elaborati_dipendenti')) {
    await knex.schema.createTable('pagamenti_elaborati_dipendenti', t => {
      t.increments('id').primary(); t.string('dipendente_id').notNullable().references('id').inTable('dipendenti').onDelete('RESTRICT'); t.integer('mese').notNullable(); t.integer('anno').notNullable();
      t.decimal('importo_netto', 14, 2).notNullable(); t.text('pagato_at').notNullable(); t.integer('registrato_da');
      t.unique(['dipendente_id', 'mese', 'anno']);
    });
  }
  const frozen = (alias, tipo, id) => `${alias}.${id} IS NOT NULL AND (EXISTS (SELECT 1 FROM righe_bloccate_elaborati b
    WHERE b.tipo='${tipo}' AND b.mese=${alias}.mese AND b.anno=${alias}.anno AND b.soggetto_id=${alias}.${id})
    OR EXISTS (SELECT 1 FROM ${kinds[tipo].header} h WHERE h.mese=${alias}.mese AND h.anno=${alias}.anno))`;
  for (const [table, checks] of [
    ['registro_ore', [['dipendente', 'dipendente_id'], ['cliente', 'cliente_id']]],
    ['regolazioni_stipendi', [['dipendente', 'dipendente_id']]],
    ['regolazioni_clienti', [['cliente', 'cliente_id']]]
  ]) {
    if (!await knex.schema.hasTable(table)) continue;
    for (const action of ['INSERT', 'UPDATE', 'DELETE']) {
      const aliases = action === 'UPDATE' ? ['OLD', 'NEW'] : [action === 'DELETE' ? 'OLD' : 'NEW'];
      const condition = aliases.flatMap(alias => checks.map(([type, id]) => `(${frozen(alias, type, id)})`)).join(' OR ');
      await knex.raw(`DROP TRIGGER IF EXISTS blocco_${table}_${action.toLowerCase()}`);
      await knex.raw(`CREATE TRIGGER blocco_${table}_${action.toLowerCase()}
        BEFORE ${action} ON ${table} WHEN ${condition}
        BEGIN SELECT RAISE(ABORT, 'Riga elaborato blindata: modifica non consentita'); END`);
    }
  }
}

async function expected(tipo, mese, anno, trx = knex) {
  const confirmed = await trx('periodi_elaborati').where({ tipo, mese, anno }).first();
  const rows = confirmed ? await trx('righe_attese_elaborati').where({ tipo, mese, anno }).select('soggetto_id') : [];
  return { confirmed: Boolean(confirmed), ids: rows.map(r => r.soggetto_id) };
}

async function confirmRoster(tipo, mese, anno, ids) {
  const p = period(tipo, mese, anno);
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    throw new Error('Conferma un elenco non vuoto e senza duplicati.');
  }
  const current = await elaborati[p.cfg.read](p.mese, p.anno);
  if (current.chiuso) throw new Error('Mese già chiuso.');
  const available = new Set(current.dati.map(r => r[p.cfg.id]));
  if (ids.length !== available.size || ids.some(id => !available.has(id))) {
    throw new Error('L’elenco deve contenere tutte e sole le righe attualmente visibili nell’elaborato.');
  }
  await knex.transaction(async trx => {
    const locked = await trx('righe_bloccate_elaborati').where({ tipo, mese: p.mese, anno: p.anno }).select('soggetto_id');
    const previous = await expected(tipo, p.mese, p.anno, trx);
    if (locked.length && previous.ids.some(id => !ids.includes(id))) throw new Error('Dopo la prima blindatura puoi aggiungere righe previste, ma non rimuoverle.');
    if (locked.some(r => !ids.includes(r.soggetto_id))) throw new Error('Non puoi escludere una riga già blindata.');
    await trx('righe_attese_elaborati').where({ tipo, mese: p.mese, anno: p.anno }).del();
    await trx('periodi_elaborati').insert({ tipo, mese: p.mese, anno: p.anno, elenco_confermato_at: new Date().toISOString() })
      .onConflict(['tipo', 'mese', 'anno']).merge({ elenco_confermato_at: new Date().toISOString() });
    await trx('righe_attese_elaborati').insert(ids.map(soggetto_id => ({ tipo, mese: p.mese, anno: p.anno, soggetto_id })));
  });
  return { confermato: true, righe: ids.length };
}

function detailSnapshot(tipo, mese, anno, row, timestamp) {
  if (tipo === 'cliente') return {
    mese, anno, cliente_id: row.idCliente, ragione_sociale: row.ragioneSociale,
    valore_contrattuale: row.tariffaOraria, ore_lavorate: row.oreLavorate, base_imponibile: row.baseImponibile,
    maggiorazioni: row.maggiorazioni, sconti: row.sconti, imponibile: row.imponibile,
    importo_iva: row.importoIva, importo_totale: row.importoTotale,
    nota_fissa_storica: row.notaFissa || '', nota_mensile_storica: row.notaMensile || '',
    data_chiusura: timestamp, chiuso_da: 'LocalServer'
  };
  return {
    mese, anno, dipendente_id: row.idDipendente, cognome_nome: row.cognomeNome,
    paga_oraria_reale: row.pagaOraria, ore_lavorate: row.oreLavorate, paga_lavorato: row.pagaLavorato,
    paga_ferie_permessi_malattia: row.pagaFPM || 0, maggiorazioni: row.maggiorazioni,
    detrazioni: row.detrazioni, stipendio_netto: row.stipendioNetto,
    nota_fissa_storica: row.notaFissa || '', nota_mensile_storica: row.notaMensile || '',
    data_chiusura: timestamp, chiuso_da: 'LocalServer'
  };
}

async function lockRow(tipo, mese, anno, subjectId) {
  const p = period(tipo, mese, anno);
  if (typeof subjectId !== 'string' || !subjectId) throw new Error('Riga non valida.');
  return knex.transaction(async trx => {
    const current = await elaborati[p.cfg.read](p.mese, p.anno, trx);
    if (current.chiuso) throw new Error('Il mese è già chiuso.');
    const row = current.dati.find(r => r[p.cfg.id] === subjectId);
    if (!row) throw new Error('Riga non presente nell’elaborato.');
    const now = new Date().toISOString();
    const roster = await expected(tipo, p.mese, p.anno, trx);
    if (!roster.confirmed || !roster.ids.includes(subjectId)) throw new Error('Conferma prima l’elenco completo delle righe previste.');
    if (await trx('righe_bloccate_elaborati').where({ tipo, mese: p.mese, anno: p.anno, soggetto_id: subjectId }).first()) {
      throw new Error('Riga già blindata.');
    }
    await trx('righe_bloccate_elaborati').insert({ tipo, mese: p.mese, anno: p.anno, soggetto_id: subjectId, snapshot: JSON.stringify(row), bloccata_at: now });
    const locked = await trx('righe_bloccate_elaborati').where({ tipo, mese: p.mese, anno: p.anno });
    const allLocked = roster.ids.every(id => locked.some(r => r.soggetto_id === id));
    if (allLocked) {
      const currentIds = new Set(current.dati.map(r => r[p.cfg.id]));
      if (currentIds.size !== roster.ids.length || roster.ids.some(id => !currentIds.has(id))) {
        throw new Error('L’elenco è cambiato dopo la conferma: aggiornalo prima di chiudere il mese.');
      }
      await trx(p.cfg.header).insert({ mese: p.mese, anno: p.anno, stato: 'Chiuso', data_chiusura: now, chiuso_da: 'LocalServer' });
      for (const item of locked) {
        await trx(p.cfg.detail).insert(detailSnapshot(tipo, p.mese, p.anno, JSON.parse(item.snapshot), item.bloccata_at));
      }
    }
    return { bloccata: true, meseChiuso: allLocked };
  });
}

async function unlockRow(tipo, mese, anno, subjectId) {
  const p = period(tipo, mese, anno);
  return knex.transaction(async trx => {
    const header = await trx(p.cfg.header).where({ mese: p.mese, anno: p.anno }).first();
    const row = await trx('righe_bloccate_elaborati').where({ tipo, mese: p.mese, anno: p.anno, soggetto_id: subjectId }).first();
    if (!row) throw new Error('Riga non blindata con il nuovo flusso: per i mesi storici usa lo sblocco del mese.');
    if (Date.now() - Date.parse(row.bloccata_at) > 30 * 86400000) throw new Error('Sono trascorsi più di 30 giorni dalla blindatura.');
    if (tipo === 'cliente' && await trx('fatture_aruba_elaborati').where({ cliente_id: subjectId, mese: p.mese, anno: p.anno }).first()) {
      throw new Error('Fattura registrata: questo cliente non può più essere sblindato.');
    }
    if (tipo === 'cliente' && await trx('fatture_inviate_elaborati').where({ cliente_id: subjectId, mese: p.mese, anno: p.anno }).first()) {
      throw new Error('Fattura inviata: questo cliente non può più essere sblindato.');
    }
    if (tipo === 'dipendente' && await trx('pagamenti_elaborati_dipendenti').where({ dipendente_id: subjectId, mese: p.mese, anno: p.anno }).first()) {
      throw new Error('Riga già pagata: prima occorre una procedura di rettifica.');
    }
    if (header) {
      const detailCount = await trx(p.cfg.detail).where({ mese: p.mese, anno: p.anno }).count('* as count').first();
      const lockCount = await trx('righe_bloccate_elaborati').where({ tipo, mese: p.mese, anno: p.anno }).count('* as count').first();
      if (Number(detailCount.count) !== Number(lockCount.count)) throw new Error('Lo storico non corrisponde alle righe blindate: sblocco puntuale non sicuro.');
      await trx(p.cfg.detail).where({ mese: p.mese, anno: p.anno }).del();
      await trx(p.cfg.header).where({ mese: p.mese, anno: p.anno }).del();
    }
    await trx('righe_bloccate_elaborati').where({ tipo, mese: p.mese, anno: p.anno, soggetto_id: subjectId }).del();
    return { sbloccata: true, meseRiaperto: Boolean(header) };
  });
}

async function lockedRows(tipo, mese, anno, connection = knex) {
  const p = period(tipo, mese, anno);
  const header = await connection(p.cfg.header).where({ mese: p.mese, anno: p.anno }).first();
  const rows = await connection('righe_bloccate_elaborati').where({ tipo, mese: p.mese, anno: p.anno });
  if (header) {
    const history = (await elaborati[p.cfg.read](p.mese, p.anno, connection)).dati;
    const snapshots = new Map(rows.map(r => [r.soggetto_id, JSON.parse(r.snapshot)]));
    return history.map(r => ({ ...r, ...(snapshots.get(r[p.cfg.id]) || {}) }));
  }
  return rows.map(r => JSON.parse(r.snapshot));
}

async function status(tipo, mese, anno) {
  const p = period(tipo, mese, anno);
  const roster = await expected(tipo, p.mese, p.anno);
  const locked = await knex('righe_bloccate_elaborati').where({ tipo, mese: p.mese, anno: p.anno }).select('soggetto_id');
  return { elencoConfermato: roster.confirmed, attesi: roster.ids, bloccati: locked.map(r => r.soggetto_id) };
}

async function accountingRows(tipo, mese, anno) {
  const p = period(tipo, mese, anno);
  return knex.transaction(async trx => {
    const rows = await lockedRows(tipo, p.mese, p.anno, trx);
    const header = await trx(p.cfg.header).where({ mese: p.mese, anno: p.anno }).first();
    const frozenIds = new Set((await trx('righe_bloccate_elaborati').where({ tipo, mese: p.mese, anno: p.anno }).select('soggetto_id')).map(r => r.soggetto_id));
    if (tipo === 'cliente') {
      const invoices = await registrationStatuses(trx, await trx('fatture_aruba_elaborati').where({ mese: p.mese, anno: p.anno }).orderBy('id'));
      const sent = await trx('fatture_inviate_elaborati').where({ mese: p.mese, anno: p.anno });
      const sentByClient = new Map(sent.map(item => [item.cliente_id, item.inviata_at]));
      const dipendenti = (await elaborati.ottieniElaboratoMensile(p.mese, p.anno, trx)).dati;
      const oreRegistrate = await trx('registro_ore').select('dipendente_id', 'cliente_id', 'ore_totali', 'causale_assenza').where({ mese: p.mese, anno: p.anno });
      const costiPersonale = calcolaCostoPersonalePerCliente(dipendenti, oreRegistrate);
      const statoCosti = statoCostoPersonalePerCliente(dipendenti, oreRegistrate);
      return rows.map(row => {
        const linked = invoices.filter(f => f.cliente_id === row.idCliente).map(f => ({ id: f.id, numero: f.numero_fattura, data: f.data_fattura, importo: Number(f.importo_totale), registrataAt: f.registrata_at, allegato: Boolean(f.allegato_path), statoRiconciliazione: f.stato_riconciliazione }));
        const actual = linked.reduce((sum, f) => sum + f.importo, 0);
        const importi = calcolaValoriContabilitaCliente(row, costiPersonale.get(String(row.idCliente)) || 0);
        return { ...row, ...importi, costoPersonaleDefinitivo: statoCosti.get(String(row.idCliente)) !== false, storicoPreesistente: Boolean(header && !frozenIds.has(row.idCliente)), fatture: linked, fatturaInviataAt: sentByClient.get(row.idCliente) || null, importoRealmenteFatturato: actual, differenza: linked.length ? Number((actual - Number(row.importoTotale || 0)).toFixed(2)) : null };
      });
    }
    const payments = await trx('pagamenti_elaborati_dipendenti').where({ mese: p.mese, anno: p.anno });
    return rows.map(row => {
      const payment = payments.find(x => x.dipendente_id === row.idDipendente);
      return { ...row, storicoPreesistente: Boolean(header && !frozenIds.has(row.idDipendente)), pagamento: payment ? { pagatoAt: payment.pagato_at, importo: Number(payment.importo_netto) } : null };
    });
  });
}

async function markInvoiceSent({ mese, anno, clienteId, userId }) {
  const p = period('cliente', mese, anno);
  if (typeof clienteId !== 'string' || !clienteId) throw new Error('Cliente non valido.');
  return knex.transaction(async trx => {
    const row = (await lockedRows('cliente', p.mese, p.anno, trx)).find(item => item.idCliente === clienteId);
    if (!row) throw new Error('Riga cliente non blindata.');
    const sentAt = new Date().toISOString();
    await trx('fatture_inviate_elaborati').insert({ cliente_id: clienteId, mese: p.mese, anno: p.anno, inviata_at: sentAt, inviata_da: userId })
      .onConflict(['cliente_id', 'mese', 'anno']).ignore();
    const saved = await trx('fatture_inviate_elaborati').where({ cliente_id: clienteId, mese: p.mese, anno: p.anno }).first();
    return { fatturaInviataAt: saved.inviata_at };
  });
}

async function registerInvoice({ mese, anno, clienteId, numero, dataFattura, importo, userId, file, confermaStorico }) {
  const p = period('cliente', mese, anno);
  const row = (await lockedRows('cliente', p.mese, p.anno)).find(r => r.idCliente === clienteId);
  if (!row) throw new Error('Riga cliente non blindata.');
  const legacy = await knex(p.cfg.header).where({ mese: p.mese, anno: p.anno }).first() &&
    !await knex('righe_bloccate_elaborati').where({ tipo: 'cliente', mese: p.mese, anno: p.anno, soggetto_id: clienteId }).first();
  if (legacy && confermaStorico !== 'true') throw new Error('Conferma esplicitamente il controllo della fattura storica.');
  if (typeof numero !== 'string' || !numero.trim() || numero.trim().length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(dataFattura || '')) {
    throw new Error('Numero e data Aruba obbligatori.');
  }
  const invoiceDate = new Date(`${dataFattura}T00:00:00Z`);
  if (!Number.isFinite(invoiceDate.getTime()) || invoiceDate.toISOString().slice(0, 10) !== dataFattura) throw new Error('Data fattura non valida.');
  const amount = Number(importo);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) throw new Error('Importo fatturato non valido.');
  if (file) {
    const ext = path.extname(file.originalname).toLowerCase();
    const start = file.buffer.subarray(0, 128).toString('utf8').replace(/^\uFEFF/, '').trimStart();
    if (!['.pdf', '.xml'].includes(ext) || (ext === '.pdf' && !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) ||
        (ext === '.xml' && !start.startsWith('<?xml') && !start.startsWith('<'))) {
      throw new Error('Allegato non valido: è richiesto un PDF o XML autentico.');
    }
  }
  const dataDir = process.env.DATA_DIR;
  if (file && !dataDir) throw new Error('DATA_DIR richiesto per conservare l’allegato.');
  let relative = null, absolute = null;
  if (file) {
    relative = path.join('uploads', 'fatture_aruba', crypto.randomUUID() + path.extname(file.originalname).toLowerCase());
    absolute = path.join(dataDir, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, file.buffer, { flag: 'wx' });
  }
  try {
    const result = await knex.transaction(async trx => {
      const stillLocked = await trx('righe_bloccate_elaborati').where({ tipo: 'cliente', mese: p.mese, anno: p.anno, soggetto_id: clienteId }).first();
      const historical = !stillLocked && await trx(p.cfg.header).where({ mese: p.mese, anno: p.anno }).first() &&
        await trx(p.cfg.detail).where({ mese: p.mese, anno: p.anno, cliente_id: clienteId }).first();
      if (!stillLocked && !historical) throw new Error('Riga cliente sblindata: aggiorna l’elaborato prima di registrare la fattura.');
      const record = { cliente_id: clienteId, mese: p.mese, anno: p.anno, numero_fattura: numero.trim(), data_fattura: dataFattura, importo_totale: Math.round(amount * 100) / 100, allegato_path: relative, registrata_at: new Date().toISOString(), registrata_da: userId };
      const [id] = await trx('fatture_aruba_elaborati').insert(record);
      return { id, ...await reconcileRegistration(trx, { ...record, id }) };
    });
    return { ...result, differenza: Number(((await accountingRows('cliente', p.mese, p.anno)).find(r => r.idCliente === clienteId).differenza).toFixed(2)) };
  } catch (error) {
    if (absolute) fs.rmSync(absolute, { force: true });
    throw error;
  }
}

async function registerPayment({ mese, anno, dipendenteId, userId, confermaStorico }) {
  const p = period('dipendente', mese, anno);
  const row = (await lockedRows('dipendente', p.mese, p.anno)).find(r => r.idDipendente === dipendenteId);
  if (!row) throw new Error('Riga dipendente non blindata.');
  const legacy = await knex(p.cfg.header).where({ mese: p.mese, anno: p.anno }).first() &&
    !await knex('righe_bloccate_elaborati').where({ tipo: 'dipendente', mese: p.mese, anno: p.anno, soggetto_id: dipendenteId }).first();
  if (legacy && confermaStorico !== true) throw new Error('Conferma esplicitamente il controllo del pagamento storico.');
  const net = Number(row.stipendioNetto);
  if (!Number.isFinite(net) || net <= 0) throw new Error('Nessun importo positivo da pagare: pagamento non registrato.');
  const [id] = await knex('pagamenti_elaborati_dipendenti').insert({ dipendente_id: dipendenteId, mese: p.mese, anno: p.anno, importo_netto: net, pagato_at: new Date().toISOString(), registrato_da: userId });
  return { id };
}

module.exports = { initialize, confirmRoster, lockRow, unlockRow, lockedRows, status, accountingRows, markInvoiceSent, registerInvoice, registerPayment, period };
