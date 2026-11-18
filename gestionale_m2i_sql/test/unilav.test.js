const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const knexFactory = require('knex');
const { parseUnilav, createUnilavService } = require('../unilav');

const source = (section, worker = 'ROSSI', name = 'MARIO') => `Comunicazione Obbligatoria Unificato UniLav
Numero Protocollo01956401
Codice comunicazione0805826048617567
Data invio01/07/2026 12:04:44
Sezione 1 - Datore di lavoro
Codice Fiscale15989811003
DenominazioneM2I SRL
Sezione 2 - Lavoratore
Codice fiscaleRSSMRA73L68E958K
Cognome${worker}
Nome${name}
SessoM
Data di nascita28/07/1973
Comune di nascitaE958 - MARINO
Comune domicilioE392 - LABICO - 00030
Indirizzo domicilioVIA DEL COMUNE 15
${section}
Ente previdenziale01 - INPS
PatINAIL9603947533
CCNL2220 - PULIZIA
Livello Inquadramento000010 - 1
Tipo orarioP - TEMPO PARZIALE ORIZZONTALE
Ore settimanali medie8
Qualifica professionale6.1.5.1.0 - Addetto pulizie
Retribuzione3163
Sezione 9 - Dati invio`;

test('legge le cinque tipologie e usa le date operative nelle sezioni UNILAV', () => {
  const hire = parseUnilav(source('Sezione 4 - Inizio\nData inizio02/07/2026\nData fine07/08/2026\nTipologia contrattualeA.02.00 - LAVORO A TEMPO DETERMINATO'));
  assert.equal(hire.tipo, 'assunzione');
  assert.equal(hire.rapporto.dataOperazione, '2026-07-02');
  assert.equal(hire.rapporto.dataFine, '2026-08-07');
  assert.equal(hire.dipendente.dataNascita, '1973-07-28');
  assert.equal(hire.oraInvio, '12:04:44');
  const flags = parseUnilav(source('Sezione 4 - Inizio\nData inizio02/07/2026').replace('Sezione 9 - Dati invio',
    'Socio lavoratoreSI\nLavoratore in mobilitàNO\nSezione 9 - Dati invio\nTipo comunicazione01 - Comunicazione Obbligatoria\nAssunzione forza maggioreNO'));
  assert.equal(flags.socioLavoratore, 'SI');
  assert.equal(flags.lavoratoreMobilita, 'NO');
  assert.match(flags.tipoComunicazione, /Comunicazione Obbligatoria/);
  assert.equal(flags.assunzioneForzaMaggiore, 'NO');
  const extension = parseUnilav(source('Sezione 5 - Proroga\nData fine proroga/prosecuzione di\nfatto\n31/03/2027\nSezione 5.2 - Dati Rapporto\nData inizio10/07/2026'));
  assert.equal(extension.rapporto.dataOperazione, '2027-03-31');
  const change = parseUnilav(source('Sezione 6 - Trasformazione\nData trasformazione01/08/2026\nCodice trasformazioneDI - TEMPO INDETERMINATO'));
  assert.equal(change.tipo, 'trasformazione');
  const resignation = parseUnilav(source('Sezione 7 - Cessazione\nData cessazione16/11/2026\nMotivo cessazioneDI - DIMISSIONI'));
  assert.equal(resignation.rapporto.dataOperazione, '2026-11-16');
  assert.match(resignation.rapporto.motivoCessazione, /DIMISSIONI/);
  const trial = parseUnilav(source('Sezione 7 - Cessazione\nData cessazione25/07/2026\nMotivo cessazionePP - MANCATO SUPERAMENTO DEL PERIODO DI PROVA'));
  assert.match(trial.rapporto.motivoCessazione, /MANCATO SUPERAMENTO/);
});

test('anteprima non modifica dati; conferma crea, proroga, trasforma, cessa e allega il PDF', async t => {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2i-unilav-'));
  t.after(async () => { await db.destroy(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  await db.schema.createTable('dipendenti', table => {
    table.text('id').primary(); table.text('cognome'); table.text('nome');
    table.text('codice_fiscale').unique(); table.text('data_nascita'); table.text('comune_nascita');
    for (const name of ['indirizzo', 'citta', 'cap', 'telefono', 'email', 'iban', 'data_assunzione', 'scadenza',
      'livello_inquadramento', 'mansione', 'stato', 'divisione', 'tipo_paga', 'creato_da',
      'allegato_unilav', 'data_trasformazione_indeterminato', 'data_cessazione']) table.text(name);
    table.float('paga_oraria_reale'); table.integer('cestinato').defaultTo(0);
  });
  await db.schema.createTable('proroghe_contratti', table => {
    table.increments('id'); table.text('dipendente_id'); table.text('scadenza_precedente');
    table.text('nuova_scadenza'); table.text('note');
  });
  await db.schema.createTable('log_attivita', table => {
    table.increments('id'); for (const name of ['categoria', 'icona', 'colore', 'descrizione', 'eseguito_da']) table.text(name);
  });
  await db.schema.createTable('m2i_azienda_dati', table => { table.increments('id'); table.text('codice_fiscale'); });
  await db('m2i_azienda_dati').insert({ codice_fiscale: '15989811003' });
  const parsed = parseUnilav(source('Sezione 4 - Inizio\nData inizio02/07/2026\nData fine07/08/2026\nTipologia contrattualeA.02.00 - LAVORO A TEMPO DETERMINATO'));
  let current = parsed;
  const service = createUnilavService(db, dataDir, async () => current);
  await service.initialize();
  const buffer = Buffer.from('%PDF-test');
  const preview = await service.preview(buffer);
  assert.equal(preview.candidati.length, 0);
  assert.equal((await db('dipendenti').count('* as n').first()).n, 0);
  const draft = await service.saveDraft(buffer, 'assunzione.pdf', { mode: 'nuovo', nuovo: {
    cognome: 'ROSSI', nome: 'MARIO', codiceFiscale: parsed.dipendente.codiceFiscale, tipoPaga: ''
  } }, 'test');
  assert.equal((await service.listDrafts()).length, 1);
  assert.equal((await service.getDraft(draft.id)).values.nuovo.tipoPaga, '');
  assert.equal((await db('dipendenti').count('* as n').first()).n, 0);
  await service.updateDraft(draft.id, { mode: 'nuovo', nuovo: { tipoPaga: 'Oraria' } });
  assert.equal((await service.getDraft(draft.id)).values.nuovo.tipoPaga, 'Oraria');
  const saved = await service.confirmDraft(draft.id, { mode: 'nuovo', nuovo: {
    cognome: 'ROSSI', nome: 'MARIO', codiceFiscale: parsed.dipendente.codiceFiscale,
    divisione: 'Esterno', telefono: '123456789', tipoPaga: 'Oraria', retribuzione: '8.50'
  } }, 'test');
  assert.equal((await service.listDrafts()).length, 0);
  assert.equal(saved.dipendenteId, 'D0001');
  assert.equal((await db('dipendenti').where({ id: saved.dipendenteId }).first()).scadenza, '2026-08-07');
  const savedExtra = await db('unilav_dati_dipendenti').where({ dipendente_id: saved.dipendenteId }).first();
  assert.equal(JSON.parse(savedExtra.anagrafica_json).sesso, 'M');
  assert.equal(JSON.parse(savedExtra.anagrafica_json).livelloIstruzione, undefined);
  assert.equal(JSON.parse(savedExtra.rapporto_json).qualificaProfessionale, undefined);
  const savedCommunication = JSON.parse((await db('unilav_comunicazioni').first()).dati_json);
  assert.equal(savedCommunication.azienda, undefined);
  assert.equal(savedCommunication.oraInvio, '12:04:44');
  await db('dipendenti').where({ id: saved.dipendenteId }).update({ data_nascita: null, comune_nascita: null,
    indirizzo: null, citta: null, cap: null, livello_inquadramento: null });
  assert.equal(fs.existsSync(path.join(dataDir, saved.file)), true);
  assert.equal((await service.preview(buffer)).giaImportato.dipendenteId, saved.dipendenteId);
  await assert.rejects(service.confirm(buffer, { mode: 'nuovo', nuovo: {} }, 'test'), /già stato acquisito/);
  current = { ...parsed, codiceComunicazione: '0805826048617599',
    dipendente: { ...parsed.dipendente, cognome: 'ROSSO', codiceFiscale: 'RSSMRA73L68E958X' } };
  assert.equal((await service.preview(buffer)).candidati[0].match, 'Nome simile');

  current = { ...parsed, tipo: 'proroga', codiceComunicazione: '0805826048617568',
    rapporto: { ...parsed.rapporto, dataOperazione: '2027-03-31' } };
  const extensionPreview = await service.preview(buffer);
  assert.equal(extensionPreview.candidati[0].match, 'Codice fiscale esatto');
  assert.equal((await db('dipendenti').where({ id: saved.dipendenteId }).first()).scadenza, '2026-08-07');
  await service.confirm(buffer, { mode: 'esistente', dipendenteId: saved.dipendenteId }, 'test');
  const extended = await db('dipendenti').where({ id: saved.dipendenteId }).first();
  assert.equal(extended.scadenza, '2027-03-31');
  assert.equal(extended.data_nascita, '1973-07-28');
  assert.equal(extended.comune_nascita, 'MARINO');
  assert.equal(extended.indirizzo, 'VIA DEL COMUNE 15');
  assert.equal(extended.citta, 'LABICO');
  assert.equal(extended.cap, '00030');
  assert.equal(extended.livello_inquadramento, '000010 - 1');
  assert.equal((await db('proroghe_contratti').where({ dipendente_id: saved.dipendenteId }).first()).nuova_scadenza, '2027-03-31');
  current = { ...current, codiceComunicazione: '0805826048617571' };
  await service.confirm(buffer, { mode: 'esistente', dipendenteId: saved.dipendenteId }, 'test');
  assert.equal((await db('proroghe_contratti').where({ dipendente_id: saved.dipendenteId })).length, 1);

  current = { ...parsed, tipo: 'trasformazione', codiceComunicazione: '0805826048617569',
    rapporto: { ...parsed.rapporto, dataOperazione: '2027-04-01' } };
  await service.confirm(buffer, { mode: 'esistente', dipendenteId: saved.dipendenteId }, 'test');
  const transformed = await db('dipendenti').where({ id: saved.dipendenteId }).first();
  assert.equal(transformed.stato, 'Indeterminato');
  assert.equal(transformed.scadenza, null);

  current = { ...parsed, tipo: 'cessazione', codiceComunicazione: '0805826048617570',
    rapporto: { ...parsed.rapporto, dataOperazione: '2027-04-15', motivoCessazione: 'DI - DIMISSIONI' } };
  await service.confirm(buffer, { mode: 'esistente', dipendenteId: saved.dipendenteId }, 'test');
  const ended = await db('dipendenti').where({ id: saved.dipendenteId }).first();
  assert.equal(ended.stato, 'Cessato');
  assert.equal(ended.data_cessazione, '2027-04-15');
  assert.equal((await db('unilav_comunicazioni').where({ dipendente_id: saved.dipendenteId })).length, 5);
});
