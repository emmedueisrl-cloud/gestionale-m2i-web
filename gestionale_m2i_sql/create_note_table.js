const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

const sql = `CREATE TABLE IF NOT EXISTS note_elaborati (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  soggetto_id TEXT NOT NULL,
  mese INTEGER NOT NULL,
  anno INTEGER NOT NULL,
  testo TEXT DEFAULT '',
  data_modifica TEXT DEFAULT (datetime('now')),
  UNIQUE(tipo, soggetto_id, mese, anno)
)`;

db.run(sql, [], (err) => {
  if (err) console.error('ERRORE:', err.message);
  else console.log('Tabella note_elaborati creata con successo');
  db.close();
});
