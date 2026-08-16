const fs = require('fs');

let content = fs.readFileSync('src/pages/Commerciale/Fatture.jsx', 'utf8');

// Add XML state
content = content.replace(
  "const [stagingData, setStagingData] = useState(null); // array di righe + clientiDisponibili",
  `const [stagingData, setStagingData] = useState(null); // array di righe + clientiDisponibili
  
  // XML Staging State
  const [xmlFiles, setXmlFiles] = useState([]);
  const [isXmlMonthModalOpen, setIsXmlMonthModalOpen] = useState(false);
  const [aggiornamentiClienti, setAggiornamentiClienti] = useState({});`
);

// Add Handlers
const handlersReplacement = `
  const handleXmlFileChange = (e) => {
    if (e.target.files.length > 0) {
      setXmlFiles(Array.from(e.target.files));
      setIsXmlMonthModalOpen(true);
    }
  };

  const handleProcessXml = async () => {
    setIsXmlMonthModalOpen(false);
    setIsLoading(true);
    try {
      const resp = await anteprimaFattureXml(xmlFiles, csvMese, csvAnno);
      if (resp.success) {
        setStagingData({ righe: resp.dati, clientiDisponibili: resp.clienti_disponibili, elaboratiDisponibili: resp.elaborati_disponibili, isXml: true });
        setAggiornamentiClienti({});
      }
    } catch (error) {
      setModalState({ isOpen: true, type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleConfirmXml = async () => {
    setIsLoading(true);
    try {
      const righe = stagingData.righe; 
      const resp = await confermaFattureXml(righe, aggiornamentiClienti);
      if (resp.success) {
        setStagingData(null);
        setModalState({ isOpen: true, type: 'success', message: 'Fatture importate con successo!' });
        loadData();
      }
    } catch (error) {
      setModalState({ isOpen: true, type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCsv = async () => {`;
  
content = content.replace("const handleConfirmCsv = async () => {", handlersReplacement);

// Buttons in Header
const uploadButtons = `
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="csvUpload"
              onChange={handleCsvFileChange}
            />
            <label
              htmlFor="csvUpload"
              className="px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Importa CSV
            </label>
            <input
              type="file"
              accept=".xml"
              multiple
              className="hidden"
              id="xmlUpload"
              onChange={handleXmlFileChange}
            />
            <label
              htmlFor="xmlUpload"
              className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Importa XML Massivo
            </label>
          </div>
`;

content = content.replace(
  /<div className="flex gap-2">[\s\S]*?<Upload className="w-5 h-5" \/>[\s\S]*?Importa CSV[\s\S]*?<\/label>[\s\S]*?<\/div>/m, 
  uploadButtons
);

// XML Modal
const xmlModal = `
      {/* MODALE SELEZIONE MESE XML */}
      {isXmlMonthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-slate-100 mb-2">Importazione Massiva XML</h3>
            <p className="text-sm text-slate-400 mb-6">A quale mese si riferiscono queste {xmlFiles.length} fatture per la quadratura dell'elaborato?</p>
            
            <div className="flex gap-4 mb-6">
              <select 
                value={csvMese} 
                onChange={(e) => setCsvMese(Number(e.target.value))}
                className="flex-1 p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {mesi.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
              <input 
                type="number" 
                value={csvAnno} 
                onChange={(e) => setCsvAnno(Number(e.target.value))}
                className="w-24 p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsXmlMonthModalOpen(false)}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-xl hover:bg-slate-600 font-medium"
              >
                Annulla
              </button>
              <button 
                onClick={handleProcessXml}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 font-bold"
              >
                Analizza XML
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace("{/* MODALE SELEZIONE MESE CSV */}", xmlModal + "\n      {/* MODALE SELEZIONE MESE CSV */}");

// Staging UI adjustments
content = content.replace(
  `<th className="pb-3 font-medium min-w-[200px]">Cliente (CSV)</th>`,
  `<th className="pb-3 font-medium min-w-[200px]">{stagingData.isXml ? 'Cliente (XML)' : 'Cliente (CSV)'}</th>`
);

content = content.replace(
  `<th className="pb-3 font-medium text-right">Importo CSV</th>`,
  `<th className="pb-3 font-medium text-right">{stagingData.isXml ? 'Importo XML' : 'Importo CSV'}</th>`
);

const buttonReplace = `
                <button 
                  onClick={stagingData.isXml ? handleConfirmXml : handleConfirmCsv}
                  disabled={!stagingData.isXml && stagingData.righe.some(r => !r.cliente_id)}
`;
content = content.replace(
  /<button[\s\S]*?onClick=\{handleConfirmCsv\}[\s\S]*?disabled=\{stagingData.righe.some\(r => !r.cliente_id\)\}/m,
  buttonReplace
);


fs.writeFileSync('src/pages/Commerciale/Fatture.jsx', content);
