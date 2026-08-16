const path = require('path');
const fs = require('fs');

let dbPath = path.join(__dirname, 'gestionale.db');
if (process.env.DATA_DIR) {
  const persistDbPath = path.join(process.env.DATA_DIR, 'gestionale.db');
  // Se il database persistente non esiste (es. primo avvio), lo copio dal repository
  if (!fs.existsSync(persistDbPath) && fs.existsSync(dbPath)) {
    console.log("Database persistente non trovato. Copio il database iniziale da " + dbPath + " a " + persistDbPath);
    fs.copyFileSync(dbPath, persistDbPath);
  }
  dbPath = persistDbPath;
}

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

module.exports = {
  knex,
  generaIDIncrementale,
  getVal
};
