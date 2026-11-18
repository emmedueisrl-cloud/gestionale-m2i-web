const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const stopWords = new Set(['sr', 'srl', 'srls', 'spa', 'sas', 'snc', 'societa', 'di', 'del', 'della', 'dei', 'e', 'the']);

export const normalizza = value => String(value || '').toLocaleLowerCase('it-IT').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = value => normalizza(value).split(' ').filter(token => token && !stopWords.has(token));
const centesimi = value => Math.round(Number(value || 0) * 100);
const dataValida = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const isoDate = (day, month, year) => {
  const fullYear = Number(year) < 100 ? 2000 + Number(year) : Number(year);
  const value = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return dataValida(value) ? value : null;
};
const parseDate = value => {
  const iso = String(value || '').match(/\b(20\d{2}-\d{1,2}-\d{1,2})\b/);
  if (iso) {
    const [year, month, day] = iso[1].split('-');
    return isoDate(day, month, year);
  }
  const local = String(value || '').match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2}|\d{2})\b/);
  return local ? isoDate(local[1], local[2], local[3]) : null;
};
const parseAmount = value => {
  const raw = String(value || '').replace(/\s/g, '');
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  return /^\d+(?:\.\d{1,2})?$/.test(normalized) ? Number(normalized) : null;
};
const invoiceRefs = value => {
  const source = String(value || '');
  const refs = [...source.matchAll(/\b(?:fattura|fatt\.?|ft\.?)\s*(?:n\.?\s*)?([a-z]{0,5}\s*\d+[a-z0-9/-]*)/gi)]
    .map(match => normalizza(match[1]).replace(/\s/g, ''));
  if (refs.length) {
    refs.push(...[...source.matchAll(/\b(?:e|,)\s*n\.?\s*(\d+[a-z0-9/-]*)/gi)]
      .map(match => normalizza(match[1]).replace(/\s/g, '')));
  }
  return [...new Set(refs)];
};
const periodo = value => {
  const text = normalizza(value);
  for (let index = 0; index < mesi.length; index++) {
    const match = text.match(new RegExp(`\\b${mesi[index]}\\s+(20\\d{2})\\b`));
    if (match) return `${match[1]}-${String(index + 1).padStart(2, '0')}`;
  }
  return null;
};
const italyToday = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

export function leggiBonifici(text, today = italyToday()) {
  const source = String(text || '').trim();
  if (!source) return [];
  const starts = [...source.matchAll(/(?:^|\n)\s*Importo\s*:/gi)].map(match => match.index + (match[0].startsWith('\n') ? 1 : 0));
  const blocks = starts.length ? starts.map((start, index) => source.slice(start, starts[index + 1] ?? source.length).trim()) : [source];
  return blocks.map((block, index) => {
    const amountMatch = block.match(/\bImporto\s*:\s*([\d.]+(?:,\d{1,2})?)\s*€?/i);
    const amount = amountMatch ? parseAmount(amountMatch[1]) : null;
    const payerMatch = block.match(/\bMITT\.?\s*:\s*(.+?)(?=\s+BENEF\.?\s*:|\n|$)/i)
      || block.match(/\bdisposto\s+da\s*:?[ \t]*(.+?)(?=\s+in\s+data\s+20\d{2}|\s+BENEF\.?\s*:|\n|$)/i);
    const payer = payerMatch?.[1]?.replace(/\s+$/, '') || '';
    const description = block.match(/\bDescrizione\s*:\s*([\s\S]*?)(?=\n\s*(?:Bonifico|BENEF\.?|Importo\s*:|Conto di|Data (?:valuta|di contabilizzazione))|$)/i)?.[1]?.trim() || '';
    const valuta = block.match(/\bData valuta\s*:\s*([^\n]+)/i)?.[1] || '';
    const contabilizzazione = block.match(/\bData di contabilizzazione\s*:\s*([^\n]+)/i)?.[1] || '';
    const transferDate = block.match(/\bin\s+data\s+(20\d{2}-\d{1,2}-\d{1,2})\s+alle\b/i)?.[1];
    const explicitDate = parseDate(valuta) || parseDate(contabilizzazione) || parseDate(transferDate);
    const saysToday = /\bOGGI\b/i.test(`${valuta} ${contabilizzazione}`);
    const disposition = block.match(/\bCOD\.\s*DISP\.?\s*:\s*(\d{10,30})\b/i)?.[1] || '';
    const numeri = invoiceRefs(description);
    return { id: index, raw: block, amount, payer, description, disposition, numeri, numero: numeri[0] || '',
      periodo: periodo(description), date: explicitDate || (saysToday ? today : ''),
      dateInferred: !explicitDate && saysToday,
      error: !amount || amount <= 0 ? 'Importo non riconosciuto: verifica il testo del messaggio.' : '' };
  });
}

function similarity(a, b) {
  const first = tokens(a), second = tokens(b);
  if (!first.length || !second.length) return 0;
  const overlap = first.filter(token => second.includes(token)).length;
  const exact = normalizza(a) === normalizza(b);
  if (exact) return 1;
  if (overlap) return (2 * overlap) / (first.length + second.length);
  const left = first.join(''), right = second.join('');
  const distance = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let previous = distance[0]; distance[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const current = distance[j];
      distance[j] = Math.min(distance[j] + 1, distance[j - 1] + 1, previous + Number(left[i - 1] !== right[j - 1]));
      previous = current;
    }
  }
  return Math.max(0, 1 - distance[right.length] / Math.max(left.length, right.length));
}

export function suggerisciFatture(bonifico, fatture) {
  const open = fatture.filter(invoice => centesimi(invoice.residuo) > 0 && invoice.gestibile &&
    !invoice.incongruenza && !invoice.daCollegare && !['Nota di credito', 'Stornata'].includes(invoice.stato));
  const ranked = open.map(invoice => {
    const clientScore = similarity(bonifico.payer, invoice.cliente);
    const number = normalizza(invoice.numero).replace(/\s/g, '');
    const numberMatch = Boolean(number && (bonifico.numeri || [bonifico.numero]).some(ref => ref && (number === ref ||
      (number.length >= 5 && ref.endsWith(number)) ||
      (ref.length >= 5 && number.endsWith(ref)))));
    const periodMatch = Boolean(bonifico.periodo && invoice.periodo === bonifico.periodo);
    const amountMatch = centesimi(invoice.residuo) === centesimi(bonifico.amount);
    const score = clientScore * 70 + Number(numberMatch) * 100 + Number(periodMatch) * 20 + Number(amountMatch) * 35;
    return { ...invoice, match: { clientScore, numberMatch, periodMatch, amountMatch, score } };
  }).sort((a, b) => b.match.score - a.match.score || String(a.cliente).localeCompare(String(b.cliente), 'it'));
  const best = ranked[0];
  const sameClient = best && best.match.clientScore >= 0.65 ? ranked.filter(invoice => String(invoice.clienteId) === String(best.clienteId)) : [];
  const matched = ranked.filter(invoice => invoice.match.score > 0);
  const suggestions = (matched.length ? matched : ranked).slice(0, 10);
  const combined = [...new Map([...sameClient, ...suggestions].map(invoice => [String(invoice.id), invoice])).values()];
  const automatic = ranked.filter(invoice => (bonifico.numeri?.length || 0) <= 1 && invoice.match.clientScore >= 0.95 && invoice.match.amountMatch &&
    (invoice.match.numberMatch || invoice.match.periodMatch));
  const proposed = automatic.length === 1 ? automatic[0] : null;
  const referenced = (bonifico.numeri || []).map(ref => ranked.filter(invoice => {
    const number = normalizza(invoice.numero).replace(/\s/g, '');
    return invoice.match.clientScore >= 0.65 && number && (number === ref ||
      (number.length >= 5 && ref.endsWith(number)) || (ref.length >= 5 && number.endsWith(ref)));
  }));
  const proposedGroup = referenced.length > 1 && referenced.every(matches => matches.length === 1) &&
    new Set(referenced.map(matches => String(matches[0].id))).size === referenced.length &&
    referenced.reduce((sum, matches) => sum + centesimi(matches[0].residuo), 0) === centesimi(bonifico.amount)
    ? referenced.map(matches => matches[0]) : [];
  return { open, suggestions: combined, proposed, proposedGroup };
}
