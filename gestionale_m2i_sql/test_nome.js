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
  const cfRegex = /[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/gi;
  
  // Analizza le prime 3 pagine
  for (let i = 0; i < 3; i++) {
    const text = pageTexts[i];
    const cfMatch = text.match(cfRegex);
    const cf = cfMatch ? cfMatch[0].toUpperCase() : null;
    
    if (cf) {
      // Il CF è presente. Trova il nome guardando prima del CF nel testo
      const cfIdx = text.toUpperCase().indexOf(cf);
      const before = text.substring(Math.max(0, cfIdx - 200), cfIdx);
      
      console.log(`\n=== Pagina ${i+1} ===`);
      console.log('CF trovato:', cf);
      console.log('200 chars PRIMA del CF:');
      console.log(JSON.stringify(before));
      
      // Cerca una data nel formato GG/MM/AA o GG/MM/AAAA
      const dateMatch = before.match(/\d{2}\/\d{2}\/\d{2,4}/);
      if (dateMatch) {
        const dateIdx = before.lastIndexOf(dateMatch[dateMatch.length-1]);
        const nameArea = before.substring(0, dateIdx).trim();
        // Prendi le ultime parole prima della data che sembrano un nome
        const words = nameArea.split(/\s+/).filter(w => w.length > 1 && /^[A-Z'À-Ü]+$/i.test(w));
        const lastWords = words.slice(-5);
        console.log('Nome estratto (parole prima della data):', lastWords.join(' '));
      }
    }
  }
}).catch(e => console.error(e.message)).then(() => process.exit(0));
