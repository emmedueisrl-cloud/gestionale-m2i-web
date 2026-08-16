const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  db.run("ALTER TABLE clienti ADD COLUMN nome_attivita TEXT", (err) => {
    if (err) console.log("Colonna nome_attivita già esistente o errore:", err.message);
    else console.log("Colonna nome_attivita aggiunta con successo.");
  });
});

db.close();
