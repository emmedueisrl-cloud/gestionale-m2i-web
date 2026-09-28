const sqlite3 = require('sqlite3');

const AI_TABLES = Object.freeze([
  'dipendenti', 'clienti', 'registro_ore', 'fatture', 'agenda_caposquadra', 'programma_fisso'
]);
const MAX_SOURCE_ROWS = 25000;
const MAX_RESULT_ROWS = 100;
const QUERY_TIMEOUT_MS = 3000;

function openMemoryDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(':memory:', error => error ? reject(error) : resolve(db));
  });
}

function run(db, sql, values = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, values, error => error ? reject(error) : resolve());
  });
}

function all(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

function close(db) {
  return new Promise(resolve => db.close(resolve));
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function executeReadOnlyAiQuery(query, sourceKnex) {
  if (typeof query !== 'string' || query.length > 4000 || !/^\s*SELECT\b/i.test(query)) {
    throw new Error('La query AI deve essere una SELECT valida e breve.');
  }

  const db = await openMemoryDatabase();
  try {
    for (const table of AI_TABLES) {
      if (!await sourceKnex.schema.hasTable(table)) continue;
      const columns = await sourceKnex.raw(`PRAGMA table_info(${quoteIdentifier(table)})`);
      const definition = columns.map(column => {
        const type = /^[A-Za-z0-9_ ()]*$/.test(column.type || '') ? column.type : 'TEXT';
        return `${quoteIdentifier(column.name)} ${type || 'TEXT'}`;
      }).join(', ');
      await run(db, `CREATE TABLE ${quoteIdentifier(table)} (${definition})`);

      const rows = await sourceKnex(table).select('*').limit(MAX_SOURCE_ROWS + 1);
      if (rows.length > MAX_SOURCE_ROWS) {
        throw new Error(`La tabella ${table} è troppo grande per il report AI.`);
      }
      if (!rows.length) continue;
      const names = columns.map(column => column.name);
      const insert = `INSERT INTO ${quoteIdentifier(table)} (${names.map(quoteIdentifier).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`;
      await run(db, 'BEGIN');
      try {
        for (const row of rows) await run(db, insert, names.map(name => row[name]));
        await run(db, 'COMMIT');
      } catch (error) {
        await run(db, 'ROLLBACK');
        throw error;
      }
    }

    await run(db, 'PRAGMA query_only = ON');
    const timeout = setTimeout(() => db.interrupt(), QUERY_TIMEOUT_MS);
    try {
      return await all(db, `SELECT * FROM (${query}) AS ai_result LIMIT ${MAX_RESULT_ROWS}`);
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    await close(db);
  }
}

module.exports = { executeReadOnlyAiQuery, AI_TABLES };
