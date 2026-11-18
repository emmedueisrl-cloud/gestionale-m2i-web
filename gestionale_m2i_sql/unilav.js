const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const pdfParse = require('pdf-parse');
const { ownerFolder } = require('./upload_paths');

const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const date = value => {
  const match = String(value || '').match(/(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})/);
  if (!match) return null;
  const result = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return validDate(result) ? result : null;
};
const field = (text, label) => {
  const escaped = label.replace(/[.*+?^$()|[\]{}]/g, '\\$&');
  return text.match(new RegExp(`^${escaped}\\s*([^\\n]*)`, 'im'))?.[1]?.trim() || '';
};
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const municipality = value => String(value || '').split(' - ').slice(1, 2)[0]?.trim() || String(value || '').trim();
const similarName = (first, second) => {
  const left = normalize(first), right = normalize(second);
  if (!left || !right) return 0;
  const costs = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let previous = costs[0]; costs[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const current = costs[j];
      costs[j] = Math.min(costs[j] + 1, costs[j - 1] + 1, previous + Number(left[i - 1] !== right[j - 1]));
      previous = current;
    }
  }
  return 1 - costs[right.length] / Math.max(left.length, right.length);
};
const extraPersonalKeys = ['sesso', 'cittadinanza', 'titoloSoggiorno', 'motivoSoggiorno',
  'scadenzaSoggiorno', 'numeroSoggiorno', 'questura'];
const extraWorkKeys = ['sedeLavoro', 'ccnl', 'tipoOrario', 'oreSettimanaliMedie',
  'entePrevidenziale', 'patInail', 'retribuzioneUnilav'];
const pickFields = (source, keys) => Object.fromEntries(keys.map(key => [key, source?.[key] || '']));

function parseUnilav(text) {
  const source = String(text || '').replace(/\r/g, '');
  if (!/Comunicazione Obbligatoria Unificato UniLav/i.test(source)) throw new Error('Il PDF non contiene una ricevuta UNILAV leggibile.');
  const workerSection = source.match(/Sezione 2 - Lavoratore([\s\S]*?)(?=Sezione [4567] - |$)/i)?.[1] || '';
  const companySection = source.match(/Sezione 1 - Datore di lavoro([\s\S]*?)(?=Sezione 2 - Lavoratore|$)/i)?.[1] || '';
  const operationMatch = source.match(/Sezione ([4567]) - (Inizio|Proroga|Trasformazione|Cessazione)/i);
  const type = { '4': 'assunzione', '5': 'proroga', '6': 'trasformazione', '7': 'cessazione' }[operationMatch?.[1]];
  if (!type) throw new Error('Tipo di comunicazione UNILAV non riconosciuto.');
  const operationSection = source.slice(operationMatch.index).split(/Sezione 9 - Dati invio/i)[0];
  const cf = field(workerSection, 'Codice fiscale').toUpperCase().replace(/\s/g, '');
  const surname = field(workerSection, 'Cognome');
  const name = field(workerSection, 'Nome');
  if (!/^[A-Z0-9]{16}$/.test(cf) || !surname || !name) throw new Error('Codice fiscale o nominativo del lavoratore non leggibile.');
  const extensionDate = operationSection.match(/Data fine proroga\/prosecuzione di\s*(?:fatto\s*)?(\d{1,2}\/\d{1,2}\/20\d{2})/i)?.[1];
  const transformation = field(operationSection, 'Codice trasformazione');
  const termination = field(operationSection, 'Motivo cessazione');
  const operationDate = type === 'assunzione' ? date(field(operationSection, 'Data inizio'))
    : type === 'proroga' ? date(extensionDate)
      : type === 'trasformazione' ? date(field(operationSection, 'Data trasformazione'))
        : date(field(operationSection, 'Data cessazione'));
  if (!operationDate) throw new Error('La data operativa della comunicazione non è leggibile.');
  const contract = field(operationSection, 'Tipologia contrattuale');
  if (type === 'trasformazione' && !/A\.01\.00|TEMPO INDETERMINATO/i.test(`${transformation} ${contract}`)) {
    throw new Error('Trasformazione diversa dal tempo indeterminato: verifica manuale necessaria.');
  }
  const domicile = field(workerSection, 'Comune domicilio');
  const education = workerSection.match(/Livello istruzione\s*\n?([^\n]*)(?:\n([^\n]*))?/i);
  const educationText = [education?.[1], education?.[2]].filter(Boolean).join(' ').trim();
  const workAddress = companySection.match(/Sede Lavoro\s*\nIndirizzo([^\n]+)/i)?.[1]?.trim() || '';
  const sentAt = field(source, 'Data invio');
  return {
    tipo: type, protocollo: field(source, 'Numero Protocollo'),
    codiceComunicazione: field(source, 'Codice comunicazione'),
    dataInvio: date(sentAt), oraInvio: sentAt.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/)?.[1] || '',
    tipoComunicazione: field(source, 'Tipo comunicazione'),
    socioLavoratore: field(source, 'Socio lavoratore'),
    lavoratoreMobilita: field(source, 'Lavoratore in mobilità'),
    assunzioneForzaMaggiore: field(source, 'Assunzione forza maggiore'),
    azienda: { codiceFiscale: field(companySection, 'Codice Fiscale'), denominazione: field(companySection, 'Denominazione') },
    dipendente: {
      codiceFiscale: cf, cognome: surname, nome: name,
      sesso: field(workerSection, 'Sesso'), cittadinanza: field(workerSection, 'Cittadinanza'),
      dataNascita: date(field(workerSection, 'Data di nascita')),
      comuneNascita: municipality(field(workerSection, 'Comune di nascita')),
      comuneDomicilio: domicile, indirizzoDomicilio: field(workerSection, 'Indirizzo domicilio'),
      livelloIstruzione: educationText,
      titoloSoggiorno: field(workerSection, 'Titolo di soggiorno'),
      motivoSoggiorno: field(workerSection, 'Motivo di soggiorno'),
      scadenzaSoggiorno: date(field(workerSection, 'Data scadenza titolo soggiorno')),
      numeroSoggiorno: field(workerSection, 'Numero titolo soggiorno'),
      questura: field(workerSection, 'Questura')
    },
    rapporto: {
      dataInizio: date(field(operationSection, 'Data inizio')),
      dataFine: date(field(operationSection, 'Data fine')),
      dataOperazione: operationDate,
      motivoCessazione: termination,
      codiceTrasformazione: transformation,
      tipologiaContrattuale: contract,
      entePrevidenziale: field(operationSection, 'Ente previdenziale'),
      patInail: field(operationSection, 'PatINAIL'),
      ccnl: field(operationSection, 'CCNL'),
      livelloInquadramento: field(operationSection, 'Livello Inquadramento'),
      tipoOrario: field(operationSection, 'Tipo orario'),
      oreSettimanaliMedie: field(operationSection, 'Ore settimanali medie'),
      qualificaProfessionale: field(operationSection, 'Qualifica professionale'),
      retribuzioneUnilav: field(operationSection, 'Retribuzione'),
      sedeLavoro: workAddress
    }
  };
}

async function parsePdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100 || buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error('Carica un PDF UNILAV valido.');
  }
  const result = await pdfParse(buffer);
  return parseUnilav(result.text);
}

function createUnilavService(knex, dataDir, extractDocument = parsePdf) {
  async function initialize() {
    if (!await knex.schema.hasTable('unilav_dati_dipendenti')) await knex.schema.createTable('unilav_dati_dipendenti', table => {
      table.text('dipendente_id').primary().references('id').inTable('dipendenti').onDelete('CASCADE');
      table.text('anagrafica_json').notNullable();
      table.text('rapporto_json').notNullable();
      table.text('aggiornato_at').notNullable();
    });
    if (!await knex.schema.hasTable('unilav_comunicazioni')) await knex.schema.createTable('unilav_comunicazioni', table => {
      table.text('codice_comunicazione').primary();
      table.text('dipendente_id').notNullable().references('id').inTable('dipendenti').onDelete('CASCADE');
      table.text('tipo').notNullable();
      table.text('data_operazione').notNullable();
      table.text('motivo');
      table.text('protocollo');
      table.text('file_path');
      table.text('file_name');
      table.text('confermata_at').notNullable();
      table.text('confermata_da');
      table.text('dati_json').notNullable();
    });
    if (!await knex.schema.hasTable('unilav_bozze')) await knex.schema.createTable('unilav_bozze', table => {
      table.text('id').primary();
      table.text('codice_comunicazione').notNullable().unique();
      table.text('codice_fiscale').notNullable();
      table.text('nome').notNullable();
      table.text('cognome').notNullable();
      table.text('data_operazione');
      table.text('file_name').notNullable();
      table.text('dati_json').notNullable();
      table.text('creata_at').notNullable();
      table.text('aggiornata_at').notNullable();
      table.text('creata_da');
    });
    // Allinea le comunicazioni acquisite prima dell'introduzione dei campi dedicati.
    for (const row of await knex('unilav_dati_dipendenti').select('*')) {
      let personal, work;
      try { personal = JSON.parse(row.anagrafica_json); work = JSON.parse(row.rapporto_json); } catch { continue; }
      const employee = await knex('dipendenti').where({ id: row.dipendente_id }).first();
      if (employee) {
        const domicileParts = String(personal.comuneDomicilio || '').split(/\s+-\s+/).map(value => value.trim());
        const domicileCity = /^[A-Z]\d{3}$/i.test(domicileParts[0] || '') ? domicileParts[1] : domicileParts[0];
        const missing = { data_nascita: personal.dataNascita, comune_nascita: personal.comuneNascita,
          indirizzo: personal.indirizzoDomicilio, citta: domicileCity, cap: domicileParts.find(value => /^\d{5}$/.test(value)),
          livello_inquadramento: work.livelloInquadramento };
        const fill = Object.fromEntries(Object.entries(missing).filter(([key, value]) => value && !employee[key]));
        if (Object.keys(fill).length) await knex('dipendenti').where({ id: row.dipendente_id }).update(fill);
      }
      const cleanedPersonal = pickFields(personal, extraPersonalKeys);
      const cleanedWork = pickFields(work, extraWorkKeys);
      if (JSON.stringify(personal) !== JSON.stringify(cleanedPersonal) || JSON.stringify(work) !== JSON.stringify(cleanedWork)) {
        await knex('unilav_dati_dipendenti').where({ dipendente_id: row.dipendente_id }).update({
          anagrafica_json: JSON.stringify(cleanedPersonal), rapporto_json: JSON.stringify(cleanedWork) });
      }
    }
    for (const row of await knex('unilav_comunicazioni').select('codice_comunicazione', 'dati_json')) {
      let details;
      try { details = JSON.parse(row.dati_json); } catch { continue; }
      if (!details.azienda && !details.dipendente?.livelloIstruzione && !details.rapporto?.qualificaProfessionale) continue;
      delete details.azienda;
      if (details.dipendente) delete details.dipendente.livelloIstruzione;
      if (details.rapporto) delete details.rapporto.qualificaProfessionale;
      await knex('unilav_comunicazioni').where({ codice_comunicazione: row.codice_comunicazione })
        .update({ dati_json: JSON.stringify(details) });
    }
  }

  const draftPath = id => {
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('Bozza non valida.');
    return path.join(dataDir, 'unilav-bozze', `${id}.pdf`);
  };
  const draftData = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dati della bozza non validi.');
    const result = JSON.stringify(value);
    if (result.length > 100000) throw new Error('La bozza contiene troppi dati.');
    return result;
  };

  async function listDrafts() {
    return knex('unilav_bozze').select('id', 'codice_comunicazione as codiceComunicazione',
      'codice_fiscale as codiceFiscale', 'nome', 'cognome', 'data_operazione as dataOperazione',
      'file_name as fileName', 'creata_at as creataAt', 'aggiornata_at as aggiornataAt')
      .orderBy('aggiornata_at', 'desc');
  }

  async function saveDraft(buffer, fileName, values, userId) {
    const parsed = await extractDocument(buffer);
    if (parsed.tipo !== 'assunzione') throw new Error('Le bozze sono disponibili per gli UNILAV di assunzione.');
    if (!parsed.codiceComunicazione || !/^\d{8,30}$/.test(parsed.codiceComunicazione)) throw new Error('Codice comunicazione UNILAV non leggibile.');
    if (await knex('unilav_comunicazioni').where({ codice_comunicazione: parsed.codiceComunicazione }).first()) {
      throw new Error('Questo UNILAV è già stato acquisito.');
    }
    const dati = draftData(values);
    const now = new Date().toISOString();
    const existing = await knex('unilav_bozze').where({ codice_comunicazione: parsed.codiceComunicazione }).first();
    if (existing) {
      await knex('unilav_bozze').where({ id: existing.id }).update({ dati_json: dati, aggiornata_at: now });
      return { id: existing.id };
    }
    const id = crypto.randomUUID();
    const destination = draftPath(id);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, buffer, { flag: 'wx' });
    try {
      await knex('unilav_bozze').insert({
        id, codice_comunicazione: parsed.codiceComunicazione,
        codice_fiscale: parsed.dipendente.codiceFiscale,
        nome: parsed.dipendente.nome, cognome: parsed.dipendente.cognome,
        data_operazione: parsed.rapporto.dataOperazione,
        file_name: path.basename(String(fileName || 'UNILAV.pdf')).slice(0, 200),
        dati_json: dati, creata_at: now, aggiornata_at: now, creata_da: String(userId || '')
      });
    } catch (error) {
      await fs.unlink(destination).catch(() => {});
      throw error;
    }
    return { id };
  }

  async function updateDraft(id, values) {
    const updated = await knex('unilav_bozze').where({ id }).update({ dati_json: draftData(values), aggiornata_at: new Date().toISOString() });
    if (!updated) throw new Error('Bozza non trovata.');
    return { id };
  }

  async function getDraft(id) {
    const row = await knex('unilav_bozze').where({ id }).first();
    if (!row) throw new Error('Bozza non trovata.');
    const buffer = await fs.readFile(draftPath(id));
    return { id, values: JSON.parse(row.dati_json), preview: await preview(buffer), fileName: row.file_name };
  }

  async function deleteDraft(id) {
    const deleted = await knex('unilav_bozze').where({ id }).delete();
    if (!deleted) throw new Error('Bozza non trovata.');
    await fs.unlink(draftPath(id)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    return { id };
  }

  async function confirmDraft(id, options, userId) {
    const row = await knex('unilav_bozze').where({ id }).first();
    if (!row) throw new Error('Bozza non trovata.');
    const buffer = await fs.readFile(draftPath(id));
    const result = await confirm(buffer, options, userId);
    await deleteDraft(id).catch(() => {});
    return result;
  }

  async function preview(buffer) {
    const parsed = await extractDocument(buffer);
    const company = await knex.schema.hasTable('m2i_azienda_dati')
      ? await knex('m2i_azienda_dati').whereNotNull('codice_fiscale').first() : null;
    const existing = parsed.codiceComunicazione
      ? await knex('unilav_comunicazioni').where({ codice_comunicazione: parsed.codiceComunicazione }).first() : null;
    const employees = await knex('dipendenti').where('cestinato', 0)
      .select('id', 'nome', 'cognome', 'codice_fiscale', 'data_nascita', 'stato', 'data_assunzione', 'scadenza', 'data_cessazione', 'indirizzo', 'cap', 'citta', 'mansione');
    const ranked = employees.map(row => {
      const exact = normalize(row.codice_fiscale) === normalize(parsed.dipendente.codiceFiscale);
      const name = normalize(`${row.cognome} ${row.nome}`);
      const wanted = normalize(`${parsed.dipendente.cognome} ${parsed.dipendente.nome}`);
      const sameName = name === wanted;
      const surname = normalize(row.cognome) === normalize(parsed.dipendente.cognome);
      const nearName = similarName(name, wanted) >= 0.8;
      const sameBirthDate = Boolean(parsed.dipendente.dataNascita && row.data_nascita === parsed.dipendente.dataNascita);
      const score = exact ? 100 : sameName ? 70 : surname ? 35 : nearName ? 20 + Number(sameBirthDate) * 15 : 0;
      return { id: row.id, nome: row.nome, cognome: row.cognome, codiceFiscale: row.codice_fiscale,
        stato: row.stato, dataAssunzione: row.data_assunzione, scadenza: row.scadenza,
        dataCessazione: row.data_cessazione, score, match: exact ? 'Codice fiscale esatto' : sameName ? 'Nome e cognome' : surname ? 'Cognome' : nearName ? 'Nome simile' : 'Nessuna corrispondenza' };
    }).filter(row => row.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
    return { unilav: parsed, candidati: ranked,
      aziendaDiversa: Boolean(company?.codice_fiscale &&
        normalize(company.codice_fiscale) !== normalize(parsed.azienda.codiceFiscale)),
      dipendenti: employees.map(row => ({ id: row.id, nome: row.nome, cognome: row.cognome,
        codiceFiscale: row.codice_fiscale, stato: row.stato, dataAssunzione: row.data_assunzione,
        scadenza: row.scadenza, dataCessazione: row.data_cessazione,
        indirizzo: row.indirizzo, cap: row.cap, citta: row.citta, mansione: row.mansione })),
      giaImportato: existing ? { dipendenteId: existing.dipendente_id, tipo: existing.tipo } : null };
  }

  async function confirm(buffer, options, userId) {
    const parsed = await extractDocument(buffer);
    if (!parsed.codiceComunicazione || !/^\d{8,30}$/.test(parsed.codiceComunicazione)) throw new Error('Codice comunicazione UNILAV non leggibile.');
    const mode = options?.mode;
    if (!['nuovo', 'esistente'].includes(mode)) throw new Error('Seleziona una scheda dipendente.');
    if (mode === 'nuovo' && parsed.tipo !== 'assunzione') throw new Error('Solo un UNILAV di assunzione può creare una nuova scheda.');
    if (!dataDir || !path.isAbsolute(dataDir)) throw new Error('Archivio documenti non disponibile.');
    if (await knex.schema.hasTable('m2i_azienda_dati')) {
      const company = await knex('m2i_azienda_dati').whereNotNull('codice_fiscale').first();
      if (company?.codice_fiscale && normalize(company.codice_fiscale) !== normalize(parsed.azienda.codiceFiscale)) {
        throw new Error('Il datore di lavoro dell’UNILAV non coincide con l’azienda del gestionale.');
      }
    }
    let savedPath;
    try {
      const result = await knex.transaction(async trx => {
        if (await trx('unilav_comunicazioni').where({ codice_comunicazione: parsed.codiceComunicazione }).first()) {
          throw new Error('Questo UNILAV è già stato acquisito.');
        }
        let employee;
        let id = options?.dipendenteId;
        if (mode === 'nuovo') {
          const draft = options?.nuovo || {};
          const codiceFiscale = String(draft.codiceFiscale || '').trim().toUpperCase();
          if (codiceFiscale !== parsed.dipendente.codiceFiscale) throw new Error('Il codice fiscale deve coincidere con l’UNILAV.');
          if (await trx('dipendenti').where({ codice_fiscale: codiceFiscale }).first()) throw new Error('Dipendente già presente con questo codice fiscale.');
          const cognome = String(draft.cognome || '').trim();
          const nome = String(draft.nome || '').trim();
          if (!cognome || !nome) throw new Error('Completa nome e cognome.');
          const retribuzione = Number(draft.retribuzione);
          if (!['Oraria', 'Mensile'].includes(draft.tipoPaga) || !Number.isFinite(retribuzione) || retribuzione <= 0) {
            throw new Error('Compila tipo paga e importo retributivo prima di salvare.');
          }
          const assunzione = parsed.rapporto.dataOperazione;
          const scadenza = parsed.rapporto.dataFine;
          if (scadenza && scadenza <= assunzione) throw new Error('Scadenza contrattuale non valida.');
          const rows = await trx('dipendenti').select('id');
          const max = rows.reduce((value, row) => Math.max(value, Number(/^D(\d+)$/.exec(row.id)?.[1] || 0)), 0);
          id = `D${String(max + 1).padStart(4, '0')}`;
          await trx('dipendenti').insert({
            id, cognome, nome, codice_fiscale: codiceFiscale,
            data_nascita: parsed.dipendente.dataNascita,
            comune_nascita: parsed.dipendente.comuneNascita,
            indirizzo: String(draft.indirizzo || '').trim() || null,
            citta: String(draft.citta || '').trim() || null,
            cap: String(draft.cap || '').trim() || null,
            telefono: String(draft.telefono || '').trim() || null,
            email: String(draft.email || '').trim() || null,
            iban: String(draft.iban || '').trim() || null,
            data_assunzione: assunzione, scadenza,
            livello_inquadramento: parsed.rapporto.livelloInquadramento || null,
            mansione: String(draft.mansione || '').trim() || null,
            stato: /A\.01\.00|TEMPO INDETERMINATO/i.test(parsed.rapporto.tipologiaContrattuale) ? 'Indeterminato' : 'Determinato',
            divisione: draft.divisione === 'Interno' ? 'Interno' : 'Esterno',
            tipo_paga: draft.tipoPaga, paga_oraria_reale: retribuzione,
            creato_da: 'UNILAV'
          });
          employee = await trx('dipendenti').where({ id }).first();
        } else {
          employee = await trx('dipendenti').where({ id, cestinato: 0 }).first();
          if (!employee) throw new Error('Dipendente selezionato non trovato.');
          if (normalize(employee.codice_fiscale) !== parsed.dipendente.codiceFiscale &&
            options?.confermaCodiceFiscaleDifferente !== true) {
            throw new Error('Il codice fiscale del dipendente differisce dall’UNILAV: serve una conferma esplicita.');
          }
          const when = parsed.rapporto.dataOperazione;
          if (parsed.tipo === 'proroga') {
            const historical = employee.scadenza && when <= employee.scadenza;
            if (!historical && (employee.stato === 'Cessato' || employee.stato === 'Indeterminato')) {
              throw new Error('Non si può prorogare un rapporto cessato o indeterminato.');
            }
            if (!await trx('proroghe_contratti').where({ dipendente_id: id, nuova_scadenza: when }).first()) {
              await trx('proroghe_contratti').insert({ dipendente_id: id, scadenza_precedente: employee.scadenza, nuova_scadenza: when, note: `UNILAV ${parsed.codiceComunicazione}` });
            }
            if (!historical) await trx('dipendenti').where({ id }).update({ scadenza: when });
          } else if (parsed.tipo === 'trasformazione') {
            if (employee.stato === 'Cessato') throw new Error('Il rapporto è già cessato.');
            await trx('dipendenti').where({ id }).update({ stato: 'Indeterminato', scadenza: null, data_trasformazione_indeterminato: when });
          } else if (parsed.tipo === 'cessazione') {
            if (employee.stato === 'Cessato' && employee.data_cessazione && employee.data_cessazione !== when) {
              throw new Error('Il dipendente è già cessato con una data diversa.');
            }
            await trx('dipendenti').where({ id }).update({ stato: 'Cessato', data_cessazione: when });
          } else if (parsed.tipo === 'assunzione') {
            if (employee.data_assunzione !== when) throw new Error('L’assunzione esistente ha una data diversa: verifica la scheda manualmente.');
          }
          const domicileParts = String(parsed.dipendente.comuneDomicilio || '').split(/\s+-\s+/).map(value => value.trim());
          const domicileCity = /^[A-Z]\d{3}$/i.test(domicileParts[0] || '') ? domicileParts[1] : domicileParts[0];
          const domicileCap = domicileParts.find(value => /^\d{5}$/.test(value));
          const missing = { data_nascita: parsed.dipendente.dataNascita, comune_nascita: parsed.dipendente.comuneNascita,
            indirizzo: parsed.dipendente.indirizzoDomicilio, citta: domicileCity, cap: domicileCap,
            livello_inquadramento: parsed.rapporto.livelloInquadramento };
          const fill = Object.fromEntries(Object.entries(missing).filter(([key, value]) => value && !employee[key]));
          if (Object.keys(fill).length) await trx('dipendenti').where({ id }).update(fill);
        }
        const oldExtra = await trx('unilav_dati_dipendenti').where({ dipendente_id: id }).first();
        const merge = (old, next) => ({ ...old, ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== null && value !== '')) });
        const personal = pickFields(parsed.dipendente, extraPersonalKeys);
        const work = pickFields(parsed.rapporto, extraWorkKeys);
        const communicationData = { ...parsed, dipendente: { ...parsed.dipendente }, rapporto: { ...parsed.rapporto } };
        delete communicationData.azienda;
        delete communicationData.dipendente.livelloIstruzione;
        delete communicationData.rapporto.qualificaProfessionale;
        const anagrafica = merge(pickFields(oldExtra ? JSON.parse(oldExtra.anagrafica_json) : {}, extraPersonalKeys), personal);
        const rapporto = work;
        const extraRow = { anagrafica_json: JSON.stringify(anagrafica), rapporto_json: JSON.stringify(rapporto), aggiornato_at: new Date().toISOString() };
        if (oldExtra) await trx('unilav_dati_dipendenti').where({ dipendente_id: id }).update(extraRow);
        else await trx('unilav_dati_dipendenti').insert({ dipendente_id: id, ...extraRow });

        const dir = path.join(dataDir, 'uploads', ownerFolder(id));
        await fs.mkdir(dir, { recursive: true });
        const filename = `UNILAV_${parsed.tipo}_${parsed.codiceComunicazione}_${crypto.randomBytes(6).toString('hex')}.pdf`;
        savedPath = path.join(dir, filename);
        await fs.writeFile(savedPath, buffer, { flag: 'wx' });
        const relative = `uploads/${id}/${filename}`;
        await trx('unilav_comunicazioni').insert({
          codice_comunicazione: parsed.codiceComunicazione, dipendente_id: id,
          tipo: parsed.tipo, data_operazione: parsed.rapporto.dataOperazione,
          motivo: parsed.rapporto.motivoCessazione || parsed.rapporto.codiceTrasformazione || null,
          protocollo: parsed.protocollo || null, file_path: relative, file_name: filename,
          confermata_at: new Date().toISOString(), confermata_da: userId || null,
          dati_json: JSON.stringify(communicationData)
        });
        await trx('dipendenti').where({ id }).update({ allegato_unilav: relative });
        await trx('log_attivita').insert({
          categoria: 'Dipendenti', icona: '📄', colore: '#4f46e5',
          descrizione: `Confermato UNILAV ${parsed.tipo} ${parsed.codiceComunicazione} per ${id}`,
          eseguito_da: String(userId || 'LocalServer')
        });
        return { dipendenteId: id, tipo: parsed.tipo, dataOperazione: parsed.rapporto.dataOperazione, file: relative };
      });
      const draft = await knex('unilav_bozze').where({ codice_comunicazione: parsed.codiceComunicazione }).first().catch(() => null);
      if (draft) await deleteDraft(draft.id).catch(() => {});
      return result;
    } catch (error) {
      if (savedPath) await fs.unlink(savedPath).catch(() => {});
      throw error;
    }
  }
  return { initialize, preview, confirm, listDrafts, saveDraft, updateDraft, getDraft, deleteDraft, confirmDraft };
}

module.exports = { parseUnilav, parsePdf, createUnilavService };
