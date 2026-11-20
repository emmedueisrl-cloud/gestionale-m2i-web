import testo from './contrattoAppaltoTesto.json' with { type: 'json' };
import standard from './contrattoAppaltoStandardTesto.json' with { type: 'json' };

export const opzioniRegimeIvaAppalto = [
  { value: 'reverse', label: 'Reverse charge' },
  { value: 'iva', label: 'IVA normale' },
  { value: 'ritenuta', label: 'Ritenuta d’acconto' },
  { value: 'intenti', label: 'Dichiarazione d’intento' }
];

const dichiarazioneIntento = 'Il corrispettivo pattuito è fatturato senza applicazione dell’IVA, nei limiti della dichiarazione d’intento trasmessa dal Committente e verificata dall’Appaltatore; gli estremi saranno indicati in fattura.';

export const ivaOptions = {
  reverse: testo.paragrafi[29].replace(/\s*\( FAMMI SCEGLIERE[\s\S]*$/, ''),
  iva: 'Il costo pattuito è soggetto ad IVA, secondo l’aliquota indicata in fattura.',
  ritenuta: 'Il costo pattuito è soggetto alla ritenuta d’acconto indicata in fattura.',
  intenti: dichiarazioneIntento
};

export const ivaOptionsStandard = {
  reverse: standard.paragrafi[30],
  iva: 'Il corrispettivo pattuito è soggetto a IVA secondo l’aliquota applicabile, esposta nella fattura mensile.',
  ritenuta: 'Il corrispettivo pattuito è soggetto alla ritenuta d’acconto applicabile, indicata in fattura.',
  intenti: dichiarazioneIntento
};

export const clausoleIvaPerModello = modello => modello === 'bb_in_urbe' ? ivaOptions : ivaOptionsStandard;

export function clausolaFiscaleAppalto(modello, regime, custom) {
  const value = String(custom || '').trim();
  if (modello !== 'bb_in_urbe' && regime === 'reverse' && /^Il costo pattuito è esente IVA/i.test(value)) {
    return ivaOptionsStandard.reverse;
  }
  return value || clausoleIvaPerModello(modello)[regime] || '';
}
