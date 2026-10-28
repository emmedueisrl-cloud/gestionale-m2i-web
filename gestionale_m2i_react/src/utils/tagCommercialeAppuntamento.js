export const TAG_COMMERCIALI = ['In trattativa', 'KO', 'CONTRATTUALIZZATO'];

export const tagCommerciale = appuntamento => appuntamento.stato === 'Annullato'
  ? 'KO' : appuntamento.tagCommerciale || 'In trattativa';

export const stileTagCommerciale = tag => tag === 'KO'
  ? 'border-rose-400/35 bg-rose-500/15 text-rose-200'
  : tag === 'CONTRATTUALIZZATO'
    ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
    : 'border-indigo-400/35 bg-indigo-500/15 text-indigo-200';
