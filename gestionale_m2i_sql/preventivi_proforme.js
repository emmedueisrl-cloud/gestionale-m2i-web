const { knex } = require('./db');

const DEFAULT_CONTENT = {
  titolo_documento: 'PREVENTIVO N° {{numero}}',
  riga_data: 'Roma, {{data}}',
  destinatario_label: 'Spett.le',
  oggetto_label: 'Oggetto:',
  oggetto: 'Preventivo per pulizie ordinarie',
  servizi_inclusi: 'Spazzatura e lavaggio pavimenti; spolveratura superfici; pulizia servizi igienici; vuotatura cestini e, all’occorrenza, sostituzione dei relativi sacchetti.',
  testo_corpo: `In riferimento alla Vostra gradita richiesta, Vi sottoponiamo la Nostra migliore offerta, unitamente alle seguenti condizioni commerciali:

Il presente preventivo ha ad oggetto l’esecuzione del servizio di pulizia (a titolo esemplificativo ma non esaustivo):
{{servizi}}

Dei locali siti in: {{indirizzo}}

Costo del servizio {{tipo_prezzo}} (IVA IN REVERSE CHARGE*): {{costo}}

Modalità di pagamento: La M2I entro il 5 del mese successivo a quello di riferimento invierà fattura mensile per il servizio prestato. Il pagamento avverrà entro il 15 del mese successivo a quello di riferimento.

Si avvisa che la prima fattura emessa avrà decorrenza dal primo giorno di effettivo servizio e sarà calcolata pro-rata fino a fine mese.

Attrezzature e prodotti per la pulizia sono a carico della M2I.

La M2I S.r.l., nell’espletamento del servizio, è coperta da polizza assicurativa N° 2021/03/2430364 sottoscritta con REALE MUTUA per il risarcimento di eventuali danni a persone e/o cose.

Il contratto prevede un periodo di prova di 30 giorni decorrenti dalla data di sottoscrizione ed avrà durata di 90 giorni. Sarà rinnovato tacitamente, salvo disdetta di una delle parti da inviarsi tramite raccomandata o tramite pec almeno 30 giorni prima della scadenza.

* NB: Il costo pattuito è esente IVA, in quanto il servizio offerto rientra tra le operazioni assoggettate al reverse charge ai sensi dell’art. 17 del D.P.R. 633/1972.

Certi di aver fatto cosa gradita, Porgiamo i Nostri più cordiali saluti.

M2I S.r.l.`
};

async function ensureTable() {
  if (!await knex.schema.hasTable('preventivi_proforme')) {
    await knex.schema.createTable('preventivi_proforme', table => {
      table.increments('id').primary();
      table.string('nome', 120).notNullable().unique();
      table.string('titolo_documento', 200).notNullable();
      table.string('riga_data', 200).notNullable();
      table.string('destinatario_label', 100).notNullable();
      table.string('oggetto_label', 100).notNullable();
      table.string('oggetto', 500).notNullable();
      table.text('servizi_inclusi').notNullable();
      table.text('testo_corpo').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
    await knex('preventivi_proforme').insert({ nome: 'Pulizie ordinarie', ...DEFAULT_CONTENT });
  }
}

function validate(body) {
  const nome = String(body?.nome || '').trim();
  const titolo_documento = String(body?.titolo_documento || '').trim();
  const riga_data = String(body?.riga_data || '').trim();
  const destinatario_label = String(body?.destinatario_label || '').trim();
  const oggetto_label = String(body?.oggetto_label || '').trim();
  const oggetto = String(body?.oggetto || '').trim();
  const servizi_inclusi = String(body?.servizi_inclusi || '').trim();
  const testo_corpo = String(body?.testo_corpo || '').trim();
  if (!nome || nome.length > 120) throw new Error('Inserisci un nome per la proforma (massimo 120 caratteri).');
  if (!titolo_documento || titolo_documento.length > 200 || !riga_data || riga_data.length > 200 || !destinatario_label || destinatario_label.length > 100 || !oggetto_label || oggetto_label.length > 100) throw new Error('Completa i testi dell’intestazione.');
  if (!oggetto || oggetto.length > 500) throw new Error('Inserisci un oggetto valido (massimo 500 caratteri).');
  if (!servizi_inclusi || servizi_inclusi.length > 5000) throw new Error('Inserisci i servizi inclusi (massimo 5000 caratteri).');
  if (!testo_corpo || testo_corpo.length > 20000) throw new Error('Inserisci il testo del preventivo (massimo 20000 caratteri).');
  return { nome, titolo_documento, riga_data, destinatario_label, oggetto_label, oggetto, servizi_inclusi, testo_corpo };
}

function renderBody(template, values) {
  return template.replace(/\{\{(cliente|indirizzo|oggetto|servizi|tipo_prezzo|costo|numero|data)\}\}/g, (_, key) => String(values[key] ?? ''));
}

const fields = ['id', 'nome', 'titolo_documento', 'riga_data', 'destinatario_label', 'oggetto_label', 'oggetto', 'servizi_inclusi', 'testo_corpo'];
const list = () => knex('preventivi_proforme').select(fields).orderBy('nome', 'asc');

async function create(body) {
  const data = validate(body);
  const [id] = await knex('preventivi_proforme').insert(data);
  return knex('preventivi_proforme').where('id', id).first(...fields);
}

async function update(id, body) {
  const count = await knex('preventivi_proforme').where('id', id).update(validate(body));
  return count ? knex('preventivi_proforme').where('id', id).first(...fields) : null;
}

const remove = id => knex('preventivi_proforme').where('id', id).del();

module.exports = { DEFAULT_CONTENT, ensureTable, validate, renderBody, list, create, update, remove };
