export const MODELLO_STANDARD = 'standard';
export const MODELLO_BB_IN_URBE = 'bb_in_urbe';
export const opzioniModelloAppalto = [
  { value: MODELLO_STANDARD, label: 'Modello standard' },
  { value: MODELLO_BB_IN_URBE, label: 'Modello B&B IN URBE' }
];
export const nomeModelloAppalto = value => opzioniModelloAppalto.find(option => option.value === value)?.label || 'Modello standard';
