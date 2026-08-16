// --- BACKEND API - HUB CENTRALE ---
// Questo file raccoglie tutte le funzioni dai vari controller modulari
// per mantenere la retrocompatibilità con server.js e il frontend.

const dashboard  = require('./controllers/dashboard');
const dipendenti = require('./controllers/dipendenti');
const contratti  = require('./controllers/contratti');
const clienti    = require('./controllers/clienti');
const fatture    = require('./controllers/fatture');
const ore        = require('./controllers/ore');
const bustePaga  = require('./controllers/buste_paga');
const elaborati  = require('./controllers/elaborati');
const utils      = require('./controllers/utils');
const azienda    = require('./controllers/azienda');

const api = {
  ...dashboard,
  ...dipendenti,
  ...contratti,
  ...clienti,
  ...fatture,
  ...ore,
  ...bustePaga,
  ...elaborati,
  ...utils,
  ...azienda
};

// Mappa alias dinamici delle funzioni estratti dal client HTML (mantenuti per compatibilità)
api["registraIncassoServer"] = api.registraIncassoServer;
api["segnalaInsolutoServer"] = api.segnalaInsolutoServer;
api["salvaRegistroOreMensili"] = api.salvaPresenzeMensili;

module.exports = api;

const aiController = require('./controllers/ai');
module.exports.aiController = aiController;

