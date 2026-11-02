import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown } from 'lucide-react';

export default function SearchableClientSelect({ 
  value, 
  onChange, 
  clienti, 
  disabled, 
  placeholder = "-- Seleziona --",
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target) &&
          !menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedClient = clienti.find(c => c.id?.toString() === value?.toString());
  const displayValue = selectedClient ? (selectedClient.ragione_sociale || selectedClient.ragioneSociale) : placeholder;

  const filteredClienti = clienti.filter(c => {
    const nome = (c.ragione_sociale || c.ragioneSociale || '').toLowerCase();
    return nome.includes(searchTerm.toLowerCase());
  });

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const trigger = wrapperRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const margin = 8;
      const width = Math.min(Math.max(trigger.width, 220), window.innerWidth - margin * 2);
      const left = Math.max(margin, Math.min(trigger.left, window.innerWidth - width - margin));
      const menuHeight = menuRef.current?.offsetHeight || 280;
      const below = window.innerHeight - trigger.bottom - margin;
      const above = trigger.top - margin;
      const openAbove = below < menuHeight && above > below;
      const top = openAbove
        ? Math.max(margin, trigger.top - menuHeight - 4)
        : Math.min(window.innerHeight - margin, trigger.bottom + 4);
      setMenuPosition({ top, left, width });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, filteredClienti.length]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchTerm('');
          }
        }}
        className={`w-full flex items-center justify-between text-left truncate ${className} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 ml-1 opacity-50" />
      </button>

      {isOpen && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', ...menuPosition, visibility: menuPosition ? 'visible' : 'hidden' }} className="z-[100] bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-700 flex items-center gap-2 bg-slate-900/50">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              autoFocus
              className="w-full bg-transparent text-sm text-slate-200 outline-none" 
              placeholder="Cerca cliente..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            <div 
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-700 transition-colors border-b border-slate-700/50 ${!value ? 'bg-indigo-500/20 text-indigo-300 font-medium' : 'text-slate-300'}`}
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
            >
              {placeholder}
            </div>
            {filteredClienti.length === 0 ? (
              <div className="p-3 text-sm text-slate-500 text-center">Nessun cliente trovato</div>
            ) : (
              filteredClienti.map(c => (
                <div 
                  key={c.id} 
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-700 transition-colors truncate ${value?.toString() === c.id?.toString() ? 'bg-indigo-500/20 text-indigo-300 font-medium' : 'text-slate-300'}`}
                  onClick={() => {
                    onChange(c.id);
                    setIsOpen(false);
                  }}
                  title={c.ragione_sociale || c.ragioneSociale}
                >
                  {c.ragione_sociale || c.ragioneSociale}
                </div>
              ))
            )}
          </div>
        </div>, document.body
      )}
    </div>
  );
}
