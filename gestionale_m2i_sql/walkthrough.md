# Walkthrough: Pipeline CRM Commerciale & Automazione Onboarding

Ho completato il rilascio del modulo CRM integrato.

---

## Modifiche Apportate

### 1. Database CRM (Nuovi Fogli)
- **`Anagrafica Outbound GS`**: Creato con record di prova.
- **`Anagrafica Commerciali GS`**: Creato con record di prova.
- **`Pipeline Commerciale GS`**: Gestisce lo stato globale dei lead/opportunità e la cronologia delle note storiche.
- **`Appuntamenti Commerciali GS`**: Registra pianificazioni, conferme TL, esiti ed assegnazioni richiamo.
- **`Preventivi Commerciali GS`**: Associa preventivi multipli con descrizione e importo ai lead.

### 2. Codice Backend (`A.CrmCommerciale.js`)
- Gestisce i salvataggi dei lead/appuntamenti, le modifiche agli stati di conferma TL e l'invio dei report di visita del commerciale.
- **Onboarding Automatico (`promuoviLeadAdAmministrazione`)**: Quando un contratto viene contrassegnato come firmato dalla TL, inserisce in automatico il cliente nel foglio amministrativo **`Anagrafica Clienti GS`** calcolando il progressivo ID Cliente (es. C0015) ed evitando la doppia digitazione manuale delle informazioni.

### 3. Interfaccia Dashboard (`CrmCommerciale.html`)
- Interfaccia responsive divisa in tre viste separate ed operative:
  - **Outbound**: Form inserimento lead ed elenco dei richiami telefonici giornalieri.
  - **Team Leader**: Gestione conferme telefoniche giornaliere e modulo per creare preventivi o fare onboarding dei contratti.
  - **Commerciale**: Calendario impegni ed inserimento dei report di visita.

### 4. Menu e Sidebar (`A.Menu.gs` & `Home.html`)
- Inserita la voce di menu **`💼 Pipeline CRM Commerciale`** sotto *Area Commerciale*.
- Aggiunta la card rapida **`Pipeline CRM Commerciale`** nella sidebar Home.

---

## Piano di Verifica Superato
1. **Push su Apps Script**: Tutti i 55 file sono stati sincronizzati correttamente tramite `clasp push`.
2. **Test Workflow Completo**:
   - Inserendo un lead nella vista Outbound, questo viene pianificato.
   - Nella vista TL, l'appuntamento viene confermato per domani.
   - Nella vista Commerciale, l'agente inserisce un report di sopralluogo indicando "Contratto Firmato".
   - Nella vista TL, l'opportunità viene caricata e, cliccando su "Firma Contratto & Invia ad Amministrazione", il cliente viene inserito all'istante in anagrafica clienti con la tariffa corretta.
