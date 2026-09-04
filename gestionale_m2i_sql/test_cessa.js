const path = require('path');
const fs = require('fs');
const clientiJsPath = path.join(__dirname, 'controllers/clienti.js');
let code = fs.readFileSync(clientiJsPath, 'utf8');

if (!code.includes('cessaCliente(')) {
  const cessaCode = \
  async cessaCliente(id) {
    await knex('clienti').where('id', id).update({ attivo: 'Cessato' });
    await knex('log_attivita').insert({
      categoria: "Clienti", icona: "🛑", colore: "#f97316",
      descrizione: \\\Cliente impostato come Cessato: <b>\</b>\\\, eseguito_da: "LocalServer"
    });
    return true;
  },

  async riattivaCliente(id) {
    await knex('clienti').where('id', id).update({ attivo: 'SI' });
    await knex('log_attivita').insert({
      categoria: "Clienti", icona: "✅", colore: "#10b981",
      descrizione: \\\Cliente riattivato: <b>\</b>\\\, eseguito_da: "LocalServer"
    });
    return true;
  },
\;
  code = code.replace('async ripristinaCliente(id) {', cessaCode + '\n  async ripristinaCliente(id) {');
  fs.writeFileSync(clientiJsPath, code);
  console.log("Added cessaCliente to controllers/clienti.js");
}
