const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  db.run("ALTER TABLE dipendenti ADD COLUMN cestinato INTEGER DEFAULT 0", (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('Column already exists.');
      } else {
        console.error(err);
      }
    } else {
      console.log('Added cestinato column to dipendenti.');
    }
  });
});

db.close();
