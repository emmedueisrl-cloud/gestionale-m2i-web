import React from 'react';
import IntestazioneAziendaLettera from './IntestazioneAziendaLettera';
import originale from './regolamentoInternoOriginale.json';

export const NUMERO_PAGINE_REGOLAMENTO = originale.pages.length;

const heading = line => /^\d+\.\s+\S/.test(line);
const subheading = line => ['Malattia', 'Ferie', 'Permessi', 'Infortuni sul lavoro'].includes(line);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value || '________________';

function blocks(lines) {
  const result = [];
  let current = '';
  const flush = () => { if (current) result.push({ type: 'text', text: current }); current = ''; };
  lines.forEach(line => {
    if (heading(line) || subheading(line)) {
      flush(); result.push({ type: 'heading', text: line }); return;
    }
    if (line === '-' || line === '∙') {
      flush(); current = line; return;
    }
    current = current ? `${current} ${line}` : line;
    if (/[.;:!?]$/.test(line) && !/\b(?:S\.r\.l|ecc)\.$/.test(line)) flush();
  });
  flush();
  return result;
}

export function dichiarazioneRegolamento(d = {}) {
  const nome = [d.nome, d.cognome].filter(Boolean).join(' ').trim() || '________________';
  const codiceFiscale = d.codiceFiscale || d.codice_fiscale;
  const residenza = [d.indirizzo, d.cap, d.citta, d.provincia ? `(${d.provincia})` : ''].filter(Boolean).join(', ') || '________________';
  const tipo = /indeterminato/i.test(d.tipoContratto || '') ? 'TEMPO INDETERMINATO' :
    /determinato/i.test(d.tipoContratto || '') ? 'TEMPO DETERMINATO' : 'TEMPO ________________';
  return `IO SOTTOSCRITTO ${nome}${codiceFiscale ? `, CODICE FISCALE ${codiceFiscale}` : ''}, RESIDENTE IN ${residenza}, CON CONTRATTO A ${tipo} FIRMATO IN DATA ${date(d.dataFirma)}, RICEVO E ACCETTO IL REGOLAMENTO INTERNO COMPOSTO DA ${NUMERO_PAGINE_REGOLAMENTO} PAGGINE.`;
}

export default function RegolamentoInterno({ azienda, formData = {} }) {
  return <div className="regolamento-interno font-sans text-slate-900">
    <style>{'@page { size: A4; margin: 8mm; }'}</style>
    <style>{'@page { size: A4; margin: 8mm; }'}</style>
    {originale.pages.map((page, pageIndex) => {
      const last = pageIndex === originale.pages.length - 1;
      const content = last ? page.filter(line => line !== 'Per ricevuta ed accettazione' && line !== '_______________________') : page;
      const first = pageIndex === 0;
      return <section key={pageIndex} className="regolamento-pagina mx-auto box-border w-full max-w-[190mm] bg-white px-6 py-5 print:max-w-none print:px-0 print:py-0"
        style={{ breakBefore: 'page', breakAfter: last ? 'auto' : 'page', pageBreakBefore: 'always', pageBreakAfter: last ? 'auto' : 'always' }}>
        <IntestazioneAziendaLettera azienda={azienda} area="" descrizione="" />
        {first && <div className="mt-5 mb-5 text-center"><h2 className="text-[14px] font-bold uppercase text-blue-800">{page[0]}</h2>
          <p className="mt-2 text-[11px] font-semibold">{page[1]}</p></div>}
        <div className="mt-5 space-y-2 text-[11px] leading-[1.45] text-justify">
          {blocks(first ? content.slice(2) : content).map((block, index) => block.type === 'heading'
            ? <h3 key={index} className="break-after-avoid pt-2 text-[11px] font-bold text-blue-800">{block.text}</h3>
            : <p key={index}>{block.text}</p>)}
        </div>
        {last && <div className="mt-8 break-inside-avoid text-[11px] leading-[1.6]">
          <p className="font-semibold">{dichiarazioneRegolamento(formData)}</p>
          <p className="mt-6">Per ricevuta ed accettazione</p>
          <div className="mt-2 h-[30mm] w-[85mm] border border-slate-400 p-2">
            <span className="text-[10px] text-slate-500">Firma del lavoratore</span>
          </div>
        </div>}
      </section>;
    })}
  </div>;
}
