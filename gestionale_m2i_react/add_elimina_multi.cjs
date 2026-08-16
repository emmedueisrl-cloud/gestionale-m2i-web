const fs = require('fs');

let content = fs.readFileSync('src/api/commerciale.js', 'utf8');

content = content.replace("export async function eliminaFattura(id) {",
`export async function eliminaFattureMulti(ids) {
  return await apiCall('eliminaFattureMulti', [ids]);
}

export async function eliminaFattura(id) {`);

fs.writeFileSync('src/api/commerciale.js', content);
