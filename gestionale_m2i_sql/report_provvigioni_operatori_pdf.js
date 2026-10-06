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

const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const numero = valore => Number(valore) || 0;
const euro = valore => numero(valore).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

function buildReportProvvigioniOperatoriPDF(operatori, mese, anno) {
  const periodo = `${mesi[Number(mese) - 1] || mese} ${anno}`;
  const totaleProvvigioni = operatori.reduce((somma, voce) => somma + numero(voce.provvigioneTotale), 0);
  const totaleImponibile = operatori.reduce((somma, voce) => somma + numero(voce.fatturatoTotale), 0);
  const numeroProvvigioni = operatori.reduce((somma, voce) => somma + (voce.clienti?.length || 0), 0);

  const riepilogo = (titolo, valore, sfondo) => ({
    width: '*',
    table: { widths: ['*'], body: [[{ stack: [
      { text: titolo, fontSize: 9, bold: true, color: '#475569' },
      { text: valore, fontSize: 18, bold: true, color: '#1e3a8a', margin: [0, 5, 0, 0] }
    ] }]] },
    layout: { fillColor: () => sfondo, hLineWidth: () => 0, vLineWidth: () => 0,
      paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 10, paddingBottom: () => 10 }
  });

  const bloccoOperatore = operatore => ({
    margin: [0, 0, 0, 12],
    stack: [
      {
        table: { widths: ['*', 155, 145], body: [[
          { stack: [
            { text: operatore.operatore, fontSize: 15, bold: true, color: '#ffffff' },
            { text: `${operatore.clienti.length} ${operatore.clienti.length === 1 ? 'cliente/servizio' : 'clienti/servizi'}`, fontSize: 9, color: '#dbeafe', margin: [0, 3, 0, 0] }
          ] },
          { text: `Imponibile totale\n${euro(operatore.fatturatoTotale)}`, fontSize: 10, bold: true, color: '#ffffff', alignment: 'right' },
          { text: `Provvigioni totali\n${euro(operatore.provvigioneTotale)}`, fontSize: 10, bold: true, color: '#ffffff', alignment: 'right' }
        ]] },
        layout: { fillColor: () => '#1d4ed8', hLineWidth: () => 0, vLineWidth: () => 0,
          paddingLeft: () => 11, paddingRight: () => 11, paddingTop: () => 9, paddingBottom: () => 9 }
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 155, 145],
          body: [
            ['Cliente / servizio', 'Fatturato imponibile', 'Provvigione'].map(testo => ({ text: testo, bold: true, fontSize: 9, color: '#334155' })),
            ...operatore.clienti.map((cliente, indice) => [
              { text: cliente.ragioneSociale, bold: true, fontSize: 10, fillColor: indice % 2 ? '#f8fafc' : '#ffffff' },
              { text: euro(cliente.fatturato), alignment: 'right', fontSize: 10, fillColor: indice % 2 ? '#f8fafc' : '#ffffff' },
              { text: euro(cliente.provvigione), alignment: 'right', bold: true, fontSize: 10, color: '#1d4ed8', fillColor: indice % 2 ? '#f8fafc' : '#ffffff' }
            ])
          ]
        },
        layout: { hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1', hLineWidth: () => 0.6, vLineWidth: () => 0.6,
          paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 7, paddingBottom: () => 7 }
      }
    ]
  });

  const docDefinition = {
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [28, 28, 28, 36],
    content: [
      { columns: [
        { stack: [
          { text: 'RIEPILOGO PROVVIGIONI OPERATORI', fontSize: 23, bold: true, color: '#172554' },
          { text: periodo.toUpperCase(), fontSize: 14, color: '#475569', margin: [0, 5, 0, 0] }
        ] },
        { text: 'Importi di fatturazione al netto di IVA e tasse', width: 240, alignment: 'right', fontSize: 10, color: '#64748b', margin: [0, 7, 0, 0] }
      ], margin: [0, 0, 0, 15] },
      { columns: [
        riepilogo('FATTURATO IMPONIBILE', euro(totaleImponibile), '#eff6ff'),
        riepilogo('PROVVIGIONI TOTALI', euro(totaleProvvigioni), '#eef2ff'),
        riepilogo('PROVVIGIONI EROGATE', String(numeroProvvigioni), '#f5f3ff'),
        riepilogo('OPERATORI', String(operatori.length), '#f8fafc')
      ], columnGap: 7, margin: [0, 0, 0, 18] },
      ...(operatori.length ? operatori.map(bloccoOperatore) : [{ text: 'Nessuna provvigione nel periodo selezionato.', color: '#64748b', fontSize: 12 }])
    ],
    footer: (pagina, pagine) => ({ columns: [
      { text: `Report generato il ${new Date().toLocaleDateString('it-IT')}` },
      { text: `Documento riservato - Uso interno  ·  ${pagina}/${pagine}`, alignment: 'right' }
    ], fontSize: 9, color: '#64748b', margin: [28, 0, 28, 0] }),
    defaultStyle: { font: 'Roboto' }
  };

  pdfmake.setFonts(fonts);
  return pdfmake.createPdf(docDefinition);
}

module.exports = { buildReportProvvigioniOperatoriPDF };
