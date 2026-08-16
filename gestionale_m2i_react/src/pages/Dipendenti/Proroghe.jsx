import React, { useState, useEffect } from 'react';
import { CalendarClock, Search, Loader2, AlertCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ModernModal from '../../components/ui/ModernModal';
import { recuperaElencoDipendenti, recuperaDatiCompletiDipendente, salvaProroga, uploadFile } from '../../api/dipendenti';
import FileUploader from '../../components/ui/FileUploader';

export default function Proroghe() {
  const [dipendentiList, setDipendentiList] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [dipendenteData, setDipendenteData] = useState(null);
  
  const [nuovaScadenza, setNuovaScadenza] = useState('');
  const [fileContratto, setFileContratto] = useState(null);
  const [fileUnilav, setFileUnilav] = useState(null);
  
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  const [error, setError] = useState('');
  const [showWarning4Proroga, setShowWarning4Proroga] = useState(false);
  const [searchParams] = useSearchParams();

  // 1. Carica la lista dei dipendenti all'avvio
  useEffect(() => {
    async function loadList() {
      try {
        const list = await recuperaElencoDipendenti();
        setDipendentiList(list || []);
        
        const idFromUrl = searchParams.get('id');
        if (idFromUrl) {
          setSelectedId(idFromUrl);
          handleSelectChange({ target: { value: idFromUrl } });
        }
      } catch (error) {
        setModal({
          isOpen: true,
          type: 'error',
          title: 'Errore Caricamento',
          content: 'Impossibile caricare la lista dei dipendenti. Riprova più tardi.'
        });
      } finally {
        setIsLoadingList(false);
      }
    }
    loadList();
  }, [searchParams]);


  // Helper per leggere il tipo contratto indipendentemente dal nome del campo
  const getTipoContratto = (d) => d.tipo_contratto || d.TipoContratto || d.tipoContratto || d.stato || '';

  // 2. Carica i dati quando si seleziona un dipendente
  const handleSelectChange = async (e) => {

    const id = e.target.value;
    setSelectedId(id);
    setNuovaScadenza('');
    setFileContratto(null);
    setFileUnilav(null);
    setError('');
    setShowWarning4Proroga(false);
    
    if (!id) {
      setDipendenteData(null);
      return;
    }

    setIsLoadingData(true);
    try {
      const data = await recuperaDatiCompletiDipendente(id);
      setDipendenteData(data);
    } catch (error) {
      setModal({
        isOpen: true,
        type: 'error',
        title: 'Errore Dati',
        content: `Impossibile caricare i dati del dipendente selezionato. ${error.message}`
      });
      setDipendenteData(null);
      setSelectedId('');
    } finally {
      setIsLoadingData(false);
    }
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.type === 'success') {
      setSelectedId('');
      setDipendenteData(null);
      setNuovaScadenza('');
      setFileContratto(null);
      setFileUnilav(null);
      setShowWarning4Proroga(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nuovaScadenza) {
      setError('Inserisci la nuova data di scadenza.');
      return;
    }

    if (dipendenteData) {
      const scadenzaAttuale = dipendenteData.scadenza || dipendenteData.scadenza_contratto;
      if (scadenzaAttuale && new Date(nuovaScadenza) <= new Date(scadenzaAttuale)) {
        setError('La nuova scadenza deve essere successiva a quella attuale.');
        return;
      }
    }

    if (dipendenteData.data_assunzione && new Date(nuovaScadenza) <= new Date(dipendenteData.data_assunzione)) {
      setError('La scadenza non può essere precedente alla data di assunzione.');
      return;
    }

    if (dipendenteData.proroghe?.length >= 3 && !showWarning4Proroga) {
      setShowWarning4Proroga(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await salvaProroga({ IdDipendente: selectedId, NuovaScadenza: nuovaScadenza });
      
      let filesUploaded = 0;
      if (fileContratto) {
        await uploadFile(selectedId, fileContratto, 'Contratto', dipendenteData.nome, dipendenteData.cognome);
        filesUploaded++;
      }
      if (fileUnilav) {
        await uploadFile(selectedId, fileUnilav, 'Unilav', dipendenteData.nome, dipendenteData.cognome);
        filesUploaded++;
      }
      
      setModal({
        isOpen: true,
        type: 'success',
        title: 'Proroga Registrata',
        subtitle: 'Il contratto è stato prorogato con successo.',
        content: `La nuova scadenza per ${dipendenteData.nome} ${dipendenteData.cognome} è stata impostata al ${new Date(nuovaScadenza).toLocaleDateString('it-IT')}.${filesUploaded > 0 ? ` Caricati ${filesUploaded} allegati.` : ''}`,
        primaryAction: {
          label: 'Chiudi',
          onClick: closeModal
        }
      });
    } catch (error) {
      setModal({
        isOpen: true,
        type: 'error',
        title: 'Errore di salvataggio',
        content: error.message || 'Si è verificato un errore durante la registrazione della proroga.'
      });
    } finally {
      setIsSubmitting(false);
      setShowWarning4Proroga(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-amber-500/20 rounded-xl">
          <CalendarClock className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Proroga Contratto</h1>
          <p className="text-slate-400 text-sm">Aggiorna la data di scadenza per un contratto a tempo determinato</p>
        </div>
      </div>

      {/* Selezione Dipendente */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-8">
        <label className="block text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          Seleziona il Dipendente da prorogare
        </label>
        
        {isLoadingList ? (
          <div className="flex items-center gap-3 text-slate-400 p-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Caricamento lista...
          </div>
        ) : (
          <select 
            value={selectedId} 
            onChange={handleSelectChange}
            className="w-full max-w-xl p-3 rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-500 bg-slate-900/50 hover:bg-slate-800 transition-all"
          >
            <option value="">-- Seleziona un dipendente --</option>
            {dipendentiList.map(dip => (
              <option key={dip.id} value={dip.id}>
                {dip.nomeCompleto} - {dip.codiceFiscale}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoadingData && (
        <div className="flex flex-col items-center justify-center py-12 text-amber-400 animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="font-semibold">Recupero dati in corso...</p>
        </div>
      )}

      {/* Form Proroga */}
      {dipendenteData && !isLoadingData && (
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 md:p-8">
            
            {/* Riepilogo Dati Attuali */}
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 mb-8">
              <h3 className="text-sm font-semibold text-slate-50 uppercase tracking-wide mb-4 border-b pb-2">Riepilogo Contratto Attuale</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Dipendente:</span>
                  <p className="font-semibold text-slate-50 text-base">{dipendenteData.cognome} {dipendenteData.nome}</p>
                </div>
                <div>
                  <span className="text-slate-400">Codice Fiscale:</span>
                  <p className="font-semibold text-slate-50">{dipendenteData.codice_fiscale}</p>
                </div>
                <div>
                  <span className="text-slate-400">Tipo Contratto:</span>
                  <p className="font-semibold text-slate-50">{getTipoContratto(dipendenteData) || 'Non specificato'}</p>
                </div>
                <div>
                  <span className="text-slate-400">Assunzione:</span>
                  <p className="font-semibold text-slate-50">{dipendenteData.data_assunzione ? new Date(dipendenteData.data_assunzione).toLocaleDateString('it-IT') : '-'}</p>
                </div>
                  <div className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-3 mt-2 flex items-center gap-3">
                    <div className="bg-amber-500/20 text-amber-400 p-2 rounded-lg">
                      <CalendarClock className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-slate-400 block text-xs">Scadenza Attuale</span>
                      <p className="font-bold text-slate-50 text-lg">
                        {(dipendenteData.scadenza || dipendenteData.scadenza_contratto) ? new Date(dipendenteData.scadenza || dipendenteData.scadenza_contratto).toLocaleDateString('it-IT') : 'Nessuna scadenza impostata'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Storia del Dipendente */}
              <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700 mb-6">
                <h3 className="text-sm font-semibold text-slate-50 uppercase tracking-wide mb-4 border-b pb-2">Storia del Dipendente</h3>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between items-end border-b border-slate-800 pb-3">
                    <span className="text-slate-400">Assunzione originale e scadenza</span>
                    <span className="font-semibold text-slate-200">
                      Dal {dipendenteData.data_assunzione ? new Date(dipendenteData.data_assunzione).toLocaleDateString('it-IT') : '-'}
                      {dipendenteData.proroghe && dipendenteData.proroghe.length > 0 && dipendenteData.proroghe[0].scadenza_precedente ? 
                        ` al ${new Date(dipendenteData.proroghe[0].scadenza_precedente).toLocaleDateString('it-IT')}` : ''}
                    </span>
                  </div>
                  {dipendenteData.proroghe && dipendenteData.proroghe.map((p, index) => (
                    <div key={p.id || index} className="flex justify-between items-end border-b border-slate-800 pb-3">
                      <span className="text-slate-400">{index + 1}° Proroga</span>
                      <span className="font-semibold text-indigo-300">
                        fino al {p.nuova_scadenza ? new Date(p.nuova_scadenza).toLocaleDateString('it-IT') : '-'}
                      </span>
                    </div>
                  ))}
                  {(!dipendenteData.proroghe || dipendenteData.proroghe.length === 0) && (
                    <div className="text-slate-500 italic mt-2">Nessuna proroga precedente registrata.</div>
                  )}
                </div>
              </div>

            {getTipoContratto(dipendenteData) === 'Indeterminato' && (
              <div className="flex items-start gap-3 bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-200 mb-6">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Contratto a Tempo Indeterminato</p>
                  <p className="text-sm mt-1">Questo dipendente ha un contratto a tempo indeterminato. Le proroghe si applicano solo ai contratti a tempo determinato. Se desideri comunque impostare una data, puoi farlo qui sotto.</p>
                </div>
              </div>
            )}

            {/* Inserimento Nuova Scadenza */}
            <form onSubmit={handleSubmit} className="border-t border-slate-700 pt-6">
              <div className="max-w-md">
                <label className="block text-sm font-bold text-slate-50 mb-2">Nuova Data di Scadenza <span className="text-red-500">*</span></label>
                <p className="text-xs text-slate-400 mb-3">Inserisci la nuova data fino a cui il contratto sarà valido.</p>
                
                <input 
                  type="date" 
                  value={nuovaScadenza}
                  onChange={(e) => {
                    setNuovaScadenza(e.target.value);
                    setError('');
                  }}
                  className={`w-full p-3 rounded-xl border text-base focus:outline-none focus:ring-2 transition-all ${error ? 'border-red-500 focus:ring-red-200 bg-red-500/10' : 'border-slate-600 focus:ring-amber-100 focus:border-amber-500 bg-slate-800 shadow-sm'}`}
                />
                
                {error && (
                  <p className="text-red-500 text-sm mt-2 font-medium flex items-center gap-1">
                    <AlertCircle className="w-4 h-4"/> {error}
                  </p>
                )}
                
                <div className="mt-6 border-t border-slate-700/50 pt-6">
                  <h4 className="text-sm font-semibold text-slate-200 mb-4">Documentazione Proroga (Opzionale)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FileUploader 
                      label="Nuovo Contratto" 
                      file={fileContratto} 
                      onFileSelect={setFileContratto} 
                    />
                    <FileUploader 
                      label="UNILAV Proroga" 
                      file={fileUnilav} 
                      onFileSelect={setFileUnilav} 
                    />
                  </div>
                </div>

                {showWarning4Proroga ? (
                  <div className="mt-6 bg-red-500/10 border border-red-500/50 rounded-xl p-5 text-center">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                    <h4 className="font-bold text-red-500 text-lg mb-2">Attenzione: 4ª Proroga Raggiunta!</h4>
                    <p className="text-slate-300 text-sm mb-4">
                      Stai per registrare la 4ª proroga per questo dipendente. In genere, dopo 3 proroghe si consiglia la trasformazione a <strong>Tempo Indeterminato</strong>.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 mt-5">
                      <button 
                        type="button" 
                        onClick={() => window.location.href='/admin/dipendenti/trasformazioni'}
                        className="flex-1 py-2.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2"
                      >
                        Passa a Indeterminato
                      </button>
                      <button 
                        type="submit" 
                        className="flex-1 py-2.5 rounded-lg font-bold text-slate-200 bg-slate-800 border border-slate-600 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        Forza Proroga
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="mt-6 w-full py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Registrazione in corso...</>
                    ) : (
                      <><CalendarClock className="w-5 h-5" /> Registra Proroga</>
                    )}
                  </button>
                )}
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Modal Response */}
      <ModernModal 
        isOpen={modal.isOpen} 
        onClose={closeModal}
        type={modal.type}
        title={modal.title}
        subtitle={modal.subtitle}
        content={modal.content}
        primaryAction={modal.primaryAction}
      />
    </div>
  );
}
