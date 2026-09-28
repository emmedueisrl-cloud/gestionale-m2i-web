const path = require('path');
const fs = require('fs');

// ============================================================
// INIZIALIZZAZIONE DATABASE - LOGICA BLINDATA
// ============================================================
// REGOLA ASSOLUTA:
//   1. Se DATA_DIR è impostato ma NON accessibile → CRASH immediato.
//      Il server NON deve mai partire con il DB locale come fallback silenzioso.
//   2. Se DATA_DIR è impostato e il file persistente esiste → usalo SEMPRE.
//   3. Se DATA_DIR è impostato e il DB manca → STOP, nessuna copia automatica.
//   4. Se DATA_DIR NON è impostato → ambiente locale di sviluppo, usa il DB locale.
// ============================================================

let dbPath = path.join(__dirname, 'gestionale.db');

if (process.env.NODE_ENV === 'production' && !process.env.DATA_DIR?.trim()) {
  console.error('DATA_DIR obbligatorio in produzione: avvio interrotto.');
  process.exit(1);
}

if (process.env.DATA_DIR) {
  const dataDir = process.env.DATA_DIR.trim();
  process.env.DATA_DIR = dataDir;
  
  // PROTEZIONE AGGIUNTIVA: assicuriamoci che l'URL inserito su Render sia un percorso reale 
  // e non una stringa casuale o relativa come "DATA_DIR"
  if (!path.isAbsolute(dataDir)) {
    console.error("=== ERRORE CRITICO: La variabile DATA_DIR impostata ('" + dataDir + "') NON è un percorso assoluto. Deve essere /var/lib/data ===");
    process.exit(1);
  }

  const persistDbPath = path.join(dataDir, 'gestionale.db');

  // Non creare automaticamente un percorso che potrebbe essere un mount errato.
  if (!fs.existsSync(dataDir)) {
    console.error('DATA_DIR non esistente: verificare il disco persistente. Avvio interrotto.');
    process.exit(1);
  }

  // 2. Verifica che la directory sia effettivamente scrivibile (write test).
  const writeTestPath = path.join(dataDir, '.write_test');
  try {
    fs.writeFileSync(writeTestPath, 'ok');
    fs.unlinkSync(writeTestPath);
  } catch(e) {
    console.error("=== ERRORE CRITICO: DATA_DIR '" + dataDir + "' non è scrivibile. Il Persistent Disk potrebbe non essere montato. ===");
    console.error("=== Il server si ferma per evitare perdita di dati. ===");
    process.exit(1);
  }

  // 3. Richiede il database esistente; niente importazioni implicite dal repository.
  try {
    const persistExists = fs.existsSync(persistDbPath);
    if (!persistExists) {
      throw new Error('Database persistente mancante: verificare DATA_DIR e ripristino. Nessun database locale copiato.');
    } else {
      // DB persistente trovato: NON TOCCARLO MAI.
      const stats = fs.statSync(persistDbPath);
      console.log("=== DB PERSISTENTE TROVATO E ATTIVO: " + persistDbPath + " (" + Math.round(stats.size / 1024) + " KB) ===");
    }
  } catch(e) {
    console.error("=== ERRORE CRITICO durante l'inizializzazione del DB:", e.message, "===");
    process.exit(1);
  }

  dbPath = persistDbPath;
} else {
  console.log("=== MODALITÀ SVILUPPO LOCALE: uso DB locale: " + dbPath + " ===");
}

console.log("=== DB PATH FINALE CONFIGURATO: " + dbPath + " ===");

// Inizializza Knex per SQLite
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: dbPath
  },
  useNullAsDefault: true,
  pool: {
    afterCreate: (conn, cb) => {
      conn.run('PRAGMA foreign_keys = ON', cb);
    }
  }
});

let idMutex = Promise.resolve();
async function generaIDIncrementale(tabella, prefisso) {
  return new Promise((resolve, reject) => {
    idMutex = idMutex.then(async () => {
      try {
        const rows = await knex(tabella).select('id');
        let maxNum = 0;
        rows.forEach(row => {
          if (row.id) {
            const match = row.id.match(/\d+/);
            if (match) {
              const num = parseInt(match[0], 10);
              if (num > maxNum) maxNum = num;
            }
          }
        });
        if (maxNum === 0) {
          return resolve(prefisso + "0001");
        }
        resolve(prefisso + String(maxNum + 1).padStart(4, "0"));
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Case-insensitive property helper
function getVal(obj, key) {
  if (!obj) return null;
  const lowerKey = key.toLowerCase();
  const realKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
  return realKey ? obj[realKey] : null;
}

// Auto-migrazione: crea agenda_caposquadra se non esiste (necessario per persistent disk su Render)
knex.schema.hasTable('agenda_caposquadra').then(exists => {
  if (!exists) {
    console.log("Creazione tabella agenda_caposquadra in corso...");
    return knex.schema.createTable('agenda_caposquadra', t => {
      t.increments('id').primary();
      t.text('dipendente_id').references('id').inTable('dipendenti').onDelete('CASCADE');
      t.text('data').notNullable();
      t.text('ora_inizio').notNullable();
      t.text('ora_fine').notNullable();
      t.text('cliente_id').references('id').inTable('clienti').onDelete('RESTRICT');
      t.text('colore').defaultTo('#3b82f6');
      t.text('note');
    }).then(() => console.log("Tabella agenda_caposquadra creata con successo."));
  }
}).catch(err => console.error("Errore auto-migrazione agenda_caposquadra:", err));

module.exports = {
  knex,
  generaIDIncrementale,
  getVal
};
