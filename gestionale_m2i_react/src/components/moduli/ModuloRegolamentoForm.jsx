import { useEffect, useState } from 'react';
import { recuperaDatiAzienda } from '../../api/azienda';
import { provinciaDaComune } from '../../utils/provinciaDaComune';
import RegolamentoInterno from './RegolamentoInterno';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white';

export default function ModuloRegolamentoForm({ dipendenteData, onClose, onGenerate }) {
  const [azienda, setAzienda] = useState(null);
  const [error, setError] = useState('');
  const [values, setValues] = useState(() => {
    const employee = dipendenteData || {};
    const personal = employee.unilavDati?.anagrafica || {};
    const address = personal.domicilio || {};
    const citta = employee.citta || address.comune || '';
    return {
      nome: employee.nome || '', cognome: employee.cognome || '', codiceFiscale: employee.codice_fiscale || employee.codiceFiscale || '',
      indirizzo: employee.indirizzo || address.indirizzo || '', cap: employee.cap || address.cap || '',
      citta, provincia: employee.provincia || provinciaDaComune(citta),
      tipoContratto: /indeterminato/i.test(employee.stato || '') ? 'Indeterminato'
        : /determinato/i.test(employee.stato || '') || employee.scadenza ? 'Determinato' : '',
      dataFirma: employee.dataAssunzione || employee.data_assunzione || ''
    };
  });
  useEffect(() => {
    let active = true;
    recuperaDatiAzienda().then(result => { if (active) setAzienda(Array.isArray(result) ? result[0] : result); })
      .catch(() => { if (active) setError('Impossibile caricare i dati aziendali.'); });
    return () => { active = false; };
  }, []);
  const field = (key, label, type = 'text') => <label className="block text-sm font-semibold">{label}
    <input className={inputClass} type={type} value={values[key] || ''}
      onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} /></label>;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 text-slate-100">
    <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Regolamento interno</h2>
        <p className="mt-1 text-sm text-slate-400">Controlla i dati per la dichiarazione di accettazione. Le modifiche non aggiornano l’anagrafica.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg bg-slate-700 px-4 py-2">Chiudi</button></div>
      <form className="mt-6 space-y-5" onSubmit={event => { event.preventDefault(); onGenerate(values, azienda); }}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field('nome', 'Nome')}{field('cognome', 'Cognome')}{field('codiceFiscale', 'Codice fiscale')}
          {field('indirizzo', 'Indirizzo di residenza')}
          {field('cap', 'CAP')}{field('citta', 'Comune')}{field('provincia', 'Provincia')}
          <label className="block text-sm font-semibold">Tipo contratto<select className={inputClass} value={values.tipoContratto}
            onChange={event => setValues(current => ({ ...current, tipoContratto: event.target.value }))}>
            <option value="">Da compilare a mano</option><option value="Determinato">Tempo determinato</option>
            <option value="Indeterminato">Tempo indeterminato</option></select></label>
          {field('dataFirma', 'Data firma del contratto', 'date')}
        </div>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        <details className="rounded-xl border border-slate-700 bg-slate-800 p-4"><summary className="cursor-pointer font-bold">Anteprima</summary>
          <div className="mt-4 max-h-96 overflow-y-auto bg-white"><RegolamentoInterno formData={values} azienda={azienda} /></div></details>
        <button type="submit" disabled={!azienda} className="rounded-lg bg-indigo-600 px-5 py-3 font-bold disabled:opacity-50">Stampa regolamento</button>
      </form>
    </div>
  </div>;
}
