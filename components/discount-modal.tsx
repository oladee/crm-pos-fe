'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { fmt, toKobo } from '@/lib/money';

export function DiscountModal({
  label, base, current, maxPct, approvalPct, onClose, onApply,
}: {
  label: string;
  base: number;
  current: number;
  maxPct: number;
  approvalPct: number;
  onClose: () => void;
  onApply: (amountKobo: number) => void;
}) {
  const [mode, setMode] = useState<'pct' | 'amt'>('pct');
  const [v, setV] = useState(current > 0 ? (mode === 'pct' ? String(Math.round((current / base) * 100)) : String(current / 100)) : '');
  const n = Number(v) || 0;
  const amount = mode === 'pct' ? Math.round(base * (n / 100)) : toKobo(n);
  const appliedPct = base > 0 ? (amount / base) * 100 : 0;
  const overCap = appliedPct > maxPct;
  const needsApproval = appliedPct > approvalPct;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-black text-sm truncate">{label}</h2>
            <p className="text-[11px] text-[var(--color-ink-dim)]">of {fmt(base)}</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-ink-dim)]"><X size={20} /></button>
        </div>
        <div className="p-4">
          <div className="flex gap-2 mb-3">
            {(['pct', 'amt'] as const).map((k) => (
              <button key={k} onClick={() => { setMode(k); setV(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border ${mode === k ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]' : 'bg-[var(--color-surface-2)] border-[var(--color-line)] text-[var(--color-ink-dim)]'}`}>
                {k === 'pct' ? 'Percentage' : 'Fixed amount'}
              </button>
            ))}
          </div>
          <input value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal"
            placeholder={mode === 'pct' ? '0' : '0.00'}
            className="w-full h-12 px-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xl font-black text-center outline-none focus:border-[var(--color-brand)]" />
          <div className="flex gap-1.5 my-3">
            {(mode === 'pct' ? [5, 10, 15, 20] : [500, 1000, 2000, 5000]).map((q) => (
              <button key={q} onClick={() => setV(String(q))}
                className="flex-1 h-8 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[11px] font-bold">
                {mode === 'pct' ? `${q}%` : fmt(q * 100)}
              </button>
            ))}
          </div>
          <div className="rounded-lg bg-[var(--color-surface-2)] p-2.5 text-xs flex justify-between">
            <span className="text-[var(--color-ink-dim)]">Discount</span>
            <span className="font-black text-amber-400">−{fmt(amount)} ({Math.round(appliedPct)}%)</span>
          </div>
          {overCap && <p className="text-[10px] text-[var(--color-danger)] mt-2">Above the {maxPct}% store limit — it will be capped.</p>}
          {!overCap && needsApproval && <p className="text-[10px] text-amber-400 mt-2">Above {approvalPct}% — a supervisor must approve at checkout.</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={() => onApply(0)} className="flex-1 h-11 rounded-xl border border-[var(--color-line)] text-xs font-bold">Remove</button>
            <button onClick={() => onApply(amount)} className="flex-1 h-11 rounded-xl bg-[var(--color-brand)] text-white text-sm font-black">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}
