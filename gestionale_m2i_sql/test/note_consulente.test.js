const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const knex = require('knex')({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true, pool: { min: 1, max: 1 } });

// Le prove usano solo un database temporaneo in memoria.
const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { knex } };
const workflow = require('../workflow_elaborati');
const consulenteEmail = require('../consulente_email');

before(async () => {
  const connection = await knex.client.acquireConnection();
  try {
    await new Promise((resolve, reject) => connection.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'), error => error ? reject(error) : resolve()));
  } finally { await knex.client.releaseConnection(connection); }
  await knex('dipendenti').insert([
    { id: 'D_TEST', cognome: 'ROSSI', nome: 'MARIA', codice_fiscale: 'TEST000000000001', data_assunzione: '2026-01-01', stato: 'Determinato' },
    { id: 'D_PROVA', cognome: 'BIANCHI', nome: 'LUCA', codice_fiscale: 'TEST000000000002', data_assunzione: '2026-01-01', stato: 'In Prova' }
  ]);
  await knex('righe_bloccate_elaborati').insert(['D_TEST', 'D_PROVA'].map(id => ({
    tipo: 'dipendente', mese: 9, anno: 2026, soggetto_id: id,
    snapshot: JSON.stringify({ idDipendente: id, cognomeNome: id === 'D_TEST' ? 'ROSSI MARIA' : 'BIANCHI LUCA', stipendioNetto: 1200 }),
    bloccata_at: new Date().toISOString()
  })));
});
after(() => knex.destroy());

test('la nota per consulente è separata dalle note dell’elaborato e si può aggiornare', async () => {
  await assert.rejects(workflow.saveConsultantNote({ mese: 9, anno: 2026, dipendenteId: 'D_ALTRO', testo: 'Test' }), /non presente/);
  await workflow.saveConsultantNote({ mese: 9, anno: 2026, dipendenteId: 'D_TEST', testo: '  Portare i documenti  ' });
  assert.equal((await workflow.accountingRows('dipendente', 9, 2026)).find(row => row.idDipendente === 'D_TEST').notaConsulente, 'Portare i documenti');
  await workflow.saveConsultantNote({ mese: 9, anno: 2026, dipendenteId: 'D_TEST', testo: 'Verificare il cedolino' });
  const rows = await workflow.accountingRows('dipendente', 9, 2026);
  assert.equal(rows.find(row => row.idDipendente === 'D_TEST').notaConsulente, 'Verificare il cedolino');
  assert.equal(rows.find(row => row.idDipendente === 'D_TEST').notaMensile, undefined);
  assert.equal(await knex('note_elaborati').where({ tipo: 'consulente', soggetto_id: 'D_TEST', mese: 9, anno: 2026 }).count('* as count').first().then(row => Number(row.count)), 1);
});

test('i dipendenti in prova non possono ricevere note per consulente', async () => {
  assert.equal((await workflow.accountingRows('dipendente', 9, 2026)).find(row => row.idDipendente === 'D_PROVA').inProva, true);
  await assert.rejects(workflow.saveConsultantNote({ mese: 9, anno: 2026, dipendenteId: 'D_PROVA', testo: 'Non consentita' }), /in prova/);
  assert.equal(await knex('note_elaborati').where({ tipo: 'consulente', soggetto_id: 'D_PROVA' }).first(), undefined);
});

test('i dipendenti in prova non mostrano busta paga o netto busta', async () => {
  await knex('buste_paga').insert({ id: 'BUSTA_PROVA', dipendente_id: 'D_PROVA', mese: '9', anno: '2026', importo_netto: 1000, allegato_busta_paga: 'prova.pdf' });
  const row = (await workflow.accountingRows('dipendente', 9, 2026)).find(item => item.idDipendente === 'D_PROVA');
  assert.equal(row.nettoBusta, null);
  assert.equal(row.allegatoBustaPaga, null);
});

test('la nota per ufficio paghe richiede la busta ed è indipendente dalla nota consulente', async () => {
  await assert.rejects(workflow.saveOfficePayrollNote({ mese: 9, anno: 2026, dipendenteId: 'D_TEST', testo: 'Verificare IBAN' }), /Busta paga non presente/);
  await knex('buste_paga').insert({ id: 'BUSTA_TEST', dipendente_id: 'D_TEST', mese: '9', anno: '2026', importo_netto: 1200 });
  await workflow.saveOfficePayrollNote({ mese: 9, anno: 2026, dipendenteId: 'D_TEST', testo: '  Verificare IBAN  ' });
  await workflow.saveOfficePayrollNote({ mese: 9, anno: 2026, dipendenteId: 'D_TEST', testo: 'Controllare bonifico' });
  const notes = await knex('note_elaborati').where({ soggetto_id: 'D_TEST', mese: 9, anno: 2026 });
  assert.equal(notes.find(note => note.tipo === 'ufficio_paghe').testo, 'Controllare bonifico');
  assert.equal(notes.find(note => note.tipo === 'consulente').testo, 'Verificare il cedolino');
});

test('CC è modificabile per dipendente e mese senza cambiare gli importi di stipendio', async () => {
  const original = (await workflow.accountingRows('dipendente', 9, 2026)).find(row => row.idDipendente === 'D_TEST');
  await assert.rejects(workflow.saveCcAmount({ mese: 9, anno: 2026, dipendenteId: 'D_ALTRO', importo: '10,00' }), /non presente/);
  await assert.rejects(workflow.saveCcAmount({ mese: 9, anno: 2026, dipendenteId: 'D_TEST', importo: '12,345' }), /massimo due decimali/);
  assert.deepEqual(await workflow.saveCcAmount({ mese: 9, anno: 2026, dipendenteId: 'D_TEST', importo: '123,45' }), { cc: 123.45 });
  let updated = (await workflow.accountingRows('dipendente', 9, 2026)).find(row => row.idDipendente === 'D_TEST');
  assert.equal(updated.cc, 123.45);
  assert.equal(updated.stipendioNetto, original.stipendioNetto);
  assert.equal(updated.nettoBusta, original.nettoBusta);
  assert.equal((await workflow.accountingRows('dipendente', 9, 2026)).find(row => row.idDipendente === 'D_PROVA').cc, null);
  await workflow.saveCcAmount({ mese: 9, anno: 2026, dipendenteId: 'D_TEST', importo: '0' });
  assert.equal((await workflow.accountingRows('dipendente', 9, 2026)).find(row => row.idDipendente === 'D_TEST').cc, 0);
  await workflow.saveCcAmount({ mese: 9, anno: 2026, dipendenteId: 'D_TEST', importo: '' });
  updated = (await workflow.accountingRows('dipendente', 9, 2026)).find(row => row.idDipendente === 'D_TEST');
  assert.equal(updated.cc, null);
});

test('Pagato per ufficio paghe salva una sola data e ora per busta', async () => {
  await assert.rejects(workflow.markOfficePayrollPaid({ bustaId: 'BUSTA_ASSENTE', userId: 1 }), /non trovata/);
  const first = await workflow.markOfficePayrollPaid({ bustaId: 'BUSTA_TEST', userId: 1 });
  assert.ok(!Number.isNaN(Date.parse(first.pagatoAt)));
  assert.deepEqual(await workflow.markOfficePayrollPaid({ bustaId: 'BUSTA_TEST', userId: 1 }), first);
  assert.equal((await knex('pagamenti_ufficio_paghe').where({ busta_id: 'BUSTA_TEST' })).length, 1);
});

test('email consulente salvata e PDF della tabella generato dal periodo', async () => {
  await assert.rejects(consulenteEmail.saveRecipient('indirizzo non valido'), /email valido/);
  await consulenteEmail.saveRecipient('simone@example.com');
  assert.deepEqual(await consulenteEmail.getRecipient(), { email: 'simone@example.com' });
  const pdf = await consulenteEmail.buildConsultantPdf(9, 2026);
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), '%PDF');
});

test('invio al consulente allega il PDF senza allegare le buste individuali', async () => {
  await knex('configurazione_email').insert({ chiave: 'smtp_config', valore: JSON.stringify({ host: 'smtp.example.invalid', port: 465, secure: true, user: 'ufficio@example.com', pass: 'test' }) });
  const nodemailer = require('nodemailer');
  const original = nodemailer.createTransport;
  let sent;
  nodemailer.createTransport = () => ({ sendMail: async message => { sent = message; } });
  try {
    await assert.rejects(consulenteEmail.send({ mese: 9, anno: 2026, destinatario: 'altro@example.com', oggetto: 'Test', corpo: 'Test' }), /corrispondere/);
    const result = await consulenteEmail.send({ mese: 9, anno: 2026, destinatario: 'simone@example.com', oggetto: 'Buste paga - Settembre 2026', corpo: 'Buongiorno Simone' });
    assert.equal(result.success, true);
    assert.equal(sent.to, 'simone@example.com');
    assert.equal(sent.attachments.length, 1);
    assert.equal(sent.attachments[0].filename, 'Per_consulente_Settembre_2026.pdf');
    assert.equal(Buffer.from(sent.attachments[0].content).subarray(0, 4).toString(), '%PDF');
    assert.equal((await knex('emails').where({ destinatario: 'simone@example.com' }).first()).stato, 'Inviata');
  } finally { nodemailer.createTransport = original; }
});
