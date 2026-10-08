const { knex } = require('../db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pdfmake = require('pdfmake');
const { DEFAULT_CONTENT, renderBody } = require('../preventivi_proforme');

// Configurazione font per pdfmake
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

pdfmake.setFonts(fonts);

exports.ensurePreventiviIds = async () => {
  // Nei database storici l'ID TEXT PRIMARY KEY di SQLite può essere NULL.
  // Ogni preventivo deve avere un ID distinto per poter essere eliminato.
  await knex.raw("UPDATE preventivi SET id = 'PREV_LEGACY_' || lower(hex(randomblob(16))) WHERE id IS NULL OR trim(id) = ''");
};

exports.getAllPreventivi = async (req, res) => {
  try {
    const preventivi = await knex('preventivi').orderBy('id', 'desc');
    res.json(preventivi);
  } catch (error) {
    console.error("Errore recupero preventivi:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPreventiviByCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const preventivi = await knex('preventivi')
      .where('cliente_prospect_id', id)
      .orderBy('id', 'desc');
    res.json(preventivi);
  } catch (error) {
    console.error("Errore recupero preventivi cliente:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.generatePreventivo = async (req, res) => {
  try {
    const {
      cliente_prospect_id,
      ragione_sociale_prospect,
      indirizzo_locali,
      oggetto,
      servizi_inclusi,
      costo_mensile,
      tipo_prezzo,
      commerciale,
      appuntamento_id,
      testo_corpo,
      titolo_documento,
      riga_data,
      destinatario_label,
      oggetto_label
    } = req.body;
    const corpo = testo_corpo === undefined ? DEFAULT_CONTENT.testo_corpo : testo_corpo;
    if (typeof corpo !== 'string' || !corpo.trim() || corpo.length > 20000) return res.status(400).json({ error: 'Testo del preventivo non valido (massimo 20000 caratteri).' });
    if ([titolo_documento, riga_data, destinatario_label, oggetto_label].some(value => value !== undefined && (typeof value !== 'string' || value.length > 200))) return res.status(400).json({ error: 'Testo dell’intestazione non valido.' });
    if (typeof ragione_sociale_prospect !== 'string' || !ragione_sociale_prospect.trim()) return res.status(400).json({ error: 'Inserisci il cliente o prospect.' });
    const appointmentId = appuntamento_id == null || appuntamento_id === '' ? null : Number(appuntamento_id);
    if (appointmentId !== null && (!Number.isSafeInteger(appointmentId) || appointmentId <= 0 || !await knex('appuntamenti_preventivi').where('id', appointmentId).first('id'))) {
      return res.status(400).json({ error: 'Appuntamento non valido.' });
    }

    // Recupera dati azienda per il footer
    const aziendaDati = await knex('m2i_azienda_dati').where('id', 1).first();
    const tel = aziendaDati?.telefono || '351 54 71 406';
    const em = aziendaDati?.email || 'info@emmeduei.com';
    const pec = aziendaDati?.pec || 'emmedueisrl@pec.it';
    const sedeLegale = aziendaDati?.sede_legale || 'Via del Fontanile Anagnino 183 - 00118 Roma';
    const sedeOperativa = aziendaDati?.sede_operativa || 'Via Pier Vittorio Aldini 28 - 00178 Roma';
    const piva = aziendaDati?.partita_iva || '15989811003';
    const rea = aziendaDati?.rea || 'RM - 1627538';
    const capSoc = aziendaDati?.capitale_sociale || '10.000,00';

    // Genera numero preventivo (es. 2026-001)
    const year = new Date().getFullYear();
    const countRow = await knex('preventivi').count('id as c').first();
    const count = (countRow.c || 0) + 1;
    const numero_preventivo = `${year}-${String(count).padStart(3, '0')}`;
    const data_preventivo = new Date().toISOString().split('T')[0];

    // Crea la cartella uploads/preventivi se non esiste
    const uploadDir = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads', 'preventivi');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const dataItaliana = new Date().toLocaleDateString('it-IT');
    const valoriTesto = {
      cliente: ragione_sociale_prospect,
      indirizzo: indirizzo_locali || '',
      oggetto: oggetto || DEFAULT_CONTENT.oggetto,
      servizi: servizi_inclusi || DEFAULT_CONTENT.servizi_inclusi,
      tipo_prezzo: tipo_prezzo === 'Orario' ? 'orario' : 'mensile',
      costo: `€ ${Number(costo_mensile).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      numero: numero_preventivo,
      data: dataItaliana
    };
    const testoCompilato = renderBody(corpo, valoriTesto);
    const titoloCompilato = renderBody(titolo_documento || DEFAULT_CONTENT.titolo_documento, valoriTesto);
    const dataCompilata = renderBody(riga_data || DEFAULT_CONTENT.riga_data, valoriTesto);
    const destinatarioCompilato = renderBody(destinatario_label || DEFAULT_CONTENT.destinatario_label, valoriTesto);
    const oggettoCompilato = renderBody(oggetto_label || DEFAULT_CONTENT.oggetto_label, valoriTesto);

    // Costruisci il docDefinition per pdfmake
    const docDefinition = {
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 12,
        lineHeight: 1.5,
        color: '#333333'
      },
      content: [
        {
          columns: [
            { image: path.join(__dirname, '..', 'public', 'images', 'logo-m2i.png'), width: 130, alignment: 'left' },
            {
              text: [
                { text: `${titoloCompilato}\n`, fontSize: 14, bold: true, color: '#004aad' },
                { text: dataCompilata, fontSize: 10, italics: true, color: '#555' }
              ],
              alignment: 'right', margin: [0, 10, 0, 0]
            }
          ],
          margin: [0, 0, 0, 15]
        },
        {
          text: [
            { text: `${destinatarioCompilato}\n`, italics: true, fontSize: 10, color: '#555' },
            { text: `${ragione_sociale_prospect}\n`, bold: true, fontSize: 12 },
            { text: indirizzo_locali || '', fontSize: 10, color: '#555' }
          ],
          alignment: 'right', margin: [0, 0, 0, 20]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#004aad' }], margin: [0, 0, 0, 5] },
        {
          text: [{ text: `${oggettoCompilato} `, bold: true, color: '#004aad' }, { text: oggetto || DEFAULT_CONTENT.oggetto }],
          margin: [0, 5, 0, 5], fontSize: 14
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#004aad' }], margin: [0, 0, 0, 20] },
        ...testoCompilato.split(/\n\s*\n/).filter(Boolean).map(paragrafo => ({ text: paragrafo.trim(), margin: [0, 0, 0, 14] }))
      ],
      footer: function(currentPage, pageCount) {
        return {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  text: 'Contatti & Dati Societari',
                  bold: true,
                  color: 'white',
                  fillColor: '#004aad',
                  margin: [40, 5, 40, 5],
                  fontSize: 14
                }
              ],
              [
                {
                  columns: [
                    {
                      width: '33%',
                      text: [
                        { text: 'Telefono & Email:\n', bold: true, color: '#004aad', fontSize: 10 },
                        { text: `${tel}\n${em}\n${pec}\n`, fontSize: 10 }
                      ],
                      margin: [40, 10, 0, 10]
                    },
                    {
                      width: '33%',
                      text: [
                        { text: 'Sede legale:\n', bold: true, color: '#004aad', fontSize: 10 },
                        { text: `${sedeLegale}`, fontSize: 10 }
                      ],
                      margin: [0, 10, 10, 10]
                    },
                    {
                      width: '34%',
                      text: [
                        { text: 'Dati Societari:\n', bold: true, color: '#004aad', fontSize: 10 },
                        { text: `P.IVA / C.F.: ${piva}\nREA: ${rea}\nCap. Soc.: € ${capSoc} i.v.`, fontSize: 10 }
                      ],
                      margin: [0, 10, 40, 10]
                    }
                  ],
                  fillColor: '#f2f9ff'
                }
              ]
            ]
          },
          layout: 'noBorders'
        };
      },
      pageMargins: [40, 40, 40, 140]
    };

    // Gli altri generatori PDF modificano i font globali di pdfmake.
    pdfmake.addFonts(fonts);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    
    // Nome file sicuro
    const safeName = ragione_sociale_prospect.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${numero_preventivo}_${safeName}.pdf`;
    const filePath = path.join(uploadDir, fileName);
    
    try {
      const buffer = await pdfDoc.getBuffer();
      fs.writeFileSync(filePath, buffer);
      
      // Salva nel db
      const allegato_url = `/uploads/preventivi/${fileName}`;
      
      const insertData = {
        id: `PREV_${crypto.randomUUID()}`,
        numero_preventivo,
        data_preventivo,
        cliente_prospect_id: cliente_prospect_id || null,
        ragione_sociale_prospect,
        indirizzo_locali: indirizzo_locali || '',
        costo_mensile: costo_mensile || 0,
        tipo_prezzo: tipo_prezzo || 'Mensile',
        commerciale: commerciale || '',
        servizi_inclusi: servizi_inclusi || '',
        stato: 'In Attesa',
        allegato_preventivo: allegato_url,
        appuntamento_id: appointmentId
      };

      await knex('preventivi').insert(insertData);

      res.status(201).json({ message: 'Preventivo generato con successo', data: insertData });
    } catch (err) {
      console.error("Errore durante la generazione e salvataggio del PDF:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Errore durante la generazione del preventivo." });
      }
    }

  } catch (error) {
    console.error("Errore generatePreventivo:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.uploadDaAppuntamento = async (req, res) => {
  const appointmentId = Number(req.params.id);
  if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) return res.status(400).json({ error: 'Appuntamento non valido.' });
  const appuntamento = await knex('appuntamenti_preventivi').where('id', appointmentId).first('id', 'nominativo', 'luogo');
  if (!appuntamento) return res.status(404).json({ error: 'Appuntamento non trovato.' });
  if (!req.file || req.file.buffer.subarray(0, 5).toString() !== '%PDF-') return res.status(400).json({ error: 'Allega un PDF valido.' });
  const numeroInput = typeof req.body.numeroPreventivo === 'string' ? req.body.numeroPreventivo.trim() : '';
  if (numeroInput.length > 80) return res.status(400).json({ error: 'Numero preventivo troppo lungo.' });
  const numero = numeroInput || `ALLEGATO-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const dir = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads', 'preventivi');
  const fileName = `${crypto.randomUUID()}.pdf`;
  const filePath = path.join(dir, fileName);
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, req.file.buffer, { flag: 'wx' });
    const preventivo = {
      id: `PREV_${crypto.randomUUID()}`,
      numero_preventivo: numero,
      data_preventivo: new Date().toISOString().slice(0, 10),
      ragione_sociale_prospect: appuntamento.nominativo,
      indirizzo_locali: appuntamento.luogo || '',
      costo_mensile: 0,
      tipo_prezzo: 'Allegato',
      stato: 'In Attesa',
      allegato_preventivo: `/uploads/preventivi/${fileName}`,
      appuntamento_id: appointmentId
    };
    await knex('preventivi').insert(preventivo);
    res.status(201).json(preventivo);
  } catch (error) {
    await fs.promises.rm(filePath, { force: true }).catch(() => {});
    console.error('Errore upload preventivo appuntamento:', error);
    res.status(500).json({ error: 'Impossibile salvare il preventivo.' });
  }
};

exports.uploadPreventivoPronto = async (req, res) => {
  if (!req.file || req.file.buffer.subarray(0, 5).toString() !== '%PDF-') return res.status(400).json({ error: 'Allega un PDF valido.' });
  const numeroInput = typeof req.body.numeroPreventivo === 'string' ? req.body.numeroPreventivo.trim() : '';
  const nominativo = typeof req.body.nominativo === 'string' ? req.body.nominativo.trim() : '';
  const data = typeof req.body.dataPreventivo === 'string' ? req.body.dataPreventivo.trim() : '';
  const appointmentId = req.body.appuntamentoId ? Number(req.body.appuntamentoId) : null;
  if (!nominativo || nominativo.length > 200) return res.status(400).json({ error: 'Inserisci un cliente o prospect valido.' });
  if (numeroInput.length > 80) return res.status(400).json({ error: 'Numero preventivo troppo lungo.' });
  const dataParsed = /^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T00:00:00Z`) : null;
  if (!dataParsed || Number.isNaN(dataParsed.getTime()) || dataParsed.toISOString().slice(0, 10) !== data) return res.status(400).json({ error: 'Data preventivo non valida.' });
  if (appointmentId !== null && (!Number.isSafeInteger(appointmentId) || appointmentId <= 0 || !await knex('appuntamenti_preventivi').where('id', appointmentId).first('id'))) {
    return res.status(400).json({ error: 'Appuntamento non valido.' });
  }
  const dir = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads', 'preventivi');
  const fileName = `${crypto.randomUUID()}.pdf`;
  const filePath = path.join(dir, fileName);
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, req.file.buffer, { flag: 'wx' });
    const preventivo = {
      id: `PREV_${crypto.randomUUID()}`,
      numero_preventivo: numeroInput || `ALLEGATO-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      data_preventivo: data,
      ragione_sociale_prospect: nominativo,
      costo_mensile: 0,
      tipo_prezzo: 'Allegato',
      allegato_preventivo: `/uploads/preventivi/${fileName}`,
      appuntamento_id: appointmentId
    };
    await knex('preventivi').insert(preventivo);
    res.status(201).json(preventivo);
  } catch (error) {
    await fs.promises.rm(filePath, { force: true }).catch(() => {});
    console.error('Errore caricamento preventivo PDF:', error);
    res.status(500).json({ error: 'Impossibile salvare il preventivo.' });
  }
};

exports.collegaAppuntamento = async (req, res) => {
  const appointmentId = req.body?.appuntamentoId == null || req.body.appuntamentoId === '' ? null : Number(req.body.appuntamentoId);
  if (appointmentId !== null && (!Number.isSafeInteger(appointmentId) || appointmentId <= 0 || !await knex('appuntamenti_preventivi').where('id', appointmentId).first('id'))) {
    return res.status(400).json({ error: 'Appuntamento non valido.' });
  }
  const count = await knex('preventivi').where('id', req.params.id).update({ appuntamento_id: appointmentId });
  if (!count) return res.status(404).json({ error: 'Preventivo non trovato.' });
  res.json({ id: req.params.id, appuntamento_id: appointmentId });
};

exports.eliminaPreventivo = async (req, res) => {
  try {
    const preventivo = await knex('preventivi').where('id', req.params.id).first('allegato_preventivo');
    if (!preventivo) return res.status(404).json({ error: 'Preventivo non trovato.' });
    await knex('preventivi').where('id', req.params.id).del();
    const allegato = preventivo.allegato_preventivo;
    if (/^\/uploads\/preventivi\/[A-Za-z0-9._-]+\.pdf$/.test(allegato || '')) {
      const ancoraUsato = await knex('preventivi').where('allegato_preventivo', allegato).first('id');
      if (!ancoraUsato) {
        const filePath = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads', 'preventivi', path.basename(allegato));
        await fs.promises.rm(filePath, { force: true }).catch(error => console.error('PDF preventivo non eliminato:', error));
      }
    }
    res.status(204).end();
  } catch (error) {
    console.error('Errore eliminazione preventivo:', error);
    res.status(500).json({ error: 'Impossibile eliminare il preventivo.' });
  }
};
