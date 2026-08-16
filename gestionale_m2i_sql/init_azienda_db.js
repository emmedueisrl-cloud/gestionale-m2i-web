const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gestionale.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS m2i_azienda_dati (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ragione_sociale TEXT,
      sede_legale TEXT,
      sede_operativa TEXT,
      pec TEXT,
      email TEST,
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
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS m2i_azienda_documenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      file_path TEXT,
      data_caricamento TEXT
    )
  `);

  db.get("SELECT COUNT(*) as count FROM m2i_azienda_dati", (err, row) => {
    if (row.count === 0) {
      const stmt = db.prepare(`
        INSERT INTO m2i_azienda_dati (
          ragione_sociale, sede_legale, sede_operativa, pec, 
          rea, partita_iva, codice_fiscale, forma_giuridica, 
          data_costituzione, amministratore_unico, capitale_sociale, codice_ateco
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        'M2I S.R.L.',
        'ROMA (RM) VIA DEL FONTANILE ANAGNINO 183 CAP 00118 C/O ST.COMM.DOT. CECCONI MARCO',
        'VIA PIER VITTORIO ALDINI 28 ROMA (RM) CAP 00178',
        'emmedueisrl@pec.it',
        'RM - 1627538',
        '15989811003',
        '15989811003',
        'societa\' a responsabilita\' limitata',
        '14/01/2021',
        'MARTINELLI MAURO',
        '10.000,00',
        '81.23.10'
      );
      stmt.finalize();
      console.log("Dati iniziali azienda M2I inseriti.");
    } else {
      console.log("Dati azienda già presenti.");
    }
  });
});

db.close();
