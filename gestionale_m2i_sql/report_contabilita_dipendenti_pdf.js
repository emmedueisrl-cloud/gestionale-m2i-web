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
const widths = [220, 60, 100, 110, 120, 100, 100, 120, 120];
const number = value => Number(value) || 0;
const euro = value => `€ ${number(value).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hours = value => number(value).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const totalDue = rows => rows.reduce((sum, row) => sum + Math.max(0, number(row.stipendioNetto)), 0);
const totalPaid = rows => rows.reduce((sum, row) => sum + number(row.pagamento?.importo), 0);

function buildReportContabilitaDipendentiPDF(rows, mese, anno, mancanti = 0) {
  const periodo = `${months[Number(mese) - 1] || mese} ${anno}`;
  const pagati = rows.filter(row => row.pagamento);
  const daPagare = rows.filter(row => !row.pagamento);
  const labels = ['Dipendente', 'Ore', 'Paga base', 'Lavorato', 'F.P.M.', 'Maggiorazioni', 'Detrazioni', 'Netto da\nelaborato', 'Netto\nbusta'];
  const cellLayout = {
    hLineWidth: () => 0, vLineWidth: i => i > 0 && i < widths.length ? 0.4 : 0,
    vLineColor: () => '#b9cfea', paddingLeft: () => 5, paddingRight: () => 5,
    paddingTop: () => 8, paddingBottom: () => 8
  };

  const metric = (label, amount, items, color, background) => ({
    width: '*',
    table: { widths: [390, 95], body: [[
      { stack: [
        { text: label.toUpperCase(), fontSize: 12, bold: true, color },
        { text: euro(amount), fontSize: 21, bold: true, color: '#102d55', margin: [0, 3, 0, 0] }
      ] },
      { stack: [
        { text: 'DIPENDENTI', fontSize: 10, bold: true, color },
        { text: String(items.length), fontSize: 22, bold: true, color: '#102d55', margin: [0, 2, 0, 0] }
      ], alignment: 'right' }
    ]] },
    layout: {
      fillColor: () => background, hLineWidth: () => 0, vLineWidth: () => 0,
      paddingLeft: () => 15, paddingRight: () => 15, paddingTop: () => 11, paddingBottom: () => 11
    }
  });

  const employeeBlock = (row, index, paidSection) => {
    const color = paidSection ? (index % 2 ? '#86e2a7' : '#c9f2d8') : (index % 2 ? '#d9edff' : '#ffffff');
    const detailsFPM = Object.entries(row.dettaglioFPM || {}).map(([name, value]) => `${name}: ${hours(value)} h`).join(' · ');
    const notes = [
      row.iban && `IBAN: ${row.iban}`,
      row.notaFissa && `[FISSE] ${row.notaFissa}`,
      row.notaMensile && `[MESE] ${row.notaMensile}`,
      row.noteMaggiorazioni && `[M] ${row.noteMaggiorazioni}`,
      row.noteDetrazioni && `[D] ${row.noteDetrazioni}`,
      detailsFPM && `F.P.M.: ${detailsFPM}`
    ].filter(Boolean);
    const value = (text, bold = false) => ({ text: String(text), fontSize: 11, bold, color: '#16365f', alignment: 'center', fillColor: color });
    const nameWords = String(row.cognomeNome || 'Dipendente').trim().split(/\s+/);
    const nameCell = {
      text: [
        { text: nameWords.slice(0, 3).join(' '), fontSize: 14, bold: true },
        ...(nameWords.length > 3 ? [{ text: ` ${nameWords.slice(3).join(' ')}`, fontSize: 11, bold: true }] : [])
      ],
      color: '#16365f', alignment: 'center', fillColor: color
    };
    const values = [
      nameCell, value(hours(row.oreLavorate)),
      value(`${euro(row.pagaOraria)}\n${row.tipoPaga === 'Mensile' ? 'Mensile' : 'Oraria'}`),
      value(euro(row.pagaLavorato)), value(euro(row.pagaFPM)), value(euro(row.maggiorazioni)),
      value(euro(row.detrazioni)), value(euro(row.stipendioNetto), true),
      value(row.nettoBusta == null ? 'Non caricata' : euro(row.nettoBusta), row.nettoBusta != null)
    ];
    const status = row.pagamento
      ? `PAGATO  ·  ${euro(row.pagamento.importo)}  ·  ${new Date(row.pagamento.pagatoAt).toLocaleString('it-IT')}`
      : number(row.stipendioNetto) > 0 ? 'DA PAGARE' : 'NESSUN IMPORTO POSITIVO DA PAGARE';
    return [{
      table: { widths, body: [
        values,
        [{ text: '', fillColor: color }, { colSpan: widths.length - 1, text: [
          { text: `${status}  ·  `, bold: true, color: paidSection ? '#086338' : '#155b8a' },
          { text: notes.join('  |  ') || 'Nessuna nota', color: '#294969' }
        ], fontSize: 10.5, fillColor: paidSection ? '#e5f8eb' : '#eef6fd' }, ...Array(widths.length - 2).fill('')]
      ] },
      layout: { ...cellLayout, paddingTop: rowIndex => rowIndex === 0 ? 9 : 7, paddingBottom: rowIndex => rowIndex === 0 ? 9 : 7 }
    }];
  };

  const section = (title, items, headerColor, paidSection) => {
    const heading = { text: `${title.toUpperCase()}  ·  ${items.length}`, fontSize: 18, bold: true, color: headerColor, margin: [0, 17, 0, 7] };
    if (!items.length) return [heading, { text: 'Nessun dipendente in questa sezione.', fontSize: 12, color: '#536b88', margin: [0, 0, 0, 8] }];
    const header = [{
      table: { widths, body: [labels.map(label => ({ text: label, fontSize: 10.5, bold: true, color: '#ffffff', alignment: 'center' }))] },
      layout: { ...cellLayout, fillColor: () => headerColor, vLineColor: () => '#b6d0ea' }
    }];
    return [heading, {
      table: { headerRows: 1, dontBreakRows: true, widths: ['*'], body: [header, ...items.map((row, index) => employeeBlock(row, index, paidSection))] },
      layout: {
        hLineWidth: i => i > 1 ? 1.5 : 0, hLineColor: () => '#86a8cc', vLineWidth: () => 0,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 2
      }
    }];
  };

  const docDefinition = {
    pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 24, 24, 36],
    content: [{
      stack: [
        {
          table: { widths: ['*', 240], body: [[
            { columns: [
              { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="white" stroke-width="3"><circle cx="24" cy="13" r="8"/><path d="M8 42c1-11 7-17 16-17s15 6 16 17"/><path d="M34 7h10v13H34zM37 11h4m-4 4h4"/></svg>', width: 51, height: 51 },
              { width: '*', stack: [
                { text: 'STIPENDI DIPENDENTI', fontSize: 29, bold: true, color: '#ffffff' },
                { text: periodo.toUpperCase(), fontSize: 17, color: '#dcecff' }
              ] }
            ] },
            { stack: [
              { text: 'PERIODO DI RIFERIMENTO', fontSize: 11, bold: true, color: '#dcecff' },
              { text: periodo, fontSize: 18, bold: true, color: '#ffffff', margin: [0, 8, 0, 0] },
              { text: `${rows.length}/${Number(mancanti) || 0} dipendenti`, fontSize: 12, color: '#dcecff', margin: [0, 6, 0, 0] }
            ] }
          ]] },
          layout: { fillColor: () => '#174f91', hLineWidth: () => 0, vLineWidth: () => 0,
            paddingLeft: () => 18, paddingRight: () => 15, paddingTop: () => 14, paddingBottom: () => 14 },
          margin: [0, 0, 0, 8]
        },
        { columns: [
          metric('Pagati', totalPaid(pagati), pagati, '#087a59', '#d9f3e3'),
          metric('Da pagare', totalDue(daPagare), daPagare, '#145a83', '#e1f2fc')
        ], columnGap: 8 }
      ], margin: [0, 0, 0, 0]
    },
      ...section('Dipendenti pagati', pagati, '#087a59', true),
      ...section('Dipendenti da pagare', daPagare, '#176da1', false)
    ],
    footer: (page, pages) => ({ columns: [
      { text: `Report generato il ${new Date().toLocaleDateString('it-IT')}` },
      { text: `Documento riservato - Uso interno  ·  ${page}/${pages}`, alignment: 'right' }
    ], fontSize: 10, color: '#426a96', margin: [24, 0, 24, 0] }),
    defaultStyle: { font: 'Roboto' }
  };
  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

module.exports = { buildReportContabilitaDipendentiPDF };
