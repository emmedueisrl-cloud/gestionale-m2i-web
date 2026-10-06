const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitize, classify, fingerprint } = require('../autodiagnosi');

test('autodiagnosi oscura credenziali e percorsi locali', () => {
  const result = sanitize('token=abc123 password:segreta C:\\Users\\Mario\\file.txt');
  assert.match(result, /token=\[nascosto\]/i);
  assert.match(result, /password=\[nascosto\]/i);
  assert.doesNotMatch(result, /abc123|segreta|Users\\Mario/);
});

test('autodiagnosi riconosce gli errori di database', () => {
  const result = classify('SQLITE_BUSY: database is locked');
  assert.equal(result.area, 'Database');
  assert.equal(result.gravita, 'critico');
});

test('autodiagnosi raggruppa messaggi equivalenti con identificativi diversi', () => {
  assert.equal(
    fingerprint('Elaborati', 'Blinda riga', 'Errore sulla riga 123'),
    fingerprint('Elaborati', 'Blinda riga', 'Errore sulla riga 987')
  );
});
