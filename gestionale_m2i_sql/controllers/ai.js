const OpenAI = require('openai');
const { knex } = require('../db');

async function getApiKey() {
  const row = await knex('configurazioni').where('chiave', 'gemini_api_key').first();
  return row ? row.valore : null;
}

const aiController = {
  async getSettings() {
    const key = await getApiKey();
    return { hasKey: !!key, apiKey: key || '' };
  },

  async saveSettings(dati) {
    const { apiKey } = dati;
    const existing = await knex('configurazioni').where('chiave', 'gemini_api_key').first();
    if (existing) {
      await knex('configurazioni').where('chiave', 'gemini_api_key').update({ valore: apiKey });
    } else {
      await knex('configurazioni').insert({ chiave: 'gemini_api_key', valore: apiKey });
    }
    return { success: true };
  },

  async getDatabaseSchema() {
    const tables = ['dipendenti', 'clienti', 'registro_ore', 'fatture', 'agenda_caposquadra', 'programma_fisso'];
    let schemaStr = '';
    for (const table of tables) {
      try {
        const info = await knex.raw('PRAGMA table_info(' + table + ')');
        const cols = info.map(c => c.name + ' (' + c.type + ')').join(', ');
        schemaStr += 'Table: ' + table + '\nColumns: ' + cols + '\n\n';
      } catch(e) { /* skip */ }
    }
    return schemaStr;
  },

  async askChat(dati) {
    const { prompt, history = [] } = dati;
    const apiKey = await getApiKey();
    if (!apiKey) throw new Error('API_KEY_MISSING');

    const openai = new OpenAI({ apiKey });
    const schema = await aiController.getDatabaseSchema();

    const systemMessage = 'Sei un esperto di SQL (SQLite) e assistente integrato nel Gestionale M2I. ' +
      'Il tuo compito e aiutare lutente traducendo le sue richieste in lingua naturale in query SQL valide. ' +
      'Ecco lo schema del database (SQLite):\n' + schema + '\n' +
      'Regole per la query:\n' +
      '- Usa query di sola lettura (SELECT).\n' +
      '- Quando cerchi dipendenti o clienti, sii ESTREMAMENTE ELASTICO. L\'utente fornirà solo pezzi di nome o cognome. Usa SEMPRE `(dipendenti.nome LIKE "%pezzo%" OR dipendenti.cognome LIKE "%pezzo%")`. \n' +
      '- SE LA RICHIESTA E\' VAGA o indica solo il nome di battesimo (es. "Marisa" o "Antonio"), la tua priorità è ESPLORATIVA. Genera una query che restituisca semplicemente l\'elenco delle persone corrispondenti (es. `SELECT nome, cognome, ruolo FROM dipendenti WHERE nome LIKE "%Marisa%"`), e nel "message" chiedi all\'utente di chiarire quale intende (es. "Ho trovato queste persone, a quale ti riferisci?").\n' +
      '- SE LA RICHIESTA E\' PRECISA (es. nome e cognome, o chiarita dalla cronologia chat), procedi con la query matematica finale.\n' +
      '- Se c\'è un apostrofo (es. D\'Antonio), cerca solo la parte successiva (es. `LIKE "%Antonio%"`). Non richiedere mai nomi completi o esatti.\n' +
      '- Per i clienti, usa sempre `clienti.ragione_sociale LIKE "%pezzo%"`. \n' +
      '- Unisci (JOIN) le tabelle usando i campi _id (es. dipendente_id = dipendenti.id, cliente_id = clienti.id).\n' +
      '- Quando usi SUM() per contare ore o importi, DEVI SEMPRE includere il nome del dipendente (es. `d.nome || " " || d.cognome`) e/o del cliente (`c.ragione_sociale`) nella SELECT e fare il GROUP BY su di essi. Questo è OBBLIGATORIO per non sommare insieme i dati di eventuali omonimi.\n' +
      '- Usa AS per rinominare TUTTE le colonne estratte in modo chiaro (es. d.nome || " " || d.cognome AS "Dipendente", SUM(ore) AS "Totale_Ore").\n\n' +
      'Rispondi SEMPRE E SOLO con un oggetto JSON con questi due campi:\n' +
      '1. "message": Una cordiale risposta testuale in italiano. Non dire mai che ti mancano informazioni per la ricerca.\n' +
      '2. "query": La query SQLite per i dati.\n' +
      'IMPORTANTE: rispondi solo con JSON valido, senza markdown.';

    const mappedHistory = history.map(h => ({
      role: h.role === 'ai' ? 'assistant' : 'user',
      content: h.content || ''
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        ...mappedHistory,
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });

    let responseData;
    try {
      responseData = JSON.parse(completion.choices[0].message.content);
    } catch(e) {
      throw new Error('Invalid AI response format');
    }

    let data = null;
    let isQueryError = false;

    if (responseData.query) {
      console.log('AI Query:', responseData.query);
      if (!responseData.query.trim().toUpperCase().startsWith('SELECT')) {
        responseData.message = 'Per ragioni di sicurezza, posso eseguire solo query di ricerca (SELECT).';
        responseData.query = null;
      } else {
        try {
          data = await knex.raw(responseData.query);
          
          // Verifica se il risultato è vuoto o contiene solo somme nulle
          let isEmpty = false;
          if (!data || data.length === 0) {
            isEmpty = true;
          } else if (data.length === 1) {
            const allNull = Object.values(data[0]).every(v => v === null);
            if (allNull) isEmpty = true;
          }

          if (isEmpty) {
            responseData.message = "Non ho trovato nessun dato corrispondente a questo nome (o nessuna registrazione per questo periodo). Puoi specificare meglio di chi si tratta o controllare il nome?";
          }
        } catch (dbError) {
          console.error('AI SQL Error:', dbError);
          isQueryError = true;
          responseData.message = 'Ho provato a estrarre i dati ma ce stato un errore tecnico nella query. Potresti riformulare la domanda?';
        }
      }
    }

    return { message: responseData.message, data, isQueryError };
  }
};

module.exports = aiController;
