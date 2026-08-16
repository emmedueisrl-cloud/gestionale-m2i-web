import React, { useState, useEffect } from 'react';
import { FileStack, Download, Search, Printer, ArrowLeft, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { recuperaDatiCompletiDipendente } from '../../api/dipendenti';
import { recuperaModuliStandard, uploadModuloStandard, eliminaModuloStandard } from '../../api/azienda';
import ModuloChiaviForm from '../../components/moduli/ModuloChiaviForm';
import PrintableModuloChiavi from '../../components/moduli/PrintableModuloChiavi';
import ModuloAssunzioneForm from '../../components/moduli/ModuloAssunzioneForm';
import PrintableContrattoAssunzione from '../../components/moduli/PrintableContrattoAssunzione';
import ModernModal from '../../components/ui/ModernModal';

export default function ModuliDipendenti() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dipendenteId = searchParams.get('id');

  const [dipendenteData, setDipendenteData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // State per gestire i moduli compilabili
  const [isChiaviFormOpen, setIsChiaviFormOpen] = useState(false);
  const [chiaviFormData, setChiaviFormData] = useState(null);
  
  const [isAssunzioneFormOpen, setIsAssunzioneFormOpen] = useState(false);
  const [assunzioneFormData, setAssunzioneFormData] = useState(null);

  const [printMode, setPrintMode] = useState(false);

  const [moduliStandard, setModuliStandard] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });

  const moduliAutoCompilabili = [
    { 
      id: 'chiavi', 
      nome: "Verbale di Affidamento Chiavi", 
      icon: <KeyRound className="w-5 h-5 text-amber-400" />,
      descrizione: "Auto-compila il modulo di consegna chiavi al dipendente."
    },
    {
      id: 'assunzione',
      nome: "Lettera di Assunzione (Contratto)",
      icon: <FileStack className="w-5 h-5 text-indigo-400" />,
      descrizione: "Auto-compila la lettera di assunzione prelevando i dati dal database."
    }
  ];

  useEffect(() => {
    loadModuli();
    if (dipendenteId) {
      loadDipendente();
    }
  }, [dipendenteId]);

  const loadModuli = async () => {
    try {
      const data = await recuperaModuliStandard();
      setModuliStandard(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      await uploadModuloStandard(file, file.name);
      await loadModuli();
    } catch (err) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore durante il caricamento del modulo',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    } finally {
      setIsUploading(false);
      e.target.value = null; // Reset input
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Sei sicuro di voler eliminare questo modulo?')) {
      try {
        await eliminaModuloStandard(id);
        await loadModuli();
      } catch (err) {
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Attenzione',
          content: 'Errore durante l\'eliminazione',
          primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
        });
      }
    }
  };

  const loadDipendente = async () => {
    setIsLoading(true);
    try {
      const data = await recuperaDatiCompletiDipendente(dipendenteId);
      setDipendenteData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateChiavi = (formData, aziendaData) => {
    setIsChiaviFormOpen(false);
    setChiaviFormData({ formData, dipendenteData, aziendaData });
    setPrintMode('chiavi');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleGenerateAssunzione = (formData, aziendaData) => {
    setIsAssunzioneFormOpen(false);
    setAssunzioneFormData({ formData, dipendenteData, aziendaData });
    setPrintMode('assunzione');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  useEffect(() => {
    const handleAfterPrint = () => setPrintMode(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  if (printMode === 'chiavi') {
    return (
      <PrintableModuloChiavi 
        formData={chiaviFormData.formData}
        dipendenteData={chiaviFormData.dipendenteData}
        aziendaData={chiaviFormData.aziendaData}
        indirizzoStampa={chiaviFormData.formData.indirizzoImmobile}
      />
    );
  }

  if (printMode === 'assunzione') {
    return (
      <PrintableContrattoAssunzione
        formData={assunzioneFormData.formData}
        dipendenteData={assunzioneFormData.dipendenteData}
        aziendaData={assunzioneFormData.aziendaData}
      />
    );
  }

  // ----------------------------------------------------
  // VISTA NORMALE
  // ----------------------------------------------------
  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6 h-[calc(100vh-100px)]">
      
      {/* Header dinamico */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
            <FileStack className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-50">
              {dipendenteData ? `Moduli per ${dipendenteData.nome} ${dipendenteData.cognome}` : 'Libreria Moduli Standard'}
            </h1>
            <p className="text-slate-400 text-sm">
              {dipendenteData ? 'Seleziona un modulo per l\'autocompilazione' : 'Documentazione base da consegnare ai dipendenti'}
            </p>
          </div>
        </div>
        
        {dipendenteData && (
          <button 
            onClick={() => navigate('/admin/dipendenti/lista')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna alla lista
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-6">
        
        {/* SEZIONE 1: Moduli Auto-Compilabili (solo se dipendente selezionato) */}
        {dipendenteData && (
          <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-900/50">
              <h2 className="font-semibold text-slate-200">Moduli Auto-Compilabili</h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {moduliAutoCompilabili.map(mod => (
                <div 
                  key={mod.id} 
                  className="p-4 rounded-xl border border-slate-700 bg-slate-900/50 hover:bg-slate-700/50 transition-colors group flex flex-col"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-slate-900 transition-colors">
                      {mod.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-200 mb-1">{mod.nome}</h3>
                      <p className="text-xs text-slate-400">{mod.descrizione}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (mod.id === 'chiavi') setIsChiaviFormOpen(true);
                      if (mod.id === 'assunzione') setIsAssunzioneFormOpen(true);
                    }}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 py-2.5 rounded-lg transition-colors border border-indigo-500/20"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Compila e Stampa</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEZIONE 2: Libreria Standard (Sempre visibile o visibile sotto) */}
        {!dipendenteData && (
          <div className="flex-1 bg-slate-800 rounded-2xl shadow-sm border border-slate-700 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex flex-wrap gap-4 justify-between items-center">
              <h2 className="font-semibold text-slate-200">Moduli Standard Scaricabili</h2>
              <div className="flex gap-4 w-full md:w-auto flex-wrap">
                <div className="relative max-w-xs w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca modulo standard..."
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <label className="flex items-center justify-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer transition-colors text-sm font-medium">
                  <Plus className="w-4 h-4" />
                  {isUploading ? 'Caricamento...' : 'Carica Modulo'}
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={handleUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
            
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {moduliStandard.filter(m => m.nome.toLowerCase().includes(searchQuery.toLowerCase())).map(modulo => (
                <div key={modulo.id} className="p-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700/50 transition-colors group flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      modulo.tipo === 'PDF' ? 'bg-red-500/20 text-red-400' : 
                      modulo.tipo === 'DOCX' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {modulo.tipo}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => window.open((import.meta.env.VITE_API_URL || 'http://localhost:3000')  + modulo.url, '_blank')}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-900 rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-slate-700 hover:border-indigo-500/30 shadow-sm"
                        title="Scarica/Visualizza"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(modulo.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-900 rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-slate-700 hover:border-red-500/30 shadow-sm"
                        title="Elimina Modulo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-slate-200 mb-1 leading-snug flex-1">{modulo.nome}</h3>
                  
                  <div className="flex items-center justify-between mt-4 text-xs text-slate-500 font-medium">
                    <span>Aggiornato: {modulo.data_caricamento}</span>
                    <span>{modulo.dimensione}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Modal Form Inserimento Dati */}
      {dipendenteData && (
        <ModuloChiaviForm 
          isOpen={isChiaviFormOpen}
          onClose={() => setIsChiaviFormOpen(false)}
          dipendenteData={dipendenteData}
          onGenerate={handleGenerateChiavi}
        />
      )}

      {dipendenteData && (
        <ModuloAssunzioneForm
          isOpen={isAssunzioneFormOpen}
          onClose={() => setIsAssunzioneFormOpen(false)}
          dipendenteData={dipendenteData}
          onGenerate={handleGenerateAssunzione}
        />
      )}

      <ModernModal 
        {...alertModal}
        onClose={() => setAlertModal({ isOpen: false })}
      />
    </div>
  );
}
