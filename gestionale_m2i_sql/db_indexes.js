const INDEXES = Object.freeze([
  ['idx_registro_ore_dipendente_periodo', 'registro_ore', ['dipendente_id', 'mese', 'anno']],
  ['idx_registro_ore_cliente_periodo', 'registro_ore', ['cliente_id', 'mese', 'anno']],
  ['idx_fatture_cliente', 'fatture', ['cliente_id']],
  ['idx_agenda_cliente', 'agenda_caposquadra', ['cliente_id']],
  ['idx_programma_cliente', 'programma_fisso', ['cliente_id']],
  ['idx_proroghe_dipendente', 'proroghe_contratti', ['dipendente_id']],
  ['idx_buste_dipendente_periodo', 'buste_paga', ['dipendente_id', 'mese', 'anno']],
  ['idx_buste_periodo', 'buste_paga', ['anno', 'mese']],
  ['idx_emails_cartella_data', 'emails', ['cartella', 'data_invio']]
]);

async function ensureIndexes(knex) {
  for (const [name, table, columns] of INDEXES) {
    if (!await knex.schema.hasTable(table)) continue;
    const present = await Promise.all(columns.map(column => knex.schema.hasColumn(table, column)));
    if (!present.every(Boolean)) continue;
    await knex.raw(`CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${columns.map(column => `"${column}"`).join(', ')})`);
  }
}

module.exports = { ensureIndexes, INDEXES };
