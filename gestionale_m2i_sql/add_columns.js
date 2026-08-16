const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  db.run("ALTER TABLE clienti ADD COLUMN operatore TEXT", (err) => {
    if (err) console.log("Colonna operatore già esistente o errore:", err.message);
    else console.log("Colonna operatore aggiunta con successo.");
  });
  
  db.run("ALTER TABLE clienti ADD COLUMN commerciale TEXT", (err) => {
    if (err) console.log("Colonna commerciale già esistente o errore:", err.message);
    else console.log("Colonna commerciale aggiunta con successo.");
  });
});

db.close();
