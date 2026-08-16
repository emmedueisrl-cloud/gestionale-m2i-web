import React, { useState, useEffect, useContext, forwardRef, useImperativeHandle } from 'react';
import { User, Briefcase, FileText, FileSignature, Save, X, CalendarDays, FileStack, Download, Trash2 } from 'lucide-react';
import { TopbarContext } from '../../context/TopbarContext';
import { useNavigate } from 'react-router-dom';
import FileUploader from './FileUploader';
import ModernModal from './ModernModal';

const INITIAL_STATE = {
  Cognome: '',
  Nome: '',
  Telefono: '',
  Residenza: '',
  CodiceFiscale: '',
  Email: '',
  IBAN: '',
  Mansione: '',
  DataAssunzione: '',
  TipoPaga: '',
  Importo: '',
  TipoContratto: '',
  Scadenza: '',
  Note: ''
};

const DipendenteForm = forwardRef(({ mode = 'inserimento', initialData = null, onSubmit, onCancel, onOpenProgrammaFisso, hasProgrammaFisso = false, onGenerateAssunzione, documentiEsistenti = [], onDeleteDocument }, ref) => {
  useImperativeHandle(ref, () => ({
    triggerCancel: () => mode === 'inserimento' ? setDraftModal(true) : onCancel()
  }));
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [inProva, setInProva] = useState(false);
  const [fileDocs, setFileDocs] = useState(null);
  const [fileContratto, setFileContratto] = useState(null);
  const [fileUnilav, setFileUnilav] = useState(null);
  const [fileAltro, setFileAltro] = useState(null);
  const [nomeFileAltro, setNomeFileAltro] = useState('');
  
  // Custom Modal per nome file generico
  const [altroModal, setAltroModal] = useState({ isOpen: false, pendingFile: null, tempName: '' });
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  
  const [draftModal, setDraftModal] = useState(false);
  const { setOnBackClick } = useContext(TopbarContext);
  const navigate = useNavigate();
  
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (mode === 'inserimento') {
      setOnBackClick(() => () => setDraftModal(true));
    }
    return () => {
      if (mode === 'inserimento') {
        setOnBackClick(null);
      }
    };
  }, [mode, setOnBackClick]);

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        ...INITIAL_STATE, 
        ...initialData,
        noteFisseElaborato: initialData.noteFisseElaborato || '',
        divisione: initialData.divisione || 'Esterno'
      });
      if (initialData.TipoContratto === 'In Prova') {
        setInProva(true);
      }
    }
  }, [initialData]);

  const validateField = (name, value, isBozzaCheck = false) => {
    let error = null;
    switch (name) {
      case 'Cognome':
      case 'Nome':
        if (!value.trim()) error = 'Campo obbligatorio';
        break;
      case 'DataAssunzione':
        if (!isBozzaCheck && !value.trim()) error = 'Campo obbligatorio per salvataggio definitivo';
        break;
      case 'CodiceFiscale':
        if (!isBozzaCheck && !value.trim()) {
          error = 'Campo obbligatorio per salvataggio definitivo';
        } else if (value.trim() && value.trim().length !== 16) {
          error = 'Il CF deve essere di 16 caratteri';
        }
        break;
      case 'Email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Formato email non valido';
        }
        break;
      case 'IBAN':
        if (value && !/^IT\d{2}[A-Z]\d{10}[0-9A-Z]{12}$/i.test(value.replace(/\s+/g, ''))) {
          error = 'Formato IBAN IT non valido (es: IT04R1234512345123456789012)';
        }
        break;
      case 'Importo':
        if (!isBozzaCheck && (!value || isNaN(Number(value)))) error = 'Importo non valido';
        break;
      case 'TipoPaga':
      case 'TipoContratto':
        if (!isBozzaCheck && !value && !inProva) error = 'Selezione obbligatoria';
        break;
      case 'Scadenza':
        if (!isBozzaCheck && formData.TipoContratto === 'Determinato' && !inProva && !value) {
          error = 'Scadenza obbligatoria per Tempo Determinato';
        } else if (value && formData.DataAssunzione && new Date(value) <= new Date(formData.DataAssunzione)) {
          error = 'La scadenza deve essere successiva all\'assunzione';
        }
        break;
      default:
        break;
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    
    // Uppercase for CF and IBAN
    if (name === 'CodiceFiscale' || name === 'IBAN') {
      newValue = value.toUpperCase();
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };
      
      // Clear scadenza if switching away from Determinato
      if (name === 'TipoContratto' && newValue === 'Indeterminato') {
        updated.Scadenza = '';
      }
      return updated;
    });

    // Validate on change
    const error = validateField(name, newValue);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleInProvaChange = (e) => {
    const checked = e.target.checked;
    setInProva(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, TipoContratto: 'In Prova', Scadenza: '' }));
      setErrors(prev => ({ ...prev, TipoContratto: null, Scadenza: null }));
    } else {
      setFormData(prev => ({ ...prev, TipoContratto: '' })); // User must select a type
    }
  };

  const handleSalva = (e, isBozza = false) => {
    if (e) e.preventDefault();
    
    // Validate all fields
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key], isBozza);
      if (error) newErrors[key] = error;
    });
    
    // Explicit cross-validation check for Scadenza
    if (!isBozza && formData.TipoContratto === 'Determinato' && !inProva && !formData.Scadenza) {
       newErrors.Scadenza = 'Scadenza obbligatoria per Tempo Determinato';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Find the first error and focus/scroll to it
      setTimeout(() => {
        const firstErrorKey = Object.keys(newErrors)[0];
        const errorElement = document.getElementsByName(firstErrorKey)[0];
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          errorElement.focus({ preventScroll: true });
        }
      }, 100);
      return;
    }

    const payload = { ...formData, isBozza };
    onSubmit(payload, fileDocs, fileContratto, fileUnilav, fileAltro, nomeFileAltro || 'Documento_Generico');
  };

  const handleAltroSelect = (file) => {
    if (file) {
      setAltroModal({ isOpen: true, pendingFile: file, tempName: '' });
    } else {
      setFileAltro(null);
      setNomeFileAltro('');
    }
  };

  const confirmAltroName = () => {
    if (!altroModal.tempName.trim()) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'Attenzione',
        content: 'Inserisci un nome per il documento',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
      return;
    }
    setFileAltro(altroModal.pendingFile);
    setNomeFileAltro(altroModal.tempName.trim().replace(/\s+/g, '_'));
    setAltroModal({ isOpen: false, pendingFile: null, tempName: '' });
  };

  const isScadenzaDisabled = inProva || formData.TipoContratto !== 'Determinato';

  return (
    <form onSubmit={(e) => handleSalva(e, false)} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. DATI ANAGRAFICI */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4 flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-slate-50 uppercase tracking-wide text-sm">Dati Anagrafici</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Cognome <span className="text-red-500">*</span></label>
            <input type="text" name="Cognome" value={formData.Cognome} onChange={handleChange} className={`w-full p-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.Cognome ? 'border-red-500 focus:ring-red-200 bg-red-500/10' : 'border-slate-600 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800'}`} placeholder="es. Rossi" />
            {errors.Cognome && <p className="text-red-500 text-xs mt-1 font-medium flex items-center gap-1"><X className="w-3 h-3"/> {errors.Cognome}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Nome <span className="text-red-500">*</span></label>
            <input type="text" name="Nome" value={formData.Nome} onChange={handleChange} className={`w-full p-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.Nome ? 'border-red-500 focus:ring-red-200 bg-red-500/10' : 'border-slate-600 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800'}`} placeholder="es. Mario" />
            {errors.Nome && <p className="text-red-500 text-xs mt-1 font-medium flex items-center gap-1"><X className="w-3 h-3"/> {errors.Nome}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Telefono</label>
            <input type="text" name="Telefono" value={formData.Telefono} onChange={handleChange} className="w-full p-2.5 rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800 transition-all" placeholder="es. 3331234567" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Residenza</label>
            <input type="text" name="Residenza" value={formData.Residenza} onChange={handleChange} className="w-full p-2.5 rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800 transition-all" placeholder="es. Via Roma 10, Milano" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Codice Fiscale <span className="text-red-500">*</span></label>
            <input type="text" name="CodiceFiscale" value={formData.CodiceFiscale} onChange={handleChange} maxLength="16" className={`w-full p-2.5 rounded-lg border text-sm uppercase focus:outline-none focus:ring-2 transition-all ${errors.CodiceFiscale ? 'border-red-500 focus:ring-red-200 bg-red-500/10' : 'border-slate-600 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800'}`} placeholder="es. RSSMRA80A01F205Z" />
            {errors.CodiceFiscale && <p className="text-red-500 text-xs mt-1 font-medium flex items-center gap-1"><X className="w-3 h-3"/> {errors.CodiceFiscale}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Email</label>
            <input type="email" name="Email" value={formData.Email} onChange={handleChange} className={`w-full p-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.Email ? 'border-red-500 focus:ring-red-200 bg-red-500/10' : 'border-slate-600 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800'}`} placeholder="es. mario.rossi@email.it" />
            {errors.Email && <p className="text-red-500 text-xs mt-1 font-medium flex items-center gap-1"><X className="w-3 h-3"/> {errors.Email}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-200 mb-1">IBAN</label>
            <input type="text" name="IBAN" value={formData.IBAN} onChange={handleChange} maxLength="27" className={`w-full p-2.5 rounded-lg border text-sm uppercase focus:outline-none focus:ring-2 transition-all ${errors.IBAN ? 'border-red-500 focus:ring-red-200 bg-red-500/10' : 'border-slate-600 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800'}`} placeholder="es. IT60X0542403200000001234567" />
            {errors.IBAN && <p className="text-red-500 text-xs mt-1 font-medium flex items-center gap-1"><X className="w-3 h-3"/> {errors.IBAN}</p>}
          </div>
        </div>
      </div>

      {/* 2. DATI CONTRATTUALI */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-slate-50 uppercase tracking-wide text-sm">Dati Contrattuali</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Mansione</label>
            <input type="text" name="Mansione" value={formData.Mansione} onChange={handleChange} className="w-full p-2.5 rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800 transition-all" placeholder="es. Operaio, Impiegato..." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Divisione (Interno/Esterno)</label>
            <select name="divisione" value={formData.divisione || 'Esterno'} onChange={handleChange} className="w-full p-2.5 rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800 transition-all">
              <option value="Esterno">Esterno</option>
              <option value="Interno">Interno</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Data Assunzione <span className="text-red-500">*</span></label>
            <input type="date" name="DataAssunzione" value={formData.DataAssunzione} onChange={handleChange} className={`w-full p-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.DataAssunzione ? 'border-red-500 focus:ring-red-200 bg-red-500/10' : 'border-slate-600 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800'}`} />
            {errors.DataAssunzione && <p className="text-red-500 text-xs mt-1 font-medium flex items-center gap-1"><X className="w-3 h-3"/> {errors.DataAssunzione}</p>}
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Box Tipologia Retribuzione */}
            <div className="border border-slate-700 rounded-xl p-5 bg-slate-900/50">
              <h4 className="text-xs font-semibold text-slate-50 mb-3 uppercase flex items-center gap-1">
                Tipologia di Retribuzione <span className="text-red-500">*</span>
              </h4>
              <div className="flex gap-3 mb-4">
                <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all flex items-center justify-center gap-2 text-sm font-medium ${formData.TipoPaga === 'Oraria' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-300'}`}>
                  <input type="radio" name="TipoPaga" value="Oraria" checked={formData.TipoPaga === 'Oraria'} onChange={handleChange} className="hidden" />
                  ⏱ Paga Oraria
                </label>
                <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all flex items-center justify-center gap-2 text-sm font-medium ${formData.TipoPaga === 'Mensile' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-300'}`}>
                  <input type="radio" name="TipoPaga" value="Mensile" checked={formData.TipoPaga === 'Mensile'} onChange={handleChange} className="hidden" />
                  📅 Paga Mensile
                </label>
              </div>
              {errors.TipoPaga && <p className="text-red-500 text-xs mb-3 font-medium flex items-center gap-1"><X className="w-3 h-3"/> {errors.TipoPaga}</p>}
              
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Importo (€) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" name="Importo" value={formData.Importo} onChange={handleChange} className={`w-full p-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.Importo ? 'border-red-500 focus:ring-red-200 bg-red-500/10' : 'border-slate-600 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-800'}`} placeholder="0.00" />
                {errors.Importo && <p className="text-red-500 text-xs mt-1 font-medium flex items-center gap-1"><X className="w-3 h-3"/> {errors.Importo}</p>}
              </div>
            </div>

            {/* Box Tipo Contratto */}
            <div className="border border-slate-700 rounded-xl p-5 bg-slate-900/50">
              <h4 className="text-xs font-semibold text-slate-50 mb-3 uppercase flex items-center gap-1">
                Tipo di Contratto <span className="text-red-500">*</span>
              </h4>
              <div className="flex gap-3 mb-4">
                <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all flex items-center justify-center gap-2 text-sm font-medium ${formData.TipoContratto === 'Indeterminato' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-300'} ${inProva ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="radio" name="TipoContratto" value="Indeterminato" checked={formData.TipoContratto === 'Indeterminato'} onChange={handleChange} disabled={inProva} className="hidden" />
                  ♾ Indeterminato
                </label>
                <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all flex items-center justify-center gap-2 text-sm font-medium ${formData.TipoContratto === 'Determinato' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-300'} ${inProva ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="radio" name="TipoContratto" value="Determinato" checked={formData.TipoContratto === 'Determinato'} onChange={handleChange} disabled={inProva} className="hidden" />
                  ⏳ Determinato
                </label>
              </div>
              
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-200 hover:text-slate-900 transition-colors">
                  <input type="checkbox" checked={inProva} onChange={handleInProvaChange} className="w-4 h-4 rounded border-slate-600 text-indigo-400 focus:ring-indigo-500" />
                  Attiva Periodo di prova
                </label>
              </div>
              {errors.TipoContratto && <p className="text-red-500 text-xs mb-3 font-medium flex items-center gap-1"><X className="w-3 h-3"/> {errors.TipoContratto}</p>}

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Scadenza Contratto</label>
                <input 
                  type={isScadenzaDisabled ? "text" : "date"} 
                  name="Scadenza" 
                  value={isScadenzaDisabled ? "" : formData.Scadenza} 
                  onChange={handleChange} 
                  disabled={isScadenzaDisabled}
                  placeholder={inProva ? "Disabilitata in periodo di prova" : "Nessuna scadenza (Tempo Indeterminato)"}
                  className={`w-full p-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${isScadenzaDisabled ? 'bg-slate-200 border-slate-600 text-slate-400 cursor-not-allowed' : (errors.Scadenza ? 'border-red-500 focus:ring-red-200 bg-red-500/10' : 'border-slate-600 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-800')}`} 
                />
                {errors.Scadenza && <p className="text-red-500 text-xs mt-1 font-medium flex items-center gap-1"><X className="w-3 h-3"/> {errors.Scadenza}</p>}
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* 3. PROGRAMMA FISSO SETTIMANALE */}
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden mb-8">
          <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-50 uppercase tracking-wide text-sm">Programma Fisso Settimanale</h3>
            </div>
          </div>
          <div className="p-6">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (onOpenProgrammaFisso) {
                  onOpenProgrammaFisso();
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 border-dashed rounded-xl font-bold transition-all"
            >
              <CalendarDays className="w-5 h-5" />
              {hasProgrammaFisso ? "MODIFICA/AGGIORNA PROGRAMMA SETTIMANALE" : "AGGIUNGI PROGRAMMA FISSO SETTIMANALE"}
            </button>
          </div>
        </div>

        {/* 4. DOCUMENTAZIONE ED ALLEGATI */}
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
          <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-50 uppercase tracking-wide text-sm">Documentazione ed Allegati</h3>
            </div>
            
            {onGenerateAssunzione && (
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  // Trasformiamo i campi nel formato atteso
                  const mappedData = {
                    nome: formData.Nome,
                    cognome: formData.Cognome,
                    indirizzo: formData.Residenza,
                    cap: '',
                    citta: '',
                    provincia: '',
                    mansione: formData.Mansione,
                    sesso: formData.Nome?.trim().toUpperCase().endsWith('A') ? 'F' : 'M',
                    dataAssunzione: formData.DataAssunzione,
                    tipoContratto: formData.TipoContratto,
                    scadenza: formData.Scadenza
                  };
                  onGenerateAssunzione(mappedData);
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
              >
                <FileStack className="w-4 h-4" />
                Genera Lettera Assunzione
              </button>
            )}
          </div>
          <div className="p-6">
            
            {/* DOCUMENTI GIA' CARICATI (MODIFICA) */}
            {documentiEsistenti && documentiEsistenti.length > 0 && (
              <div className="mb-8">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Documenti Già Presenti nel Sistema</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {documentiEsistenti.map((doc, index) => (
                    <div key={index} className="flex relative items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700 hover:border-indigo-500 hover:bg-slate-800 transition-all group">
                      <a 
                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${doc.path}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 w-full"
                      >
                        <div className="bg-indigo-500/20 p-2 rounded-lg group-hover:bg-indigo-500/30 transition-colors">
                          <Download className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="overflow-hidden pr-8">
                          <p className="font-semibold text-slate-200 text-sm truncate" title={doc.nome}>{doc.nome}</p>
                          <p className="text-xs text-slate-400">{doc.tipo}</p>
                        </div>
                      </a>
                      {onDeleteDocument && (
                        <button 
                          type="button"
                          onClick={(e) => onDeleteDocument(e, doc.nome)}
                          className="absolute right-3 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors z-10"
                          title="Elimina documento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <FileUploader 
                label="Documenti Dipendente (CI, CF)" 
                file={fileDocs} 
                onFileSelect={setFileDocs} 
              />
              <FileUploader 
                label="Contratto Firmato" 
                file={fileContratto} 
                onFileSelect={setFileContratto} 
              />
              <FileUploader 
                label="UNILAV" 
                file={fileUnilav} 
                onFileSelect={setFileUnilav} 
              />
            </div>
            <div className="border-t border-slate-700/50 pt-6">
              <div className="max-w-md">
                <FileUploader 
                  label={`Altri Documenti (${nomeFileAltro ? nomeFileAltro.replace(/_/g, ' ') : 'Generici'})`} 
                  file={fileAltro} 
                  onFileSelect={handleAltroSelect} 
                />
              </div>
            </div>
          </div>
        </div>

      {/* 4. NOTE */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4 flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-slate-50 uppercase tracking-wide text-sm">Note Aggiuntive</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Note Generali</label>
              <textarea 
                name="Note" 
                value={formData.Note} 
                onChange={handleChange} 
                rows="4" 
                className="w-full p-3 rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800 transition-all resize-y" 
                placeholder="Inserisci eventuali annotazioni o dettagli sul dipendente..."
              ></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Note Fisse per Elaborato</label>
              <textarea 
                name="noteFisseElaborato" 
                value={formData.noteFisseElaborato} 
                onChange={handleChange} 
                rows="4" 
                className="w-full p-3 rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-slate-900/50 hover:bg-slate-800 transition-all resize-y" 
                placeholder="Queste note verranno sempre incluse nell'elaborato mensile..."
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      {/* 5. AZIONI */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button 
          type="button" 
          onClick={() => mode === 'inserimento' ? setDraftModal(true) : onCancel()}
          className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-900/50 hover:border-slate-400 transition-all shadow-sm"
        >
          Annulla
        </button>
        {mode === 'inserimento' && (
          <button 
            type="button" 
            onClick={(e) => handleSalva(e, true)}
            className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salva come Bozza
          </button>
        )}
        <button 
          type="button" 
          onClick={(e) => handleSalva(e, false)}
          className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-indigo-600 text-white border border-transparent hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {mode === 'inserimento' ? 'Crea Dipendente Definitivo' : 'Salva Modifiche'}
        </button>
      </div>

      <ModernModal 
        isOpen={altroModal.isOpen}
        type="info"
        title="Nome Documento"
        subtitle="Che tipo di documento stai caricando?"
        content="Inserisci una breve descrizione (es. 'Patente', 'Corso Sicurezza', 'Visita Medica'). Questo testo verrà usato per rinominare il file automaticamente."
        primaryAction={{
          label: 'Conferma',
          onClick: confirmAltroName
        }}
        secondaryAction={{
          label: 'Annulla',
          onClick: () => {
            setAltroModal({ isOpen: false, pendingFile: null, tempName: '' });
          }
        }}
      >
        <input 
          type="text" 
          value={altroModal.tempName}
          onChange={(e) => setAltroModal({ ...altroModal, tempName: e.target.value })}
          placeholder="Es: Corso Sicurezza"
          className="w-full p-3 rounded-lg border border-slate-600 bg-slate-900/50 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmAltroName();
            }
          }}
        />
      </ModernModal>

      <ModernModal 
        isOpen={draftModal}
        type="info"
        title="Salvataggio Bozza"
        subtitle="Stai uscendo dall'inserimento di un nuovo dipendente."
        content="Cosa vuoi fare con i dati inseriti finora?"
        primaryAction={{
          label: 'Esci e salva in bozza',
          onClick: () => {
            setDraftModal(false);
            handleSalva(null, true);
          }
        }}
        secondaryAction={{
          label: 'Esci e elimina bozza',
          onClick: () => {
            setDraftModal(false);
            if (onCancel) onCancel(); else navigate(-1);
          }
        }}
        tertiaryAction={{
          label: 'Rimani',
          onClick: () => setDraftModal(false)
        }}
      />
      <ModernModal 
        {...alertModal}
        onClose={() => setAlertModal({ isOpen: false })}
      />
    </form>
  );
});

export default DipendenteForm;