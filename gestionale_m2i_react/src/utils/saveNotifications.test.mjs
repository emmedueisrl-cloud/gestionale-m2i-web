import test from 'node:test';
import assert from 'node:assert/strict';
import { installSaveNotifications, saveMessageForRequest, SAVE_NOTIFICATION_EVENT } from './saveNotifications.js';

test('annuncia solo le scritture effettive, non letture o anteprime', () => {
  const run = name => saveMessageForRequest('/api/run', {
    method: 'POST', body: JSON.stringify({ functionName: name, args: [] })
  });
  assert.equal(run('salvaCliente'), 'Dati salvati correttamente.');
  assert.equal(run('salvaPresenzeMensili'), 'Dati salvati correttamente.');
  assert.equal(run('recuperaClientiAttivi'), null);
  assert.equal(run('elaboraDomandaBot'), null);
  assert.equal(saveMessageForRequest('/api/anteprima-fatture-xml', { method: 'POST' }), null);
  assert.equal(saveMessageForRequest('/api/buste-paga/upload', { method: 'POST' }), null);
  assert.equal(saveMessageForRequest('/api/buste-paga/conferma', { method: 'POST' }), 'Dati salvati correttamente.');
  assert.equal(saveMessageForRequest('/api/excel/carica-presenze', { method: 'POST' }), 'Dati salvati correttamente.');
  assert.equal(saveMessageForRequest('/api/auth/login', { method: 'POST' }), null);
  assert.equal(saveMessageForRequest('/api/auth/users/1/password', { method: 'PUT' }), 'Dati salvati correttamente.');
  assert.equal(saveMessageForRequest('/api/auth/me/password', { method: 'PUT' }), 'Dati salvati correttamente.');
  assert.equal(saveMessageForRequest('/api/magazzino', { method: 'GET' }), null);
  assert.equal(saveMessageForRequest('/api/upload', { method: 'POST' }), 'Allegato caricato correttamente.');
});

test('la conferma compare solo dopo una risposta realmente riuscita', async () => {
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const events = [];
  try {
    globalThis.CustomEvent = class extends Event {
      constructor(name, options) { super(name); this.detail = options.detail; }
    };
    const fakeWindow = new EventTarget();
    fakeWindow.fetch = async (_url, options) => {
      const { functionName } = JSON.parse(options.body);
      if (functionName === 'salvaCliente') return Response.json({ success: true });
      if (functionName === 'salvaFattura') return Response.json({ success: false, error: 'Rifiutato' });
      return Response.json({ error: 'Errore' }, { status: 500 });
    };
    fakeWindow.addEventListener(SAVE_NOTIFICATION_EVENT, event => events.push(event.detail));
    globalThis.window = fakeWindow;
    installSaveNotifications();
    const request = functionName => fakeWindow.fetch('/api/run', { method: 'POST', body: JSON.stringify({ functionName }) });
    await request('salvaCliente');
    await request('salvaFattura');
    await request('salvaDipendente');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(events, ['Dati salvati correttamente.']);
  } finally {
    globalThis.window = previousWindow;
    globalThis.CustomEvent = previousCustomEvent;
  }
});
