import testo from './contrattoAppaltoTesto.json';
import { importoInLettere } from './importoInLettere';

const dateIt = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value || '________________';
const blank = value => String(value || '').trim() || '________________';

export function testoContrattoAppalto(data, azienda) {
  const p = [...testo.paragrafi];
  p[4] = `${blank(data.ragioneSociale)} (P.I.: ${blank(data.partitaIva)}), con sede legale in ${blank(data.sedeLegale)}, in persona del legale rappresentante Sig.ra ${blank(data.rappresentante)} nato a (${blank(data.luogoNascitaRappresentante)}), il ${dateIt(data.dataNascitaRappresentante)} munito di documento di riconoscimento del tipo ${blank(data.tipoDocumento)} n° ${blank(data.numeroDocumento)}, rilasciato da ${blank(data.rilasciatoDa)} - ${dateIt(data.dataRilascioDocumento)} (come da fotocopia allegata),`;
  p[11] = p[11].replace('locali:_______________________', `locali:${blank(data.localiServizio)}`);
  p[20] = `Il presente contratto ha la durata di ${blank(data.durata)} e produrrà i propri effetti dal ${dateIt(data.dataInizio)} e sino al ${dateIt(data.dataFine)}.`;
  p[26] = `A fronte del servizio oggetto del presente contratto, la Committente si impegna a corrispondere all'Appaltatore un corrispettivo mensile pari ad euro ${blank(data.corrispettivo)} [${blank(importoInLettere(data.corrispettivo))}], a fronte di un monte ore complessivo pari a ${blank(data.oreMensili)} ore mensili. `;
  p[28] = p[28].replace('60 ore mensili', `${blank(data.oreMensili)} ore mensili`);
  p[29] = data.clausolaIva || p[29].replace(/\s*\( FAMMI SCEGLIERE[\s\S]*$/, '');
  p[61] = p[61].replace('2021/03/2430364', azienda?.numero_polizza_rct || '2021/03/2430364');
  p[89] = `Committente: ${blank(data.indirizzoComunicazioni)}`;
  p[98] = `Roma, ${dateIt(data.dataFirma)}`;
  p[114] = `Roma, ${dateIt(data.dataFirma)}`;
  return p;
}
