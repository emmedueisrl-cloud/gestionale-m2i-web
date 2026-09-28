const base = import.meta.env.VITE_API_URL || '';

export async function workflowRequest(path, options = {}) {
  const multipart = options.body instanceof FormData;
  const response = await fetch(`${base}/api/${path}`, {
    credentials: 'same-origin', ...options,
    headers: multipart ? options.headers : { 'Content-Type': 'application/json', ...options.headers }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Richiesta non riuscita (${response.status}).`);
  }
  return response.json();
}

export const workflowPeriod = (tipo, mese, anno) => `elaborati-workflow/${tipo}/${anno}/${mese}`;
export const contabilitaPeriod = (tipo, mese, anno) => `contabilita/${tipo}/${anno}/${mese}`;
