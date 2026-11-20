import test from 'node:test';
import assert from 'node:assert/strict';
import { testoContrattoAppaltoStandard } from './testoContrattoAppaltoStandard.js';
import { testoContrattoAppalto } from './testoContrattoAppalto.js';
import { clausolaFiscaleAppalto, ivaOptionsStandard } from './clausoleIvaAppalto.js';

test('il modello standard usa recesso di 15 giorni, importo senza IVA e pagamento a vista', () => {
  const p = testoContrattoAppaltoStandard({ corrispettivo: '900', regimeIva: 'reverse' },
    { numero_polizza_rct: 'POL-TEST' });
  assert.equal(p[25], 'È prevista la facoltà di recedere anticipatamente il contratto entro e non oltre 15 giorni dalla sottoscrizione.');
  assert.match(p[29], /euro 900 \(novecento\/00\)\.$/);
  assert.doesNotMatch(p[29], /al netto dell.IVA/i);
  assert.equal(p[30], ivaOptionsStandard.reverse);
  assert.doesNotMatch(p[30], /esente IVA/i);
  assert.equal(p[31], 'Il pagamento del corrispettivo pattuito avverrà a vista all’emissione della fattura mensile.');
});

test('il titolo standard può essere sostituito in entrambi i modelli', () => {
  for (const modello of [testoContrattoAppaltoStandard, testoContrattoAppalto]) {
    assert.equal(modello({}, {})[0], 'CONTRATTO DI APPALTO PER SERVIZI DI PULIZIE');
    assert.equal(modello({ titoloContratto: 'CONTRATTO DI APPALTO PERSONALIZZATO' }, {})[0],
      'CONTRATTO DI APPALTO PERSONALIZZATO');
  }
});

test('le quattro scelte fiscali generano clausole distinte e il vecchio reverse viene aggiornato', () => {
  const options = ['reverse', 'iva', 'ritenuta', 'intenti'];
  assert.equal(new Set(options.map(option => ivaOptionsStandard[option])).size, 4);
  for (const option of options) {
    const p = testoContrattoAppaltoStandard({ regimeIva: option }, {});
    assert.equal(p[30], ivaOptionsStandard[option]);
  }
  assert.equal(clausolaFiscaleAppalto('standard', 'reverse',
    'Il costo pattuito è esente IVA, in quanto il servizio offerto rientra tra le operazioni assoggettate al reverse charge.'),
  ivaOptionsStandard.reverse);
});

test('entrambi i modelli leggono i dati M2I aggiornati anche nel corpo del contratto', () => {
  const azienda = { ragione_sociale: 'NUOVA SOCIETÀ SRL', partita_iva: '12345678901',
    sede_legale: 'VIA NUOVA 7, MILANO', pec: 'nuova@pec.it', numero_polizza_rct: 'RCT-42',
    compagnia_polizza_rct: 'COMPAGNIA TEST' };
  for (const modello of [testoContrattoAppaltoStandard, testoContrattoAppalto]) {
    const corpo = modello({}, azienda).join(' ');
    for (const valore of ['NUOVA SOCIETÀ SRL', '12345678901', 'VIA NUOVA 7, MILANO',
      'nuova@pec.it', 'RCT-42', 'COMPAGNIA TEST']) assert.ok(corpo.includes(valore), valore);
    assert.doesNotMatch(corpo, /15989811003|Fontanile Anagnino|REALE MUTUA|emmedueisrl@pec\.it/);
  }
});
