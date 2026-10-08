const { calcolaImportiFatturaCliente } = require('./valori_contabilita_clienti');

const conRitenuta = value => ['TRAT. ACC.', 'TRATTENUTA ACCONTO']
  .includes(String(value || '').trim().toUpperCase());
const validAmount = value => value !== null && value !== undefined && Number.isFinite(Number(value));
const cents = value => Math.round(Number(value || 0) * 100);
const keyOf = (clienteId, mese, anno) => `${clienteId}:${anno}:${mese}`;

async function ricalcolaRitenutaStorica(knex) {
  if (!await knex.schema.hasTable('righe_bloccate_elaborati') ||
    !await knex.schema.hasTable('dettaglio_mesi_chiusi_clienti')) return { righe: 0, dettagli: 0 };
  if (!await knex.schema.hasTable('rettifiche_ritenuta_elaborati')) {
    await knex.schema.createTable('rettifiche_ritenuta_elaborati', table => {
      table.increments('id').primary();
      table.text('cliente_id').notNullable(); table.integer('mese').notNullable(); table.integer('anno').notNullable();
      table.text('origine').notNullable(); table.float('imponibile').notNullable();
      table.float('iva_precedente'); table.float('totale_precedente');
      table.float('iva_nuova').notNullable(); table.float('ritenuta_nuova').notNullable();
      table.float('totale_nuovo').notNullable(); table.text('rettificata_at').notNullable();
    });
  }

  return knex.transaction(async trx => {
    const [frozen, closed, clients] = await Promise.all([
      trx('righe_bloccate_elaborati').where({ tipo: 'cliente' }),
      trx('dettaglio_mesi_chiusi_clienti'),
      trx('clienti').select('id', 'tipo_tassazione')
    ]);
    const clientRegime = new Map(clients.map(client => [String(client.id), client.tipo_tassazione]));
    const snapshots = new Map();
    let righe = 0, dettagli = 0;
    const audit = async (clienteId, mese, anno, origine, imponibile, previousIva, previousTotal, next) => {
      await trx('rettifiche_ritenuta_elaborati').insert({ cliente_id: clienteId, mese, anno, origine,
        imponibile: Number(imponibile), iva_precedente: previousIva == null ? null : Number(previousIva),
        totale_precedente: previousTotal == null ? null : Number(previousTotal), iva_nuova: next.importoIva,
        ritenuta_nuova: next.importoRitenuta, totale_nuovo: next.importoTotale,
        rettificata_at: new Date().toISOString() });
    };

    for (const record of frozen) {
      let snapshot;
      try { snapshot = JSON.parse(record.snapshot); } catch { continue; }
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) continue;
      snapshots.set(keyOf(record.soggetto_id, record.mese, record.anno), snapshot);
      const regime = snapshot.tipoTassazione || clientRegime.get(String(record.soggetto_id));
      if (!conRitenuta(regime) || !validAmount(snapshot.imponibile)) continue;
      const next = calcolaImportiFatturaCliente(Number(snapshot.imponibile), regime);
      if (cents(snapshot.importoIva) === cents(next.importoIva) &&
        cents(snapshot.importoTotale) === cents(next.importoTotale) &&
        cents(snapshot.importoRitenuta) === cents(next.importoRitenuta)) continue;
      await audit(record.soggetto_id, record.mese, record.anno, 'riga_blindata',
        snapshot.imponibile, snapshot.importoIva, snapshot.importoTotale, next);
      await trx('righe_bloccate_elaborati').where({ tipo: 'cliente', soggetto_id: record.soggetto_id,
        mese: record.mese, anno: record.anno }).update({ snapshot: JSON.stringify({ ...snapshot, ...next }) });
      righe++;
    }

    for (const record of closed) {
      const snapshot = snapshots.get(keyOf(record.cliente_id, record.mese, record.anno));
      const regime = snapshot?.tipoTassazione || clientRegime.get(String(record.cliente_id));
      if (!conRitenuta(regime) || !validAmount(record.imponibile)) continue;
      const next = calcolaImportiFatturaCliente(Number(record.imponibile), regime);
      if (cents(record.importo_iva) === cents(next.importoIva) &&
        cents(record.importo_totale) === cents(next.importoTotale)) continue;
      await audit(record.cliente_id, record.mese, record.anno, 'mese_chiuso',
        record.imponibile, record.importo_iva, record.importo_totale, next);
      await trx('dettaglio_mesi_chiusi_clienti').where({ id: record.id })
        .update({ importo_iva: next.importoIva, importo_totale: next.importoTotale });
      dettagli++;
    }
    return { righe, dettagli };
  });
}

module.exports = { ricalcolaRitenutaStorica };
