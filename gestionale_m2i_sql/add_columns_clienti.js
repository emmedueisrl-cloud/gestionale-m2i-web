const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  const columns = [
    'codice_fiscale TEXT',
    'indirizzo_sede TEXT',
    'civico_sede TEXT',
    'cap TEXT',
    'citta TEXT',
    'provincia TEXT',
    'pec TEXT',
    'codice_sdi TEXT',
    'banca TEXT'
  ];

  columns.forEach(col => {
    db.run(`ALTER TABLE clienti ADD COLUMN ${col}`, (err) => {
      if (err) {
        if (!err.message.includes("duplicate column name")) {
          console.error("Errore aggiunta colonna", col, err);
        } else {
          console.log("Colonna già esistente:", col);
        }
      } else {
        console.log("Aggiunta colonna:", col);
      }
    });
  });
});

db.close();
