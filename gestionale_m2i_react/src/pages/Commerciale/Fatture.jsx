import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Search, Loader2, Download, CheckCircle2, Upload, AlertTriangle, Trash2, Check, X, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recuperaFatture, aggiornaStatoFattura, anteprimaFattureCsv, confermaFattureCsv, anteprimaFattureXml, confermaFattureXml, eliminaFattureMulti, ottieniElaboratoClienti } from '../../api/commerciale';
import { recuperaElencoClienti, aggiornaRagioneSocialeCliente } from '../../api/clienti';
import DataTable from '../../components/ui/DataTable';
import ModernModal from '../../components/ui/ModernModal';

function SearchableSelect({ value, onChange, options, hasClient, idRow, isXml }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const selectedOption = options.find(o => o.id === value);
  const displayValue = selectedOption ? selectedOption.ragione_sociale : '';

  const filteredOptions = options.filter(o => 
    o.ragione_sociale.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full">
      <div 
        className={`w-full p-2 rounded-lg text-sm cursor-pointer border ${!hasClient ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 font-bold' : 'bg-slate-800 border-slate-600 text-slate-200'} flex justify-between items-center`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{displayValue || (isXml ? '✨ Crea Nuovo Cliente da XML' : '-- Seleziona Cliente --')}</span>
        <span className="text-slate-400 text-xs">▼</span>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-100 border border-slate-300 rounded-lg shadow-xl max-h-60 flex flex-col">
          <div className="p-2 border-b border-slate-300 bg-slate-50 rounded-t-lg sticky top-0">
            <input
              type="text"
              autoFocus
              className="w-full p-2 text-sm bg-white border border-slate-300 text-slate-900 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
              placeholder="Cerca cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="overflow-y-auto">
            {isXml && (
              <div
                className="px-3 py-2 text-sm text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 cursor-pointer border-b border-slate-200 flex items-center gap-2"
                onClick={() => {
                  onChange(idRow, null);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
              >
                <Plus className="w-4 h-4" /> Crea Nuovo Cliente da XML
              </div>
            )}
            {filteredOptions.length > 0 ? (
              filteredOptions.map(c => (
                <div
                  key={c.id}
                  className="px-3 py-2 text-sm text-slate-800 hover:bg-indigo-100 cursor-pointer border-b border-slate-200 last:border-0"
                  onClick={() => {
                    onChange(idRow, c.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  {c.ragione_sociale}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">Nessun cliente trovato</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Fatture() {
  const navigate = useNavigate();
  const dataOdierna = new Date();
  
  const [mese, setMese] = useState(dataOdierna.getMonth() + 1);
  const [anno, setAnno] = useState(dataOdierna.getFullYear());
  const [stato, setStato] = useState('Tutte');
    const [selectedFatture, setSelectedFatture] = useState([]); 
  
  const [fatture, setFatture] = useState([]);
  const [clienti, setClienti] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, type: '', message: '' });

  // CSV Staging State
  const [csvFile, setCsvFile] = useState(null);
  const [isCsvMonthModalOpen, setIsCsvMonthModalOpen] = useState(false);
  const [csvMese, setCsvMese] = useState(dataOdierna.getMonth() + 1);
  const [csvAnno, setCsvAnno] = useState(dataOdierna.getFullYear());
  const [stagingData, setStagingData] = useState(null); // array di righe + clientiDisponibili
  const [activeStagingTab, setActiveStagingTab] = useState('caricate');
  const [aggiornamentiClienti, setAggiornamentiClienti] = useState({});

  // Main view state
  const [activeMainTab, setActiveMainTab] = useState('emesse');
  const [clientiMancanti, setClientiMancanti] = useState([]);
  
  // XML Staging State
  const [xmlFiles, setXmlFiles] = useState([]);
  const [isXmlMonthModalOpen, setIsXmlMonthModalOpen] = useState(false);

  const mesi = [
    { val: 1, label: 'Gennaio' }, { val: 2, label: 'Febbraio' }, { val: 3, label: 'Marzo' },
    { val: 4, label: 'Aprile' }, { val: 5, label: 'Maggio' }, { val: 6, label: 'Giugno' },
    { val: 7, label: 'Luglio' }, { val: 8, label: 'Agosto' }, { val: 9, label: 'Settembre' },
    { val: 10, label: 'Ottobre' }, { val: 11, label: 'Novembre' }, { val: 12, label: 'Dicembre' }
  ];

  useEffect(() => {
    async function loadFiltri() {
      try {
        const cls = await recuperaElencoClienti();
        setClienti(cls || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadFiltri();
  }, []);

  const caricaDati = async () => {
    setIsLoading(true);
    try {
      const dati = await recuperaFatture(mese, anno);
      let elaboratiDb = [];
      try {
        const elaboratoResp = await ottieniElaboratoClienti(mese, anno);
        elaboratiDb = elaboratoResp?.dati || [];
      } catch (err) {
        console.warn("Errore caricamento elaborato per quadratura principale:", err);
      }
      
      const fTrovate = dati || [];
      const mancanti = elaboratiDb.filter(el => !fTrovate.some(f => f.cliente_id === el.idCliente));
      setClientiMancanti(mancanti);

      setFatture(fTrovate.map(f => {
        const isExtra = !elaboratiDb.some(el => el.idCliente === f.cliente_id && parseFloat(el.imponibile || 0) > 0);
        return {
          ...f,
          numero: f.numero_fattura,
          dataEmissione: f.data_fattura,
          cliente: f.clienteNome || f.ragione_sociale || 'Sconosciuto',
          imponibile: f.importo_imponibile,
          totale: f.importo_totale,
          stato: f.stato_pagamento || f.stato || 'Emessa',
          isExtra: isExtra && elaboratiDb.length > 0
        };
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    caricaDati();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mese, anno]);

  const cambiaStatoFattura = async (idFattura, nuovoStato) => {
    try {
      await aggiornaStatoFattura(idFattura, nuovoStato);
      caricaDati();
      setModalState({ isOpen: true, type: 'success', message: `Stato fattura aggiornato a ${nuovoStato}.` });
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore nell\'aggiornamento dello stato.' });
    }
  };

  const handleSelectCsv = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
      setIsCsvMonthModalOpen(true);
    }
    e.target.value = null; // reset
  };

  const handleProcessCsv = async () => {
    if (!csvFile) return;
    setIsCsvMonthModalOpen(false);
    setIsLoading(true);
    try {
      const resp = await anteprimaFattureCsv(csvFile, csvMese, csvAnno);
      if (resp.success) {
        setStagingData({ righe: resp.dati, clientiDisponibili: resp.clienti_disponibili, elaboratiDisponibili: resp.elaborati_disponibili });
      }
    } catch (error) {
      setModalState({ isOpen: true, type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStagingRow = (idRow, newClienteId) => {
    if (!stagingData) return;
    const newRighe = stagingData.righe.map(r => {
      if (r.idRow === idRow) {
        const c = stagingData.clientiDisponibili.find(cl => cl.id === newClienteId);
        
        let importoElaborato = null;
        let squadratura = true;
        
        if (c && stagingData.elaboratiDisponibili) {
          const el = stagingData.elaboratiDisponibili.find(e => e.idCliente === c.id);
          if (el) {
            importoElaborato = parseFloat(el.imponibile);
            const imponibileFattura = parseFloat(r.importo_imponibile);
            const totaleFattura = parseFloat(r.importo_totale);
            if (Math.abs(importoElaborato - imponibileFattura) > 0.50 && Math.abs(importoElaborato - totaleFattura) > 0.50) {
              squadratura = true;
            } else {
              squadratura = false;
            }
          }
        }
        
        return { 
          ...r, 
          cliente_id: newClienteId, 
          cliente_nome: c ? c.ragione_sociale : null,
          importo_elaborato: importoElaborato,
          squadratura: squadratura
        };
      }
      return r;
    });
    setStagingData({ ...stagingData, righe: newRighe });
  };

  const handleAggiornaNomeCliente = async (idCliente, nuovoNome) => {
    if (!idCliente || !nuovoNome) return;
    try {
      await aggiornaRagioneSocialeCliente(idCliente, nuovoNome);
      
      // Aggiorna lo stato locale per nascondere il bottone e aggiornare la lista
      if (stagingData) {
        const newClienti = stagingData.clientiDisponibili.map(c => 
          c.id === idCliente ? { ...c, ragione_sociale: nuovoNome } : c
        );
        const newRighe = stagingData.righe.map(r => 
          r.cliente_id === idCliente ? { ...r, cliente_nome: nuovoNome } : r
        );
        setStagingData({ righe: newRighe, clientiDisponibili: newClienti, elaboratiDisponibili: stagingData.elaboratiDisponibili });
      }
      setModalState({ isOpen: true, type: 'success', message: 'Rubrica aggiornata con successo! Dal prossimo mese verrà riconosciuto in automatico.' });
    } catch (err) {
      setModalState({ isOpen: true, type: 'error', message: err.message || 'Errore durante l\'aggiornamento.' });
    }
  };

  const handleDeleteStagingRow = (idRow) => {
    if (!stagingData) return;
    const newRighe = stagingData.righe.filter(r => r.idRow !== idRow);
    setStagingData({ ...stagingData, righe: newRighe });
  };

  
  const handleXmlFileChange = (e) => {
    if (e.target.files.length > 0) {
      setXmlFiles(Array.from(e.target.files));
      setIsXmlMonthModalOpen(true);
    }
  };

  const handleProcessXml = async () => {
    setIsXmlMonthModalOpen(false);
    setIsLoading(true);
    try {
      const resp = await anteprimaFattureXml(xmlFiles, csvMese, csvAnno);
      if (resp.success) {
        setStagingData({ righe: resp.dati, clientiDisponibili: resp.clienti_disponibili, elaboratiDisponibili: resp.elaborati_disponibili, isXml: true });
        setAggiornamentiClienti({});
      }
    } catch (error) {
      setModalState({ isOpen: true, type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleConfirmXml = async () => {
    setIsLoading(true);
    try {
      const righe = stagingData.righe; 
      const resp = await confermaFattureXml(righe, aggiornamentiClienti);
      if (resp.success) {
        setStagingData(null);
        setModalState({ isOpen: true, type: 'success', message: 'Fatture importate con successo!' });
        caricaDati();
      }
    } catch (error) {
      setModalState({ isOpen: true, type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCsv = async () => {
    if (!stagingData) return;
    const errors = stagingData.righe.filter(r => !r.cliente_id);
    if (errors.length > 0) {
      setModalState({ isOpen: true, type: 'error', message: "Ci sono righe senza un cliente associato. Sistemali o eliminale prima di salvare." });
      return;
    }
    
    setIsLoading(true);
    try {
      const resp = await confermaFattureCsv(stagingData.righe);
      if (resp.success) {
        setModalState({ isOpen: true, type: 'success', message: `Importate con successo ${resp.inserite} fatture.` });
        setStagingData(null);
        caricaDati();
      }
    } catch (error) {
      setModalState({ isOpen: true, type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const fattureFiltrate = fatture.filter(f => {
    if (stato === 'Tutte') return true;
    return f.stato === stato;
  });

  const fattureExtra = fattureFiltrate.filter(f => f.isExtra);

  const columns = [
      { header: 'ID / Numero', accessor: 'numero' },
      { header: 'Data', accessor: 'dataEmissione' },
      { 
        header: 'Cliente', 
        accessor: 'cliente',
        render: (row) => (
          <div className="flex flex-col">
            <span>{row.cliente}</span>
            {row.isExtra && (
              <span className="w-fit mt-1 px-2 py-0.5 bg-fuchsia-500/20 text-fuchsia-400 text-[10px] font-bold rounded uppercase whitespace-nowrap">Non in Elaborato</span>
            )}
          </div>
        )
      },
      { 
        header: 'Causale (XML)', 
        accessor: 'note',
        render: (row) => <div className="max-w-[200px] truncate text-xs" title={row.note}>{row.note || '-'}</div>
      },
    { 
      header: 'Imponibile', 
      accessor: 'imponibile',
      render: (row) => `€ ${parseFloat(row.imponibile || 0).toFixed(2)}`
    },
      { 
        header: 'Totale Documento', 
        accessor: 'totale',
        render: (row) => <span className="font-bold">€ {parseFloat(row.totale || 0).toFixed(2)}</span>
      },
      { 
        header: 'Stato', 
        accessor: 'stato',
        render: (row) => (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            row.stato === 'Emessa' ? 'bg-emerald-500/20 text-emerald-300' :
            row.stato === 'Pagata' ? 'bg-indigo-500/20 text-indigo-300' :
            row.stato === 'Insoluto' ? 'bg-red-500/20 text-red-300' :
            row.stato === 'Parzialmente Pagata' ? 'bg-fuchsia-500/20 text-fuchsia-300' :
            'bg-amber-500/20 text-amber-300'
          }`}>
            {row.stato}
          </span>
        )
      },
      {
        header: 'Azioni',
        accessor: 'azioni',
        render: (row) => (
          <div className="flex items-center gap-2">
            <select 
              className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 text-xs hover:border-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
              value=""
              onChange={(e) => {
                if (e.target.value) cambiaStatoFattura(row.id, e.target.value);
              }}
              title="Cambia Stato"
            >
              <option value="" disabled>Cambia stato...</option>
              <option value="Emessa">Segna come Emessa</option>
              <option value="Pagata">Segna come Pagata</option>
              <option value="Parzialmente Pagata">Pagata in parte</option>
              <option value="Insoluto">Segna come Insoluto</option>
            </select>
          </div>
        )
      }
    ];

  return (
    <div className="p-6 w-full mx-auto h-[calc(100vh-100px)] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 rounded-xl">
            <Receipt className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-50">Gestione Fatture</h1>
            <p className="text-slate-400 text-sm">Monitoraggio emissioni e ciclo attivo</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-700">
          <select 
            value={mese} 
            onChange={(e) => setMese(Number(e.target.value))}
            className="p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {mesi.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>

          <input 
            type="number" 
            value={anno} 
            onChange={(e) => setAnno(Number(e.target.value))}
            className="p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-24"
          />

          <select 
            value={stato} 
            onChange={(e) => setStato(e.target.value)}
            className="p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="Tutte">Stato: Tutte</option>
            <option value="Emesse">Stato: Emesse</option>
            <option value="Da Emettere">Stato: Da Emettere</option>
          </select>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="csvUpload"
              onChange={handleSelectCsv}
            />
            <label
              htmlFor="csvUpload"
              className="px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Importa CSV
            </label>
            <input
              type="file"
              accept=".xml"
              multiple
              className="hidden"
              id="xmlUpload"
              onChange={handleXmlFileChange}
            />
            <label
              htmlFor="xmlUpload"
              className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Importa XML Massivo
            </label>
            {selectedFatture.length > 0 && (
              <button
                onClick={async () => {
                  if (confirm(`Vuoi eliminare ${selectedFatture.length} fatture?`)) {
                    try {
                      await eliminaFattureMulti(selectedFatture);
                      setSelectedFatture([]);
                      caricaDati();
                    } catch (e) {
                      setModalState({ isOpen: true, type: 'error', message: e.message });
                    }
                  }
                }}
                className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Elimina Selezionate
              </button>
            )}
          </div>
        </div>
      </div>
        
        <div className="flex gap-4 px-6 border-b border-slate-700 bg-slate-800 rounded-t-2xl">
          <button 
            className={`py-3 font-medium border-b-2 transition-colors ${activeMainTab === 'emesse' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`} 
            onClick={() => setActiveMainTab('emesse')}
          >
            Tutte le Fatture ({fattureFiltrate.length})
          </button>
          <button 
            className={`py-3 font-medium border-b-2 transition-colors ${activeMainTab === 'mancanti' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`} 
            onClick={() => setActiveMainTab('mancanti')}
          >
            Clienti Mancanti ({clientiMancanti.length})
          </button>
          <button 
            className={`py-3 font-medium border-b-2 transition-colors ${activeMainTab === 'extra' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`} 
            onClick={() => setActiveMainTab('extra')}
          >
            Non in Elaborato ({fattureExtra.length})
          </button>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-800 rounded-b-2xl shadow-xl border-x border-b border-slate-700 flex flex-col relative">
          {isLoading && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          )}
          
          {activeMainTab === 'emesse' && (
            <DataTable 
              data={fattureFiltrate}
              columns={columns}
              searchPlaceholder="Cerca per numero, cliente..."
              itemsPerPage={15}
              selectable={true}
              selectedRows={selectedFatture}
              onSelectionChange={setSelectedFatture}
            />
          )}

          {activeMainTab === 'extra' && (
            <DataTable 
              data={fattureExtra}
              columns={columns}
              searchPlaceholder="Cerca per numero, cliente..."
              itemsPerPage={15}
              selectable={true}
              selectedRows={selectedFatture}
              onSelectionChange={setSelectedFatture}
            />
          )}

          {activeMainTab === 'mancanti' && (
            <div className="flex-1 overflow-auto p-6 bg-slate-900/50">
              {clientiMancanti.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs uppercase text-slate-400 border-b border-slate-700">
                      <th className="pb-3 font-medium px-4">Cliente</th>
                      <th className="pb-3 font-medium text-right px-4">Importo Imponibile Atteso</th>
                      <th className="pb-3 font-medium text-right px-4">Importo Totale Atteso</th>
                      <th className="pb-3 font-medium px-4">Note Elaborato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {clientiMancanti.map((man, idx) => {
                      const c = clienti.find(cl => cl.id === man.idCliente);
                      const nome = c ? c.ragione_sociale : man.idCliente;
                      return (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                          <td className="py-4 px-4">
                            <div className="font-medium text-slate-200">{nome}</div>
                          </td>
                          <td className="py-4 text-right px-4 font-bold text-slate-300">
                            € {parseFloat(man.imponibile).toFixed(2)}
                          </td>
                          <td className="py-4 text-right px-4 font-bold text-slate-300">
                            € {parseFloat(man.importoTotale).toFixed(2)}
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-xs text-slate-400 max-w-[250px] truncate" title={man.note}>
                              {man.note || '-'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 opacity-50" />
                  <h3 className="text-xl font-bold text-slate-300">Tutte le fatture presenti!</h3>
                  <p className="text-sm mt-2">Nessun cliente presente nell'elaborato manca all'appello in questo mese.</p>
                </div>
              )}
            </div>
          )}
        </div>

      {/* MODALE SELEZIONE MESE XML */}
      {isXmlMonthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-slate-100 mb-2">Importazione Massiva XML</h3>
            <p className="text-sm text-slate-400 mb-6">A quale mese si riferiscono queste {xmlFiles.length} fatture per la quadratura dell'elaborato?</p>
            
            <div className="flex gap-4 mb-6">
              <select 
                value={csvMese} 
                onChange={(e) => setCsvMese(Number(e.target.value))}
                className="flex-1 p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {mesi.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
              <input 
                type="number" 
                value={csvAnno} 
                onChange={(e) => setCsvAnno(Number(e.target.value))}
                className="w-24 p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsXmlMonthModalOpen(false)}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-xl hover:bg-slate-600 font-medium"
              >
                Annulla
              </button>
              <button 
                onClick={handleProcessXml}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 font-bold"
              >
                Analizza XML
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE SELEZIONE MESE CSV */}
      {isCsvMonthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-slate-100 mb-2">Importazione Massiva CSV</h3>
            <p className="text-sm text-slate-400 mb-6">A quale mese si riferiscono queste fatture per la quadratura dell'elaborato?</p>
            
            <div className="flex gap-4 mb-6">
              <select 
                value={csvMese} 
                onChange={(e) => setCsvMese(Number(e.target.value))}
                className="flex-1 p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {mesi.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
              <input 
                type="number" 
                value={csvAnno} 
                onChange={(e) => setCsvAnno(Number(e.target.value))}
                className="w-24 p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsCsvMonthModalOpen(false)}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-xl hover:bg-slate-600 font-medium"
              >
                Annulla
              </button>
              <button 
                onClick={handleProcessCsv}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 font-bold"
              >
                Analizza CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE STAGING CSV E XML */}
      {stagingData && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
              <div>
                <h2 className="text-2xl font-bold text-slate-50 flex items-center gap-2">
                  <Upload className="text-indigo-400 w-6 h-6" /> Anteprima Importazione
                </h2>
                <p className="text-slate-400 mt-1 text-sm">Controlla e correggi i dati prima di salvare. Quadratura con elaborato: {mesi.find(m=>m.val===csvMese)?.label} {csvAnno}</p>
              </div>
              <button onClick={() => setStagingData(null)} className="p-2 text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-4 border-b border-slate-700 px-6 bg-slate-800/50">
              <button 
                className={`py-3 font-medium border-b-2 transition-colors ${activeStagingTab === 'caricate' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`} 
                onClick={() => setActiveStagingTab('caricate')}
              >
                Fatture Caricate ({stagingData.righe.length})
              </button>
              <button 
                className={`py-3 font-medium border-b-2 transition-colors ${activeStagingTab === 'mancanti' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`} 
                onClick={() => setActiveStagingTab('mancanti')}
              >
                Fatture Mancanti ({fattureMancanti.length})
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-slate-900/50">
              {activeStagingTab === 'caricate' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs uppercase text-slate-400 border-b border-slate-700">
                      <th className="pb-3 font-medium px-4">Stato</th>
                      <th className="pb-3 font-medium">Numero/Data</th>
                      <th className="pb-3 font-medium min-w-[200px]">{stagingData?.isXml ? 'Cliente (XML)' : 'Cliente (CSV)'}</th>
                      <th className="pb-3 font-medium min-w-[250px]">Cliente Trovato/Associato</th>
                      <th className="pb-3 font-medium text-right">{stagingData?.isXml ? 'Importo XML' : 'Importo CSV'}</th>
                      <th className="pb-3 font-medium text-right px-4">Importo Elaborato</th>
                      {stagingData?.isXml && <th className="pb-3 font-medium min-w-[200px]">Causale</th>}
                      <th className="pb-3 font-medium text-center">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stagingData.righe.map(row => {
                      const hasClient = !!row.cliente_id;
                      return (
                        <tr key={row.idRow} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                          <td className="py-4 px-4">
                            {!hasClient ? (
                              <span className="inline-flex items-center px-2 py-1 bg-red-500/20 text-red-400 rounded-md text-xs font-bold border border-red-500/30">SCONOSCIUTO</span>
                            ) : row.squadratura ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-md text-xs font-bold border border-amber-500/30" title="L'importo non coincide con l'elaborato">
                                <AlertTriangle className="w-3 h-3" /> SQUADRATURA
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md text-xs font-bold border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" /> OK
                              </span>
                            )}
                          </td>
                          <td className="py-4">
                            <div className="font-bold text-slate-200">{row.numero_fattura}</div>
                            <div className="text-xs text-slate-400">{row.data_fattura}</div>
                          </td>
                          <td className="py-4">
                            <div className="text-sm font-medium text-slate-200">{row.clienteCSV}</div>
                            <div className="text-xs text-slate-400">P.IVA: {row.pIvaCSV || 'N/D'}</div>
                          </td>
                          <td className="py-4 w-1/3">
                            <div className="flex flex-col gap-2">
                              <SearchableSelect 
                                value={row.cliente_id}
                                onChange={handleUpdateStagingRow}
                                options={stagingData.clientiDisponibili}
                                hasClient={hasClient}
                                idRow={row.idRow}
                                isXml={stagingData.isXml}
                              />
                              {stagingData.isXml && row.discrepancy && (
                                <div className="mt-2 flex items-center gap-2">
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-slate-600 bg-slate-700/50"
                                    checked={aggiornamentiClienti[row.idRow] || false} 
                                    onChange={(e) => setAggiornamentiClienti({...aggiornamentiClienti, [row.idRow]: e.target.checked})} 
                                  /> 
                                  <span className="text-[11px] text-amber-400 font-bold">Aggiorna P.IVA/Sede da XML</span>
                                </div>
                              )}
                              {!stagingData.isXml && hasClient && row.clienteCSV && row.clienteCSV !== row.cliente_nome && (
                                <button
                                  onClick={() => handleAggiornaNomeCliente(row.cliente_id, row.clienteCSV)}
                                  className="flex items-center gap-1 w-fit text-[11px] font-bold px-2 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded hover:bg-indigo-500 hover:text-white transition-colors"
                                  title="Aggiorna il nome in rubrica per farlo riconoscere in automatico il prossimo mese"
                                >
                                  <Save className="w-3 h-3" /> Salva nome in Rubrica
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-4 text-right font-bold text-slate-200">
                            € {parseFloat(row.importo_imponibile).toFixed(2)}
                          </td>
                          <td className="py-4 text-right px-4">
                            {row.importo_elaborato !== null ? (
                              <span className={`font-bold ${row.squadratura ? 'text-amber-400' : 'text-emerald-400'}`}>
                                € {parseFloat(row.importo_elaborato).toFixed(2)}
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-fuchsia-500/20 text-fuchsia-400 text-[10px] font-bold rounded uppercase whitespace-nowrap">Non in Elaborato</span>
                            )}
                          </td>
                          {stagingData?.isXml && (
                            <td className="py-4 px-2">
                              <div className="text-xs text-slate-300 max-w-[250px] truncate" title={row.note}>
                                {row.note || '-'}
                              </div>
                            </td>
                          )}
                          <td className="py-4 text-center">
                            <button 
                              onClick={() => setStagingData({ ...stagingData, righe: stagingData.righe.filter(r => r.idRow !== row.idRow) })}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Rimuovi riga"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {activeStagingTab === 'mancanti' && (
                <div className="w-full h-full">
                  {fattureMancanti.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-xs uppercase text-slate-400 border-b border-slate-700">
                          <th className="pb-3 font-medium px-4">Cliente</th>
                          <th className="pb-3 font-medium text-right px-4">Importo Imponibile Atteso</th>
                          <th className="pb-3 font-medium text-right px-4">Importo Totale Atteso</th>
                          <th className="pb-3 font-medium px-4">Note Elaborato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {fattureMancanti.map((man, idx) => {
                          const c = stagingData.clientiDisponibili.find(cl => cl.id === man.idCliente);
                          const nome = c ? c.ragione_sociale : man.idCliente;
                          return (
                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                              <td className="py-4 px-4">
                                <div className="font-medium text-slate-200">{nome}</div>
                              </td>
                              <td className="py-4 text-right px-4 font-bold text-slate-300">
                                € {parseFloat(man.imponibile).toFixed(2)}
                              </td>
                              <td className="py-4 text-right px-4 font-bold text-slate-300">
                                € {parseFloat(man.importoTotale).toFixed(2)}
                              </td>
                              <td className="py-4 px-4">
                                <div className="text-xs text-slate-400 max-w-[250px] truncate" title={man.note}>
                                  {man.note || '-'}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 opacity-50" />
                      <h3 className="text-xl font-bold text-slate-300">Tutte le fatture presenti!</h3>
                      <p className="text-sm mt-2">Nessun cliente presente nell'elaborato manca all'appello.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-700 bg-slate-800 flex justify-between items-center">
              <div className="text-sm text-slate-400">
                Trovate <span className="font-bold text-slate-200">{stagingData.righe.length}</span> fatture.
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setStagingData(null)}
                  className="px-4 py-2 bg-slate-700 text-slate-200 rounded-xl hover:bg-slate-600 font-medium"
                >
                  Annulla
                </button>
                <button 
                  onClick={stagingData.isXml ? handleConfirmXml : handleConfirmCsv}
                  disabled={!stagingData.isXml && stagingData.righe.some(r => !r.cliente_id)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" /> Salva Definitivamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
