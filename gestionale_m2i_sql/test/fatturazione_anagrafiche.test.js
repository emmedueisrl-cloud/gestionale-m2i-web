const test = require('node:test');
const assert = require('node:assert/strict');
const knexFactory = require('knex');
const importer = require('../fatturazione_anagrafiche');

function xml({ taxCode = '90097800586', address = 'VIA NUOVA 3' } = {}) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
  <p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
    <FatturaElettronicaHeader>
      <DatiTrasmissione><CodiceDestinatario>0000000</CodiceDestinatario><PECDestinatario>cliente@pec.it</PECDestinatario></DatiTrasmissione>
      <CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>15989811003</IdCodice></IdFiscaleIVA><CodiceFiscale>15989811003</CodiceFiscale><Anagrafica><Denominazione>M2I SRL</Denominazione></Anagrafica><RegimeFiscale>RF01</RegimeFiscale></DatiAnagrafici><Sede><Indirizzo>VIA VECCHIA 9</Indirizzo><CAP>00118</CAP><Comune>ROMA</Comune><Provincia>RM</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore>
      <CessionarioCommittente><DatiAnagrafici><CodiceFiscale>${taxCode}</CodiceFiscale><Anagrafica><Denominazione>CLIENTE APS</Denominazione></Anagrafica></DatiAnagrafici><Sede><Indirizzo>${address}</Indirizzo><CAP>00100</CAP><Comune>ROMA</Comune><Provincia>RM</Provincia><Nazione>IT</Nazione></Sede></CessionarioCommittente>
    </FatturaElettronicaHeader>
    <FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-09-30</Data><Numero>1</Numero></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi><DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>100.00</ImponibileImporto><Imposta>22.00</Imposta></DatiRiepilogo></DatiBeniServizi><DatiPagamento><DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento></DettaglioPagamento></DatiPagamento></FatturaElettronicaBody>
  </p:FatturaElettronica>`);
}

async function setup() {
  const db = knexFactory({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  await db.schema.createTable('clienti', t => {
    t.text('id').primary(); t.text('ragione_sociale'); t.text('partita_iva'); t.text('codice_fiscale');
    t.text('indirizzo_sede'); t.text('civico_sede'); t.text('cap'); t.text('citta'); t.text('provincia');
    t.text('pec'); t.text('codice_sdi'); t.text('tipo_tassazione'); t.text('attivo'); t.integer('cestinato');
  });
  await db.schema.createTable('m2i_azienda_dati', t => {
    t.integer('id').primary(); t.text('ragione_sociale'); t.text('partita_iva');
    t.text('codice_fiscale'); t.text('sede_legale'); t.text('pec'); t.text('capitale_sociale');
  });
  await db.schema.createTable('log_attivita', t => {
    t.increments('id'); t.text('categoria'); t.text('icona'); t.text('colore'); t.text('descrizione'); t.text('eseguito_da');
  });
  await db('clienti').insert({ id: 'C1', ragione_sociale: 'CLIENTE APS', partita_iva: 'BOZZA_1', codice_fiscale: '90097800586', indirizzo_sede: 'VIA NUOVA 3', attivo: 'SI', cestinato: 0, tipo_tassazione: 'IVA' });
  await db('m2i_azienda_dati').insert({ id: 1, ragione_sociale: 'M2I SRL', partita_iva: '15989811003', codice_fiscale: '15989811003', sede_legale: 'VIA DEL FONTANILE ANAGNINO 183, 00118 ROMA (RM)' });
  await importer.ensureColumns(db);
  return db;
}

test('legge XML con namespace e conserva l’indirizzo M2I diverso dallo storico', async () => {
  const db = await setup();
  try {
    const invoices = await importer.parseXml(xml(), 'fattura.xml');
    const plan = await importer.preview(db, invoices);
    assert.equal(plan.customers[0].clientId, 'C1');
    assert.equal(plan.customers[0].fields.find(f => f.field === 'tipo_tassazione').stato, 'uguale');
    assert.equal(plan.issuer.fields.find(f => f.field === 'fatturazione_indirizzo').stato, 'diverso');
    const result = await importer.apply(db, invoices);
    assert.equal(result.clientsUpdated, 1);
    assert.equal((await db('m2i_azienda_dati').where({ id: 1 }).first()).fatturazione_indirizzo, 'VIA DEL FONTANILE ANAGNINO 183');
    assert.equal((await db('clienti').where({ id: 'C1' }).first()).pec, 'cliente@pec.it');
    const readiness = await importer.status(db);
    assert.deepEqual(readiness.issuerIssues, []);
    assert.deepEqual(readiness.clients[0].issues, []);
  } finally { await db.destroy(); }
});

test('non aggiorna una scheda scelta manualmente con codice fiscale discordante', async () => {
  const db = await setup();
  try {
    const invoices = await importer.parseXml(xml({ taxCode: '11111111111' }), 'fattura.xml');
    const result = await importer.apply(db, invoices, { mappings: { '11111111111': 'C1' } });
    assert.equal(result.clientsUpdated, 0);
    assert.match(result.unresolved.map(x => x.reason).join(' '), /Identificativi fiscali discordanti/);
    assert.equal((await db('clienti').where({ id: 'C1' }).first()).pec, null);
  } finally { await db.destroy(); }
});

test('rifiuta XML con entità e partita IVA emittente discordante', async () => {
  await assert.rejects(importer.parseXml(Buffer.from('<!DOCTYPE a [<!ENTITY x "bad">]><a/>'), 'bad.xml'), /DTD/);
  const db = await setup();
  try {
    const invoices = await importer.parseXml(xml(), 'fattura.xml');
    await db('m2i_azienda_dati').where({ id: 1 }).update({ partita_iva: '12345678901' });
    await assert.rejects(importer.apply(db, invoices), /partita IVA emittente/);
  } finally { await db.destroy(); }
});
