const fs = require('fs');
const path = require('path');

const serverJsPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverJsPath, 'utf8');

const startStr = "app.get('/api/pdf/foglio-presenze'";
const endStr = "});";

const startIndex = content.indexOf(startStr);
if (startIndex === -1) {
    console.error("Non ho trovato /api/pdf/foglio-presenze");
    process.exit(1);
}

let endIndex = content.indexOf(endStr, startIndex);
if (endIndex === -1) {
    console.error("Non ho trovato la fine dell'endpoint");
    process.exit(1);
}
endIndex += endStr.length;

const newEndpoints = `app.get('/api/excel/scarica-presenze', async (req, res) => {
  try {
    const { mese, anno, dipendente_id, precompila } = req.query;
    
    // Fetch dipendente info
    const dip = await knex('dipendenti').where({ id: dipendente_id }).first();
    if (!dip) return res.status(404).send('Dipendente non trovato');

    // Fetch tutti i clienti attivi per il menu a tendina
    const clientiRows = await knex('clienti').select('ragione_sociale').where({ stato: 'Attivo' }).orderBy('ragione_sociale', 'asc');
    const clientiValidi = clientiRows.map(c => c.ragione_sociale.toUpperCase());

    let colonne = [];
    
    if (precompila === 'true') {
      const progData = await api.precompilaDaProgrammaFisso(dipendente_id, mese, anno);
      colonne = progData.map(p => ({
        clienteId: p.idCliente,
        clienteNome: p.cliente,
        ore: p.giorni
      }));
      const extraCols = Math.max(5 - colonne.length, 0);
      for (let i = 0; i < extraCols; i++) {
        colonne.push({ clienteId: null, clienteNome: "", ore: Array(31).fill(0) });
      }
    } else {
      // 5 colonne vuote
      for (let i = 0; i < 5; i++) {
        colonne.push({ clienteId: null, clienteNome: "", ore: Array(31).fill(0) });
      }
    }

    const data = {
      dipendente: \`\${dip.nome} \${dip.cognome}\`,
      mese: parseInt(mese, 10),
      anno: parseInt(anno, 10),
      clientiValidi,
      colonne
    };
    
    const workbook = await excelGenerator.buildFoglioPresenzeExcel(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', \`attachment; filename="FoglioPresenze_\${data.dipendente.replace(/\\s+/g, '_')}_\${mese}_\${anno}.xlsx"\`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

const uploadMem = multer({ storage: multer.memoryStorage() });

app.post('/api/excel/carica-presenze', uploadMem.single('file'), async (req, res) => {
  try {
    const { dipendente_id, mese, anno } = req.body;
    if (!req.file) return res.status(400).send('Nessun file caricato');

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const presenzeSheet = workbook.worksheets.find(ws => ws.name.startsWith('Presenze'));
    if (!presenzeSheet) {
      return res.status(400).send('Foglio "Presenze" non trovato nel file.');
    }

    const headerRow = presenzeSheet.getRow(1);
    const colMap = {};
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber >= 2) {
        if (cell.value) {
          colMap[colNumber] = cell.value.toString().trim().toUpperCase();
        }
      }
    });

    if (Object.keys(colMap).length === 0) {
      return res.status(400).send('Nessun cliente o causale specificato nelle intestazioni delle colonne.');
    }

    const righeMap = {};
    const numGiorniMese = new Date(anno, mese, 0).getDate();

    for (const [colIndex, nomeCol] of Object.entries(colMap)) {
      const clienteRow = await knex('clienti').whereRaw('UPPER(ragione_sociale) = ?', [nomeCol]).first();
      let idCliente = null;
      let causale = "Ordinario";
      
      if (clienteRow) {
        idCliente = clienteRow.id;
      } else {
        causale = nomeCol;
      }

      const key = \`\${idCliente || 'null'}_\${causale}\`;
      if (!righeMap[key]) {
        righeMap[key] = {
          idCliente: idCliente,
          cliente: nomeCol,
          causale: causale,
          note: "Da Excel",
          giorni: Array(31).fill(0)
        };
      }
      
      colMap[colIndex] = key;
    }

    for (let giorno = 1; giorno <= numGiorniMese; giorno++) {
      const rowIndex = giorno + 1;
      const row = presenzeSheet.getRow(rowIndex);
      
      for (const [colIndex, key] of Object.entries(colMap)) {
        const cell = row.getCell(Number(colIndex));
        let val = parseFloat(cell.value);
        if (isNaN(val)) val = 0;
        
        if (val > 0) {
          righeMap[key].giorni[giorno - 1] += val;
        }
      }
    }

    const righeDaSalvare = Object.values(righeMap).filter(r => r.giorni.some(h => h > 0));

    await api.svuotaRegistroOreMensili(dipendente_id, mese, anno);

    const datiSalvataggio = {
      dipendenteId: dipendente_id,
      mese: parseInt(mese, 10),
      anno: parseInt(anno, 10),
      metodoInserimento: 'Mensile Calendario',
      righe: righeDaSalvare
    };

    await api.salvaPresenzeMensili(datiSalvataggio);

    res.json({ success: true, message: 'Dati caricati con successo' });
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});`;

const newContent = content.substring(0, startIndex) + newEndpoints + content.substring(endIndex);
fs.writeFileSync(serverJsPath, newContent, 'utf8');
console.log('Fatto!');
