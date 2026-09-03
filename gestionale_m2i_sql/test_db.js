const { knex } = require('./db'); knex('dipendenti').first().then(console.log).finally(() => process.exit());
