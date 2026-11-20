import React, { useState, useEffect } from 'react';
import { Loader2, FileText } from 'lucide-react';
import ModernModal from '../ui/ModernModal';
import { recuperaDatiAzienda } from '../../api/azienda';
import { downloadWord } from '../../utils/downloadWord';
import { companyStampUrl } from '../../utils/companyStampUrl';

export default function ModuloAssunzioneForm({ isOpen, onClose, dipendenteData, onGenerate }) {
  const [aziendaData, setAziendaData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    codiceFiscale: '',
    sesso: 'M',
    indirizzo: '',
    cap: '',
    citta: '',
    provincia: '',
    telefono: '',
    email: '',
    iban: '',
    dataFirma: new Date().toISOString().split('T')[0],
    dataInizio: new Date().toISOString().split('T')[0],
    tipoContratto: 'Determinato', // Determinato, Indeterminato
    tipoOrario: 'Tempo parziale',
    codiceComunicazione: '',
    dataFine: '',
    qualifica: 'OPERAIO ADDETTO ALLE PULIZIE',
    mansioni: '',
    livelloCCNL: '1°',
    ccnlRetribuzione: 'CCNL PULIZIA',
    sedeLavoro: '',
    oreSettimanali: '20 ore settimanali part time',
    periodoProva: '10',
    allegaRegolamento: true
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
          codiceFiscale: dipendenteData.codice_fiscale || dipendenteData.codiceFiscale || '',
          sesso: dipendenteData.sesso || sessoDeducibile,
          indirizzo: dipendenteData.indirizzo || dipendenteData.residenza || '',
          cap: dipendenteData.cap || '',
          citta: dipendenteData.citta || '',
          provincia: dipendenteData.provincia || '',
          telefono: dipendenteData.telefono || dipendenteData.Telefono || '',
          email: dipendenteData.email || dipendenteData.Email || '',
          iban: dipendenteData.iban || dipendenteData.IBAN || '',
          mansioni: dipendenteData.mansione || prev.mansioni,
          qualifica: dipendenteData.unilavDati?.rapporto?.qualificaProfessionale || prev.qualifica,
          livelloCCNL: dipendenteData.unilavDati?.rapporto?.livelloInquadramento || prev.livelloCCNL,
          ccnlRetribuzione: dipendenteData.unilavDati?.rapporto?.ccnl || prev.ccnlRetribuzione,
          sedeLavoro: dipendenteData.sedeLavoro || dipendenteData.unilavDati?.rapporto?.sedeLavoro || '',
          dataInizio: dataAssunzione || prev.dataInizio,
          dataFirma: dipendenteData.dataInvioUnilav || dipendenteData.unilav?.dataInvio || dataAssunzione || prev.dataFirma,
          tipoContratto: tipoContratto,
          tipoOrario: /parziale|part[ -]?time/i.test(dipendenteData.unilavDati?.rapporto?.tipoOrario || '')
            ? 'Tempo parziale' : /pieno|full[ -]?time/i.test(dipendenteData.unilavDati?.rapporto?.tipoOrario || '')
              ? 'Tempo pieno' : prev.tipoOrario,
          codiceComunicazione: dipendenteData.unilav?.codiceComunicazione || prev.codiceComunicazione,
          dataFine: scadenza
        }));
      }
    }
  }, [isOpen, dipendenteData]);

  const loadAzienda = async () => {
    setIsLoading(true);
    try {
      const resp = await recuperaDatiAzienda();
      setAziendaData(Array.isArray(resp) ? resp[0] : resp);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'qualifica' && prev.mansioni === 'operaio' ? { mansioni: '' } : {})
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!companyStampUrl(aziendaData?.timbro_path)) {
      setError('Carica il timbro con firma nella Scheda M2I prima di creare il contratto.');
      return;
    }
    if (e.nativeEvent.submitter?.value === 'word') {
      try { await downloadWord('assunzione', formData, aziendaData); }
      catch (err) { setError(err.message || 'Impossibile creare il file Word.'); }
    } else onGenerate(formData, aziendaData);
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
              <label className="text-sm font-medium text-slate-300">Tipo orario</label>
              <select name="tipoOrario" value={formData.tipoOrario} onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5">
                <option value="Tempo parziale">Part time</option><option value="Tempo pieno">Tempo pieno</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Codice comunicazione UNILAV (se disponibile)</label>
              <input type="text" name="codiceComunicazione" value={formData.codiceComunicazione}
                onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5" />
            </div>
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
              <label className="text-sm font-medium text-slate-300">Mansioni (se diverse dalla qualifica)</label>
              <input
                type="text"
                name="mansioni"
                value={formData.mansioni}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Inquadramento</label>
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
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">CCNL</label>
              <input type="text" name="ccnlRetribuzione" value={formData.ccnlRetribuzione}
                onChange={handleChange} required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-white" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Sede di lavoro</label>
              <input type="text" name="sedeLavoro" value={formData.sedeLavoro}
                onChange={handleChange} placeholder="Se vuota, usa la sede M2I"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-white" /></div>
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

          {(!aziendaData?.posizione_inps || !aziendaData?.posizione_inail) &&
            <p className="text-sm text-amber-300">Completa i dati previdenziali nella <a href="/admin/azienda" className="font-bold underline">Scheda M2I</a> prima di stampare.</p>}
          <div className="space-y-3">
            <h4 className="font-bold text-indigo-400 border-b border-slate-700 pb-2">Recapiti e coordinate per il contratto</h4>
            <p className="text-sm text-slate-400">Facoltativi: se lasciati vuoti, il dipendente li scriverà a mano sul contratto.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-300">Recapito telefonico
                <input type="tel" name="telefono" value={formData.telefono} onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white" /></label>
              <label className="text-sm font-medium text-slate-300">Indirizzo e-mail
                <input type="email" name="email" value={formData.email} onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white" /></label>
              <label className="text-sm font-medium text-slate-300">Coordinate bancarie (IBAN)
                <input type="text" name="iban" value={formData.iban} onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white" /></label>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" name="allegaRegolamento" checked={formData.allegaRegolamento} onChange={handleChange} />
            Allega anche il regolamento interno (aggiunge altre pagine)
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 font-medium hover:bg-slate-800 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              value="word"
              disabled={!aziendaData?.posizione_inps || !aziendaData?.posizione_inail}
              className="px-6 py-2 bg-slate-700 text-white font-medium rounded-xl hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Scarica Word
            </button>
            <button
              type="submit"
              disabled={!aziendaData?.posizione_inps || !aziendaData?.posizione_inail}
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
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
