const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { knex, generaIDIncrementale } = require('../db');

// Parole da escludere nell'estrazione del nome
const PAROLE_DA_IGNORARE = new Set(['ROMA', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE', 'GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'ANAGNINO', 'FONTANILE', 'VIA', 'DEL']);

// Estrae il nome dal testo: cerca le parole immediatamente prima della data di assunzione
function estraiNome(text, cfPosition) {
  const before = text.substring(Math.max(0, cfPosition - 200), cfPosition);
  const dateMatch = before.match(/(\d{2}\/\d{2}\/\d{2,4})(?!\d)/);
  if (!dateMatch) return null;
  
  const dateIdx = before.lastIndexOf(dateMatch[0]);
  const nameArea = before.substring(0, dateIdx).trim();
  const words = nameArea.split(/\s+/).filter(w => 
    w.length > 1 && 
    /^[A-ZÀ-Ü']+$/i.test(w) && 
    !PAROLE_DA_IGNORARE.has(w.toUpperCase())
  );
  
  // Prendi le ultime 2-3 parole che formano il nome (cognome + nome)
  return words.slice(-3).join(' ').trim() || null;
}

// Cerca il dipendente per nome con fuzzy match
function trovaDipendentePeNome(nomeEstrattoRaw, dbDipendenti) {
  if (!nomeEstrattoRaw) return null;
  const nomeEstratto = cleanString(nomeEstrattoRaw);
  const paroleNome = nomeEstratto.split(' ').filter(p => p.length > 1);
  
  for (const dip of dbDipendenti) {
    const cognomePulito = cleanString(dip.cognome);
    const nomePulito = cleanString(dip.nome);
    
    // Match: se TUTTE le parole del cognome sono nel testo estratto
    const cognomeParole = cognomePulito.split(' ');
    const tuttoIlCognomePresente = cognomeParole.every(cp => paroleNome.some(pn => pn === cp || pn.startsWith(cp) || cp.startsWith(pn)));
    const almenoUnaNomeTrovata = nomePulito.split(' ').some(np => paroleNome.some(pn => pn === np || pn.startsWith(np) || np.startsWith(pn)));
    
    if (tuttoIlCognomePresente && almenoUnaNomeTrovata) return dip;
  }
  return null;
}

function cleanString(str) {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim().toUpperCase();
}


// Il formato è "NETTO BUSTA ... 197,00 FERIE" — il netto è l'ultimo numero in questa sequenza prima della parola FERIE
function estraiNetto(text) {
  const match = text.match(/NETTO BUSTA\s+(?:[\d.,]+\s+)?([\d.,]+)\s*FERIE/i);
  if (match && match[1]) {
    return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  }
  return null;
}

const bustePagaUploadController = {
  async anteprimaBustePaga(req, res) {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: 'Nessun file inviato.' });
      }

      const results = [];
      const tempDir = path.join(__dirname, '../uploads/temp_buste');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Precarica i dipendenti per velocizzare il match
      const dbDipendenti = await knex('dipendenti').select('id', 'nome', 'cognome', 'codice_fiscale');
      const cfRegex = /[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/gi;

      for (const file of files) {
        let pdfBuffer;
        if (file.buffer) {
          pdfBuffer = file.buffer;
        } else {
          pdfBuffer = fs.readFileSync(file.path);
          fs.unlinkSync(file.path);
        }

        // Salva il file originale completo come temp
        const origFilename = 'orig_' + Date.now() + '_' + Math.random().toString(36).substring(7) + '.pdf';
        const origPath = path.join(tempDir, origFilename);
        fs.writeFileSync(origPath, pdfBuffer);

        // Leggi il PDF con pdf-lib per sapere quante pagine ha
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const numPages = pdfDoc.getPageCount();

        // Estrai testo per ogni pagina usando pdf-parse con pagerender
        const pageTexts = [];
        const opts = {
          pagerender: function(pageData) {
            return pageData.getTextContent({ normalizeWhitespace: true }).then(tc => {
              const items = tc.items.map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
              // Ordina gli elementi per riga (y) e poi per colonna (x)
              items.sort((a,b) => {
                if (Math.abs(b.y - a.y) > 5) return b.y - a.y;
                return a.x - b.x;
              });
              const str = items.map(i => i.str).join(' ');
              pageTexts.push(str);
              return str;
            });
          }
        };

        try {
          await pdfParse(pdfBuffer, opts);
        } catch(e) {
          console.error('Errore estrazione testo PDF:', e.message);
        }

        if (numPages === 1 || pageTexts.length <= 1) {
          // PDF singolo: tratta come un'unica busta
          const text = pageTexts[0] || '';
          const cfMatch = text.match(cfRegex);
          const extractedCF = cfMatch ? cfMatch[0].toUpperCase() : null;
          const extractedNetto = estraiNetto(text);
          
          let dip = null;
          if (extractedCF) {
            dip = dbDipendenti.find(d => d.codice_fiscale && d.codice_fiscale.toUpperCase() === extractedCF);
          }
          if (!dip) {
            // Fallback 1: estrai nome dal testo PDF e fai fuzzy match
            const cfIdx = extractedCF ? text.toUpperCase().indexOf(extractedCF) : -1;
            const nomeEstratto = estraiNome(text, cfIdx >= 0 ? cfIdx : text.length);
            dip = trovaDipendentePeNome(nomeEstratto, dbDipendenti);
          }
          if (!dip) {
            // Fallback 2: cerca nel nome file
            dip = trovaDipendentePeNome(file.originalname, dbDipendenti);
          }

          results.push({
            tempFilename: origFilename,
            originalName: file.originalname,
            extractedCF: extractedCF || '',
            extractedNetto: extractedNetto || '',
            dipendenteId: dip ? dip.id : '',
            dipendenteNome: dip ? `${dip.cognome} ${dip.nome}` : ''
          });
        } else {
          // PDF multi-pagina: ogni pagina è una busta paga diversa
          // Prima elimina il file originale complessivo (non serve più come temp)
          fs.unlinkSync(origPath);

          for (let i = 0; i < pageTexts.length; i++) {
            const text = pageTexts[i];
            const cfMatch = text.match(cfRegex);
            const extractedCF = cfMatch ? cfMatch[0].toUpperCase() : null;
            const extractedNetto = estraiNetto(text);

            // Crea un PDF separato per questa pagina
            const singleDoc = await PDFDocument.create();
            const [pg] = await singleDoc.copyPages(pdfDoc, [i]);
            singleDoc.addPage(pg);
            const singleBytes = await singleDoc.save();
            
            const singleFilename = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(7) + '.pdf';
            fs.writeFileSync(path.join(tempDir, singleFilename), singleBytes);

            // Trova dipendente per CF, poi per nome estratto
            let dip = null;
            if (extractedCF) {
              dip = dbDipendenti.find(d => d.codice_fiscale && d.codice_fiscale.toUpperCase() === extractedCF);
            }
            if (!dip) {
              // Estrai il nome dal testo (prima del CF)
              const cfIdx = extractedCF ? text.toUpperCase().indexOf(extractedCF) : text.length;
              const nomeEstratto = estraiNome(text, cfIdx >= 0 ? cfIdx : text.length);
              dip = trovaDipendentePeNome(nomeEstratto, dbDipendenti);
              if (nomeEstratto) console.log(`[BUSTE PAGA] Pagina ${i+1}: CF=${extractedCF} Nome estratto: "${nomeEstratto}" -> Match: ${dip ? dip.cognome+' '+dip.nome : 'nessuno'}`);
            }

            results.push({
              tempFilename: singleFilename,
              originalName: dip ? `${dip.cognome} ${dip.nome}.pdf` : (extractedCF ? `${extractedCF}.pdf` : `Pagina_${i+1}.pdf`),
              extractedCF: extractedCF || '',
              extractedNetto: extractedNetto || '',
              dipendenteId: dip ? dip.id : '',
              dipendenteNome: dip ? `${dip.cognome} ${dip.nome}` : ''
            });
          }
        }
      }

      res.json({ success: true, files: results });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: e.message });
    }
  },

  async confermaBustePaga(req, res) {
    try {
      const { bustePaga, mese, anno } = req.body;
      
      const busteDir = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), `uploads/buste_paga/${anno}_${mese}`);
      if (!fs.existsSync(busteDir)) {
        fs.mkdirSync(busteDir, { recursive: true });
      }

      for (const busta of bustePaga) {
        if (!busta.dipendenteId) continue;

        const tempPath = path.join(__dirname, '../uploads/temp_buste', busta.tempFilename);
        if (!fs.existsSync(tempPath)) continue;

        const finalFilename = `Busta_${busta.dipendenteId}_${Date.now()}.pdf`;
        const finalPath = path.join(busteDir, finalFilename);
        
        fs.copyFileSync(tempPath, finalPath);
        fs.unlinkSync(tempPath);

        const relativePath = `uploads/buste_paga/${anno}_${mese}/${finalFilename}`;

        const existing = await knex('buste_paga').where({ dipendente_id: busta.dipendenteId, mese, anno }).first();
        if (existing) {
          await knex('buste_paga').where('id', existing.id).update({
            importo_netto: parseFloat(busta.extractedNetto) || 0,
            allegato_busta_paga: relativePath
          });
        } else {
          const id = await generaIDIncrementale("buste_paga", "BP");
          await knex('buste_paga').insert({
            id,
            dipendente_id: busta.dipendenteId,
            mese,
            anno,
            importo_netto: parseFloat(busta.extractedNetto) || 0,
            allegato_busta_paga: relativePath,
            creato_da: 'System'
          });
        }

        if (busta.updateCF && busta.extractedCF) {
          await knex('dipendenti').where('id', busta.dipendenteId).update({ codice_fiscale: busta.extractedCF });
        }
      }

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: e.message });
    }
  },
  
  async getBusteMese(req, res) {
    try {
      const { mese, anno } = req.query;
      const buste = await knex('buste_paga')
        .join('dipendenti', 'buste_paga.dipendente_id', '=', 'dipendenti.id')
        .select(
          'buste_paga.*', 
          'dipendenti.nome', 
          'dipendenti.cognome', 
          'dipendenti.codice_fiscale'
        )
        .where('buste_paga.mese', mese)
        .where('buste_paga.anno', anno);
        
      res.json({ success: true, buste });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: e.message });
    }
  },
  
  async getBusteDipendente(req, res) {
    try {
      const { dipendenteId } = req.params;
      const buste = await knex('buste_paga')
        .where('dipendente_id', dipendenteId)
        .orderBy('anno', 'desc')
        .orderBy('mese', 'desc');
        
      res.json({ success: true, buste });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: e.message });
    }
  },

  async eliminaBustaPaga(req, res) {
    try {
      const { id } = req.params;
      const busta = await knex('buste_paga').where('id', id).first();
      
      if (!busta) {
        return res.status(404).json({ success: false, error: 'Busta paga non trovata' });
      }

      // Elimina il file se esiste
      if (busta.allegato_busta_paga) {
        const filePath = path.join(__dirname, '..', busta.allegato_busta_paga);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await knex('buste_paga').where('id', id).del();
      await knex('log_attivita').insert({
        categoria: "Buste Paga", icona: "🗑️", colore: "#ef4444",
        descrizione: `Eliminata busta paga (ID: ${id})`, eseguito_da: "LocalServer"
      });
      
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: e.message });
    }
  },

  async eliminaBusteMese(req, res) {
    try {
      const { anno, mese } = req.params;
      const buste = await knex('buste_paga').where({ anno, mese });
      
      for (const busta of buste) {
        if (busta.allegato_busta_paga) {
          const filePath = path.join(__dirname, '..', busta.allegato_busta_paga);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }

      await knex('buste_paga').where({ anno, mese }).del();
      await knex('log_attivita').insert({
        categoria: "Buste Paga", icona: "🗑️", colore: "#ef4444",
        descrizione: `Eliminate tutte le buste paga del ${mese}/${anno} (${buste.length} eliminate)`, eseguito_da: "LocalServer"
      });
      
      res.json({ success: true, count: buste.length });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: e.message });
    }
  }
};

module.exports = bustePagaUploadController;
