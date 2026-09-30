const { createHash } = require('node:crypto');

// Read through the caller's transaction: hours and locks must describe one snapshot.
async function registroState(db, dipendente_id, mese, anno) {
  const rows = await db('registro_ore').where({ dipendente_id, mese, anno }).orderBy('id');
  const locks = await db('righe_bloccate_elaborati').where({ mese, anno }).orderBy(['tipo', 'soggetto_id']);
  const employeeMonth = await db('mesi_chiusi_dipendenti').where({ mese, anno }).first();
  const clientMonth = await db('mesi_chiusi_clienti').where({ mese, anno }).first();
  const employee = await db('dipendenti').select('id', 'paga_oraria_reale').where({ id: dipendente_id }).first();
  if (!employee) throw new Error('Dipendente non trovato');
  const clientiBloccati = locks.filter(r => r.tipo === 'cliente').map(r => r.soggetto_id);
  const solaLettura = Boolean(employeeMonth || locks.some(r => r.tipo === 'dipendente' && r.soggetto_id === dipendente_id));
  const clienteBloccato = id => Boolean(id && (clientMonth || clientiBloccati.includes(id)));
  const protectedRows = rows.filter(r => solaLettura || clienteBloccato(r.cliente_id));
  const revisione = createHash('sha256').update(JSON.stringify({ dipendente_id, mese, anno, rows, locks,
    employeeMonth: employeeMonth || null, clientMonth: clientMonth || null, employee })).digest('hex');
  return { rows, employee, protectedRows, clienteBloccato, revisione, solaLettura, clientiBloccati, meseClientiChiuso: Boolean(clientMonth) };
}

function assertRevision(state, revisione) {
  if (!revisione || revisione !== state.revisione) {
    throw new Error('Registro o blindature aggiornati: ricarica il registro prima di salvare. Le modifiche non sono state applicate.');
  }
  if (state.solaLettura) throw new Error('Dipendente blindato o mese dipendenti chiuso: registro in sola lettura.');
}

module.exports = { registroState, assertRevision };
