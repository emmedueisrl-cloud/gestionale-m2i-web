import { apiCall } from './client';

export const elencaOperatori = (includiCessati = true) => apiCall('elencaOperatori', [includiCessati]);
export const creaOperatore = nome => apiCall('creaOperatore', [nome]);
export const cessaOperatore = (id, data) => apiCall('cessaOperatore', [id, data]);
export const riattivaOperatore = (id, data) => apiCall('riattivaOperatore', [id, data]);
