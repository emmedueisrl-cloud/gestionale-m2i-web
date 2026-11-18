export function domicilioUnilav(dipendente) {
  const parts = String(dipendente?.comuneDomicilio || '').split(/\s+-\s+/).map(part => part.trim());
  const cap = parts.find(part => /^\d{5}$/.test(part)) || '';
  const citta = parts.length >= 2 && /^[A-Z]\d{3}$/i.test(parts[0])
    ? parts[1] : parts.find(part => part !== cap && !/^[A-Z]\d{3}$/i.test(part)) || '';
  return { indirizzo: String(dipendente?.indirizzoDomicilio || '').trim(), citta, cap };
}
