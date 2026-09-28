const fs = require('node:fs');
const path = require('node:path');

function resolvePayrollAttachment(dataDir, storedPath) {
  if (typeof storedPath !== 'string' || !storedPath.startsWith('uploads/')) {
    throw new Error('Percorso allegato non valido');
  }
  const root = fs.realpathSync(path.join(dataDir, 'uploads'));
  const candidate = path.resolve(dataDir, storedPath);
  const inside = file => {
    const relative = path.relative(root, file);
    return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  if (!inside(candidate)) throw new Error('Percorso allegato non valido');
  const resolved = fs.realpathSync(candidate);
  if (!inside(resolved) || path.extname(resolved).toLowerCase() !== '.pdf' || !fs.statSync(resolved).isFile()) {
    throw new Error('Allegato PDF non valido');
  }
  return resolved;
}

module.exports = { resolvePayrollAttachment };
