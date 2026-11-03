async function ensureTipoCliente(knex) {
  if (!await knex.schema.hasColumn('clienti', 'tipo_cliente')) {
    await knex.schema.alterTable('clienti', table => {
      table.text('tipo_cliente').notNullable().defaultTo('PARTITA_IVA');
    });
  }

  const columns = await knex.raw("PRAGMA table_info('clienti')");
  if (columns.find(column => column.name === 'partita_iva')?.notnull) {
    // Knex rifiuta la ricostruzione se nel DB storico esistono FK orfane,
    // anche quando non riguardano clienti. Conserviamo e confrontiamo quelle
    // violazioni, senza crearne di nuove e senza modificare i dati esistenti.
    const connection = await knex.client.acquireConnection();
    const all = sql => new Promise((resolve, reject) =>
      connection.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
    const run = sql => new Promise((resolve, reject) =>
      connection.run(sql, error => error ? reject(error) : resolve()));
    let transactionOpen = false;
    try {
      const definition = (await all("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'clienti'"))[0]?.sql;
      if (!definition) throw new Error('Schema clienti non trovato.');
      const nullableDefinition = definition.replace(/(["`\[]?partita_iva["`\]]?\s+[^,]*?)\s+NOT\s+NULL\b/i, '$1');
      if (nullableDefinition === definition) throw new Error('Definizione partita IVA inattesa: migrazione interrotta.');
      const temporaryDefinition = nullableDefinition.replace(
        /^CREATE TABLE\s+["`\[]?clienti["`\]]?\s*\(/i,
        'CREATE TABLE "clienti_nullable_piva_migration" ('
      );
      if (temporaryDefinition === nullableDefinition) throw new Error('Definizione tabella clienti inattesa: migrazione interrotta.');
      const schemaObjects = await all("SELECT sql FROM sqlite_master WHERE tbl_name = 'clienti' AND type IN ('index', 'trigger') AND sql IS NOT NULL");
      const existingViolations = JSON.stringify((await all('PRAGMA foreign_key_check'))
        .map(row => Object.values(row)).sort());

      await run('PRAGMA foreign_keys = OFF');
      await run('BEGIN IMMEDIATE');
      transactionOpen = true;
      await run(temporaryDefinition);
      await run('INSERT INTO "clienti_nullable_piva_migration" SELECT * FROM "clienti"');
      await run('DROP TABLE "clienti"');
      await run('ALTER TABLE "clienti_nullable_piva_migration" RENAME TO "clienti"');
      for (const object of schemaObjects) await run(object.sql);
      const resultingViolations = JSON.stringify((await all('PRAGMA foreign_key_check'))
        .map(row => Object.values(row)).sort());
      if (resultingViolations !== existingViolations) {
        throw new Error('La migrazione altererebbe i collegamenti del database: annullata.');
      }
      await run('COMMIT');
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) await run('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      await run('PRAGMA foreign_keys = ON');
      await knex.client.releaseConnection(connection);
    }
  }
}

module.exports = { ensureTipoCliente };
