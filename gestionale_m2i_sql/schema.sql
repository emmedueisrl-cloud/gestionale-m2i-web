CREATE TABLE dipendenti (
    id TEXT PRIMARY KEY,
    cognome TEXT NOT NULL,
    nome TEXT NOT NULL,
    codice_fiscale TEXT UNIQUE NOT NULL,
    data_nascita TEXT,
    comune_nascita TEXT,
    provincia_nascita TEXT,
    indirizzo TEXT,
    citta TEXT,
    cap TEXT,
    telefono TEXT,
    email TEXT,
    iban TEXT,
    data_assunzione TEXT NOT NULL,
    scadenza TEXT,
    livello_inquadramento TEXT,
    ruolo TEXT,
    mansione TEXT,
    stato TEXT DEFAULT 'Determinato',
    paga_oraria_reale REAL DEFAULT 0.0,
    data_trasformazione_indeterminato TEXT,
    data_cessazione TEXT,
    note TEXT,
    allegato_documenti TEXT,
    allegato_contratto TEXT,
    data_creazione TEXT DEFAULT CURRENT_TIMESTAMP,
    creato_da TEXT
, `tipo_paga` varchar(255) default 'Oraria', `allegato_unilav` varchar(255), cestinato INTEGER DEFAULT 0, `note_fisse_elaborato` text, `divisione` varchar(255) default 'Esterno', is_caposquadra INTEGER DEFAULT 0);

CREATE TABLE clienti (
    id TEXT PRIMARY KEY,
    ragione_sociale TEXT NOT NULL,
    partita_iva TEXT UNIQUE NOT NULL,
    sede_legale TEXT,
    sede_operativa TEXT,
    telefono TEXT,
    email TEXT,
    referente TEXT,
    telefono_referente TEXT,
    tariffa_oraria_operatore REAL DEFAULT 0.0,
    tariffa_oraria_commerciale REAL DEFAULT 0.0,
    data_firma_contratto TEXT,
    scadenza_contratto TEXT,
    tipo_contratto TEXT DEFAULT 'Rinnovo Tacito',
    metodo_pagamento TEXT,
    iban TEXT,
    allegato_contratto_cliente TEXT,
    possesso_chiavi TEXT DEFAULT 'NO',
    copie INTEGER DEFAULT 0,
    in_possesso_di TEXT,
    attivo TEXT DEFAULT 'SI',
    data_cessazione TEXT,
    note TEXT,
    data_creazione TEXT DEFAULT CURRENT_TIMESTAMP,
    creato_da TEXT
, foto_servizio TEXT DEFAULT '[]', codice_fiscale TEXT, indirizzo_sede TEXT, civico_sede TEXT, cap TEXT, citta TEXT, provincia TEXT, pec TEXT, codice_sdi TEXT, banca TEXT, titolare TEXT, telefono_titolare TEXT, ruolo_referente TEXT, cestinato INTEGER DEFAULT 0, `note_chiavi` text, operatore TEXT, commerciale TEXT, quotazione_importo REAL, quotazione_tipo TEXT, operatore_assegnato TEXT, tipo_tassazione TEXT, tassazione_altro TEXT, percentuale_tassazione REAL, nome_attivita TEXT, email_secondaria TEXT, `note_fisse_elaborato` text);

CREATE TABLE clienti_periodi_attivita (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id TEXT NOT NULL REFERENCES clienti(id) ON DELETE RESTRICT,
    data_inizio TEXT,
    data_fine TEXT,
    CHECK (data_inizio IS NULL OR data_fine IS NULL OR data_inizio <= data_fine)
);
CREATE UNIQUE INDEX idx_clienti_periodi_aperti ON clienti_periodi_attivita(cliente_id) WHERE data_fine IS NULL;

CREATE TABLE registro_ore (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    dipendente_id TEXT REFERENCES dipendenti(id) ON DELETE RESTRICT,
    cliente_id TEXT REFERENCES clienti(id) ON DELETE RESTRICT,
    giorno_1 REAL DEFAULT 0,
    giorno_2 REAL DEFAULT 0,
    giorno_3 REAL DEFAULT 0,
    giorno_4 REAL DEFAULT 0,
    giorno_5 REAL DEFAULT 0,
    giorno_6 REAL DEFAULT 0,
    giorno_7 REAL DEFAULT 0,
    giorno_8 REAL DEFAULT 0,
    giorno_9 REAL DEFAULT 0,
    giorno_10 REAL DEFAULT 0,
    giorno_11 REAL DEFAULT 0,
    giorno_12 REAL DEFAULT 0,
    giorno_13 REAL DEFAULT 0,
    giorno_14 REAL DEFAULT 0,
    giorno_15 REAL DEFAULT 0,
    giorno_16 REAL DEFAULT 0,
    giorno_17 REAL DEFAULT 0,
    giorno_18 REAL DEFAULT 0,
    giorno_19 REAL DEFAULT 0,
    giorno_20 REAL DEFAULT 0,
    giorno_21 REAL DEFAULT 0,
    giorno_22 REAL DEFAULT 0,
    giorno_23 REAL DEFAULT 0,
    giorno_24 REAL DEFAULT 0,
    giorno_25 REAL DEFAULT 0,
    giorno_26 REAL DEFAULT 0,
    giorno_27 REAL DEFAULT 0,
    giorno_28 REAL DEFAULT 0,
    giorno_29 REAL DEFAULT 0,
    giorno_30 REAL DEFAULT 0,
    giorno_31 REAL DEFAULT 0,
    ore_totali REAL DEFAULT 0,
    costo_totale REAL DEFAULT 0,
    causale_assenza TEXT,
    note TEXT
, metodo_inserimento TEXT DEFAULT 'Calendarizzata');

CREATE TABLE fatture (
    id TEXT PRIMARY KEY,
    numero_fattura TEXT NOT NULL,
    data_fattura TEXT NOT NULL,
    cliente_id TEXT REFERENCES clienti(id) ON DELETE RESTRICT,
    importo_imponibile REAL NOT NULL,
    aliquota_iva REAL DEFAULT 22.0,
    importo_iva REAL NOT NULL,
    importo_totale REAL NOT NULL,
    stato_pagamento TEXT DEFAULT 'Da Pagare',
    data_scadenza TEXT,
    data_pagamento TEXT,
    importo_pagato REAL DEFAULT 0,
    allegato_fattura TEXT,
    note TEXT,
    data_creazione TEXT DEFAULT CURRENT_TIMESTAMP,
    creato_da TEXT
);

CREATE TABLE buste_paga (
    id TEXT PRIMARY KEY,
    dipendente_id TEXT REFERENCES dipendenti(id) ON DELETE RESTRICT,
    mese TEXT NOT NULL,
    anno TEXT NOT NULL,
    importo_netto REAL NOT NULL,
    allegato_busta_paga TEXT,
    note TEXT,
    data_creazione TEXT DEFAULT CURRENT_TIMESTAMP,
    creato_da TEXT
, `email_inviata` integer default '0', `data_invio_email` text);

CREATE TABLE programma_fisso (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dipendente_id TEXT REFERENCES dipendenti(id) ON DELETE CASCADE,
    giorno_settimana TEXT NOT NULL,
    ora_inizio TEXT NOT NULL,
    ora_fine TEXT NOT NULL,
    cliente_id TEXT REFERENCES clienti(id) ON DELETE RESTRICT,
    note TEXT
, frequenza TEXT DEFAULT 'Settimanale');

CREATE TABLE agenda_caposquadra (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dipendente_id TEXT REFERENCES dipendenti(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    ora_inizio TEXT NOT NULL,
    ora_fine TEXT NOT NULL,
    cliente_id TEXT REFERENCES clienti(id) ON DELETE RESTRICT,
    colore TEXT DEFAULT '#3b82f6',
    tipo_impegno TEXT,
    attivita TEXT,
    nome_referente TEXT,
    indirizzo TEXT,
    luogo_acquisto TEXT,
    nominativo_appuntamento TEXT,
    luogo_appuntamento TEXT,
    note TEXT
);

CREATE TABLE preventivi (
    id TEXT PRIMARY KEY,
    numero_preventivo TEXT NOT NULL,
    data_preventivo TEXT NOT NULL,
    cliente_prospect_id TEXT,
    ragione_sociale_prospect TEXT NOT NULL,
    indirizzo_locali TEXT,
    costo_mensile REAL DEFAULT 0.0,
    commerciale TEXT,
    servizi_inclusi TEXT,
    stato TEXT DEFAULT 'In Attesa',
    allegato_preventivo TEXT,
    appuntamento_id INTEGER,
    data_creazione TEXT DEFAULT CURRENT_TIMESTAMP,
    creato_da TEXT
, `tipo_prezzo` varchar(255) default 'Mensile');

CREATE TABLE appuntamenti_preventivi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_ora TEXT NOT NULL,
    nominativo TEXT NOT NULL,
    incaricato TEXT NOT NULL DEFAULT '',
    commerciale_dipendente_id TEXT,
    attivita TEXT NOT NULL DEFAULT '',
    luogo TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    stato TEXT NOT NULL DEFAULT 'Programmato',
    esito TEXT NOT NULL DEFAULT '',
    scheda_pdf TEXT,
    origine_pubblica INTEGER NOT NULL DEFAULT 0,
    agenda_impegno_id INTEGER,
    senza_orario INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_appuntamenti_preventivi_data ON appuntamenti_preventivi(data_ora);
CREATE UNIQUE INDEX idx_appuntamenti_preventivi_agenda ON appuntamenti_preventivi(agenda_impegno_id);

CREATE TABLE crm_outbound (
    id_operatore TEXT PRIMARY KEY,
    cognome TEXT NOT NULL,
    nome TEXT NOT NULL,
    telefono TEXT,
    attivo TEXT DEFAULT 'SI',
    data_creazione TEXT
);

CREATE TABLE crm_commerciali (
    id_commerciale TEXT PRIMARY KEY,
    cognome TEXT NOT NULL,
    nome TEXT NOT NULL,
    telefono TEXT,
    attivo TEXT DEFAULT 'SI',
    data_creazione TEXT
);

CREATE TABLE crm_pipeline (
    id_lead TEXT PRIMARY KEY,
    data_creazione TEXT NOT NULL,
    ragione_sociale TEXT NOT NULL,
    referente TEXT,
    telefono TEXT,
    email TEXT,
    indirizzo TEXT,
    citta TEXT,
    id_outbound TEXT REFERENCES crm_outbound(id_operatore) ON DELETE SET NULL,
    stato TEXT DEFAULT 'Contatto Iniziale',
    note_storiche TEXT
);

CREATE TABLE crm_appuntamenti_commerciali (
    id_appuntamento TEXT PRIMARY KEY,
    id_lead TEXT REFERENCES crm_pipeline(id_lead) ON DELETE CASCADE,
    data_ora TEXT NOT NULL,
    id_commerciale TEXT REFERENCES crm_commerciali(id_commerciale) ON DELETE SET NULL,
    conferma_tl TEXT DEFAULT 'NO',
    esito TEXT,
    report_note TEXT,
    assegna_richiamo TEXT DEFAULT 'NO',
    data_richiamo TEXT
);

CREATE TABLE crm_preventivi_commerciali (
    id_preventivo TEXT PRIMARY KEY,
    id_lead TEXT REFERENCES crm_pipeline(id_lead) ON DELETE CASCADE,
    descrizione_servizi TEXT,
    importo_imponibile REAL NOT NULL,
    stato TEXT DEFAULT 'Inviato',
    link_drive TEXT,
    data_creazione TEXT
);

CREATE TABLE mesi_chiusi_dipendenti (
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    stato TEXT DEFAULT 'Chiuso',
    data_chiusura TEXT DEFAULT CURRENT_TIMESTAMP,
    chiuso_da TEXT,
    PRIMARY KEY (mese, anno)
);

CREATE TABLE dettaglio_mesi_chiusi_dipendenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    dipendente_id TEXT REFERENCES dipendenti(id) ON DELETE RESTRICT,
    cognome_nome TEXT NOT NULL,
    paga_registrata TEXT,
    paga_oraria REAL,
    paga_mensile REAL,
    ore_lavorate REAL,
    ore_ferie REAL,
    ore_permessi REAL,
    ore_malattia REAL,
    paga_lavorato REAL,
    paga_ferie_permessi_malattia REAL,
    detrazioni REAL,
    maggiorazioni REAL,
    note_generali TEXT,
    nota_fissa_storica TEXT,
    nota_mensile_storica TEXT,
    da_pagare REAL,
    stipendio_netto REAL,
    paga_oraria_reale REAL,
    data_chiusura TEXT DEFAULT CURRENT_TIMESTAMP,
    chiuso_da TEXT,
    FOREIGN KEY (mese, anno) REFERENCES mesi_chiusi_dipendenti(mese, anno) ON DELETE CASCADE
);

CREATE TABLE mesi_chiusi_clienti (
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    stato TEXT DEFAULT 'Chiuso',
    data_chiusura TEXT DEFAULT CURRENT_TIMESTAMP,
    chiuso_da TEXT,
    PRIMARY KEY (mese, anno)
);

CREATE TABLE dettaglio_mesi_chiusi_clienti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    cliente_id TEXT REFERENCES clienti(id) ON DELETE RESTRICT,
    ragione_sociale TEXT NOT NULL,
    tipo_fatturazione TEXT,
    valore_contrattuale REAL,
    ore_lavorate REAL,
    base_imponibile REAL,
    sconti REAL,
    maggiorazioni REAL,
    imponibile REAL,
    aliquota_iva REAL,
    importo_iva REAL,
    importo_totale REAL,
    note TEXT,
    nota_fissa_storica TEXT,
    nota_mensile_storica TEXT,
    data_chiusura TEXT DEFAULT CURRENT_TIMESTAMP,
    chiuso_da TEXT,
    FOREIGN KEY (mese, anno) REFERENCES mesi_chiusi_clienti(mese, anno) ON DELETE CASCADE
);

CREATE TABLE mesi_chiusi_provvigioni (
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    data_chiusura TEXT DEFAULT CURRENT_TIMESTAMP,
    chiuso_da TEXT,
    perc_commerciale REAL DEFAULT 10.0,
    perc_operatore REAL DEFAULT 1.0,
    PRIMARY KEY (mese, anno)
);

CREATE TABLE dettaglio_mesi_chiusi_provvigioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    cliente_id TEXT REFERENCES clienti(id) ON DELETE RESTRICT,
    ragione_sociale TEXT NOT NULL,
    imponibile_cliente REAL,
    costo_dipendenti REAL,
    utile REAL,
    commerciale TEXT,
    perc_comm REAL,
    regolazione_comm REAL,
    provvigione_comm_totale REAL,
    operatore TEXT,
    perc_oper REAL,
    regolazione_oper REAL,
    provvigione_oper_totale REAL,
    data_chiusura TEXT DEFAULT CURRENT_TIMESTAMP,
    chiuso_da TEXT,
    FOREIGN KEY (mese, anno) REFERENCES mesi_chiusi_provvigioni(mese, anno) ON DELETE CASCADE
);

CREATE TABLE log_attivita (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    categoria TEXT,
    icona TEXT,
    colore TEXT,
    descrizione TEXT,
    eseguito_da TEXT
);

CREATE TABLE autodiagnosi_errori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT NOT NULL UNIQUE,
    area TEXT NOT NULL,
    operazione TEXT NOT NULL,
    messaggio TEXT NOT NULL,
    spiegazione TEXT NOT NULL,
    causa TEXT NOT NULL,
    soluzione TEXT NOT NULL,
    gravita TEXT NOT NULL DEFAULT 'errore',
    stato TEXT NOT NULL DEFAULT 'nuovo',
    occorrenze INTEGER NOT NULL DEFAULT 1,
    prima_occorrenza TEXT NOT NULL,
    ultima_occorrenza TEXT NOT NULL,
    ultimo_contesto TEXT,
    risolto_at TEXT,
    aggiornato_da TEXT
);

CREATE TABLE regolazioni_stipendi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    dipendente_id TEXT REFERENCES dipendenti(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, 
    importo REAL NOT NULL,
    motivazione TEXT,
    data_creazione TEXT DEFAULT CURRENT_TIMESTAMP,
    creato_da TEXT
);

CREATE TABLE regolazioni_clienti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    cliente_id TEXT REFERENCES clienti(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, 
    importo REAL NOT NULL,
    motivazione TEXT,
    data_creazione TEXT DEFAULT CURRENT_TIMESTAMP,
    creato_da TEXT
);

CREATE TABLE regolazioni_provvigioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id TEXT REFERENCES clienti(id) ON DELETE CASCADE,
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    regolazione_comm REAL DEFAULT 0.0,
    regolazione_oper REAL DEFAULT 0.0,
    note TEXT
);

CREATE TABLE proroghe_contratti (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    dipendente_id varchar(255),
    scadenza_precedente varchar(255),
    nuova_scadenza varchar(255),
    note varchar(255),
    data_proroga datetime default CURRENT_TIMESTAMP,
    FOREIGN KEY(dipendente_id) REFERENCES dipendenti(id) ON DELETE CASCADE
);

CREATE TABLE `chiavi_assegnazioni` (`id` integer not null primary key autoincrement, `cliente_id` varchar(255) not null, `dipendente_id` varchar(255), `assegnato_a_testo` varchar(255), `num_copia` integer not null default '1', `data_assegnazione` varchar(255) not null, `modulo_cliente_path` varchar(255), `modulo_dipendente_path` varchar(255), `attivo` integer default '1', `data_restituzione` varchar(255), `note` text, indirizzo varchar(255), foreign key(`cliente_id`) references `clienti`(`id`) on delete CASCADE, foreign key(`dipendente_id`) references `dipendenti`(`id`) on delete SET NULL);

CREATE TABLE m2i_azienda_dati (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ragione_sociale TEXT,
      sede_legale TEXT,
      sede_operativa TEXT,
      pec TEXT,
      email TEXT,
      telefono TEXT,
      rea TEXT,
      partita_iva TEXT,
      codice_fiscale TEXT,
      forma_giuridica TEXT,
      data_costituzione TEXT,
      amministratore_unico TEXT,
      capitale_sociale TEXT,
      codice_ateco TEXT,
      timbro_path TEXT
    );

CREATE TABLE m2i_azienda_documenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      file_path TEXT,
      data_caricamento TEXT
    );

CREATE TABLE note_elaborati (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  soggetto_id TEXT NOT NULL,
  mese INTEGER NOT NULL,
  anno INTEGER NOT NULL,
  testo TEXT DEFAULT '',
  data_modifica TEXT DEFAULT (datetime('now')),
  UNIQUE(tipo, soggetto_id, mese, anno)
);

CREATE TABLE periodi_elaborati (
  tipo TEXT NOT NULL, mese INTEGER NOT NULL, anno INTEGER NOT NULL,
  elenco_confermato_at TEXT NOT NULL,
  PRIMARY KEY (tipo, mese, anno)
);

CREATE TABLE righe_attese_elaborati (
  tipo TEXT NOT NULL, mese INTEGER NOT NULL, anno INTEGER NOT NULL,
  soggetto_id TEXT NOT NULL,
  PRIMARY KEY (tipo, mese, anno, soggetto_id)
);

CREATE TABLE righe_bloccate_elaborati (
  tipo TEXT NOT NULL, mese INTEGER NOT NULL, anno INTEGER NOT NULL,
  soggetto_id TEXT NOT NULL, snapshot TEXT NOT NULL, bloccata_at TEXT NOT NULL,
  PRIMARY KEY (tipo, mese, anno, soggetto_id)
);

CREATE TABLE fatture_aruba_elaborati (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id TEXT NOT NULL REFERENCES clienti(id) ON DELETE RESTRICT, mese INTEGER NOT NULL, anno INTEGER NOT NULL,
  numero_fattura TEXT NOT NULL, data_fattura TEXT NOT NULL,
  importo_totale REAL NOT NULL, allegato_path TEXT,
  registrata_at TEXT NOT NULL, registrata_da INTEGER,
  fattura_id TEXT UNIQUE REFERENCES fatture(id) ON DELETE SET NULL,
  UNIQUE (cliente_id, numero_fattura, data_fattura)
);

CREATE TABLE fatture_inviate_elaborati (
  cliente_id TEXT NOT NULL REFERENCES clienti(id) ON DELETE RESTRICT,
  mese INTEGER NOT NULL, anno INTEGER NOT NULL,
  inviata_at TEXT NOT NULL, inviata_da INTEGER,
  PRIMARY KEY (cliente_id, mese, anno)
);

CREATE TABLE rettifiche_fatture_aruba (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registrazione_id INTEGER NOT NULL REFERENCES fatture_aruba_elaborati(id) ON DELETE RESTRICT,
  precedente TEXT NOT NULL, successivo TEXT NOT NULL,
  fonte TEXT NOT NULL, rettificata_at TEXT NOT NULL, rettificata_da INTEGER
);

CREATE TABLE pagamenti_elaborati_dipendenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dipendente_id TEXT NOT NULL REFERENCES dipendenti(id) ON DELETE RESTRICT, mese INTEGER NOT NULL, anno INTEGER NOT NULL,
  importo_netto REAL NOT NULL, pagato_at TEXT NOT NULL, registrato_da INTEGER,
  UNIQUE (dipendente_id, mese, anno)
);

CREATE TABLE `magazzino_attrezzature` (`id` varchar(255), `codice_custom` varchar(255), `nome` varchar(255) not null, `descrizione` text, `foto` varchar(255), `cliente_id` varchar(255), `data_assegnazione` varchar(255), `data_creazione` varchar(255), foreign key(`cliente_id`) references `clienti`(`id`), primary key (`id`));

CREATE TABLE configurazioni (chiave TEXT PRIMARY KEY, valore TEXT);

CREATE TABLE configurazione_email (
        chiave TEXT PRIMARY KEY,
        valore TEXT NOT NULL
      );

CREATE TABLE emails (
        id TEXT PRIMARY KEY,
        data_invio TEXT NOT NULL,
        mittente TEXT NOT NULL,
        destinatario TEXT NOT NULL,
        oggetto TEXT NOT NULL,
        corpo TEXT NOT NULL,
        tipo TEXT NOT NULL,
        stato TEXT NOT NULL,
        id_dipendente TEXT,
        id_cliente TEXT,
        cartella TEXT DEFAULT 'inbox',
        letto INTEGER DEFAULT 0,
        preferito INTEGER DEFAULT 0,
        data_posticipato TEXT,
        allegati TEXT,
        FOREIGN KEY (id_dipendente) REFERENCES dipendenti(id) ON DELETE SET NULL,
        FOREIGN KEY (id_cliente) REFERENCES clienti(id) ON DELETE SET NULL
      );

CREATE TABLE moduli_standard (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, tipo TEXT, data_caricamento TEXT, url TEXT, dimensione TEXT);
