const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  // Fix m2i_azienda_dati
  db.run(`CREATE TABLE IF NOT EXISTS m2i_azienda_dati_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ragione_sociale TEXT,
      sede_legale TEXT,
      sede_operativa TEXT,
      pec TEXT,
      email TEXT,
      telefono TEXT,
      rea TEXT,
      partita_iva TEXT,
      codice_fiscale TEXT,
      forma_giuridica TEXT,
      data_costituzione TEXT,
      amministratore_unico TEXT,
      capitale_sociale TEXT,
      codice_ateco TEXT,
      timbro_path TEXT
  )`);
  db.run(`INSERT INTO m2i_azienda_dati_new SELECT * FROM m2i_azienda_dati`);
  db.run(`DROP TABLE m2i_azienda_dati`);
  db.run(`ALTER TABLE m2i_azienda_dati_new RENAME TO m2i_azienda_dati`);

  // Fix proroghe_contratti (add FK)
  db.run(`CREATE TABLE IF NOT EXISTS proroghe_contratti_new (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, 
      dipendente_id varchar(255), 
      scadenza_precedente varchar(255), 
      nuova_scadenza varchar(255), 
      note varchar(255), 
      data_proroga datetime default CURRENT_TIMESTAMP,
      FOREIGN KEY(dipendente_id) REFERENCES dipendenti(id) ON DELETE CASCADE
  )`);
  db.run(`INSERT INTO proroghe_contratti_new SELECT * FROM proroghe_contratti`);
  db.run(`DROP TABLE proroghe_contratti`);
  db.run(`ALTER TABLE proroghe_contratti_new RENAME TO proroghe_contratti`);

  console.log("Schema fix completed.");
});
