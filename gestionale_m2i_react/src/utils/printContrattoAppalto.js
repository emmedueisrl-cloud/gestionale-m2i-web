export function nomeContrattoAppalto(data) {
  const nome = String(data?.ragioneSociale || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|.]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  const dataFirma = /^\d{4}-\d{2}-\d{2}$/.test(data?.dataFirma || '')
    ? `${data.dataFirma.slice(8, 10)}-${data.dataFirma.slice(5, 7)}-${data.dataFirma.slice(0, 4)}` : '';
  return ['CONTRATTO APPALTO', nome, dataFirma].filter(Boolean).join(' ');
}

export function stampaContrattoAppalto(data) {
  const titoloPrecedente = document.title;
  document.title = nomeContrattoAppalto(data);
  window.addEventListener('afterprint', () => { document.title = titoloPrecedente; }, { once: true });
  window.print();
}
