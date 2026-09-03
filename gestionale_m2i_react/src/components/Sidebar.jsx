import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menu = [
    { type: 'item', label: '🏠 Dashboard', path: '/admin/dashboard' },
    
    { type: 'header', label: '👥 Gestione Dipendenti' },
    { type: 'item', label: '📋 Database Dipendenti', path: '/admin/dipendenti/lista' },
    { type: 'item', label: '🔒 Elaborato Mensile Dipendenti', path: '/admin/elaborati/dipendenti' },
    { type: 'item', label: '⏰ Inserisci Ore Mensili', path: '/admin/ore/registro' },
    { type: 'item', label: '📅 Agenda Caposquadra', path: '/admin/ore/agenda' },
    { type: 'item', label: '🗓️ Prospetto Settimanale', path: '/admin/ore/prospetto' },
    { type: 'item', label: '💰 Maggiorazioni/Detrazioni', path: '/admin/dipendenti/regolazioni' },
    { type: 'item', label: '📄 Carica Busta Paga', path: '/admin/bustepaga' },
    
    { type: 'header', label: '🏢 Gestione Clienti' },
    { type: 'item', label: '📋 Database Clienti', path: '/admin/clienti/lista' },
    { type: 'item', label: '🔒 Elaborato Mensile Clienti', path: '/admin/elaborati/clienti' },
    { type: 'item', label: '💵 Sconti/Maggiorazioni Clienti', path: '/admin/clienti/regolazioni' },
    { type: 'item', label: '🧾 Gestione Fatture', path: '/admin/fatture' },
    { type: 'item', label: '📦 Magazzino', path: '/admin/magazzino' },
    { type: 'item', label: '📄 Preventivi', path: '/admin/preventivi' },
    
    { type: 'header', label: '📂 Gestione Documentale' },
    { type: 'item', label: '🏢 Dati e Documenti m2i', path: '/admin/azienda' },
    { type: 'item', label: '📄 Moduli Aziendali', path: '/admin/dipendenti/moduli' },
    
    { type: 'header', label: '📈 Gestione Provvigioni' },
    { type: 'item', label: '💰 Provvigioni', path: '/admin/provvigioni' },
    
    { type: 'header', label: '🤖 Ai & Servizi Esterni' },
    { type: 'item', label: '📧 Posta Elettronica', path: '/admin/posta' },
    { type: 'item', label: '🤖 Report IA', path: '/admin/report' },

    { type: 'header', label: '⚙️ Amministrazione' },
    { type: 'item', label: 'Impostazioni', path: '/admin/impostazioni' }
  ];

  return (
    <>
      {/* Overlay per mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar vera e propria */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-center h-16 border-b border-slate-800 bg-slate-900 shrink-0">
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-500 to-indigo-400 bg-clip-text text-transparent tracking-tighter">
            M2I
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
          <ul className="space-y-1">
            {menu.map((m, idx) => {
              if (m.type === 'header') {
                return (
                  <li key={idx} className="mt-8 mb-3 px-3 text-sm font-black text-indigo-300/80 uppercase tracking-widest">
                    {m.label}
                  </li>
                );
              }

              const isActive = location.pathname.startsWith(m.path);
              return (
                <li 
                  key={idx} 
                  onClick={() => {
                    navigate(m.path);
                    setIsOpen(false);
                  }}
                  className={`pl-7 pr-3 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium ${isActive ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                >
                  {m.label}
                </li>
              );
            })}
          </ul>
        </div>
        
        <div className="p-4 border-t border-slate-800">
          <button 
            className="w-full px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors text-sm font-medium flex items-center justify-center gap-2"
            onClick={() => {
              sessionStorage.removeItem('auth_token');
              navigate('/');
            }}
          >
            🚪 Esci / Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
