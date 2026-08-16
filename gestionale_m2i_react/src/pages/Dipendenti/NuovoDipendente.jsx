import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Building, HardHat, ArrowLeft, CalendarDays, FileText } from 'lucide-react';
import DipendenteForm from '../../components/ui/DipendenteForm';
import ModernModal from '../../components/ui/ModernModal';
import ProgrammaFissoModal from '../../components/ui/ProgrammaFissoModal';
import ModuloAssunzioneForm from '../../components/moduli/ModuloAssunzioneForm';
import PrintableContrattoAssunzione from '../../components/moduli/PrintableContrattoAssunzione';

import { salvaDipendente, uploadFile } from '../../api/dipendenti';

export default function NuovoDipendente() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState(null); // 'Interno' o 'Esterno'
  const formRef = useRef(null);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdDipendenteId, setCreatedDipendenteId] = useState(null);
  const [submittedDipendente, setSubmittedDipendente] = useState(null);
  const [programmaFissoModalState, setProgrammaFissoModalState] = useState({ isOpen: false, idDipendente: null });
  const [isAssunzioneFormOpen, setIsAssunzioneFormOpen] = useState(false);
  const [assunzionePrintData, setAssunzionePrintData] = useState(null);

  const handleTipoSelect = (selectedTipo) => {
    setTipo(selectedTipo);
  };

  const handleCancel = () => {
    setTipo(null);
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
    // Se era un successo, resetto tutto per un nuovo inserimento
    if (modal.type === 'success') {
      setTipo(null);
    }
  };

  const handleSubmit = async (datiAnagrafici, fileDocs, fileContratto, fileUnilav, fileAltro) => {
    setIsSubmitting(true);
    try {
      // 1. Salva dati anagrafici e contrattuali
      const payload = { ...datiAnagrafici, Tipo: tipo };
      const idDipendente = await salvaDipendente(payload);
      setCreatedDipendenteId(idDipendente);
      setSubmittedDipendente(payload);
      
      // 2. Upload file opzionali
      let filesUploaded = 0;
      if (fileDocs) {
        await uploadFile(idDipendente, fileDocs, 'Documento', payload.Nome, payload.Cognome);
        filesUploaded++;
      }
      if (fileContratto) {
        await uploadFile(idDipendente, fileContratto, 'Contratto', payload.Nome, payload.Cognome);
        filesUploaded++;
      }
      if (fileUnilav) {
        await uploadFile(idDipendente, fileUnilav, 'Unilav', payload.Nome, payload.Cognome);
        filesUploaded++;
      }
      if (fileAltro) {
        await uploadFile(idDipendente, fileAltro, 'Documento_Generico', payload.Nome, payload.Cognome);
        filesUploaded++;
      }

      const isBozza = payload.isBozza;
      setModal({
        isOpen: true,
        type: 'success',
        title: isBozza ? 'Bozza Salvata!' : 'Salvataggio Completato!',
        subtitle: isBozza ? 'Il dipendente è stato inserito in bozza.' : 'Il dipendente è stato inserito correttamente.',
        content: `I dati sono stati salvati ed è stato assegnato il codice: ${idDipendente}.${filesUploaded > 0 ? ` Caricati ${filesUploaded} allegati.` : ''}`,
        primaryAction: {
          label: 'Torna al Database',
          onClick: () => navigate('/admin/dipendenti/lista')
        },
        secondaryAction: {
          label: 'Inserisci un altro',
          onClick: () => {
            setModal({ isOpen: false });
            setTipo(null);
          }
        }
      });
      
    } catch (error) {
      setModal({
        isOpen: true,
        type: 'error',
        title: 'Errore di salvataggio',
        content: error.message || 'Si è verificato un errore imprevisto durante il salvataggio del dipendente.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 w-full">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-500/20 rounded-xl">
          <UserPlus className="w-6 h-6 text-indigo-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Nuovo Dipendente</h1>
          <p className="text-slate-400 text-sm">Registra un nuovo dipendente nel sistema</p>
        </div>
      </div>

      {!tipo ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-center text-lg font-bold text-slate-200 mb-8">Scegli il tipo di dipendente da inserire</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Opzione Interno */}
            <div 
              onClick={() => handleTipoSelect('Interno')}
              className="bg-slate-800 border-2 border-slate-700 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer hover:shadow-lg hover:shadow-indigo-500/10 transition-all group"
            >
              <div className="w-20 h-20 mx-auto bg-indigo-500/10 group-hover:bg-indigo-500/200/20 rounded-full flex items-center justify-center mb-4 transition-colors">
                <Building className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-50 mb-2 group-hover:text-indigo-400 transition-colors">Dipendente Interno</h3>
              <p className="text-sm text-slate-400 leading-relaxed">Personale impiegato negli uffici o mansioni interne di sede, amministrazione e dirigenza.</p>
            </div>

            {/* Opzione Esterno */}
            <div 
              onClick={() => handleTipoSelect('Esterno')}
              className="bg-slate-800 border-2 border-slate-700 hover:border-cyan-500 rounded-2xl p-8 text-center cursor-pointer hover:shadow-lg hover:shadow-cyan-500/10 transition-all group"
            >
              <div className="w-20 h-20 mx-auto bg-cyan-50 group-hover:bg-cyan-100 rounded-full flex items-center justify-center mb-4 transition-colors">
                <HardHat className="w-10 h-10 text-cyan-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-50 mb-2 group-hover:text-cyan-600 transition-colors">Dipendente Esterno</h3>
              <p className="text-sm text-slate-400 leading-relaxed">Operatori sul campo, manutentori, tecnici o personale distaccato in appalto presso clienti.</p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <button 
            onClick={() => formRef.current?.triggerCancel()}
            className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 text-sm font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Torna alla scelta
          </button>
          
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            {tipo === 'Interno' ? <Building className="w-5 h-5 text-indigo-400" /> : <HardHat className="w-5 h-5 text-cyan-600" />}
            <span className="font-semibold text-indigo-900">
              Stai inserendo un Dipendente <span className={tipo === 'Interno' ? 'text-indigo-400' : 'text-cyan-600'}>{tipo}</span>
            </span>
          </div>

          <DipendenteForm 
            ref={formRef}
            mode="inserimento" 
            onSubmit={handleSubmit} 
            onCancel={handleCancel} 
            onOpenProgrammaFisso={() => setModal({ 
              isOpen: true, 
              type: 'warning', 
              title: 'Attenzione', 
              content: 'Devi prima salvare il nuovo dipendente (cliccando su "Salva Dipendente" in basso) per poterne configurare il programma fisso.',
              primaryAction: { label: 'Ho capito', onClick: () => setModal({ ...modal, isOpen: false }) }
            })}
            onGenerateAssunzione={(mappedData) => {
              setSubmittedDipendente(mappedData);
              setIsAssunzioneFormOpen(true);
            }}
          />
        </div>
      )}

      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <h3 className="text-slate-50 font-bold">Salvataggio in corso...</h3>
            <p className="text-slate-400 text-sm">Attendi mentre memorizziamo i dati.</p>
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
      >
        {modal.type === 'success' && createdDipendenteId && (
          <div className="flex flex-col gap-3 mt-4 w-full">
            <button 
              onClick={() => {
                setModal({ ...modal, isOpen: false });
                setProgrammaFissoModalState({ isOpen: true, idDipendente: createdDipendenteId });
              }}
              className="flex items-center gap-2 justify-center w-full px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/20 transition-all border border-indigo-500"
            >
              <CalendarDays className="w-5 h-5" />
              CONFIGURA PROGRAMMA FISSO
            </button>
          </div>
        )}
      </ModernModal>

      <ProgrammaFissoModal 
        isOpen={programmaFissoModalState.isOpen}
        idDipendente={programmaFissoModalState.idDipendente}
        onClose={() => {
          setProgrammaFissoModalState({ isOpen: false, idDipendente: null });
          navigate('/admin/dipendenti/lista'); // Go to list after configuring
        }}
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
