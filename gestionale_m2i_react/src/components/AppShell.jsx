import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import React, { useContext, useState } from 'react';
import { TopbarContext } from '../context/topbarContextValue';
import Sidebar from './Sidebar';
import SaveConfirmation from './SaveConfirmation';

const AppShell = ({ area }) => {
  const isAccounting = area === 'contabilita';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { onBackClick } = useContext(TopbarContext);
  
  return (
    <div className={`flex h-screen w-full overflow-hidden ${isAccounting ? 'bg-white text-slate-900' : 'bg-slate-900'}`}>
      <SaveConfirmation />
      <Sidebar area={area} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col h-screen md:pl-80 transition-all duration-300 w-full">
        <header className={`h-[70px] backdrop-blur-md border-b flex justify-between items-center px-4 md:px-8 sticky top-0 z-10 shrink-0 ${isAccounting ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={`p-1.5 md:hidden rounded-lg transition-colors border shadow-sm ${isAccounting ? 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'}`}
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
                className={`p-1.5 rounded-lg transition-colors border shadow-sm ${isAccounting ? 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'}`}
                title="Torna Indietro"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>
        
        <main className={`flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar ${isAccounting ? 'bg-white' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default AppShell;
