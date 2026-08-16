const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.run("UPDATE m2i_azienda_dati SET timbro_path = 'uploads/azienda_m2i/timbro.png' WHERE id = 1", (err) => {
  if (err) console.error(err);
  else console.log("Timbro aggiornato.");
  db.close();
});
