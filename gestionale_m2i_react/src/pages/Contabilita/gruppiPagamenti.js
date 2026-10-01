export function raggruppaPagamenti(rows) {
  return {
    daPagare: rows.filter(row => !row.pagamento),
    pagati: rows.filter(row => Boolean(row.pagamento))
  };
}

export function totaleDaPagare(rows) {
  return rows.reduce((sum, row) => sum + Math.max(0, Number(row.stipendioNetto) || 0), 0);
}

export function totalePagato(rows) {
  return rows.reduce((sum, row) => sum + (Number(row.pagamento?.importo) || 0), 0);
}
