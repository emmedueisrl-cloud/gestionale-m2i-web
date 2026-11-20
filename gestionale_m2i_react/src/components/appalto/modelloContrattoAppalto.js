import { testoContrattoAppalto } from './testoContrattoAppalto';
import { testoContrattoAppaltoStandard } from './testoContrattoAppaltoStandard';
import { MODELLO_BB_IN_URBE } from './modelliAppalto';

const headingsBB = new Set([10, 13, 19, 25, 34, 38, 45, 50, 59, 63, 66, 70, 74, 79, 82, 95]);
const headingsStandard = new Set([10, 12, 16, 22, 28, 35, 39, 46, 51, 62, 66, 69, 73, 77, 82, 85, 95]);

export function modelloContrattoAppalto(data, azienda) {
  const bb = data?.modello === MODELLO_BB_IN_URBE;
  return { paragrafi: bb ? testoContrattoAppalto(data, azienda) : testoContrattoAppaltoStandard(data, azienda),
    headings: bb ? headingsBB : headingsStandard,
    firme: new Set([100, 117]) };
}
