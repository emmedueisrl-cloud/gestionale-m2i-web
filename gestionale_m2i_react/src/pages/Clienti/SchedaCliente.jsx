import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Phone, Mail, MapPin, Landmark, ArrowLeft, Loader2, Edit, FileText, Download, Trash2, Camera, User, Key } from 'lucide-react';
import { recuperaDatiCompletiCliente, recuperaDocumentiCliente, eliminaDocumentoCliente, recuperaStoricoChiaviCliente } from '../../api/clienti';
import ModernModal from '../../components/ui/ModernModal';
import AttrezzatureCliente from '../../components/clienti/AttrezzatureCliente';
import PreventiviCliente from '../../components/clienti/PreventiviCliente';

export default function SchedaCliente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [documenti, setDocumenti] = useState([]);
  const [storicoChiavi, setStoricoChiavi] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ isOpen: false });

  useEffect(() => {
    async function loadData() {
      try {
        const [cli, docs, chiavi] = await Promise.all([
          recuperaDatiCompletiCliente(id),
          recuperaDocumentiCliente(id),
          recuperaStoricoChiaviCliente(id)
        ]);
        setData(cli);
        setDocumenti(docs || []);
        setStoricoChiavi(chiavi || []);
      } catch (err) {
        console.error("Errore caricamento Scheda Cliente:", err);
        setError(`Errore: ${err.message || 'Cliente non trovato'}`);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id]);

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
            await eliminaDocumentoCliente(id, nomeFile);
            const docs = await recuperaDocumentiCliente(id);
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

  const telefoni = data.telefono ? data.telefono.split(',').map(s => s.trim()).filter(Boolean) : [];
  const fotoServizio = Array.isArray(data.foto_servizio) ? data.foto_servizio : [];

  return (
    <div className="p-6 w-full pb-12">
      
      {/* Intestazione */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => navigate('/admin/clienti/lista')}
          className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition-colors font-medium group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          Torna all'Elenco
        </button>
        <button
          onClick={() => navigate(`/admin/clienti/modifica?id=${id}`)}
          className="flex items-center gap-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-slate-900 border border-amber-500/30 px-5 py-2 rounded-xl font-bold transition-all shadow-sm"
        >
          <Edit className="w-4 h-4" />
          Modifica Cliente
        </button>
      </div>

      {/* Profilo Principale */}
      <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="w-24 h-24 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner shrink-0">
            <Building2 className="w-12 h-12 text-indigo-400" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-extrabold text-slate-50 uppercase tracking-tight mb-2">
              {data.ragione_sociale}
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm font-medium text-slate-300">
              <span className="flex items-center gap-1.5 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700">
                <FileText className="w-4 h-4 text-slate-400" /> PI: {data.partita_iva}
              </span>
              {data.codice_fiscale && (
                <span className="flex items-center gap-1.5 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700">
                  <FileText className="w-4 h-4 text-slate-400" /> CF: {data.codice_fiscale}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center bg-slate-900/50 p-4 rounded-xl border border-slate-700 min-w-[140px]">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Stato</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${data.attivo === 'SI' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>
              {data.attivo === 'SI' ? 'ATTIVO' : 'NON ATTIVO'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30"><User className="w-6 h-6"/></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Operatore Assegnato</p>
            <p className="font-bold text-slate-100 text-lg uppercase tracking-wide">{data.operatore || 'NON ASSEGNATO'}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30"><User className="w-6 h-6"/></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Commerciale Assegnato</p>
            <p className="font-bold text-slate-100 text-lg uppercase tracking-wide">{data.commerciale || 'NON ASSEGNATO'}</p>
          </div>
        </div>
        <div className="col-span-1 md:col-span-2 bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30"><Landmark className="w-6 h-6"/></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Quotazione Cliente ({data.quotazione_tipo || 'Mensile'})</p>
            <p className="font-bold text-amber-400 text-2xl tracking-wide mb-1">{data.quotazione_importo ? `€ ${parseFloat(data.quotazione_importo).toFixed(2)}` : 'DA DEFINIRE'}</p>
            <p className="text-xs font-medium text-slate-300 uppercase tracking-wider">
              Tassazione: <span className="font-bold text-slate-100">{data.tipo_tassazione === 'ALTRO' ? data.tassazione_altro : (data.tipo_tassazione || 'DA DEFINIRE')}</span>
              {data.tipo_tassazione && data.tipo_tassazione !== 'REVERSE CHARGE' && ` (${data.percentuale_tassazione !== null && data.percentuale_tassazione !== undefined ? data.percentuale_tassazione : 22}%)`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Contatti Sede e Titolare */}
        <div className="space-y-8">
          <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
            <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-400" />
              <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Dati Sede</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-900 rounded-lg text-slate-400"><MapPin className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Indirizzo Sede</p>
                  <p className="font-medium text-slate-200">{data.indirizzo_sede || '-'} {data.civico_sede || ''}, {data.cap || ''} {data.citta || ''} {data.provincia ? `(${data.provincia})` : ''}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-900 rounded-lg text-slate-400"><Mail className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Email</p>
                  <p className="font-medium text-slate-200">{data.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-900 rounded-lg text-slate-400"><Mail className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">PEC</p>
                  <p className="font-medium text-slate-200">{data.pec || '-'}</p>
                </div>
              </div>
              {data.codice_sdi && (
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-slate-900 rounded-lg text-slate-400"><FileText className="w-4 h-4" /></div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Codice SDI</p>
                    <p className="font-medium text-slate-200">{data.codice_sdi}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
            <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-400" />
              <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Titolare & Referente</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-900 rounded-lg text-slate-400"><User className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Titolare</p>
                  <p className="font-medium text-slate-200">{data.titolare || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-900 rounded-lg text-slate-400"><Phone className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Telefono Titolare</p>
                  <p className="font-medium text-slate-200">{data.telefono_titolare || '-'}</p>
                </div>
              </div>
              <div className="h-px bg-slate-700 my-4"></div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-900 rounded-lg text-slate-400"><User className="w-4 h-4" /></div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Referente Principale</p>
                  <p className="font-medium text-slate-200">{data.referente || '-'}</p>
                  {data.ruolo_referente && <p className="text-sm text-slate-400 mt-1">{data.ruolo_referente}</p>}
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-900 rounded-lg text-slate-400"><Phone className="w-4 h-4" /></div>
                <div className="w-full">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Recapiti Telefonici Aziendali</p>
                  {telefoni.length > 0 ? (
                    <div className="flex flex-col">
                      {telefoni.map((tel, i) => (
                        <p key={i} className="font-medium text-slate-200">{tel}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="font-medium text-slate-200">-</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Amministrazione e Note */}
        <div className="space-y-8">
          <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
            <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-400" />
              <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Dati Amministrativi</h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Metodo di Pagamento</p>
                <div className="bg-slate-900/50 px-4 py-2.5 rounded-xl border border-slate-700 font-medium text-slate-200">
                  {data.metodo_pagamento || '-'}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Banca</p>
                <div className="bg-slate-900/50 px-4 py-2.5 rounded-xl border border-slate-700 font-medium text-slate-200">
                  {data.banca || '-'}
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">IBAN</p>
                <div className="bg-slate-900/50 px-4 py-2.5 rounded-xl border border-slate-700 font-mono text-slate-200">
                  {data.iban || '-'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
            <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Gestione Chiavi</h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-4">
                {(() => {
                  const chiaviAttive = (storicoChiavi || []).filter(k => k.attivo === 1);
                  const hasChiaviAttive = chiaviAttive.length > 0;
                  const numCopie = new Set(chiaviAttive.map(k => k.num_copia)).size;
                  
                  // Se non ci sono chiavi nel nuovo sistema, ma c'è il flag legacy
                  const isLegacy = !hasChiaviAttive && (storicoChiavi || []).length === 0 && data.possesso_chiavi === 'SI';

                  return (
                    <>
                      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider">Chiavi in Consegna?</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${hasChiaviAttive || isLegacy ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>
                          {hasChiaviAttive || isLegacy ? 'SÌ' : 'NO'}
                        </span>
                      </div>
                      
                      {isLegacy && (
                        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
                          <p className="text-red-400 text-sm font-semibold mb-1">Attenzione: Dato non aggiornato</p>
                          <p className="text-slate-300 text-sm">
                            Risulta {data.copie || 1} copia in possesso nel vecchio sistema. Entra in <strong>Modifica Cliente</strong> e utilizza il pulsante <strong>"+ Nuova Copia M2I"</strong> per registrarla nel nuovo registro storico.
                          </p>
                        </div>
                      )}

                      {hasChiaviAttive && (
                        <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                          <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider">Copie in Possesso</span>
                          <span className="font-bold text-slate-200 bg-slate-800 px-3 py-1 rounded-lg border border-slate-600">
                            {numCopie}
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
                
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                      <p className="text-slate-400 font-semibold uppercase text-xs tracking-wider mb-4">Storico Movimenti per Copia:</p>
                      
                      {/* Raggruppo lo storico per copia */}
                      {(() => {
                        if (!storicoChiavi || storicoChiavi.length === 0) return <p className="text-slate-500 italic">Nessun movimento registrato.</p>;
                        
                        const copieMap = {};
                        storicoChiavi.forEach(ass => {
                          if (!copieMap[ass.num_copia]) copieMap[ass.num_copia] = [];
                          copieMap[ass.num_copia].push(ass);
                        });

                        const formattaData = (dataStr) => {
                          if (!dataStr || dataStr === 'Oggi (In corso)') return dataStr;
                          const parts = dataStr.split('T')[0].split('-');
                          if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                          return dataStr;
                        };

                        return Object.keys(copieMap).map(copia => {
                          const movimenti = copieMap[copia];
                          const primaPresaInCarico = movimenti[0].data_assegnazione;
                          const ultimoMovimento = movimenti[movimenti.length - 1];
                          const riconsegnata = ultimoMovimento.attivo === 0 && ultimoMovimento.data_restituzione;
                          const dataFineM2I = riconsegnata ? ultimoMovimento.data_restituzione : 'Oggi (In corso)';

                          return (
                            <div key={copia} className="mb-6 last:mb-0 border border-slate-700/50 rounded-lg p-3 bg-slate-800/30">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="bg-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded text-sm border border-indigo-500/30">
                                  Copia {copia}
                                </span>
                                <span className="text-sm font-medium text-slate-300">
                                  Possesso M2I dal {formattaData(primaPresaInCarico)} al {formattaData(dataFineM2I)}
                                </span>
                              </div>
                              
                              <div className="pl-4 border-l-2 border-slate-700 space-y-3 relative ml-2">
                                {movimenti.map((mov, idx) => {
                                  const nomeDisplay = mov.possessore_nome;
                                  const isUltimo = idx === movimenti.length - 1;
                                  const isAttivo = mov.attivo === 1;

                                  return (
                                    <div key={mov.id} className="relative">
                                      <div className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full ${isAttivo ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-500'}`}></div>
                                      
                                      {isAttivo ? (
                                        <p className="text-sm text-emerald-400 font-medium">
                                          Attualmente in possesso a <strong className="uppercase">{nomeDisplay}</strong> dal {formattaData(mov.data_assegnazione)}
                                        </p>
                                      ) : (
                                        <p className="text-sm text-slate-400">
                                          Dal {formattaData(mov.data_assegnazione)} al {formattaData(mov.data_restituzione) || '?'} in possesso a <strong className="text-slate-300 uppercase">{nomeDisplay}</strong>
                                        </p>
                                      )}
                                      
                                      {mov.note && (
                                        <p className="text-xs text-slate-500 italic mt-0.5 ml-1">Nota: {mov.note}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Note - full width */}
      <div className="mt-8 bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Note</h2>
        </div>
        <div className="p-6">
          {data.note ? (
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 text-slate-300 text-sm whitespace-pre-wrap">
              {data.note}
            </div>
          ) : (
            <p className="text-slate-500 italic text-sm">Nessuna nota presente.</p>
          )}
        </div>
      </div>
      
      {/* Documenti e Foto */}
      <div className="mt-8 space-y-8">
        
        {/* Documenti Allegati */}
        <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
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
                      className="absolute right-4 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors z-10"
                      title="Elimina Documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 rounded-xl text-slate-500">
                <FileText className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm font-medium">Nessun documento caricato.</p>
              </div>
            )}
          </div>
        </div>

        {/* Attrezzature Magazzino */}
        <AttrezzatureCliente clienteId={id} />

        {/* Preventivi Cliente */}
        <PreventiviCliente clienteId={id} />

        {/* Foto Servizio */}
        <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
          <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Foto Servizio</h2>
          </div>
          <div className="p-6">
            {fotoServizio && fotoServizio.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {fotoServizio.map((url, index) => (
                  <div key={index} className="aspect-square bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                    <img 
                      src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/${url.replace(/^\/?/, '')}`} 
                      alt={`Foto ${index + 1}`} 
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 rounded-xl text-slate-500">
                <Camera className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm font-medium">Nessuna foto caricata.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      <ModernModal 
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.content}
        primaryAction={modal.primaryAction}
        secondaryAction={modal.secondaryAction}
        onClose={() => {
          if(!modal.primaryAction) setModal({ ...modal, isOpen: false });
        }}
      />
    </div>
  );
}
