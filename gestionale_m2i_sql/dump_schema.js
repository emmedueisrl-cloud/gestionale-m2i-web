const sqlite3 = require('sqlite3');
const fs = require('fs');
const db = new sqlite3.Database('gestionale.db');
db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
  if (err) console.error(err);
  else fs.writeFileSync('db_schema_utf8.sql', rows.map(r => r.sql).join(';\n\n') + ';', 'utf8');
});
