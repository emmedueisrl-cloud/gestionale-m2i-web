const path = require('node:path');
const fs = require('node:fs');

function ownerFolder(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Identificativo cartella non valido');
  return value;
}
function filename(value) {
  if (typeof value !== 'string' || !value || /[\\/:\x00-\x1f]/.test(value) || value === '.' || value === '..') throw new Error('Nome file non valido');
  return value;
}
function uploadedPath(root, file) {
  const relative = path.relative(path.resolve(root), path.resolve(file.path));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Percorso upload non valido');
  return 'uploads/' + relative.split(path.sep).join('/');
}
function finalizeUpload(root, file, owner) {
  const destination = path.join(root, ownerFolder(owner));
  const target = path.join(destination, filename(file.filename));
  uploadedPath(root, file);
  if (path.resolve(file.path) !== path.resolve(target)) {
    fs.mkdirSync(destination, { recursive: true });
    fs.copyFileSync(file.path, target, fs.constants.COPYFILE_EXCL);
    fs.unlinkSync(file.path);
    file.path = target;
  }
  return uploadedPath(root, file);
}
module.exports = { ownerFolder, filename, uploadedPath, finalizeUpload };
