import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import React, { useContext, useState } from 'react';
import { TopbarContext } from '../context/topbarContextValue';
import Sidebar from './Sidebar';
import SaveConfirmation from './SaveConfirmation';
import MarketingNotifications from './MarketingNotifications';

const AppShell = ({ area, currentUser }) => {
  const isAccounting = area === 'contabilita';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { onBackClick } = useContext(TopbarContext);
  
  return (
    <div className={`flex h-screen w-full overflow-hidden ${isAccounting ? 'bg-white text-slate-900' : 'bg-slate-900'}`}>
      <SaveConfirmation />
      <MarketingNotifications />
      <Sidebar area={area} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className={`flex-1 flex flex-col h-screen transition-all duration-300 w-full ${isAccounting ? 'md:pl-56' : 'md:pl-80'}`}>
        <header className={`${isAccounting ? 'h-12 bg-white border-slate-200 px-4 md:px-6' : 'h-[70px] bg-slate-900/80 border-slate-800 px-4 md:px-8'} backdrop-blur-md border-b flex justify-between items-center sticky top-0 z-10 shrink-0`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={`p-1.5 md:hidden rounded-lg transition-colors border shadow-sm ${isAccounting ? 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'}`}
              title="Apri Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {isAccounting ? currentUser?.role !== 'contabilita' && (
              <button type="button" onClick={() => navigate('/admin/dashboard')}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 shadow-sm hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">
                Torna a gestionale
              </button>
            ) : !location.pathname.includes('/dashboard') && location.pathname !== '/admin' && (
              <button 
                onClick={() => {
                  if (onBackClick) {
                    onBackClick();
                  } else {
                    navigate(-1);
                  }
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 shadow-sm transition-colors hover:bg-slate-700 hover:text-white"
                title="Torna Indietro"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>
        
        <main className={`flex-1 overflow-y-auto custom-scrollbar ${isAccounting ? 'bg-white p-4 md:p-6' : 'p-4 md:p-8'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default AppShell;
