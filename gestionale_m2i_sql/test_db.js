const { knex } = require('./db'); knex('agenda_caposquadra').columnInfo().then(console.log).catch(console.error).finally(() => process.exit());
