const fs = require('fs');
const path = require('path');
function getFiles(dir) {
  try {
    return fs.readdirSync(dir).map(f => {
      const p = path.join(dir, f);
      const stats = fs.statSync(p);
      return { file: f, size: stats.size, dir: stats.isDirectory() };
    });
  } catch(e) { return e.message; }
}
console.log('--- /var/lib/data ---');
console.log(getFiles('/var/lib/data'));
console.log('--- ./DATA_DIR ---');
console.log(getFiles(path.join(__dirname, 'DATA_DIR')));
