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

pdfmake.setFonts(fonts);

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
            ['Ore Ordinarie Lavorate', `€ ${parseFloat(data.paga_lavorato).toFixed(2)}`],
            ['Ferie, Permessi, Malattia', `€ ${parseFloat(data.paga_ferie_permessi_malattia).toFixed(2)}`],
            ['Maggiorazioni/Bonus', `€ ${parseFloat(data.maggiorazioni || 0).toFixed(2)}`],
            ['Trattenute/Detrazioni', `€ -${parseFloat(data.detrazioni || 0).toFixed(2)}`]
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 10, 0, 20]
      },

      { text: `Netto da Pagare: € ${parseFloat(data.da_pagare).toFixed(2)}`, style: 'totale' }
    ],
    styles: defaultStyles,
    defaultStyle: { font: 'Roboto' }
  };

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
      
      { text: `Totale Imponibile: € ${parseFloat(data.imponibile).toFixed(2)}`, style: 'totale' }
    ],
    styles: defaultStyles,
    defaultStyle: { font: 'Roboto' }
  };

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
    if (row.notaMensile) noteText.push({ text: row.notaMensile, fontSize: 9, color: '#334155' });

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
  return pdfmake.createPdf(docDefinition);
}

// 7. Generatore Stampa Massiva Elaborato Dipendenti
function buildStampaElaboratoDipendentiPDF(datiCompleti, mese, anno) {
  const tableBody = [
    [
      { text: 'Dipendente', style: 'tabellaHeader' },
      { text: 'Ore Lav.', style: 'tabellaHeader' },
      { text: 'Paga Lav.', style: 'tabellaHeader' },
      { text: 'Paga F.P.M.', style: 'tabellaHeader' },
      { text: 'Magg.', style: 'tabellaHeader' },
      { text: 'Detr.', style: 'tabellaHeader' },
      { text: 'Netto Spettante', style: 'tabellaHeader' },
      { text: 'Note', style: 'tabellaHeader' }
    ]
  ];

  let totaleNetto = 0;

  datiCompleti.forEach(row => {
    totaleNetto += parseFloat(row.stipendioNetto || 0);

    const maggText = [];
    maggText.push({ text: '€\u00A0' + parseFloat(row.maggiorazioni || 0).toFixed(2), alignment: 'right', style: 'testo' });
    if (row.noteMaggiorazioni) {
      maggText.push({ text: '\n' + row.noteMaggiorazioni, fontSize: 8, italics: true, color: '#64748b', alignment: 'right' });
    }

    const detrText = [];
    detrText.push({ text: '€\u00A0' + parseFloat(row.detrazioni || 0).toFixed(2), alignment: 'right', style: 'testo' });
    if (row.noteDetrazioni) {
      detrText.push({ text: '\n' + row.noteDetrazioni, fontSize: 8, italics: true, color: '#64748b', alignment: 'right' });
    }

    const noteText = [];
    if (row.notaFissa) noteText.push({ text: '[FISSE] ' + row.notaFissa, fontSize: 9, color: '#475569', margin: [0, 0, 0, 2] });
    if (row.notaMensile) noteText.push({ text: row.notaMensile, fontSize: 9, color: '#334155' });
    if (row.noteGenerali && typeof row.noteGenerali === 'string') {
        const noteGenStr = row.noteGenerali.trim();
        if (noteGenStr && noteGenStr !== row.notaMensile) noteText.push({ text: '[VECCHIE] ' + noteGenStr, fontSize: 9, color: '#334155' });
    }

    tableBody.push([
      [
        { text: row.cognomeNome, style: 'testo' },
        { text: 'IBAN: ' + (row.iban || 'N/D'), fontSize: 8, color: '#64748b', margin: [0, 2, 0, 0] }
      ],
      { text: parseFloat(row.oreLavorate || 0).toFixed(1) + '\u00A0h', style: 'testo', alignment: 'right' },
      { text: '€\u00A0' + parseFloat(row.pagaLavorato || 0).toFixed(2), style: 'testo', alignment: 'right' },
      (() => {
        const fpmLines = [{ text: '€\u00A0' + parseFloat(row.pagaFPM || 0).toFixed(2), alignment: 'right', style: 'testo' }];
        if (row.dettaglioFPM && typeof row.dettaglioFPM === 'object') {
          Object.entries(row.dettaglioFPM)
            .filter(([causale]) => !causale.toLowerCase().includes('extra'))
            .forEach(([causale, ore]) => {
              fpmLines.push({ text: causale + ': ' + parseFloat(ore).toFixed(1) + ' h', fontSize: 8, italics: true, color: '#64748b', alignment: 'right' });
            });
        }
        return fpmLines;
      })(),
      maggText,
      detrText,
      { text: '€\u00A0' + parseFloat(row.stipendioNetto || 0).toFixed(2), style: 'testo', alignment: 'right', bold: true, fontSize: 11 },
      noteText.length > 0 ? noteText : { text: '' }
    ]);
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
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', '*'],
          body: tableBody
        },
        layout: {
          fillColor: function (rowIndex, node, columnIndex) {
            if (rowIndex === 0) return null; // Header background is handled by style
            return (rowIndex % 2 === 0) ? '#f8fafc' : '#ffffff';
          },
          hLineWidth: function (i, node) { return 1; },
          vLineWidth: function (i, node) { return 0; },
          hLineColor: function (i, node) { return '#e2e8f0'; }
        }
      },
      { text: 'Totale Netto Erogato: €\u00A0' + totaleNetto.toFixed(2), style: 'totale', margin: [0, 20, 0, 0] }
    ],
    styles: defaultStyles,
    defaultStyle: { font: 'Roboto' }
  };
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
