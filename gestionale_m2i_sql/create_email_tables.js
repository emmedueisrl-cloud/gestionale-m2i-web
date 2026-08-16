const { knex } = require('./db');

async function createEmailTables() {
  try {
    console.log("Creazione tabella configurazione_email...");
    await knex.raw(`
      CREATE TABLE IF NOT EXISTS configurazione_email (
        chiave TEXT PRIMARY KEY,
        valore TEXT NOT NULL
      )
    `);

    console.log("Creazione tabella emails...");
    await knex.raw(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        data_invio TEXT NOT NULL,
        mittente TEXT NOT NULL,
        destinatario TEXT NOT NULL,
        oggetto TEXT NOT NULL,
        corpo TEXT NOT NULL,
        tipo TEXT NOT NULL,
        stato TEXT NOT NULL,
        id_dipendente TEXT,
        id_cliente TEXT,
        cartella TEXT DEFAULT 'inbox',
        letto INTEGER DEFAULT 0,
        preferito INTEGER DEFAULT 0,
        data_posticipato TEXT,
        allegati TEXT,
        FOREIGN KEY (id_dipendente) REFERENCES dipendenti(id) ON DELETE SET NULL,
        FOREIGN KEY (id_cliente) REFERENCES clienti(id) ON DELETE SET NULL
      )
    `);
    
    console.log("Tabelle email create con successo.");
    process.exit(0);
  } catch (err) {
    console.error("Errore durante la creazione delle tabelle email:", err);
    process.exit(1);
  }
}

createEmailTables();
