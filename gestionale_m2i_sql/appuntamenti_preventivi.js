const { knex } = require('./db');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const STATI = ['Programmato', 'Svolto', 'Annullato', 'Esitato'];

async function ensureTable() {
  if (!await knex.schema.hasTable('appuntamenti_preventivi')) {
    await knex.schema.createTable('appuntamenti_preventivi', table => {
      table.increments('id').primary();
      table.string('data_ora', 16).notNullable();
      table.string('nominativo', 255).notNullable();
      table.string('attivita', 300).notNullable().defaultTo('');
      table.string('luogo', 500).notNullable().defaultTo('');
      table.text('note').notNullable().defaultTo('');
      table.string('stato', 20).notNullable().defaultTo('Programmato');
      table.text('esito').notNullable().defaultTo('');
      table.text('scheda_pdf');
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

function validate(body) {
  const dataOra = typeof body?.dataOra === 'string' ? body.dataOra.trim() : '';
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d$/.exec(dataOra);
  const date = match ? new Date(`${match[1]}T12:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]) {
    throw new Error('Data e ora non valide.');
  }
  const nominativo = typeof body.nominativo === 'string' ? body.nominativo.trim() : '';
  const luogo = typeof body.luogo === 'string' ? body.luogo.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const esito = typeof body.esito === 'string' ? body.esito.trim() : '';
  const stato = body.stato || 'Programmato';
  if (!nominativo || nominativo.length > 255) throw new Error('Inserisci un nominativo valido.');
  if (luogo.length > 500 || note.length > 2000) throw new Error('Luogo o note troppo lunghi.');
  if (!STATI.includes(stato)) throw new Error('Stato non valido.');
  if (esito.length > 2000) throw new Error('Esito troppo lungo.');
  if (stato === 'Esitato' && !esito) throw new Error('Inserisci l’esito dell’appuntamento.');
  return { data_ora: dataOra, nominativo, luogo, note, stato, esito: stato === 'Esitato' ? esito : '' };
}

async function list() {
  return knex('appuntamenti_preventivi as ap')
    .leftJoin('agenda_caposquadra as ag', 'ap.agenda_impegno_id', 'ag.id')
    .select('ap.id', 'ap.data_ora as dataOra', 'ap.nominativo', 'ap.attivita', 'ap.luogo', 'ap.note', 'ap.stato', 'ap.esito', 'ap.scheda_pdf as schedaPdf', 'ap.agenda_impegno_id as agendaImpegnoId', 'ap.senza_orario as senzaOrario', 'ag.dipendente_id as idCaposquadra')
    .orderBy('ap.data_ora', 'asc').orderBy('ap.id', 'asc');
}

async function create(body) {
  const [id] = await knex('appuntamenti_preventivi').insert(validate(body));
  return knex('appuntamenti_preventivi').where('id', id).first('id', 'data_ora as dataOra', 'nominativo', 'luogo', 'note', 'stato', 'esito');
}

async function createPublic(body, file) {
  const data = validate(body);
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
    const [id] = await knex('appuntamenti_preventivi').insert(data);
    return { id };
  } catch (error) {
    if (filePath) await fs.promises.rm(filePath, { force: true }).catch(() => {});
    throw error;
  }
}

async function update(id, body) {
  const existing = await knex('appuntamenti_preventivi').where('id', id).first('agenda_impegno_id');
  if (existing?.agenda_impegno_id) throw new Error('Modifica questo appuntamento dall’Agenda Caposquadra.');
  const count = await knex('appuntamenti_preventivi').where('id', id).update(validate(body));
  if (!count) return null;
  return knex('appuntamenti_preventivi').where('id', id).first('id', 'data_ora as dataOra', 'nominativo', 'luogo', 'note', 'stato', 'esito');
}

async function updateStatus(id, body) {
  const stato = body?.stato;
  const esito = typeof body?.esito === 'string' ? body.esito.trim() : '';
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
    attivita: (imp.attivita || '').trim(),
    luogo: (imp.indirizzo || '').trim(),
    note: (imp.note || '').trim(),
    senza_orario: Boolean(imp.senzaOrario)
  };
  const existing = await trx('appuntamenti_preventivi').where('agenda_impegno_id', agendaId).first('id');
  if (existing) await trx('appuntamenti_preventivi').where('id', existing.id).update(data);
  else await trx('appuntamenti_preventivi').insert({ ...data, agenda_impegno_id: agendaId, stato: 'Programmato' });
}

async function removeForAgenda(trx, agendaIds) {
  if (!agendaIds.length) return;
  const appuntamentoIds = (await trx('appuntamenti_preventivi').whereIn('agenda_impegno_id', agendaIds).select('id')).map(row => row.id);
  if (appuntamentoIds.length) await trx('preventivi').whereIn('appuntamento_id', appuntamentoIds).update({ appuntamento_id: null });
  await trx('appuntamenti_preventivi').whereIn('agenda_impegno_id', agendaIds).del();
}

module.exports = { ensureTable, list, create, createPublic, update, updateStatus, remove, syncFromAgenda, removeForAgenda };
