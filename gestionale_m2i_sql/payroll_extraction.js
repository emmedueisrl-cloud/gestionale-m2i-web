function extractNet(text) {
  const matches = [...text.matchAll(/NETTO\s+BUSTA\s+(?:[\d.,]+\s+)?(-?[\d.,]+)\s*FERIE/gi)];
  if (!matches.length) return null;
  const amounts = [];
  for (const match of matches) {
    const raw = match[1];
    if (raw.includes(',') ? !/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(raw) : !/^-?\d+(?:\.\d{2})?$/.test(raw)) return null;
    const value = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
    if (!Number.isFinite(value)) return null;
    amounts.push(value);
  }
  return new Set(amounts).size === 1 ? amounts[0] : null;
}
function extractNetFromLayout(items, width, height) {
  // Alcuni PDF INAIL espongono il valore ma disegnano "NETTO BUSTA" come grafica.
  // Il ripiego è limitato a questo modello e alla cella in basso a destra.
  const content = items.map(item => item.text).join(' ').toUpperCase();
  if (!['CODICE CCNL', 'PAGA BASE', 'LAVORO ORDINARIO'].every(marker => content.includes(marker)) ||
      !Number.isFinite(width) || !Number.isFinite(height)) return null;
  const candidates = items.filter(item => item.y > height * 0.255 && item.y < height * 0.275 &&
    item.x + item.width > width * 0.9)
    .map(item => item.text.match(/(-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\s*$/)?.[1])
    .filter(Boolean).map(raw => Number(raw.replace(/\./g, '').replace(',', '.')));
  return candidates.length === 1 && Number.isFinite(candidates[0]) ? candidates[0] : null;
}
function matchEmployee(text, employees) {
  const found = [...new Set((text.toUpperCase().match(/\b[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]\b/g) || []))];
  const matches = employees.filter(employee => found.includes(String(employee.codice_fiscale || '').trim().toUpperCase()));
  if (matches.length === 1) return { employee: matches[0], cf: String(matches[0].codice_fiscale).trim().toUpperCase() };
  return { employee: null, cf: found.length === 1 ? found[0] : '' };
}
module.exports = { extractNet, extractNetFromLayout, matchEmployee };
