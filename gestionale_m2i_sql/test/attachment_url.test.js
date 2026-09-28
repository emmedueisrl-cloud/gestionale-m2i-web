const test = require('node:test');
const assert = require('node:assert/strict');

test('link allegati: una sola barra e stesso host anche con percorsi storici', async () => {
  const { attachmentUrl } = await import('../../gestionale_m2i_react/src/utils/attachmentUrl.js');
  for (const value of ['uploads/D0007/test.pdf', '/uploads/D0007/test.pdf', '//uploads/D0007/test.pdf']) {
    assert.equal(attachmentUrl(value, ''), '/uploads/D0007/test.pdf');
    assert.equal(new URL(attachmentUrl(value, ''), 'http://127.0.0.1:3107').host, '127.0.0.1:3107');
    assert.equal(attachmentUrl(value, 'https://example.invalid/'), 'https://example.invalid/uploads/D0007/test.pdf');
  }
});
