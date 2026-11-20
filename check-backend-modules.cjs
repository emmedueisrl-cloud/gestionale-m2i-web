const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = __dirname;
let tracked;
try {
  tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root })
    .toString('utf8').split('\0').filter(Boolean).map(file => file.replace(/\\/g, '/')));
} catch {
  // Render può fornire un checkout senza metadati Git.
  tracked = null;
}

const sourceFiles = tracked ? [...tracked].filter(file =>
  file.startsWith('gestionale_m2i_sql/') && file.endsWith('.js') && !file.startsWith('gestionale_m2i_sql/test/'))
  : ['gestionale_m2i_sql/server.js'];
const missing = [];
for (const sourceFile of sourceFiles) {
  const source = fs.readFileSync(path.join(root, sourceFile), 'utf8');
  for (const match of source.matchAll(/require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const base = path.resolve(root, path.dirname(sourceFile), match[1]);
    const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
    const resolved = candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!resolved) { missing.push(`${sourceFile}: ${match[1]} non esiste`); continue; }
    const relative = path.relative(root, resolved).replace(/\\/g, '/');
    if (tracked && !tracked.has(relative)) missing.push(`${sourceFile}: ${relative} non è incluso nel commit`);
  }
}
if (missing.length) {
  console.error(`Moduli backend mancanti dal deploy:\n${missing.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Moduli backend locali presenti nel commit.');
}
