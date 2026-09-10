const http = require('http');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Crea un file finto
const testFilePath = path.join(__dirname, 'test_doc_original.pdf');
fs.writeFileSync(testFilePath, 'Contenuto del file');

const form = new FormData();
form.append('idDipendente', 'DTEST999');
form.append('file', fs.createReadStream(testFilePath), 'Mio_Nome_Personalizzato.pdf');

const req = http.request('http://localhost:3000/api/upload', {
  method: 'POST',
  headers: form.getHeaders(),
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Risposta Server:', data);
    fs.unlinkSync(testFilePath);
    
    // Controlla se il file esiste
    const destPath = path.join(__dirname, 'gestionale_m2i_sql', 'uploads', 'DTEST999', 'Mio_Nome_Personalizzato.pdf');
    if (fs.existsSync(destPath)) {
       console.log('SUCCESSO: Il file è stato salvato con il nome personalizzato corretto!');
       fs.unlinkSync(destPath);
    } else {
       console.log('ERRORE: Il file non si chiama come previsto.');
    }
  });
});

req.on('error', (e) => {
  console.error('Errore chiamata HTTP:', e.message);
});

form.pipe(req);
