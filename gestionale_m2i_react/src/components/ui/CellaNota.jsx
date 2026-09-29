import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import ModernModal from './ModernModal';

/**
 * CellaNota - pulsanti e finestra per le note nell'elaborato
 * Props:
 *   testo: string (nota salvata)
 *   onSave: async (testo) => void
 */
export default function CellaNota({ testo, notaFissa = '', onShowFixedNote, onSave, readOnly = false, uniformHeight = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(testo || '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    setDraft(testo || '');
  }, [testo]);

  useEffect(() => {
    if (readOnly) {
      setIsEditing(false);
      setDraft(testo || '');
    }
  }, [readOnly, testo]);

  useEffect(() => {
    if (isOpen && isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isOpen, isEditing]);

  const closeNote = () => {
    if (isSaving) return;
    setIsOpen(false);
    setIsEditing(false);
    setDraft(testo || '');
  };

  const openNote = (edit = false) => {
    setDraft(testo || '');
    setIsEditing(edit && !readOnly);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (isSaving || readOnly) return;
    setIsSaving(true);
    try {
      await onSave(draft);
      setIsOpen(false);
      setIsEditing(false);
    } catch {
      // La pagina mostra già il dettaglio dell'errore nel proprio avviso.
      setIsOpen(false);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    if (isSaving) return;
    setDraft(testo || '');
    if (testo?.trim()) setIsEditing(false);
    else closeNote();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  return (
    <div className={`max-w-[220px] text-xs ${uniformHeight ? 'flex h-[60px] flex-col justify-center gap-1' : 'space-y-1'}`}>
      {notaFissa?.trim() && (
        <button
          type="button"
          onClick={onShowFixedNote}
          className={`self-start rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-300 transition-colors hover:bg-indigo-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${uniformHeight ? 'h-7 shrink-0' : ''}`}
        >
          Note fisse
        </button>
      )}
      {testo?.trim() ? (
        <button
          type="button"
          onClick={() => openNote()}
          className={`self-start rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-300 transition-colors hover:bg-sky-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${uniformHeight ? 'h-7 shrink-0' : ''}`}
        >
          Nota del mese
        </button>
      ) : !readOnly ? (
        <button type="button" onClick={() => openNote(true)} className={`flex self-start items-center gap-1 text-slate-500 hover:text-indigo-400 ${uniformHeight ? 'h-7 shrink-0' : ''}`} title="Aggiungi nota del mese">
          <Plus className="w-3.5 h-3.5" /> Nota del mese
        </button>
      ) : null}
      {isOpen && createPortal(
        <ModernModal
          isOpen
          onClose={closeNote}
          type={null}
          title="Nota del mese"
          textAlign="text-left"
          maxWidth="max-w-lg"
          primaryAction={isEditing ? { label: isSaving ? 'Salvataggio...' : 'Salva', onClick: handleSave, disabled: isSaving } : !readOnly ? { label: 'Modifica', onClick: () => setIsEditing(true) } : undefined}
          secondaryAction={isEditing ? { label: 'Annulla', onClick: cancelEdit, disabled: isSaving } : !readOnly ? { label: 'Chiudi', onClick: closeNote } : undefined}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={7}
              className="w-full resize-y rounded-lg border border-indigo-500 bg-slate-900 p-3 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Scrivi una nota del mese..."
            />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm text-slate-200">{testo}</p>
          )}
        </ModernModal>,
        document.body
      )}
    </div>
  );
}
