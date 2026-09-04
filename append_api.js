const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'gestionale_m2i_react/src/api/clienti.js');
let content = fs.readFileSync(p, 'utf8');
content += \\nexport async function cessaCliente(id) {\n  return await apiCall('cessaCliente', [id]);\n}\n\nexport async function riattivaCliente(id) {\n  return await apiCall('riattivaCliente', [id]);\n}\n\;
fs.writeFileSync(p, content);
