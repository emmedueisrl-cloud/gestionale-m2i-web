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
    await new Promise((resolve, reject) => db.run(
      'INSERT INTO preventivi (numero_preventivo, data_preventivo, ragione_sociale_prospect) VALUES (?, ?, ?)',
      ['LEGACY-001', '2026-01-01', 'Cliente storico'],
      error => error ? reject(error) : resolve()
    ));
    await new Promise((resolve, reject) => db.exec(
      "INSERT INTO agenda_caposquadra (dipendente_id, data, ora_inizio, ora_fine, tipo_impegno, attivita, nome_referente, indirizzo, note, colore) VALUES ('D0001', '2026-11-02', '09:00', '', 'Sopralluogo', 'Uffici', 'Referente storico', 'Via Verdi 1', 'Note storiche', '#4f46e5'); INSERT INTO agenda_caposquadra (dipendente_id, data, ora_inizio, ora_fine, tipo_impegno, nominativo_appuntamento, luogo_appuntamento, note, colore) VALUES ('D0001', '2026-11-03', '10:00', '', 'Appuntamento', 'Referente precedente', 'Via Rossi 2', 'Vecchio tipo', '#4f46e5');",
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
    const schedeStoriche = await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json());
    assert.equal(schedeStoriche.length, 2);
    assert.equal(schedeStoriche.find(item => item.nominativo === 'Referente storico')?.attivita, 'Uffici');
    assert.equal(schedeStoriche.find(item => item.nominativo === 'Referente precedente')?.luogo, 'Via Rossi 2');
    const preventiviStorici = await fetch(`${base}/api/preventivi`, { headers: { Cookie: cookie } }).then(response => response.json());
    const preventivoStorico = preventiviStorici.find(item => item.numero_preventivo === 'LEGACY-001');
    assert.match(preventivoStorico?.id || '', /^PREV_LEGACY_[0-9a-f]{32}$/);
    assert.equal((await fetch(`${base}/api/preventivi/${preventivoStorico.id}`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 204);
    assert.equal((await fetch(`${base}/api/preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).some(item => item.numero_preventivo === 'LEGACY-001'), false);

    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi`)).status, 401);
    const appuntamento = { dataOra: '2026-10-08T10:30', nominativo: 'Cliente di prova', luogo: 'Roma', note: 'Sopralluogo', stato: 'Programmato' };
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(appuntamento)
    })).status, 401);
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...appuntamento, dataOra: '2026-02-30T10:30' })
    })).status, 400);
    const appuntamentoCreato = await fetch(`${base}/api/appuntamenti-preventivi`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(appuntamento)
    });
    assert.equal(appuntamentoCreato.status, 201);
    const { id: idAppuntamento } = await appuntamentoCreato.json();
    assert.ok(idAppuntamento);
    const appuntamentiDiretti = await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json());
    assert.equal(appuntamentiDiretti.find(item => item.id === idAppuntamento)?.agendaImpegnoId, null);
    const impegniInAgenda = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path.join(temporaryDir, 'gestionale.db'));
      db.get('SELECT COUNT(*) AS totale FROM agenda_caposquadra', (error, row) => db.close(() => error ? reject(error) : resolve(row.totale)));
    });
    assert.equal(impegniInAgenda, 2);
    const appuntamentoModificato = await fetch(`${base}/api/appuntamenti-preventivi/${idAppuntamento}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...appuntamento, stato: 'Svolto' })
    });
    assert.equal(appuntamentoModificato.status, 200);
    assert.equal((await appuntamentoModificato.json()).stato, 'Svolto');
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).length, 3);
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi/${idAppuntamento}`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 204);

    assert.equal((await fetch(`${base}/api/appuntamenti-public-link`)).status, 401);
    const { token: tokenInserimento } = await fetch(`${base}/api/appuntamenti-public-link`, { headers: { Cookie: cookie } }).then(response => response.json());
    assert.match(tokenInserimento, /^[0-9a-f]{64}$/);
    assert.equal((await fetch(`${base}/api/public/appuntamenti/${tokenInserimento}`)).status, 200);
    if (fs.existsSync(path.join(backendDir, '..', 'gestionale_m2i_react', 'dist', 'index.html'))) {
      assert.equal((await fetch(`${base}/inserisci-appuntamento/${tokenInserimento}`)).status, 200);
    }
    assert.equal((await fetch(`${base}/api/public/appuntamenti/${'0'.repeat(64)}`)).status, 404);
    const schedaPubblica = new FormData();
    schedaPubblica.append('dataOra', '2026-10-15T09:30');
    schedaPubblica.append('nominativo', 'Cliente dal link');
    schedaPubblica.append('luogo', 'Via Roma 20');
    schedaPubblica.append('stato', 'Programmato');
    schedaPubblica.append('note', 'Richiesta pubblica');
    schedaPubblica.append('scheda', new Blob(['%PDF-1.4\n%%EOF\n'], { type: 'application/pdf' }), 'scheda.pdf');
    assert.equal((await fetch(`${base}/api/public/appuntamenti/${'0'.repeat(64)}`, { method: 'POST', body: schedaPubblica })).status, 404);
    const invioPubblico = await fetch(`${base}/api/public/appuntamenti/${tokenInserimento}`, { method: 'POST', body: schedaPubblica });
    assert.equal(invioPubblico.status, 201);
    const { id: idPubblico } = await invioPubblico.json();
    const schedaSalvata = (await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).find(item => item.id === idPubblico);
    assert.equal(schedaSalvata?.nominativo, 'Cliente dal link');
    assert.equal(schedaSalvata?.luogo, 'Via Roma 20');
    assert.equal(schedaSalvata?.agendaImpegnoId, null);
    assert.match(schedaSalvata?.schedaPdf || '', /^\/uploads\/appuntamenti\/[0-9a-f-]+\.pdf$/);
    assert.equal((await fetch(`${base}${schedaSalvata.schedaPdf}`)).status, 401);
    assert.equal((await fetch(`${base}${schedaSalvata.schedaPdf}`, { headers: { Cookie: cookie } })).status, 200);
    const fileNonPdf = new FormData();
    for (const [key, value] of Object.entries(appuntamento)) fileNonPdf.append(key, value);
    fileNonPdf.append('scheda', new Blob(['non è un PDF'], { type: 'application/pdf' }), 'scheda.pdf');
    assert.equal((await fetch(`${base}/api/public/appuntamenti/${tokenInserimento}`, { method: 'POST', body: fileNonPdf })).status, 400);
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi/${idPubblico}`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 204);
    assert.equal(fs.existsSync(path.join(temporaryDir, schedaSalvata.schedaPdf.slice(1))), false);

    assert.equal((await fetch(`${base}/api/agenda-public-link`)).status, 401);
    const linkResponse = await fetch(`${base}/api/agenda-public-link`, { headers: { Cookie: cookie } });
    assert.equal(linkResponse.status, 200);
    const { token: agendaToken } = await linkResponse.json();
    assert.match(agendaToken, /^[0-9a-f]{64}$/);
    await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path.join(temporaryDir, 'gestionale.db'));
      db.exec("UPDATE dipendenti SET is_caposquadra = 1 WHERE id = 'D0001'; INSERT INTO dipendenti (id, cognome, nome, codice_fiscale, data_assunzione, is_caposquadra) VALUES ('D0002', 'Rossi', 'Anna', 'TEST000000000002', '2026-01-01', 1), ('D0003', 'Verdi', 'Luca', 'TEST000000000003', '2026-01-01', 0); INSERT INTO agenda_caposquadra (dipendente_id, data, ora_inizio, ora_fine, note, colore) VALUES ('D0001', '2026-10-05', '08:00', '12:00', 'Sopralluogo', '#4f46e5'), ('D0002', '2026-10-06', '09:00', '11:00', 'Squadra B', '#10b981'), ('D0003', '2026-10-05', '10:00', '12:00', 'Non caposquadra', '#4f46e5'), ('D0001', '2026-10-12', '08:00', '10:00', 'Altra settimana', '#4f46e5');", error => db.close(() => error ? reject(error) : resolve()));
    });
    const publicAgenda = await fetch(`${base}/api/public/agenda/${agendaToken}?week=2026-10-05`);
    assert.equal(publicAgenda.status, 200);
    const publicData = await publicAgenda.json();
    assert.deepEqual(publicData.capisquadra, [{ id: 'D0001', nome: 'Prova Test' }, { id: 'D0002', nome: 'Rossi Anna' }]);
    assert.equal(publicData.impegni.length, 2);
    assert.equal(publicData.impegni[0].note, 'Sopralluogo');
    assert.equal((await fetch(`${base}/api/public/agenda/${'0'.repeat(64)}?week=2026-10-05`)).status, 404);
    assert.equal((await fetch(`${base}/api/public/agenda/${agendaToken}?week=2026-10-06`)).status, 400);
    assert.equal((await fetch(`${base}/api/public/agenda/${agendaToken}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);

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
    const agendaCompleta = (await runFunction('recuperaDatiAgenda', 'all', '2026-10-05')).data;
    assert.equal(agendaCompleta.length, 2);
    assert.deepEqual(agendaCompleta.map(item => item.idDipendente).sort(), ['D0001', 'D0002']);
    assert.deepEqual(agendaCompleta.map(item => item.nomeCaposquadra).sort(), ['Prova Test', 'Rossi Anna']);
    const impegno = (await runFunction('recuperaDatiAgenda', 'D0001', '2026-10-05')).data[0];
    const modifica = { idDipendente: 'D0002', tipoImpegno: 'Sopralluogo', data: '2026-10-07', oraInizio: '10:00', oraFine: '13:00', idCliente: '', attivita: 'Pulizia locali', nomeReferente: 'Mario Rossi', indirizzo: 'Via Roma 10', colore: '#ef4444', note: 'Impegno aggiornato' };
    assert.equal((await fetch(`${base}/api/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ functionName: 'modificaImpegnoAgenda', args: [impegno.id, modifica] })
    })).status, 401);
    assert.equal((await runFunction('modificaImpegnoAgenda', impegno.id, { ...modifica, oraFine: '09:00' })).success, false);
    assert.equal((await runFunction('modificaImpegnoAgenda', impegno.id, modifica)).success, true);
    assert.equal((await runFunction('recuperaDatiAgenda', 'D0001', '2026-10-05')).data.length, 0);
    const agendaAggiornata = (await runFunction('recuperaDatiAgenda', 'D0002', '2026-10-05')).data;
    assert.equal(agendaAggiornata.find(item => item.id === impegno.id)?.note, 'Impegno aggiornato');
    assert.equal(agendaAggiornata.find(item => item.id === impegno.id)?.tipoImpegno, 'Sopralluogo');
    assert.equal(agendaAggiornata.find(item => item.id === impegno.id)?.nomeReferente, 'Mario Rossi');
    const schedaSopralluogo = (await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).find(item => item.agendaImpegnoId === impegno.id);
    assert.equal(schedaSopralluogo?.nominativo, 'Mario Rossi');
    assert.equal(schedaSopralluogo?.attivita, 'Pulizia locali');
    assert.equal(schedaSopralluogo?.luogo, 'Via Roma 10');
    const pubblicaAggiornata = await fetch(`${base}/api/public/agenda/${agendaToken}?week=2026-10-05`);
    const impegnoPubblicoAggiornato = (await pubblicaAggiornata.json()).impegni.find(item => item.id === impegno.id);
    assert.equal(impegnoPubblicoAggiornato?.idCaposquadra, 'D0002');
    assert.equal(impegnoPubblicoAggiornato?.tipoImpegno, 'Sopralluogo');
    assert.equal(impegnoPubblicoAggiornato?.attivita, 'Pulizia locali');
    assert.equal(impegnoPubblicoAggiornato?.indirizzo, 'Via Roma 10');
    assert.equal((await runFunction('salvaImpegnoAgenda', { ...modifica, tipoImpegno: 'Ufficio', data: '2026-10-08', oraFine: '' })).success, true);
    const senzaFine = (await runFunction('recuperaDatiAgenda', 'D0002', '2026-10-05')).data.find(item => item.tipoImpegno === 'Ufficio');
    assert.equal(senzaFine?.oraFine, '');
    assert.equal((await runFunction('modificaImpegnoAgenda', impegno.id, { ...modifica, oraFine: '' })).success, true);
    assert.equal((await runFunction('recuperaDatiAgenda', 'D0002', '2026-10-05')).data.find(item => item.id === impegno.id)?.oraFine, '');
    assert.equal((await fetch(`${base}/api/public/agenda/${agendaToken}?week=2026-10-05`).then(response => response.json())).impegni.find(item => item.id === impegno.id)?.oraFine, '');
    const daFareInGiornata = { ...modifica, tipoImpegno: 'Consegna prodotti', data: '2026-10-07', senzaOrario: true, oraInizio: '', oraFine: '' };
    assert.equal((await runFunction('salvaImpegnoAgenda', daFareInGiornata)).success, true);
    const impegnoSenzaOrario = (await runFunction('recuperaDatiAgenda', 'D0002', '2026-10-05')).data.find(item => item.tipoImpegno === 'Consegna prodotti');
    assert.equal(impegnoSenzaOrario?.senzaOrario, true);
    assert.equal(impegnoSenzaOrario?.oraInizio, '');
    assert.equal((await runFunction('modificaImpegnoAgenda', impegnoSenzaOrario.id, { ...daFareInGiornata, note: 'Da fare durante la giornata' })).success, true);
    const pubblicaConGiornata = (await fetch(`${base}/api/public/agenda/${agendaToken}?week=2026-10-05`).then(response => response.json())).impegni.filter(item => item.data === '2026-10-07');
    assert.equal(pubblicaConGiornata.at(-1)?.id, impegnoSenzaOrario.id);
    assert.equal(pubblicaConGiornata.at(-1)?.senzaOrario, true);
    assert.equal((await runFunction('salvaImpegnoAgenda', { ...daFareInGiornata, senzaOrario: false })).success, false);
    assert.equal((await runFunction('salvaImpegnoAgenda', { ...modifica, indirizzo: '' })).success, false);
    assert.equal((await runFunction('salvaImpegnoAgenda', { ...modifica, tipoImpegno: 'Ufficio', idCliente: 'NON-ESISTE', data: '2026-10-09' })).success, true);
    const ufficio = (await runFunction('recuperaDatiAgenda', 'D0002', '2026-10-05')).data.find(item => item.tipoImpegno === 'Ufficio');
    assert.equal(ufficio?.idCliente, null);
    assert.equal(ufficio?.cliente, 'Ufficio M2I');
    assert.equal(ufficio?.note, 'Impegno aggiornato');
    assert.equal((await runFunction('salvaImpegnoAgenda', { ...modifica, tipoImpegno: 'Acquisto prodotti', data: '2026-10-10', luogoAcquisto: 'Ferramenta Centro' })).success, true);
    assert.equal((await runFunction('salvaImpegnoAgenda', { ...modifica, tipoImpegno: 'Acquisto prodotti', data: '2026-10-11', luogoAcquisto: '' })).success, true);
    const acquisti = (await runFunction('recuperaDatiAgenda', 'D0002', '2026-10-05')).data.filter(item => item.tipoImpegno === 'Acquisto prodotti');
    assert.deepEqual(acquisti.map(item => item.luogoAcquisto).sort(), ['', 'Ferramenta Centro']);
    const acquistiPubblici = (await fetch(`${base}/api/public/agenda/${agendaToken}?week=2026-10-05`).then(response => response.json())).impegni.filter(item => item.tipoImpegno === 'Acquisto prodotti');
    assert.deepEqual(acquistiPubblici.map(item => item.luogoAcquisto).sort(), ['', 'Ferramenta Centro']);
    assert.equal((await runFunction('salvaImpegnoAgenda', { ...modifica, tipoImpegno: 'Appuntamento' })).success, false);
    const appuntamentoAgenda = { ...modifica, data: '2026-10-09', nomeReferente: 'Cliente prova', indirizzo: 'Via Milano 5' };
    assert.equal((await runFunction('salvaImpegnoAgenda', appuntamentoAgenda)).success, true);
    const impegnoAppuntamento = (await runFunction('recuperaDatiAgenda', 'D0002', '2026-10-05')).data.find(item => item.tipoImpegno === 'Sopralluogo' && item.data === '2026-10-09');
    let collegati = (await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).filter(item => item.agendaImpegnoId === impegnoAppuntamento.id);
    assert.equal(collegati.length, 1);
    assert.equal(collegati[0].nominativo, 'Cliente prova');
    assert.equal(collegati[0].dataOra, '2026-10-09T10:00');
    assert.equal(collegati[0].idCaposquadra, 'D0002');
    assert.equal((await runFunction('modificaImpegnoAgenda', impegnoAppuntamento.id, { ...appuntamentoAgenda, oraInizio: '11:00', nomeReferente: 'Cliente aggiornato' })).success, true);
    collegati = (await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).filter(item => item.agendaImpegnoId === impegnoAppuntamento.id);
    assert.equal(collegati.length, 1);
    assert.equal(collegati[0].nominativo, 'Cliente aggiornato');
    assert.equal(collegati[0].dataOra, '2026-10-09T11:00');
    const appointmentId = collegati[0].id;
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi/${appointmentId}/stato`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ stato: 'Esitato', esito: '' }) })).status, 400);
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi/${appointmentId}/stato`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ stato: 'Esitato', esito: 'Cliente interessato' }) })).status, 200);
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).find(item => item.id === appointmentId)?.esito, 'Cliente interessato');
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi/${appointmentId}/stato`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ stato: 'Annullato' }) })).status, 200);
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).find(item => item.id === appointmentId)?.stato, 'Annullato');
    assert.equal((await runFunction('recuperaDatiAgenda', 'D0002', '2026-10-05')).data.find(item => item.id === impegnoAppuntamento.id)?.statoAppuntamento, 'Annullato');
    assert.equal((await fetch(`${base}/api/public/agenda/${agendaToken}?week=2026-10-05`).then(response => response.json())).impegni.find(item => item.id === impegnoAppuntamento.id)?.statoAppuntamento, 'Annullato');
    const file = new FormData();
    file.append('file', new Blob(['%PDF-1.4\n%%EOF\n'], { type: 'application/pdf' }), 'offerta.pdf');
    file.append('numeroPreventivo', 'OFFERTA-TEST');
    const uploadQuote = await fetch(`${base}/api/appuntamenti-preventivi/${appointmentId}/preventivi`, { method: 'POST', headers: { Cookie: cookie }, body: file });
    assert.equal(uploadQuote.status, 201);
    const attachedQuote = await uploadQuote.json();
    assert.equal(attachedQuote.appuntamento_id, appointmentId);
    assert.equal(attachedQuote.numero_preventivo, 'OFFERTA-TEST');
    assert.equal((await fetch(`${base}/api/preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).find(item => item.id === attachedQuote.id)?.appuntamento_id, appointmentId);
    assert.equal((await fetch(`${base}${attachedQuote.allegato_preventivo}`, { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await fetch(`${base}/api/preventivi/${attachedQuote.id}/appuntamento`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ appuntamentoId: null }) })).status, 200);
    assert.equal((await fetch(`${base}/api/preventivi/${attachedQuote.id}/appuntamento`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ appuntamentoId: appointmentId }) })).status, 200);
    const generatedQuote = await fetch(`${base}/api/preventivi/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ragione_sociale_prospect: 'Cliente aggiornato', indirizzo_locali: 'Via Milano 5', servizi_inclusi: 'Pulizia locali', costo_mensile: 250, tipo_prezzo: 'Mensile', appuntamento_id: appointmentId }) });
    assert.equal(generatedQuote.status, 201);
    const generatedQuoteData = (await generatedQuote.json()).data;
    assert.equal(generatedQuoteData.appuntamento_id, appointmentId);
    assert.equal((await fetch(`${base}/api/preventivi/${generatedQuoteData.id}`, { method: 'DELETE' })).status, 401);
    assert.equal((await fetch(`${base}/api/preventivi/inesistente`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 404);
    assert.equal((await fetch(`${base}/api/preventivi/${generatedQuoteData.id}`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 204);
    assert.equal((await fetch(`${base}/api/preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).some(item => item.id === generatedQuoteData.id), false);
    assert.equal(fs.existsSync(path.join(temporaryDir, generatedQuoteData.allegato_preventivo.slice(1))), false);
    assert.equal((await fetch(`${base}/api/preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).some(item => item.id === attachedQuote.id), true);
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi/${collegati[0].id}`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 400);
    assert.equal((await runFunction('modificaImpegnoAgenda', impegnoAppuntamento.id, { ...appuntamentoAgenda, tipoImpegno: 'Ufficio' })).success, true);
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).some(item => item.agendaImpegnoId === impegnoAppuntamento.id), false);
    assert.equal((await fetch(`${base}/api/preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).find(item => item.id === attachedQuote.id)?.appuntamento_id, null);
    assert.equal((await runFunction('salvaImpegnoAgenda', { ...appuntamentoAgenda, data: '2026-10-10', senzaOrario: true, oraInizio: '', oraFine: '' })).success, true);
    const appuntamentoGiornata = (await runFunction('recuperaDatiAgenda', 'D0002', '2026-10-05')).data.find(item => item.tipoImpegno === 'Sopralluogo' && item.data === '2026-10-10');
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).find(item => item.agendaImpegnoId === appuntamentoGiornata.id)?.senzaOrario, 1);
    assert.equal((await runFunction('eliminaImpegnoAgenda', appuntamentoGiornata.id)).success, true);
    assert.equal((await fetch(`${base}/api/appuntamenti-preventivi`, { headers: { Cookie: cookie } }).then(response => response.json())).some(item => item.agendaImpegnoId === appuntamentoGiornata.id), false);
    assert.equal((await runFunction('salvaImpegnoAgenda', { ...modifica, tipoImpegno: 'Altro' })).success, false);
    const saveHours = async data => {
      const current = await runFunction('recuperaOreMensili', data.idDipendente, data.mese, data.anno);
      return runFunction('salvaPresenzeMensili', { ...data, revisione: current.data?.revisione });
    };
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
    // Exercise the actual multipart Excel path, including a zeroed locked column.
    await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path.join(temporaryDir, 'gestionale.db'));
      db.exec("INSERT INTO clienti(id,ragione_sociale,partita_iva) VALUES ('C_XL_LOCK','Cliente XL blindato','XL-LOCK'),('C_XL_OPEN','Cliente XL libero','XL-OPEN');", error => db.close(() => error ? reject(error) : resolve()));
    });
    const xlRow = (idCliente, hours) => ({ idCliente, causale: 'Ordinario', giorni: [hours, ...Array(30).fill(0)] });
    assert.equal((await saveHours({ idDipendente: employeeId, mese: 8, anno: 2026, righe: [xlRow('C_XL_LOCK', 3), xlRow('C_XL_OPEN', 2)] })).success, true);
    await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path.join(temporaryDir, 'gestionale.db'));
      db.exec("INSERT INTO righe_bloccate_elaborati(tipo,mese,anno,soggetto_id,snapshot,bloccata_at) VALUES ('cliente',8,2026,'C_XL_LOCK','{}','2026-09-30T00:00:00.000Z');", error => db.close(() => error ? reject(error) : resolve()));
    });
    const uploadHours = async lockedHours => {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Presenze');
      sheet.addRow(['Giorno', 'Cliente XL blindato', 'Cliente XL libero']);
      sheet.addRow([1, lockedHours, 4]);
      const state = (await runFunction('recuperaOreMensili', employeeId, 8, 2026)).data;
      const form = new FormData();
      form.append('dipendente_id', employeeId); form.append('mese', '8'); form.append('anno', '2026');
      form.append('revisione', state.revisione);
      form.append('file', new Blob([await wb.xlsx.writeBuffer()]), 'presenze.xlsx');
      return fetch(`${base}/api/excel/carica-presenze`, { method: 'POST', headers: { Cookie: cookie }, body: form });
    };
    assert.equal((await uploadHours(3)).status, 200);
    const importedHours = (await runFunction('recuperaOreMensili', employeeId, 8, 2026)).data;
    assert.deepEqual(importedHours.righe.map(r => [r.idCliente, r.ore_totali]), [['C_XL_LOCK', 3], ['C_XL_OPEN', 4]]);
    assert.equal((await uploadHours(0)).ok, false);
    assert.deepEqual((await runFunction('recuperaOreMensili', employeeId, 8, 2026)).data, importedHours);
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
    await mutateFixture(`INSERT INTO righe_bloccate_elaborati(tipo,mese,anno,soggetto_id,snapshot,bloccata_at) VALUES ('cliente',9,2026,'C_TEST','{"idCliente":"C_TEST","ragioneSociale":"Cliente collaudo","importoTotale":100}','${new Date().toISOString()}');`);
    const sent = await fetch(`${base}/api/contabilita/fatture/inviata`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ clienteId: 'C_TEST', mese: 9, anno: 2026 })
    });
    assert.equal(sent.status, 200);
    const sentUnlock = await fetch(`${base}/api/elaborati-workflow/cliente/2026/9/righe/C_TEST/sblocca`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{}'
    });
    assert.equal(sentUnlock.status, 400);
    assert.match((await sentUnlock.json()).error, /Fattura inviata/);
    const accounting = await fetch(`${base}/api/contabilita/cliente/2026/9`, { headers: { Cookie: cookie } });
    assert.equal(accounting.status, 200);
    const commissions = await fetch(`${base}/api/contabilita/provvigioni/2026/9`, { headers: { Cookie: cookie } });
    assert.equal(commissions.status, 200, `La rotta provvigioni non deve essere intercettata da /contabilita/:tipo/:anno/:mese: ${await commissions.clone().text()}`);
    assert.deepEqual(await commissions.json(), []);
    const sentRow = (await accounting.json()).find(row => row.idCliente === 'C_TEST');
    assert.ok(sentRow?.fatturaInviataAt);
    assert.deepEqual(sentRow.fatture, []);
    const report = await fetch(`${base}/api/contabilita/pdf/report-clienti/2026/9`, { headers: { Cookie: cookie } });
    assert.equal(report.status, 200);
    assert.match(report.headers.get('content-type'), /application\/pdf/);
    assert.equal(Buffer.from(await report.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
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
