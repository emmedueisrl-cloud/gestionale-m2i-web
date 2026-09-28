import React, { useState, useEffect, useRef } from 'react';
import { Plus, Check, X } from 'lucide-react';

/**
 * CellaNota - cella inline per note nell'elaborato
 * Props:
 *   testo: string (nota salvata)
 *   onSave: async (testo) => void
 */
export default function CellaNota({ testo, notaFissa = '', onSave, readOnly = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(testo || '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    setDraft(testo || '');
  }, [testo]);

  useEffect(() => {
    if (readOnly) setIsEditing(false);
  }, [readOnly]);

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

  if (isEditing && !readOnly) {
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

  return (
    <div className="max-w-[220px] text-xs space-y-1">
      {notaFissa && <div className="text-slate-400 whitespace-pre-wrap break-words" title={notaFissa}>Fissa: {notaFissa}</div>}
      {testo?.trim() ? (
        readOnly ? <div className="text-slate-300 whitespace-pre-wrap break-words" title={testo}>Mese: {testo}</div> :
          <button onClick={() => setIsEditing(true)} title={testo} className="text-left text-slate-300 hover:text-indigo-300 whitespace-pre-wrap break-words">Mese: {testo}</button>
      ) : !readOnly ? (
        <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-slate-500 hover:text-indigo-400" title="Aggiungi nota del mese">
          <Plus className="w-3.5 h-3.5" /> Nota del mese
        </button>
      ) : null}
    </div>
  );
}
