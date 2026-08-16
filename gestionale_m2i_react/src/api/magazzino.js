const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api';

export const getMagazzino = async () => {
  const response = await fetch(`${API_URL}/magazzino`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
};

export const getAttrezzatureCliente = async (idCliente) => {
  const response = await fetch(`${API_URL}/magazzino/cliente/${idCliente}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
};

export const creaAttrezzatura = async (formData) => {
  const response = await fetch(`${API_URL}/magazzino`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
};

export const assegnaAttrezzatura = async (id, clienteId) => {
  const response = await fetch(`${API_URL}/magazzino/${id}/assegna`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cliente_id: clienteId })
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
};

export const eliminaAttrezzatura = async (id) => {
  const response = await fetch(`${API_URL}/magazzino/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
};
