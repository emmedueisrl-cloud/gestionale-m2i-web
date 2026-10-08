const test = require('node:test');
const assert = require('node:assert/strict');
const { calcolaImportiFatturaCliente, calcolaValoriContabilitaCliente } = require('../valori_contabilita_clienti');

test('ritenuta d’acconto: imponibile più IVA 22% meno 4% dell’imponibile', () => {
  assert.deepEqual(calcolaImportiFatturaCliente(100, 'TRAT. ACC.', 4), {
    importoIva: 22, importoRitenuta: 4, importoTotale: 118
  });
  assert.deepEqual(calcolaImportiFatturaCliente(101.23, 'TRATTENUTA ACCONTO', 22), {
    importoIva: 22.27, importoRitenuta: 4.05, importoTotale: 119.45
  });
  assert.equal(calcolaValoriContabilitaCliente({ imponibile: 0, importoTotale: 0,
    tipoTassazione: 'TRAT. ACC.', percentualeTassazione: 4 }, 0).percentualeTassaEffettiva, 18);
});

test('mostra tassa effettiva, aliquota e residuo senza stipendi', () => {
  assert.deepEqual(calcolaValoriContabilitaCliente({ imponibile: 100, importoTotale: 122, tipoTassazione: 'IVA' }, 35.5), {
    importoTassa: 22,
    percentualeTassaEffettiva: 22,
    costoPersonale: 35.5,
    residuoSenzaStipendi: 86.5
  });
  assert.equal(calcolaValoriContabilitaCliente({ imponibile: 100, importoTotale: 100, tipoTassazione: 'REVERSE CHARGE' }, 30).percentualeTassaEffettiva, 0);
});

test('con imponibile zero usa l’aliquota impostata o quella IVA predefinita', () => {
  assert.equal(calcolaValoriContabilitaCliente({ imponibile: 0, importoTotale: 0, tipoTassazione: 'IVA' }, 0).percentualeTassaEffettiva, 22);
  assert.equal(calcolaValoriContabilitaCliente({ imponibile: 0, importoTotale: 0, tipoTassazione: 'IVA', percentualeTassazione: 10 }, 0).percentualeTassaEffettiva, 10);
});
