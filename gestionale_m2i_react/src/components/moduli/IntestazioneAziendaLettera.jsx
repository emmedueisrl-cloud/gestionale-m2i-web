import { companyStampUrl } from '../../utils/companyStampUrl';
import { nomeM2i, righeIntestazioneM2i } from '../../utils/datiM2iDocumento';

export default function IntestazioneAziendaLettera({ azienda, area = 'Risorse umane', descrizione = 'Comunicazione individuale' }) {
  const logo = companyStampUrl(azienda?.logo_path);
  const lines = righeIntestazioneM2i(azienda);
  return <header className="flex items-start justify-between gap-4 border-b-2 border-blue-800 pb-2">
    <div className="flex min-w-0 items-start gap-3">
      {logo && <img src={logo} alt="Logo M2I" className="max-h-12 max-w-28 shrink-0 object-contain" />}
      <div className="min-w-0 text-[10px] leading-[1.25] text-slate-700">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.05em] text-slate-950">{nomeM2i(azienda)}</p>
        {lines.slice(1).map((line, index) => <p key={index}>{line}</p>)}
      </div>
    </div>
    {(area || descrizione) && <p className="shrink-0 text-right text-[9px] font-bold uppercase tracking-[0.15em] text-blue-800">{area}{area && descrizione && <br />}{descrizione}</p>}
  </header>;
}
