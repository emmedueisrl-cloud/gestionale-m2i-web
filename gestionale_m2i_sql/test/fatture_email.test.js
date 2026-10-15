const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const knexFactory = require('knex');
const { createInvoiceEmailService } = require('../fatture_email');

test('email fattura: usa la mail ordinaria, allega il PDF e conserva la descrizione extra', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-invoice-email-'));
  const db = knexFactory({ client: 'sqlite3', connection: { filename: path.join(dataDir, 'test.db') }, useNullAsDefault: true });
  const sent = [];
  try {
    await db.schema.createTable('clienti', table => { table.text('id').primary(); table.text('ragione_sociale'); table.text('email'); table.text('email_secondaria'); table.text('pec'); table.text('causale_fattura'); });
    await db.schema.createTable('fatture_aruba_elaborati', table => { table.increments('id'); table.text('cliente_id'); table.integer('mese'); table.integer('anno'); table.text('numero_fattura'); table.text('allegato_path'); });
    await db.schema.createTable('gruppi_fatturazione_extra', table => { table.text('id'); table.integer('fattura_registrazione_id'); table.text('tipo'); table.text('nome'); });
    await db.schema.createTable('servizi_extra', table => { table.text('gruppo_id'); table.text('descrizione_fattura'); table.text('nome'); });
    await db.schema.createTable('descrizioni_fatture_elaborati', table => { table.text('tipo'); table.text('soggetto_id'); table.integer('mese'); table.integer('anno'); table.text('descrizione'); });
    await db.schema.createTable('configurazione_email', table => { table.text('chiave'); table.text('valore'); });
    await db.schema.createTable('emails', table => { table.text('id'); table.text('data_invio'); table.text('mittente'); table.text('destinatario'); table.text('oggetto'); table.text('corpo'); table.text('tipo'); table.text('stato'); table.text('id_cliente'); table.text('cartella'); table.integer('letto'); table.text('allegati'); });
    const relative = path.join('uploads', 'fatture_aruba', 'test.pdf');
    const file = path.join(dataDir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '%PDF-1.4\n');
    await db('clienti').insert({ id: 'C1', ragione_sociale: 'Cliente Test', email: 'pec@example.it', email_secondaria: 'ordinaria@example.it', pec: 'pec@example.it', causale_fattura: 'PULIZIA' });
    await db('fatture_aruba_elaborati').insert({ id: 1, cliente_id: 'C1', mese: 10, anno: 2026, numero_fattura: '123/26', allegato_path: relative });
    await db('gruppi_fatturazione_extra').insert({ id: 'G1', fattura_registrazione_id: 1, tipo: 'extra', nome: 'Intervento' });
    await db('descrizioni_fatture_elaborati').insert({ tipo: 'extra', soggetto_id: 'G1', mese: 10, anno: 2026, descrizione: 'Disinfestazione uffici' });
    await db('configurazione_email').insert({ chiave: 'smtp_config', valore: JSON.stringify({ host: 'smtp.example.it', port: 465, secure: true, user: 'm2i@example.it', pass: 'test' }) });
    const service = createInvoiceEmailService(db, { dataDir, createTransport: () => ({ sendMail: async payload => { sent.push(payload); } }) });
    const draft = await service.draft(1);
    assert.equal(draft.destinatario, 'ordinaria@example.it');
    assert.equal(draft.oggetto, 'Fattura per Disinfestazione uffici');
    await assert.rejects(service.send(1, { ...draft, destinatario: 'pec@example.it' }), /diverso dalla PEC/);
    assert.equal(sent.length, 0);
    await service.send(1, draft);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].attachments[0].path, file);
    assert.equal(sent[0].to, 'ordinaria@example.it');
    assert.equal((await db('emails').first()).stato, 'Inviata');
    await db('clienti').where('id', 'C1').update({ email: '', email_secondaria: '' });
    assert.equal((await service.draft(1)).destinatario, '');
    await service.send(1, { ...draft, destinatario: 'inserita@example.it' });
    assert.equal(sent[1].to, 'inserita@example.it');
    fs.rmSync(file);
    await assert.rejects(service.draft(1), /PDF.*non è disponibile/);
  } finally {
    await db.destroy();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
