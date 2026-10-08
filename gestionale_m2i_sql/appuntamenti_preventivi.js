const { knex } = require('./db');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const marketingNotifications = require('./marketing_notifications');

const STATO_RICHIESTO_MARKETING = 'Richiesto da Marketing';
const STATI = [STATO_RICHIESTO_MARKETING, 'Da svolgere', 'Passato', 'Programmato', 'Svolto', 'Annullato', 'Esitato'];

function todayInRome() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function advancePastAppointments() {
  await knex('appuntamenti_preventivi').where('stato', 'Da svolgere').where('data_ora', '<', `${todayInRome()}T00:00`).update({ stato: 'Passato' });
}

async function ensureTable() {
  if (!await knex.schema.hasTable('appuntamenti_preventivi')) {
    await knex.schema.createTable('appuntamenti_preventivi', table => {
      table.increments('id').primary();
      table.string('data_ora', 16).notNullable();
      table.string('nominativo', 255).notNullable();
      table.string('referente', 255).notNullable().defaultTo('');
      table.string('telefono', 50).notNullable().defaultTo('');
      table.string('email', 254).notNullable().defaultTo('');
      table.string('incaricato', 200).notNullable().defaultTo('');
      table.string('commerciale_dipendente_id', 50);
      table.string('attivita', 300).notNullable().defaultTo('');
      table.string('luogo', 500).notNullable().defaultTo('');
      table.text('note').notNullable().defaultTo('');
      table.string('stato', 40).notNullable().defaultTo('Programmato');
      table.text('esito').notNullable().defaultTo('');
      table.text('scheda_pdf');
      table.boolean('origine_pubblica').notNullable().defaultTo(false);
      table.integer('numero_appuntamento').notNullable().defaultTo(1);
      table.integer('appuntamento_precedente_id');
      table.integer('agenda_impegno_id');
      table.boolean('senza_orario').notNullable().defaultTo(false);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.index('data_ora', 'idx_appuntamenti_preventivi_data');
    });
  } else {
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'agenda_impegno_id')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.integer('agenda_impegno_id'));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'senza_orario')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.boolean('senza_orario').notNullable().defaultTo(false));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'esito')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.text('esito').notNullable().defaultTo(''));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'attivita')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.string('attivita', 300).notNullable().defaultTo(''));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'scheda_pdf')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.text('scheda_pdf'));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'incaricato')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.string('incaricato', 200).notNullable().defaultTo(''));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'origine_pubblica')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.boolean('origine_pubblica').notNullable().defaultTo(false));
      // Le schede PDF degli appuntamenti esistenti potevano essere inviate solo dal link esterno.
      await knex('appuntamenti_preventivi').where('scheda_pdf', 'like', '/uploads/appuntamenti/%').update({ origine_pubblica: true });
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'commerciale_dipendente_id')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.string('commerciale_dipendente_id', 50));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'referente')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.string('referente', 255).notNullable().defaultTo(''));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'telefono')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.string('telefono', 50).notNullable().defaultTo(''));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'email')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.string('email', 254).notNullable().defaultTo(''));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'numero_appuntamento')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.integer('numero_appuntamento').notNullable().defaultTo(1));
    }
    if (!await knex.schema.hasColumn('appuntamenti_preventivi', 'appuntamento_precedente_id')) {
      await knex.schema.alterTable('appuntamenti_preventivi', table => table.integer('appuntamento_precedente_id'));
    }
  }
  if (!await knex.schema.hasTable('appuntamenti_note')) {
    await knex.schema.createTable('appuntamenti_note', table => {
      table.increments('id').primary();
      table.integer('appuntamento_id').notNullable().index();
      table.text('testo').notNullable();
      table.string('creata_il', 24).notNullable();
      table.string('autore', 254).notNullable().defaultTo('');
      table.boolean('visibile_pubblico').notNullable().defaultTo(true);
      table.string('tipo', 20).notNullable().defaultTo('post');
    });
    const noteEsistenti = await knex('appuntamenti_preventivi').where('origine_pubblica', true).whereNot('note', '').select('id', 'note', 'created_at');
    for (const item of noteEsistenti) {
      const timestamp = new Date(`${String(item.created_at).replace(' ', 'T').replace(/Z$/, '')}Z`);
      await knex('appuntamenti_note').insert({ appuntamento_id: item.id, testo: item.note, creata_il: Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString(), tipo: 'scheda' });
    }
  }
  if (!await knex.schema.hasColumn('appuntamenti_note', 'autore')) {
    await knex.schema.alterTable('appuntamenti_note', table => table.string('autore', 254).notNullable().defaultTo(''));
  }
  if (!await knex.schema.hasColumn('appuntamenti_note', 'visibile_pubblico')) {
    await knex.schema.alterTable('appuntamenti_note', table => table.boolean('visibile_pubblico').notNullable().defaultTo(true));
  }
  if (!await knex.schema.hasColumn('appuntamenti_note', 'tipo')) {
    await knex.schema.alterTable('appuntamenti_note', table => table.string('tipo', 20).notNullable().defaultTo('post'));
    // Solo la prima nota senza autore di una scheda Marketing era la copia della nota iniziale.
    await knex.raw(`UPDATE appuntamenti_note SET tipo = 'scheda' WHERE id IN (
      SELECT MIN(n.id) FROM appuntamenti_note n
      JOIN appuntamenti_preventivi ap ON ap.id = n.appuntamento_id
      WHERE ap.origine_pubblica = 1 AND ap.note <> '' AND n.autore = ''
      GROUP BY n.appuntamento_id
    )`);
  }
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_appuntamenti_preventivi_agenda ON appuntamenti_preventivi(agenda_impegno_id)');
  if (!await knex.schema.hasColumn('preventivi', 'appuntamento_id')) {
    await knex.schema.alterTable('preventivi', table => table.integer('appuntamento_id'));
  }
  await knex.transaction(async trx => {
    const vecchiAppuntamenti = await trx('agenda_caposquadra').where('tipo_impegno', 'Appuntamento');
    for (const imp of vecchiAppuntamenti) {
      const dettagli = {
        tipo_impegno: 'Sopralluogo',
        attivita: imp.attivita || 'Sopralluogo',
        nome_referente: imp.nome_referente || imp.nominativo_appuntamento || 'Da definire',
        indirizzo: imp.indirizzo || imp.luogo_appuntamento || ''
      };
      await trx('agenda_caposquadra').where('id', imp.id).update(dettagli);
      await syncFromAgenda(trx, imp.id, {
        data: imp.data, oraInizio: imp.ora_inizio, senzaOrario: !imp.ora_inizio,
        attivita: dettagli.attivita, nomeReferente: dettagli.nome_referente,
        indirizzo: dettagli.indirizzo, note: imp.note
      });
    }
    const sopralluoghiSenzaScheda = await trx('agenda_caposquadra as a')
      .leftJoin('appuntamenti_preventivi as ap', 'ap.agenda_impegno_id', 'a.id')
      .where('a.tipo_impegno', 'Sopralluogo').whereNull('ap.id').select('a.*');
    for (const imp of sopralluoghiSenzaScheda) {
      await syncFromAgenda(trx, imp.id, {
        data: imp.data, oraInizio: imp.ora_inizio, senzaOrario: !imp.ora_inizio,
        attivita: imp.attivita, nomeReferente: imp.nome_referente,
        indirizzo: imp.indirizzo, note: imp.note
      });
    }
  });
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_preventivi_appuntamento ON preventivi(appuntamento_id)');
}

function validateDataOra(value) {
  const dataOra = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d$/.exec(dataOra);
  const date = match ? new Date(`${match[1]}T12:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]) {
    throw new Error('Data e ora non valide.');
  }
  return dataOra;
}

function validate(body) {
  const dataOra = validateDataOra(body?.dataOra);
  const nominativo = typeof body.nominativo === 'string' ? body.nominativo.trim() : '';
  const referente = typeof body.referente === 'string' ? body.referente.trim() : '';
  const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const incaricato = typeof body.incaricato === 'string' ? body.incaricato.trim() : '';
  const luogo = typeof body.luogo === 'string' ? body.luogo.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const esito = typeof body.esito === 'string' ? body.esito.trim() : '';
  const stato = body.stato || 'Programmato';
  if (!nominativo || nominativo.length > 255) throw new Error('Inserisci un nominativo valido.');
  if (referente.length > 255) throw new Error('Il nome del referente è troppo lungo.');
  if (telefono.length > 50) throw new Error('Il numero di telefono è troppo lungo.');
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Inserisci un indirizzo email valido.');
  if (incaricato.length > 200) throw new Error('Il nome di chi svolge l’appuntamento è troppo lungo.');
  if (luogo.length > 500 || note.length > 2000) throw new Error('Luogo o note troppo lunghi.');
  if (!STATI.includes(stato)) throw new Error('Stato non valido.');
  if (esito.length > 2000) throw new Error('Esito troppo lungo.');
  if (stato === 'Esitato' && !esito) throw new Error('Inserisci l’esito dell’appuntamento.');
  return { data_ora: dataOra, nominativo, referente, telefono, email, incaricato, luogo, note, stato, esito: stato === 'Esitato' ? esito : '' };
}

async function list() {
  await advancePastAppointments();
  const rows = await knex('appuntamenti_preventivi as ap')
    .leftJoin('agenda_caposquadra as ag', 'ap.agenda_impegno_id', 'ag.id')
    .leftJoin('dipendenti as d', 'ag.dipendente_id', 'd.id')
    .select('ap.id', 'ap.data_ora as dataOra', 'ap.nominativo', 'ap.referente', 'ap.telefono', 'ap.email', 'ap.incaricato', 'ap.commerciale_dipendente_id as commercialeDipendenteId', 'ap.attivita', 'ap.luogo', 'ap.note', 'ap.stato', 'ap.esito', 'ap.scheda_pdf as schedaPdf', 'ap.origine_pubblica as marketing', 'ap.numero_appuntamento as numeroAppuntamento', 'ap.appuntamento_precedente_id as appuntamentoPrecedenteId', 'ap.agenda_impegno_id as agendaImpegnoId', 'ap.senza_orario as senzaOrario', 'ag.dipendente_id as idCaposquadra', 'd.cognome as cognomeCaposquadra', 'd.nome as nomeCaposquadra')
    .orderBy('ap.data_ora', 'asc').orderBy('ap.id', 'asc')
    .then(rows => rows.map(({ cognomeCaposquadra, nomeCaposquadra, ...row }) => ({
      ...row,
      incaricato: row.agendaImpegnoId ? `${cognomeCaposquadra || ''} ${nomeCaposquadra || ''}`.trim() : row.incaricato || ''
    })));
  return attachNotes(rows);
}

async function listPublic() {
  await advancePastAppointments();
  const rows = await knex('appuntamenti_preventivi as ap')
    .leftJoin('agenda_caposquadra as ag', 'ap.agenda_impegno_id', 'ag.id')
    .leftJoin('dipendenti as d', 'ag.dipendente_id', 'd.id')
    .where('ap.origine_pubblica', true)
    .select('ap.id', 'ap.data_ora as dataOra', 'ap.nominativo', 'ap.referente', 'ap.telefono', 'ap.email', 'ap.incaricato', 'ap.stato', 'ap.esito', 'ap.numero_appuntamento as numeroAppuntamento', 'ap.appuntamento_precedente_id as appuntamentoPrecedenteId', 'ap.agenda_impegno_id as agendaImpegnoId', 'd.cognome as cognomeCaposquadra', 'd.nome as nomeCaposquadra')
    .orderBy('ap.created_at', 'desc').orderBy('ap.id', 'desc')
    .then(rows => rows.map(({ agendaImpegnoId, cognomeCaposquadra, nomeCaposquadra, ...row }) => ({
      ...row,
      incaricato: agendaImpegnoId ? `${cognomeCaposquadra || ''} ${nomeCaposquadra || ''}`.trim() : row.incaricato || ''
    })));
  return attachNotes(rows, true);
}

async function attachNotes(rows, publicOnly = false) {
  if (!rows.length) return rows;
  const query = knex('appuntamenti_note').whereIn('appuntamento_id', rows.map(row => row.id));
  if (publicOnly) query.where('visibile_pubblico', true);
  const notes = await query
    .select('id', 'appuntamento_id as appuntamentoId', 'testo', 'creata_il as creataIl', 'autore', 'tipo')
    .orderBy('creata_il', 'asc').orderBy('id', 'asc');
  const byAppointment = new Map(rows.map(row => [row.id, []]));
  for (const note of notes) byAppointment.get(note.appuntamentoId)?.push(note);
  return rows.map(row => ({ ...row, noteStoriche: byAppointment.get(row.id) }));
}

async function promoteToMarketing(id) {
  const count = await knex('appuntamenti_preventivi').where('id', id).update({ origine_pubblica: true });
  return count ? { id: Number(id), marketing: true } : null;
}

async function acceptMarketing(id, body) {
  return knex.transaction(async trx => {
    const appointment = await trx('appuntamenti_preventivi').where('id', id).first();
    if (!appointment) return null;
    if (!appointment.origine_pubblica || appointment.stato !== STATO_RICHIESTO_MARKETING) {
      throw new Error('Solo un appuntamento richiesto da Marketing può essere accettato.');
    }
    if (appointment.agenda_impegno_id) throw new Error('L’appuntamento è già presente in agenda.');
    const tipo = body?.tipoCommerciale;
    let commercialeId = null;
    let nomeCommerciale;
    if (tipo === 'caposquadra') {
      commercialeId = typeof body.commercialeId === 'string' ? body.commercialeId.trim() : '';
      const dipendente = await trx('dipendenti').where({ id: commercialeId, is_caposquadra: 1 })
        .whereRaw("COALESCE(stato, '') <> 'Cessato' AND COALESCE(cestinato, 0) = 0").first('nome', 'cognome');
      if (!dipendente) throw new Error('Seleziona un caposquadra attivo.');
      nomeCommerciale = `${dipendente.cognome} ${dipendente.nome}`.trim();
      if (typeof body.inAgenda !== 'boolean') throw new Error('Scegli se inserire l’appuntamento nell’Agenda Caposquadra.');
    } else if (tipo === 'manuale') {
      nomeCommerciale = typeof body.commercialeNome === 'string' ? body.commercialeNome.trim() : '';
      if (!nomeCommerciale || nomeCommerciale.length > 200) throw new Error('Inserisci il nome del commerciale.');
      if (body.inAgenda) throw new Error('L’Agenda Caposquadra è disponibile solo per un caposquadra.');
    } else throw new Error('Seleziona un commerciale.');

    let agendaId = null;
    if (tipo === 'caposquadra' && body.inAgenda) {
      [agendaId] = await trx('agenda_caposquadra').insert(agendaFields(appointment, commercialeId, appointment.data_ora));
    }
    const stato = appointment.data_ora.slice(0, 10) < todayInRome() ? 'Passato' : 'Da svolgere';
    await trx('appuntamenti_preventivi').where('id', id).update({
      stato,
      incaricato: nomeCommerciale,
      commerciale_dipendente_id: commercialeId,
      agenda_impegno_id: agendaId
    });
    return { id: Number(id), stato, incaricato: nomeCommerciale, agendaImpegnoId: agendaId };
  });
}

function agendaFields(appointment, commercialeId, dataOra) {
  return {
    dipendente_id: commercialeId,
    data: dataOra.slice(0, 10),
    ora_inizio: dataOra.slice(11, 16),
    ora_fine: '',
    colore: '#4f46e5',
    tipo_impegno: 'Sopralluogo',
    attivita: appointment.attivita || 'Sopralluogo',
    nome_referente: appointment.referente || appointment.nominativo,
    indirizzo: appointment.luogo || '',
    note: appointment.note || ''
  };
}

async function reschedule(id, body) {
  const dataOra = validateDataOra(body?.dataOra);
  return knex.transaction(async trx => {
    const appointment = await trx('appuntamenti_preventivi').where('id', id).first();
    if (!appointment) return null;
    if (!['Programmato', 'Da svolgere', 'Passato'].includes(appointment.stato)) throw new Error('Puoi rifissare solo un appuntamento ancora da svolgere o da esitare.');
    const existingAgenda = appointment.agenda_impegno_id ? await trx('agenda_caposquadra').where('id', appointment.agenda_impegno_id).first('dipendente_id') : null;
    if (appointment.agenda_impegno_id && !existingAgenda) throw new Error('L’impegno in agenda non è più disponibile. Aggiorna la pagina e riprova.');
    const commercialeId = appointment.commerciale_dipendente_id || existingAgenda?.dipendente_id;
    const isCaposquadra = Boolean(commercialeId);
    if (isCaposquadra && typeof body?.inAgenda !== 'boolean') throw new Error('Scegli se inserire l’appuntamento nell’Agenda Caposquadra.');
    if (!isCaposquadra && body?.inAgenda) throw new Error('L’Agenda Caposquadra è disponibile solo per un caposquadra.');
    let agendaId = appointment.agenda_impegno_id;
    if (isCaposquadra && body.inAgenda) {
      const caposquadra = await trx('dipendenti').where({ id: commercialeId, is_caposquadra: 1 })
        .whereRaw("COALESCE(stato, '') <> 'Cessato' AND COALESCE(cestinato, 0) = 0").first('id');
      if (!caposquadra) throw new Error('Il caposquadra non è più attivo.');
      const fields = agendaFields(appointment, caposquadra.id, dataOra);
      if (agendaId) {
        const updated = await trx('agenda_caposquadra').where('id', agendaId).update(fields);
        if (!updated) throw new Error('L’impegno in agenda non è più disponibile. Aggiorna la pagina e riprova.');
      }
      else [agendaId] = await trx('agenda_caposquadra').insert(fields);
    } else if (agendaId) {
      await trx('appuntamenti_preventivi').where('id', id).update({ agenda_impegno_id: null });
      await trx('agenda_caposquadra').where('id', agendaId).del();
      agendaId = null;
    }
    const stato = dataOra.slice(0, 10) < todayInRome() ? 'Passato' : 'Da svolgere';
    await trx('appuntamenti_preventivi').where('id', id).update({ data_ora: dataOra, stato, esito: '', agenda_impegno_id: agendaId, commerciale_dipendente_id: commercialeId || null });
    return { id: Number(id), dataOra, stato, agendaImpegnoId: agendaId };
  });
}

async function conclude(id, action, body) {
  return knex.transaction(async trx => {
    const appointment = await trx('appuntamenti_preventivi').where('id', id).first();
    if (!appointment) return null;
    if (!['Programmato', 'Da svolgere', 'Passato'].includes(appointment.stato)) throw new Error('L’appuntamento non è più in lavorazione.');
    if (action === 'esita') {
      const esito = typeof body?.esito === 'string' ? body.esito.trim() : '';
      if (!esito || esito.length > 2000) throw new Error('Inserisci un esito valido.');
      await trx('appuntamenti_preventivi').where('id', id).update({ stato: 'Esitato', esito });
      return { id: Number(id), stato: 'Esitato', esito };
    }
    if (action === 'annulla') {
      await trx('appuntamenti_preventivi').where('id', id).update({ stato: 'Annullato', esito: '', agenda_impegno_id: null });
      if (appointment.agenda_impegno_id) await trx('agenda_caposquadra').where('id', appointment.agenda_impegno_id).del();
      return { id: Number(id), stato: 'Annullato' };
    }
    throw new Error('Azione non valida.');
  });
}

async function create(body) {
  const [id] = await knex('appuntamenti_preventivi').insert(validate(body));
  return knex('appuntamenti_preventivi').where('id', id).first('id', 'data_ora as dataOra', 'nominativo', 'referente', 'telefono', 'email', 'incaricato', 'luogo', 'note', 'stato', 'esito');
}

async function createPublic(body, file) {
  const data = validate({ ...body, stato: STATO_RICHIESTO_MARKETING, esito: '' });
  if (!data.referente) throw new Error('Inserisci il referente con cui parleremo.');
  if (!data.telefono) throw new Error('Inserisci il telefono del referente.');
  if (!data.email) throw new Error('Inserisci l’email del referente.');
  data.origine_pubblica = true;
  let filePath;
  if (file) {
    if (file.buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('Allega un PDF valido.');
    const dir = path.join(process.env.DATA_DIR || __dirname, 'uploads', 'appuntamenti');
    const fileName = `${crypto.randomUUID()}.pdf`;
    filePath = path.join(dir, fileName);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, file.buffer, { flag: 'wx' });
    data.scheda_pdf = `/uploads/appuntamenti/${fileName}`;
  }
  try {
    const id = await knex.transaction(async trx => {
      const [appointmentId] = await trx('appuntamenti_preventivi').insert(data);
      if (data.note) await trx('appuntamenti_note').insert({ appuntamento_id: appointmentId, testo: data.note, creata_il: new Date().toISOString(), tipo: 'scheda' });
      await marketingNotifications.record(trx, { appointmentId, type: 'appuntamento', company: data.nominativo });
      return appointmentId;
    });
    return { id };
  } catch (error) {
    if (filePath) await fs.promises.rm(filePath, { force: true }).catch(() => {});
    throw error;
  }
}

function validatePublicNote(body) {
  const testo = typeof body?.testo === 'string' ? body.testo.trim() : '';
  if (!testo || testo.length > 2000) throw new Error('Inserisci una nota valida (massimo 2000 caratteri).');
  return testo;
}

async function addPublicNote(id, body) {
  const testo = validatePublicNote(body);
  return knex.transaction(async trx => {
    const appointment = await trx('appuntamenti_preventivi').where({ id, origine_pubblica: true }).first('id', 'nominativo');
    if (!appointment) return null;
    const creataIl = new Date().toISOString();
    const [noteId] = await trx('appuntamenti_note').insert({ appuntamento_id: appointment.id, testo, creata_il: creataIl, autore: 'Marketing', visibile_pubblico: true, tipo: 'post' });
    await marketingNotifications.record(trx, { appointmentId: appointment.id, type: 'nota', company: appointment.nominativo, text: testo });
    return { id: noteId, appuntamentoId: appointment.id, testo, creataIl, autore: 'Marketing', tipo: 'post' };
  });
}

async function addInternalNote(id, body, author) {
  const testo = validatePublicNote(body);
  const autore = String(author || '').trim();
  if (!autore || autore.length > 254) throw new Error('Autore della nota non valido.');
  return knex.transaction(async trx => {
    const appointment = await trx('appuntamenti_preventivi').where('id', id).first('id');
    if (!appointment) return null;
    const creataIl = new Date().toISOString();
    const [noteId] = await trx('appuntamenti_note').insert({ appuntamento_id: appointment.id, testo, creata_il: creataIl, autore, visibile_pubblico: false, tipo: 'post' });
    return { id: noteId, appuntamentoId: appointment.id, testo, creataIl, autore, tipo: 'post' };
  });
}

async function rebookPublic(id, body) {
  const dataOra = validateDataOra(body?.dataOra);
  const testo = validatePublicNote(body);
  return knex.transaction(async trx => {
    const previous = await trx('appuntamenti_preventivi').where({ id, origine_pubblica: true }).first();
    if (!previous) return null;
    if (previous.stato !== 'Esitato') throw new Error('Puoi rifissare dal link solo un appuntamento esitato.');
    if (await trx('appuntamenti_preventivi').where('appuntamento_precedente_id', previous.id).first('id')) {
      throw new Error('Questo appuntamento è già stato rifissato. Usa la nuova scheda per continuare.');
    }
    const nextNumber = (previous.numero_appuntamento || 1) + 1;
    const [newId] = await trx('appuntamenti_preventivi').insert({
      data_ora: dataOra,
      nominativo: previous.nominativo,
      referente: previous.referente || '',
      telefono: previous.telefono || '',
      email: previous.email || '',
      incaricato: '',
      attivita: previous.attivita || '',
      luogo: previous.luogo || '',
      note: testo,
      stato: STATO_RICHIESTO_MARKETING,
      esito: '',
      origine_pubblica: true,
      numero_appuntamento: nextNumber,
      appuntamento_precedente_id: previous.id
    });
    await trx('appuntamenti_note').insert({ appuntamento_id: newId, testo, creata_il: new Date().toISOString(), tipo: 'scheda' });
    await marketingNotifications.record(trx, { appointmentId: newId, type: 'appuntamento', company: previous.nominativo });
    return { id: newId, stato: STATO_RICHIESTO_MARKETING, numeroAppuntamento: nextNumber, appuntamentoPrecedenteId: previous.id };
  });
}

async function update(id, body) {
  const existing = await knex('appuntamenti_preventivi').where('id', id).first('agenda_impegno_id', 'stato', 'origine_pubblica');
  if (existing?.agenda_impegno_id) throw new Error('Modifica questo appuntamento dall’Agenda Caposquadra.');
  if (existing?.origine_pubblica && ['Da svolgere', 'Passato', 'Esitato', 'Annullato'].includes(existing.stato)) throw new Error('Usa le azioni dell’appuntamento per aggiornare la richiesta Marketing.');
  if (existing?.stato === STATO_RICHIESTO_MARKETING && body?.stato !== STATO_RICHIESTO_MARKETING) throw new Error('Accetta prima la richiesta da Marketing.');
  if (existing && existing.stato !== STATO_RICHIESTO_MARKETING && body?.stato === STATO_RICHIESTO_MARKETING) throw new Error('La richiesta da Marketing è uno stato iniziale.');
  const count = await knex('appuntamenti_preventivi').where('id', id).update(validate(body));
  if (!count) return null;
  return knex('appuntamenti_preventivi').where('id', id).first('id', 'data_ora as dataOra', 'nominativo', 'referente', 'telefono', 'email', 'incaricato', 'luogo', 'note', 'stato', 'esito');
}

async function updateStatus(id, body) {
  const stato = body?.stato;
  const esito = typeof body?.esito === 'string' ? body.esito.trim() : '';
  const existing = await knex('appuntamenti_preventivi').where('id', id).first('stato', 'origine_pubblica');
  if (existing?.stato === STATO_RICHIESTO_MARKETING && stato !== STATO_RICHIESTO_MARKETING) throw new Error('Accetta prima la richiesta da Marketing.');
  if (existing && existing.stato !== STATO_RICHIESTO_MARKETING && stato === STATO_RICHIESTO_MARKETING) throw new Error('La richiesta da Marketing è uno stato iniziale.');
  if (existing?.origine_pubblica && ['Da svolgere', 'Passato', 'Esitato', 'Annullato'].includes(existing.stato)) throw new Error('Usa le azioni dell’appuntamento per cambiare stato.');
  if (!STATI.includes(stato)) throw new Error('Stato non valido.');
  if (esito.length > 2000 || (stato === 'Esitato' && !esito)) throw new Error('Inserisci un esito valido.');
  const count = await knex('appuntamenti_preventivi').where('id', id).update({ stato, esito: stato === 'Esitato' ? esito : '' });
  if (!count) return null;
  return knex('appuntamenti_preventivi').where('id', id).first('id', 'stato', 'esito');
}

async function remove(id) {
  const existing = await knex('appuntamenti_preventivi').where('id', id).first('agenda_impegno_id', 'scheda_pdf');
  if (existing?.agenda_impegno_id) throw new Error('Elimina questo appuntamento dall’Agenda Caposquadra.');
  const count = await knex.transaction(async trx => {
    await trx('preventivi').where('appuntamento_id', id).update({ appuntamento_id: null });
    await trx('appuntamenti_note').where('appuntamento_id', id).del();
    await trx('marketing_notifications').where('appuntamento_id', id).del();
    return trx('appuntamenti_preventivi').where('id', id).del();
  });
  if (count && /^\/uploads\/appuntamenti\/[0-9a-f-]+\.pdf$/.test(existing.scheda_pdf || '')) {
    const filePath = path.join(process.env.DATA_DIR || __dirname, 'uploads', 'appuntamenti', path.basename(existing.scheda_pdf));
    await fs.promises.rm(filePath, { force: true }).catch(error => console.error('PDF appuntamento non eliminato:', error));
  }
  return count;
}

async function syncFromAgenda(trx, agendaId, imp) {
  const data = {
    data_ora: `${imp.data}T${imp.senzaOrario ? '00:00' : imp.oraInizio}`,
    nominativo: (imp.nomeReferente || imp.attivita || 'Sopralluogo').trim(),
    referente: (imp.nomeReferente || '').trim(),
    attivita: (imp.attivita || '').trim(),
    luogo: (imp.indirizzo || '').trim(),
    note: (imp.note || '').trim(),
    senza_orario: Boolean(imp.senzaOrario)
  };
  const existing = await trx('appuntamenti_preventivi').where('agenda_impegno_id', agendaId).first('id', 'origine_pubblica');
  if (existing?.origine_pubblica && imp.idDipendente) {
    const dipendente = await trx('dipendenti').where('id', imp.idDipendente).first('nome', 'cognome');
    if (dipendente) {
      data.incaricato = `${dipendente.cognome} ${dipendente.nome}`.trim();
      data.commerciale_dipendente_id = imp.idDipendente;
    }
  }
  if (existing) await trx('appuntamenti_preventivi').where('id', existing.id).update(data);
  else await trx('appuntamenti_preventivi').insert({ ...data, agenda_impegno_id: agendaId, stato: 'Programmato' });
}

async function removeForAgenda(trx, agendaIds) {
  if (!agendaIds.length) return;
  const records = await trx('appuntamenti_preventivi').whereIn('agenda_impegno_id', agendaIds).select('id', 'origine_pubblica');
  const cancellati = records.filter(row => !row.origine_pubblica).map(row => row.id);
  const scollegati = records.filter(row => row.origine_pubblica).map(row => row.id);
  if (cancellati.length) {
    await trx('preventivi').whereIn('appuntamento_id', cancellati).update({ appuntamento_id: null });
    await trx('appuntamenti_preventivi').whereIn('id', cancellati).del();
  }
  if (scollegati.length) await trx('appuntamenti_preventivi').whereIn('id', scollegati).update({ agenda_impegno_id: null });
}

module.exports = { ensureTable, list, listPublic, promoteToMarketing, acceptMarketing, reschedule, conclude, create, createPublic, addPublicNote, addInternalNote, rebookPublic, update, updateStatus, remove, syncFromAgenda, removeForAgenda };
