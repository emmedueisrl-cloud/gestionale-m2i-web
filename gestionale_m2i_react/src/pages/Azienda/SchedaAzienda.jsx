import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Building2, 
  FileText, 
  Upload, 
  Trash2, 
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { 
  recuperaDatiAzienda, 
  salvaDatiAzienda, 
  recuperaDocumentiAzienda, 
  uploadDocumentoAzienda 
} from '../../api/azienda';
import ModernModal from '../../components/ui/ModernModal';

export default function SchedaAzienda() {
  const [loading, setLoading] = useState(true);
  const [dati, setDati] = useState({
    ragioneSociale: '',
    sedeLegale: '',
    sedeOperativa: '',
    pec: '',
    email: '',
    telefono: '',
    rea: '',
    partitaIva: '',
    codiceFiscale: '',
    formaGiuridica: '',
    dataCostituzione: '',
    amministratoreUnico: '',
    capitaleSociale: '',
    codiceAteco: '',
    timbro_path: '',
    legaleRappresentante: '',
    indirizzoRappresentante: ''
  });
  
  const [documenti, setDocumenti] = useState([]);
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggio, setMessaggio] = useState(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });

  useEffect(() => {
    caricaDati();
  }, []);

  const caricaDati = async () => {
    try {
      setLoading(true);
      const resDati = await recuperaDatiAzienda();
      if (resDati) {
        setDati({
          ragioneSociale: resDati.ragione_sociale || '',
          sedeLegale: resDati.sede_legale || '',
          sedeOperativa: resDati.sede_operativa || '',
          pec: resDati.pec || '',
          email: resDati.email || '',
          telefono: resDati.telefono || '',
          rea: resDati.rea || '',
          partitaIva: resDati.partita_iva || '',
          codiceFiscale: resDati.codice_fiscale || '',
          formaGiuridica: resDati.forma_giuridica || '',
          dataCostituzione: resDati.data_costituzione || '',
          amministratoreUnico: resDati.amministratore_unico || '',
          capitaleSociale: resDati.capitale_sociale || '',
          codiceAteco: resDati.codice_ateco || '',
          timbro_path: resDati.timbro_path || ''
        });
      }
      const resDocs = await recuperaDocumentiAzienda();
      setDocumenti(resDocs || []);
    } catch (error) {
      console.error("Errore caricamento dati azienda:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDati(prev => ({ ...prev, [name]: value }));
  };

  const handleSalva = async () => {
    try {
      setSalvataggio(true);
      await salvaDatiAzienda(dati);
      setMessaggio({ tipo: 'success', testo: 'Dati azienda salvati con successo!' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch (error) {
      setMessaggio({ tipo: 'error', testo: 'Errore nel salvataggio.' });
    } finally {
      setSalvataggio(false);
    }
  };

  const handleUploadTimbro = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const res = await uploadDocumentoAzienda(file, 'Timbro Aziendale');
      const newPath = res.path;
      // Aggiorniamo subito il db
      await salvaDatiAzienda({ ...dati, timbro_path: newPath });
      setDati(prev => ({ ...prev, timbro_path: newPath }));
      setMessaggio({ tipo: 'success', testo: 'Timbro aggiornato con successo!' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch (error) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore caricamento timbro',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    }
  };

  const handleUploadDocumento = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const nomePersonalizzato = prompt("Inserisci il nome del documento (es. Visura Camerale):", file.name);
    if (!nomePersonalizzato) return;

    try {
      await uploadDocumentoAzienda(file, nomePersonalizzato);
      await caricaDati();
      setMessaggio({ tipo: 'success', testo: 'Documento caricato con successo!' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch (error) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore caricamento documento',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    }
  };

  const handleEliminaDocumento = async (id) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo documento?")) return;
    try {
      await eliminaDocumentoAzienda(id);
      await caricaDati();
    } catch (error) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore eliminazione documento',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    }
  };

  if (loading) return <div className="p-8 text-slate-300">Caricamento dati azienda...</div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto pb-24">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-400" />
            Dati e Documenti M2I
          </h1>
          <p className="text-slate-400 mt-2">
            Gestisci i dati della società e i documenti ufficiali (Visura, Statuto, etc.)
          </p>
        </div>
        
        <button 
          onClick={handleSalva}
          disabled={salvataggio}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {salvataggio ? 'Salvataggio...' : 'Salva Modifiche'}
        </button>
      </div>

      {messaggio && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${messaggio.tipo === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{messaggio.testo}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Dati */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
            <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700 flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h2 className="font-bold text-slate-100 uppercase tracking-wide">Dati Societari (Estratti da Visura)</h2>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Ragione Sociale</label>
                <input type="text" name="ragioneSociale" value={dati.ragioneSociale} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-100 font-bold" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Sede Legale</label>
                <input type="text" name="sedeLegale" value={dati.sedeLegale} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Sede Operativa</label>
                <input type="text" name="sedeOperativa" value={dati.sedeOperativa} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Partita IVA</label>
                <input type="text" name="partitaIva" value={dati.partitaIva} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 font-mono" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Codice Fiscale</label>
                <input type="text" name="codiceFiscale" value={dati.codiceFiscale} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 font-mono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Numero REA</label>
                <input type="text" name="rea" value={dati.rea} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 uppercase" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Forma Giuridica</label>
                <input type="text" name="formaGiuridica" value={dati.formaGiuridica} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Data Costituzione</label>
                <input type="text" name="dataCostituzione" value={dati.dataCostituzione} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Amministratore Unico</label>
                <input type="text" name="amministratoreUnico" value={dati.amministratoreUnico} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Capitale Sociale</label>
                <input type="text" name="capitaleSociale" value={dati.capitaleSociale} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Codice ATECO</label>
                <input type="text" name="codiceAteco" value={dati.codiceAteco} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">PEC</label>
                <input type="email" name="pec" value={dati.pec} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email Ordinaria</label>
                <input type="email" name="email" value={dati.email} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Telefono Aziendale</label>
                <input type="text" name="telefono" value={dati.telefono} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Destra: Timbro e Documenti */}
        <div className="space-y-8">
          
          {/* Timbro Aziendale */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
            <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-slate-100 uppercase tracking-wide">Timbro e Firma</h2>
              </div>
              <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition-colors" title="Carica nuovo timbro">
                <Upload className="w-4 h-4 text-slate-300" />
                <input type="file" className="hidden" accept="image/*" onChange={handleUploadTimbro} />
              </label>
            </div>
            <div className="p-6 flex flex-col items-center justify-center min-h-[200px] bg-slate-900/30">
              {dati.timbro_path ? (
                <div className="relative group">
                  <img src={`/${dati.timbro_path}?t=${new Date().getTime()}`} alt="Timbro Aziendale" className="max-h-48 object-contain bg-white p-2 rounded-lg" />
                </div>
              ) : (
                <div className="text-center text-slate-500 flex flex-col items-center gap-2">
                  <ImageIcon className="w-12 h-12 opacity-30" />
                  <p className="text-sm font-medium">Nessun timbro caricato</p>
                </div>
              )}
            </div>
          </div>

          {/* Documenti Aziendali */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
            <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-amber-400" />
                <h2 className="font-bold text-slate-100 uppercase tracking-wide">Allegati</h2>
              </div>
              <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition-colors" title="Carica documento">
                <Upload className="w-4 h-4 text-slate-300" />
                <input type="file" className="hidden" onChange={handleUploadDocumento} />
              </label>
            </div>
            
            <div className="p-4 flex flex-col gap-3 max-h-[400px] overflow-y-auto">
              {documenti.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nessun documento allegato.</p>
              ) : (
                documenti.map(doc => (
                  <div key={doc.id} className="bg-slate-900/50 p-3 border border-slate-700 rounded-xl flex items-center justify-between group">
                    <a href={`/${doc.file_path}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-indigo-400 text-slate-300 transition-colors flex-1 overflow-hidden">
                      <div className="p-2 bg-slate-800 rounded-lg shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate text-sm font-medium">
                        {doc.nome}
                      </div>
                    </a>
                    <button 
                      onClick={() => handleEliminaDocumento(doc.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                      title="Elimina Documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>
      </div>
      <ModernModal 
        {...alertModal}
        onClose={() => setAlertModal({ isOpen: false })}
      />
    </div>
  );
}
