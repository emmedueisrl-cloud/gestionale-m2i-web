const giornoItaliano = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' });

function oggiItalia() {
  return giornoItaliano.format(new Date());
}

function dataIso(value) {
  const text = String(value || '').trim();
  const it = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = it ? [it[3], it[2].padStart(2, '0'), it[1].padStart(2, '0')].join('-') : text.replace(/[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/, '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const day = new Date(iso + 'T00:00:00Z');
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === iso ? iso : null;
}

function statoContrattuale(dipendente) {
  if (dipendente.stato && dipendente.stato !== 'Cessato') return dipendente.stato;
  if (dipendente.stato_pre_cessazione) return dipendente.stato_pre_cessazione;
  // Nelle vecchie schede la cessazione sovrascriveva il tipo di contratto.
  if (dipendente.scadenza) return 'Determinato';
  return dipendente.data_trasformazione_indeterminato ? 'Indeterminato' : 'Attivo';
}

function statoAllaData(dipendente, oggi = oggiItalia()) {
  const fine = dataIso(dipendente.data_cessazione);
  if (!fine) return dipendente.stato;
  return fine < oggi ? 'Cessato' : statoContrattuale(dipendente);
}

async function inizializzaCessazioniDipendenti(db) {
  for (const campo of ['motivo_cessazione', 'stato_pre_cessazione']) {
    if (!await db.schema.hasColumn('dipendenti', campo)) {
      await db.schema.alterTable('dipendenti', table => table.text(campo));
    }
  }
}

async function registraCessazioneDipendente(trx, dipendente, data, motivo, oggi = oggiItalia()) {
  if (!dipendente) throw new Error('Dipendente non trovato.');
  const fine = dataIso(data);
  if (!fine) throw new Error('Inserisci una data di cessazione valida.');
  const inizio = dataIso(dipendente.data_assunzione);
  if (inizio && fine < inizio) throw new Error('La cessazione precede la data di assunzione.');
  await trx('dipendenti').where({ id: dipendente.id }).update({
    data_cessazione: fine,
    motivo_cessazione: String(motivo || '').trim() || null,
    stato_pre_cessazione: statoContrattuale(dipendente),
    stato: statoAllaData({ ...dipendente, data_cessazione: fine }, oggi)
  });
}

function creaAggiornamentoCessazioni(db, giornoCorrente = oggiItalia) {
  let ultimoGiorno;
  let inCorso;
  return async function aggiorna() {
    const oggi = giornoCorrente();
    if (ultimoGiorno === oggi) return;
    if (inCorso) return inCorso.then(aggiorna);
    inCorso = db.transaction(async trx => {
      const dipendenti = await trx('dipendenti').whereNotNull('data_cessazione').whereNot('data_cessazione', '')
        .select('id', 'stato', 'scadenza', 'stato_pre_cessazione', 'data_cessazione', 'data_trasformazione_indeterminato');
      for (const dipendente of dipendenti) {
        const fine = dataIso(dipendente.data_cessazione);
        if (!fine) continue;
        const stato = statoAllaData(dipendente, oggi);
        if (stato === dipendente.stato && fine === dipendente.data_cessazione) continue;
        await trx('dipendenti').where({ id: dipendente.id }).update({
          data_cessazione: fine,
          ...(stato === dipendente.stato ? {} : { stato, stato_pre_cessazione: statoContrattuale(dipendente) })
        });
      }
    }).then(() => { ultimoGiorno = oggi; }).finally(() => { inCorso = null; });
    await inCorso;
  };
}

module.exports = { dataIso, statoAllaData, inizializzaCessazioniDipendenti, registraCessazioneDipendente, creaAggiornamentoCessazioni };
