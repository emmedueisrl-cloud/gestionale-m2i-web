const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  db.run("ALTER TABLE clienti ADD COLUMN email_secondaria TEXT", (err) => {
    if (err) console.log("Colonna email_secondaria già esistente o errore:", err.message);
    else console.log("Colonna email_secondaria aggiunta con successo.");
  });
});

db.close();
