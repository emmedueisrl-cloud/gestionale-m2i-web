const CAUSALI_LAVORO = new Set(['ordinario', 'straordinario', 'extra']);

function calcolaCostoPersonalePerCliente(dipendenti, registrazioniOre) {
  const nettoPerDipendente = new Map(dipendenti.map(row => [String(row.idDipendente), Number(row.stipendioNetto) || 0]));
  const oreTotaliPerDipendente = new Map();
  const orePerDipendenteCliente = new Map();

  for (const row of registrazioniOre) {
    const idDipendente = row.dipendente_id == null ? null : String(row.dipendente_id);
    const ore = Number(row.ore_totali) || 0;
    const causale = String(row.causale_assenza || 'Ordinario').trim().toLowerCase();
    if (!idDipendente || ore <= 0 || !CAUSALI_LAVORO.has(causale)) continue;

    oreTotaliPerDipendente.set(idDipendente, (oreTotaliPerDipendente.get(idDipendente) || 0) + ore);
    if (row.cliente_id == null) continue;
    const idCliente = String(row.cliente_id);
    if (!orePerDipendenteCliente.has(idDipendente)) orePerDipendenteCliente.set(idDipendente, new Map());
    const oreCliente = orePerDipendenteCliente.get(idDipendente);
    oreCliente.set(idCliente, (oreCliente.get(idCliente) || 0) + ore);
  }

  const costi = new Map();
  for (const [idDipendente, oreClienti] of orePerDipendenteCliente) {
    const oreTotali = oreTotaliPerDipendente.get(idDipendente);
    if (!oreTotali || !nettoPerDipendente.has(idDipendente)) continue;
    const netto = nettoPerDipendente.get(idDipendente);
    for (const [idCliente, oreCliente] of oreClienti) {
      costi.set(idCliente, (costi.get(idCliente) || 0) + netto * oreCliente / oreTotali);
    }
  }

  return new Map([...costi].map(([idCliente, costo]) => [idCliente, Math.round((costo + Number.EPSILON) * 100) / 100]));
}

function statoCostoPersonalePerCliente(dipendenti, registrazioniOre, meseChiuso = false) {
  const costoDefinitivo = Boolean(meseChiuso) || (dipendenti.length > 0 && dipendenti.every(r => r.rigaBloccata === true));
  const stati = new Map();
  for (const r of registrazioniOre) {
    if (!r.cliente_id || Number(r.ore_totali) <= 0 || !CAUSALI_LAVORO.has(String(r.causale_assenza || 'Ordinario').trim().toLowerCase())) continue;
    const id = String(r.cliente_id);
    stati.set(id, costoDefinitivo);
  }
  return stati;
}

module.exports = { calcolaCostoPersonalePerCliente, statoCostoPersonalePerCliente };
