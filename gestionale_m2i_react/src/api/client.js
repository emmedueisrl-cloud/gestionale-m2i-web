export async function apiCall(functionName, args = []) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ functionName, args }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      let errorMsg = `HTTP error! status: ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.error) errorMsg = errJson.error;
      } catch (e) {
        // Ignora se non è JSON
      }
      throw new Error(errorMsg);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Errore sconosciuto dal server');
    }
    
    return json.data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      const timeoutError = new Error("Timeout di connessione: il server non risponde o la rete è assente.");
      console.error(`Errore API Timeout (${functionName})`);
      throw timeoutError;
    }
    
    console.error(`Errore API (${functionName}):`, error);
    throw error;
  }
}
