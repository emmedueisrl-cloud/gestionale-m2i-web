import { apiCall } from './client';

/**
 * Ottiene l'elaborato mensile per i dipendenti (ore lavorate * paga + maggiorazioni).
 * @param {Number} mese 
 * @param {Number} anno 
 * @returns {Array} Array con i dati di stipendio di tutti i dipendenti attivi
 */
export async function ottieniElaboratoMensile(mese, anno) {
  return await apiCall('ottieniElaboratoMensile', [mese, anno]);
}

/**
 * Ottiene l'elaborato mensile per i clienti (ore erogate * tariffa + maggiorazioni).
 * @param {Number} mese 
 * @param {Number} anno 
 * @returns {Array} Array con i dati di fatturazione
 */
export async function ottieniElaboratoClienti(mese, anno) {
  return await apiCall('ottieniElaboratoClienti', [mese, anno]);
}

/**
 * Ottiene il report provvigioni commerciali
 * @param {Number} mese 
 * @param {Number} anno 
 * @returns {Array} Array con i dati delle provvigioni
 */
export async function ottieniElaboratoProvvigioni(mese, anno) {
  return await apiCall('ottieniElaboratoProvvigioni', [mese, anno]);
}

export async function chiudiMeseDipendenti(mese, anno, datiElaborati) {
  return await apiCall('chiudiMeseDipendenti', [mese, anno, datiElaborati]);
}

export async function sbloccaMeseDipendenti(mese, anno) {
  return await apiCall('sbloccaMeseDipendenti', [mese, anno]);
}

export async function chiudiMeseClienti(mese, anno, datiElaborati) {
  return await apiCall('chiudiMeseClienti', [mese, anno, datiElaborati]);
}

export async function sbloccaMeseClienti(mese, anno) {
  return await apiCall('sbloccaMeseClienti', [mese, anno]);
}

export async function calendarioClienteOre(mese, anno, idCliente) {
  return await apiCall('calendarioClienteOre', [mese, anno, idCliente]);
}

export async function recuperaNoteElaborato(tipo, mese, anno) {
  return await apiCall('recuperaNoteElaborato', [tipo, mese, anno]);
}

export async function salvaNoteElaborato(tipo, soggettoId, mese, anno, testo) {
  return await apiCall('salvaNoteElaborato', [tipo, soggettoId, mese, anno, testo]);
}
