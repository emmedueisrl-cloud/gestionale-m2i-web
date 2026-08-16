const knex = require('knex')({client: 'sqlite3', connection: {filename: 'gestionale.db'}});
async function run() {
  await knex('programma_fisso').where('giorno_settimana', 'LunedǪ').orWhere('giorno_settimana', 'LUNEDI').update({ giorno_settimana: 'Lunedì' });
  await knex('programma_fisso').where('giorno_settimana', 'MartedǪ').orWhere('giorno_settimana', 'MARTEDI').update({ giorno_settimana: 'Martedì' });
  await knex('programma_fisso').where('giorno_settimana', 'MercoledǪ').orWhere('giorno_settimana', 'MERCOLEDI').update({ giorno_settimana: 'Mercoledì' });
  await knex('programma_fisso').where('giorno_settimana', 'GiovedǪ').orWhere('giorno_settimana', 'GIOVEDI').update({ giorno_settimana: 'Giovedì' });
  await knex('programma_fisso').where('giorno_settimana', 'VenerdǪ').orWhere('giorno_settimana', 'VENERDI').update({ giorno_settimana: 'Venerdì' });
  console.log('Fixed days with proper accents');
  process.exit(0);
}
run();
