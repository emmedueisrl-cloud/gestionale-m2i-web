const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  // Update clienti sede_operativa
  db.run("UPDATE clienti SET sede_operativa = '[]' WHERE sede_operativa IS NULL", function(err) {
    if (err) console.error("Error updating clienti:", err);
    else console.log(`Updated ${this.changes} rows in clienti (sede_operativa).`);
  });

  // Update chiavi_assegnazioni orfane
  db.run(`
    UPDATE chiavi_assegnazioni 
    SET dipendente_id = NULL 
    WHERE dipendente_id IS NOT NULL 
    AND dipendente_id NOT IN (SELECT id FROM dipendenti)
  `, function(err) {
    if (err) console.error("Error updating chiavi_assegnazioni:", err);
    else console.log(`Updated ${this.changes} orphan rows in chiavi_assegnazioni.`);
  });
});
