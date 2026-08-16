const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  db.run("ALTER TABLE clienti ADD COLUMN quotazione_importo REAL", (err) => {
    if (err) console.log("Colonna quotazione_importo già esistente o errore:", err.message);
    else console.log("Colonna quotazione_importo aggiunta con successo.");
  });
  
  db.run("ALTER TABLE clienti ADD COLUMN quotazione_tipo TEXT", (err) => {
    if (err) console.log("Colonna quotazione_tipo già esistente o errore:", err.message);
    else console.log("Colonna quotazione_tipo aggiunta con successo.");
  });
});

db.close();
