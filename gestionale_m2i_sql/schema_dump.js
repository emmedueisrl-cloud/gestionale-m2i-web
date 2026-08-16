const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');
db.all("SELECT name, sql FROM sqlite_master WHERE type='table';", (err, rows) => {
  if (err) throw err;
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
