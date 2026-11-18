export function nomeContrattoAssunzione(formData) {
  const nome = [formData?.nome, formData?.cognome].filter(Boolean).join(' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|.]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(formData?.dataFirma || '')
    ? `${formData.dataFirma.slice(8, 10)}-${formData.dataFirma.slice(5, 7)}-${formData.dataFirma.slice(0, 4)}`
    : '';
  return ['CONTRATTO ASSUNZIONE', nome, data].filter(Boolean).join(' ');
}

export function stampaContrattoAssunzione(formData) {
  const titoloPrecedente = document.title;
  document.title = nomeContrattoAssunzione(formData);
  window.addEventListener('afterprint', () => { document.title = titoloPrecedente; }, { once: true });
  window.print();
}
