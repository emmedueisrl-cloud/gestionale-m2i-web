# Linee Guida Layout Fluidi

Nello sviluppo o aggiornamento di nuove interfacce e schermate, applica rigorosamente il seguente pattern fluido e responsivo sperimentato nell'Agenda Caposquadra:

1. **Assenza di larghezze minime orizzontali rigide**: Le colonne e i contenitori di dati (come tabelle o tabelloni settimanali) non devono avere limiti fissi come min-w-[150px]. Utilizza invece flex-1 min-w-0 in modo che il contenitore possa restringersi dinamicamente e occupare il 100% dello schermo senza strabordare.
2. **Font responsivi e contenimento del testo**: Adatta i testi in base alla grandezza dello schermo tramite classi Tailwind responsive (es. text-[10px] md:text-xs). Utilizza sempre break-words, truncate, o wordBreak: break-word per impedire che testi troppo lunghi forzino la larghezza dei div spezzando il layout orizzontale.
3. **Form e azioni posizionate in basso**: Sposta i pannelli di inserimento dati (es. Form di aggiunta) o i filtri dalla tradizionale colonna laterale di destra alla **parte inferiore dello schermo** (border-t).
4. **Disposizione orizzontale dei campi**: Nei form posizionati in basso, organizza i campi di input su una riga orizzontale utilizzando grid CSS responsive, come ad esempio grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end. In questo modo non sottraggono spazio orizzontale vitale alla visualizzazione dei dati principali e lasciano respirare l'interfaccia.
