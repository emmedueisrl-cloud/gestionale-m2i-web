const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const knexFactory = require('knex');
const { createReminderService } = require('../solleciti_fatture');

test('sollecito: mostra le fatture aperte, allega solo quelle scelte e aggiorna la seconda email dopo l’invio', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-reminder-'));
  const db = knexFactory({ client: 'sqlite3', connection: { filename: path.join(dataDir, 'test.db') }, useNullAsDefault: true });
  const sent = [];
  const rows = [
    { id: 'aruba:1', clienteId: 'C1', cliente: 'Cliente Uno', numero: '10/26', dataFattura: '2026-10-01', scadenza: '2026-10-31', residuo: 100, registrata: true, gestibile: true, tipoDocumento: 'TD01' },
    { id: 'aruba:2', clienteId: 'C1', cliente: 'Cliente Uno', numero: '11/26', dataFattura: '2026-10-02', scadenza: '2026-10-31', residuo: 200, registrata: true, gestibile: true, tipoDocumento: 'TD01' },
    { id: 'aruba:3', clienteId: 'C1', cliente: 'Cliente Uno', numero: '12/26', residuo: 0, registrata: true, gestibile: true, tipoDocumento: 'TD01' },
    { id: 'aruba:4', clienteId: 'C2', cliente: 'Cliente Due', numero: '13/26', residuo: 50, registrata: true, gestibile: true, tipoDocumento: 'TD01' }
  ];
  try {
    await db.schema.createTable('clienti', table => { table.text('id').primary(); table.text('ragione_sociale'); table.text('email'); table.text('email_secondaria'); });
    await db.schema.createTable('fatture_aruba_elaborati', table => { table.increments('id'); table.text('cliente_id'); table.text('fattura_id'); table.text('allegato_path'); });
    await db.schema.createTable('configurazione_email', table => { table.text('chiave'); table.text('valore'); });
    await db.schema.createTable('emails', table => { table.text('id'); table.text('data_invio'); table.text('mittente'); table.text('destinatario'); table.text('oggetto'); table.text('corpo'); table.text('tipo'); table.text('stato'); table.text('id_cliente'); table.text('cartella'); table.integer('letto'); table.text('allegati'); });
    await db('clienti').insert([{ id: 'C1', ragione_sociale: 'Cliente Uno', email: 'prima@example.it' }, { id: 'C2', ragione_sociale: 'Cliente Due' }]);
    const relative = path.join('uploads', 'fatture_aruba', '1.pdf');
    const file = path.join(dataDir, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '%PDF-1.4\n');
    await db('fatture_aruba_elaborati').insert([{ id: 1, cliente_id: 'C1', allegato_path: relative }, { id: 2, cliente_id: 'C1' }, { id: 3, cliente_id: 'C1' }, { id: 4, cliente_id: 'C2' }]);
    await db('configurazione_email').insert({ chiave: 'smtp_config', valore: JSON.stringify({ host: 'smtp.example.it', user: 'm2i@example.it' }) });
    const service = createReminderService(db, { list: async () => ({ fatture: rows }) }, { dataDir, createTransport: () => ({ sendMail: async payload => sent.push(payload) }) });
    const preview = await service.preview('aruba:1');
    assert.deepEqual(preview.fatture.map(row => row.id), ['aruba:1', 'aruba:2']);
    assert.equal(preview.fatture[0].allegabile, true);
    assert.equal(preview.fatture[1].allegabile, false);
    assert.equal(await db.schema.hasTable('solleciti_fatture_inviati'), false);
    const input = { fatture: ['aruba:1', 'aruba:2'], allegati: ['aruba:1'], destinatari: ['nuova@example.it'], cc: ['cc@example.it'], oggetto: 'Sollecito', corpo: 'Testo', aggiornamentoEmail: 'secondaria', nuovaEmail: 'nuova@example.it' };
    await assert.rejects(service.send({ ...input, fatture: ['aruba:1', 'aruba:4'] }), /non risultano più aperte/);
    await assert.rejects(service.send({ ...input, allegati: ['aruba:2'] }), /allegati selezionati/);
    assert.equal(sent.length, 0);
    const failedService = createReminderService(db, { list: async () => ({ fatture: rows }) }, { dataDir,
      createTransport: () => ({ sendMail: async () => { throw new Error('SMTP non disponibile'); } }) });
    await assert.rejects(failedService.send(input), /SMTP non disponibile/);
    assert.equal(Number((await db('solleciti_fatture_inviati').count('* as totale').first()).totale), 0);
    await service.send(input);
    assert.equal(sent[0].to, 'nuova@example.it');
    assert.equal(sent[0].cc, 'cc@example.it');
    assert.deepEqual(sent[0].attachments.map(item => item.path), [file]);
    assert.equal((await db('clienti').where({ id: 'C1' }).first()).email_secondaria, 'nuova@example.it');
    assert.equal((await db('emails').first()).stato, 'Inviata');
    assert.deepEqual((await db('solleciti_fatture_inviati').orderBy('fattura_id')).map(row => row.fattura_id), ['aruba:1', 'aruba:2']);
    await service.send({ ...input, fatture: ['aruba:1'], allegati: [] });
    const counts = await db('solleciti_fatture_inviati').select('fattura_id').count('* as totale').groupBy('fattura_id').orderBy('fattura_id');
    assert.deepEqual(counts.map(row => [row.fattura_id, Number(row.totale)]), [['aruba:1', 2], ['aruba:2', 1]]);
  } finally {
    await db.destroy(); fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
