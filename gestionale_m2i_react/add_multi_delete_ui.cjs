const fs = require('fs');

let content = fs.readFileSync('src/pages/Commerciale/Fatture.jsx', 'utf8');

// Import
content = content.replace("confermaFattureXml } from", "confermaFattureXml, eliminaFattureMulti } from");

// State
content = content.replace("const [stato, setStato] = useState('Tutte');",
`const [stato, setStato] = useState('Tutte');
    const [selectedFatture, setSelectedFatture] = useState([]);`);
    
// Button
content = content.replace(`              <Upload className="w-5 h-5" />
              Importa XML Massivo
            </label>`,
`              <Upload className="w-5 h-5" />
              Importa XML Massivo
            </label>
            {selectedFatture.length > 0 && (
              <button
                onClick={async () => {
                  if (confirm(\`Vuoi eliminare \${selectedFatture.length} fatture?\`)) {
                    try {
                      await eliminaFattureMulti(selectedFatture);
                      setSelectedFatture([]);
                      caricaDati();
                    } catch (e) {
                      setModalState({ isOpen: true, type: 'error', message: e.message });
                    }
                  }
                }}
                className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Elimina Selezionate
              </button>
            )}`);

// DataTable props
content = content.replace(`        <DataTable 
          data={fattureFiltrate}
          columns={columns}
          searchPlaceholder="Cerca per numero, cliente..."
          itemsPerPage={15}
        />`,
`        <DataTable 
          data={fattureFiltrate}
          columns={columns}
          searchPlaceholder="Cerca per numero, cliente..."
          itemsPerPage={15}
          selectable={true}
          selectedRows={selectedFatture}
          onSelectionChange={setSelectedFatture}
        />`);

fs.writeFileSync('src/pages/Commerciale/Fatture.jsx', content);
