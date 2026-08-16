import { apiCall } from './client';

export async function recuperaDatiAzienda() {
  return await apiCall('recuperaDatiAzienda');
}

export async function salvaDatiAzienda(dati) {
  return await apiCall('salvaDatiAzienda', [dati]);
}

export async function recuperaDocumentiAzienda() {
  return await apiCall('recuperaDocumentiAzienda');
}

export async function eliminaDocumentoAzienda(idDoc) {
  return await apiCall('eliminaDocumentoAzienda', [idDoc]);
}

export async function uploadDocumentoAzienda(file, nomeDocumento) {
  const formData = new FormData();
  formData.append('idAzienda', 'azienda_m2i');
  formData.append('file', file);
  formData.append('nome', nomeDocumento);

  const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:3000') ;
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const data = await res.json();
  if (data.success) {
    // Salviamo il riferimento nel DB
    await apiCall('salvaDocumentoAzienda', [nomeDocumento, data.path, new Date().toISOString().split('T')[0]]);
    return data;
  } else {
    throw new Error(data.error);
  }
}

export async function recuperaModuliStandard() {
  return await apiCall('recuperaModuliStandard');
}

export async function eliminaModuloStandard(id) {
  return await apiCall('eliminaModuloStandard', [id]);
}

export async function uploadModuloStandard(file, nomeDocumento) {
  const formData = new FormData();
  formData.append('idAzienda', 'moduli_standard');
  formData.append('file', file);
  formData.append('nome', nomeDocumento);

  const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:3000') ;
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const data = await res.json();
  if (data.success) {
    const estensione = file.name.split('.').pop().toUpperCase();
    let tipo = 'DOCX';
    if (estensione === 'PDF') tipo = 'PDF';
    else if (estensione === 'XLSX' || estensione === 'XLS') tipo = 'XLSX';

    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

    await apiCall('salvaModuloStandard', [nomeDocumento, data.path, tipo, sizeInMB, new Date().toISOString().split('T')[0]]);
    return data;
  } else {
    throw new Error(data.error);
  }
}
