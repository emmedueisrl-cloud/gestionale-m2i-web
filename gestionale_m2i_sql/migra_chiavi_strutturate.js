const { knex } = require('./db');

async function run() {
  console.log('--- Migrazione Dati Chiavi Strutturate ---');
  
  // 1. Create table if not exists
  const tableExists = await knex.schema.hasTable('chiavi_assegnazioni');
  if (!tableExists) {
    console.log('Creazione tabella chiavi_assegnazioni...');
    await knex.schema.createTable('chiavi_assegnazioni', table => {
      table.increments('id').primary();
      table.string('cliente_id').notNullable().references('id').inTable('clienti').onDelete('CASCADE');
      table.string('dipendente_id').references('id').inTable('dipendenti').onDelete('SET NULL');
      table.string('assegnato_a_testo');
      table.integer('num_copia').notNullable().defaultTo(1);
      table.string('data_assegnazione').notNullable();
      table.string('modulo_cliente_path');
      table.string('modulo_dipendente_path');
      table.integer('attivo').defaultTo(1);
      table.string('data_restituzione');
      table.text('note');
    });
    console.log('Tabella creata con successo.');
  } else {
    console.log('Tabella chiavi_assegnazioni già esistente.');
  }

  // 2. Fetch all dipendenti to build a map for fuzzy matching
  const dipendenti = await knex('dipendenti').select('id', 'cognome', 'nome');
  const dipendentiMap = dipendenti.map(d => ({
    id: d.id,
    fullName: `${d.nome} ${d.cognome}`.toUpperCase(),
    reverseName: `${d.cognome} ${d.nome}`.toUpperCase(),
    firstName: d.nome.toUpperCase(),
    lastName: d.cognome.toUpperCase()
  }));

  function findDipendente(nomeStr) {
    if (!nomeStr) return null;
    const cleanStr = nomeStr.toUpperCase().trim();
    
    // Exact match
    const exact = dipendentiMap.find(d => d.fullName === cleanStr || d.reverseName === cleanStr);
    if (exact) return exact.id;

    // Partial match (if cleanStr is "MARISA", find employee named Marisa)
    const partial = dipendentiMap.find(d => d.firstName === cleanStr || d.lastName === cleanStr || d.firstName.startsWith(cleanStr) || d.fullName.includes(cleanStr));
    if (partial) return partial.id;

    return null;
  }

  // 3. Migrate data from clienti
  const clientiConChiavi = await knex('clienti').where('possesso_chiavi', 'SI');
  console.log(`Trovati ${clientiConChiavi.length} clienti con chiavi in possesso.`);
  
  const today = new Date().toISOString().split('T')[0];
  let migrateCount = 0;

  for (const c of clientiConChiavi) {
    // Check if assignments already exist for this client to avoid duplicates
    const existing = await knex('chiavi_assegnazioni').where('cliente_id', c.id);
    if (existing.length > 0) {
      continue; // Skip already migrated
    }

    const copie = c.copie || 1;
    const inPossessoDiRaw = c.in_possesso_di || '';
    
    // The previous implementation used split(',') or split('/') for possessors
    let possessori = [];
    if (inPossessoDiRaw) {
      if (inPossessoDiRaw.includes('/')) {
        possessori = inPossessoDiRaw.split('/').map(s => s.trim()).filter(Boolean);
      } else {
        possessori = inPossessoDiRaw.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Insert records
    for (let i = 0; i < copie; i++) {
      const nomeStr = possessori[i] || possessori[0] || 'UFFICIO';
      const dipId = nomeStr === 'UFFICIO' ? null : findDipendente(nomeStr);
      
      await knex('chiavi_assegnazioni').insert({
        cliente_id: c.id,
        dipendente_id: dipId,
        assegnato_a_testo: dipId ? null : nomeStr, // Save the raw text if no dipendente found, or if it's UFFICIO
        num_copia: i + 1,
        data_assegnazione: today,
        attivo: 1,
        note: c.note_chiavi || null
      });
      migrateCount++;
    }
  }

  console.log(`Migrazione completata. ${migrateCount} assegnazioni chiavi strutturate create.`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
