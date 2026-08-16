const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'gestionale.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("PRAGMA foreign_keys = OFF;");

  db.run("DELETE FROM chiavi_assegnazioni WHERE cliente_id IS NOT NULL;");
  db.run("DELETE FROM registro_ore WHERE cliente_id IS NOT NULL;");
  db.run("DELETE FROM fatture WHERE cliente_id IS NOT NULL;");
  db.run("DELETE FROM programma_fisso WHERE cliente_id IS NOT NULL;");
  db.run("DELETE FROM agenda_caposquadra WHERE cliente_id IS NOT NULL;");
  db.run("DELETE FROM dettaglio_mesi_chiusi_clienti WHERE cliente_id IS NOT NULL;");
  db.run("DELETE FROM dettaglio_mesi_chiusi_provvigioni WHERE cliente_id IS NOT NULL;");
  db.run("DELETE FROM regolazioni_clienti WHERE cliente_id IS NOT NULL;");
  db.run("DELETE FROM regolazioni_provvigioni WHERE cliente_id IS NOT NULL;");

  db.run("DELETE FROM clienti;", function(err) {
    if (err) {
      console.error("Errore eliminazione clienti:", err.message);
    } else {
      console.log(`Eliminati tutti i clienti (${this.changes} righe) e i relativi dati collegati (chiavi, log, ecc).`);
    }
  });

  db.run("PRAGMA foreign_keys = ON;");
});

db.close();
