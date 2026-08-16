const { knex } = require('../db');
const path = require('path');
const fs = require('fs');
const pdfmake = require('pdfmake');

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
      commerciale
    } = req.body;

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

    const labelCosto = tipo_prezzo === 'Orario' ? 'Costo del servizio orario ' : 'Costo del servizio mensile ';

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
            {
              image: path.join(__dirname, '..', 'public', 'images', 'logo-m2i.png'),
              width: 130,
              alignment: 'left'
            },
            {
              text: [
                { text: `PREVENTIVO N° ${numero_preventivo}\n`, fontSize: 14, bold: true, color: '#004aad' },
                { text: `Roma, ${new Date().toLocaleDateString('it-IT')}`, fontSize: 10, italics: true, color: '#555' }
              ],
              alignment: 'right',
              margin: [0, 10, 0, 0]
            }
          ],
          margin: [0, 0, 0, 15]
        },
        {
          text: [
            { text: 'Spett.le\n', italics: true, fontSize: 10, color: '#555' },
            { text: `${ragione_sociale_prospect}\n`, bold: true, fontSize: 12 },
            { text: indirizzo_locali || '', fontSize: 10, color: '#555' }
          ],
          alignment: 'right',
          margin: [0, 0, 0, 20]
        },
        {
          canvas: [
            { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#004aad' }
          ],
          margin: [0, 0, 0, 5]
        },
        {
          text: [
            { text: 'Oggetto: ', bold: true, color: '#004aad' },
            { text: oggetto || 'Preventivo per pulizie ordinarie' }
          ],
          margin: [0, 5, 0, 5],
          fontSize: 14
        },
        {
          canvas: [
            { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#004aad' }
          ],
          margin: [0, 0, 0, 20]
        },
        {
          text: 'In riferimento alla Vostra gradita richiesta, Vi sottoponiamo la Nostra migliore offerta, unitamente alle seguenti condizioni commerciali:',
          margin: [0, 0, 0, 20]
        },
        {
          ul: [
            {
              text: [
                'Il presente preventivo ha ad oggetto l’esecuzione del servizio di pulizia (a titolo esemplificativo ma non esaustivo):\n',
                { text: servizi_inclusi, italics: true },
                '\n\n',
                { text: `dei locali siti in: ${indirizzo_locali || ''}`, bold: true }
              ],
              margin: [0, 0, 0, 20]
            },
            {
              text: [
                labelCosto,
                { text: '(IVA IN REVERSE CHARGE*) : ', fontSize: 10 },
                { text: `€ ${Number(costo_mensile).toLocaleString('it-IT', {minimumFractionDigits: 2})}`, bold: true, fontSize: 14 }
              ],
              margin: [0, 0, 0, 15]
            },
            {
              text: 'Modalità di pagamento: La M2I entro il 5 del mese successivo a quello di riferimento invierà fattura mensile per il servizio prestato. Il pagamento avverrà entro il 15 del mese successivo a quello di riferimento.',
              margin: [0, 0, 0, 15]
            },
            {
              text: 'Si avvisa che la prima fattura emessa avrà decorrenza dal primo giorno di effettivo servizio e sarà calcolata pro-rata fino a fine mese.',
              margin: [0, 0, 0, 15]
            },
            {
              text: 'Attrezzature e prodotti per la pulizia sono a carico della M2I.',
              margin: [0, 0, 0, 15]
            },
            {
              text: 'La M2I S.r.l., nell’espletamento del servizio, è coperta da polizza assicurativa N° 2021/03/2430364 sottoscritta con REALE MUTUA per il risarcimento di eventuali danni a persone e/o cose.',
              margin: [0, 0, 0, 15]
            },
            {
              text: 'Il contratto prevede un periodo di prova di 30 giorni decorrenti dalla data di sottoscrizione ed avrà durata di 90 giorni. Sarà rinnovato tacitamente, salvo disdetta di una delle parti da inviarsi tramite raccomandata o tramite pec almeno 30 giorni prima della scadenza.',
              margin: [0, 0, 0, 20]
            }
          ]
        },
        {
          text: '* NB: Il costo pattuito è esente IVA, in quanto il servizio offerto rientra tra le operazioni assoggettate al reverse charge ai sensi dell’art. 17 del D.P.R. 633/1972.',
          italics: true,
          fontSize: 10,
          margin: [0, 0, 0, 30]
        },
        {
          text: 'Certi di aver fatto cosa gradita, Porgiamo i Nostri più cordiali saluti.',
          margin: [0, 0, 0, 10]
        },
        {
          text: 'M2I S.r.l.',
          bold: true,
          margin: [0, 0, 0, 0]
        }
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
        allegato_preventivo: allegato_url
      };

      const [id] = await knex('preventivi').insert(insertData);
      insertData.id = id;

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

exports.updateStato = async (req, res) => {
  try {
    const { id } = req.params;
    const { stato } = req.body;
    await knex('preventivi').where({ id }).update({ stato });
    res.json({ message: 'Stato aggiornato' });
  } catch (error) {
    console.error("Errore update stato preventivo:", error);
    res.status(500).json({ error: error.message });
  }
};
