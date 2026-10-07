const crypto = require('node:crypto');

const KEY = 'inserimento_appuntamenti_pubblico';

function createPublicAppuntamenti(knex) {
  async function initialize() {
    await knex('public_links').insert({ name: KEY, token: crypto.randomBytes(32).toString('hex') }).onConflict('name').ignore();
  }

  async function getToken() {
    const row = await knex('public_links').where('name', KEY).first('token');
    return row?.token;
  }

  async function isValid(token) {
    return /^[0-9a-f]{64}$/.test(token || '') && token === await getToken();
  }

  return { initialize, getToken, isValid };
}

module.exports = { createPublicAppuntamenti };
