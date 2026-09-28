const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAuth, hashPassword, verifyPassword, normalizeEmail } = require('../auth');

test('le password sono salate e la verifica rifiuta valori diversi', async () => {
  const password = 'password-di-prova-sicura-123';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('password-sbagliata-123', first), false);
});

test('password brevi e input eccessivi sono respinti', async () => {
  await assert.rejects(hashPassword('breve'));
  assert.equal(await verifyPassword('x'.repeat(300), 'invalid'), false);
});

test('gli indirizzi sono normalizzati e validati', () => {
  assert.equal(normalizeEmail('  Admin@Example.COM '), 'admin@example.com');
  assert.throws(() => normalizeEmail('non-una-email'));
});

test('login, accesso con cookie e logout funzionano senza token nel browser', async () => {
  const users = [{ id: 1, email: 'admin@example.com', role: 'admin', active: true,
    password_hash: await hashPassword('password-di-test-robusta-123') }];
  const sessions = [];
  const knex = table => {
    const filters = [];
    const query = {
      where(...args) {
        if (typeof args[0] === 'object') filters.push(...Object.entries(args[0]).map(([key, value]) => [key, '=', value]));
        else filters.push(args.length === 2 ? [args[0], '=', args[1]] : args);
        return this;
      },
      andWhere(...args) { return this.where(...args); },
      join() { return this; },
      select() { return this; },
      async first() {
        let rows = table === 'auth_users' ? users : sessions.map(session => {
          const user = users.find(item => item.id === session.user_id);
          return { ...session, ...user, 's.token_hash': session.token_hash,
            's.expires_at': session.expires_at, 'u.active': Number(user?.active) };
        });
        return rows.find(row => filters.every(([key, op, value]) => {
          if (op === '>') return row[key] > value;
          if (op === '<=') return row[key] <= value;
          return row[key] === value;
        }));
      },
      async del() {
        const kept = sessions.filter(row => !filters.every(([key, op, value]) => {
          if (op === '<=') return row[key] <= value;
          return row[key] === value;
        }));
        sessions.splice(0, sessions.length, ...kept);
      },
      async insert(row) { sessions.push(row); }
    };
    return query;
  };

  const auth = createAuth(knex);
  const app = express();
  app.use(express.json());
  app.use('/api/auth', auth.router);
  app.get('/api/secure', auth.requireAuth, (req, res) => res.json(req.authUser));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/secure`)).status, 401);
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'password-di-test-robusta-123' })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    const authCookie = cookie.split(';')[0];
    const secure = await fetch(`${base}/api/secure`, { headers: { Cookie: authCookie } });
    assert.equal(secure.status, 200);
    assert.equal((await secure.json()).email, 'admin@example.com');
    const logout = await fetch(`${base}/api/auth/logout`, {
      method: 'POST', headers: { Cookie: authCookie }
    });
    assert.equal(logout.status, 204);
    assert.equal((await fetch(`${base}/api/secure`, { headers: { Cookie: authCookie } })).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
