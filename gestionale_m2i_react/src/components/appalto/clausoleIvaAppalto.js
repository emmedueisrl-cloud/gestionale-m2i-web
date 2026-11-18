import testo from './contrattoAppaltoTesto.json';

export const ivaOptions = {
  reverse: testo.paragrafi[29].replace(/\s*\( FAMMI SCEGLIERE[\s\S]*$/, ''),
  iva: 'Il costo pattuito è soggetto ad IVA, secondo l’aliquota indicata in fattura.',
  ritenuta: 'Il costo pattuito è soggetto alla ritenuta d’acconto indicata in fattura.'
};
