import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings, Loader2, Printer, Bot, User, AlertCircle } from 'lucide-react';
import { getAiSettings, saveAiSettings, askAi } from '../../api/ai';
import ModernModal from '../../components/ui/ModernModal';

const ReportIA = () => {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Ciao! Sono il tuo assistente per i report. Chiedimi qualsiasi dato, ad esempio: "Quante ore ha fatto Mario ad Agosto?" oppure "Fammi un elenco delle fatture di quest\'anno".' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    caricaImpostazioni();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const caricaImpostazioni = async () => {
    try {
      const sett = await getAiSettings();
      setApiKey(sett.apiKey || '');
      if (!sett.hasKey) setIsSettingsOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const salvaImpostazioni = async () => {
    setIsSavingKey(true);
    try {
      await saveAiSettings(apiKey);
      setIsSettingsOpen(false);
    } catch (e) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Errore',
        content: "Errore nel salvataggio dell'API Key",
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  const inviaMessaggio = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      // Passa gli ultimi 6 messaggi come cronologia (per dare contesto senza appesantire la query)
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.text }));
      const res = await askAi(userMsg, history);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: res.message, 
        data: res.data, 
        isError: res.isQueryError 
      }]);
    } catch (error) {
      if (error.message.includes('API_KEY_MISSING')) {
        setIsSettingsOpen(true);
        setMessages(prev => [...prev, { role: 'ai', text: 'Per favore, configura prima la tua API Key di OpenAI nelle impostazioni (icona ingranaggio).', isError: true }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: 'Si Ã¨ verificato un errore di connessione con l\'intelligenza artificiale.', isError: true }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stampaTabella = (data, message) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const cols = data.length > 0 ? Object.keys(data[0]) : [];
    
    let html = `
      <html>
        <head>
          <title>Stampa Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h2 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
            th, td { padding: 10px; border: 1px solid #cbd5e1; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; }
            tr:nth-child(even) { background-color: #f8fafc; }
            @media print {
              body { padding: 0; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <h2>Report Gestionale M2I</h2>
          <p>${message}</p>
          <table>
            <thead>
              <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>${cols.map(c => `<td>${row[c] !== null ? row[c] : ''}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden relative">
      {/* Header */}
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-50">Report IA</h2>
            <p className="text-xs text-slate-400">Generatore report e query SQL integrato con OpenAI</p>
          </div>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} min-w-0`}>
            
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-indigo-400'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            
            <div className={`max-w-[100%] md:max-w-[85%] min-w-0 rounded-2xl p-4 ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'} ${msg.isError ? 'border-red-500/50 bg-red-500/10' : ''}`}>
              
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</div>
              
              {/* Data Table */}
              {msg.data && msg.data.length > 0 && (
                <div className="mt-4 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="text-xs uppercase bg-slate-800 text-slate-400 sticky top-0">
                        <tr>
                          {Object.keys(msg.data[0]).map((col, idx) => (
                            <th key={idx} className="px-4 py-3 font-semibold border-b border-slate-700">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.data.map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-b border-slate-800 hover:bg-slate-800/50">
                            {Object.values(row).map((val, colIdx) => (
                              <td key={colIdx} className="px-4 py-2 whitespace-nowrap">{val !== null ? String(val) : '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-slate-800 p-2 border-t border-slate-700 flex justify-end">
                    <button 
                      onClick={() => stampaTabella(msg.data, msg.text)}
                      className="flex items-center gap-2 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" /> Stampa Tabella
                    </button>
                  </div>
                </div>
              )}
              
              {msg.data && msg.data.length === 0 && (
                <div className="mt-3 text-xs text-slate-400 italic flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Nessun dato trovato per questa richiesta.
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-700 text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-none p-4 flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-sm text-slate-400">Sto analizzando il database...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <form onSubmit={inviaMessaggio} className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Chiedimi di stampare o cercare un report..."
            className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
            disabled={isLoading}
          />
          <button 
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[50px]"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" /> Impostazioni IA
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              Inserisci la tua API Key di OpenAI (ChatGPT) per abilitare il "Cervello" del gestionale. 
              Questo gli permetterÃ  di capire le tue richieste.
            </p>
            
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">OpenAI API Key</label>
              <input 
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Annulla
              </button>
              <button 
                onClick={salvaImpostazioni}
                disabled={isSavingKey || !apiKey.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isSavingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Salva Chiave
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ModernModal 
        {...alertModal}
        onClose={() => setAlertModal({ isOpen: false })}
      />
    </div>
  );
};

export default ReportIA;

