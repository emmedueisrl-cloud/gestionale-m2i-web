const baseUrl = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}/api/autodiagnosi${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Errore durante la richiesta di autodiagnosi.');
  return data;
}

export const autodiagnosiApi = {
  elenco: filters => {
    const params = new URLSearchParams(Object.entries(filters || {}).filter(([, value]) => value));
    return request(`?${params}`);
  },
  aggiornaStato: (id, stato) => request(`/${id}/stato`, {
    method: 'PATCH',
    body: JSON.stringify({ stato })
  })
};
