'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { PosCustomer } from '@/lib/types';

export function CustomerModal({
  customers, onPick, onClear, onClose,
}: {
  customers: PosCustomer[];
  onPick: (c: PosCustomer) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const list = customers.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.phone || '').includes(q));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-black">Customer</h2>
          <button onClick={onClose} className="text-[var(--color-ink-dim)]"><X size={20} /></button>
        </div>
        <div className="p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone…"
            className="w-full h-11 px-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-sm outline-none focus:border-[var(--color-brand)]" />
        </div>
        <div className="max-h-72 overflow-y-auto px-3 pb-3 space-y-1.5">
          {list.map((c) => (
            <button key={c.id} onClick={() => onPick(c)} className="w-full text-left rounded-lg bg-[var(--color-surface-2)] px-3 py-2.5 hover:border-[var(--color-brand)] border border-transparent">
              <p className="text-sm font-bold">{c.name}</p>
              {c.phone && <p className="text-[11px] text-[var(--color-ink-dim)]">{c.phone}</p>}
            </button>
          ))}
          {list.length === 0 && <p className="text-center text-xs text-[var(--color-ink-dim)] py-6">No match — walk-in sale.</p>}
        </div>
        <div className="p-3 border-t border-[var(--color-line)]">
          <button onClick={onClear} className="w-full h-10 rounded-lg border border-[var(--color-line)] text-xs font-bold text-[var(--color-ink-dim)]">Walk-in (no customer)</button>
        </div>
      </div>
    </div>
  );
}
