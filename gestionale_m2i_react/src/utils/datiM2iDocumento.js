const value = input => String(input || '').trim();

export function nomeM2i(azienda) { return value(azienda?.ragione_sociale); }
export function sedeM2i(azienda) { return value(azienda?.sede_legale); }
export function luogoM2i(azienda) {
  let visura = {};
  try { visura = JSON.parse(azienda?.visura_dati_json || '{}'); } catch { /* Dati precedenti. */ }
  return value(visura.sedeLegaleComune || azienda?.fatturazione_citta)
    || value(azienda?.sede_legale).match(/^([^(),]+)\s*\([A-Z]{2}\)/i)?.[1]?.trim() || '';
}

export function righeIntestazioneM2i(azienda) {
  return [
    nomeM2i(azienda), sedeM2i(azienda),
    [azienda?.telefono && `Tel. ${value(azienda.telefono)}`, azienda?.email && `Email ${value(azienda.email)}`,
      azienda?.pec && `PEC ${value(azienda.pec)}`].filter(Boolean).join(' · '),
    [azienda?.partita_iva && `P. IVA ${value(azienda.partita_iva)}`,
      azienda?.codice_fiscale && `C.F. ${value(azienda.codice_fiscale)}`].filter(Boolean).join(' · ')
  ].filter(Boolean);
}

export function testoAppaltoConDatiM2i(source, azienda) {
  const nome = nomeM2i(azienda) || '________________';
  const iva = value(azienda?.partita_iva) || '________________';
  const sede = sedeM2i(azienda) || '________________';
  const pec = value(azienda?.pec) || '________________';
  const polizza = value(azienda?.numero_polizza_rct) || '________________';
  const compagnia = value(azienda?.compagnia_polizza_rct) || '________________';
  return String(source || '')
    .replace(/ROMA \(RM\) in VIA DEL FONTANILE ANAGNINO, 183, CAP 00118/gi, sede)
    .replace(/Via del Fontanile Anagnino n\. 183\s*[–-]\s*00118 Roma/gi, sede)
    .replace(/M2I S\.R\.L\./gi, nome)
    .replace(/15989811003/g, iva)
    .replace(/2021\/03\/2430364/g, polizza)
    .replace(/REALE MUTUA/g, compagnia)
    .replace(/emmedueisrl@pec\.it/gi, pec);
}
