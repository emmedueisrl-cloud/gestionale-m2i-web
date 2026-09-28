const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn } = require('node:child_process');
const sqlite3 = require('sqlite3');

async function createFixtureDatabase(filePath, schemaPath) {
  const db = await new Promise((resolve, reject) => {
    const handle = new sqlite3.Database(filePath, error => error ? reject(error) : resolve(handle));
  });
  try {
    await new Promise((resolve, reject) => db.exec(fs.readFileSync(schemaPath, 'utf8'), error => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => db.run(
      'INSERT INTO dipendenti (id, cognome, nome, codice_fiscale, data_assunzione) VALUES (?, ?, ?, ?, ?)',
      ['D0001', 'Prova', 'Test', 'TEST000000000001', '2026-01-01'],
      error => error ? reject(error) : resolve()
    ));
  } finally {
    await new Promise(resolve => db.close(resolve));
  }
}

async function unusedPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

test('server reale: SQLite, login, privilegi, logout e funzioni di test non esposte', { timeout: 30000 }, async () => {
  const backendDir = path.join(__dirname, '..');
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-integration-'));
  const password = crypto.randomBytes(24).toString('hex');
  let child;
  let output = '';
  try {
    await createFixtureDatabase(path.join(temporaryDir, 'gestionale.db'), path.join(backendDir, 'schema.sql'));
    const port = await unusedPort();
    const base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['server.js'], {
      cwd: backendDir,
      env: {
        ...process.env,
        DATA_DIR: temporaryDir,
        PORT: String(port),
        NODE_ENV: 'development',
        AUTH_BOOTSTRAP_EMAIL: 'local-test@example.invalid',
        AUTH_BOOTSTRAP_PASSWORD: password
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });

    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server terminato: ${output.slice(-1500)}`);
      try {
        if ((await fetch(`${base}/healthz`)).ok) { ready = true; break; }
      } catch { /* attesa avvio */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.equal(ready, true, `Server non avviato: ${output.slice(-1500)}`);
    if (fs.existsSync(path.join(backendDir, '..', 'gestionale_m2i_react', 'dist', 'index.html'))) {
      const home = await fetch(`${base}/`);
      assert.equal(home.status, 200);
      assert.match(await home.text(), /<div id="root"><\/div>/);
      const directRoute = await fetch(`${base}/admin/dashboard`);
      assert.equal(directRoute.status, 200);
      assert.match(await directRoute.text(), /<div id="root"><\/div>/);
      assert.equal((await fetch(`${base}/api/does-not-exist`)).status, 401);
    }

    assert.equal((await fetch(`${base}/api/auth/me`)).status, 401);
    assert.equal((await fetch(`${base}/api/backup-db`)).status, 401);
    assert.equal((await fetch(`${base}/api/backup-excel`)).status, 401);
    assert.equal((await fetch(`${base}/api/health`)).status, 401);
    assert.equal((await fetch(`${base}/api/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ functionName: 'recuperaDatiDashboard', args: [] })
    })).status, 401);
    assert.equal((await fetch(`${base}/uploads/test.jpg`)).status, 401);

    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'local-test@example.invalid', password })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })).status, 200);

    const employeeId = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path.join(temporaryDir, 'gestionale.db'), sqlite3.OPEN_READONLY);
      db.get('SELECT id FROM dipendenti LIMIT 1', (error, row) => {
        db.close();
        if (error) reject(error);
        else resolve(row?.id);
      });
    });
    assert.ok(employeeId);
    const queryPlan = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path.join(temporaryDir, 'gestionale.db'), sqlite3.OPEN_READONLY);
      db.all('EXPLAIN QUERY PLAN SELECT * FROM registro_ore WHERE dipendente_id = ? AND mese = ? AND anno = ?',
        [employeeId, 1, 2026], (error, rows) => {
          db.close();
          if (error) reject(error);
          else resolve(rows);
        });
    });
    assert.match(queryPlan.map(row => row.detail).join(' '), /idx_registro_ore_dipendente_periodo/);
    const runFunction = async (functionName, ...args) => {
      const response = await fetch(`${base}/api/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ functionName, args })
      });
      assert.equal(response.status, 200);
      return response.json();
    };
    const saveHours = data => runFunction('salvaPresenzeMensili', data);
    const hoursData = { idDipendente: employeeId, mese: 7, anno: 2026, metodoInserimento: 'Mensile Totale', righe: [{ ore_totali: 5 }] };
    assert.equal((await saveHours(hoursData)).success, true);
    assert.equal((await saveHours({ ...hoursData, righe: [{ ore_totali: 8, idCliente: 'C-INESISTENTE' }] })).success, false);
    assert.equal((await saveHours({ ...hoursData, idDipendente: 'D-INESISTENTE' })).success, false);
    const { righe: omittedRows, ...incompleteHours } = hoursData;
    assert.ok(omittedRows.length);
    assert.equal((await saveHours(incompleteHours)).success, false);
    assert.equal((await saveHours({ ...hoursData, righe: null })).success, false);
    assert.equal((await saveHours({ ...hoursData, mese: '7invalid' })).success, false);
    const savedHours = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path.join(temporaryDir, 'gestionale.db'), sqlite3.OPEN_READONLY);
      db.all('SELECT dipendente_id, ore_totali FROM registro_ore WHERE mese = 7 AND anno = 2026', (error, rows) => {
        db.close(() => error ? reject(error) : resolve(rows));
      });
    });
    assert.deepEqual(savedHours, [{ dipendente_id: employeeId, ore_totali: 5 }]);
    const fixedSchedule = {
      idDipendente: employeeId,
      impegni: [{ giornoSettimana: 'Lunedì', oraInizio: '09:00', oraFine: '12:00', idCliente: null, note: 'Prova rollback' }]
    };
    assert.equal((await runFunction('salvaProgrammaFisso', fixedSchedule)).success, true);
    assert.equal((await runFunction('salvaProgrammaFisso', {
      ...fixedSchedule, impegni: [{ ...fixedSchedule.impegni[0], idCliente: 'C-INESISTENTE' }]
    })).success, false);
    const queryFixture = sql => new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path.join(temporaryDir, 'gestionale.db'), sqlite3.OPEN_READONLY);
      db.all(sql, (error, rows) => db.close(() => error ? reject(error) : resolve(rows)));
    });
    assert.deepEqual(await queryFixture('SELECT giorno_settimana, ora_inizio, ora_fine FROM programma_fisso'),
      [{ giorno_settimana: 'Lunedì', ora_inizio: '09:00', ora_fine: '12:00' }]);
    assert.equal((await runFunction('salvaProgrammaFisso', { idDipendente: 'D-INESISTENTE', impegni: [] })).success, false);
    assert.equal((await runFunction('salvaProgrammaFisso', { idDipendente: employeeId })).success, false);
    assert.equal((await runFunction('salvaProgrammaFisso', { ...fixedSchedule, impegni: {} })).success, false);
    assert.equal((await queryFixture('SELECT * FROM programma_fisso')).length, 1);
    assert.equal((await runFunction('salvaProgrammaFisso', { ...fixedSchedule, impegni: [] })).success, true);
    assert.equal((await queryFixture('SELECT * FROM programma_fisso')).length, 0);
    const mutateFixture = sql => new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path.join(temporaryDir, 'gestionale.db'));
      db.exec(sql, error => db.close(() => error ? reject(error) : resolve()));
    });
    await mutateFixture("INSERT INTO clienti(id,ragione_sociale,partita_iva) VALUES ('C_TEST','Cliente collaudo','TEST-PIVA');");
    const invoice = { idCliente: 'C_TEST', numeroFattura: 'TEST-1', dataFattura: '2026-09-28', importoImponibile: 100, aliquotaIva: 0 };
    assert.equal((await runFunction('salvaFattura', invoice)).success, true);
    assert.deepEqual(await queryFixture("SELECT aliquota_iva, importo_iva, importo_totale FROM fatture WHERE numero_fattura='TEST-1'"),
      [{ aliquota_iva: 0, importo_iva: 0, importo_totale: 100 }]);
    const invoiceId = (await queryFixture("SELECT id FROM fatture WHERE numero_fattura='TEST-1'"))[0].id;
    for (const invalidAmount of [-1, 0, '', 'abc', '10abc']) {
      assert.equal((await runFunction('registraIncassoServer', invoiceId, '2026-09-28', invalidAmount)).success, false);
    }
    assert.equal((await runFunction('registraIncassoServer', invoiceId, '2026-09-28', 25)).success, true);
    assert.equal((await runFunction('registraIncassoServer', invoiceId, '2026-09-28', 75)).success, true);
    assert.deepEqual(await queryFixture("SELECT importo_pagato,stato_pagamento FROM fatture WHERE numero_fattura='TEST-1'"),
      [{ importo_pagato: 100, stato_pagamento: 'Pagata' }]);
    const postEmail = (url, body) => fetch(`${base}${url}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body)
    });
    assert.equal((await postEmail('/api/emails/send', {})).status, 400);
    assert.equal((await postEmail('/api/emails/sync', {})).status, 400);
    await mutateFixture("INSERT INTO emails(id,data_invio,mittente,destinatario,oggetto,corpo,tipo,cartella,stato) VALUES ('EM_IMAP_TEST','2026-09-28','test@example.invalid','test@example.invalid','Messaggio di prova','Test','incoming','inbox','Ricevuta');");
    assert.equal((await postEmail('/api/configurazione-email', { host: '127.0.0.1', port: 1, user: 'test@example.invalid', pass: '', imap_host: '127.0.0.1', use_smtp_creds: true })).status, 200);
    assert.equal((await postEmail('/api/emails/sync', {})).status, 500);
    assert.equal((await queryFixture("SELECT * FROM emails WHERE id='EM_IMAP_TEST'")).length, 1,
      'Una sincronizzazione fallita non deve cancellare la posta archiviata');
    assert.equal((await runFunction('salvaProroga', { idDipendente: employeeId, nuovaScadenza: '2026-12-31' })).success, true);
    for (const functionName of ['salvaProroga', 'trasformaIndeterminato', 'registraCessazione', 'riattivaDipendenteServer']) {
      assert.equal((await runFunction(functionName, { idDipendente: 'D-INESISTENTE', nuovaScadenza: '2027-01-31' })).success, false);
    }
    const contractState = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path.join(temporaryDir, 'gestionale.db'), sqlite3.OPEN_READONLY);
      db.get('SELECT COUNT(*) AS count FROM proroghe_contratti', (error, proroghe) => {
        if (error) return db.close(() => reject(error));
        db.get('SELECT scadenza FROM dipendenti WHERE id = ?', [employeeId], (dateError, dipendente) => {
          if (dateError) return db.close(() => reject(dateError));
          db.get('SELECT COUNT(*) AS count FROM log_attivita WHERE descrizione LIKE ?', ['%D-INESISTENTE%'], (logError, logs) => {
            db.close(() => logError ? reject(logError) : resolve({ proroghe: proroghe.count, scadenza: dipendente.scadenza, invalidLogs: logs.count }));
          });
        });
      });
    });
    assert.deepEqual(contractState, { proroghe: 1, scadenza: '2026-12-31', invalidLogs: 0 });
    fs.mkdirSync(path.join(temporaryDir, 'uploads', 'doc'), { recursive: true });
    fs.writeFileSync(path.join(temporaryDir, 'uploads', 'doc', 'email_test.pdf'), 'contenuto di prova');
    const linkUrl = `${base}/api/dipendenti/${employeeId}/collega-allegato`;
    const linkHeaders = { 'Content-Type': 'application/json', Cookie: cookie };
    const linkBody = { localName: 'email_test.pdf', tipo_documento: 'cv' };
    const firstLink = await fetch(linkUrl, { method: 'POST', headers: linkHeaders, body: JSON.stringify(linkBody) });
    assert.equal(firstLink.status, 200);
    assert.equal((await firstLink.json()).success, true);
    assert.equal((await fetch(`${base}/uploads/${employeeId}/email_email_test.pdf`, { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await fetch(linkUrl, { method: 'POST', headers: linkHeaders, body: JSON.stringify(linkBody) })).status, 409);
    assert.equal((await fetch(linkUrl, { method: 'POST', headers: linkHeaders, body: JSON.stringify({ ...linkBody, overwrite: true }) })).status, 200);
    assert.equal((await fetch(linkUrl, { method: 'POST', headers: linkHeaders, body: JSON.stringify({ ...linkBody, localName: '../db' }) })).status, 400);

    const uploadFile = async (filename, contents) => {
      const form = new FormData();
      form.append('idDipendente', employeeId);
      form.append('file', new Blob([contents]), filename);
      return fetch(`${base}/api/upload`, { method: 'POST', headers: { Cookie: cookie }, body: form });
    };
    const firstUpload = await uploadFile('documento.pdf', 'prova');
    const firstPath = (await firstUpload.json()).path;
    assert.equal(firstUpload.status, 200);
    const secondUpload = await uploadFile('documento.pdf', 'altra prova');
    const secondPath = (await secondUpload.json()).path;
    assert.equal(secondUpload.status, 200);
    assert.notEqual(firstPath, secondPath);
    assert.equal(fs.readFileSync(path.join(temporaryDir, firstPath), 'utf8'), 'prova');
    const lateOwner = new FormData();
    lateOwner.append('file', new Blob(['ordine multipart inverso']), 'late.pdf');
    lateOwner.append('idDipendente', employeeId);
    const lateResponse = await fetch(`${base}/api/upload`, {method:'POST',headers:{Cookie:cookie},body:lateOwner});
    assert.equal(lateResponse.status,200);
    const latePath=(await lateResponse.json()).path;
    assert.ok(latePath.startsWith(`uploads/${employeeId}/`));
    assert.equal(fs.readFileSync(path.join(temporaryDir,latePath),'utf8'),'ordine multipart inverso');
    assert.equal((await fetch(`${base}/${latePath}`,{headers:{Cookie:cookie}})).status,200);
    const warehouseForm=new FormData();
    warehouseForm.append('nome','Attrezzatura sintetica');
    warehouseForm.append('foto',new Blob(['immagine sintetica']),'test.png');
    const warehouseResponse=await fetch(`${base}/api/magazzino`,{method:'POST',headers:{Cookie:cookie},body:warehouseForm});
    assert.equal(warehouseResponse.status,200);
    const warehouseId=(await warehouseResponse.json()).id;
    const warehouseList=await (await fetch(`${base}/api/magazzino`,{headers:{Cookie:cookie}})).json();
    const warehouseFile=warehouseList.find(item=>item.id===warehouseId).foto[0];
    assert.ok(warehouseFile.startsWith('/uploads/magazzino/'));
    assert.equal((await fetch(`${base}${warehouseFile}`,{headers:{Cookie:cookie}})).status,200);
    await mutateFixture("INSERT INTO clienti(id,ragione_sociale,partita_iva) VALUES ('C_FILES','Cliente allegati','FILES-PIVA');");
    fs.mkdirSync(path.join(temporaryDir,'uploads','C_FILES'),{recursive:true});
    fs.writeFileSync(path.join(temporaryDir,'uploads','C_FILES','contratto.pdf'),'documento da conservare');
    assert.equal((await runFunction('eliminaCliente','C_FILES')).data.cestinato,true);
    assert.equal(fs.readFileSync(path.join(temporaryDir,'uploads','C_FILES','contratto.pdf'),'utf8'),'documento da conservare');
    assert.equal((await uploadFile('pagina.html', '<script>test</script>')).status, 415);
    assert.equal((await uploadFile('grande.pdf', Buffer.alloc(11 * 1024 * 1024))).status, 413);
    const wrongPayroll = new FormData();
    wrongPayroll.append('files', new Blob(['test']), 'non-pdf.html');
    assert.equal((await fetch(`${base}/api/buste-paga/upload`, {
      method: 'POST', headers: { Cookie: cookie }, body: wrongPayroll
    })).status, 415);
    const wrongExcel = new FormData();
    wrongExcel.append('file', new Blob(['test']), 'non-excel.html');
    assert.equal((await fetch(`${base}/api/excel/carica-presenze`, {
      method: 'POST', headers: { Cookie: cookie }, body: wrongExcel
    })).status, 415);

    const noReset = await fetch(`${base}/api/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ functionName: 'resetDatabaseForTest', args: [] })
    });
    assert.equal((await noReset.json()).success, false);
    for (const functionName of ['riparaDatabaseClienti', 'registraAttivita']) {
      const unavailable = await fetch(`${base}/api/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ functionName, args: [] })
      });
      assert.equal((await unavailable.json()).success, false);
    }
    const traversal = await fetch(`${base}/api/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ functionName: 'prendiHtmlContenutoInApp', args: ['../db'] })
    });
    assert.equal(traversal.status, 400);
    assert.equal((await fetch(`${base}/api/backup-db`, { headers: { Cookie: cookie }, method: 'HEAD' })).status, 200);
    assert.equal((await fetch(`${base}/api/health`, { headers: { Cookie: cookie } })).status, 200);
    const backupResponse = await fetch(`${base}/api/backup-db`, { headers: { Cookie: cookie } });
    assert.equal(backupResponse.status, 200);
    const downloadedBackupPath = path.join(temporaryDir, 'downloaded-backup.db');
    fs.writeFileSync(downloadedBackupPath, Buffer.from(await backupResponse.arrayBuffer()));
    const downloadedBackup = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(downloadedBackupPath, sqlite3.OPEN_READONLY);
      db.get('PRAGMA integrity_check', (error, row) => {
        if (error) return db.close(() => reject(error));
        db.get('SELECT COUNT(*) AS count FROM dipendenti WHERE id = ?', [employeeId], (countError, countRow) => {
          db.close(() => countError ? reject(countError) : resolve({ integrity: row.integrity_check, count: countRow.count }));
        });
      });
    });
    assert.deepEqual(downloadedBackup, { integrity: 'ok', count: 1 });
    const excelBackup = await fetch(`${base}/api/backup-excel`, { headers: { Cookie: cookie } });
    assert.equal(excelBackup.status, 200);
    assert.equal(Buffer.from(await excelBackup.arrayBuffer()).subarray(0, 2).toString(), 'PK');

    const operatorPassword = crypto.randomBytes(24).toString('hex');
    const createOperator = await fetch(`${base}/api/auth/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ email: 'operator@example.invalid', password: operatorPassword, role: 'user' })
    });
    assert.equal(createOperator.status, 201);
    const operatorLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operator@example.invalid', password: operatorPassword })
    });
    assert.equal(operatorLogin.status, 200);
    const operatorCookie = operatorLogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(operatorCookie);
    assert.equal((await fetch(`${base}/api/backup-db`, { headers: { Cookie: operatorCookie } })).status, 403);
    assert.equal((await fetch(`${base}/api/backup-excel`, { headers: { Cookie: operatorCookie } })).status, 403);
    assert.equal((await fetch(`${base}/api/health`, { headers: { Cookie: operatorCookie } })).status, 403);
    assert.equal((await fetch(`${base}/api/configurazione-email`, { headers: { Cookie: operatorCookie } })).status, 403);
    assert.equal((await fetch(`${base}/api/ai/settings`, { headers: { Cookie: operatorCookie } })).status, 403);
    assert.equal((await fetch(`${base}/api/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: operatorCookie },
      body: JSON.stringify({ functionName: 'svuotaLogSistema', args: [] })
    })).status, 403);

    const crossOrigin = await fetch(`${base}/api/auth/logout`, {
      method: 'POST', headers: { Cookie: cookie, Origin: 'https://example.invalid' }
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } })).status, 204);
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })).status, 401);
  } finally {
    if (child) {
      child.kill();
      await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
    }
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
});
