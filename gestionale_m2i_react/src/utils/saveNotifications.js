export const SAVE_NOTIFICATION_EVENT = 'm2i:save-confirmed';

const runWrites = /^(salva|aggiorna|aggiungi|registra|trasforma|imposta|assegna|riconsegna|riattiva|ripristina|cessa|chiudi|sblocca|segnala|importaProgrammaFisso)/;

export function saveMessageForRequest(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const pathname = new URL(url, 'http://localhost').pathname;

  if (pathname === '/api/run' && method === 'POST') {
    try {
      const name = JSON.parse(options.body).functionName;
      return typeof name === 'string' && runWrites.test(name) ? 'Dati salvati correttamente.' : null;
    } catch { return null; }
  }
  if (method === 'GET' || method === 'DELETE') return null;
  if (/^\/api\/(?:elaborati-workflow\/[^/]+\/\d+\/\d+\/(?:elenco|righe\/[^/]+\/(?:blinda|sblocca))|contabilita\/(?:fatture|pagamenti))$/.test(pathname)) {
    return 'Operazione registrata correttamente.';
  }
  if (/^\/api\/(anteprima-|auth\/login|auth\/logout|emails\/sync|ai\/ask|buste-paga\/upload)/.test(pathname)) return null;
  if (/^\/api\/(upload(?:-multiple|-fattura-xml)?|dipendenti\/[^/]+\/collega-allegato)$/.test(pathname)) return 'Allegato caricato correttamente.';
  if (/^\/api\/(conferma-fatture-(?:csv|xml)|excel\/carica-presenze|buste-paga\/conferma|preventivi\/generate|magazzino(?:\/[^/]+)?|ai\/settings|configurazione-email|auth\/(?:users(?:\/[^/]+)?(?:\/(?:password|active))?|me\/password)|emails\/[^/]+\/(?:cartella|preferito|letto))$/.test(pathname)) {
    return 'Dati salvati correttamente.';
  }
  return null;
}

export function installSaveNotifications() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = input instanceof Request ? input.url : String(input);
    const requestOptions = input instanceof Request
      ? { method: options.method || input.method, body: options.body }
      : options;
    const message = saveMessageForRequest(url, requestOptions);
    const response = await originalFetch(input, options);
    if (message && response.ok) {
      void response.clone().text().then(body => {
        if (body) {
          try {
            const data = JSON.parse(body);
            if (data.success === false || data.error) return;
          } catch { /* Le risposte non JSON con stato 2xx sono comunque confermate. */ }
        }
        window.dispatchEvent(new CustomEvent(SAVE_NOTIFICATION_EVENT, { detail: message }));
      }).catch(() => {});
    }
    return response;
  };
}
