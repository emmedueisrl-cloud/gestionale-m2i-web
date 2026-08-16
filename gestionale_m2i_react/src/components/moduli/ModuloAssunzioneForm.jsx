import React, { useState, useEffect } from 'react';
import { Loader2, FileText } from 'lucide-react';
import ModernModal from '../ui/ModernModal';
import { recuperaDatiAzienda } from '../../api/azienda';

export default function ModuloAssunzioneForm({ isOpen, onClose, dipendenteData, onGenerate }) {
  const [aziendaData, setAziendaData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    sesso: 'M',
    indirizzo: '',
    cap: '',
    citta: '',
    provincia: '',
    dataFirma: new Date().toISOString().split('T')[0],
    dataInizio: new Date().toISOString().split('T')[0],
    tipoContratto: 'Determinato', // Determinato, Indeterminato
    dataFine: '',
    qualifica: 'operaio',
    mansioni: 'addetto alle pulizie',
    livelloCCNL: '1° C.C.N.L. Pulizie',
    oreSettimanali: '20 ore settimanali part time',
    periodoProva: '30'
  });

  useEffect(() => {
    if (isOpen) {
      loadAzienda();
      if (dipendenteData) {
        const nome = dipendenteData.nome || '';
        const cognome = dipendenteData.cognome || '';
        // Deduci il sesso dal nome se non specificato
        const sessoDeducibile = nome.trim().toUpperCase().endsWith('A') ? 'F' : 'M';
        
        const dataAssunzione = dipendenteData.dataAssunzione || dipendenteData.data_assunzione;
        const tipoContratto = dipendenteData.tipoContratto || dipendenteData.stato || 'Determinato';
        const scadenza = dipendenteData.scadenza || dipendenteData.dataFine || '';

        setFormData(prev => ({
          ...prev,
          nome: nome,
          cognome: cognome,
          sesso: dipendenteData.sesso || sessoDeducibile,
          indirizzo: dipendenteData.indirizzo || dipendenteData.residenza || '',
          cap: dipendenteData.cap || '',
          citta: dipendenteData.citta || '',
          provincia: dipendenteData.provincia || '',
          mansioni: dipendenteData.mansione || prev.mansioni,
          dataInizio: dataAssunzione || prev.dataInizio,
          dataFirma: dataAssunzione || prev.dataFirma,
          tipoContratto: tipoContratto,
          dataFine: scadenza
        }));
      }
    }
  }, [isOpen, dipendenteData]);

  const loadAzienda = async () => {
    setIsLoading(true);
    try {
      const resp = await recuperaDatiAzienda();
      if (resp && resp.length > 0) {
        setAziendaData(resp[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate(formData, aziendaData);
  };

  return (
    <ModernModal
      isOpen={isOpen}
      onClose={onClose}
      type={null}
      maxWidth="max-w-4xl"
      textAlign="text-left"
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Genera Lettera di Assunzione</h3>
            <p className="text-sm text-slate-400 font-normal">
              Per {dipendenteData?.nome || formData.nome} {dipendenteData?.cognome || formData.cognome}
            </p>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 mt-4 pr-2">
          
          {(!dipendenteData?.nome || !dipendenteData?.cognome || !dipendenteData?.indirizzo) && (
            <>
              <h4 className="font-bold text-indigo-400 border-b border-slate-700 pb-2">Dati Anagrafici Mancanti</h4>
              <div className="grid grid-cols-2 gap-4">
                {!dipendenteData?.nome && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Nome</label>
                    <input type="text" name="nome" value={formData.nome} onChange={handleChange} required className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                )}
                {!dipendenteData?.cognome && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Cognome</label>
                    <input type="text" name="cognome" value={formData.cognome} onChange={handleChange} required className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                )}
              </div>
              
              {!dipendenteData?.indirizzo && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Indirizzo (Via e civico)</label>
                    <input type="text" name="indirizzo" value={formData.indirizzo} onChange={handleChange} required className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Sesso</label>
                    <select name="sesso" value={formData.sesso} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="M">Maschio</option>
                      <option value="F">Femmina</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          <h4 className="font-bold text-indigo-400 border-b border-slate-700 pb-2 mt-6">Dati Contrattuali</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Data Firma Contratto</label>
              <input
                type="date"
                name="dataFirma"
                value={formData.dataFirma}
                onChange={handleChange}
                required
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Data Inizio Lavoro</label>
              <input
                type="date"
                name="dataInizio"
                value={formData.dataInizio}
                onChange={handleChange}
                required
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Tipo di Contratto</label>
              <select
                name="tipoContratto"
                value={formData.tipoContratto}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Determinato">Tempo Determinato</option>
                <option value="Indeterminato">Tempo Indeterminato</option>
              </select>
            </div>
            {formData.tipoContratto === 'Determinato' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Data Fine (Determinato)</label>
                <input
                  type="date"
                  name="dataFine"
                  value={formData.dataFine}
                  onChange={handleChange}
                  required={formData.tipoContratto === 'Determinato'}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Qualifica</label>
              <input
                type="text"
                name="qualifica"
                value={formData.qualifica}
                onChange={handleChange}
                required
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Mansioni</label>
              <input
                type="text"
                name="mansioni"
                value={formData.mansioni}
                onChange={handleChange}
                required
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Livello e C.C.N.L.</label>
            <input
              type="text"
              name="livelloCCNL"
              value={formData.livelloCCNL}
              onChange={handleChange}
              required
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Orario e Retribuzione</label>
              <input
                type="text"
                name="oreSettimanali"
                value={formData.oreSettimanali}
                onChange={handleChange}
                required
                placeholder="es. 20 ore settimanali part time"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Periodo di prova (Giorni)</label>
              <input
                type="number"
                name="periodoProva"
                value={formData.periodoProva}
                onChange={handleChange}
                required
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 font-medium hover:bg-slate-800 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Genera PDF
            </button>
          </div>
        </form>
      )}
    </ModernModal>
  );
}
