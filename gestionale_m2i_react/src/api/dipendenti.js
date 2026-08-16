/**
 * API Wrapper per le operazioni sui Dipendenti
 * Comunica con il backend Express (porta 3000)
 */

import { apiCall } from './client';

const UPLOAD_URL = (import.meta.env.VITE_API_URL || '') + '/api/upload';

// -----------------------------------------------------------------------------
// ENDPOINT ANAGRAFICA DIPENDENTI
// -----------------------------------------------------------------------------

/**
 * Salva un nuovo dipendente nel database
 * @param {Object} dati - Oggetto con i dati del form (Anagrafica + Contratto)
 * @returns {String} ID assegnato al nuovo dipendente
 */
export async function recuperaDocumentiDipendente(id) {
  return await apiCall('recuperaDocumentiDipendente', [id]);
}

export async function eliminaDocumentoDipendente(id, nomeFile) {
  return await apiCall('eliminaDocumentoDipendente', [id, nomeFile]);
}

export async function recuperaDipendentiCestinati() {
  return await apiCall('recuperaDipendentiCestinati');
}

export async function eliminaDipendente(id) {
  return await apiCall('eliminaDipendente', [id]);
}

export async function ripristinaDipendente(id) {
  return await apiCall('ripristinaDipendente', [id]);
}

export async function salvaDipendente(dati) {
  // Il controller backend si aspetta i campi mappati (Cognome, Nome, CodiceFiscale, ecc.)
  return await apiCall('salvaDipendente', [dati]);
}

/**
 * Recupera l'elenco dei dipendenti (es. per popolare dropdown)
 * @returns {Array} Array di oggetti { id, nomeCompleto, codiceFiscale, ... }
 */
export async function recuperaElencoDipendenti() {
  return await apiCall('recuperaDipendentiAttivi'); 
}

/**
 * Recupera TUTTI i dipendenti (attivi e cessati) per la lista generale
 * @returns {Array} Array di oggetti
 */
export async function recuperaTuttiIDipendenti() {
  return await apiCall('elencoTuttiIDipendenti');
}

/**
 * Recupera i dati completi di un dipendente per la precompilazione del form di modifica
 * @param {String} idDipendente - ID del dipendente
 * @returns {Object} Oggetto con tutti i campi anagrafici e contrattuali
 */
export async function recuperaDatiCompletiDipendente(idDipendente) {
  return await apiCall('recuperaDatiCompletiDipendente', [idDipendente]);
}

/**
 * Salva le modifiche anagrafiche/contrattuali di un dipendente esistente
 * @param {Object} dati - Oggetto con i dati modificati (deve includere l'ID)
 * @returns {Boolean} true se successo
 */
export async function salvaModificheDipendente(dati) {
  return await apiCall('salvaModificheDipendente', [dati]);
}

// -----------------------------------------------------------------------------
// ENDPOINT OPERAZIONI CONTRATTUALI (PROROGHE, TRASFORMAZIONI, CESSAZIONI)
// -----------------------------------------------------------------------------

/**
 * Aggiorna la data di scadenza del contratto
 * @param {Object} dati - { IdDipendente, NuovaScadenza }
 * @returns {Boolean} true se successo
 */
export async function salvaProroga(dati) {
  return await apiCall('salvaProroga', [dati]);
}

/**
 * Trasforma un contratto Determinato/Prova a Indeterminato
 * @param {Object} dati - { IdDipendente, DataTrasformazione }
 * @returns {Boolean} true se successo
 */
export async function trasformaIndeterminato(dati) {
  return await apiCall('trasformaIndeterminato', [dati]);
}

/**
 * Chiude il rapporto lavorativo
 * @param {Object} dati - { IdDipendente, DataCessazione, Note }
 * @returns {Boolean} true se successo
 */
export async function registraCessazione(dati) {
  return await apiCall('registraCessazione', [dati]);
}

// -----------------------------------------------------------------------------
// ENDPOINT UPLOAD FILE (MULTIPART)
// -----------------------------------------------------------------------------

/**
 * Carica un file sul server associandolo a un dipendente
 * @param {String} idDipendente - L'ID del dipendente (es. 'D0001')
 * @param {File} file - Il file Javascript catturato dall'input type="file"
 * @returns {String} Il path in cui è stato salvato il file
 */
export async function uploadFile(idDipendente, file, tipoDocumento = '', nome = '', cognome = '') {
  const formData = new FormData();
  formData.append('idDipendente', idDipendente);
  formData.append('tipoDocumento', tipoDocumento);
  formData.append('nome', nome);
  formData.append('cognome', cognome);
  formData.append('file', file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 secondi di timeout

  try {
    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData, // Non impostare Content-Type, fetch fa da solo per FormData (boundary inclusa)
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

    return data.path; // Ritorna "uploads/D0001/123456789_file.pdf"
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`Timeout connessione per uploadFile (Dipendente ${idDipendente})`);
      throw new Error("Timeout di connessione: il server non risponde o la rete è assente.");
    }
    console.error(`Errore uploadFileDipendente per dipendente ${idDipendente}:`, error);
    throw error;
  }
}

export async function recuperaChiaviDipendente(idDipendente) {
  return await apiCall('recuperaChiaviDipendente', [idDipendente]);
}

export async function recuperaStoricoChiaviDipendente(idDipendente) {
  return await apiCall('recuperaStoricoChiaviDipendente', [idDipendente]);
}
export async function impostaCaposquadra(idDipendente, isCaposquadra) { return await apiCall('impostaCaposquadra', [idDipendente, isCaposquadra]); }

