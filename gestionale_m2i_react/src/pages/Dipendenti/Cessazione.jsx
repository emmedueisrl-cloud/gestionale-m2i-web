import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserMinus, Save, Loader2, Calendar, FileText, Search, AlertCircle, CalendarClock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ModernModal from '../../components/ui/ModernModal';
import { recuperaElencoDipendenti, recuperaDatiCompletiDipendente, registraCessazione, uploadFile } from '../../api/dipendenti';
import FileUploader from '../../components/ui/FileUploader';

export default function Cessazione() {
  const [dipendentiList, setDipendentiList] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [dipendenteData, setDipendenteData] = useState(null);
  
  const [dataCessazione, setDataCessazione] = useState('');
  const [noteCessazione, setNoteCessazione] = useState('');
  const [fileUnilavCessazione, setFileUnilavCessazione] = useState(null);
  const [fileDocCessazione, setFileDocCessazione] = useState(null);
  const [searchParams] = useSearchParams();
  
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  const [error, setError] = useState('');

  // 1. Carica la lista dei dipendenti all'avvio
  useEffect(() => {
    async function loadList() {
      try {
        const list = await recuperaElencoDipendenti();
        setDipendentiList(list || []);

        const idFromUrl = searchParams.get('id');
        if (idFromUrl) {
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
  }, []);

  // Helper per leggere il tipo contratto indipendentemente dal nome del campo
  const getTipoContratto = (d) => d.tipo_contratto || d.TipoContratto || d.tipoContratto || d.stato || '';

  // 2. Carica i dati quando si seleziona un dipendente
  const handleSelectChange = async (e) => {
    const id = e.target.value;
    setSelectedId(id);
    setDataCessazione('');
    setNoteCessazione('');
    setFileUnilavCessazione(null);
    setFileDocCessazione(null);
    setError('');
    
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
      setDataCessazione('');
      setNoteCessazione('');
      setFileUnilavCessazione(null);
      setFileDocCessazione(null);
    }
  };

  const askConfirm = (e) => {
    e.preventDefault();
    setError('');

    if (!dataCessazione) {
      setError('Inserisci la data in cui avviene la cessazione.');
      return;
    }

    if (dipendenteData.data_assunzione && new Date(dataCessazione) < new Date(dipendenteData.data_assunzione)) {
      setError('La data di cessazione non può essere precedente alla data di assunzione.');
      return;
    }

    setModal({
      isOpen: true,
      type: 'warning',
      title: 'Conferma Cessazione',
      content: `Stai per registrare la cessazione del rapporto lavorativo per ${dipendenteData.nome} ${dipendenteData.cognome}. Questa operazione contrassegnerà il dipendente come inattivo. Confermi?`,
      primaryAction: {
        label: 'Sì, conferma cessazione',
        variant: 'danger',
        onClick: handleSubmit
      },
      secondaryAction: {
        label: 'Annulla',
        onClick: () => setModal({ ...modal, isOpen: false })
      }
    });
  };

  const handleSubmit = async () => {
    setModal({ ...modal, isOpen: false });
    setIsSubmitting(true);
    
    try {
      await registraCessazione({ 
        IdDipendente: selectedId, 
        DataCessazione: dataCessazione,
        Note: noteCessazione 
      });
      
      // Caricamento dei file di cessazione se presenti
      if (fileUnilavCessazione) {
        await uploadFile(selectedId, fileUnilavCessazione, 'UNILAV_Cessazione', dipendenteData.nome, dipendenteData.cognome);
      }
      if (fileDocCessazione) {
        await uploadFile(selectedId, fileDocCessazione, 'Documento_Cessazione', dipendenteData.nome, dipendenteData.cognome);
      }
      
      setModal({
        isOpen: true,
        type: 'success',
        title: 'Cessazione Registrata',
        subtitle: 'Il rapporto lavorativo è stato chiuso.',
        content: `Il dipendente ${dipendenteData.nome} ${dipendenteData.cognome} è stato marcato come inattivo a partire dal ${new Date(dataCessazione).toLocaleDateString('it-IT')}.`,
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
        content: error.message || 'Si è verificato un errore durante la registrazione della cessazione.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-red-500/20 rounded-xl">
          <UserMinus className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Cessazione Rapporto</h1>
          <p className="text-slate-400 text-sm">Registra la fine del rapporto lavorativo per un dipendente attivo</p>
        </div>
      </div>

      {/* Selezione Dipendente */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-8">
        <label className="block text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          Seleziona il Dipendente
        </label>
        
        {isLoadingList ? (
          <div className="flex items-center gap-3 text-slate-400 p-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Caricamento lista...
          </div>
        ) : (
          <select 
            value={selectedId} 
            onChange={handleSelectChange}
            className="w-full max-w-xl p-3 rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 bg-slate-900/50 hover:bg-slate-800 transition-all"
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
        <div className="flex flex-col items-center justify-center py-12 text-red-400 animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="font-semibold">Recupero dati in corso...</p>
        </div>
      )}

      {/* Form Cessazione */}
      {dipendenteData && !isLoadingData && (
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 md:p-8">
            
            {/* Riepilogo Dati Attuali */}
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 mb-6">
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
            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700 mb-8">
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

            {/* Inserimento Cessazione */}
            <form onSubmit={askConfirm} className="border-t border-slate-700 pt-6">
              <div className="max-w-xl">
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-50 mb-2">Data Cessazione <span className="text-red-500">*</span></label>
                  <p className="text-xs text-slate-400 mb-3">Inserisci la data di chiusura del rapporto lavorativo.</p>
                  
                  <input 
                    type="date" 
                    value={dataCessazione}
                    onChange={(e) => {
                      setDataCessazione(e.target.value);
                      setError('');
                    }}
                    className={`w-full p-3 rounded-xl border text-base focus:outline-none focus:ring-2 transition-all ${error ? 'border-red-500 focus:ring-red-200 bg-red-500/10' : 'border-slate-600 focus:ring-red-100 focus:border-red-500 bg-slate-800 shadow-sm'}`}
                  />
                  
                  {error && (
                    <p className="text-red-500 text-sm mt-2 font-medium flex items-center gap-1">
                      <AlertCircle className="w-4 h-4"/> {error}
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-50 mb-2">Motivazione / Note</label>
                  <textarea 
                    value={noteCessazione}
                    onChange={(e) => setNoteCessazione(e.target.value)}
                    rows="3"
                    className="w-full p-3 rounded-xl border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 bg-slate-800 shadow-sm resize-y"
                    placeholder="Dimissioni volontarie, scadenza contratto, licenziamento..."
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 border-t border-slate-700 pt-6">
                  <FileUploader 
                    label="UNILAV Cessazione" 
                    file={fileUnilavCessazione} 
                    onFileSelect={setFileUnilavCessazione} 
                  />
                  <FileUploader 
                    label="Doc. Cessazione (Licenziamento/Dimissioni)" 
                    file={fileDocCessazione} 
                    onFileSelect={setFileDocCessazione} 
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="mt-4 w-full py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Registrazione in corso...</>
                  ) : (
                    <><UserMinus className="w-5 h-5" /> Registra Cessazione</>
                  )}
                </button>
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
        secondaryAction={modal.secondaryAction}
      />
    </div>
  );
}
