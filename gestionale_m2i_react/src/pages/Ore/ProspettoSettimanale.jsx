import React, { useState, useEffect } from 'react';
import { Loader2, CalendarDays, Clock, Users, Briefcase } from 'lucide-react';
import { recuperaProspettoGlobale } from '../../api/ore';

export default function ProspettoSettimanale() {
  const [impegni, setImpegni] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const dati = await recuperaProspettoGlobale();
        setImpegni(dati || []);
      } catch (err) {
        console.error(err);
        setError("Impossibile caricare il prospetto settimanale.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Helper per calcolare le ore di un impegno
  const calcolaOre = (inizio, fine) => {
    if (!inizio || !fine) return 0;
    const [h1, m1] = inizio.split(':').map(Number);
    const [h2, m2] = fine.split(':').map(Number);
    let ore = h2 - h1 + (m2 - m1) / 60;
    return ore > 0 ? ore : 0;
  };

  // Separiamo Settimanali da Extra
  const impegniSettimanali = impegni.filter(i => (i.frequenza || 'Settimanale').toLowerCase() === 'settimanale');
  const impegniExtra = impegni.filter(i => i.id && (i.frequenza || '').toLowerCase() !== 'settimanale');

  // Raggruppiamo i settimanali per Dipendente
  const mapDipendenti = {};
  impegniSettimanali.forEach(imp => {
    if (!mapDipendenti[imp.dipendenteId]) {
      mapDipendenti[imp.dipendenteId] = {
        nome: imp.dipendenteNome,
        totaleOre: 0,
        giorni: { lunedi: [], martedi: [], mercoledi: [], giovedi: [], venerdi: [], sabato: [], domenica: [] }
      };
    }
    
    if (imp.id) {
      const ore = calcolaOre(imp.oraInizio, imp.oraFine);
      mapDipendenti[imp.dipendenteId].totaleOre += ore;
      
      const giornoKey = (imp.giorno || '').toLowerCase().replace(/ì/g, 'i').replace(/è/g, 'e');
      if (mapDipendenti[imp.dipendenteId].giorni[giornoKey]) {
        mapDipendenti[imp.dipendenteId].giorni[giornoKey].push(imp);
      }
    }
  });

  // Ordiniamo in modo che ogni giorno abbia gli impegni ordinati per ora d'inizio
  Object.values(mapDipendenti).forEach(dip => {
    Object.keys(dip.giorni).forEach(g => {
      dip.giorni[g].sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));
    });
  });

  const dipendentiList = Object.values(mapDipendenti).sort((a, b) => a.nome.localeCompare(b.nome));

  // Statistiche globali
  const totaleOreAzienda = dipendentiList.reduce((acc, curr) => acc + curr.totaleOre, 0);
  const numeroOperatori = dipendentiList.length;
  const clientiSet = new Set(impegniSettimanali.filter(i => i.id).map(i => i.clienteNome));
  const numeroClienti = clientiSet.size;

  const orderGiorni = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
  const labelsGiorni = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-500 font-bold bg-red-50 rounded-lg">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Intestazione e Statistiche */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-indigo-600" />
            Prospetto Settimanale
          </h1>
          <p className="text-slate-500 mt-1">Carico di lavoro basato sul Programma Fisso</p>
        </div>

        <div className="flex gap-4">
          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Clock className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Tot. Ore Settimana</p>
              <p className="text-xl font-bold text-slate-800">{totaleOreAzienda.toFixed(1)} h</p>
            </div>
          </div>
          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Operatori</p>
              <p className="text-xl font-bold text-slate-800">{numeroOperatori}</p>
            </div>
          </div>
          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Briefcase className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Clienti Serviti</p>
              <p className="text-xl font-bold text-slate-800">{numeroClienti}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Griglia Principale */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold w-48 border-r border-slate-200">Operatore</th>
                {labelsGiorni.map(g => (
                  <th key={g} className="px-4 py-3 font-semibold text-center border-r border-slate-200 min-w-[160px]">{g}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dipendentiList.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    Nessun programma fisso settimanale configurato.
                  </td>
                </tr>
              ) : (
                dipendentiList.map((dip, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 border-r border-slate-200 align-top bg-slate-50/30">
                      <div className="font-bold text-slate-800">{dip.nome}</div>
                      <div className="text-xs font-medium text-indigo-600 mt-1 bg-indigo-50 inline-block px-2 py-0.5 rounded-full">
                        {dip.totaleOre.toFixed(1)} ore / sett
                      </div>
                    </td>
                    {orderGiorni.map(giornoKey => (
                      <td key={giornoKey} className="p-2 border-r border-slate-200 align-top">
                        <div className="flex flex-col gap-2">
                          {dip.giorni[giornoKey].map(imp => (
                            <div key={imp.id} className="bg-white border border-slate-200 rounded p-2 shadow-sm text-xs">
                              <div className="font-bold text-slate-700 truncate" title={imp.clienteNome}>
                                {imp.clienteNome}
                              </div>
                              <div className="text-slate-500 flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" /> {imp.oraInizio} - {imp.oraFine}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Impegni Extra */}
      {impegniExtra.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mt-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-amber-400 rounded-full inline-block"></span>
            Impegni Extra (Quindicinali / Mensili)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {impegniExtra.sort((a, b) => a.dipendenteNome.localeCompare(b.dipendenteNome)).map(imp => (
              <div key={imp.id} className="border border-slate-200 bg-slate-50 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="font-bold text-slate-800 text-sm truncate" title={imp.dipendenteNome}>{imp.dipendenteNome}</div>
                <div className="text-xs text-amber-600 font-semibold mt-0.5 uppercase tracking-wide">{imp.frequenza} - {imp.giorno.toUpperCase()}</div>
                <div className="text-sm font-medium text-slate-700 mt-2 truncate" title={imp.clienteNome}>{imp.clienteNome}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                  <Clock className="w-3.5 h-3.5" /> {imp.oraInizio} - {imp.oraFine}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
