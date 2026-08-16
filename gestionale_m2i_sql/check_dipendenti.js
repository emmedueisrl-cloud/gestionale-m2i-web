const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='dipendenti'", (err, row) => {
  console.log(row.sql);
  db.close();
});
