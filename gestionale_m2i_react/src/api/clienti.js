import { apiCall } from './client';

export async function recuperaListaOperatoriCommerciali() {
  return await apiCall('recuperaListaOperatoriCommerciali');
}

/**
 * Recupera l'elenco dei clienti attivi per le dropdown o liste.
 * @returns {Array}
 */
export async function recuperaElencoClienti() {
  return await apiCall('recuperaClientiAttivi');
}

/**
 * Recupera l'elenco di TUTTI i clienti (inclusi inattivi).
 * @returns {Array}
 */
export async function recuperaTuttiIClienti() {
  return await apiCall('recuperaElencoClientiModifica');
}

/**
 * Recupera i dati completi di un cliente (per modifica).
 * @param {String} idCliente 
 */
export async function recuperaDatiCompletiCliente(idCliente) {
  return await apiCall('recuperaDatiCompletiCliente', [idCliente]);
}

export async function recuperaDocumentiCliente(idCliente) {
  return await apiCall('recuperaDocumentiCliente', [idCliente]);
}

export async function eliminaDocumentoCliente(idCliente, nomeFile) {
  return await apiCall('eliminaDocumentoCliente', [idCliente, nomeFile]);
}

export async function recuperaClientiCestinati() {
  return await apiCall('recuperaClientiCestinati');
}

export async function eliminaCliente(idCliente) {
  return await apiCall('eliminaCliente', [idCliente]);
}

export async function ripristinaCliente(idCliente) {
  return await apiCall('ripristinaCliente', [idCliente]);
}

/**
 * Salva un nuovo cliente nel database
 * @param {Object} dati 
 * @returns {String} ID assegnato al nuovo cliente
 */
export async function salvaNuovoCliente(dati) {
  return await apiCall('salvaCliente', [dati]);
}

/**
 * Salva le modifiche anagrafiche/commerciali di un cliente esistente
 * @param {Object} dati 
 * @returns {Boolean} true se successo
 */
export async function salvaModificheCliente(dati) {
  return await apiCall('aggiornaDatiCliente', [dati]);
}

export async function aggiornaRagioneSocialeCliente(idCliente, nuovaRagioneSociale) {
  return await apiCall('aggiornaRagioneSocialeCliente', [idCliente, nuovaRagioneSociale]);
}

export async function salvaCambioChiavi(dati) {
  return await apiCall('salvaCambioChiavi', [dati]);
}

export async function uploadFileCliente(idCliente, file, tipoDocumento = '', nome = '', cognome = '') {
  const formData = new FormData();
  formData.append('idCliente', idCliente);
  formData.append('tipoDocumento', tipoDocumento);
  formData.append('nome', nome);
  formData.append('cognome', cognome);
  formData.append('file', file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 secondi di timeout

  try {
    // Il backend si aspetta /api/upload
    const response = await fetch((import.meta.env.VITE_API_URL || '') + '/api/upload', {
      method: 'POST',
      body: formData, 
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Errore durante l\'upload del file');
    }

    return data.path; 
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`Timeout connessione per uploadFileCliente (Cliente ${idCliente})`);
      throw new Error("Timeout di connessione: il server non risponde o la rete è assente.");
    }
    console.error(`Errore uploadFileCliente per cliente ${idCliente}:`, error);
    throw error;
  }
}

export async function salvaNuovaAssegnazioneChiavi(dati) {
  return await apiCall('salvaNuovaAssegnazioneChiavi', [dati]);
}

export async function assegnaAdAltroOperatore(dati) {
  return await apiCall('assegnaAdAltroOperatore', [dati]);
}

export async function riconsegnaChiaveAlCliente(dati) {
  return await apiCall('riconsegnaChiaveAlCliente', [dati]);
}

export async function recuperaStoricoChiaviCliente(idCliente) {
  return await apiCall('recuperaStoricoChiaviCliente', [idCliente]);
}

export async function recuperaTutteAssegnazioniChiavi() {
  return await apiCall('recuperaTutteAssegnazioniChiavi');
}

export async function recuperaRegolazioniClienti(idCliente, mese, anno) {
  return await apiCall('ottieniRegolazioniClienti', [idCliente, mese, anno]);
}

export async function salvaRegolazioneCliente(mese, anno, idCliente, cliente, tipo, importo, motivazione) {
  return await apiCall('aggiungiRegolazioneCliente', [mese, anno, idCliente, cliente, tipo, importo, motivazione]);
}

export async function eliminaRegolazioneCliente(idRegolazione) {
  return await apiCall('eliminaRegolazioneCliente', [idRegolazione]);
}

export async function cessaCliente(id) {
  return await apiCall('cessaCliente', [id]);
}

export async function riattivaCliente(id) {
  return await apiCall('riattivaCliente', [id]);
}

