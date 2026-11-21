import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, X } from 'lucide-react';

export const Snackbar: React.FC = () => {
  const { snackbarMessage, hideSnackbar, isDark } = useApp();

  useEffect(() => {
    if (snackbarMessage) {
      const timer = setTimeout(() => {
        hideSnackbar();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [snackbarMessage, hideSnackbar]);

  if (!snackbarMessage) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 text-xs font-semibold bg-zinc-900 text-white border border-zinc-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="leading-tight">{snackbarMessage}</span>
      </div>
      <button onClick={hideSnackbar} className="p-1 hover:opacity-75" aria-label="Fechar notificação">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
