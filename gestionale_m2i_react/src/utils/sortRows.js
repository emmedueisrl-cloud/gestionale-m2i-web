const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

export function sortRows(rows, valueOf, direction = 'asc', numeric = false) {
  const multiplier = direction === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = valueOf(left);
    const b = valueOf(right);
    const aEmpty = a === null || a === undefined || a === '';
    const bEmpty = b === null || b === undefined || b === '';
    if (aEmpty || bEmpty) return Number(aEmpty) - Number(bEmpty);
    const result = numeric ? Number(a) - Number(b) : collator.compare(String(a), String(b));
    return result * multiplier;
  });
}
