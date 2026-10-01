export function mesePredefinitoElaborati(oggi = new Date()) {
  const mese = oggi.getMonth() + 1;
  if (oggi.getDate() >= 10) return { mese, anno: oggi.getFullYear() };
  return mese === 1
    ? { mese: 12, anno: oggi.getFullYear() - 1 }
    : { mese: mese - 1, anno: oggi.getFullYear() };
}
