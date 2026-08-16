const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'gestionale.db');
const schemaPath = path.join(__dirname, 'schema.sql');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Errore di apertura database:", err.message);
    process.exit(1);
  }
  console.log("Database gestionale.db aperto/creato con successo.");
});

db.serialize(() => {
  // Abilita foreign keys
  db.run("PRAGMA foreign_keys = ON;", (err) => {
    if (err) console.error("Errore abilitazione foreign keys:", err.message);
  });

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  
  // Rimuove tutti i commenti SQL line-by-line
  const cleanSql = schemaSql.replace(/--.*$/gm, '');
  
  // Dividi per istruzioni SQL
  const statements = cleanSql
    .split(';')
    .map(st => st.trim())
    .filter(st => st.length > 0);

  console.log(`Esecuzione di ${statements.length} istruzioni SQL per la creazione dello schema...`);

  let count = 0;
  let hasErrors = false;

  statements.forEach((sql, idx) => {
    db.run(sql, (err) => {
      count++;
      if (err) {
        console.error(`Errore nell'istruzione SQL #${idx + 1}:`, err.message);
        console.error("Query incriminata:", sql);
        hasErrors = true;
      }
      
      if (count === statements.length) {
        db.close(() => {
          if (hasErrors) {
            console.error("Inizializzazione completata con errori!");
            process.exit(1);
          } else {
            console.log("Database inizializzato con successo con tutte le tabelle!");
            process.exit(0);
          }
        });
      }
    });
  });
});
