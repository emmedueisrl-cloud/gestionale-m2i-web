const units = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'];
const teens = ['dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
const tens = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

function belowThousand(number) {
  if (number < 10) return units[number];
  if (number < 20) return teens[number - 10];
  if (number < 100) {
    const ten = Math.floor(number / 10);
    const unit = number % 10;
    return `${unit === 1 || unit === 8 ? tens[ten].slice(0, -1) : tens[ten]}${units[unit]}`;
  }
  const hundreds = Math.floor(number / 100);
  const rest = belowThousand(number % 100);
  const prefix = `${hundreds === 1 ? '' : units[hundreds]}cento`;
  return `${rest.startsWith('ott') ? prefix.slice(0, -1) : prefix}${rest}`;
}

function numberInWords(number) {
  if (number === 0) return 'zero';
  const billions = Math.floor(number / 1_000_000_000);
  const millions = Math.floor(number / 1_000_000) % 1000;
  const thousands = Math.floor(number / 1000) % 1000;
  const rest = number % 1000;
  const parts = [];
  if (billions) parts.push(billions === 1 ? 'un miliardo' : `${belowThousand(billions)} miliardi`);
  if (millions) parts.push(millions === 1 ? 'un milione' : `${belowThousand(millions)} milioni`);
  let remainder = '';
  if (thousands) remainder += thousands === 1 ? 'mille' : `${belowThousand(thousands)}mila`;
  if (rest) remainder += belowThousand(rest);
  if (remainder) parts.push(remainder);
  return parts.join(' ');
}

export function importoInLettere(value) {
  const source = String(value ?? '').trim().replace(/^€\s*|\s*€$/g, '').replace(/\s/g, '');
  if (!source) return '';
  let euroPart = source;
  let cents = '00';
  if (/^\d+[,.]\d{1,2}$/.test(source)) {
    const separator = Math.max(source.lastIndexOf(','), source.lastIndexOf('.'));
    euroPart = source.slice(0, separator);
    cents = source.slice(separator + 1).padEnd(2, '0');
  } else if (/^\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?$/.test(source)) {
    const decimal = source.match(/[.,](\d{1,2})$/);
    if (decimal) {
      euroPart = source.slice(0, -decimal[0].length);
      cents = decimal[1].padEnd(2, '0');
    }
    euroPart = euroPart.replace(/[.,]/g, '');
  } else if (!/^\d+$/.test(source)) return '';
  const euros = Number(euroPart);
  if (!Number.isSafeInteger(euros) || euros > 999_999_999_999 || (euros === 0 && cents === '00')) return '';
  return `${numberInWords(euros)}/${cents}`;
}
