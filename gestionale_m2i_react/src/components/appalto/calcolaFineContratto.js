// La data finale è inclusiva: quattro mesi dal 3 maggio terminano il 2 settembre.
export function calcolaFineContratto(dataInizio, durata) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInizio || '')) return '';
  const start = new Date(`${dataInizio}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== dataInizio) return '';

  const text = String(durata || '').trim();
  const match = text.match(/^(\d+)\s*(giorn[oi]|settiman[ae]|mes[ei]|ann[oi])\b/i)
    || text.match(/^(\d+)$/);
  if (!match) return '';
  const count = Number(match[1]);
  if (!Number.isSafeInteger(count) || count < 1 || count > 1200) return '';
  const unit = (match[2] || 'mesi').toLowerCase();
  let anniversary;
  if (unit.startsWith('giorn') || unit.startsWith('settiman')) {
    anniversary = new Date(start);
    anniversary.setUTCDate(anniversary.getUTCDate() + count * (unit.startsWith('settiman') ? 7 : 1));
  } else {
    const months = count * (unit.startsWith('ann') ? 12 : 1);
    const targetMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
    const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
    anniversary = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(),
      Math.min(start.getUTCDate(), lastDay)));
    if (start.getUTCDate() > lastDay) return anniversary.toISOString().slice(0, 10);
  }
  anniversary.setUTCDate(anniversary.getUTCDate() - 1);
  return anniversary.toISOString().slice(0, 10);
}
