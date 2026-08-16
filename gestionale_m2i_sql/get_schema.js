const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.all("PRAGMA table_info(clienti)", [], (err, rows) => {
  if (err) {
    throw err;
  }
  console.log(rows.map(r => r.name).join(', '));
});
db.close();
