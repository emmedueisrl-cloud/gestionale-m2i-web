const fs = require('fs');

let content = fs.readFileSync('src/api/commerciale.js', 'utf8');

content += `
export async function eliminaFattureMulti(ids) {
  return await apiCall('eliminaFattureMulti', [ids]);
}
`;

fs.writeFileSync('src/api/commerciale.js', content);
