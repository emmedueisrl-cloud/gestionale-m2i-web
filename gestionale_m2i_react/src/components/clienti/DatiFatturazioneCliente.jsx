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
    <p className="mb-4 text-xs text-slate-400">I dati estratti dagli XML possono essere controllati e corretti qui. I campi assenti negli XML restano vuoti.</p>
    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="text-sm text-slate-200">Trattamento fiscale
        <select name="tipoTassazione" value={dati.tipoTassazione} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-slate-100">
          <option value="IVA">IVA</option>
          <option value="TRAT. ACC.">TRAT. ACC.</option>
          <option value="REVERSE CHARGE">REVERSE CHARGE</option>
          <option value="ALTRO">ALTRO</option>
        </select>
      </label>
      <label className="text-sm text-slate-200">Aliquota IVA (%)
        <input type="number" step="0.01" name="percentualeTassazione" value={dati.percentualeTassazione} onChange={handleChange} disabled={dati.tipoTassazione === 'REVERSE CHARGE'} className={`mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-slate-100 ${dati.tipoTassazione === 'REVERSE CHARGE' ? 'opacity-50' : ''}`} />
      </label>
      {dati.tipoTassazione === 'ALTRO' && <label className="text-sm text-slate-200">Specifica altro trattamento
        <input type="text" name="tassazioneAltro" value={dati.tassazioneAltro || ''} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-slate-100" />
      </label>}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map(([key, label]) => <label key={key} className="text-sm text-slate-200">{label}
        <input name={key} value={dati[key] || ''} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-slate-100" />
      </label>)}
    </div>
  </section>;
}
