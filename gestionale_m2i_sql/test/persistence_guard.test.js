const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

test('persistenza: rifiuta DATA_DIR assente, errato o privo di DB senza importare dati locali',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m2i-disk-guard-'));
  try {
    for(const dataDir of ['', 'relative-data', path.join(dir,'missing'),dir]) {
      const run=spawnSync(process.execPath,['-e',"require('./db')"],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'production',DATA_DIR:dataDir},encoding:'utf8',timeout:10000});
      assert.equal(run.status,1,run.stdout+run.stderr);
      assert.equal(fs.existsSync(path.join(dir,'gestionale.db')),false);
      assert.equal(fs.existsSync(path.join(dir,'missing')),false);
    }
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
