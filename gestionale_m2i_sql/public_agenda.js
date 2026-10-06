const crypto = require('node:crypto');

const KEY = 'agenda_caposquadra_publica';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validMonday(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

function createPublicAgenda(knex) {
  async function initialize() {
    if (!await knex.schema.hasTable('public_links')) {
      await knex.schema.createTable('public_links', table => {
        table.string('name').primary();
        table.string('token', 64).notNullable().unique();
      });
    }
    await knex('public_links').insert({ name: KEY, token: crypto.randomBytes(32).toString('hex') }).onConflict('name').ignore();
  }

  async function getToken() {
    const row = await knex('public_links').where('name', KEY).first('token');
    return row?.token;
  }

  async function getWeek(token, monday) {
    if (!/^[0-9a-f]{64}$/.test(token || '') || !validMonday(monday)) return null;
    if (token !== await getToken()) return null;
    const start = new Date(`${monday}T12:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const sunday = end.toISOString().slice(0, 10);
    const [people, appointments] = await Promise.all([
      knex('dipendenti').select('id', 'cognome', 'nome')
        .where('is_caposquadra', 1).whereNot('stato', 'Cessato').where('cestinato', 0)
        .orderBy('cognome').orderBy('nome'),
      knex('agenda_caposquadra as a')
        .join('dipendenti as d', 'a.dipendente_id', 'd.id')
        .leftJoin('clienti as c', 'a.cliente_id', 'c.id')
        .where('d.is_caposquadra', 1).whereNot('d.stato', 'Cessato').where('d.cestinato', 0)
        .whereBetween('a.data', [monday, sunday])
        .select('a.id', 'a.dipendente_id', 'a.data', 'a.ora_inizio', 'a.ora_fine', 'a.colore', 'a.note', 'c.ragione_sociale as cliente')
        .orderBy('a.data').orderBy('a.ora_inizio').orderBy('d.cognome')
    ]);
    return {
      capisquadra: people.map(p => ({ id: p.id, nome: `${p.cognome} ${p.nome}`.trim() })),
      impegni: appointments.map(a => ({
        id: a.id, idCaposquadra: a.dipendente_id, data: a.data,
        oraInizio: a.ora_inizio, oraFine: a.ora_fine,
        cliente: a.cliente || 'Servizio', colore: a.colore, note: a.note || ''
      }))
    };
  }

  return { initialize, getToken, getWeek };
}

module.exports = { createPublicAgenda, validMonday };
