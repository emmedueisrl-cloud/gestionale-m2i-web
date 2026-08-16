const pdfParse = require('pdf-parse');
const fs = require('fs');
const buf = fs.readFileSync('uploads/temp_buste/temp_1786551638365_u2ffr.pdf');
const pageTexts = [];

const opts = {
  pagerender: function(pageData) {
    return pageData.getTextContent({ normalizeWhitespace: true }).then(tc => {
      const str = tc.items.map(i => i.str).join(' ');
      pageTexts.push(str);
      return str;
    });
  }
};

pdfParse(buf, opts).then(data => {
  const page1 = pageTexts[0];
  
  // Il testo viene reso come un flusso di spazi-token
  // Cerca tutti i numeri nel testo della pagina
  const allNumbers = page1.match(/\d{1,3}(?:[.,]\d{3})*[.,]\d{2}/g) || [];
  console.log('Tutti i numeri trovati:', allNumbers.join(', '));
  
  // Trova "NETTO BUSTA" e il token successivo che sia un numero
  const idx = page1.toUpperCase().indexOf('NETTO BUSTA');
  if (idx >= 0) {
    const after = page1.substring(idx, idx + 300);
    console.log('\nTesto dopo NETTO BUSTA (300 chars):');
    console.log(JSON.stringify(after));
  }

}).catch(e => console.error(e.message)).then(() => process.exit(0));
