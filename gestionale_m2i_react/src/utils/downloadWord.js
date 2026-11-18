import { AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import RegolamentoInterno from '../components/moduli/RegolamentoInterno';
import { testoContrattoAppalto } from '../components/appalto/testoContrattoAppalto';
import { companyStampUrl } from './companyStampUrl';
import { nomeContrattoAssunzione } from './printContrattoAssunzione';
import { nomeLetteraTrasformazione } from './printLetteraTrasformazione';
import { nomeLetteraProroga } from './printLetteraProroga';
import { nomeContrattoAppalto } from './printContrattoAppalto';

const BLUE = '1E40AF';
const GRAY = '475569';
const date = (value, separator = '/') => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? `${value.slice(8, 10)}${separator}${value.slice(5, 7)}${separator}${value.slice(0, 4)}` : value || '____ / ____ / ________';
const str = value => String(value ?? '');
const text = (value, options = {}) => new TextRun({ text: str(value), ...options });
const para = (value, options = {}) => new Paragraph({ children: Array.isArray(value) ? value : [text(value)], spacing: { after: 145 }, ...options });
const heading = value => para(value, { style: 'Heading2', spacing: { before: 240, after: 120 }, keepWithNext: true });
const title = value => para(value, { style: 'Title', spacing: { before: 180, after: 200 } });
const small = value => para(value, { style: 'Small', spacing: { after: 60 } });
const strong = value => text(value, { bold: true });
const recipient = d => [str(d.cognome).toUpperCase() + ' ' + str(d.nome).toUpperCase(), str(d.indirizzo).toUpperCase(),
  [d.cap, d.citta, d.provincia ? `(${d.provincia})` : ''].filter(Boolean).join(' ').toUpperCase()].filter(Boolean);

async function image(path, width, height) {
  const url = companyStampUrl(path);
  if (!url) return null;
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Impossibile caricare il logo o il timbro aziendale.');
  const type = response.headers.get('content-type')?.split(';')[0];
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/bmp'].includes(type)) throw new Error('Formato del logo o timbro non supportato in Word. Usa PNG o JPEG.');
  return new ImageRun({ data: new Uint8Array(await response.arrayBuffer()), type: type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1], transformation: { width, height } });
}

async function brand(company, area) {
  const logo = await image(company?.logo_path, 104, 47);
  const sede = company?.sede_legale || 'VIA DEL FONTANILE ANAGNINO 183, 00118 ROMA (RM)';
  const line = [sede, `Tel. ${company?.telefono || '351 547 1406'} · PEC ${company?.pec || 'emmedueisrl@pec.it'}`, `P. IVA ${company?.partita_iva || '15989811003'}`];
  const items = [];
  if (logo) items.push(para([logo], { spacing: { after: 70 } }));
  items.push(para([strong(company?.ragione_sociale || 'M2I S.R.L.'), ...(area ? [text(`   ${area}`, { color: BLUE, size: 18 })] : [])], { spacing: { after: 45 } }));
  line.forEach(value => items.push(small(value)));
  items.push(para('', { border: { bottom: { color: BLUE, size: 12, style: BorderStyle.SINGLE } }, spacing: { after: 150 } }));
  return items;
}

async function signature(company, label = 'Timbro e firma') {
  const stamp = await image(company?.timbro_path, 208, 94);
  return [para(label, { alignment: AlignmentType.RIGHT, spacing: { before: 150, after: 55 } }),
    ...(stamp ? [para([stamp], { alignment: AlignmentType.RIGHT, spacing: { after: 0 } })] : []),
    para('____________________________', { alignment: AlignmentType.RIGHT, spacing: { after: 130 } })];
}

async function appaltoSignature(company) {
  const stamp = await image(company?.timbro_path, 208, 94);
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
  }, rows: [new TableRow({ children: [
    new TableCell({ children: [para('APPALTATORE', { alignment: AlignmentType.CENTER }),
      ...(stamp ? [para([stamp], { alignment: AlignmentType.CENTER })] : [para(' ')]),
      para('____________________________', { alignment: AlignmentType.CENTER })] }),
    new TableCell({ children: [para('COMMITTENTE', { alignment: AlignmentType.CENTER }),
      para(' ', { spacing: { before: 900, after: 120 } }),
      para('____________________________', { alignment: AlignmentType.CENTER })] })
  ] })] });
}

async function acceptance(company) {
  const stamp = await image(company?.timbro_path, 208, 94);
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
  }, rows: [new TableRow({ children: [
    new TableCell({ width: { size: 65, type: WidthType.PERCENTAGE }, children: [
      heading('Accettazione del lavoratore'),
      para('Accuso ricevuta della lettera di assunzione conforme alla copia riportata e l’accetto in ogni sua parte. Dichiaro inoltre di essere a perfetta conoscenza delle norme disciplinari relative alle infrazioni, alla procedura di contestazione ed alle sanzioni contenute nel Codice civile e nella Legge 300/1970 art. 7 e nel contratto collettivo.'),
      para('Firma del lavoratore __________________________')
    ] }),
    new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [
      para('Il datore di lavoro', { alignment: AlignmentType.CENTER }),
      ...(stamp ? [para([stamp], { alignment: AlignmentType.CENTER })] : []),
      para('____________________________', { alignment: AlignmentType.CENTER })
    ] })
  ] })] });
}

function addressee(d, company) {
  return [small(`Datore di lavoro: ${company?.ragione_sociale || 'M2I S.R.L.'} · ${company?.sede_legale || ''}`),
    ...recipient(d).map(line => small(line))];
}

function regulation() {
  const html = renderToStaticMarkup(createElement(RegolamentoInterno, { dataFirma: '' }));
  const dom = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(dom.querySelectorAll('h2, h3, p, li')).map(el => {
    const value = el.textContent.trim();
    if (el.tagName === 'H2') return title(value);
    if (el.tagName === 'H3') return heading(value);
    return para(value);
  });
}

async function assunzione(d, a) {
  const maschio = d.sesso === 'M';
  const assunto = maschio ? 'assunto' : 'assunta';
  const obbligato = maschio ? 'obbligato' : 'obbligata';
  const autorizzato = maschio ? 'autorizzato' : 'autorizzata';
  const ccnl = d.ccnlRetribuzione || (str(d.livelloCCNL).includes('C.C.N.L.') ? str(d.livelloCCNL).split(' ').slice(1).join(' ') : 'C.C.N.L. Pulizie');
  const rows = [
    ['01  Durata del lavoro', d.tipoContratto === 'Indeterminato' ? 'Tempo indeterminato.' : `Tempo determinato fino al ${date(d.dataFine)}, ai sensi del D.Lgs. n. 81 del 15/06/2015 e art. 17 D.L. 22 marzo 2021 n. 41.`],
    ['02  Qualifica, mansioni e categoria', `Qualifica: ${d.qualifica}. Mansioni: ${d.mansioni}. Livello: ${d.livelloCCNL}.`],
    ['03  Orario e retribuzione', `L’orario stabilito è di ${d.oreSettimanali}. La retribuzione sarà quella prevista dal ${ccnl}.`],
    ['04  Posizioni assicurative', `INAIL: ${a?.posizione_inail || '________'} · INPS: ${a?.posizione_inps || '________'}`],
    ['05  Periodo di prova', `Il periodo di prova avrà la durata di ${d.periodoProva} giorni di lavoro effettivo.`],
    ['06  Sede', `La sede dell’attività è sita in ${d.sedeLavoro || a?.sede_legale || 'Via del Fontanile Anagnino 183, Roma'}. Il datore di lavoro si riserva il diritto di affidarle, per motivi inerenti all’attività lavorativa, compiti o mansioni anche fuori sede.`],
    ['07  Regolamento ed usi dell’azienda', 'Dovrà attenersi al regolamento, alle disposizioni e agli usi della società, che si intendono conosciuti e accettati qualora non abbia avanzato eccezioni per iscritto entro la scadenza del periodo di prova.']
  ];
  const body = [...await brand(a, 'Risorse umane · Comunicazione individuale'), title('Lettera di assunzione'), small(`Roma, ${date(d.dataFirma)}`), ...addressee(d, a),
    para([text(`Gentile ${maschio ? 'Sig.' : 'Sig.ra'} `), strong(`${d.cognome} ${d.nome}`), text(`, siamo lieti di comunicarLe che Lei è ${assunto} alle nostre dipendenze dal giorno `), strong(date(d.dataInizio)), text(' alle seguenti condizioni.')]),
    heading('Condizioni del rapporto')];
  rows.forEach(([label, value]) => { body.push(para([strong(label), text(`\n${value}`)], { spacing: { after: 100 } })); });
  body.push(small(`Roma, ${date(d.dataFirma)}`), ...await signature(a, 'Il datore di lavoro'), heading('Trattamento dei dati personali'),
    para('Per l’instaurazione e l’esecuzione del rapporto di lavoro regolato dal presente contratto, la Società acquisisce e tratta i Suoi dati personali, conformemente a quanto previsto dal Regolamento UE 2016/679 e dalla normativa nazionale vigente, compresi eventuali provvedimenti emanati dall’Autorità di Controllo, ove applicabili, nonché allo Statuto dei Lavoratori (L. 300/1970), come da Informativa sul trattamento dei dati personali allegata.'),
    para(`In virtù del presente contratto, Lei è altresì ${obbligato} a prestare la Sua attività nel rispetto delle istruzioni impartite ai sensi dell’art. 29 Regolamento UE 2016/679 sul trattamento dei dati personali per il quale è ${autorizzato} dalla scrivente (come da documento allegato per il conferimento dell’autorizzazione al trattamento dei dati personali ed individuazione dell’ambito del trattamento consentito, ai sensi del Regolamento UE 2016/679).`),
    await acceptance(a));
  if (d.allegaRegolamento) body.push(...regulation());
  return body;
}

async function trasformazione(d, a) {
  return [...await brand(a, 'Risorse umane · Comunicazione individuale'), title('Lettera di trasformazione'), small(`Roma, ${date(d.dataFirma)}`), ...addressee(d, a),
    heading('Oggetto: trasformazione contratto di lavoro a tempo indeterminato.'),
    para(`In riferimento al rapporto di lavoro a tempo determinato instaurato con la S.V. in data ${date(d.dataAssunzione, '.')}, ai sensi del Dlgs. n. 368/2001, della Legge 247/2007 e secondo quanto previsto dall’art. 11 del CCNL Pulizie, siamo lieti di comunicarle che dalla data del ${date(d.dataTrasformazione, '.')} il suo rapporto sarà trasformato in rapporto di lavoro a tempo indeterminato.`),
    para(`La qualifica d’assunzione è quella di ${d.qualifica} con le mansioni di ${d.mansioni} ${d.livello} per ${d.oreSettimanali}.`),
    para('Per la retribuzione e gli altri aspetti del rapporto di lavoro, si fa riferimento alle norme di legge e del C.C.N.L. vigente del settore Imprese di pulizia.'),
    para(`Roma, ${date(d.dataFirma)}`, { spacing: { before: 450, after: 100 } }), ...await signature(a)];
}

async function proroga(d, a) {
  const company = a?.ragione_sociale || 'M2I S.R.L.';
  return [...await brand(a, 'Risorse umane · Comunicazione individuale'), title('Lettera di proroga'), small(`Roma, ${date(d.dataFirma, '.')}`), ...addressee(d, a),
    heading('Oggetto: comunicazione di proroga del contratto di lavoro a tempo determinato ai sensi del D.Lgs. n. 81 del 15/06/2015 e art. 17 D.L. 22 marzo 2021 n. 41.'),
    para(`Il sottoscritto ${d.amministratore}, in qualità di Amministratore Unico della “${company}” C.F. ${a?.codice_fiscale || a?.partita_iva || '15989811003'}, con sede legale a Roma in ${a?.sede_legale || 'VIA DEL FONTANILE ANAGNINO 183, 00118 ROMA (RM)'}, Le comunica la proroga del rapporto di lavoro a tempo determinato ai sensi del D.Lgs. n. 81 del 15/06/2015 e art. 17 D.L. 22 marzo 2021 n. 41, instaurato in data ${date(d.dataAssunzione, '.')}, con scadenza al ${date(d.nuovaScadenza, '.')}.`),
    para(`La sede di lavoro e le mansioni attribuiteLe restano immutate; le ore di lavoro saranno ${d.oreSettimanali} ore settimanali. La proroga si riferisce alla stessa attività lavorativa per la quale è stato stipulato inizialmente il contratto a termine.`),
    para('La preghiamo sottoscrivere la copia della presente, per ricevuta e per integrale accettazione del contenuto.'),
    para(`Roma, ${date(d.dataFirma)}`), para('Firma del lavoratore __________________________'), ...await signature(a),
    para('Per l’instaurazione e l’esecuzione del rapporto di lavoro regolato dal presente contratto, la Società acquisisce e tratta i Suoi dati personali, conformemente a quanto previsto dal Regolamento UE 2016/679 e dalla normativa nazionale vigente, compresi eventuali provvedimenti emanati dall’Autorità di Controllo, ove applicabili, nonché dallo Statuto dei Lavoratori (L. 300/1970), come da Informativa sul trattamento dei dati personali allegata.'),
    para('In virtù del presente contratto, Lei è altresì obbligato/a a prestare la Sua attività nel rispetto delle istruzioni impartite ai sensi dell’art. 29 Regolamento UE 2016/679 sul trattamento dei dati personali per il quale è autorizzato dalla scrivente (come da documento allegato per il conferimento dell’autorizzazione al trattamento dei dati personali ed individuazione dell’ambito del trattamento consentito, ai sensi del Regolamento UE 2016/679).'),
    para('Firma del lavoratore __________________________')];
}

async function appalto(d, a) {
  const paragraphs = testoContrattoAppalto(d, a);
  const headings = new Set([10, 13, 19, 25, 34, 38, 45, 50, 59, 63, 66, 70, 74, 79, 82, 95]);
  const body = [...await brand(a, '')];
  for (const [index, value] of paragraphs.entries()) {
    if (!value.trim()) continue;
    if (index === 0) body.push(title(value));
    else if (headings.has(index)) body.push(para(value, { style: 'Heading2', spacing: { before: 160, after: 90 }, keepWithNext: true }));
    else if (index === 100 || index === 117) body.push(await appaltoSignature(a));
    else body.push(para(value, { spacing: { after: index === 8 ? 150 : 65 } }));
  }
  return body;
}

function footer(company, isAppalto) {
  const children = isAppalto ? [small(`${company?.ragione_sociale || 'M2I S.R.L.'} · P. IVA ${company?.partita_iva || '15989811003'} · ${company?.sede_legale || ''}`),
    small(`Tel. ${company?.telefono || '351 547 1406'} · PEC ${company?.pec || 'emmedueisrl@pec.it'}`)] : [];
  children.push(para([text('Pagina ', { color: GRAY }), new TextRun({ children: [PageNumber.CURRENT], color: GRAY }),
    text('/' , { color: GRAY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], color: GRAY })],
  { alignment: AlignmentType.RIGHT }));
  return new Footer({ children });
}

export async function downloadWord(type, data, company) {
  const generators = { assunzione, trasformazione, proroga, appalto };
  const names = { assunzione: nomeContrattoAssunzione, trasformazione: nomeLetteraTrasformazione,
    proroga: nomeLetteraProroga, appalto: nomeContrattoAppalto };
  if (!generators[type]) throw new Error('Tipo di documento non supportato.');
  const children = await generators[type](data, company);
  const compact = type === 'assunzione';
  const doc = new Document({ styles: { default: { document: { run: { font: 'Arial', size: type === 'appalto' ? 20 : compact ? 19 : type === 'proroga' ? 22 : 25 }, paragraph: { spacing: { line: compact ? 220 : type === 'proroga' || type === 'appalto' ? 260 : 300 } } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: 'Arial', size: compact ? 29 : 32, bold: true, color: BLUE } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', run: { font: 'Arial', size: compact ? 19 : 24, bold: true, color: BLUE } },
      { id: 'Small', name: 'Small', basedOn: 'Normal', run: { font: 'Arial', size: 18, color: GRAY } }
  ] }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: compact || type === 'proroga' ? 600 : 850, right: 850, bottom: compact ? 650 : type === 'appalto' || type === 'proroga' ? 600 : 900, left: 850 } } },
      footers: { default: footer(company, type === 'appalto') }, children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${names[type](data)}.docx`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
