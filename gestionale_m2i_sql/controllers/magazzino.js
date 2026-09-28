const { knex, generaIDIncrementale } = require('../db');
const fs = require('fs');
const path = require('path');
const { uploadedPath } = require('../upload_paths');

module.exports = {
  // Ottiene tutto il magazzino
  async getTuttoMagazzino(req, res) {
    try {
      const attrezzature = await knex('magazzino_attrezzature')
        .leftJoin('clienti', 'magazzino_attrezzature.cliente_id', 'clienti.id')
        .select(
          'magazzino_attrezzature.*',
          'clienti.ragione_sociale as cliente_nome'
        );

      // Parse foto JSON
      const parsed = attrezzature.map(a => {
        let fotoArr = [];
        try {
          if (a.foto) fotoArr = JSON.parse(a.foto);
        } catch (e) {}
        return { ...a, foto: fotoArr };
      });

      res.json(parsed);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Errore nel caricamento magazzino" });
    }
  },

  // Ottiene attrezzature di uno specifico cliente
  async getAttrezzatureCliente(req, res) {
    try {
      const { idCliente } = req.params;
      const attrezzature = await knex('magazzino_attrezzature').where('cliente_id', idCliente);
      
      const parsed = attrezzature.map(a => {
        let fotoArr = [];
        try {
          if (a.foto) fotoArr = JSON.parse(a.foto);
        } catch (e) {}
        return { ...a, foto: fotoArr };
      });

      res.json(parsed);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Errore caricamento attrezzature cliente" });
    }
  },

  // Crea una nuova attrezzatura
  async creaAttrezzatura(req, res) {
    try {
      const { nome, descrizione, codice_custom, cliente_id } = req.body;
      if (typeof nome !== 'string' || !nome.trim()) return res.status(400).json({ error: 'Il nome dell’attrezzatura è obbligatorio.' });
      const newId = await generaIDIncrementale('magazzino_attrezzature', 'MAG');

      let fotoPaths = [];
      if (req.files && req.files.length > 0) {
        fotoPaths = req.files.map(f => '/' + uploadedPath(path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads'), f));
      }

      const newData = {
        id: newId,
        nome: nome.trim(),
        descrizione: descrizione || '',
        codice_custom: codice_custom || '',
        foto: JSON.stringify(fotoPaths),
        cliente_id: cliente_id || null,
        data_assegnazione: cliente_id ? new Date().toISOString() : null,
        data_creazione: new Date().toISOString()
      };

      await knex('magazzino_attrezzature').insert(newData);
      await knex('log_attivita').insert({
        categoria: "Magazzino", icona: "📦", colore: "#3b82f6",
        descrizione: `Caricata nuova attrezzatura in magazzino: <b>${nome}</b>`, eseguito_da: "LocalServer"
      });
      res.json({ success: true, id: newId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Errore creazione attrezzatura" });
    }
  },

  // Assegna attrezzatura esistente a un cliente
  async assegnaAttrezzatura(req, res) {
    try {
      const { id } = req.params;
      const { cliente_id } = req.body;

      const aggiornate = await knex('magazzino_attrezzature')
        .where('id', id)
        .update({
          cliente_id: cliente_id || null,
          data_assegnazione: cliente_id ? new Date().toISOString() : null
        });
      if (!aggiornate) return res.status(404).json({ error: 'Attrezzatura non trovata.' });

      await knex('log_attivita').insert({
        categoria: "Magazzino", icona: "🔄", colore: "#f59e0b",
        descrizione: `Assegnata attrezzatura ${id} al cliente ${cliente_id || 'Nessuno (Restituita)'}`, eseguito_da: "LocalServer"
      });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Errore assegnazione attrezzatura" });
    }
  },

  // Elimina attrezzatura
  async eliminaAttrezzatura(req, res) {
    try {
      const { id } = req.params;
      
      const att = await knex('magazzino_attrezzature').where('id', id).first();
      if (att && att.foto) {
        try {
          const fotoArr = JSON.parse(att.foto);
          // Non cancelliamo i file fisici per sicurezza, o se vogliamo li cancelliamo qui
        } catch (e) {}
      }

      await knex('magazzino_attrezzature').where('id', id).del();
      await knex('log_attivita').insert({
        categoria: "Magazzino", icona: "🗑️", colore: "#ef4444",
        descrizione: `Eliminata attrezzatura (ID: ${id}) dal magazzino`, eseguito_da: "LocalServer"
      });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Errore eliminazione attrezzatura" });
    }
  }
};
