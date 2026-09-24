'use client';

import { PauseCircle, Trash2, X } from 'lucide-react';
import { HeldSale } from '@/lib/types';

export function HeldModal({
  held, onResume, onDiscard, onClose,
}: {
  held: HeldSale[];
  onResume: (h: HeldSale) => void;
  onDiscard: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-black flex items-center gap-2"><PauseCircle size={17} /> Held carts</h2>
          <button onClick={onClose} className="text-[var(--color-ink-dim)]"><X size={20} /></button>
        </div>
        <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
          {held.length === 0 && <p className="text-center text-sm text-[var(--color-ink-dim)] py-8">Nothing held.</p>}
          {held.map((h) => (
            <div key={h.id} className="rounded-xl bg-[var(--color-surface-2)] p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{h.label}</p>
                <p className="text-[11px] text-[var(--color-ink-dim)]">{h.lines.length} line{h.lines.length !== 1 ? 's' : ''} · {new Date(h.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onDiscard(h.id)} className="h-9 w-9 grid place-items-center rounded-lg border border-[var(--color-line)] text-[var(--color-danger)]"><Trash2 size={14} /></button>
                <button onClick={() => onResume(h)} className="h-9 px-3 rounded-lg bg-[var(--color-brand)] text-white text-xs font-black">Resume</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
