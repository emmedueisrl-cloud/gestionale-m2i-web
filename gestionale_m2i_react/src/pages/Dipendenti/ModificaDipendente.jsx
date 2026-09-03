import React, { useState, useEffect } from 'react';
import { UserPen, Search, Loader2, CalendarDays } from 'lucide-react';
import DipendenteForm from '../../components/ui/DipendenteForm';
import ModernModal from '../../components/ui/ModernModal';
import ProgrammaFissoModal from '../../components/ui/ProgrammaFissoModal';
import ModuloAssunzioneForm from '../../components/moduli/ModuloAssunzioneForm';
import PrintableContrattoAssunzione from '../../components/moduli/PrintableContrattoAssunzione';

import { recuperaElencoDipendenti, recuperaDatiCompletiDipendente, salvaModificheDipendente, uploadFile, recuperaDocumentiDipendente, eliminaDocumentoDipendente } from '../../api/dipendenti';
import { recuperaDatiProgramma } from '../../api/ore';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function ModificaDipendente() {
  const [dipendentiList, setDipendentiList] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [dipendenteData, setDipendenteData] = useState(null);
  const [documenti, setDocumenti] = useState([]);
  
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  const [programmaFissoModalState, setProgrammaFissoModalState] = useState({ isOpen: false, idDipendente: null });
  const [hasProgrammaFisso, setHasProgrammaFisso] = useState(false);
  
  const [isAssunzioneFormOpen, setIsAssunzioneFormOpen] = useState(false);
  const [assunzionePrintData, setAssunzionePrintData] = useState(null);
  const [submittedDipendente, setSubmittedDipendente] = useState(null);
  
  const [searchParams] = useSearchParams();

  // 1. Carica la lista dei dipendenti all'avvio
  useEffect(() => {
    async function loadList() {
      try {
        const list = await recuperaElencoDipendenti();
        setDipendentiList(list || []);
        
        // Controlla se c'è un ID nell'URL
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

  // 2. Carica i dati completi quando si seleziona un dipendente
  const handleSelectChange = async (e) => {
    const id = e.target.value;
    setSelectedId(id);
    
    if (!id) {
      setDipendenteData(null);
      return;
    }

    setIsLoadingData(true);
    try {
      const [data, docs] = await Promise.all([
        recuperaDatiCompletiDipendente(id),
        recuperaDocumentiDipendente(id)
      ]);
      if (data) {
        setDocumenti(docs || []);
        setDipendenteData({
          Cognome: data.cognome || '',
          Nome: data.nome || '',
          CodiceFiscale: data.codice_fiscale || '',
          DataNascita: data.data_nascita || '',
          ComuneNascita: data.comune_nascita || '',
          ProvinciaNascita: data.provincia_nascita || '',
          Genere: data.genere || '',
          Residenza: data.indirizzo || '',
          Cap: data.cap || '',
          Citta: data.citta || '',
          Provincia: data.provincia || '',
          Telefono: data.telefono || '',
          Email: data.email || '',
          IBAN: data.iban || '',
          Ruolo: data.ruolo || '',
          Mansione: data.mansione || '',
          divisione: data.divisione || 'Esterno',
          DataAssunzione: data.data_assunzione || '',
          TipoContratto: data.stato || '',
          Scadenza: data.scadenza || '',
          OreContrattuali: data.ore_contrattuali || '',
          LivelloInquadramento: data.livello_inquadramento || '',
          TariffaOrariaCliente: data.tariffa_oraria_cliente || '',
          TariffaOrariaOperatore: data.tariffa_oraria_operatore || '',
          TipoPaga: data.tipo_paga || 'Oraria',
          Importo: data.paga_oraria_reale || 0,
          noteFisseElaborato: data.note_fisse_elaborato || ''
        });

        try {
          const prog = await recuperaDatiProgramma(id);
          setHasProgrammaFisso(prog && prog.length > 0);
        } catch (e) {
          console.error("Errore nel recupero del programma fisso", e);
          setHasProgrammaFisso(false);
        }
      } else {
        setDipendenteData(null);
        setHasProgrammaFisso(false);
      }
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

  const handleDeleteDocument = async (e, nomeFile) => {
    e.preventDefault();
    e.stopPropagation();
    
    setModal({
      isOpen: true,
      type: 'warning',
      title: 'Conferma Eliminazione',
      content: `Sei sicuro di voler eliminare il documento "${nomeFile}"?`,
      primaryAction: {
        label: 'Elimina',
        onClick: async () => {
          setModal({ isOpen: false });
          try {
            await eliminaDocumentoDipendente(selectedId, nomeFile);
            const docs = await recuperaDocumentiDipendente(selectedId);
            setDocumenti(docs || []);
          } catch (error) {
            setModal({
              isOpen: true,
              type: 'error',
              title: 'Errore',
              content: 'Impossibile eliminare il documento.'
            });
          }
        }
      },
      secondaryAction: {
        label: 'Annulla',
        onClick: () => setModal({ isOpen: false })
      }
    });
  };

  const navigate = useNavigate();

  const handleCancel = () => {
    navigate('/admin/dipendenti/lista');
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.type === 'success') {
      navigate('/admin/dipendenti/lista');
    }
  };

  const handleSubmit = async (datiModificati, fileDocs, fileContratto, fileUnilav, fileAltro) => {
    setIsSubmitting(true);
    try {
      // Passiamo l'ID al backend assieme ai dati modificati
      const payload = { ...datiModificati, IdDipendente: selectedId };
      await salvaModificheDipendente(payload);

      let filesUploaded = 0;
      if (fileDocs) {
        const docsArray = Array.isArray(fileDocs) ? fileDocs : [fileDocs];
        for (const f of docsArray) {
          await uploadFile(selectedId, f, 'Documento', payload.Nome, payload.Cognome);
          filesUploaded++;
        }
      }
      if (fileContratto) {
        const arr = Array.isArray(fileContratto) ? fileContratto : [fileContratto];
        for (const f of arr) {
          await uploadFile(selectedId, f, 'Contratto', payload.Nome, payload.Cognome);
          filesUploaded++;
        }
      }
      if (fileUnilav) {
        const arr = Array.isArray(fileUnilav) ? fileUnilav : [fileUnilav];
        for (const f of arr) {
          await uploadFile(selectedId, f, 'Unilav', payload.Nome, payload.Cognome);
          filesUploaded++;
        }
      }
      if (fileAltro) {
        const arr = Array.isArray(fileAltro) ? fileAltro : [fileAltro];
        for (const f of arr) {
          await uploadFile(selectedId, f, 'Documento_Generico', payload.Nome, payload.Cognome);
          filesUploaded++;
        }
      }
      
      const isBozza = payload.isBozza;
      setModal({
        isOpen: true,
        type: 'success',
        title: isBozza ? 'Bozza Salvata' : 'Modifiche Salvate',
        subtitle: isBozza ? 'L\'anagrafica del dipendente è stata aggiornata in bozza.' : 'L\'anagrafica del dipendente è stata aggiornata.',
        content: `I dati di ${datiModificati.Nome} ${datiModificati.Cognome} sono stati registrati con successo.`,
        primaryAction: {
          label: 'Torna al Database',
          onClick: () => {
            setModal({ isOpen: false });
            navigate('/admin/dipendenti/lista');
          }
        },
        secondaryAction: {
          label: 'MODIFICA ANCORA',
          onClick: () => setModal({ isOpen: false })
        }
      });
    } catch (error) {
      setModal({
        isOpen: true,
        type: 'error',
        title: 'Errore di salvataggio',
        content: error.message || 'Si è verificato un errore imprevisto durante l\'aggiornamento.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 w-full">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-500/20 rounded-xl">
          <UserPen className="w-6 h-6 text-indigo-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Modifica Dipendente</h1>
          <p className="text-slate-400 text-sm">Aggiorna i dati anagrafici e contrattuali esistenti</p>
        </div>
      </div>

      {/* Selezione Dipendente */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-8">
        <label className="block text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          Cerca Dipendente da modificare
        </label>
        
        {isLoadingList ? (
          <div className="flex items-center gap-3 text-slate-400 p-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Caricamento lista...
          </div>
        ) : (
          <select 
            value={selectedId} 
            onChange={handleSelectChange}
            className="w-full max-w-xl p-3 rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800 transition-all"
          >
            <option value="">-- Seleziona un dipendente --</option>
            {dipendentiList.map(dip => (
              <option key={dip.id} value={dip.id}>
                {dip.nomeCompleto} ({dip.codiceFiscale})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Form di Modifica */}
      {isLoadingData && (
        <div className="flex flex-col items-center justify-center py-12 text-indigo-400 animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="font-semibold">Recupero dati in corso...</p>
        </div>
      )}

      {dipendenteData && !isLoadingData && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DipendenteForm 
              mode="modifica" 
              initialData={dipendenteData}
              onSubmit={handleSubmit} 
              onCancel={handleCancel} 
              onOpenProgrammaFisso={() => setProgrammaFissoModalState({ isOpen: true, idDipendente: selectedId })}
              hasProgrammaFisso={hasProgrammaFisso}
              onGenerateAssunzione={(mappedData) => {
                setSubmittedDipendente(mappedData);
                setIsAssunzioneFormOpen(true);
              }}
              documentiEsistenti={documenti}
              onDeleteDocument={handleDeleteDocument}
            />
        </div>
      )}

      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
            <h3 className="text-slate-50 font-bold">Salvataggio modifiche...</h3>
            <p className="text-slate-400 text-sm">Attendi mentre aggiorniamo il database.</p>
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

      <ProgrammaFissoModal 
        isOpen={programmaFissoModalState.isOpen}
        idDipendente={programmaFissoModalState.idDipendente}
        onClose={() => setProgrammaFissoModalState({ isOpen: false, idDipendente: null })}
      />

      <ModuloAssunzioneForm
        isOpen={isAssunzioneFormOpen}
        onClose={() => setIsAssunzioneFormOpen(false)}
        dipendenteData={submittedDipendente}
        onGenerate={(formData, aziendaData) => {
          setIsAssunzioneFormOpen(false);
          setAssunzionePrintData({ formData, aziendaData, dipendenteData: submittedDipendente });
          setTimeout(() => {
            window.print();
          }, 500);
        }}
      />

      {assunzionePrintData && (
        <div className="hidden print:block">
          <PrintableContrattoAssunzione
            formData={assunzionePrintData.formData}
            dipendenteData={assunzionePrintData.dipendenteData}
            aziendaData={assunzionePrintData.aziendaData}
          />
        </div>
      )}
    </div>
  );
}
