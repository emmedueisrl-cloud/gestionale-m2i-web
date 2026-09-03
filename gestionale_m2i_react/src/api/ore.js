import { apiCall } from './client';

// === REGISTRO ORE MENSILI ===

/**
 * Recupera le ore mensili di un dipendente.
 * @param {String} idDipendente 
 * @param {Number} mese 
 * @param {Number} anno 
 * @returns {Array} Array di righe (causali/clienti con i 31 giorni)
 */
export async function recuperaOreMensili(idDipendente, mese, anno) {
  return await apiCall('recuperaOreMensili', [idDipendente, mese, anno]);
}

export async function svuotaRegistroOreMensili(idDipendente, mese, anno) {
  return await apiCall('svuotaRegistroOreMensili', [idDipendente, mese, anno]);
}

/**
 * Salva l'intera griglia ore mensile del dipendente.
 * @param {Object} dati - { idDipendente, mese, anno, righe: [{ idCliente, causale, note, giorni: [0, 8, ...] }] }
 */
export async function salvaRegistroOreMensili(dati) {
  return await apiCall('salvaRegistroOreMensili', [dati]);
}

/**
 * Precompila le presenze a partire dal programma fisso del dipendente.
 * @param {String} idDipendente 
 * @param {Number} mese 
 * @param {Number} anno 
 * @returns {Array} Array di righe compatibili con la griglia
 */
export async function precompilaDaProgrammaFisso(idDipendente, mese, anno) {
  return await apiCall('precompilaDaProgrammaFisso', [idDipendente, mese, anno]);
}

// === PROGRAMMA FISSO ===

/**
 * Recupera il programma fisso settimanale di un dipendente.
 * @param {String} idDipendente 
 * @returns {Array} Array di impegni
 */
export async function recuperaDatiProgramma(idDipendente) {
  return await apiCall('recuperaDatiProgramma', [idDipendente]);
}

/**
 * Sovrascrive il programma fisso di un dipendente.
 * @param {Object} dati - { idDipendente, impegni: [{ giornoSettimana, oraInizio, oraFine, idCliente, note }] }
 */
export async function salvaProgrammaFisso(dati) {
  return await apiCall('salvaProgrammaFisso', [dati]);
}

// === AGENDA CAPOSQUADRA ===

/**
 * Recupera gli impegni in agenda per la settimana selezionata.
 * @param {String} idDipendente 
 * @param {String} dataLunedi - "YYYY-MM-DD"
 * @returns {Array}
 */
export async function recuperaDatiAgenda(idDipendente, dataLunedi) {
  return await apiCall('recuperaDatiAgenda', [idDipendente, dataLunedi]);
}

/**
 * Salva un singolo impegno in agenda.
 * @param {Object} imp 
 */
export async function salvaImpegnoAgenda(imp) {
  return await apiCall('salvaImpegnoAgenda', [imp]);
}

/**
 * Elimina un impegno in agenda.
 * @param {Number|String} idImpegno 
 */
export async function eliminaImpegnoAgenda(idImpegno) {
  return await apiCall('eliminaImpegnoAgenda', [idImpegno]);
}

export async function recuperaRegolazioniStipendi(idDipendente, mese, anno) {
  return await apiCall('ottieniRegolazioni', [idDipendente, mese, anno]);
}

export async function salvaRegolazioneStipendio(dati) {
  // mapping to expected: aggiungiRegolazione(mese, anno, idDipendente, dipendente, tipo, importo, motivazione)
  return await apiCall('aggiungiRegolazione', [
    dati.mese, dati.anno, dati.idDipendente, dati.dipendente, dati.tipo, dati.importo, dati.motivazione
  ]);
}

export async function eliminaRegolazioneStipendio(idRegolazione) {
  return await apiCall('eliminaRegolazione', [idRegolazione]);
}

export async function importaProgrammaFissoAgenda(idDipendente, dataInizioSettimana) { return await apiCall('importaProgrammaFissoAgenda', [idDipendente, dataInizioSettimana]); }
export async function svuotaSettimanaAgenda(idDipendente, dataInizioSettimana) { return await apiCall('svuotaSettimanaAgenda', [idDipendente, dataInizioSettimana]); }


export async function recuperaProspettoGlobale() { return await apiCall('recuperaProspettoGlobale', []); }
