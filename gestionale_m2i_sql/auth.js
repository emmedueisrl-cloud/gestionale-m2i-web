const crypto = require('node:crypto');
const { promisify } = require('node:util');
const express = require('express');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'm2i_session';
const SESSION_MS = 8 * 60 * 60 * 1000;
const SCRYPT_OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const DUMMY_HASH = `scrypt$131072$8$1$${crypto.randomBytes(16).toString('hex')}$${crypto.randomBytes(64).toString('hex')}`;

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Indirizzo e-mail non valido.');
  }
  return email;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value, 'utf8') > 256) {
    throw new Error('La password deve avere almeno 12 caratteri e non superare 256 byte.');
  }
}

async function hashPassword(password) {
  validatePassword(password);
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 256) return false;
  const parts = typeof encoded === 'string' ? encoded.split('$') : [];
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (N !== SCRYPT_OPTIONS.N || r !== SCRYPT_OPTIONS.r || p !== SCRYPT_OPTIONS.p) return false;
  if (!/^[0-9a-f]{32}$/.test(parts[4]) || !/^[0-9a-f]{128}$/.test(parts[5])) return false;
  const expected = Buffer.from(parts[5], 'hex');
  const actual = await scrypt(password, Buffer.from(parts[4], 'hex'), 64, SCRYPT_OPTIONS);
  return crypto.timingSafeEqual(actual, expected);
}

function sessionToken(req) {
  const header = req.headers.cookie || '';
  const pair = header.split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`));
  const token = pair ? pair.slice(COOKIE.length + 1) : '';
  return /^[0-9a-f]{64}$/.test(token) ? token : null;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MS
  };
}

function createAuth(knex) {
  const router = express.Router();
  const attempts = new Map();

  async function initialize() {
    if (!await knex.schema.hasTable('auth_users')) {
      await knex.schema.createTable('auth_users', table => {
        table.increments('id').primary();
        table.string('email', 254).notNullable().unique();
        table.text('password_hash').notNullable();
        table.string('role', 20).notNullable().defaultTo('user');
        table.boolean('active').notNullable().defaultTo(true);
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      });
    }
    if (!await knex.schema.hasTable('auth_sessions')) {
      await knex.schema.createTable('auth_sessions', table => {
        table.string('token_hash', 64).primary();
        table.integer('user_id').notNullable().references('id').inTable('auth_users').onDelete('CASCADE');
        table.bigInteger('expires_at').notNullable().index();
      });
    }

    const [{ count }] = await knex('auth_users').count('* as count');
    if (Number(count) === 0) {
      const email = process.env.AUTH_BOOTSTRAP_EMAIL;
      const password = process.env.AUTH_BOOTSTRAP_PASSWORD;
      if (!email || !password) {
        throw new Error('Nessun amministratore: configurare AUTH_BOOTSTRAP_EMAIL e AUTH_BOOTSTRAP_PASSWORD prima di avviare il servizio.');
      }
      await knex('auth_users').insert({
        email: normalizeEmail(email),
        password_hash: await hashPassword(password),
        role: 'admin',
        active: true
      });
      console.log('Account amministratore iniziale creato. Rimuovere AUTH_BOOTSTRAP_PASSWORD dalle variabili Render.');
    }
  }

  async function currentUser(req) {
    const token = sessionToken(req);
    if (!token) return null;
    const row = await knex('auth_sessions as s')
      .join('auth_users as u', 'u.id', 's.user_id')
      .where('s.token_hash', tokenHash(token))
      .andWhere('s.expires_at', '>', Date.now())
      .andWhere('u.active', 1)
      .select('u.id', 'u.email', 'u.role')
      .first();
    return row || null;
  }

  async function requireAuth(req, res, next) {
    try {
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ error: 'Accesso richiesto.' });
      req.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  }

  function requireAdmin(req, res, next) {
    if (req.authUser?.role !== 'admin') return res.status(403).json({ error: 'Permesso amministratore richiesto.' });
    next();
  }

  function loginAllowed(ip) {
    const now = Date.now();
    const state = attempts.get(ip) || { count: 0, until: now + 15 * 60 * 1000 };
    if (now >= state.until) { state.count = 0; state.until = now + 15 * 60 * 1000; }
    if (state.count >= 10) return false;
    state.count += 1;
    attempts.set(ip, state);
    return true;
  }

  router.post('/login', async (req, res, next) => {
    try {
      if (!loginAllowed(req.ip)) return res.status(429).json({ error: 'Troppi tentativi. Riprova fra 15 minuti.' });
      let email;
      try { email = normalizeEmail(req.body?.email); } catch { return res.status(401).json({ error: 'Credenziali non valide.' }); }
      const password = req.body?.password;
      const user = await knex('auth_users').where({ email, active: true }).first();
      const valid = await verifyPassword(password, user?.password_hash || DUMMY_HASH);
      if (!user || !valid) return res.status(401).json({ error: 'Credenziali non valide.' });
      attempts.delete(req.ip);
      const oldToken = sessionToken(req);
      if (oldToken) await knex('auth_sessions').where({ token_hash: tokenHash(oldToken) }).del();
      const token = crypto.randomBytes(32).toString('hex');
      await knex('auth_sessions').where('expires_at', '<=', Date.now()).del();
      await knex('auth_sessions').insert({ token_hash: tokenHash(token), user_id: user.id, expires_at: Date.now() + SESSION_MS });
      res.cookie(COOKIE, token, cookieOptions());
      res.json({ id: user.id, email: user.email, role: user.role });
    } catch (error) { next(error); }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const token = sessionToken(req);
      if (token) await knex('auth_sessions').where({ token_hash: tokenHash(token) }).del();
      res.clearCookie(COOKIE, { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      res.status(204).end();
    } catch (error) { next(error); }
  });

  router.get('/me', requireAuth, (req, res) => res.json(req.authUser));

  router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      res.json(await knex('auth_users').select('id', 'email', 'role', 'active', 'created_at').orderBy('email'));
    } catch (error) { next(error); }
  });

  router.post('/users', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password_hash = await hashPassword(req.body?.password);
      const role = ['admin', 'user', 'contabilita'].includes(req.body?.role) ? req.body.role : 'user';
      if (await knex('auth_users').where({ email }).first()) return res.status(409).json({ error: 'Account già presente.' });
      const [id] = await knex('auth_users').insert({ email, password_hash, role, active: true });
      res.status(201).json({ id, email, role });
    } catch (error) {
      if (error.message.includes('UNIQUE')) return res.status(409).json({ error: 'Account già presente.' });
      if (error.message.includes('password') || error.message.includes('e-mail')) return res.status(400).json({ error: error.message });
      next(error);
    }
  });

  router.put('/users/:id/password', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'ID non valido.' });
      const password_hash = await hashPassword(req.body?.password);
      const changed = await knex('auth_users').where({ id }).update({ password_hash });
      if (!changed) return res.status(404).json({ error: 'Account non trovato.' });
      await knex('auth_sessions').where({ user_id: id }).del();
      res.status(204).end();
    } catch (error) {
      if (error.message.includes('password')) return res.status(400).json({ error: error.message });
      next(error);
    }
  });

  router.patch('/users/:id/active', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const active = req.body?.active;
      if (!Number.isSafeInteger(id) || id < 1 || typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Dati non validi.' });
      }
      if (id === req.authUser.id && !active) {
        return res.status(400).json({ error: 'Non puoi disattivare il tuo account.' });
      }
      const changed = await knex('auth_users').where({ id }).update({ active });
      if (!changed) return res.status(404).json({ error: 'Account non trovato.' });
      if (!active) await knex('auth_sessions').where({ user_id: id }).del();
      res.status(204).end();
    } catch (error) { next(error); }
  });

  router.put('/me/password', requireAuth, async (req, res, next) => {
    try {
      const user = await knex('auth_users').where({ id: req.authUser.id }).first();
      if (!await verifyPassword(req.body?.currentPassword, user.password_hash)) {
        return res.status(401).json({ error: 'Password attuale non corretta.' });
      }
      const password_hash = await hashPassword(req.body?.newPassword);
      await knex('auth_users').where({ id: user.id }).update({ password_hash });
      await knex('auth_sessions').where({ user_id: user.id }).del();
      res.clearCookie(COOKIE, { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      res.status(204).end();
    } catch (error) {
      if (error.message.includes('password')) return res.status(400).json({ error: error.message });
      next(error);
    }
  });

  return { router, requireAuth, requireAdmin, initialize };
}

module.exports = { createAuth, hashPassword, verifyPassword, normalizeEmail };
