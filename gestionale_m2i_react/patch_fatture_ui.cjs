const fs = require('fs');

let content = fs.readFileSync('src/pages/Commerciale/Fatture.jsx', 'utf8');

const targetStr = `{hasClient && row.clienteCSV && row.clienteCSV !== row.cliente_nome && (`;
const replacementStr = `{stagingData.isXml && row.discrepancy && (
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
                              {!stagingData.isXml && hasClient && row.clienteCSV && row.clienteCSV !== row.cliente_nome && (`;

content = content.replace(targetStr, replacementStr);

const tableHeaders = `<th className="pb-3 font-medium text-right px-4">Importo Elaborato</th>
                      <th className="pb-3 font-medium text-center">Azioni</th>`;
const newHeaders = `<th className="pb-3 font-medium text-right px-4">Importo Elaborato</th>
                      {stagingData?.isXml && <th className="pb-3 font-medium min-w-[200px]">Causale</th>}
                      <th className="pb-3 font-medium text-center">Azioni</th>`;

content = content.replace(tableHeaders, newHeaders);

const azioniCell = `<td className="py-4 text-center">
                            <button 
                              onClick={() => setStagingData({ ...stagingData, righe: stagingData.righe.filter(r => r.idRow !== row.idRow) })}`;

const newCausaleAndAzioni = `{stagingData?.isXml && (
                            <td className="py-4 px-2">
                              <div className="text-xs text-slate-300 max-w-[250px] truncate" title={row.note}>
                                {row.note || '-'}
                              </div>
                            </td>
                          )}
                          <td className="py-4 text-center">
                            <button 
                              onClick={() => setStagingData({ ...stagingData, righe: stagingData.righe.filter(r => r.idRow !== row.idRow) })}`;
                              
content = content.replace(azioniCell, newCausaleAndAzioni);

fs.writeFileSync('src/pages/Commerciale/Fatture.jsx', content);
