export function notePostAppuntamento(noteScheda, noteStoriche = []) {
  const normalizza = testo => String(testo || '').trim().replace(/\s+/g, ' ');
  const testoScheda = normalizza(noteScheda);
  const esisteNotaScheda = noteStoriche.some(note => note.tipo === 'scheda');
  let copiaStoricaRimossa = esisteNotaScheda || !testoScheda;

  return noteStoriche.filter(note => {
    if (note.tipo === 'scheda') return false;
    // Prima della distinzione, alcune note della scheda erano anche nello storico.
    if (!copiaStoricaRimossa && normalizza(note.testo) === testoScheda) {
      copiaStoricaRimossa = true;
      return false;
    }
    return true;
  });
}
