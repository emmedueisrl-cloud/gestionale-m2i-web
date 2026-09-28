// Conserva le note insieme ai dettagli dei mesi chiusi. I record precedenti
// vengono congelati con le note oggi disponibili: la versione alla loro
// effettiva data di chiusura non è ricostruibile se nel frattempo è cambiata.
async function ensureElaboratiNoteStoriche(knex) {
  for (const tipo of ['dipendenti', 'clienti']) {
    const tabella = `dettaglio_mesi_chiusi_${tipo}`;
    for (const colonna of ['nota_fissa_storica', 'nota_mensile_storica']) {
      if (!await knex.schema.hasColumn(tabella, colonna)) {
        await knex.schema.alterTable(tabella, table => table.text(colonna));
      }
    }
    const persona = tipo === 'dipendenti' ? 'dipendenti' : 'clienti';
    const id = tipo === 'dipendenti' ? 'dipendente_id' : 'cliente_id';
    const nomeTipo = tipo === 'dipendenti' ? 'dipendente' : 'cliente';
    const notaPrecedente = tipo === 'dipendenti' ? 'note_generali' : 'note';
    await knex.raw(`UPDATE ${tabella}
      SET nota_fissa_storica = COALESCE(
        (SELECT p.note_fisse_elaborato FROM ${persona} p WHERE p.id = ${tabella}.${id}), '')
      WHERE nota_fissa_storica IS NULL`);
    await knex.raw(`UPDATE ${tabella}
      SET nota_mensile_storica = COALESCE(
        (SELECT n.testo FROM note_elaborati n
         WHERE n.tipo = ? AND n.soggetto_id = ${tabella}.${id}
           AND n.mese = ${tabella}.mese AND n.anno = ${tabella}.anno),
        ${tabella}.${notaPrecedente}, '')
      WHERE nota_mensile_storica IS NULL`, [nomeTipo]);
  }
}

module.exports = { ensureElaboratiNoteStoriche };
