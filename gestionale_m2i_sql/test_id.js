const { knex } = require('./db');
knex('clienti').where('id', 'C178648830498152').first().then(console.log).catch(console.error).finally(() => process.exit());
