import { AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import RegolamentoInterno from '../components/moduli/RegolamentoInterno';
import { segmentiLetteraTrasformazione } from '../components/moduli/letteraTrasformazioneTesto';
import { dataProrogaIt, oggettoLetteraProroga, presaVisioneProroga, segmentiLetteraProroga } from '../components/moduli/letteraProrogaTesto';
import { modelloContrattoAppalto } from '../components/appalto/modelloContrattoAppalto';
import { paragrafoOriginaleContrattoAssunzione, segmentiContrattoAssunzione,
  segmentiRecapitiContrattoAssunzione, titoloContrattoAssunzione } from '../components/moduli/contrattoAssunzioneTesto';
import { companyStampUrl } from './companyStampUrl';
import { nomeContrattoAssunzione } from './printContrattoAssunzione';
import { nomeLetteraTrasformazione } from './printLetteraTrasformazione';
import { nomeLetteraProroga } from './printLetteraProroga';
import { nomeContrattoAppalto } from './printContrattoAppalto';
import { luogoM2i, nomeM2i, righeIntestazioneM2i, sedeM2i } from './datiM2iDocumento';

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
  const line = righeIntestazioneM2i(company).slice(1);
  const items = [];
  if (logo) items.push(para([logo], { spacing: { after: 70 } }));
  items.push(para([strong(nomeM2i(company)), ...(area ? [text(`   ${area}`, { color: BLUE, size: 18 })] : [])], { spacing: { after: 45 } }));
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

function appaltoSignature() {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
  }, rows: [new TableRow({ children: [
    new TableCell({ children: [para('APPALTATORE', { alignment: AlignmentType.CENTER }),
      para(' ', { spacing: { before: 900, after: 120 } }),
      para('____________________________', { alignment: AlignmentType.CENTER })] }),
    new TableCell({ children: [para('COMMITTENTE', { alignment: AlignmentType.CENTER }),
      para(' ', { spacing: { before: 900, after: 120 } }),
      para('____________________________', { alignment: AlignmentType.CENTER })] })
  ] })] });
}

async function assunzioneFirme(company) {
  const stamp = await image(company?.timbro_path, 208, 94);
  const borders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } };
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders,
    rows: [new TableRow({ children: [
      new TableCell({ children: [para('(Lavoratore)', { alignment: AlignmentType.CENTER }),
        para(' ', { spacing: { before: 1000, after: 50 } }),
        para('____________________________', { alignment: AlignmentType.CENTER })] }),
    new TableCell({ children: [para(`${nomeM2i(company)} (Datore di lavoro)`, { alignment: AlignmentType.CENTER }),
        ...(stamp ? [para([stamp], { alignment: AlignmentType.CENTER, spacing: { before: 70, after: 0 } })]
          : [para(' ', { spacing: { before: 1000, after: 50 } })])] })
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
  return [small(`Datore di lavoro: ${nomeM2i(company)} · ${sedeM2i(company)}`),
    ...recipient(d).map(line => small(line))];
}

function letterAddressBlock(d, company) {
  const borders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } };
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders,
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [
        small('Datore di lavoro'),
        para([strong(nomeM2i(company))], { spacing: { after: 30 } }),
        para([strong(sedeM2i(company))], { spacing: { after: 30 } })
      ] }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [
        small('Destinatario'),
        ...recipient(d).map(line => para([strong(line)], { alignment: AlignmentType.LEFT, spacing: { after: 30 } }))
      ] })
    ] })] });
}

function regulation(company, formData) {
  const html = renderToStaticMarkup(createElement(RegolamentoInterno, { formData, azienda: company }));
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const pages = Array.from(dom.querySelectorAll('.regolamento-pagina'));
  return pages.flatMap((page, pageIndex) => {
    const paragraphs = Array.from(page.querySelectorAll('h2, h3, p'))
      .map((el, index) => {
        const value = el.textContent.trim();
        const options = { spacing: { after: 70 }, ...(index === 0 ? { pageBreakBefore: true } : {}) };
        if (el.tagName === 'H2') return para([strong(value)], { ...options, alignment: AlignmentType.CENTER });
        if (el.tagName === 'H3') return para([strong(value)], { ...options, keepWithNext: true });
        return para([text(value, { size: 18 })], options);
      });
    if (pageIndex === pages.length - 1) paragraphs.push(para('Firma del lavoratore: ______________________________', { spacing: { before: 350 } }));
    return paragraphs;
  });
}

async function assunzione(d, a) {
  const body = [...await brand(a, ''), para([text(`${luogoM2i(a)}, `), strong(date(d.dataFirma))], { alignment: AlignmentType.RIGHT, spacing: { before: 180, after: 180 } }),
    para([strong(d.sesso === 'F' ? 'Gent.ma Sig.ra' : 'Gent.mo Sig.')], { alignment: AlignmentType.RIGHT, spacing: { after: 30 } }),
    ...recipient(d).map(line => para([strong(line)], { alignment: AlignmentType.RIGHT, spacing: { after: 30 } })),
    para([strong(titoloContrattoAssunzione(d))], { alignment: AlignmentType.CENTER, spacing: { before: 300, after: 260 } })];
  for (const paragraph of segmentiContrattoAssunzione(d, a)) {
    body.push(para(paragraph.map(part => text(part.text, { bold: part.bold })),
      { spacing: { after: 180 }, alignment: AlignmentType.JUSTIFIED }));
  }
  body.push(para(paragrafoOriginaleContrattoAssunzione(39)), para([text(`${luogoM2i(a)}, lì `), strong(date(d.dataFirma))]),
    await assunzioneFirme(a),
    ...segmentiRecapitiContrattoAssunzione(d).map(parts => para(parts.map(part => text(part.text, { bold: part.bold })))),
    para(paragrafoOriginaleContrattoAssunzione(56), { spacing: { before: 150, after: 30 } }),
    para(paragrafoOriginaleContrattoAssunzione(57), { spacing: { after: 230 } }),
    para(paragrafoOriginaleContrattoAssunzione(58), { spacing: { before: 190, after: 100 } }),
    para(paragrafoOriginaleContrattoAssunzione(59, a)),
    para(paragrafoOriginaleContrattoAssunzione(61), { spacing: { before: 150 } }),
    para(paragrafoOriginaleContrattoAssunzione(64), { spacing: { before: 150, after: 30 } }),
    para(paragrafoOriginaleContrattoAssunzione(65)));
  if (d.allegaRegolamento) body.push(...regulation(a, d));
  return body;
}

async function trasformazione(d, a) {
  return [...await brand(a, ''), title('Lettera di trasformazione'),
    para([text(`${luogoM2i(a)}, `), strong(date(d.dataFirma))], { alignment: AlignmentType.RIGHT }),
    letterAddressBlock(d, a),
    ...segmentiLetteraTrasformazione(d).map(parti => para(parti.map(parte => text(parte.text, { bold: parte.bold })),
      { spacing: { before: 180, after: 180 }, alignment: AlignmentType.JUSTIFIED })),
    para([text(`${luogoM2i(a)}, `), strong(date(d.dataFirma))], { spacing: { before: 450, after: 100 } }),
    await assunzioneFirme(a)];
}

async function proroga(d, a) {
  return [...await brand(a, ''), title('Lettera di proroga'),
    letterAddressBlock(d, a),
    heading(oggettoLetteraProroga),
    ...segmentiLetteraProroga(d).map(parti => para(parti.map(parte => text(parte.text, { bold: parte.bold })),
      { spacing: { before: 180, after: 180 }, alignment: AlignmentType.JUSTIFIED })),
    para([text(`${luogoM2i(a)}, `), strong(dataProrogaIt(d.dataFirma))], { spacing: { before: 300, after: 160 } }),
    para(presaVisioneProroga), await assunzioneFirme(a)];
}

async function appalto(d, a) {
  const { paragrafi: paragraphs, headings, firme } = modelloContrattoAppalto(d, a);
  const body = [...await brand(a, '')];
  for (const [index, value] of paragraphs.entries()) {
    if (!value.trim()) continue;
    if (index === 0) body.push(title(value));
    else if (headings.has(index)) body.push(para(value, { style: 'Heading2', spacing: { before: 160, after: 90 }, keepWithNext: true }));
    else if (firme.has(index)) body.push(appaltoSignature());
    else body.push(para(value, { spacing: { after: index === 8 ? 150 : 65 } }));
  }
  return body;
}

function footer(company, isAppalto) {
  const children = isAppalto ? righeIntestazioneM2i(company).map(line => small(line)) : [];
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
