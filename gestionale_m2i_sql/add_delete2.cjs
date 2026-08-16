const fs = require('fs');

let content = fs.readFileSync('controllers/fatture.js', 'utf8');

content = content.replace(/  async aggiornaStatoFattura\(idFattura, stato\) {[\s\S]*?return true;\n  }\n};/,
`  async aggiornaStatoFattura(idFattura, stato) {
    await knex('fatture')
      .where('id', idFattura)
      .update({ stato_pagamento: stato });
    return true;
  },

  async eliminaFattureMulti(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    return knex('fatture').whereIn('id', ids).delete();
  }
};`
);

fs.writeFileSync('controllers/fatture.js', content);
