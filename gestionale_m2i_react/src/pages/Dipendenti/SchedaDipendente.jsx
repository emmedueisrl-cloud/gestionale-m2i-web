import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Phone, Mail, MapPin, Briefcase, Calendar, CreditCard, ArrowLeft, Loader2, Edit, FileText, Download, Trash2, CalendarDays, Key } from 'lucide-react';
import { recuperaDatiCompletiDipendente, recuperaDocumentiDipendente, eliminaDocumentoDipendente, recuperaStoricoChiaviDipendente } from '../../api/dipendenti';
import ModernModal from '../../components/ui/ModernModal';
import ProgrammaFissoModal from '../../components/ui/ProgrammaFissoModal';
import BustePagaDipendenteModal from '../../components/ui/BustePagaDipendenteModal';

export default function SchedaDipendente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [documenti, setDocumenti] = useState([]);
  const [chiavi, setChiavi] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ isOpen: false });
  const [programmaFissoModalState, setProgrammaFissoModalState] = useState({ isOpen: false });
  const [bustePagaModalOpen, setBustePagaModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [dip, docs, chiaviAssegnate] = await Promise.all([
          recuperaDatiCompletiDipendente(id),
          recuperaDocumentiDipendente(id),
          recuperaStoricoChiaviDipendente(id)
        ]);
        setData(dip);
        setDocumenti(docs || []);
        setChiavi(chiaviAssegnate || []);
      } catch (err) {
        setError('Dipendente non trovato o errore di caricamento.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleDeleteDocument = async (e, nomeFile) => {
    e.preventDefault(); // Prevent opening the link
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
            await eliminaDocumentoDipendente(id, nomeFile);
            const docs = await recuperaDocumentiDipendente(id);
            setDocumenti(docs || []);
          } catch (err) {
            setModal({
              isOpen: true,
              type: 'error',
              title: 'Errore',
              content: 'Errore durante l\'eliminazione del documento.'
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-indigo-400 animate-pulse">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-semibold text-lg">Caricamento scheda in corso...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-500 font-medium">
        {error || 'Nessun dato disponibile.'}
      </div>
    );
  }

  const statoColors = {
    'Indeterminato': 'bg-emerald-500/20 text-emerald-800 border-emerald-500/50',
    'Determinato': 'bg-indigo-500/20 text-indigo-800 border-indigo-500/50',
    'In Prova': 'bg-amber-500/20 text-amber-800 border-amber-200',
    'Cessato': 'bg-red-500/20 text-red-800 border-red-200'
  };

  const statoColor = statoColors[data.stato] || 'bg-slate-100 text-slate-50 border-slate-700';

  const safeDate = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('it-IT');
  };

  return (
    <div className="p-6 w-full pb-12">
      
      {/* Intestazione */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => navigate('/admin/dipendenti/lista')}
          className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 font-medium text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Torna alla lista
        </button>
        <div className="flex gap-2">
          <button 
            onClick={() => setProgrammaFissoModalState({ isOpen: true })}
            className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500 text-indigo-400 hover:text-white hover:bg-indigo-600 px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-sm"
          >
            <CalendarDays className="w-4 h-4" />
            Programma Fisso
          </button>

          <button 
            onClick={() => setBustePagaModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600/10 border border-emerald-500 text-emerald-400 hover:text-white hover:bg-emerald-600 px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-sm"
          >
            <FileText className="w-4 h-4" />
            Buste Paga
          </button>
          
          <button 
            onClick={() => navigate(`/admin/dipendenti/modifica?id=${id}`)}
            className="flex items-center gap-2 bg-slate-800 border border-slate-600 text-slate-200 hover:text-indigo-400 hover:border-indigo-300 hover:bg-indigo-500/20 px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-sm"
          >
            <Edit className="w-4 h-4" />
            Modifica Dipendente
          </button>
        </div>
      </div>

      {/* Profilo Principale */}
      <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden mb-8 flex flex-col md:flex-row">
        
        <div className="bg-slate-900/50 border-r border-slate-700 p-8 flex flex-col items-center justify-center min-w-[280px]">
          {/* Avatar / Foto placeholder */}
          <div className="w-32 h-32 bg-indigo-500/20 rounded-full border-4 border-white shadow-md flex items-center justify-center mb-4">
            <span className="text-4xl font-bold text-indigo-400">
              {data.nome.charAt(0)}{data.cognome.charAt(0)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-50 text-center uppercase tracking-tight mb-2">
            {data.nome} {data.cognome}
          </h1>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border ${data.divisione === 'Interno' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'}`}>
            {data.divisione || 'Esterno'}
          </span>
          <p className="text-slate-400 mt-1 mb-4 font-medium">{data.id}</p>
          
          <div className={`px-4 py-1.5 rounded-full border font-bold text-xs uppercase tracking-widest ${statoColor}`}>
            {data.stato}
          </div>
        </div>

        <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Phone className="w-4 h-4" /> <span className="text-sm font-semibold uppercase tracking-wider">Telefono</span>
            </div>
            <p className="font-semibold text-lg text-slate-50">{data.telefono || 'Non specificato'}</p>
          </div>
          <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Mail className="w-4 h-4" /> <span className="text-sm font-semibold uppercase tracking-wider">Email</span>
            </div>
            <p className="font-semibold text-lg text-slate-50">{data.email || 'Non specificata'}</p>
          </div>
          <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <User className="w-4 h-4" /> <span className="text-sm font-semibold uppercase tracking-wider">Codice Fiscale</span>
            </div>
            <p className="font-mono font-bold text-lg text-slate-50 tracking-wide">{data.codice_fiscale}</p>
          </div>
          <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <MapPin className="w-4 h-4" /> <span className="text-sm font-semibold uppercase tracking-wider">Residenza</span>
            </div>
            <p className="font-semibold text-lg text-slate-50 leading-snug">{data.indirizzo ? `${data.indirizzo}, ${data.citta}` : 'Non specificata'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Dati Contrattuali */}
        <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
          <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Dettagli Contratto</h2>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-4">
              <span className="text-base font-medium text-slate-400">Mansione / Ruolo</span>
              <span className="font-bold text-xl text-slate-50">{data.mansione || '-'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-4">
              <span className="text-base font-medium text-slate-400">Paga Oraria</span>
              <span className="font-black text-indigo-400 text-2xl">€ {parseFloat(data.paga_oraria_reale || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-4">
              <span className="text-base font-medium text-slate-400">IBAN</span>
              <span className="font-mono font-bold text-slate-200 text-lg tracking-wider">{data.iban || 'Non inserito'}</span>
            </div>
          </div>
        </div>

        {/* Date e Scadenze */}
        <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
          <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Date e Scadenze</h2>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-4">
              <span className="text-base font-medium text-slate-400">Data Assunzione</span>
              <span className="font-bold text-lg text-slate-200">
                {safeDate(data.data_assunzione)}
              </span>
            </div>
            {data.proroghe && data.proroghe.length > 0 && (
              <div className="flex justify-between items-center border-b border-slate-700/50 pb-4">
                <span className="text-base font-medium text-slate-400">Scadenza Originale</span>
                <span className="font-bold text-lg text-slate-400">
                  {safeDate(data.proroghe[0].scadenza_precedente)}
                </span>
              </div>
            )}
            {data.proroghe && data.proroghe.map((p, index) => (
              <div key={p.id} className="flex justify-between items-center border-b border-slate-700/50 pb-4">
                <span className="text-base font-medium text-slate-400">{index + 1}ª Proroga fino al</span>
                <span className="font-bold text-lg text-indigo-300">
                  {safeDate(p.nuova_scadenza)}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-4">
              <span className="text-base font-medium text-slate-400">Scadenza Attuale</span>
              <span className={`font-black text-2xl ${
                data.stato === 'Indeterminato' ? 'text-emerald-400' : 
                data.scadenza ? 'text-amber-400' : 'text-slate-50'
              }`}>
                {data.stato === 'Indeterminato' ? 'Indeterminato' : 
                 (data.scadenza ? safeDate(data.scadenza) : 'Nessuna')}
              </span>
            </div>
            <div className="flex flex-col pt-2">
              <span className="text-base font-medium text-slate-400 mb-2">Note / Annotazioni</span>
              <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700 text-base text-slate-200 min-h-[80px] font-medium leading-relaxed shadow-inner">
                {data.note || <span className="text-slate-500 italic font-normal">Nessuna nota aggiuntiva.</span>}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Registro Chiavi */}
      <div className="mt-8 bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center gap-2">
          <Key className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Registro Storico Chiavi</h2>
        </div>
        <div className="p-6">
          {chiavi.length === 0 ? (
            <div className="text-slate-400 text-center py-6">Nessuna chiave registrata in storico.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-sm uppercase tracking-wider">
                    <th className="p-3 font-medium">Stato</th>
                    <th className="p-3 font-medium">Cliente</th>
                    <th className="p-3 font-medium text-center">Copia</th>
                    <th className="p-3 font-medium">Assegnata dal</th>
                    <th className="p-3 font-medium">Fino al</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {chiavi.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="p-3">
                        <span className={`px-2 py-1 text-xs font-bold rounded uppercase tracking-wider border ${
                          c.attivo === 1 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {c.attivo === 1 ? 'In Possesso' : 'Restituita'}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-slate-200">{c.cliente_nome}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{c.cliente_indirizzo}</p>
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-mono text-sm">
                          {c.num_copia}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-slate-300">
                        {c.data_assegnazione}
                      </td>
                      <td className="p-3 text-sm text-slate-400">
                        {c.attivo === 1 ? '-' : c.data_restituzione}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Documenti Allegati */}
      <div className="mt-8 bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Documenti Allegati</h2>
        </div>
        <div className="p-6">
          {documenti && documenti.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {documenti.map((doc, index) => (
                <div key={index} className="flex relative items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700 hover:border-indigo-500 hover:bg-slate-800 transition-all group">
                  <a 
                    href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/${doc.path}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full"
                  >
                    <div className="bg-indigo-500/20 p-3 rounded-lg group-hover:bg-indigo-500/30 transition-colors">
                      <Download className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="overflow-hidden pr-8">
                      <p className="font-semibold text-slate-200 text-sm truncate" title={doc.nome}>{doc.nome}</p>
                    </div>
                  </a>
                  <button 
                    onClick={(e) => handleDeleteDocument(e, doc.nome)}
                    className="absolute right-4 p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Elimina documento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nessun documento caricato per questo dipendente.</p>
            </div>
          )}
        </div>
      </div>

      <ModernModal 
        isOpen={modal.isOpen} 
        onClose={() => setModal({ isOpen: false })}
        type={modal.type}
        title={modal.title}
        subtitle={modal.subtitle}
        content={modal.content}
        primaryAction={modal.primaryAction}
        secondaryAction={modal.secondaryAction}
      />

      <ProgrammaFissoModal 
        isOpen={programmaFissoModalState.isOpen}
        idDipendente={id}
        onClose={() => setProgrammaFissoModalState({ isOpen: false })}
      />
      <BustePagaDipendenteModal 
        isOpen={bustePagaModalOpen}
        onClose={() => setBustePagaModalOpen(false)}
        idDipendente={id}
      />
    </div>
  );
}

