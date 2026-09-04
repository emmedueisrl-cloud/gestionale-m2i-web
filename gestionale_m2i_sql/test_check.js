const { knex } = require('./db');
(async () => {
  try {
    const clienti = await knex('clienti').count('* as count').first();
    const dipendenti = await knex('dipendenti').count('* as count').first();
    const lastCliente = await knex('clienti').select('id', 'ragione_sociale').orderBy('id', 'desc').first();
    const lastDip = await knex('dipendenti').select('id', 'cognome', 'nome').orderBy('id', 'desc').first();
    console.log('Clienti totali nel DB locale:', clienti.count);
    console.log('Ultimo cliente:', lastCliente);
    console.log('Dipendenti totali nel DB locale:', dipendenti.count);
    console.log('Ultimo dipendente:', lastDip);
  } catch(e) { console.error(e); }
  process.exit();
})();
