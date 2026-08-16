const ExcelJS = require('exceljs');

async function buildFoglioPresenzeExcel(data) {
  // data = { dipendente: "Nome Cognome", mese: 7, anno: 2026, causaliValide: ["Ferie", ...], clientiValidi: ["Cliente A", ...], colonne: [{ clienteId, clienteNome, ore: [0, 8, ...] }] }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gestionale M2I';
  workbook.created = new Date();

  // Foglio nascosto per le opzioni dei menu a tendina
  const configSheet = workbook.addWorksheet('Config', { state: 'hidden' });
  
  const opzioni = [
    ...data.clientiValidi,
    "FERIE",
    "MALATTIA",
    "PERMESSO",
    "PERMESSO RETRIBUITO",
    "PERMESSO NON RETRIBUITO",
    "104 (1*)",
    "104 (2*)",
    "INFORTUNIO",
    "ASSENZA",
    "MATERNITÀ/PATERNITÀ",
    "STRAORDINARIO",
    "FESTIVO"
  ];

  configSheet.getColumn('A').values = opzioni;
  const rangeOpzioni = `Config!$A$1:$A$${opzioni.length}`;

  const nomiMesi = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];
  const nomeMese = nomiMesi[data.mese - 1];

  const presenzeSheet = workbook.addWorksheet(`Presenze ${nomeMese} ${data.anno}`);

  // Intestazioni riga 1: "Giorno", poi i clienti
  const headerRow = presenzeSheet.getRow(1);
  headerRow.getCell(1).value = "Giorno";
  headerRow.getCell(1).font = { bold: true };
  headerRow.getCell(1).alignment = { horizontal: 'center' };
  presenzeSheet.getColumn(1).width = 12;

  // Itera sulle colonne da aggiungere (precompilate + vuote)
  // Partiamo dalla colonna B (2)
  for (let i = 0; i < data.colonne.length; i++) {
    const colObj = data.colonne[i];
    const colIndex = i + 2; // B è 2, C è 3, ecc.
    const cell = headerRow.getCell(colIndex);
    
    cell.value = colObj.clienteNome || ""; // Se precompilata ha il nome, se no è vuota
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', wrapText: true };
    presenzeSheet.getColumn(colIndex).width = 25;

    // Aggiungi menu a tendina sulla cella dell'intestazione
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [rangeOpzioni],
      showErrorMessage: true,
      errorTitle: 'Valore non valido',
      error: 'Seleziona una voce dall\'elenco a tendina.'
    };
  }

  // Blocca la prima riga
  presenzeSheet.views = [
    { state: 'frozen', ySplit: 1 }
  ];

  // Popola i giorni (da 1 a 31) nella colonna A e le ore nelle altre colonne
  for (let giorno = 1; giorno <= 31; giorno++) {
    const rowIndex = giorno + 1; // La riga 1 è l'intestazione
    const row = presenzeSheet.getRow(rowIndex);
    
    row.getCell(1).value = giorno;
    row.getCell(1).alignment = { horizontal: 'center' };

    for (let i = 0; i < data.colonne.length; i++) {
      const colObj = data.colonne[i];
      const colIndex = i + 2;
      const cell = row.getCell(colIndex);
      
      const ore = colObj.ore[giorno - 1]; // Array delle ore da 0 a 30
      if (ore && ore > 0) {
        cell.value = ore;
      }
      cell.alignment = { horizontal: 'center' };
    }
  }

  // Stile per tutte le celle
  presenzeSheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  return workbook;
}

module.exports = {
  buildFoglioPresenzeExcel
};
