import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto relative flex items-start justify-between gap-3 p-4 rounded-xl bg-[#1c1e2d] border border-white/10 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          <div className="space-y-1 flex-1">
            {t.title && <h4 className="text-sm font-semibold text-slate-100">{t.title}</h4>}
            {t.description && <p className="text-xs text-slate-300 leading-relaxed">{t.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
