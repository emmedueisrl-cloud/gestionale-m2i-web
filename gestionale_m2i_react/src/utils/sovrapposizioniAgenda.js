export function inizioSettimanaAgenda(data) {
  const giorno = new Date(`${data}T12:00:00`);
  giorno.setDate(giorno.getDate() - (giorno.getDay() + 6) % 7);
  return `${giorno.getFullYear()}-${String(giorno.getMonth() + 1).padStart(2, '0')}-${String(giorno.getDate()).padStart(2, '0')}`;
}

export function trovaSovrapposizioniAgenda(impegno, esistenti) {
  if (impegno.senzaOrario || !impegno.oraInizio) return [];
  const inizio = impegno.oraInizio;
  const fine = impegno.oraFine || '';
  return esistenti.filter(altro => {
    if (String(altro.id) === String(impegno.id) || altro.idDipendente !== impegno.idDipendente || altro.data !== impegno.data || altro.senzaOrario || !altro.oraInizio) return false;
    const altroInizio = altro.oraInizio;
    const altraFine = altro.oraFine || '';
    if (inizio === altroInizio) return true;
    if (fine && altraFine) return inizio < altraFine && altroInizio < fine;
    if (fine) return inizio <= altroInizio && altroInizio < fine;
    if (altraFine) return altroInizio <= inizio && inizio < altraFine;
    return false;
  });
}
