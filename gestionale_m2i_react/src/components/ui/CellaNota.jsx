import React, { useState, useEffect, useRef } from 'react';
import { Plus, Check, X } from 'lucide-react';

/**
 * CellaNota - cella inline per note nell'elaborato
 * Props:
 *   testo: string (nota salvata)
 *   onSave: async (testo) => void
 */
export default function CellaNota({ testo, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(testo || '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    setDraft(testo || '');
  }, [testo]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setDraft(testo || '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-start gap-1 min-w-[160px]">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="flex-1 text-xs p-1.5 bg-slate-900 border border-indigo-500 rounded text-slate-200 resize-none outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Scrivi una nota..."
        />
        <div className="flex flex-col gap-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            title="Salva (Invio)"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={() => { setDraft(testo || ''); setIsEditing(false); }}
            className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            title="Annulla (Esc)"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // Visualizzazione: se non c'è testo mostra +, altrimenti testo troncato cliccabile
  if (!testo || !testo.trim()) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="flex items-center justify-center w-6 h-6 rounded border border-dashed border-slate-600 text-slate-500 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
        title="Aggiungi nota"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      title={testo}
      className="max-w-[130px] text-left text-xs text-slate-300 hover:text-indigo-300 truncate block transition-colors"
    >
      {testo}
    </button>
  );
}
