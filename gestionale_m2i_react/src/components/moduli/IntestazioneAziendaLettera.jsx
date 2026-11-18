import { companyStampUrl } from '../../utils/companyStampUrl';

const sedePredefinita = 'VIA DEL FONTANILE ANAGNINO 183, 00118 ROMA (RM)';

function indirizzoAzienda(azienda) {
  const sede = String(azienda?.sede_legale || '').trim() || sedePredefinita;
  const match = sede.match(/(?:,?\s+)(\d{5})\s+([^(),]+?)(?:\s*\(([A-Z]{2})\))?$/i);
  return {
    via: match ? sede.slice(0, match.index).replace(/[\s,–-]+$/, '') : sede,
    cap: match?.[1] || azienda?.fatturazione_cap || '00118',
    comune: match?.[2]?.trim() || azienda?.fatturazione_citta || 'ROMA',
    provincia: match?.[3] || azienda?.fatturazione_provincia || 'RM'
  };
}

export default function IntestazioneAziendaLettera({ azienda, area = 'Risorse umane', descrizione = 'Comunicazione individuale' }) {
  const logo = companyStampUrl(azienda?.logo_path);
  const sede = indirizzoAzienda(azienda);
  const telefono = String(azienda?.telefono || '').trim() || '351 547 1406';
  const pec = String(azienda?.pec || '').trim() || 'emmedueisrl@pec.it';
  const partitaIva = String(azienda?.partita_iva || '').trim() || '15989811003';
  return <header className="flex items-start justify-between gap-4 border-b-2 border-blue-800 pb-2">
    <div className="flex min-w-0 items-start gap-3">
      {logo && <img src={logo} alt="Logo M2I" className="max-h-12 max-w-28 shrink-0 object-contain" />}
      <div className="min-w-0 text-[10px] leading-[1.25] text-slate-700">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.05em] text-slate-950">{azienda?.ragione_sociale || 'M2I S.R.L.'}</p>
        <p>{sede.via} · CAP {sede.cap} · Comune {sede.comune}{sede.provincia && ` (${sede.provincia})`}</p>
        <p>Tel. {telefono} · PEC {pec}</p>
        <p>P. IVA {partitaIva}</p>
      </div>
    </div>
    {(area || descrizione) && <p className="shrink-0 text-right text-[9px] font-bold uppercase tracking-[0.15em] text-blue-800">{area}{area && descrizione && <br />}{descrizione}</p>}
  </header>;
}
