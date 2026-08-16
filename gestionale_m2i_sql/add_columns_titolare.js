const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  const columns = [
    'titolare TEXT',
    'telefono_titolare TEXT',
    'ruolo_referente TEXT'
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
