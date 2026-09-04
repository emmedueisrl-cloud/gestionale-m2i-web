const { knex } = require('./db');
knex('clienti').where('partita_iva', '05701431008').orWhere('ragione_sociale', 'FISIO.CAST SRL').first().then(console.log).catch(console.error).finally(() => process.exit());
