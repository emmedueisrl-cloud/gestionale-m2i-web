const format = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function giornoRegistrazione(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(format.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function dataRegistrazione(value) {
  const day = giornoRegistrazione(value);
  if (!day) return 'Data non disponibile';
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}
