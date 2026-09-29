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

// Variante grafica dell'elaborato: la stampa tabellare precedente resta invariata.
function buildReportGraficoDipendentiPDF(datiCompleti, mese, anno) {
  const mesiNomi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const periodo = `${mesiNomi[Number(mese) - 1] || mese} ${anno}`;
  const euro = valore => {
    const [intero, decimali] = Number(valore || 0).toFixed(2).split('.');
    return `€ ${intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimali}`;
  };
  const ore = valore => `${Number(valore || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
  const totale = campo => datiCompleti.reduce((somma, row) => somma + (Number(row[campo]) || 0), 0);
  const conBusta = datiCompleti.filter(row => row.nettoBusta !== null && row.nettoBusta !== undefined && Number.isFinite(Number(row.nettoBusta)));
  const totaleBuste = conBusta.reduce((somma, row) => somma + Number(row.nettoBusta), 0);
  const blu = '#124f91';
  const bluScuro = '#0b285d';
  const azzurro = '#e8f4ff';
  const colWidths = ['*', 65, 80, 80, 100, 65, 65, 100, 105, 105];

  const icon = (tipo, inverse = false) => {
    const base = '<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">';
    const end = '</svg>';
    const icons = {
      people: '<circle cx="19" cy="11" r="6" fill="white"/><path d="M7 32v-4a12 12 0 0 1 24 0v4z" fill="white"/>',
      group: '<circle cx="19" cy="9" r="6" fill="white"/><circle cx="7" cy="15" r="4" fill="white"/><circle cx="31" cy="15" r="4" fill="white"/><path d="M10 33v-6a9 9 0 0 1 18 0v6zM1 33v-8a6 6 0 0 1 8-5v13zM29 20a6 6 0 0 1 8 5v8h-8z" fill="white"/>',
      calendar: '<rect x="5" y="8" width="28" height="26" rx="3" fill="none" stroke="white" stroke-width="3"/><path d="M5 16h28M12 4v8M26 4v8" fill="none" stroke="white" stroke-width="3"/><rect x="11" y="21" width="5" height="5" fill="white"/><rect x="22" y="21" width="5" height="5" fill="white"/>',
      clock: '<circle cx="19" cy="19" r="14" fill="none" stroke="white" stroke-width="3"/><path d="M19 10v10l7 4" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>',
      coins: '<ellipse cx="15" cy="14" rx="9" ry="4" fill="white"/><path d="M6 14v10c0 5 18 5 18 0V14M6 19c0 5 18 5 18 0" fill="none" stroke="white" stroke-width="2"/><ellipse cx="27" cy="10" rx="7" ry="3" fill="white"/>',
      hand: '<path d="M7 22h10l5-7a4 4 0 0 1 7 4l-6 10H7z" fill="white"/><path d="M8 11h22v3H8z" fill="white"/>',
      chart: '<rect x="6" y="22" width="5" height="10" rx="1" fill="white"/><rect x="16" y="15" width="5" height="17" rx="1" fill="white"/><rect x="26" y="7" width="5" height="25" rx="1" fill="white"/>',
      note: '<rect x="7" y="5" width="24" height="28" rx="3" fill="white"/><path d="M12 14h14M12 20h14M12 26h10" fill="none" stroke="#1b5c9d" stroke-width="2"/>'
    };
    const badgeColor = inverse === 'avatar' ? '#d9edff' : inverse ? '#ffffff' : '#1b5c9d';
    const badge = ['note', 'group', 'calendar'].includes(tipo) ? '' : `<circle cx="19" cy="19" r="18" fill="${badgeColor}"/>`;
    const glyph = inverse ? (icons[tipo] || icons.people).replaceAll('white', '#1b5c9d') : (icons[tipo] || icons.people);
    return base + badge + glyph + end;
  };

  const metric = (tipo, etichetta, valore, dettaglio = '', dark = false) => ({
    table: {
      widths: [49, '*'],
      body: [[
        { svg: icon(tipo, dark), width: 45, height: 45, margin: [0, 4, 0, 0] },
        { stack: [
          { text: etichetta.toUpperCase(), fontSize: 10, bold: true, color: dark ? '#d7ebff' : blu, margin: [0, 0, 0, 6] },
          { text: valore, fontSize: 23, bold: true, color: dark ? '#ffffff' : bluScuro },
          ...(dettaglio ? [{ text: dettaglio, fontSize: 8, color: dark ? '#d7ebff' : '#527195', margin: [0, 4, 0, 0] }] : [])
        ] }
      ]]
    },
    layout: {
      fillColor: () => dark ? '#15538f' : azzurro,
      hLineWidth: () => 0, vLineWidth: () => 0,
      paddingLeft: () => 9, paddingRight: () => 4,
      paddingTop: () => 14, paddingBottom: () => 14
    }
  });

  const headerCell = text => ({ text, bold: true, color: '#ffffff', fontSize: 14, margin: [0, 9, 0, 9] });
  const valueCell = (text, bold = false) => ({ text, fontSize: bold ? 18 : 16, bold, color: bluScuro, fillColor: bold ? '#e2f1ff' : undefined, margin: [0, 10, 0, 0], noWrap: true });
  const tableLayout = {
    hLineWidth: () => 0, vLineWidth: () => 0,
    paddingLeft: () => 5, paddingRight: () => 5,
    paddingTop: () => 3, paddingBottom: () => 3
  };
  const tableBody = [[{
    table: { widths: colWidths, body: [[
      headerCell('Dipendente'), headerCell('Ore Lav.'), headerCell('Paga Lav.'),
      headerCell('Paga F.P.M.'), headerCell('Spec. F.P.M.'), headerCell('Magg.'),
      headerCell('Detr.'), headerCell('Spec. M/D'), headerCell('Netto spettante'),
      headerCell('Netto busta')
    ]] },
    layout: { ...tableLayout, fillColor: () => '#1969b8' }
  }]];

  datiCompleti.forEach(row => {
    const dettaglio = row.dettaglioFPM && typeof row.dettaglioFPM === 'object' ? row.dettaglioFPM : {};
    const specFPM = Object.entries(dettaglio)
      .filter(([causale, quantita]) => !causale.toLowerCase().includes('extra') && Number(quantita) > 0)
      .map(([causale, quantita]) => `${causale}: ${ore(quantita)}`).join('\n') || '-';
    const specMD = [
      row.noteMaggiorazioni?.trim() ? `[M] ${row.noteMaggiorazioni.trim()}` : '',
      row.noteDetrazioni?.trim() ? `[D] ${row.noteDetrazioni.trim()}` : ''
    ].filter(Boolean).join('\n') || '-';
    const note = [
      row.notaFissa?.trim() ? `[FISSE] ${row.notaFissa.trim()}` : '',
      row.notaMensile?.trim() ? `[MESE] ${row.notaMensile.trim()}` : '',
      row.noteGenerali?.trim() && row.noteGenerali.trim() !== row.notaMensile?.trim() ? `[VECCHIE] ${row.noteGenerali.trim()}` : ''
    ].filter(Boolean).join('\n') || '-';
    const nettoBusta = row.nettoBusta !== null && row.nettoBusta !== undefined && Number.isFinite(Number(row.nettoBusta));
    const employee = {
      rowSpan: 2,
      columns: [
        { svg: icon('people', 'avatar'), width: 45, height: 45, margin: [0, 4, 0, 0] },
        { width: '*', stack: [
          { text: row.cognomeNome || 'Dipendente', bold: true, fontSize: 17, color: bluScuro, margin: [0, 0, 0, 4] },
          { text: 'IBAN', fontSize: 13, color: '#416c9f' },
          { text: row.iban || 'Non disponibile', fontSize: 13, color: '#244b80' }
        ] }
      ]
    };
    const noteCell = {
      colSpan: 9,
      columns: [
        { svg: icon('note'), width: 23, height: 23 },
        { text: 'NOTE', width: 48, fontSize: 14, bold: true, color: blu },
        { text: note, width: '*', fontSize: 14, color: '#244b80' }
      ],
      fillColor: '#e9f3fc'
    };
    tableBody.push([{
      table: {
        widths: colWidths,
        heights: rowIndex => rowIndex === 0 ? 51 : 29,
        body: [
          [
            employee,
            valueCell(ore(row.oreLavorate)), valueCell(euro(row.pagaLavorato)),
            valueCell(euro(row.pagaFPM)), { text: specFPM, fontSize: 13, color: '#244b80', margin: [0, 8, 0, 0] },
            valueCell(euro(row.maggiorazioni)), valueCell(euro(row.detrazioni)),
            { text: specMD, fontSize: 13, color: '#244b80', margin: [0, 8, 0, 0] },
            valueCell(euro(row.stipendioNetto), true),
            { text: nettoBusta ? euro(row.nettoBusta) : 'Non disponibile', fontSize: nettoBusta ? 18 : 12, bold: nettoBusta, color: nettoBusta ? bluScuro : '#6b829c', fillColor: nettoBusta ? '#e2f1ff' : undefined, margin: [0, 9, 0, 0] }
          ],
          ['', noteCell, '', '', '', '', '', '', '', '']
        ]
      },
      layout: {
        ...tableLayout,
        vLineWidth: i => i === 0 || i === 10 ? 0 : 0.35,
        vLineColor: () => '#d4e5f4',
        paddingTop: rowIndex => rowIndex === 1 ? 6 : 4,
        paddingBottom: rowIndex => rowIndex === 1 ? 6 : 4
      }
    }]);
  });

  const docDefinition = {
    pageSize: 'A3', pageOrientation: 'landscape',
    pageMargins: [24, 223, 24, 33],
    header: () => ({
      stack: [
        {
        table: { widths: ['*', 225, 145], body: [[
          { columns: [
            { svg: icon('group'), width: 63, height: 63, margin: [0, 3, 0, 0] },
            { width: '*', stack: [
              { text: 'ELABORATO DIPENDENTI', fontSize: 33, bold: true, color: '#ffffff' },
              { text: periodo.toUpperCase(), fontSize: 21, color: '#e1efff' }
            ] }
          ] },
          { fillColor: '#13518f', columns: [
            { svg: icon('calendar'), width: 36, height: 36, margin: [0, 10, 0, 0] },
            { width: '*', stack: [
              { text: 'Periodo di riferimento', fontSize: 11, color: '#e1efff' },
              { text: periodo, fontSize: 16, bold: true, color: '#ffffff', margin: [0, 8, 0, 0] }
            ] }
          ] },
          { fillColor: '#2468a7', columns: [
            { width: '*', stack: [
              { text: 'Totale dipendenti', fontSize: 11, color: '#e1efff' },
              { text: String(datiCompleti.length), fontSize: 27, bold: true, color: '#ffffff' }
            ] },
            { svg: icon('group'), width: 40, height: 40, margin: [0, 8, 0, 0] }
          ] }
        ]] },
        layout: {
          fillColor: () => '#104780',
          hLineWidth: () => 0, vLineWidth: () => 0,
          paddingLeft: () => 17, paddingRight: () => 12,
          paddingTop: () => 17, paddingBottom: () => 17
        },
        margin: [0, 0, 0, 9]
      },
      {
        columns: [
          metric('clock', 'Totale ore lavorate', ore(totale('oreLavorate'))),
          metric('coins', 'Totale paga lavoro', euro(totale('pagaLavorato'))),
          metric('hand', 'Totale paga F.P.M.', euro(totale('pagaFPM'))),
          metric('chart', 'Totale netto spettante', euro(totale('stipendioNetto')), '', true),
          metric('coins', 'Totale netto busta', conBusta.length ? euro(totaleBuste) : 'Non disponibile', `${conBusta.length}/${datiCompleti.length} buste caricate`, true)
        ],
        columnGap: 6
      }
      ],
      margin: [24, 16, 24, 0]
    }),
    content: [
      {
        table: { headerRows: 1, dontBreakRows: true, widths: ['*'], body: tableBody },
        layout: {
          hLineWidth: i => i > 1 && i < tableBody.length ? 2 : 0,
          hLineColor: () => '#6e9fcf',
          vLineWidth: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 3
        }
      }
    ],
    footer: (pagina, pagine) => ({
      columns: [
        { text: `Elaborato generato il ${new Date().toLocaleDateString('it-IT')}`, alignment: 'left' },
        { text: `Documento riservato - Uso interno  ·  ${pagina}/${pagine}`, alignment: 'right' }
      ],
      fontSize: 10, color: '#426a9a', margin: [24, 0, 24, 0]
    }),
    defaultStyle: { font: 'Roboto' }
  };
  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

// Variante grafica clienti: il tracciato tabellare precedente resta disponibile.
function buildReportGraficoClientiPDF(datiCompleti, mese, anno) {
  const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const periodo = `${mesi[Number(mese) - 1] || mese} ${anno}`;
  const numero = valore => Number(valore) || 0;
  const euro = valore => {
    const [intero, decimali] = numero(valore).toFixed(2).split('.');
    return `€ ${intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimali}`;
  };
  const ore = valore => `${numero(valore).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
  const totale = campo => datiCompleti.reduce((somma, row) => somma + numero(row[campo]), 0);
  const verde = '#087a59';
  const verdeScuro = '#064a39';
  const verdeChiaro = '#e8f7f0';
  const widths = ['*', 62, 70, 90, 100, 120, 105, 100, 110];

  const icon = (tipo, scuro = false) => {
    const glyphs = {
      group: '<circle cx="11" cy="11" r="5"/><circle cx="27" cy="11" r="5"/><path d="M2 33v-8a9 9 0 0 1 18 0v8zM18 33v-8a9 9 0 0 1 18 0v8z"/>',
      building: '<path d="M6 34V8h21v26M27 16h6v18M11 14h4m5 0h3m-12 7h4m5 0h3m-12 7h4m5 0h3" fill="none" stroke="white" stroke-width="3"/><path d="M15 34v-6h5v6"/>',
      calendar: '<rect x="5" y="8" width="28" height="26" rx="3" fill="none" stroke="white" stroke-width="3"/><path d="M5 16h28M12 4v8M26 4v8" fill="none" stroke="white" stroke-width="3"/><rect x="11" y="21" width="5" height="5"/><rect x="22" y="21" width="5" height="5"/>',
      clock: '<circle cx="19" cy="19" r="14" fill="none" stroke="white" stroke-width="3"/><path d="M19 10v10l7 4" fill="none" stroke="white" stroke-width="3"/>',
      coins: '<ellipse cx="15" cy="14" rx="9" ry="4"/><path d="M6 14v10c0 5 18 5 18 0V14M6 19c0 5 18 5 18 0" fill="none" stroke="white" stroke-width="2"/><ellipse cx="27" cy="10" rx="7" ry="3"/>',
      chart: '<rect x="6" y="22" width="5" height="10" rx="1"/><rect x="16" y="15" width="5" height="17" rx="1"/><rect x="26" y="7" width="5" height="25" rx="1"/>',
      note: '<rect x="7" y="5" width="24" height="28" rx="3"/><path d="M12 14h14M12 20h14M12 26h10" fill="none" stroke="#087a59" stroke-width="2"/>'
    };
    const badge = ['group', 'calendar'].includes(tipo) ? '' : `<circle cx="19" cy="19" r="18" fill="${scuro ? '#ffffff' : '#118967'}"/>`;
    const glyph = scuro ? glyphs[tipo].replaceAll('white', '#087a59') : glyphs[tipo];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38" fill="white">${badge}${glyph}</svg>`;
  };

  const metric = (tipo, label, value, dark = false) => ({
    table: { widths: [49, '*'], body: [[
      { svg: icon(tipo, dark), width: 45, height: 45, margin: [0, 4, 0, 0] },
      { stack: [
        { text: label.toUpperCase(), fontSize: 10, bold: true, color: dark ? '#d7fff0' : verde, margin: [0, 0, 0, 6] },
        { text: value, fontSize: 23, bold: true, color: dark ? '#ffffff' : verdeScuro }
      ] }
    ]] },
    layout: {
      fillColor: () => dark ? '#087a59' : verdeChiaro,
      hLineWidth: () => 0, vLineWidth: () => 0,
      paddingLeft: () => 9, paddingRight: () => 4,
      paddingTop: () => 14, paddingBottom: () => 14
    }
  });

  const headerCell = text => ({ text, bold: true, color: '#ffffff', fontSize: 14, margin: [0, 9, 0, 9] });
  const valueCell = (text, bold = false) => ({ text, fontSize: bold ? 18 : 16, bold, color: verdeScuro, fillColor: bold ? '#def4e9' : undefined, margin: [0, 10, 0, 0], noWrap: true });
  const cellLayout = {
    hLineWidth: () => 0, vLineWidth: () => 0,
    paddingLeft: () => 5, paddingRight: () => 5,
    paddingTop: () => 3, paddingBottom: () => 3
  };
  const tableBody = [[{
    table: { widths, body: [[
      headerCell('Cliente'), headerCell('Ore'), headerCell('Tariffa'), headerCell('Base imp.'),
      headerCell('Sconti / Magg.'), headerCell('Spec. S/M'), headerCell('Totale imp.'),
      headerCell('Regime fiscale'), headerCell('Tassato')
    ]] },
    layout: { ...cellLayout, fillColor: () => verde }
  }]];

  datiCompleti.forEach(row => {
    const differenza = numero(row.maggiorazioni) - numero(row.sconti);
    const specSM = [
      row.noteMaggiorazioni?.trim() ? `[M] ${row.noteMaggiorazioni.trim()}` : '',
      row.noteSconti?.trim() ? `[S] ${row.noteSconti.trim()}` : ''
    ].filter(Boolean).join('\n') || '-';
    const note = [
      row.notaFissa?.trim() ? `[FISSE] ${row.notaFissa.trim()}` : '',
      row.notaMensile?.trim() ? `[MESE] ${row.notaMensile.trim()}` : ''
    ].filter(Boolean).join('\n') || '-';
    const client = {
      rowSpan: 2,
      columnGap: 12,
      columns: [
        { svg: icon('building'), width: 43, height: 43, margin: [0, 2, 0, 0], color: verde },
        { width: '*', text: row.ragioneSociale || 'Cliente', bold: true, fontSize: 17, color: verdeScuro, margin: [0, 9, 0, 0] }
      ]
    };
    const noteCell = {
      colSpan: 8,
      columnGap: 8,
      columns: [
        { svg: icon('note'), width: 23, height: 23 },
        { text: 'NOTE', width: 48, fontSize: 14, bold: true, color: verde },
        { text: note, width: '*', fontSize: 14, color: '#215e4c' }
      ],
      fillColor: '#e9f7f0'
    };
    tableBody.push([{
      table: {
        widths,
        heights: rowIndex => rowIndex === 0 ? 51 : 29,
        body: [
          [
            client,
            valueCell(ore(row.oreLavorate)), valueCell(euro(row.tariffaOraria)),
            valueCell(euro(row.baseImponibile)), valueCell(euro(differenza)),
            { text: specSM, fontSize: 13, color: '#215e4c', margin: [0, 8, 0, 0] },
            valueCell(euro(row.imponibile)),
            { text: row.tipoTassazione || '-', fontSize: 14, color: verdeScuro, margin: [0, 10, 0, 0] },
            valueCell(euro(row.importoTotale), true)
          ],
          ['', noteCell, '', '', '', '', '', '', '']
        ]
      },
      layout: {
        ...cellLayout,
        vLineWidth: i => i === 0 || i === 9 ? 0 : 0.35,
        vLineColor: () => '#cde9dc',
        paddingTop: rowIndex => rowIndex === 1 ? 6 : 4,
        paddingBottom: rowIndex => rowIndex === 1 ? 6 : 4
      }
    }]);
  });

  const docDefinition = {
    pageSize: 'A3', pageOrientation: 'landscape',
    pageMargins: [24, 223, 24, 33],
    header: () => ({
      stack: [
        {
          table: { widths: ['*', 225, 145], body: [[
            { columns: [
              { svg: icon('group'), width: 63, height: 63, margin: [0, 3, 0, 0] },
              { width: '*', stack: [
                { text: 'ELABORATO CLIENTI', fontSize: 33, bold: true, color: '#ffffff' },
                { text: periodo.toUpperCase(), fontSize: 21, color: '#ddffed' }
              ] }
            ] },
            { fillColor: '#096a50', columns: [
              { svg: icon('calendar'), width: 36, height: 36, margin: [0, 10, 0, 0] },
              { width: '*', stack: [
                { text: 'Periodo di riferimento', fontSize: 11, color: '#ddffed' },
                { text: periodo, fontSize: 16, bold: true, color: '#ffffff', margin: [0, 8, 0, 0] }
              ] }
            ] },
            { fillColor: '#168a66', columns: [
              { width: '*', stack: [
                { text: 'Totale clienti', fontSize: 11, color: '#ddffed' },
                { text: String(datiCompleti.length), fontSize: 27, bold: true, color: '#ffffff' }
              ] },
              { svg: icon('group'), width: 40, height: 40, margin: [0, 8, 0, 0] }
            ] }
          ]] },
          layout: {
            fillColor: () => '#075c45',
            hLineWidth: () => 0, vLineWidth: () => 0,
            paddingLeft: () => 17, paddingRight: () => 12,
            paddingTop: () => 17, paddingBottom: () => 17
          },
          margin: [0, 0, 0, 9]
        },
        {
          columns: [
            metric('clock', 'Totale ore erogate', ore(totale('oreLavorate'))),
            metric('chart', 'Totale imponibile', euro(totale('imponibile'))),
            metric('coins', 'Totale tassato', euro(totale('importoTotale'))),
            metric('coins', 'Totale realmente fatturato', euro(totale('importoRealmenteFatturato')), true)
          ],
          columnGap: 6
        }
      ],
      margin: [24, 16, 24, 0]
    }),
    content: [{
      table: { headerRows: 1, dontBreakRows: true, widths: ['*'], body: tableBody },
      layout: {
        hLineWidth: i => i > 1 && i < tableBody.length ? 2 : 0,
        hLineColor: () => '#6cb398',
        vLineWidth: () => 0,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 0, paddingBottom: () => 3
      }
    }],
    footer: (pagina, pagine) => ({
      columns: [
        { text: `Elaborato generato il ${new Date().toLocaleDateString('it-IT')}`, alignment: 'left' },
        { text: `Documento riservato - Uso interno  ·  ${pagina}/${pagine}`, alignment: 'right' }
      ],
      fontSize: 10, color: '#367c62', margin: [24, 0, 24, 0]
    }),
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
  buildReportGraficoDipendentiPDF,
  buildReportGraficoClientiPDF,
  buildFoglioPresenzePDF
};
