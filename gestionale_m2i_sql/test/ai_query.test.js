const test = require('node:test');
const assert = require('node:assert/strict');
const createKnex = require('knex');
const { executeReadOnlyAiQuery } = require('../ai_query');

test('le query AI leggono solo la copia delle tabelle autorizzate', async () => {
  const source = createKnex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  try {
    await source.schema.createTable('dipendenti', table => {
      table.string('id'); table.string('nome'); table.integer('ore');
    });
    await source.schema.createTable('configurazioni', table => {
      table.string('chiave'); table.string('valore');
    });
    await source('dipendenti').insert({ id: 'D0001', nome: 'Prova', ore: 8 });
    await source('configurazioni').insert({ chiave: 'gemini_api_key', valore: 'chiave-segreta-di-test' });

    assert.deepEqual(await executeReadOnlyAiQuery('SELECT nome, SUM(ore) AS totale FROM dipendenti GROUP BY nome', source),
      [{ nome: 'Prova', totale: 8 }]);
    await assert.rejects(executeReadOnlyAiQuery('SELECT valore FROM configurazioni', source), /no such table/i);
    await assert.rejects(executeReadOnlyAiQuery('DELETE FROM dipendenti', source), /SELECT valida/);
    await assert.rejects(executeReadOnlyAiQuery('SELECT * FROM dipendenti; DELETE FROM dipendenti', source));
    assert.equal((await source('dipendenti').count('* as count'))[0].count, 1);
  } finally {
    await source.destroy();
  }
});
