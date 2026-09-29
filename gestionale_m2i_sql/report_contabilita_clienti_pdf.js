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

const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const widths = [190, 50, 91, 82, 78, 55, 76, 86, 94, 110, 86];
const number = value => Number(value) || 0;
const euro = value => `€ ${number(value).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hours = value => number(value).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const total = rows => rows.reduce((sum, row) => sum + number(row.importoTotale), 0);

function buildReportContabilitaClientiPDF(rows, mese, anno) {
  const periodo = `${months[Number(mese) - 1] || mese} ${anno}`;
  const daElaborare = rows.filter(row => !row.fatture?.length && !row.fatturaInviataAt);
  const elaborate = rows.filter(row => row.fatture?.length || row.fatturaInviataAt);
  const labels = [
    'Cliente (ragione sociale)', 'Ore', 'Sconti /\nMagg.', 'Totale\nimponibile', 'Regime\nfiscale',
    '% tassa', 'Tassa', 'Totale\nfattura', 'Costo\npersonale', 'Residuo senza\nstipendi', 'Tariffa\noraria'
  ];
  const cellLayout = {
    hLineWidth: () => 0, vLineWidth: i => i > 0 && i < widths.length ? 0.4 : 0,
    vLineColor: () => '#bdd8d0', paddingLeft: () => 4, paddingRight: () => 4,
    paddingTop: () => 8, paddingBottom: () => 8
  };

  const metric = (label, items, color, background) => ({
    table: { widths: ['*', 95], body: [[
      { stack: [
        { text: label.toUpperCase(), fontSize: 12, bold: true, color },
        { text: euro(total(items)), fontSize: 21, bold: true, color: '#063f32', margin: [0, 3, 0, 0] }
      ] },
      { stack: [
        { text: 'FATTURE', fontSize: 10, bold: true, color },
        { text: String(items.length), fontSize: 22, bold: true, color: '#063f32', margin: [0, 2, 0, 0] }
      ], alignment: 'right' }
    ]] },
    layout: {
      fillColor: () => background, hLineWidth: () => 0, vLineWidth: () => 0,
      paddingLeft: () => 15, paddingRight: () => 15, paddingTop: () => 11, paddingBottom: () => 11
    }
  });

  const clientBlock = (row, index) => {
    const invoices = row.fatture || [];
    const registered = invoices.length > 0;
    const color = registered ? '#a7e5bc' : row.fatturaInviataAt ? '#d9f3e3' : index % 2 ? '#e1f2fc' : '#ffffff';
    const status = registered ? 'FATTURA REGISTRATA' : row.fatturaInviataAt ? 'FATTURA INVIATA' : 'DA ELABORARE';
    const notes = [
      row.notaFissa && `[FISSE] ${row.notaFissa}`,
      row.notaMensile && `[MESE] ${row.notaMensile}`,
      row.noteMaggiorazioni && `[M] ${row.noteMaggiorazioni}`,
      row.noteSconti && `[S] ${row.noteSconti}`,
      ...invoices.map(invoice => `Fattura ${invoice.numero} del ${invoice.data}: ${euro(invoice.importo)}`)
    ].filter(Boolean);
    const value = (text, bold = false) => ({ text: String(text), fontSize: 10.5, bold, color: '#103d34', alignment: 'center', fillColor: color });
    const values = [
      value(row.ragioneSociale || 'Cliente', true), value(hours(row.oreLavorate)),
      value(number(row.maggiorazioni) || number(row.sconti)
        ? `+ ${euro(row.maggiorazioni)}\n- ${euro(row.sconti)}` : '-'),
      value(euro(row.imponibile)), value(row.tipoTassazione || 'IVA'),
      value(`${hours(row.percentualeTassaEffettiva)}%`), value(euro(row.importoTassa)),
      value(euro(row.importoTotale), true), value(euro(row.costoPersonale)),
      value(euro(row.residuoSenzaStipendi), true), value(euro(row.tariffaOraria))
    ];
    values[0].alignment = 'left';
    return [{
      table: { widths, body: [
        values,
        [{ colSpan: widths.length, text: [
          { text: `${status}  ·  `, bold: true, color: registered ? '#075a35' : '#075e77' },
          { text: notes.join('  |  ') || 'Nessuna nota', color: '#244d46' }
        ], fontSize: 10.5, fillColor: registered ? '#d9f4e2' : row.fatturaInviataAt ? '#edf9f1' : '#eef7fb' }, ...Array(widths.length - 1).fill('')]
      ] },
      layout: { ...cellLayout, paddingTop: rowIndex => rowIndex === 0 ? 9 : 7, paddingBottom: rowIndex => rowIndex === 0 ? 9 : 7 }
    }];
  };

  const section = (title, items, headerColor) => {
    const heading = { text: `${title.toUpperCase()}  ·  ${items.length}`, fontSize: 18, bold: true, color: headerColor, margin: [0, 17, 0, 7] };
    if (!items.length) return [heading, { text: 'Nessuna fattura in questa sezione.', fontSize: 12, color: '#49645d', margin: [0, 0, 0, 8] }];
    const header = [{
      table: { widths, body: [labels.map(label => ({ text: label, fontSize: 10.5, bold: true, color: '#ffffff', alignment: 'center' }))] },
      layout: { ...cellLayout, fillColor: () => headerColor, vLineColor: () => '#a9d7c6' }
    }];
    return [heading, {
      table: { headerRows: 1, dontBreakRows: true, widths: ['*'], body: [header, ...items.map(clientBlock)] },
      layout: {
        hLineWidth: i => i > 1 ? 1.5 : 0, hLineColor: () => '#78ad9c', vLineWidth: () => 0,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 2
      }
    }];
  };

  const docDefinition = {
    pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 220, 24, 36],
    header: () => ({
      stack: [
        {
          table: { widths: ['*', 240], body: [[
            { columns: [
              { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="white" stroke-width="3"><path d="M7 42V7h27v35M34 16h7v26M13 14h6m7 0h3m-16 8h6m7 0h3m-16 8h6m7 0h3M4 42h40"/></svg>', width: 51, height: 51 },
              { width: '*', stack: [
                { text: 'FATTURE CLIENTI', fontSize: 29, bold: true, color: '#ffffff' },
                { text: periodo.toUpperCase(), fontSize: 17, color: '#d9f7e9' }
              ] }
            ] },
            { stack: [
              { text: 'PERIODO DI RIFERIMENTO', fontSize: 11, bold: true, color: '#d9f7e9' },
              { text: periodo, fontSize: 18, bold: true, color: '#ffffff', margin: [0, 8, 0, 0] },
              { text: `${rows.length} clienti`, fontSize: 12, color: '#d9f7e9', margin: [0, 6, 0, 0] }
            ] }
          ]] },
          layout: { fillColor: () => '#075c45', hLineWidth: () => 0, vLineWidth: () => 0,
            paddingLeft: () => 18, paddingRight: () => 15, paddingTop: () => 14, paddingBottom: () => 14 },
          margin: [0, 0, 0, 8]
        },
        { columns: [
          metric('Da fatturare', daElaborare, '#145a83', '#e1f2fc'),
          metric('Fatturato', elaborate, '#087a59', '#d9f3e3')
        ], columnGap: 8 }
      ], margin: [24, 15, 24, 0]
    }),
    content: [
      ...section('Fatture da elaborare', daElaborare, '#116c9a'),
      ...section('Fatture elaborate', elaborate, '#087a59')
    ],
    footer: (page, pages) => ({ columns: [
      { text: `Report generato il ${new Date().toLocaleDateString('it-IT')}` },
      { text: `Documento riservato - Uso interno  ·  ${page}/${pages}`, alignment: 'right' }
    ], fontSize: 10, color: '#367c62', margin: [24, 0, 24, 0] }),
    defaultStyle: { font: 'Roboto' }
  };
  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

module.exports = { buildReportContabilitaClientiPDF };
