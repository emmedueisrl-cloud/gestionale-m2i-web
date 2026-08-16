const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');
db.run("ALTER TABLE registro_ore ADD COLUMN metodo_inserimento TEXT DEFAULT 'Calendarizzata'", (err) => {
  if (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('Column already exists');
    } else {
      console.error(err);
    }
  } else {
    console.log('Column added successfully');
  }
});
