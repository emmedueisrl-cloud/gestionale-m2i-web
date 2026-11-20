import comuniProvince from '../data/comuniProvinceIstat.json';

// Elenco ISTAT dei comuni italiani, aggiornato al 21 febbraio 2026.
// https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/
export function provinciaDaComune(comune) {
  const nome = String(comune || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  return comuniProvince[nome] || '';
}
