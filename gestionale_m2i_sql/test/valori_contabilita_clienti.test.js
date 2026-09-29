const test = require('node:test');
const assert = require('node:assert/strict');
const { calcolaValoriContabilitaCliente } = require('../valori_contabilita_clienti');

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
