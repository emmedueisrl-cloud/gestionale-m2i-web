async function ensureTipoCliente(knex) {
  if (!await knex.schema.hasColumn('clienti', 'tipo_cliente')) {
    await knex.schema.alterTable('clienti', table => {
      table.text('tipo_cliente').notNullable().defaultTo('PARTITA_IVA');
    });
  }

  const columns = await knex.raw("PRAGMA table_info('clienti')");
  if (columns.find(column => column.name === 'partita_iva')?.notnull) {
    // SQLite ricrea la tabella; Knex conserva gli indici e verifica le chiavi esterne.
    await knex.schema.alterTable('clienti', table => {
      table.text('partita_iva').nullable().alter();
    });
  }
}

module.exports = { ensureTipoCliente };
