import testo from './contrattoAppaltoStandardTesto.json' with { type: 'json' };
import { importoInLettere } from './importoInLettere.js';
import { clausolaFiscaleAppalto } from './clausoleIvaAppalto.js';
import { titoloContrattoAppalto } from './titoloContrattoAppalto.js';
import { luogoM2i, testoAppaltoConDatiM2i } from '../../utils/datiM2iDocumento.js';

const dateIt = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '________________';
const blank = value => String(value || '').trim() || '________________';
const durataTesto = value => /^\d+$/.test(String(value || '').trim()) ? `${String(value).trim()} MESI` : blank(value);

export function testoContrattoAppaltoStandard(data, azienda) {
  const p = testo.paragrafi.map(paragrafo => testoAppaltoConDatiM2i(paragrafo, azienda));
  p[0] = titoloContrattoAppalto(data.titoloContratto);
  p[5] = `${blank(data.ragioneSociale)} (P.I.: ${blank(data.partitaIva)}), con sede legale in ${blank(data.sedeLegale)}, in persona del legale rappresentante Sig./Sig.ra ${blank(data.rappresentante)} nato/a a ${blank(data.luogoNascitaRappresentante)}, il ${dateIt(data.dataNascitaRappresentante)} munito di documento di riconoscimento del tipo ${blank(data.tipoDocumento)} n° ${blank(data.numeroDocumento)}, rilasciato da ${blank(data.rilasciatoDa)} (come da fotocopia allegata),`;
  p[13] = `Il committente concede in affidamento all’appaltatore, che accetta con l’organizzazione dei mezzi necessari e con gestione a proprio rischio, l’esecuzione delle opere di cui al presente contratto, ossia tutti i lavori di pulizia dei seguenti locali: ${blank(data.localiServizio)}. Le parti concordano che la pulizia dei locali sopra indicati comprende tutte le attività di pulizia ordinaria di seguito meglio specificate:`;
  p[14] = blank(data.attivitaPulizia);
  p[23] = `Il presente contratto ha la durata di ${durataTesto(data.durata)} e produrrà i propri effetti dal ${dateIt(data.dataInizio)} e sino al ${dateIt(data.dataFine)}.`;
  p[29] = `A fronte del servizio oggetto del presente contratto, la Committente si impegna a corrispondere all'Appaltatore un corrispettivo mensile pari ad euro ${blank(data.corrispettivo)} (${blank(importoInLettere(data.corrispettivo))}).`;
  p[30] = clausolaFiscaleAppalto('standard', data.regimeIva, data.clausolaIva) || p[30];
  p[92] = `Committente: ${blank(data.ragioneSociale)} - ${blank(data.indirizzoComunicazioni)}`;
  p[98] = `${luogoM2i(azienda)}, ${dateIt(data.dataFirma)}`;
  p[114] = `${luogoM2i(azienda)}, ${dateIt(data.dataFirma)}`;
  return p;
}
