import React from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function ModernModal({ 
  isOpen, 
  onClose, 
  type = 'info', // 'success', 'error', 'warning', 'info'
  title, 
  subtitle, 
  content,
  primaryAction, // { label: string, onClick: function, variant: 'primary'|'danger' }
  secondaryAction, // { label: string, onClick: function }
  tertiaryAction, // { label: string, onClick: function }
  children,
  maxWidth = 'max-w-md',
  textAlign = 'text-center'
}) {
  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle className="w-8 h-8 text-emerald-500" />,
    error: <X className="w-8 h-8 text-red-500" />,
    warning: <AlertTriangle className="w-8 h-8 text-amber-500" />,
    info: <Info className="w-8 h-8 text-indigo-500" />
  };

  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500',
    error: 'bg-red-500/10 border-red-200 text-red-500',
    warning: 'bg-amber-500/10 border-amber-200 text-amber-500',
    info: 'bg-indigo-500/10 border-indigo-500/50 text-indigo-500'
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className={`bg-slate-800 w-full ${maxWidth} rounded-2xl flex flex-col ${textAlign} shadow-2xl border border-slate-700 transform animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto p-8 custom-scrollbar">
          {type && icons[type] && (
            <div className={`w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center border-2 shadow-sm ${colors[type]}`}>
              {icons[type]}
            </div>
          )}

          <h2 className="text-2xl font-bold text-slate-50 mb-2">{title}</h2>
          
          {subtitle && (
            <p className="text-[15px] font-semibold text-slate-200 mb-2">{subtitle}</p>
          )}
          
          {content && (
            <div className="text-[13.5px] text-slate-400 mb-6 leading-relaxed">
              {content}
            </div>
          )}

          {children && (
            <div className="mb-6 text-left">
              {children}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 mt-4 w-full items-center shrink-0 p-8 pt-0 bg-slate-800">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className={`w-full max-w-[260px] py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                primaryAction.variant === 'danger' 
                  ? 'bg-red-500/100 hover:bg-red-600 text-white shadow-md shadow-red-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20'
              }`}
            >
              {primaryAction.label}
            </button>
          )}

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="w-full max-w-[260px] py-2.5 px-4 rounded-lg font-semibold text-sm bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-900/50 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}

          {tertiaryAction && (
            <button
              type="button"
              onClick={tertiaryAction.onClick}
              className="w-full max-w-[260px] py-2.5 px-4 rounded-lg font-semibold text-sm bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
            >
              {tertiaryAction.label}
            </button>
          )}

          {!primaryAction && !secondaryAction && !tertiaryAction && (
            <button
              type="button"
              onClick={onClose}
              className="w-full max-w-[260px] py-2.5 px-4 rounded-lg font-semibold text-sm bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-900/50 transition-colors"
            >
              Chiudi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
