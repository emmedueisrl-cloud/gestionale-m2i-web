const path = require('path');
const fs = require('fs');

let dbPath = path.join(__dirname, 'gestionale.db');
if (process.env.DATA_DIR) {
  const dataDir = process.env.DATA_DIR.trim();
  if (!fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch(e) {}
  }
  
  const persistDbPath = path.join(dataDir, 'gestionale.db');
  
  try {
    const stats = fs.existsSync(persistDbPath) ? fs.statSync(persistDbPath) : null;
    // Se non esiste, o è vuoto/corrotto (< 10KB), sovrascrivilo
    if (!stats || stats.size < 10240) {
      console.log("Copia DB iniziale in corso verso: " + persistDbPath);
      fs.copyFileSync(dbPath, persistDbPath);
    }
  } catch(e) {
    console.error("Errore copia DB:", e);
  }
  dbPath = persistDbPath;
}
console.log("=== DB PATH CONFIGURATO: " + dbPath + " ===");

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
        const row = await knex(tabella).select('id').orderBy('id', 'desc').first();
        if (!row || !row.id) {
          return resolve(prefisso + "0001");
        }
        const match = row.id.match(/\d+/);
        const num = match ? parseInt(match[0], 10) + 1 : 1;
        resolve(prefisso + String(num).padStart(4, "0"));
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
