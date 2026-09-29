const pdfmake = require('pdfmake');
const path = require('path');

const fonts = {
  Roboto: {
    normal: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
    bold: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
    italics: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf')
  }
};



const defaultStyles = {
  header: { fontSize: 18, bold: true, color: '#1e293b', margin: [0, 0, 0, 10] },
  subheader: { fontSize: 14, bold: true, color: '#475569', margin: [0, 10, 0, 5] },
  testo: { fontSize: 10, color: '#334155' },
  tabellaHeader: { bold: true, fontSize: 11, color: 'white', fillColor: '#3b82f6', alignment: 'center' },
  totale: { fontSize: 12, bold: true, alignment: 'right', margin: [0, 10, 0, 0] }
};

function logoHeader() {
  return {
    columns: [
      {
        text: 'M2I S.r.l.',
        fontSize: 24,
        bold: true,
        color: '#2563eb',
        width: '*'
      },
      {
        text: "P.IVA: 15989811003\nVia del Fontanile Anagnino, 183\n00118 Roma (RM)",
        alignment: 'right',
        fontSize: 10,
        color: '#64748b',
        width: 'auto'
      }
    ],
    margin: [0, 0, 0, 20]
  };
}

// 1. Generatore Fattura PDF
function buildFatturaPDF(fattura) {
  const docDefinition = {
    content: [
      logoHeader(),
      { text: `FATTURA DI CORTESIA N. ${fattura.numero_fattura || fattura.numero}`, style: 'header' },
      { text: `Data Emissione: ${fattura.data_fattura || fattura.dataEmissione}`, style: 'testo', margin: [0, 0, 0, 20] },
      
      {
        columns: [
          {
            text: [
              { text: 'Spett.le Cliente:\n', bold: true },
              `${fattura.cliente}`
            ],
            width: '*'
          },
          {
            text: [
              { text: 'Scadenza Pagamento:\n', bold: true },
              (fattura.stato_pagamento || fattura.stato) === 'Emessa' ? 'Da definire' : 'Immediato'
            ],
            alignment: 'right',
            width: 'auto'
          }
        ],
        margin: [0, 0, 0, 20]
      },

      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: [
            [{ text: 'Descrizione', style: 'tabellaHeader' }, { text: 'Q.tà', style: 'tabellaHeader' }, { text: 'Importo', style: 'tabellaHeader' }],
            ['Servizi erogati nel periodo di competenza', '1', `€ ${parseFloat(fattura.importo_imponibile || fattura.imponibile || 0).toFixed(2)}`]
          ]
        },
        layout: 'lightHorizontalLines'
      },

      {
        columns: [
          { text: '', width: '*' },
          {
            table: {
              widths: ['auto', 'auto'],
              body: [
                ['Imponibile:', { text: `€ ${parseFloat(fattura.importo_imponibile || fattura.imponibile || 0).toFixed(2)}`, alignment: 'right' }],
                ['IVA (22%):', { text: `€ ${parseFloat((fattura.importo_totale || fattura.totale || 0) - (fattura.importo_imponibile || fattura.imponibile || 0)).toFixed(2)}`, alignment: 'right' }],
                [{ text: 'TOTALE:', bold: true }, { text: `€ ${parseFloat(fattura.importo_totale || fattura.totale || 0).toFixed(2)}`, bold: true, alignment: 'right' }]
              ]
            },
            layout: 'noBorders',
            margin: [0, 20, 0, 0]
          }
        ]
      }
    ],
    styles: defaultStyles,
    defaultStyle: { font: 'Roboto' }
  };

  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

// 2. Generatore Elaborato Dipendente (Busta Paga)
function buildElaboratoDipendentePDF(data) {
  const docDefinition = {
    content: [
      logoHeader(),
      { text: `PROSPETTO RETRIBUZIONE INTERNO`, style: 'header' },
      { text: `Mese di Competenza: ${data.mese}/${data.anno}`, style: 'testo', margin: [0, 0, 0, 20] },
      
      { text: `Dipendente: ${data.cognome_nome}`, style: 'subheader' },
      
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto'],
          body: [
            [{ text: 'Voce Retributiva', style: 'tabellaHeader' }, { text: 'Importo', style: 'tabellaHeader' }],
            ['Ore Ordinarie Lavorate', `€ ${parseFloat(data.paga_lavorato || 0).toFixed(2)}`],
            ['Ferie, Permessi, Malattia', `€ ${parseFloat(data.paga_ferie_permessi_malattia || 0).toFixed(2)}`],
            ['Maggiorazioni/Bonus', `€ ${parseFloat(data.maggiorazioni || 0).toFixed(2)}`],
            ['Trattenute/Detrazioni', `€ -${parseFloat(data.detrazioni || 0).toFixed(2)}`]
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 10, 0, 20]
      },

      { text: `Netto da Pagare: € ${parseFloat(data.da_pagare ?? data.stipendio_netto ?? 0).toFixed(2)}`, style: 'totale' },
      ...(data.notaFissa ? [{ text: `Note fisse: ${data.notaFissa}`, style: 'testo', margin: [0, 15, 0, 3] }] : []),
      ...(data.notaMensile ? [{ text: `Note del mese: ${data.notaMensile}`, style: 'testo', margin: [0, 3, 0, 3] }] : [])
    ],
    styles: defaultStyles,
    defaultStyle: { font: 'Roboto' }
  };

  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

// 3. Generatore Elaborato Cliente (Rendiconto Ore)
function buildElaboratoClientePDF(data) {
  const docDefinition = {
    content: [
      logoHeader(),
      { text: `FATTURA CORTESIA`, style: 'header' },
      { text: `Competenza: ${data.mese}/${data.anno}`, style: 'testo', margin: [0, 0, 0, 20] },
      
      { text: `Cliente: ${data.ragione_sociale}`, style: 'subheader' },
      
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: [
            [{ text: 'Descrizione', style: 'tabellaHeader' }, { text: 'Ore Totali', style: 'tabellaHeader' }, { text: 'Imponibile Calcolato', style: 'tabellaHeader' }],
            ['Servizi di pulizia', `${data.ore_lavorate} h`, `€ ${parseFloat(data.imponibile).toFixed(2)}`]
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 10, 0, 20]
      },
      
      { text: `Totale Imponibile: € ${parseFloat(data.imponibile).toFixed(2)}`, style: 'totale' },
      ...(data.notaFissa ? [{ text: `Note fisse: ${data.notaFissa}`, style: 'testo', margin: [0, 15, 0, 3] }] : []),
      ...(data.notaMensile ? [{ text: `Note del mese: ${data.notaMensile}`, style: 'testo', margin: [0, 3, 0, 3] }] : [])
    ],
    styles: defaultStyles,
    defaultStyle: { font: 'Roboto' }
  };

  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

// 4. Generatore Prospetto Provvigioni
function buildProvvigioniPDF(data) {
  const docDefinition = {
    content: [
      logoHeader(),
      { text: `PROSPETTO LIQUIDAZIONE PROVVIGIONI`, style: 'header' },
      { text: `Mese di Competenza: ${data.mese}/${data.anno}`, style: 'testo', margin: [0, 0, 0, 20] },
      
      { text: `Commerciale: ${data.commerciale}`, style: 'subheader' },
      
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: [
            [{ text: 'Cliente', style: 'tabellaHeader' }, { text: 'Imponibile Cliente', style: 'tabellaHeader' }, { text: 'Provvigione', style: 'tabellaHeader' }],
            [data.ragione_sociale, `€ ${parseFloat(data.imponibile_cliente).toFixed(2)}`, `€ ${parseFloat(data.provvigione_comm_totale || 0).toFixed(2)}`]
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 10, 0, 20]
      },

      { text: `Totale Provvigioni Spettanti: € ${parseFloat(data.provvigione_comm_totale || 0).toFixed(2)}`, style: 'totale' }
    ],
    styles: defaultStyles,
    defaultStyle: { font: 'Roboto' }
  };

  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

// 5. Generatore Foglio Presenze
function buildFoglioPresenzePDF(data) {
  const docDefinition = {
    pageOrientation: 'landscape',
    content: [
      logoHeader(),
      { text: `FOGLIO PRESENZE MENSILE`, style: 'header' },
      { text: `Mese: ${data.mese}/${data.anno} - Dipendente: ${data.dipendente}`, style: 'testo', margin: [0, 0, 0, 20] },
      
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', '*', 'auto'],
          body: [
            [
              { text: 'Giorno', style: 'tabellaHeader' }, 
              { text: 'Causale', style: 'tabellaHeader' }, 
              { text: 'Ore', style: 'tabellaHeader' }, 
              { text: 'Cliente/Cantiere', style: 'tabellaHeader' },
              { text: 'Firma Dipendente', style: 'tabellaHeader' }
            ],
            ...(data.giorni || []).map(g => [
              g.giorno || '',
              g.tipo_ore || '',
              g.quantita_ore || '',
              g.cliente || '',
              '' // spazio per firma
            ])
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 10, 0, 30]
      },

      { text: `Totale Ore Lavorate: ${data.totale_ore || 0}`, style: 'totale' },
      { text: `\n\nFirma del Dipendente: _________________________________________`, style: 'testo', alignment: 'right' }
    ],
    styles: defaultStyles,
    defaultStyle: { font: 'Roboto' }
  };

  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

// 6. Generatore Stampa Massiva Elaborato Clienti
function buildStampaElaboratoClientiPDF(datiCompleti, mese, anno) {
  const tableBody = [
    [
      { text: 'Cliente', style: 'tabellaHeader' },
      { text: 'Ore', style: 'tabellaHeader' },
      { text: 'Tariffa', style: 'tabellaHeader' },
      { text: 'Base Imp.', style: 'tabellaHeader' },
      { text: 'Sconti/Magg.', style: 'tabellaHeader' },
      { text: 'Tot. Imp.', style: 'tabellaHeader' },
      { text: 'Tipo Tass.', style: 'tabellaHeader' },
      { text: 'Tassato', style: 'tabellaHeader' },
      { text: 'Note', style: 'tabellaHeader' }
    ]
  ];

  let totaleOre = 0;
  let totaleTassato = 0;

  datiCompleti.forEach(row => {
    totaleOre += parseFloat(row.oreLavorate || 0);
    totaleTassato += parseFloat(row.importoTotale || 0);

    const scontiMaggText = [];
    const diff = (parseFloat(row.maggiorazioni || 0)) - (parseFloat(row.sconti || 0));
    scontiMaggText.push({ text: '€\u00A0' + diff.toFixed(2), alignment: 'right', style: 'testo' });
    const noteRegolazioni = [row.noteMaggiorazioni, row.noteSconti].filter(Boolean).join(" | ");
    if (noteRegolazioni) {
      scontiMaggText.push({ text: '\n' + noteRegolazioni, fontSize: 8, italics: true, color: '#64748b', alignment: 'right' });
    }

    const noteText = [];
    if (row.notaFissa) noteText.push({ text: '[FISSE] ' + row.notaFissa, fontSize: 9, color: '#475569', margin: [0, 0, 0, 2] });
    if (row.notaMensile) noteText.push({ text: '[MESE] ' + row.notaMensile, fontSize: 9, color: '#334155' });

    tableBody.push([
      { text: row.ragioneSociale, style: 'testo' },
      { text: parseFloat(row.oreLavorate || 0).toFixed(1) + '\u00A0h', style: 'testo', alignment: 'right' },
      { text: '€\u00A0' + parseFloat(row.tariffaOraria || 0).toFixed(2), style: 'testo', alignment: 'right' },
      { text: '€\u00A0' + parseFloat(row.baseImponibile || 0).toFixed(2), style: 'testo', alignment: 'right' },
      scontiMaggText,
      { text: '€\u00A0' + parseFloat(row.imponibile || 0).toFixed(2), style: 'testo', alignment: 'right' },
      { text: row.tipoTassazione || '', style: 'testo', alignment: 'center' },
      { text: '€\u00A0' + parseFloat(row.importoTotale || 0).toFixed(2), style: 'testo', alignment: 'right', bold: true, fontSize: 11 },
      noteText.length > 0 ? noteText : { text: '' }
    ]);
  });

  const mesiNomi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const nomeMese = mesiNomi[parseInt(mese, 10) - 1] || mese;

  const docDefinition = {
    pageOrientation: 'landscape',
    content: [
      { text: 'ELABORATO CLIENTI', style: 'header' },
      { text: nomeMese.toUpperCase() + ' ' + anno, fontSize: 16, bold: true, color: '#334155', margin: [0, 0, 0, 15] },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', '*'],
          body: tableBody
        },
        layout: 'lightHorizontalLines'
      },
      { text: 'Totale Ore: ' + totaleOre.toFixed(1) + '\u00A0h  |  Totale Tassato: €\u00A0' + totaleTassato.toFixed(2), style: 'totale', margin: [0, 20, 0, 0] }
    ],
    styles: defaultStyles,
    defaultStyle: { font: 'Roboto' }
  };
  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

// 7. Generatore Stampa Massiva Elaborato Dipendenti
function buildStampaElaboratoDipendentiPDF(datiCompleti, mese, anno) {
  const colonne = ['*', 47, 55, 76, 70, 45, 45, 92, 80];
  const titoloColonna = text => ({ text, style: 'tabellaHeader', alignment: 'left' });
  const layoutValori = {
    hLineWidth: () => 0, vLineWidth: () => 0,
    paddingLeft: () => 6, paddingRight: () => 6,
    paddingTop: () => 6, paddingBottom: () => 6
  };
  const tableBody = [
    [
      {
        table: {
          widths: colonne,
          body: [[
            titoloColonna('Dipendente'),
            titoloColonna('Ore Lav.'),
            titoloColonna('Paga Lav.'),
            titoloColonna('Paga\u00A0F.P.M.'),
            titoloColonna('Spec. F.P.M.'),
            titoloColonna('Magg.'),
            titoloColonna('Detr.'),
            titoloColonna('Spec. M/D'),
            titoloColonna('Netto Spettante')
          ]]
        },
        layout: layoutValori
      }
    ]
  ];

  let totaleNetto = 0;

  datiCompleti.forEach(row => {
    totaleNetto += parseFloat(row.stipendioNetto || 0);

    const specMD = [];
    if (row.noteMaggiorazioni?.trim()) specMD.push({ text: '[M] ' + row.noteMaggiorazioni.trim(), fontSize: 8, color: '#475569', margin: [0, 0, 0, 2] });
    if (row.noteDetrazioni?.trim()) specMD.push({ text: '[D] ' + row.noteDetrazioni.trim(), fontSize: 8, color: '#475569', margin: [0, 0, 0, 2] });

    const noteText = [];
    if (row.notaFissa) noteText.push({ text: '[FISSE] ' + row.notaFissa, fontSize: 9, color: '#475569', margin: [0, 0, 0, 2] });
    if (row.notaMensile) noteText.push({ text: '[MESE] ' + row.notaMensile, fontSize: 9, color: '#334155' });
    if (row.noteGenerali && typeof row.noteGenerali === 'string') {
        const noteGenStr = row.noteGenerali.trim();
        if (noteGenStr && noteGenStr !== row.notaMensile) noteText.push({ text: '[VECCHIE] ' + noteGenStr, fontSize: 9, color: '#334155' });
    }

    const dettaglio = row.dettaglioFPM && typeof row.dettaglioFPM === 'object' ? row.dettaglioFPM : {};
    const righeFPM = Object.entries(dettaglio)
      .filter(([causale, ore]) => !causale.toLowerCase().includes('extra') && Number(ore) > 0)
      .map(([causale, ore]) => ({ text: `${causale}: ${Number(ore).toFixed(1)} h`, fontSize: 8, color: '#475569', margin: [0, 0, 0, 2] }));
    tableBody.push([{
      stack: [
          {
            table: {
              widths: colonne,
              heights: 24,
              body: [[
                { text: row.cognomeNome, style: 'testo', bold: true },
                { text: parseFloat(row.oreLavorate || 0).toFixed(1) + '\u00A0h', style: 'testo', alignment: 'left' },
                { text: '€\u00A0' + parseFloat(row.pagaLavorato || 0).toFixed(2), style: 'testo', alignment: 'left' },
                { text: '€\u00A0' + parseFloat(row.pagaFPM || 0).toFixed(2), style: 'testo', alignment: 'left' },
                righeFPM.length ? righeFPM : { text: '' },
                { text: '€\u00A0' + parseFloat(row.maggiorazioni || 0).toFixed(2), style: 'testo', alignment: 'left' },
                { text: '€\u00A0' + parseFloat(row.detrazioni || 0).toFixed(2), style: 'testo', alignment: 'left' },
                specMD.length ? specMD : { text: '' },
                { text: '€\u00A0' + parseFloat(row.stipendioNetto || 0).toFixed(2), style: 'testo', alignment: 'left', bold: true, fontSize: 11 }
              ]]
            },
            layout: { ...layoutValori, fillColor: () => '#f9fbfe' }
          },
          {
            table: {
              widths: [220, '*'],
              body: [[
                {
                  stack: [
                    { text: 'IBAN', fontSize: 8, bold: true, color: '#436282', margin: [0, 0, 0, 2] },
                    { text: row.iban || 'N/D', fontSize: 9, color: '#334155' }
                  ]
                },
                {
                  stack: [
                    { text: 'NOTE', fontSize: 8, bold: true, color: '#436282', margin: [0, 0, 0, 2] },
                    ...(noteText.length ? noteText : [{ text: '-', fontSize: 9, color: '#94a3b8' }])
                  ]
                }
              ]]
            },
            layout: {
              hLineWidth: i => i === 0 ? 0.5 : 0,
              hLineColor: () => '#dbe5f1', vLineWidth: () => 0,
              fillColor: () => '#edf4fb',
              paddingLeft: () => 8, paddingRight: () => 8,
              paddingTop: () => 6, paddingBottom: () => 7
            }
          }
        ]
    }]);
  });

  const mesiNomi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const nomeMese = mesiNomi[parseInt(mese, 10) - 1] || mese;

  const docDefinition = {
    pageOrientation: 'landscape',
    content: [
      { text: 'ELABORATO DIPENDENTI', style: 'header' },
      { text: nomeMese.toUpperCase() + ' ' + anno, fontSize: 16, bold: true, color: '#334155', margin: [0, 0, 0, 15] },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: ['*'],
          body: tableBody
        },
        layout: {
          hLineWidth: i => i > 1 && i < tableBody.length ? 1.5 : 0,
          hLineColor: () => '#8fa9c4', vLineWidth: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: i => i === 0 ? 0 : 6
        }
      },
      { text: 'Totale Netto Erogato: €\u00A0' + totaleNetto.toFixed(2), style: 'totale', margin: [0, 20, 0, 0] }
    ],
    styles: defaultStyles,
    defaultStyle: { font: 'Roboto' }
  };
  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

module.exports = {
  buildFatturaPDF,
  buildElaboratoDipendentePDF,
  buildElaboratoClientePDF,
  buildProvvigioniPDF,
  buildStampaElaboratoClientiPDF,
  buildStampaElaboratoDipendentiPDF,
  buildFoglioPresenzePDF
};
