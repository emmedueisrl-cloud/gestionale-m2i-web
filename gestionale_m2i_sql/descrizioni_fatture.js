const MESI = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];

function descrizionePredefinita(cliente, mese, anno) {
  const riferimento = cliente?.periodo_causale_fattura === 'corrente' ? 0 : -1;
  const data = new Date(Date.UTC(Number(anno), Number(mese) - 1 + riferimento, 1));
  const causale = String(cliente?.causale_fattura || 'SERVIZIO DI PULIZIA').trim();
  return `${causale} ${MESI[data.getUTCMonth()]} ${data.getUTCFullYear()}`;
}

async function initialize(db) {
  if (!await db.schema.hasColumn('clienti', 'causale_fattura')) {
    await db.raw("ALTER TABLE clienti ADD COLUMN causale_fattura TEXT NOT NULL DEFAULT 'SERVIZIO DI PULIZIA'");
  }
  if (!await db.schema.hasColumn('clienti', 'periodo_causale_fattura')) {
    await db.raw("ALTER TABLE clienti ADD COLUMN periodo_causale_fattura TEXT NOT NULL DEFAULT 'precedente'");
  }
  if (!await db.schema.hasTable('descrizioni_fatture_elaborati')) {
    await db.schema.createTable('descrizioni_fatture_elaborati', table => {
      table.text('tipo').notNullable();
      table.text('soggetto_id').notNullable();
      table.integer('mese').notNullable();
      table.integer('anno').notNullable();
      table.text('descrizione').notNullable();
      table.primary(['tipo', 'soggetto_id', 'mese', 'anno']);
    });
  }
  // Le fatture precedenti all'introduzione della descrizione non hanno una causale
  // archiviata: congela la proposta iniziale, così la scheda cliente non cambia lo storico.
  const periods = new Map();
  const addPeriod = row => periods.set(`${row.cliente_id}:${row.anno}:${row.mese}`, row);
  if (await db.schema.hasTable('fatture_inviate_elaborati')) {
    for (const row of await db('fatture_inviate_elaborati').select('cliente_id', 'mese', 'anno')) addPeriod(row);
  }
  if (await db.schema.hasTable('dettaglio_mesi_chiusi_clienti')) {
    for (const row of await db('dettaglio_mesi_chiusi_clienti').select('cliente_id', 'mese', 'anno')) addPeriod(row);
  }
  if (await db.schema.hasTable('fatture_aruba_elaborati')) {
    const registrations = await db('fatture_aruba_elaborati').select('*');
    const extraRegistrationIds = await db.schema.hasTable('gruppi_fatturazione_extra')
      ? new Set((await db('gruppi_fatturazione_extra').where({ tipo: 'extra' }).whereNotNull('fattura_registrazione_id')
        .select('fattura_registrazione_id')).map(row => Number(row.fattura_registrazione_id))) : new Set();
    for (const row of registrations) {
      if (extraRegistrationIds.has(Number(row.id)) || row.tipo_documento === 'TD04' || Number(row.importo_totale) < 0) continue;
      addPeriod(row);
    }
  }
  if (periods.size) {
    const clients = await db('clienti').select('*');
    const clientsById = new Map(clients.map(client => [String(client.id), client]));
    const descriptions = [...periods.values()].filter(row => clientsById.has(String(row.cliente_id)))
      .map(row => ({ tipo: 'cliente', soggetto_id: row.cliente_id, mese: row.mese, anno: row.anno,
        descrizione: descrizionePredefinita(clientsById.get(String(row.cliente_id)), row.mese, row.anno) }));
    for (let i = 0; i < descriptions.length; i += 100) {
      await db('descrizioni_fatture_elaborati').insert(descriptions.slice(i, i + 100))
        .onConflict(['tipo', 'soggetto_id', 'mese', 'anno']).ignore();
    }
  }
}

async function freezeMonthlyDescription(db, { clienteId, mese, anno }) {
  if (!await db.schema.hasTable('descrizioni_fatture_elaborati')) return;
  const client = await db('clienti').where({ id: clienteId }).first();
  if (!client) return;
  await db('descrizioni_fatture_elaborati').insert({ tipo: 'cliente', soggetto_id: clienteId,
    mese, anno, descrizione: descrizionePredefinita(client, mese, anno) })
    .onConflict(['tipo', 'soggetto_id', 'mese', 'anno']).ignore();
}

async function save(db, { tipo, soggettoId, mese, anno, descrizione }) {
  const m = Number(mese), y = Number(anno);
  const value = String(descrizione || '').trim();
  if (!['cliente', 'extra'].includes(tipo) || !soggettoId || !Number.isInteger(m) || m < 1 || m > 12 ||
      !Number.isInteger(y) || y < 2000 || y > 2100 || !value || value.length > 500) {
    throw new Error('Descrizione della fattura non valida (massimo 500 caratteri).');
  }
  return db.transaction(async trx => {
    if (tipo === 'cliente') {
      if (!await trx('clienti').where({ id: soggettoId }).first()) throw new Error('Cliente non trovato.');
      const invoiceQuery = trx('fatture_aruba_elaborati').where({ cliente_id: soggettoId, mese: m, anno: y });
      if (await trx.schema.hasTable('gruppi_fatturazione_extra')) {
        invoiceQuery.whereNotIn('id', trx('gruppi_fatturazione_extra').select('fattura_registrazione_id')
          .where({ cliente_id: soggettoId, mese: m, anno: y, tipo: 'extra' }).whereNotNull('fattura_registrazione_id'));
      }
      if (await trx('fatture_inviate_elaborati').where({ cliente_id: soggettoId, mese: m, anno: y }).first() ||
          await invoiceQuery.first()) {
        throw new Error('La fattura è già inviata o registrata.');
      }
    } else {
      const group = await trx('gruppi_fatturazione_extra').where({ id: soggettoId, mese: m, anno: y, tipo: 'extra' }).first();
      if (!group) throw new Error('Gruppo extra non trovato.');
      if (group.inviata_at || group.fattura_registrazione_id) throw new Error('La fattura extra è già inviata o registrata.');
    }
    await trx('descrizioni_fatture_elaborati').insert({ tipo, soggetto_id: soggettoId, mese: m, anno: y, descrizione: value })
      .onConflict(['tipo', 'soggetto_id', 'mese', 'anno']).merge({ descrizione: value });
    if (tipo === 'extra' && await trx.schema.hasTable('servizi_extra')) {
      const services = await trx('servizi_extra').where({ gruppo_id: soggettoId }).select('id');
      if (services.length === 1) await trx('servizi_extra').where({ id: services[0].id }).update({ descrizione_fattura: value });
    }
    return { descrizione: value };
  });
}

module.exports = { descrizionePredefinita, initialize, freezeMonthlyDescription, save };
