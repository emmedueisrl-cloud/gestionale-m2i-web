const fs = require('fs');

let content = fs.readFileSync('controllers/fatture.js', 'utf8');

content = content.replace(/(module\.exports\s*=\s*{[\s\S]*?)(\s*};)/, "$1\n  async eliminaFattureMulti(ids) {\n    if (!Array.isArray(ids) || ids.length === 0) return 0;\n    return knex('fatture').whereIn('id', ids).delete();\n  },\n$2");

fs.writeFileSync('controllers/fatture.js', content);
