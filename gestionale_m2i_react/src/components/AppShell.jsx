import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import React, { useContext, useState } from 'react';
import { TopbarContext } from '../context/TopbarContext';
import Sidebar from './Sidebar';

const AppShell = ({ area }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { onBackClick } = useContext(TopbarContext);
  
  // Mostra il titolo del modulo precedente (es. se in Nuovo Dipendente, mostra Anagrafica Dipendenti)
  const getPageTitle = () => {
    const p = location.pathname;
    
    // Sottomoduli Dipendenti
    if (p.includes('dipendenti/nuovo') || p.includes('dipendenti/scheda') || p.includes('dipendenti/modifica') || p.includes('dipendenti/proroghe') || p.includes('dipendenti/trasformazione') || p.includes('dipendenti/cessazione') || p.includes('dipendenti/maggiorazioni') || p.includes('dipendenti/chiavi') || p.includes('dipendenti/moduli')) {
      return 'Anagrafica Dipendenti';
    }
    
    // Sottomoduli Clienti
    if (p.includes('clienti/nuovo') || p.includes('clienti/modifica') || p.includes('clienti/scheda') || p.includes('clienti/sconti')) {
      return 'Anagrafica Clienti';
    }

    // Pagine principali (livello 1)
    if (p.includes('dipendenti') || p.includes('clienti') || p.includes('ore/') || p.includes('elaborati/') || p.includes('commerciale/') || p.includes('report/') || p.includes('buste-paga')) {
      return 'Dashboard';
    }

    if (p.includes('dashboard')) return 'Dashboard';
    if (p === '/' || p === '/admin') return 'Home';
    return 'Dashboard';
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-900">
      <Sidebar area={area} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col h-screen md:pl-80 transition-all duration-300 w-full">
        <header className="h-[70px] bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex justify-between items-center px-4 md:px-8 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 md:hidden bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 shadow-sm"
              title="Apri Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {!location.pathname.includes('/dashboard') && location.pathname !== '/admin' && (
              <button 
                onClick={() => {
                  if (onBackClick) {
                    onBackClick();
                  } else {
                    navigate(-1);
                  }
                }}
                className="p-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 shadow-sm"
                title="Torna Indietro"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>
        
        <main className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default AppShell;
