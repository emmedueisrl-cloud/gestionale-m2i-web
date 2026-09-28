const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { resolvePayrollAttachment } = require('../payroll_attachment');

test('allegato busta paga: usa DATA_DIR e rifiuta percorsi esterni, mancanti o non PDF', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-payroll-path-'));
  try {
    fs.mkdirSync(path.join(dir, 'uploads', 'buste'), { recursive: true });
    const pdf = path.join(dir, 'uploads', 'buste', 'test.pdf');
    fs.writeFileSync(pdf, '%PDF-1.4 test');
    fs.writeFileSync(path.join(dir, 'segreto.pdf'), 'non allegare');
    fs.writeFileSync(path.join(dir, 'uploads', 'test.txt'), 'non PDF');
    assert.equal(resolvePayrollAttachment(dir, 'uploads/buste/test.pdf'), fs.realpathSync(pdf));
    for (const invalid of [null, '../segreto.pdf', 'uploads/../segreto.pdf', 'uploads/missing.pdf', 'uploads/test.txt', pdf]) {
      assert.throws(() => resolvePayrollAttachment(dir, invalid));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
