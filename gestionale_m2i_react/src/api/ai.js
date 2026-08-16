const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:3000') ;
const API_URL = `${BASE_URL}/api/ai`;

export const getAiSettings = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(API_URL + '/settings', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error("Timeout connessione AI.");
    throw err;
  }
};

export const saveAiSettings = async (apiKey) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(API_URL + '/settings', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ apiKey }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error("Timeout connessione AI.");
    throw err;
  }
};

export const askAi = async (prompt, history = []) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 sec for AI processing
  try {
    const res = await fetch(API_URL + '/ask', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ prompt, history }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error("Timeout: l'Intelligenza Artificiale sta impiegando troppo tempo a rispondere o la rete è assente.");
    throw err;
  }
};
