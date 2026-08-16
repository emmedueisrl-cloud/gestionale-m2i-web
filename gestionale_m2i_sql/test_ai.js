const aiController = require('./controllers/ai');
async function test() {
  try {
    const result = await aiController.askChat({ prompt: 'quanti dipendenti ci sono nel sistema?' });
    console.log('Risposta:', result.message);
    console.log('Dati:', result.data ? JSON.stringify(result.data).substring(0, 200) : 'nessun dato');
  } catch(e) {
    console.error('Errore:', e.message);
  }
}
test();
