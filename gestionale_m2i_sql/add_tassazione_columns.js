const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  db.run("ALTER TABLE clienti ADD COLUMN tipo_tassazione TEXT", (err) => {
    if (err) console.log("Colonna tipo_tassazione già esistente o errore:", err.message);
    else console.log("Colonna tipo_tassazione aggiunta con successo.");
  });
  
  db.run("ALTER TABLE clienti ADD COLUMN tassazione_altro TEXT", (err) => {
    if (err) console.log("Colonna tassazione_altro già esistente o errore:", err.message);
    else console.log("Colonna tassazione_altro aggiunta con successo.");
  });

  db.run("ALTER TABLE clienti ADD COLUMN percentuale_tassazione REAL", (err) => {
    if (err) console.log("Colonna percentuale_tassazione già esistente o errore:", err.message);
    else console.log("Colonna percentuale_tassazione aggiunta con successo.");
  });
});

db.close();
