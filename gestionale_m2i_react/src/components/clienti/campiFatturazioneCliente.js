export const campiFatturazione = [
  ['fatturazione_paese', 'Paese (es. IT)'],
  ['fatturazione_id_paese_iva', 'Paese partita IVA (es. IT)'],
  ['fatturazione_natura', 'Natura IVA (es. N6.7)'],
  ['fatturazione_riferimento_normativo', 'Riferimento normativo'],
  ['fatturazione_esigibilita_iva', 'Esigibilità IVA (I/S/D)'],
  ['fatturazione_tipo_ritenuta', 'Tipo ritenuta (es. RT01)'],
  ['fatturazione_aliquota_ritenuta', 'Aliquota ritenuta'],
  ['fatturazione_causale_pagamento', 'Causale pagamento'],
  ['fatturazione_modalita_pagamento', 'Modalità pagamento (es. MP05)'],
  ['fatturazione_condizioni_pagamento', 'Condizioni pagamento (es. TP02)']
];

export const campiFatturazioneCliente = campiFatturazione.map(([key]) => key);
