import { campiFatturazione } from './campiFatturazioneCliente';

export default function DatiFatturazioneCliente({ dati, handleChange }) {
  return <section>
    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">Dati fatturazione elettronica</h3>
    <p className="mb-4 text-xs text-slate-400">I dati estratti dagli XML possono essere controllati e corretti qui. I campi assenti negli XML restano vuoti.{dati.tipoCliente === 'PRIVATO' ? ' Per un privato senza SdI o PEC, l’XML userà 0000000. Il trattamento IVA dipende dalla prestazione: il solo codice fiscale non cambia l’aliquota.' : ''}</p>
    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="text-sm text-slate-200">Trattamento fiscale
        <select name="tipoTassazione" value={dati.tipoTassazione} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-slate-100">
          <option value="IVA">IVA</option>
          <option value="TRAT. ACC.">TRAT. ACC.</option>
          <option value="REVERSE CHARGE">REVERSE CHARGE</option>
          <option value="DICHIARAZIONE D'INTENTO">Dichiarazione d'intento (D.INT)</option>
          <option value="ALTRO">ALTRO</option>
        </select>
      </label>
      <label className="text-sm text-slate-200">Aliquota IVA (%)
        <input type="number" step="0.01" name="percentualeTassazione" value={dati.percentualeTassazione} onChange={handleChange} disabled={['REVERSE CHARGE', "DICHIARAZIONE D'INTENTO"].includes(dati.tipoTassazione)} className={`mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-slate-100 ${['REVERSE CHARGE', "DICHIARAZIONE D'INTENTO"].includes(dati.tipoTassazione) ? 'opacity-50' : ''}`} />
      </label>
      {dati.tipoTassazione === 'ALTRO' && <label className="text-sm text-slate-200">Specifica altro trattamento
        <input type="text" name="tassazioneAltro" value={dati.tassazioneAltro || ''} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-slate-100" />
      </label>}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {campiFatturazione.filter(([key]) =>
        (dati.tipoCliente !== 'PRIVATO' || key !== 'fatturazione_id_paese_iva') &&
        (!key.startsWith('fatturazione_intento_') || dati.tipoTassazione === "DICHIARAZIONE D'INTENTO")
      ).map(([key, label]) => <label key={key} className="text-sm text-slate-200">{label}
        <input name={key} value={dati[key] || ''} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-slate-100" />
      </label>)}
    </div>
  </section>;
}
