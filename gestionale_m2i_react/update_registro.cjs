const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Ore', 'RegistroOre.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Aggiunta degli stati
const stateAnchor = "const [resetModalOpen, setResetModalOpen] = useState(false);";
const newStates = `const [resetModalOpen, setResetModalOpen] = useState(false);
  const [scaricaModalOpen, setScaricaModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dipendente_id', idDipendente);
    formData.append('mese', mese);
    formData.append('anno', anno);
    
    try {
      const res = await fetch('http://localhost:3000/api/excel/carica-presenze', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      setModalState({ isOpen: true, type: 'success', message: 'Dati importati con successo!' });
      inizializza(); // Ricarica la griglia
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: err.message || 'Errore durante il caricamento' });
    } finally {
      setIsUploading(false);
      e.target.value = null; // reseta l'input
    }
  };`;

content = content.replace(stateAnchor, newStates);

// Aggiunta icone Upload e Download
content = content.replace("import { CalendarDays, Save, Plus, Trash2, Download, Loader2, RefreshCw, AlertTriangle, ListTodo, Edit } from 'lucide-react';", 
"import { CalendarDays, Save, Plus, Trash2, Download, Upload, Loader2, RefreshCw, AlertTriangle, ListTodo, Edit, FileSpreadsheet } from 'lucide-react';");

// Modifica pulsanti: cerca il vecchio pulsante "Foglio Presenze" e lo sostituisce
const vecchiPulsantiRegex = /<button[\s\S]*? Foglio Presenze\s*<\/button>/;

const nuoviPulsanti = `<button 
              onClick={() => setScaricaModalOpen(true)}
              disabled={!idDipendente}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50 transition-colors border border-emerald-500/30 ml-2"
              title="Scarica il Foglio Presenze in formato Excel"
            >
              <FileSpreadsheet className="w-4 h-4" /> Scarica Excel
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={!idDipendente || isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-600/30 disabled:opacity-50 transition-colors border border-indigo-500/30 ml-2"
              title="Carica un Foglio Presenze Excel precedentemente compilato"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Carica Excel
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
            />`;

content = content.replace(vecchiPulsantiRegex, nuoviPulsanti);

// Aggiunta del modale "Scarica Presenze" alla fine, prima dell'ultimo </div>
const modaleScarica = `      {/* Modale Scarica Presenze Excel */}
      <ModernModal
        isOpen={scaricaModalOpen}
        onClose={() => setScaricaModalOpen(false)}
        type="info"
        title="Scarica Foglio Presenze"
        subtitle="Il file deve includere clienti ed ore come da programma settimanale dell'operatore?"
        primaryAction={{
          label: "Sì, precompila",
          onClick: () => {
            window.open(\`http://localhost:3000/api/excel/scarica-presenze?mese=\${mese}&anno=\${anno}&dipendente_id=\${idDipendente}&precompila=true\`);
            setScaricaModalOpen(false);
          }
        }}
        secondaryAction={{
          label: "No, vuoto",
          onClick: () => {
            window.open(\`http://localhost:3000/api/excel/scarica-presenze?mese=\${mese}&anno=\${anno}&dipendente_id=\${idDipendente}&precompila=false\`);
            setScaricaModalOpen(false);
          }
        }}
      />
`;
const lastDivIndex = content.lastIndexOf('</div>');
content = content.substring(0, lastDivIndex) + modaleScarica + content.substring(lastDivIndex);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fatto RegistroOre!');
