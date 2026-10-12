const crypto = require('node:crypto');
const { calcolaImportiFatturaCliente } = require('./valori_contabilita_clienti');
const MONTHS = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
const defaultInvoiceDescription = (category, month, year) => `${String(category || 'Altro').trim().toUpperCase()} ${MONTHS[Number(month) - 1]} ${year}`;

const cents = value => {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(raw)) throw new Error('Importo non valido.');
  return Math.round(Number(raw) * 100);
};
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const period = (mese, anno) => {
  const m = Number(mese), y = Number(anno);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 2000 || y > 2100) throw new Error('Periodo non valido.');
  return { mese: m, anno: y };
};
const samePeriod = (date, p) => validDate(date) && Number(date.slice(0, 4)) === p.anno && Number(date.slice(5, 7)) === p.mese;

function createServiziExtra(knex) {
  async function initialize() {
    if (!await knex.schema.hasTable('gruppi_fatturazione_extra')) {
      await knex.schema.createTable('gruppi_fatturazione_extra', t => {
        t.text('id').primary();
        t.text('cliente_id').notNullable().references('id').inTable('clienti').onDelete('RESTRICT');
        t.integer('mese').notNullable(); t.integer('anno').notNullable();
        t.text('tipo').notNullable();
        t.text('nome').notNullable();
        t.text('inviata_at');
        t.integer('totale_cent'); t.integer('imponibile_cent'); t.text('data_scadenza');
        t.integer('fattura_registrazione_id').references('id').inTable('fatture_aruba_elaborati').onDelete('SET NULL');
        t.text('creata_at').notNullable();
        t.index(['cliente_id', 'anno', 'mese']);
      });
    }
    await knex.raw('DROP INDEX IF EXISTS idx_gruppo_mensile_extra');
    await knex.raw("CREATE UNIQUE INDEX IF NOT EXISTS idx_gruppo_mensile_extra ON gruppi_fatturazione_extra(cliente_id, anno, mese) WHERE tipo = 'mensile' AND fattura_registrazione_id IS NULL");
    if (!await knex.schema.hasColumn('gruppi_fatturazione_extra', 'totale_cent')) {
      await knex.raw('ALTER TABLE gruppi_fatturazione_extra ADD COLUMN totale_cent INTEGER');
    }
    if (!await knex.schema.hasColumn('gruppi_fatturazione_extra', 'imponibile_cent')) {
      await knex.raw('ALTER TABLE gruppi_fatturazione_extra ADD COLUMN imponibile_cent INTEGER');
    }
    if (!await knex.schema.hasColumn('gruppi_fatturazione_extra', 'data_scadenza')) {
      await knex.raw('ALTER TABLE gruppi_fatturazione_extra ADD COLUMN data_scadenza TEXT');
    }
    if (!await knex.schema.hasTable('servizi_extra')) {
      await knex.schema.createTable('servizi_extra', t => {
        t.text('id').primary();
        t.text('cliente_id').notNullable().references('id').inTable('clienti').onDelete('RESTRICT');
        t.integer('mese').notNullable(); t.integer('anno').notNullable();
        t.text('data_servizio').notNullable(); t.text('nome').notNullable();
        t.text('categoria').notNullable(); t.text('descrizione').notNullable().defaultTo('');
        t.text('descrizione_fattura');
        t.integer('imponibile_cent').notNullable();
        t.text('gruppo_id').notNullable().references('id').inTable('gruppi_fatturazione_extra').onDelete('RESTRICT');
        t.text('bloccato_at'); t.text('creato_at').notNullable(); t.text('modificato_at').notNullable();
        t.index(['cliente_id', 'anno', 'mese']); t.index(['gruppo_id']);
      });
    }
    if (!await knex.schema.hasColumn('servizi_extra', 'descrizione_fattura')) {
      await knex.raw('ALTER TABLE servizi_extra ADD COLUMN descrizione_fattura TEXT');
      const existing = await knex('servizi_extra').select('id', 'nome', 'categoria', 'mese', 'anno');
      for (const item of existing) await knex('servizi_extra').where({ id: item.id }).update({
        descrizione_fattura: defaultInvoiceDescription(item.nome || item.categoria, item.mese, item.anno)
      });
    }
    if (!await knex.schema.hasTable('lavori_servizi_extra')) {
      await knex.schema.createTable('lavori_servizi_extra', t => {
        t.text('id').primary();
        t.text('servizio_id').notNullable().references('id').inTable('servizi_extra').onDelete('RESTRICT');
        t.text('dipendente_id').notNullable().references('id').inTable('dipendenti').onDelete('RESTRICT');
        t.text('modalita').notNullable();
        t.integer('compenso_cent');
        t.text('giornate_json').notNullable();
        t.unique(['servizio_id', 'dipendente_id']);
        t.index(['dipendente_id']);
      });
    }
    if (!await knex.schema.hasTable('rettifiche_servizi_extra')) {
      await knex.schema.createTable('rettifiche_servizi_extra', t => {
        t.text('id').primary(); t.text('servizio_id').notNullable().references('id').inTable('servizi_extra').onDelete('RESTRICT');
        t.text('prima').notNullable(); t.text('dopo').notNullable(); t.text('modificata_at').notNullable(); t.text('utente_id');
      });
    }
    if (!await knex.schema.hasTable('documenti_rettifica_extra')) {
      await knex.schema.createTable('documenti_rettifica_extra', t => {
        t.text('id').primary();
        t.text('gruppo_id').notNullable().references('id').inTable('gruppi_fatturazione_extra').onDelete('RESTRICT');
        t.text('tipo').notNullable(); t.text('numero').notNullable(); t.text('data').notNullable();
        t.integer('imponibile_cent').notNullable(); t.integer('totale_cent').notNullable();
        t.integer('fattura_origine_id').references('id').inTable('fatture_aruba_elaborati').onDelete('RESTRICT');
        t.integer('nota_registrazione_id').references('id').inTable('fatture_aruba_elaborati').onDelete('RESTRICT');
        t.text('gruppo_sostitutivo_id').references('id').inTable('gruppi_fatturazione_extra').onDelete('SET NULL');
        t.text('registrato_at').notNullable(); t.text('utente_id');
        t.unique(['gruppo_id', 'numero', 'data']);
      });
    }
    if (!await knex.schema.hasColumn('documenti_rettifica_extra', 'nota_registrazione_id')) {
      await knex.raw('ALTER TABLE documenti_rettifica_extra ADD COLUMN nota_registrazione_id INTEGER REFERENCES fatture_aruba_elaborati(id) ON DELETE RESTRICT');
    }
    await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_rettifica_extra_nota ON documenti_rettifica_extra(nota_registrazione_id)');
    if (!await knex.schema.hasTable('incassi_gruppi_extra')) {
      await knex.schema.createTable('incassi_gruppi_extra', t => {
        t.text('id').primary(); t.text('gruppo_id').notNullable().references('id').inTable('gruppi_fatturazione_extra').onDelete('RESTRICT');
        t.text('data_incasso').notNullable(); t.integer('importo_cent').notNullable(); t.text('nota');
        t.text('origine').notNullable().defaultTo('manuale'); t.text('registrato_at').notNullable(); t.text('registrato_da');
        t.text('annullato_at'); t.text('annullato_da'); t.text('motivo_annullamento'); t.text('idempotency_key').unique();
        t.index(['gruppo_id', 'data_incasso']);
      });
    }
  }

  async function assertOpen(trx, p) {
    const [clienti, dipendenti] = await Promise.all([
      trx('mesi_chiusi_clienti').where(p).first(), trx('mesi_chiusi_dipendenti').where(p).first()
    ]);
    if (clienti || dipendenti) throw new Error('Elaborato del mese chiuso: il servizio extra non può essere modificato.');
  }

  function normalizeLavori(input, p, dipendenti) {
    if (!Array.isArray(input)) throw new Error('Elenco dipendenti non valido.');
    const ids = new Set();
    return input.map(item => {
      const dipendenteId = String(item.dipendenteId || '');
      const employee = dipendenti.get(dipendenteId);
      if (!employee || ids.has(dipendenteId)) throw new Error('Dipendente non valido o duplicato.');
      ids.add(dipendenteId);
      const modalita = String(item.modalita || '');
      if (!['elaborato', 'solo_nota'].includes(modalita)) throw new Error('Scegli elaborato oppure solo nota.');
      if (!Array.isArray(item.giornate) || !item.giornate.length) throw new Error('Inserisci almeno un giorno di lavoro.');
      const giornate = item.giornate.map(day => {
        if (!samePeriod(day.data, p)) throw new Error('Il giorno di lavoro deve appartenere al mese del servizio.');
        const ore = Number(String(day.ore ?? '').replace(',', '.'));
        if (!Number.isFinite(ore) || ore <= 0 || ore > 24 || Math.abs(ore * 100 - Math.round(ore * 100)) > 0.000001) throw new Error('Ore di lavoro non valide.');
        return { data: day.data, ore: Math.round(ore * 100) / 100 };
      });
      const needsAmount = modalita === 'solo_nota' || String(employee.tipo_paga || '').toLowerCase() === 'mensile';
      const compensoCent = needsAmount ? cents(item.compenso) : null;
      if (needsAmount && compensoCent <= 0) throw new Error('Inserisci il compenso del dipendente.');
      return { id: crypto.randomUUID(), dipendente_id: dipendenteId, modalita,
        compenso_cent: compensoCent, giornate_json: JSON.stringify(giornate) };
    });
  }

  async function list(mese, anno, clienteId) {
    const p = period(mese, anno);
    const query = knex('servizi_extra as e').join('gruppi_fatturazione_extra as g', 'e.gruppo_id', 'g.id')
      .join('clienti as c', 'e.cliente_id', 'c.id')
      .select('e.*', 'g.tipo as gruppo_tipo', 'g.nome as gruppo_nome', 'g.inviata_at', 'g.fattura_registrazione_id',
        'g.totale_cent as gruppo_totale_cent',
        'c.ragione_sociale as cliente_nome', 'c.tipo_tassazione', 'c.percentuale_tassazione')
      .where({ 'e.mese': p.mese, 'e.anno': p.anno }).orderBy('e.data_servizio').orderBy('e.creato_at');
    if (clienteId) query.where('e.cliente_id', clienteId);
    const rows = await query;
    if (!rows.length) return [];
    const works = await knex('lavori_servizi_extra').whereIn('servizio_id', rows.map(row => row.id));
    const [closedClients, closedEmployees, paidEmployees, lockedEmployees] = await Promise.all([
      knex('mesi_chiusi_clienti').where(p).first(),
      knex('mesi_chiusi_dipendenti').where(p).first(),
      knex('pagamenti_elaborati_dipendenti').where(p).select('dipendente_id'),
      knex('righe_bloccate_elaborati').where({ tipo: 'dipendente', ...p }).select('soggetto_id')
    ]);
    const paid = new Set(paidEmployees.map(item => String(item.dipendente_id)));
    const locked = new Set(lockedEmployees.map(item => String(item.soggetto_id)));
    const byService = new Map();
    for (const work of works) {
      if (!byService.has(work.servizio_id)) byService.set(work.servizio_id, []);
      byService.get(work.servizio_id).push({ id: work.id, dipendenteId: work.dipendente_id,
        modalita: work.modalita, compenso: work.compenso_cent == null ? null : work.compenso_cent / 100,
        giornate: JSON.parse(work.giornate_json) });
    }
    return rows.map(row => ({ id: row.id, clienteId: row.cliente_id, mese: row.mese, anno: row.anno,
      clienteNome: row.cliente_nome, tipoTassazione: row.tipo_tassazione,
      percentualeTassazione: row.percentuale_tassazione,
      dataServizio: row.data_servizio, nome: row.nome, categoria: row.categoria, descrizione: row.descrizione,
      descrizioneFattura: row.descrizione_fattura || defaultInvoiceDescription(row.nome || row.categoria, row.mese, row.anno),
      imponibile: row.imponibile_cent / 100, gruppoId: row.gruppo_id, gruppoTipo: row.gruppo_tipo,
      gruppoNome: row.gruppo_nome, inviataAt: row.inviata_at, fatturaRegistrazioneId: row.fattura_registrazione_id,
      gruppoTotale: row.gruppo_totale_cent == null ? null : row.gruppo_totale_cent / 100,
      bloccatoAt: row.bloccato_at, lavori: byService.get(row.id) || [],
      modificabile: !row.inviata_at && !row.fattura_registrazione_id && !closedClients && !closedEmployees && !(byService.get(row.id) || [])
        .some(work => paid.has(String(work.dipendenteId)) && locked.has(String(work.dipendenteId))) }));
  }

  async function groups(mese, anno, clienteId) {
    const p = period(mese, anno);
    const query = knex('gruppi_fatturazione_extra').where(p).orderBy('creata_at');
    if (clienteId) query.where({ cliente_id: clienteId });
    const rows = await query;
    const extras = rows.length ? await knex('servizi_extra').whereIn('gruppo_id', rows.map(row => row.id)) : [];
    const descriptions = rows.length && await knex.schema.hasTable('descrizioni_fatture_elaborati') ? await knex('descrizioni_fatture_elaborati')
      .where({ tipo: 'extra', mese: p.mese, anno: p.anno }).whereIn('soggetto_id', rows.map(row => row.id)) : [];
    const descriptionByGroup = new Map(descriptions.map(item => [item.soggetto_id, item.descrizione]));
    const clients = rows.length ? await knex('clienti').whereIn('id', [...new Set(rows.map(row => row.cliente_id))])
      .select('id', 'ragione_sociale', 'tipo_tassazione', 'percentuale_tassazione') : [];
    const clientsById = new Map(clients.map(client => [String(client.id), client]));
    const credits = rows.length ? await knex('documenti_rettifica_extra').whereIn('gruppo_id', rows.map(row => row.id)) : [];
    return rows.map(row => {
      const groupExtras = extras.filter(extra => extra.gruppo_id === row.id);
      const imponibileExtra = (row.imponibile_cent ?? groupExtras.reduce((sum, extra) => sum + extra.imponibile_cent, 0)) / 100;
      const client = clientsById.get(String(row.cliente_id));
      return { id: row.id, clienteId: row.cliente_id, clienteNome: client?.ragione_sociale || row.cliente_id,
      mese: row.mese, anno: row.anno,
      descrizioneFattura: descriptionByGroup.get(row.id) || groupExtras.map(extra =>
        extra.descrizione_fattura || defaultInvoiceDescription(extra.nome || extra.categoria, extra.mese, extra.anno)).join('; ') || row.nome,
      tipo: row.tipo, nome: row.nome, inviataAt: row.inviata_at,
      tipoTassazione: client?.tipo_tassazione || 'IVA',
      dataScadenza: row.data_scadenza,
      totaleFattura: row.totale_cent == null ? null : row.totale_cent / 100,
      totaleExtraPrevisto: calcolaImportiFatturaCliente(imponibileExtra, client?.tipo_tassazione,
        client?.percentuale_tassazione).importoTotale,
      tuttiBlindati: groupExtras.length > 0 && groupExtras.every(extra => Boolean(extra.bloccato_at)),
      fatturaRegistrazioneId: row.fattura_registrazione_id,
      crediti: credits.filter(credit => credit.gruppo_id === row.id).map(credit => ({ id: credit.id,
        numero: credit.numero, data: credit.data, registrazioneId: credit.nota_registrazione_id,
        imponibile: credit.imponibile_cent / 100,
        totale: credit.totale_cent / 100, gruppoSostitutivoId: credit.gruppo_sostitutivo_id })),
      imponibileExtra,
      servizi: groupExtras.map(extra => extra.id),
      nomiServizi: groupExtras.map(extra => extra.nome) };
    });
  }

  async function save(input, userId) {
    const p = period(input.mese, input.anno);
    const clienteId = String(input.clienteId || '');
    const id = input.id ? String(input.id) : crypto.randomUUID();
    if (!['extra', 'mensile', 'existing'].includes(input.destinazione)) throw new Error('Scegli la destinazione della fattura.');
    if (input.destinazione === 'existing' && !input.gruppoId) throw new Error('Seleziona la fattura extra a cui unire il servizio.');
    const nome = String(input.nome || '').trim(), categoria = String(input.categoria || '').trim();
    const descrizione = String(input.descrizione || '').trim();
    if (!nome || nome.length > 120 || !categoria || categoria.length > 80 || descrizione.length > 3000 || !samePeriod(input.dataServizio, p)) {
      throw new Error('Nome, categoria o data del servizio non validi.');
    }
    const imponibileCent = cents(input.imponibile);
    if (imponibileCent <= 0) throw new Error('Inserisci un imponibile positivo.');
    return knex.transaction(async trx => {
      await assertOpen(trx, p);
      const cliente = await trx('clienti').where({ id: clienteId }).first();
      if (!cliente) throw new Error('Cliente non trovato.');
      const employeeRows = await trx('dipendenti').select('id', 'tipo_paga');
      const lavori = normalizeLavori(input.lavori || [], p, new Map(employeeRows.map(row => [row.id, row])));
      const old = input.id ? await trx('servizi_extra').where({ id }).first() : null;
      const descrizioneFattura = String(input.descrizioneFattura == null
        ? old?.descrizione_fattura || defaultInvoiceDescription(nome || categoria, p.mese, p.anno)
        : input.descrizioneFattura).trim();
      if (!descrizioneFattura || descrizioneFattura.length > 500) throw new Error('Descrizione fattura obbligatoria (massimo 500 caratteri).');
      const oldWorks = old ? await trx('lavori_servizi_extra').where({ servizio_id: id }) : [];
      if (input.id && !old) throw new Error('Servizio extra non trovato.');
      if (old && (old.cliente_id !== clienteId || old.mese !== p.mese || old.anno !== p.anno)) throw new Error('Cliente e mese del servizio non possono essere cambiati.');
      const oldGroup = old ? await trx('gruppi_fatturazione_extra').where({ id: old.gruppo_id }).first() : null;
      const groupLocked = Boolean(oldGroup?.inviata_at || oldGroup?.fattura_registrazione_id);
      if (old && groupLocked) throw new Error('Fattura inviata o registrata: il servizio extra non è modificabile.');
      if (groupLocked && old && descrizioneFattura !== (old.descrizione_fattura || defaultInvoiceDescription(old.nome || old.categoria, p.mese, p.anno))) {
        throw new Error('Fattura inviata o registrata: la descrizione non può essere modificata.');
      }
      const priceChanged = old && old.imponibile_cent !== imponibileCent;
      if (old?.bloccato_at && priceChanged) throw new Error('Sblinda la riga extra prima di cambiare l’imponibile.');
      let compatibleUnlinkedInvoice = false;
      if (old && !groupLocked && oldGroup?.tipo === 'extra') {
        const groupExtras = await trx('servizi_extra').where({ gruppo_id: oldGroup.id });
        const expected = calcolaImportiFatturaCliente(groupExtras.reduce((sum, extra) => sum + Number(extra.imponibile_cent), 0) / 100,
          cliente.tipo_tassazione, cliente.percentuale_tassazione).importoTotale;
        const imported = await trx('fatture_aruba_elaborati').where({ cliente_id: clienteId, ...p });
        const linkedIds = new Set((await trx('gruppi_fatturazione_extra').whereNotNull('fattura_registrazione_id'))
          .map(item => Number(item.fattura_registrazione_id)));
        compatibleUnlinkedInvoice = imported.some(invoice => !linkedIds.has(invoice.id) && invoice.tipo_documento !== 'TD04'
          && Math.abs(Number(invoice.importo_totale) - expected) < 0.02);
      }
      let group = null;
      const requestedGroupId = input.gruppoId || (old && !input.destinazione ? old.gruppo_id : null);
      if (requestedGroupId) {
        group = await trx('gruppi_fatturazione_extra').where({ id: String(requestedGroupId), cliente_id: clienteId, ...p }).first();
        if (!group) throw new Error('Gruppo fattura non valido.');
        if (group.tipo !== (input.destinazione === 'mensile' ? 'mensile' : 'extra')) throw new Error('Il gruppo scelto non corrisponde alla destinazione.');
      }
      else if (input.destinazione === 'mensile') group = await trx('gruppi_fatturazione_extra')
        .where({ cliente_id: clienteId, ...p, tipo: 'mensile' }).whereNull('fattura_registrazione_id').first();
      if (!group) {
        const tipo = input.destinazione === 'mensile' ? 'mensile' : 'extra';
        const groupId = crypto.randomUUID();
        await trx('gruppi_fatturazione_extra').insert({ id: groupId, cliente_id: clienteId, ...p, tipo,
          nome: tipo === 'mensile' ? 'Mensile' : nome, creata_at: new Date().toISOString() });
        group = await trx('gruppi_fatturazione_extra').where({ id: groupId }).first();
      }
      if (old?.bloccato_at && old.gruppo_id !== group.id) throw new Error('Sblinda la riga extra prima di cambiarne la fatturazione.');
      if (compatibleUnlinkedInvoice && (priceChanged || old.gruppo_id !== group.id)) {
        throw new Error('Esiste una fattura Aruba compatibile non collegata: associala al gruppo prima di correggere prezzo o composizione.');
      }
      if (groupLocked && (priceChanged || old.gruppo_id !== group.id)) throw new Error('Fattura inviata o registrata: prezzo e raggruppamento bloccati.');
      if (group.tipo === 'mensile' && (!old || old.gruppo_id !== group.id)) {
        const [sent, registered] = await Promise.all([
          trx('fatture_inviate_elaborati').where({ cliente_id: clienteId, ...p }).first(),
          trx('fatture_aruba_elaborati').where({ cliente_id: clienteId, ...p }).first()
        ]);
        if (sent || registered) throw new Error('Il mensile ha già una fattura inviata o registrata: non puoi aggiungervi un extra.');
      }
      if (group.inviata_at || group.fattura_registrazione_id) {
        if (!old || old.gruppo_id !== group.id) throw new Error('Non puoi aggiungere servizi a una fattura già inviata o registrata.');
      }
      const now = new Date().toISOString();
      const values = { cliente_id: clienteId, ...p, data_servizio: input.dataServizio, nome, categoria,
        descrizione, descrizione_fattura: descrizioneFattura, imponibile_cent: imponibileCent, gruppo_id: group.id, modificato_at: now };
      if (old) {
        await trx('servizi_extra').where({ id }).update(values);
        await trx('lavori_servizi_extra').where({ servizio_id: id }).del();
      } else await trx('servizi_extra').insert({ id, ...values, creato_at: now });
      if (old && old.descrizione_fattura !== descrizioneFattura && !groupLocked && await trx.schema.hasTable('descrizioni_fatture_elaborati')) {
        await trx('descrizioni_fatture_elaborati').where({ tipo: 'extra', soggetto_id: group.id, ...p }).del();
      }
      if (lavori.length) await trx('lavori_servizi_extra').insert(lavori.map(work => ({ ...work, servizio_id: id })));
      const employeeIds = [...new Set([...oldWorks.map(work => work.dipendente_id), ...lavori.map(work => work.dipendente_id)])];
      if (employeeIds.length) {
        const lockedEmployees = await trx('righe_bloccate_elaborati').where({ tipo: 'dipendente', ...p }).whereIn('soggetto_id', employeeIds);
        if (lockedEmployees.length) {
          const paid = await trx('pagamenti_elaborati_dipendenti').where(p)
            .whereIn('dipendente_id', lockedEmployees.map(row => row.soggetto_id)).first();
          if (paid) throw new Error('Stipendio già pagato: non puoi modificare il lavoro extra del dipendente.');
          await trx('righe_bloccate_elaborati').where({ tipo: 'dipendente', ...p })
            .whereIn('soggetto_id', lockedEmployees.map(row => row.soggetto_id)).del();
          const elaborati = require('./controllers/elaborati');
          const refreshed = await elaborati.ottieniElaboratoMensile(p.mese, p.anno, trx);
          for (const locked of lockedEmployees) {
            const row = refreshed.dati.find(item => String(item.idDipendente) === String(locked.soggetto_id));
            if (!row) throw new Error('Elaborato dipendente non aggiornabile: sblinda la riga e riprova.');
            await trx('righe_bloccate_elaborati').insert({ ...locked,
              snapshot: JSON.stringify({ ...row, rigaBloccata: true }) });
          }
        }
      }
      await trx('rettifiche_servizi_extra').insert({ id: crypto.randomUUID(), servizio_id: id,
        prima: JSON.stringify(old ? { ...old, lavori: oldWorks } : null), dopo: JSON.stringify({ ...values, lavori }),
        modificata_at: now, utente_id: String(userId || '') });
      return { id, gruppoId: group.id };
    });
  }

  async function setLock(id, locked) {
    return knex.transaction(async trx => {
      const row = await trx('servizi_extra').where({ id }).first();
      if (!row) throw new Error('Servizio extra non trovato.');
      await assertOpen(trx, { mese: row.mese, anno: row.anno });
      const group = await trx('gruppi_fatturazione_extra').where({ id: row.gruppo_id }).first();
      if (!locked && (group.inviata_at || group.fattura_registrazione_id)) throw new Error('Fattura già inviata o registrata: non puoi sblindare il servizio.');
      await trx('servizi_extra').where({ id }).update({ bloccato_at: locked ? new Date().toISOString() : null });
      return { id, bloccato: locked };
    });
  }

  async function markSent(groupId) {
    return knex.transaction(async trx => {
      const group = await trx('gruppi_fatturazione_extra').where({ id: groupId }).first();
      if (!group) throw new Error('Gruppo fattura non trovato.');
      if (group.fattura_registrazione_id) throw new Error('Fattura già registrata.');
      if (group.tipo !== 'extra') throw new Error('Segna la fattura mensile come inviata dall’elaborato clienti.');
      const extras = await trx('servizi_extra').where({ gruppo_id: groupId });
      if (!extras.length) throw new Error('Nessun extra in questo gruppo.');
      if (extras.some(extra => !extra.bloccato_at)) throw new Error('Blinda tutti i servizi del gruppo prima di segnare la fattura come inviata.');
      const cliente = await trx('clienti').where({ id: group.cliente_id }).first();
      const imponibile = extras.reduce((sum, extra) => sum + Number(extra.imponibile_cent), 0) / 100;
      const totaleCent = Math.round(calcolaImportiFatturaCliente(imponibile, cliente.tipo_tassazione,
        cliente.percentuale_tassazione).importoTotale * 100);
      const at = group.inviata_at || new Date().toISOString();
      if (await trx.schema.hasTable('descrizioni_fatture_elaborati')) {
        await trx('descrizioni_fatture_elaborati').insert({ tipo: 'extra', soggetto_id: groupId,
          mese: group.mese, anno: group.anno, descrizione: extras.map(extra =>
            extra.descrizione_fattura || defaultInvoiceDescription(extra.nome || extra.categoria, extra.mese, extra.anno)).join('; ') || group.nome })
          .onConflict(['tipo', 'soggetto_id', 'mese', 'anno']).ignore();
      }
      await trx('gruppi_fatturazione_extra').where({ id: groupId }).update({ inviata_at: at,
        totale_cent: totaleCent, imponibile_cent: extras.reduce((sum, extra) => sum + Number(extra.imponibile_cent), 0) });
      return { gruppoId: groupId, inviataAt: at };
    });
  }

  async function registrations(mese, anno, clienteId) {
    const p = period(mese, anno);
    const query = knex('fatture_aruba_elaborati').select('id', 'cliente_id', 'numero_fattura',
      'data_fattura', 'importo_totale', 'tipo_documento').where(p).orderBy('data_fattura', 'desc');
    if (clienteId) query.where({ cliente_id: clienteId });
    const registered = await query;
    const official = await unregisteredOfficial(clienteId, [p]);
    return [...registered, ...official];
  }

  async function unregisteredOfficial(clienteId, periods = null) {
    const registrations = await knex('fatture_aruba_elaborati').select('fattura_id', 'cliente_id',
      'numero_fattura', 'data_fattura');
    const used = new Set(registrations.filter(row => row.fattura_id).map(row => String(row.fattura_id)));
    const naturalKeys = new Set(registrations.map(row => `${row.cliente_id}\u0000${row.numero_fattura}\u0000${row.data_fattura}`));
    const query = knex('fatture').select('id', 'cliente_id', 'numero_fattura', 'data_fattura',
      'importo_totale', 'tipo_documento').orderBy('data_fattura', 'desc');
    if (clienteId) query.where({ cliente_id: clienteId });
    if (periods) {
      const months = periods.flatMap(p => {
        const current = `${p.anno}-${String(p.mese).padStart(2, '0')}`;
        const next = new Date(Date.UTC(p.anno, p.mese, 1));
        return [current, `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`];
      });
      query.where(function () { for (const month of months) this.orWhere('data_fattura', 'like', `${month}%`); });
    }
    return (await query).filter(row => !used.has(String(row.id)) &&
      !naturalKeys.has(`${row.cliente_id}\u0000${row.numero_fattura}\u0000${row.data_fattura}`))
      .map(row => ({ ...row, id: `official:${row.id}` }));
  }

  async function resolveRegistration(trx, reference, clientId, isCredit, billingPeriod = null) {
    const officialId = /^official:(.+)$/.exec(String(reference || ''))?.[1];
    if (!officialId) return trx('fatture_aruba_elaborati').where({ id: Number(reference) }).first();
    const official = await trx('fatture').where({ id: officialId, cliente_id: clientId }).first();
    if (!official || !validDate(official.data_fattura)) throw new Error('Documento XML/CSV non valido.');
    const isNote = official.tipo_documento === 'TD04' || Number(official.importo_totale) < 0;
    if (isNote !== isCredit) throw new Error('Tipo di documento non coerente con l’operazione.');
    if (await trx('fatture_aruba_elaborati').where({ fattura_id: official.id }).first()) throw new Error('Documento già registrato.');
    const matching = await trx('fatture_aruba_elaborati').where({ cliente_id: clientId,
      numero_fattura: official.numero_fattura, data_fattura: official.data_fattura }).first();
    if (matching) {
      if (Math.abs(Number(matching.importo_totale) - Number(official.importo_totale)) > 0.011 || matching.fattura_id) {
        throw new Error('Documento Aruba già presente con dati diversi: verifica la riconciliazione.');
      }
      await trx('fatture_aruba_elaborati').where({ id: matching.id }).update({ fattura_id: official.id,
        tipo_documento: isNote ? 'TD04' : official.tipo_documento || 'TD01' });
      return trx('fatture_aruba_elaborati').where({ id: matching.id }).first();
    }
    const [id] = await trx('fatture_aruba_elaborati').insert({ cliente_id: clientId,
      mese: billingPeriod?.mese || Number(official.data_fattura.slice(5, 7)),
      anno: billingPeriod?.anno || Number(official.data_fattura.slice(0, 4)),
      numero_fattura: official.numero_fattura, data_fattura: official.data_fattura,
      importo_totale: official.importo_totale, tipo_documento: isNote ? 'TD04' : official.tipo_documento || 'TD01',
      fattura_id: official.id, registrata_at: new Date().toISOString() });
    return trx('fatture_aruba_elaborati').where({ id }).first();
  }

  async function creditNotes(clienteId) {
    const query = knex('fatture_aruba_elaborati').select('id', 'cliente_id', 'numero_fattura',
      'data_fattura', 'importo_totale').where({ tipo_documento: 'TD04' }).orderBy('data_fattura', 'desc');
    if (clienteId) query.where({ cliente_id: clienteId });
    const registered = await query;
    const official = (await unregisteredOfficial(clienteId))
      .filter(row => row.tipo_documento === 'TD04' || Number(row.importo_totale) < 0);
    return [...registered, ...official];
  }

  async function registerCredit(groupId, registrationId, taxable) {
    const taxableCent = cents(taxable);
    if (taxableCent <= 0) throw new Error('Indica l’imponibile stornato dalla nota di credito.');
    return knex.transaction(async trx => {
      const group = await trx('gruppi_fatturazione_extra').where({ id: groupId }).first();
      if (!group?.fattura_registrazione_id) throw new Error('Collega prima la fattura originale Aruba.');
      const credit = await resolveRegistration(trx, registrationId, group.cliente_id, true);
      if (!credit || credit.cliente_id !== group.cliente_id) throw new Error('Nota di credito Aruba non valida per questo cliente.');
      if (await trx('documenti_rettifica_extra').where({ nota_registrazione_id: credit.id }).first()) throw new Error('Nota di credito già associata.');
      const original = await trx('fatture_aruba_elaborati').where({ id: group.fattura_registrazione_id }).first();
      const amountCent = Math.abs(Math.round(Number(credit.importo_totale) * 100));
      const originalCent = Math.round(Number(original.importo_totale) * 100);
      if (credit.data_fattura < original.data_fattura) throw new Error('La nota di credito precede la fattura originale.');
      const client = await trx('clienti').where({ id: group.cliente_id }).first();
      const expectedCent = Math.round(calcolaImportiFatturaCliente(taxableCent / 100,
        client.tipo_tassazione, client.percentuale_tassazione).importoTotale * 100);
      if (Math.abs(expectedCent - amountCent) > 2) throw new Error('Imponibile e totale della nota di credito non coincidono con il regime del cliente.');
      const previous = await trx('documenti_rettifica_extra').where({ gruppo_id: groupId });
      if (!amountCent || previous.reduce((sum, item) => sum + Number(item.totale_cent), 0) + amountCent > originalCent + 1) {
        throw new Error('La nota supera il totale della fattura originale.');
      }
      const id = crypto.randomUUID();
      await trx('documenti_rettifica_extra').insert({ id, gruppo_id: groupId, tipo: 'TD04',
        numero: credit.numero_fattura, data: credit.data_fattura, imponibile_cent: taxableCent,
        totale_cent: amountCent, fattura_origine_id: original.id, nota_registrazione_id: credit.id,
        registrato_at: new Date().toISOString() });
      return { id, gruppoId: groupId };
    });
  }

  async function reissue(groupId, destination = 'stesso', targetGroupId = null) {
    return knex.transaction(async trx => {
      const group = await trx('gruppi_fatturazione_extra').where({ id: groupId }).first();
      if (!group?.fattura_registrazione_id) throw new Error('Fattura originale Aruba non collegata.');
      const original = await trx('fatture_aruba_elaborati').where({ id: group.fattura_registrazione_id }).first();
      const credits = await trx('documenti_rettifica_extra').where({ gruppo_id: groupId });
      const credited = credits.reduce((sum, credit) => sum + Number(credit.totale_cent), 0);
      if (credited + 1 < Math.round(Number(original.importo_totale) * 100)) throw new Error('Serve una nota di credito totale prima di rifare la fattura.');
      const extras = await trx('servizi_extra').where({ gruppo_id: groupId });
      if (!extras.length) throw new Error('Servizi già spostati a una fattura sostitutiva.');
      if (!['stesso', 'extra', 'mensile', 'existing'].includes(destination)) throw new Error('Destinazione della nuova fattura non valida.');
      let replacement = null;
      if (destination === 'existing') {
        replacement = await trx('gruppi_fatturazione_extra').where({ id: String(targetGroupId || ''),
          cliente_id: group.cliente_id, mese: group.mese, anno: group.anno, tipo: 'extra' }).first();
        if (!replacement || replacement.inviata_at || replacement.fattura_registrazione_id) throw new Error('Gruppo extra di destinazione non disponibile.');
      } else if (destination === 'mensile') {
        replacement = await trx('gruppi_fatturazione_extra').where({ cliente_id: group.cliente_id,
          mese: group.mese, anno: group.anno, tipo: 'mensile' }).whereNull('fattura_registrazione_id').first();
        if (replacement?.inviata_at) throw new Error('La fattura mensile di destinazione è già inviata.');
      }
      const replacementId = replacement?.id || crypto.randomUUID();
      if (!replacement) await trx('gruppi_fatturazione_extra').insert({ id: replacementId,
        cliente_id: group.cliente_id, mese: group.mese, anno: group.anno,
        tipo: destination === 'stesso' ? group.tipo : destination === 'mensile' ? 'mensile' : 'extra',
        nome: destination === 'mensile' ? 'Mensile' : group.nome,
        creata_at: new Date().toISOString() });
      const monthClosed = await trx('mesi_chiusi_clienti').where({ mese: group.mese, anno: group.anno }).first();
      await trx('servizi_extra').where({ gruppo_id: groupId }).update({ gruppo_id: replacementId,
        bloccato_at: monthClosed ? new Date().toISOString() : null,
        modificato_at: new Date().toISOString() });
      for (const extra of extras) await trx('rettifiche_servizi_extra').insert({
        id: crypto.randomUUID(), servizio_id: extra.id,
        prima: JSON.stringify({ gruppoId: groupId }), dopo: JSON.stringify({ gruppoId: replacementId, motivo: 'rifatturazione' }),
        modificata_at: new Date().toISOString()
      });
      await trx('documenti_rettifica_extra').where({ gruppo_id: groupId }).update({ gruppo_sostitutivo_id: replacementId });
      return { gruppoId: replacementId };
    });
  }

  async function linkRegistration(groupId, registrationId, connection = null) {
    const link = async trx => {
      const group = await trx('gruppi_fatturazione_extra').where({ id: groupId }).first();
      if (!group) throw new Error('Gruppo fattura non trovato.');
      if (group.fattura_registrazione_id) throw new Error('Il gruppo ha già una fattura Aruba collegata.');
      const registration = await resolveRegistration(trx, registrationId, group.cliente_id, false,
        { mese: group.mese, anno: group.anno });
      if (!registration || registration.cliente_id !== group.cliente_id || Number(registration.mese) !== group.mese || Number(registration.anno) !== group.anno || registration.tipo_documento === 'TD04') {
        throw new Error('Seleziona una fattura Aruba dello stesso cliente e periodo.');
      }
      if (await trx('gruppi_fatturazione_extra').where({ fattura_registrazione_id: registration.id }).first()) {
        throw new Error('Questa fattura Aruba è già collegata a un gruppo.');
      }
      const extras = await trx('servizi_extra').where({ gruppo_id: groupId });
      if (!extras.length || extras.some(extra => !extra.bloccato_at)) throw new Error('Blinda tutti gli extra del gruppo prima di collegare la fattura.');
      if (group.tipo === 'mensile' && !await trx('righe_bloccate_elaborati').where({ tipo: 'cliente', soggetto_id: group.cliente_id, mese: group.mese, anno: group.anno }).first()) {
        throw new Error('Blinda la riga mensile del cliente prima di collegare questa fattura.');
      }
      const receipts = await trx('incassi_gruppi_extra').where({ gruppo_id: groupId });
      const paid = receipts.filter(receipt => !receipt.annullato_at).reduce((sum, receipt) => sum + Number(receipt.importo_cent), 0);
      if (paid > Math.round(Number(registration.importo_totale) * 100)) throw new Error('Incassi già registrati superiori alla fattura Aruba.');
      if (receipts.length) {
        await trx('incassi_fatture_aruba').insert(receipts.map(receipt => ({
          id: receipt.id, registrazione_id: registration.id, data_incasso: receipt.data_incasso,
          importo_cent: receipt.importo_cent, nota: receipt.nota, origine: receipt.origine,
          registrato_at: receipt.registrato_at, registrato_da: receipt.registrato_da,
          annullato_at: receipt.annullato_at, annullato_da: receipt.annullato_da,
          motivo_annullamento: receipt.motivo_annullamento, idempotency_key: receipt.idempotency_key
        })));
        await trx('incassi_gruppi_extra').where({ gruppo_id: groupId }).del();
        if (registration.fattura_id) {
          const { transferArubaReceipts } = require('./fatture_reconciliation');
          const official = await trx('fatture').where({ id: registration.fattura_id }).first();
          if (official) await transferArubaReceipts(trx, registration, official);
        }
      }
      if (group.tipo === 'mensile') {
        const { transferSentReceipts } = require('./incassi_insoluti');
        await transferSentReceipts(trx, { cliente_id: group.cliente_id, mese: group.mese, anno: group.anno }, registration);
        if (registration.fattura_id) {
          const { transferArubaReceipts } = require('./fatture_reconciliation');
          const official = await trx('fatture').where({ id: registration.fattura_id }).first();
          if (official) await transferArubaReceipts(trx, registration, official);
        }
      }
      if (group.data_scadenza && !registration.data_scadenza) {
        await trx('fatture_aruba_elaborati').where({ id: registration.id }).update({ data_scadenza: group.data_scadenza });
      }
      await trx('gruppi_fatturazione_extra').where({ id: groupId }).update({ fattura_registrazione_id: registration.id,
        inviata_at: group.inviata_at || registration.registrata_at,
        imponibile_cent: group.imponibile_cent ?? extras.reduce((sum, extra) => sum + Number(extra.imponibile_cent), 0),
        totale_cent: group.totale_cent ?? Math.round(Number(registration.importo_totale) * 100) });
      return { gruppoId: groupId, registrazioneId: registration.id };
    };
    return connection ? link(connection) : knex.transaction(link);
  }

  return { initialize, list, groups, save, setLock, markSent, registrations, creditNotes,
    registerCredit, reissue, linkRegistration };
}

module.exports = { createServiziExtra, cents, period };
