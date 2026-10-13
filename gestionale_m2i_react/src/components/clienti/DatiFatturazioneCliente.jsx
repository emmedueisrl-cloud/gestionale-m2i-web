const fields = [
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

export const campiFatturazioneCliente = fields.map(([key]) => key);

export default function DatiFatturazioneCliente({ dati, handleChange }) {
  return <section>
    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">Dati fatturazione elettronica</h3>
    <p className="mb-4 text-xs text-slate-400">I dati estratti dagli XML possono essere controllati e corretti qui.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map(([key, label]) => <label key={key} className="text-sm text-slate-200">{label}
        <input name={key} value={dati[key] || ''} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-slate-100" />
      </label>)}
    </div>
  </section>;
}
