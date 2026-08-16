const http = require('http');
const fs = require('fs');
const boundary = '----FormBoundary' + Date.now();

const fileData = fs.readFileSync('C:/Users/maggi/Downloads/test_precompilato.xlsx');

const head = Buffer.concat([
  Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="dipendente_id"\r\n\r\nD0021\r\n'),
  Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="mese"\r\n\r\n7\r\n'),
  Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="anno"\r\n\r\n2026\r\n'),
  Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="test.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'),
]);
const tail = Buffer.from('\r\n--' + boundary + '--\r\n');
const body = Buffer.concat([head, fileData, tail]);

const req = http.request({
  hostname: 'localhost', port: 3000,
  path: '/api/excel/carica-presenze',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': body.length
  }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode, 'Body:', d);
    // Verifica nel DB
    const knex = require('knex')({client: 'sqlite3', connection: {filename: 'gestionale.db'}, useNullAsDefault: true});
    knex('registro_ore').where({dipendente_id: 'D0021', mese: 7, anno: 2026})
      .select('id', 'metodo_inserimento', 'ore_totali', 'giorno_1', 'giorno_2', 'giorno_3')
      .then(rows => { console.log('DB rows:', rows); knex.destroy(); });
  });
});
req.on('error', console.error);
req.write(body);
req.end();
