const path = require('node:path');
const pdfmake = require('pdfmake');
const fs = require('node:fs/promises');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const fonts = {
  Roboto: {
    normal: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
    bold: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
    italics: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf')
  }
};

function formatDateTime(value) {
  const [date, time] = String(value || '').split('T');
  const [year, month, day] = (date || '').split('-');
  return `${day || '--'}/${month || '--'}/${year || '----'}  ${time || '--:--'}`;
}

function field(label, value) {
  return {
    stack: [
      { text: label.toUpperCase(), fontSize: 8, bold: true, color: '#565656', characterSpacing: 1.2 },
      { text: String(value || '—'), fontSize: 12, bold: true, color: '#111111', margin: [0, 6, 0, 0] }
    ],
    margin: [0, 3, 0, 7]
  };
}

function ruledLines(count) {
  return Array.from({ length: count }, () => ({
    canvas: [{ type: 'line', x1: 0, y1: 22, x2: 491, y2: 22, lineWidth: 0.55, lineColor: '#8b8b8b' }],
    height: 25
  }));
}

function fitText(text, font, maxSize, maxWidth, minSize = 7) {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

function drawContact(page, value, x, y, font, maxWidth, maxSize = 9.5) {
  const text = String(value || '—');
  page.drawText(text, { x, y, font, size: fitText(text, font, maxSize, maxWidth), color: rgb(0.07, 0.07, 0.07) });
}

async function addPresentation(buffer, appointment, contacts) {
  const pdf = await PDFDocument.load(buffer);
  const template = await PDFDocument.load(await fs.readFile(path.join(__dirname, 'public', 'images', 'presentazione-m2i-template.pdf')));
  const [page] = await pdf.copyPages(template, [0]);
  const roman = await pdf.embedFont(StandardFonts.TimesRoman);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const client = String(appointment.nominativo || 'Cliente').trim();
  const clientSize = fitText(client, roman, 27, 286, 13);
  if (roman.widthOfTextAtSize(client, clientSize) <= 286) {
    page.drawText(client, { x: 30, y: 662, size: clientSize, font: roman, color: rgb(0.07, 0.07, 0.07) });
  } else {
    let lines;
    let size = 17;
    for (; size >= 9; size -= 0.5) {
      lines = [''];
      for (const word of client.split(/\s+/)) {
        const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
        if (roman.widthOfTextAtSize(next, size) > 286 && lines[lines.length - 1]) lines.push(word);
        else lines[lines.length - 1] = next;
      }
      if (lines.length <= 2 && lines.every(line => roman.widthOfTextAtSize(line, size) <= 286)) break;
    }
    for (const [index, line] of lines.slice(0, 2).entries()) {
      page.drawText(line, { x: 30, y: 681 - index * 21, size, font: roman, color: rgb(0.07, 0.07, 0.07) });
    }
  }
  drawContact(page, contacts.commerciale1Nome, 34, 148, bold, 157);
  drawContact(page, contacts.commerciale1Telefono, 34, 134, helvetica, 157);
  drawContact(page, contacts.commerciale2Nome, 34, 115, bold, 157);
  drawContact(page, contacts.commerciale2Telefono, 34, 101, helvetica, 157);
  drawContact(page, contacts.ufficioTelefono, 230, 147, helvetica, 185);
  drawContact(page, contacts.email, 230, 111, helvetica, 205);
  const footer = `Preparato per ${client}`;
  const footerSize = fitText(footer, helvetica, 7.5, 270, 5.5);
  page.drawText(footer, { x: page.getWidth() - 30 - helvetica.widthOfTextAtSize(footer, footerSize), y: 49, size: footerSize, font: helvetica, color: rgb(0.33, 0.33, 0.33) });
  pdf.addPage(page);
  return Buffer.from(await pdf.save());
}

async function buildSchedaAppuntamentoPDF(appointment, contacts) {
  pdfmake.addFonts(fonts);
  const notes = appointment.noteStoriche?.length
    ? appointment.noteStoriche.map(note => note.testo)
    : appointment.note ? [appointment.note] : [];
  const noteText = notes.length ? notes.map((note, index) => `${index + 1}. ${note}`).join('\n') : 'Nessuna nota inserita.';
  const logo = path.join(__dirname, 'public', 'images', 'logo-m2i.png');
  const definition = {
    pageSize: 'A4',
    pageMargins: [52, 43, 52, 45],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#111111' },
    info: { title: 'SCHEDA APPUNTAMENTO', author: 'M2I' },
    footer: (page, pages) => ({
      columns: [
        { text: 'M2I  /  SCHEDA APPUNTAMENTO', fontSize: 8, color: '#777777', characterSpacing: 0.8 },
        { text: `${page} / ${pages}`, alignment: 'right', fontSize: 8, color: '#777777' }
      ],
      margin: [52, 0, 52, 20]
    }),
    content: [
      {
        columns: [
          { image: logo, width: 115, margin: [0, 0, 0, 0] },
          { stack: [
            { text: 'SCHEDA APPUNTAMENTO', fontSize: 18, bold: true, alignment: 'right', characterSpacing: 0.2 },
            { text: 'DATI E APPUNTI PER IL COMMERCIALE', fontSize: 8, color: '#555555', alignment: 'right', margin: [0, 6, 0, 0], characterSpacing: 1.3 }
          ], width: '*' }
        ],
        margin: [0, 0, 0, 18]
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 491, y2: 0, lineWidth: 1.6, lineColor: '#161616' }], margin: [0, 0, 0, 19] },
      {
        columns: [
          { width: '52%', stack: [field('Data e ora', formatDateTime(appointment.dataOra))] },
          { width: '48%', stack: [field('Commerciale', appointment.incaricato)] }
        ],
        margin: [0, 0, 0, 10]
      },
      { text: '01  /  CONTATTO', fontSize: 9, bold: true, characterSpacing: 1.4, margin: [0, 0, 0, 10] },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [field('Nome azienda', appointment.nominativo), field('Nome referente', appointment.referente)],
            [field('Telefono', appointment.telefono), field('Email', appointment.email)]
          ]
        },
        layout: {
          hLineColor: () => '#b5b5b5', vLineColor: () => '#b5b5b5',
          hLineWidth: () => 0.6, vLineWidth: () => 0.6,
          paddingLeft: () => 12, paddingRight: () => 12,
          paddingTop: () => 10, paddingBottom: () => 10
        },
        margin: [0, 0, 0, 17]
      },
      ...(appointment.luogo ? [field('Indirizzo appuntamento', appointment.luogo)] : []),
      { text: '02  /  NOTE PRIMA DELL’APPUNTAMENTO', fontSize: 9, bold: true, characterSpacing: 1.4, margin: [0, 14, 0, 10] },
      {
        text: noteText,
        fontSize: 10.5,
        lineHeight: 1.32,
        margin: [12, 0, 12, 0],
        border: [false, false, false, false]
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 491, y2: 0, lineWidth: 0.6, lineColor: '#b5b5b5' }], margin: [0, 15, 0, 16] },
      { text: '03  /  NOTE POST APPUNTAMENTO', fontSize: 9, bold: true, characterSpacing: 1.4, margin: [0, 0, 0, 4] },
      { text: 'Spazio riservato al commerciale per gli appunti scritti a mano.', fontSize: 9, color: '#666666', margin: [0, 0, 0, 6] },
      ...ruledLines(8)
    ]
  };
  return addPresentation(await pdfmake.createPdf(definition).getBuffer(), appointment, contacts);
}

module.exports = { buildSchedaAppuntamentoPDF };
