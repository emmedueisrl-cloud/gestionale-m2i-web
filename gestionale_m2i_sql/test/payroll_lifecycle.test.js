const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const sqlite3 = require('sqlite3');
const makeKnex = require('knex');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { createPayrollStore } = require('../payroll_store');
const { extractNet, matchEmployee } = require('../payroll_extraction');

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-payroll-lifecycle-'));
  const filename = path.join(dir, 'gestionale.db');
  await new Promise((resolve,reject) => {
    const db = new sqlite3.Database(filename);
    db.exec(fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8'), error => db.close(() => error ? reject(error) : resolve()));
  });
  const connect = () => makeKnex({client:'sqlite3', connection:{filename}, useNullAsDefault:true,
    pool:{min:0,max:1,afterCreate(db,done){db.run('PRAGMA foreign_keys=ON', error=>done(error,db));}}});
  const knex=connect();
  await knex('dipendenti').insert([
    {id:'D_TEST1',cognome:'ROSSI',nome:'MARIO',codice_fiscale:'RSSMRA80A01H501U',data_assunzione:'2026-01-01'},
    {id:'D_TEST2',cognome:'VERDI',nome:'ANNA',codice_fiscale:'VRDNNA80A41H501X',data_assunzione:'2026-01-01'}
  ]);
  return {dir,knex,connect};
}
async function pdf(texts) {
  const document=await PDFDocument.create();
  const font=await document.embedFont(StandardFonts.Helvetica);
  for(const text of texts) document.addPage([595,842]).drawText(text,{x:40,y:760,size:11,font});
  return Buffer.from(await document.save({useObjectStreams:false}));
}
function controller(knex,dir) {
  const filename=path.join(__dirname,'../controllers/buste_paga_upload.js');
  const mod=new Module(filename,module);
  mod.filename=filename;
  const realRequire=Module.createRequire(filename);
  mod.require=name=>name==='../db'?{knex}:realRequire(name);
  const old=process.env.DATA_DIR;
  process.env.DATA_DIR=dir;
  try {mod._compile(fs.readFileSync(filename,'utf8'),filename);} finally {
    if(old===undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR=old;
  }
  return mod.exports;
}
async function invoke(handler,req) {
  const result={status:200};
  await handler(req,{status(code){result.status=code;return this;},json(body){result.body=body;}});
  return result;
}

test('estrazione prudente: importi italiani, zero, CF univoco e ambiguità',()=>{
  assert.equal(extractNet('NETTO BUSTA 0,00 1.234,56 FERIE'),1234.56);
  assert.equal(extractNet('NETTO BUSTA 0,00 FERIE'),0);
  assert.equal(extractNet('NETTO BUSTA -12,34 FERIE'),-12.34);
  assert.equal(extractNet('nessun netto'),null);
  assert.equal(extractNet('NETTO BUSTA 1.234 FERIE'),null);
  assert.equal(extractNet('NETTO BUSTA 100,00 FERIE NETTO BUSTA 200,00 FERIE'),null);
  const employees=[{id:'1',codice_fiscale:'RSSMRA80A01H501U'},{id:'2',codice_fiscale:'VRDNNA80A41H501X'}];
  assert.equal(matchEmployee('RSSMRA80A01H501U',employees).employee.id,'1');
  assert.equal(matchEmployee('RSSMRA80A01H501U VRDNNA80A41H501X',employees).employee,null);
  assert.equal(matchEmployee('ROSSI MARIO',employees).employee,null);
});

test('ciclo buste: split, raggruppamento, rollback, riavvio, idempotenza e cancellazione recuperabile',{timeout:30000},async()=>{
  const {dir,knex,connect}=await fixture();
  let reopened;
  try {
    const ctrl=controller(knex,dir);
    const bytes=await pdf([
      'RSSMRA80A01H501U NETTO BUSTA 1.234,56 FERIE',
      'RSSMRA80A01H501U Pagina di dettaglio',
      'VRDNNA80A41H501X NETTO BUSTA 0,00 FERIE'
    ]);
    const preview=await invoke(ctrl.anteprimaBustePaga,{authUser:{id:7},files:[{buffer:bytes,originalname:'test.pdf'}]});
    assert.equal(preview.status,200,JSON.stringify(preview.body));
    assert.equal(preview.body.files.length,2);
    const [first,second]=preview.body.files;
    assert.equal(first.dipendenteId,'D_TEST1');
    assert.equal(first.extractedNetto,1234.56);
    assert.deepEqual(first.pages,[1,2]);
    assert.equal(second.extractedNetto,0);
    assert.equal((await PDFDocument.load(fs.readFileSync(path.join(dir,'.payroll-staging',first.tempFilename)))).getPageCount(),2);
    assert.equal(fs.existsSync(path.join(dir,'uploads','temp_buste')),false);
    const store=createPayrollStore(knex,dir);
    const body={mese:7,anno:2026,bustePaga:[first,second]};
    await assert.rejects(store.confirm(body,8),/altro account/);
    await assert.rejects(store.confirm({...body,mese:'../x'},7));
    await assert.rejects(store.confirm({...body,bustePaga:[{...first,extractedNetto:''}]},7),/Netto/);
    await assert.rejects(store.confirm({...body,bustePaga:[first,first]},7),/duplicato/);
    await assert.rejects(store.confirm({...body,bustePaga:[first,{...second,dipendenteId:'D_MISSING'}]},7),/non trovato/);
    assert.equal((await knex('buste_paga')).length,0);
    assert.equal(fs.readdirSync(path.join(dir,'uploads','buste_paga','2026_7')).length,0);
    assert.equal(fs.existsSync(path.join(dir,'.payroll-staging',first.tempFilename)),true);
    assert.deepEqual(await store.confirm(body,7),{success:true,saved:2,repeated:0});
    const records=await knex('buste_paga').orderBy('dipendente_id');
    for(const record of records) assert.ok(fs.existsSync(path.join(dir,record.allegato_busta_paga)));
    const originalPath=records[0].allegato_busta_paga;
    await knex.destroy();
    reopened=connect();
    const afterRestart=createPayrollStore(reopened,dir);
    assert.deepEqual(await afterRestart.confirm(body,7),{success:true,saved:0,repeated:2});
    assert.equal((await reopened('buste_paga')).length,2);
    await assert.rejects(afterRestart.confirm({...body,bustePaga:[{...first,extractedNetto:999}]},7),/dati diversi/);
    const replaceToken=afterRestart.stage(await pdf(['Sostituzione di prova']),7);
    await reopened('buste_paga').where('id',records[0].id).update({email_inviata:1,data_invio_email:'2026-07-31'});
    await afterRestart.confirm({...body,bustePaga:[{...first,tempFilename:replaceToken,extractedNetto:1300}]},7);
    const replaced=await reopened('buste_paga').where('id',records[0].id).first();
    assert.equal(replaced.email_inviata,0);
    assert.equal(replaced.data_invio_email,null);
    await assert.rejects(afterRestart.confirm(body,7), /sostituita o eliminata/);
    assert.ok(fs.existsSync(path.join(dir,originalPath)),'Originale conservato dopo sostituzione');
    const restartedController=controller(reopened,dir);
    const deleted=await invoke(restartedController.eliminaBustaPaga,{params:{id:replaced.id}});
    assert.equal(deleted.status,200);
    assert.equal(fs.existsSync(path.join(dir,replaced.allegato_busta_paga)),false);
    const archive=path.join(dir,'.payroll-trash',fs.readdirSync(path.join(dir,'.payroll-trash'))[0]);
    const manifest=JSON.parse(fs.readFileSync(path.join(archive,'records.json'),'utf8'));
    assert.equal(manifest[0].id,replaced.id);
    assert.ok(fs.existsSync(path.join(archive,manifest[0].recoveryFile)));
    await assert.rejects(afterRestart.confirm({...body,bustePaga:[{...first,tempFilename:replaceToken,extractedNetto:1300}]},7), /sostituita o eliminata/);
    const malformed=await invoke(restartedController.anteprimaBustePaga,{authUser:{id:7},files:[{buffer:Buffer.from('non pdf'),originalname:'bad.pdf'}]});
    assert.equal(malformed.status,400);
    const blank=await invoke(restartedController.anteprimaBustePaga,{authUser:{id:7},files:[{buffer:await pdf(['']),originalname:'scan.pdf'}]});
    assert.equal(blank.status,200);
    assert.equal(blank.body.files[0].dipendenteId,'');
    assert.equal(blank.body.files[0].extractedNetto,'');
    assert.ok(blank.body.files[0].warnings.some(w=>w.includes('scansione')));
  } finally {
    await knex.destroy();
    if(reopened) await reopened.destroy();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('documenti: recupero, pulizia riferimento DB, rollback e blocco percorsi esterni', async()=>{
  const {deleteAttachment}=require('../attachment_delete');
  const {ownerFolder,filename}=require('../upload_paths');
  const {dir,knex}=await fixture();
  try {
    for(const bad of ['..','../x','x/y','x\\y','']) assert.throws(()=>ownerFolder(bad));
    for(const bad of ['..','../x','x/y','x\\y','C:foo','']) assert.throws(()=>filename(bad));
    const folder=path.join(dir,'uploads','D_TEST1');
    fs.mkdirSync(folder,{recursive:true});
    const original=path.join(folder,'contratto.pdf');
    const bytes=await pdf(['Documento sintetico']);
    fs.writeFileSync(original,bytes);
    await knex('dipendenti').where('id','D_TEST1').update({allegato_contratto:'/uploads/D_TEST1/contratto.pdf'});
    await knex.raw("CREATE TRIGGER fail_delete_log BEFORE INSERT ON log_attivita BEGIN SELECT RAISE(ABORT, 'errore simulato'); END");
    await assert.rejects(deleteAttachment(knex,dir,'dipendenti','D_TEST1','contratto.pdf'),/errore simulato/);
    assert.ok(fs.existsSync(original));
    assert.ok((await knex('dipendenti').where('id','D_TEST1').first()).allegato_contratto);
    await knex.raw('DROP TRIGGER fail_delete_log');
    await deleteAttachment(knex,dir,'dipendenti','D_TEST1','contratto.pdf');
    assert.equal(fs.existsSync(original),false);
    assert.equal((await knex('dipendenti').where('id','D_TEST1').first()).allegato_contratto,null);
    const archives=fs.readdirSync(path.join(dir,'.attachment-trash'));
    for(const archive of archives) assert.deepEqual(fs.readFileSync(path.join(dir,'.attachment-trash',archive,'attachment.bin')),bytes);
  } finally {await knex.destroy();fs.rmSync(dir,{recursive:true,force:true});}
});
