const fs = require('fs');
let content = fs.readFileSync('src/pages/Commerciale/Fatture.jsx', 'utf8');

const goodPart = content.split('<option value="Da Emettere">Stato: Da Emettere</option>\n          </select>')[0] + '<option value="Da Emettere">Stato: Da Emettere</option>\n          </select>';

const missingPart = `
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="csvUpload"
              onChange={(e) => { if(e.target.files.length) { setCsvFile(e.target.files[0]); setIsCsvMonthModalOpen(true); } }}
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
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-800 rounded-2xl shadow-xl border border-slate-700 flex flex-col relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        )}
        
        <DataTable 
          data={fattureFiltrate}
          columns={columns}
          searchPlaceholder="Cerca per numero, cliente..."
          itemsPerPage={15}
        />
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
            
            <div className="flex-1 overflow-auto p-6 bg-slate-900/50">
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
                            <span className={\`font-bold \${row.squadratura ? 'text-amber-400' : 'text-emerald-400'}\`}>
                              € {parseFloat(row.importo_elaborato).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-sm">N/D</span>
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
`;

fs.writeFileSync('src/pages/Commerciale/Fatture.jsx', goodPart + missingPart);
