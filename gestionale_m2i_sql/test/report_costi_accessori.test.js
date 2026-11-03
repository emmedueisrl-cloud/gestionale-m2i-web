const { test } = require('node:test');
const assert = require('node:assert/strict');
const knex = require('knex');
const { createReportAccessoryCosts } = require('../report_costi_accessori');

const invoice = (number, type, summaries) => ({
  originalname: `${number}.xml`,
  buffer: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
    <p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
      <FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>12345678901</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>Fornitore prova</Denominazione></Anagrafica>
      </DatiAnagrafici></CedentePrestatore></FatturaElettronicaHeader>
      <FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento>
        <TipoDocumento>${type}</TipoDocumento><Data>2026-11-03</Data><Numero>${number}</Numero>
      </DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi>${summaries.map(amount =>
        `<DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>${amount}</ImponibileImporto><Imposta>22.00</Imposta></DatiRiepilogo>`).join('')}</DatiBeniServizi></FatturaElettronicaBody>
    </p:FatturaElettronica>`)
});

test('costi accessori: somma gli imponibili XML nel mese scelto, evita doppi e consente la rimozione', async t => {
  const db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  t.after(() => db.destroy());
  const costs = createReportAccessoryCosts(db);
  await costs.initialize();
  await costs.importXml(10, 2026, [invoice('101', 'TD01', ['100.00', '50.25']),
    invoice('102', 'TD04', ['30.00'])]);
  const list = await costs.list(10, 2026);
  assert.equal(list.total, 120.25);
  assert.deepEqual(list.invoices.map(row => row.taxable), [150.25, -30]);
  assert.equal((await costs.list(11, 2026)).total, 0);
  await assert.rejects(costs.importXml(10, 2026, [invoice('101', 'TD01', ['100.00', '50.25'])]), /già caricata/i);
  assert.equal((await costs.list(10, 2026)).invoices.length, 2);
  await costs.remove(10, 2026, list.invoices[1].id);
  assert.equal((await costs.list(10, 2026)).total, 150.25);
});
