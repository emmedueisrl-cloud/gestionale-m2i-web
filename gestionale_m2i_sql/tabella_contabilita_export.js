const path = require('node:path');
const ExcelJS = require('exceljs');
const pdfmake = require('pdfmake');

const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const number = value => Number(value || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const notes = (row, keys) => keys.map(([key, label]) => row[key] ? `${label}: ${row[key]}` : '').filter(Boolean).join('\n') || '—';
const fontDir = path.join(__dirname, 'node_modules/pdfmake/fonts/Roboto');

function tableData(tipo, section, rows, buste, mese, anno) {
  const index = Number(section);
  if (!Number.isInteger(index) || index < 0 || index > (tipo === 'dipendente' ? 2 : 1) || !['cliente', 'dipendente'].includes(tipo)) {
    throw new Error('Sezione non valida.');
  }
  const period = `${months[Number(mese) - 1]} ${anno}`;
  if (tipo === 'cliente') {
    const filtered = rows.filter(row => index === 1 ? row.fatture?.length || row.fatturaInviataAt : !row.fatture?.length && !row.fatturaInviataAt);
    return {
      period, section: index ? 'Fatture elaborate' : 'Fatture da elaborare',
      columns: ['Cliente (ragione sociale)', 'Totale imponibile', 'R. FIS.', 'Tassa', 'Totale fattura', 'Note'],
      widths: [36, 19, 10, 16, 19, 65],
      rows: filtered.map(row => {
        const regime = String(row.tipoTassazione || 'IVA').trim().toUpperCase();
        const tax = Number.isFinite(Number(row.importoTassa)) ? Number(row.importoTassa) : Number(row.importoTotale || 0) - Number(row.imponibile || 0);
        return [row.ragioneSociale || '', euro(row.imponibile), regime === 'REVERSE CHARGE' ? 'R.G' : ['TRAT. ACC.', 'TRATTENUTA ACCONTO'].includes(regime) ? 'T.A' : regime,
          euro(tax), euro(row.importoTotale), notes(row, [['notaFissa', 'Nota fissa'], ['notaMensile', 'Nota del mese']])];
      })
    };
  }
  if (index === 1) return {
    period, section: 'Per consulente', columns: ['Dipendente', 'Note consulente'], widths: [34, 100],
    rows: rows.filter(row => row.notaConsulente?.trim()).map(row => [row.cognomeNome || '', row.notaConsulente])
  };
  if (index === 2) return {
    period, section: 'Per ufficio paghe', columns: ['Dipendente', 'Netto busta paga', 'Note ufficio paghe', 'Stato'], widths: [38, 24, 65, 20],
    rows: [...buste].sort((a, b) => Number(Boolean(a.pagato_ufficio_at)) - Number(Boolean(b.pagato_ufficio_at)) ||
      `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it')).map(busta => ({
      cells: [`${busta.cognome || ''} ${busta.nome || ''}`.trim(), euro(busta.importo_netto),
        busta.nota_ufficio_paghe || '—', busta.pagato_ufficio_at ? 'Pagato' : 'Da pagare'],
      iban: `IBAN   ${busta.iban || 'Non presente'}`, paid: Boolean(busta.pagato_ufficio_at), paidAt: busta.pagato_ufficio_at
    }))
  };
  const ordered = [
    ...rows.filter(row => !row.inProva && !row.notaConsulente?.trim()),
    ...rows.filter(row => !row.inProva && row.notaConsulente?.trim()),
    ...rows.filter(row => row.inProva)
  ];
  return {
    period, section: 'Da elaborato',
    columns: ['Dipendente', 'Ore lavorate', 'Ferie / permessi / malattia', 'Netto da elaborato', 'Note', 'Netto busta', 'CC'],
    widths: [30, 13, 28, 22, 72, 22, 16],
    rows: ordered.map(row => {
      const absences = [['Ferie', /ferie/i], ['Permessi', /permess/i], ['Malattia', /malatt/i]]
        .map(([label, pattern]) => [label, Object.entries(row.dettaglioFPM || {}).reduce((sum, [reason, hours]) => sum + (pattern.test(reason) ? Number(hours) || 0 : 0), 0)])
        .filter(([, hours]) => hours > 0).map(([label, hours]) => `${label} ${number(hours)} h`).join('\n') || '—';
      return [row.cognomeNome || '', number(row.oreLavorate), absences, euro(row.stipendioNetto),
        notes(row, [['notaFissa', 'Nota fissa'], ['notaMensile', 'Nota del mese'], ['noteMaggiorazioni', 'Maggiorazione'], ['noteDetrazioni', 'Detrazione'], ['noteGenerali', 'Note']]),
        row.inProva ? 'Non prevista' : row.nettoBusta == null ? 'Busta non caricata' : euro(row.nettoBusta),
        row.cc == null ? '—' : euro(row.cc)];
    })
  };
}

async function toPdf(table) {
  pdfmake.addFonts({ Roboto: {
    normal: path.join(fontDir, 'Roboto-Regular.ttf'), bold: path.join(fontDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontDir, 'Roboto-Italic.ttf'), bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf')
  } });
  const wide = table.columns.length > 3;
  const body = [table.columns.map(value => ({ text: value, bold: true }))];
  table.rows.forEach(row => {
    const cells = [...(row.cells || row)];
    if (table.section === 'Per ufficio paghe' && row.paidAt) {
      cells[cells.length - 1] = `Pagato\n${new Date(row.paidAt).toLocaleString('it-IT', {
        timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })}`;
    }
    body.push(cells.map(value => String(value ?? '')));
    if (row.iban) body.push([{ text: row.iban, colSpan: table.columns.length, bold: true }, ...Array(table.columns.length - 1).fill('')]);
  });
  if (!table.rows.length) body.push([{ text: 'Nessun dato per questa sezione.', colSpan: table.columns.length }, ...Array(table.columns.length - 1).fill('')]);
  const definition = {
    pageSize: wide ? 'A3' : 'A4', pageOrientation: wide ? 'landscape' : 'portrait', pageMargins: [28, 35, 28, 35],
    content: [
      { text: table.period, fontSize: 18, bold: true, margin: [0, 0, 0, 18] },
      { table: { headerRows: 1, widths: table.widths.map(value => `${value}%`), body },
        layout: { fillColor: rowIndex => {
          if (rowIndex === 0) return '#e8eef5';
          const itemIndex = Math.floor((rowIndex - 1) / (table.section === 'Per ufficio paghe' ? 2 : 1));
          if (table.rows[itemIndex]?.paid) return '#d1fae5';
          return itemIndex % 2 ? '#e9f4fb' : '#ffffff';
        },
          hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1', paddingLeft: () => 5, paddingRight: () => 5,
          paddingTop: () => 6, paddingBottom: () => 6 } }
    ], defaultStyle: { font: 'Roboto', fontSize: wide ? 8 : 10, color: '#0f172a' }
  };
  // pdfmake accepts star widths; percentages based on Excel widths are normalized here.
  const total = table.widths.reduce((sum, width) => sum + width, 0);
  definition.content[1].table.widths = table.widths.map(width => `${Math.round(width / total * 1000) / 10}%`);
  return pdfmake.createPdf(definition).getBuffer();
}

async function toXlsx(table) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(table.section.slice(0, 31), { views: [{ state: 'frozen', ySplit: 2 }] });
  sheet.mergeCells(1, 1, 1, table.columns.length);
  const title = sheet.getCell(1, 1);
  title.value = table.period;
  title.font = { name: 'Aptos', size: 18, bold: true, color: { argb: 'FF172554' } };
  title.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 33;
  sheet.getRow(2).values = table.columns;
  sheet.getRow(2).height = 38;
  sheet.columns.forEach((column, index) => { column.width = table.widths[index]; });
  sheet.getRow(2).eachCell(cell => {
    cell.font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FF172554' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF5' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  table.rows.forEach((item, index) => {
    const values = item.cells || item;
    const row = sheet.addRow(values);
    const color = item.paid ? 'FFD1FAE5' : index % 2 ? 'FFE9F4FB' : 'FFFFFFFF';
    row.height = Math.min(100, Math.max(35, 19 * Math.max(...values.map(value => String(value ?? '').split('\n').length))));
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.font = { name: 'Aptos', size: 11, color: { argb: 'FF0F172A' } };
    });
    if (item.iban) {
      const ibanRow = sheet.addRow([item.iban]);
      sheet.mergeCells(ibanRow.number, 1, ibanRow.number, table.columns.length);
      ibanRow.height = 33;
      const cell = ibanRow.getCell(1);
      cell.font = { name: 'Aptos', size: 13, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    }
  });
  if (!table.rows.length) sheet.addRow(['Nessun dato per questa sezione.']);
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: table.columns.length } };
  sheet.pageSetup = { orientation: table.columns.length > 3 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1 };
  return workbook.xlsx.writeBuffer();
}

module.exports = { tableData, toPdf, toXlsx };
