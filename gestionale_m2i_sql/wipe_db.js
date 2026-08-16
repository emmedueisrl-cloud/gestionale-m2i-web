const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'gestionale.db');
const db = new sqlite3.Database(dbPath);

const tablesToEmpty = [
  'dettaglio_mesi_chiusi_provvigioni',
  'mesi_chiusi_provvigioni',
  'dettaglio_mesi_chiusi_clienti',
  'mesi_chiusi_clienti',
  'dettaglio_mesi_chiusi_dipendenti',
  'mesi_chiusi_dipendenti',
  'regolazioni_provvigioni',
  'regolazioni_clienti',
  'regolazioni_stipendi',
  'log_attivita',
  'crm_preventivi_commerciali',
  'crm_appuntamenti_commerciali',
  'crm_pipeline',
  'crm_commerciali',
  'crm_outbound',
  'preventivi',
  'agenda_caposquadra',
  'programma_fisso',
  'buste_paga',
  'fatture',
  'registro_ore',
  'cessazioni',
  'trasformazioni_indeterminato',
  'proroghe',
  'clienti',
  'dipendenti'
];

db.serialize(() => {
  db.run("PRAGMA foreign_keys = OFF;");
  
  tablesToEmpty.forEach(table => {
    db.run(`DELETE FROM ${table};`, (err) => {
      if (err) console.error(`Errore svuotando ${table}:`, err.message);
      else console.log(`Tabella ${table} svuotata con successo.`);
    });
  });

  // Resetta i contatori autoincrement
  db.run("DELETE FROM sqlite_sequence;", (err) => {
    if (err) console.error("Errore reset sqlite_sequence:", err.message);
    else console.log("Contatori autoincrement resettati.");
  });

  db.run("PRAGMA foreign_keys = ON;");
});

db.close(() => {
  console.log("Svuotamento database completato.");
});
