const test = require('node:test');
const assert = require('node:assert/strict');
const { calcolaCostoPersonalePerCliente } = require('../costo_personale_clienti');

test('ripartisce il netto spettante sulle ore lavorate per cliente e somma più dipendenti', () => {
  const dipendenti = [
    { idDipendente: 'D1', stipendioNetto: 1000 },
    { idDipendente: 'D2', stipendioNetto: 600 }
  ];
  const ore = [
    { dipendente_id: 'D1', cliente_id: 'C1', ore_totali: 25, causale_assenza: 'Ordinario' },
    { dipendente_id: 'D1', cliente_id: 'C1', ore_totali: 15, causale_assenza: 'Straordinario' },
    { dipendente_id: 'D1', cliente_id: 'C2', ore_totali: 60, causale_assenza: 'Extra' },
    { dipendente_id: 'D1', cliente_id: 'C1', ore_totali: 10, causale_assenza: 'Ferie' },
    { dipendente_id: 'D2', cliente_id: 'C1', ore_totali: 30, causale_assenza: null },
    { dipendente_id: 'D2', cliente_id: 'C2', ore_totali: 30, causale_assenza: 'Ordinario' }
  ];
  const costi = calcolaCostoPersonalePerCliente(dipendenti, ore);
  assert.equal(costi.get('C1'), 700);
  assert.equal(costi.get('C2'), 900);
});

test('include nel denominatore le ore lavorate senza cliente e ignora registrazioni non attribuibili', () => {
  const costi = calcolaCostoPersonalePerCliente(
    [{ idDipendente: 'D1', stipendioNetto: 120 }],
    [
      { dipendente_id: 'D1', cliente_id: 'C1', ore_totali: 3, causale_assenza: 'Ordinario' },
      { dipendente_id: 'D1', cliente_id: null, ore_totali: 1, causale_assenza: 'Ordinario' },
      { dipendente_id: 'D2', cliente_id: 'C1', ore_totali: 3, causale_assenza: 'Ordinario' },
      { dipendente_id: 'D1', cliente_id: 'C1', ore_totali: 4, causale_assenza: 'Malattia' }
    ]
  );
  assert.equal(costi.get('C1'), 90);
});
