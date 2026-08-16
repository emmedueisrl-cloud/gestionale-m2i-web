const http = require('http');

const body = JSON.stringify({ functionName: 'recuperaOreMensili', args: ['D0021', 7, 2026] });

const req = http.request({
  hostname: 'localhost', port: 3000,
  path: '/api/run',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const json = JSON.parse(d);
      console.log('success:', json.success);
      if (json.data) {
        console.log('metodo:', json.data.metodo);
        console.log('righe:', json.data.righe ? json.data.righe.length : 'N/A');
        if (json.data.righe && json.data.righe.length > 0) {
          const r = json.data.righe[0];
          console.log('Prima riga - cliente:', r.cliente, 'ore_totali:', r.ore_totali, 'giorni[0]:', r.giorni ? r.giorni[0] : 'N/A');
        }
      } else {
        console.log('Raw data:', JSON.stringify(json).substring(0, 500));
      }
    } catch(e) {
      console.log('Raw:', d.substring(0, 500));
    }
  });
});
req.on('error', console.error);
req.write(body);
req.end();
