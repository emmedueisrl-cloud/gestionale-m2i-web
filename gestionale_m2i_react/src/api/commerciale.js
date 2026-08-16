import { apiCall } from './client';

// === FATTURE ===

export async function recuperaFatture(mese, anno) {
  return await apiCall('recuperaFatture', [mese, anno]);
}

export async function salvaNuovaFattura(datiFattura) {
  return await apiCall('salvaFattura', [datiFattura]);
}

export async function aggiornaStatoFattura(idFattura, stato) {
  return await apiCall('aggiornaStatoFattura', [idFattura, stato]);
}

export async function uploadFatturaXml(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch('/api/upload-fattura-xml', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Errore durante l\'importazione della fattura XML');
  }
  return data;
}

export async function anteprimaFattureCsv(file, mese, anno) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mese', mese);
  formData.append('anno', anno);
  
  const res = await fetch('/api/anteprima-fatture-csv', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Errore durante l\'anteprima del file CSV');
  }
  return data;
}

export async function confermaFattureCsv(fatture) {
  const res = await fetch('/api/conferma-fatture-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fatture })
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Errore durante la conferma del file CSV');
  }
  return data;
}

// === PAGAMENTI ===

export async function recuperaPagamenti() {
  return await apiCall('recuperaDatiPagamenti');
}

export async function registraPagamento(datiPagamento) {
  // Il backend accetta: idFattura, dataPagamento, importoIncassato
  return await apiCall('registraIncassoServer', [
    datiPagamento.idFattura, 
    datiPagamento.dataPagamento, 
    datiPagamento.importoIncassato || 0
  ]);
}

// === PROVVIGIONI ===

export async function calcolaProvvigioni(mese, anno) {
  return await apiCall('ottieniElaboratoProvvigioni', [mese, anno]);
}

export async function anteprimaFattureXml(files, mese, anno) {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }
  formData.append('mese', mese);
  formData.append('anno', anno);
  
  const res = await fetch('/api/anteprima-fatture-xml', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Errore durante l\'anteprima dei file XML');
  }
  return data;
}

export async function confermaFattureXml(righe, aggiornamenti_clienti) {
  const res = await fetch('/api/conferma-fatture-xml', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ righe, aggiornamenti_clienti })
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Errore durante il salvataggio dei file XML');
  }
  return data;
}

export async function eliminaFattureMulti(ids) {
  return await apiCall('eliminaFattureMulti', [ids]);
}

export async function ottieniElaboratoClienti(mese, anno) {
  return await apiCall('ottieniElaboratoClienti', [mese, anno]);
}
