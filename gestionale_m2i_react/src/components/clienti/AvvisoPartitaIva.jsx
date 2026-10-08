export default function AvvisoPartitaIva({ valore }) {
  const partitaIva = String(valore || '').trim();
  if (partitaIva.length <= 11) return null;

  const conPrefissoItaliano = /^IT\d{11}$/i.test(partitaIva);
  return <p id="avvisoPartitaIva" role="status" className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
    {conPrefissoItaliano
      ? 'Hai inserito il prefisso IT seguito da 11 cifre. La partita IVA verrà salvata completa di prefisso.'
      : 'La partita IVA supera gli 11 caratteri: verifica il valore prima di salvare. Puoi comunque procedere.'}
  </p>;
}
