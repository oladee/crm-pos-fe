'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { X, Banknote, CreditCard, Smartphone, User, Check, Delete } from 'lucide-react';
import { PosPayment, PaymentMethod } from '@/lib/types';
import { paid, balanceDue, changeDue } from '@/lib/cart';
import { fmt, toKobo } from '@/lib/money';

export function PaymentModal({
  total, onClose, onConfirm, hasCustomer,
}: {
  total: number;
  onClose: () => void;
  onConfirm: (p: PosPayment[]) => void;
  hasCustomer: boolean;
}) {
  const [payments, setPayments] = useState<PosPayment[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [entry, setEntry] = useState('');

  const due = balanceDue(payments, total);
  const change = changeDue(payments, total);
  const entryKobo = toKobo(Number(entry) || 0);

  const add = (amountKobo: number) => {
    if (amountKobo <= 0) return;
    if (method === 'Credit' && !hasCustomer) { toast.error('Pick a customer for credit sales'); return; }
    setPayments((p) => [...p, { method, amount: amountKobo }]);
    setEntry('');
  };
  const tap = (d: string) => {
    if (d === 'del') return setEntry((e) => e.slice(0, -1));
    if (d === '.' && entry.includes('.')) return;
    setEntry((e) => (e + d).slice(0, 12));
  };

  const METHODS: { m: PaymentMethod; icon: typeof Banknote }[] = [
    { m: 'Cash', icon: Banknote }, { m: 'Transfer', icon: Smartphone },
    { m: 'Card', icon: CreditCard }, { m: 'Credit', icon: User },
  ];
  const quick = [1000, 2000, 5000, 10000];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70">
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-black">Payment</h2>
          <button onClick={onClose} className="text-[var(--color-ink-dim)]"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-xl bg-[var(--color-surface-2)] p-3 text-center">
            <p className="text-[11px] text-[var(--color-ink-dim)]">{due > 0 ? 'Balance due' : 'Change'}</p>
            <p className={`text-3xl font-black ${due > 0 ? 'text-[var(--color-ink)]' : 'text-[var(--color-brand)]'}`}>{fmt(due > 0 ? due : change)}</p>
            <p className="text-[11px] text-[var(--color-ink-dim)] mt-0.5">Total {fmt(total)} · Paid {fmt(paid(payments))}</p>
          </div>

          {payments.length > 0 && (
            <div className="space-y-1">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-[var(--color-surface-2)] rounded-lg px-2.5 py-1.5">
                  <span className="font-bold">{p.method}</span>
                  <span className="flex items-center gap-2">{fmt(p.amount)}
                    <button onClick={() => setPayments((cur) => cur.filter((_, j) => j !== i))} className="text-[var(--color-danger)]"><X size={12} /></button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-1.5">
            {METHODS.map(({ m, icon: Icon }) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`h-11 rounded-lg text-[11px] font-bold border flex flex-col items-center justify-center gap-0.5 ${
                  method === m ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'bg-[var(--color-surface-2)] border-[var(--color-line)] text-[var(--color-ink-dim)]'}`}>
                <Icon size={14} /> {m}
              </button>
            ))}
          </div>

          <input value={entry} onChange={(e) => setEntry(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal"
            className="w-full h-12 px-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xl font-black text-center outline-none focus:border-[var(--color-brand)]" />

          <div className="grid grid-cols-4 gap-1.5">
            {quick.map((q) => (
              <button key={q} onClick={() => setEntry(String(q))} className="h-9 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[11px] font-bold">{q.toLocaleString()}</button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
              <button key={k} onClick={() => tap(k)}
                className="h-12 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] text-lg font-black grid place-items-center active:scale-95 transition-transform">
                {k === 'del' ? <Delete size={17} /> : k}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => add(entryKobo)} disabled={entryKobo <= 0}
              className="flex-1 h-12 rounded-xl border border-[var(--color-line)] font-bold text-sm disabled:opacity-30">Add payment</button>
            <button onClick={() => add(due)} disabled={due <= 0}
              className="flex-1 h-12 rounded-xl border border-[var(--color-line)] font-bold text-sm disabled:opacity-30">Exact {fmt(due)}</button>
          </div>

          <button onClick={() => onConfirm(payments)} disabled={due > 0 || payments.length === 0}
            className="w-full h-14 rounded-xl bg-[var(--color-brand)] text-white text-base font-black disabled:opacity-30 flex items-center justify-center gap-2">
            <Check size={18} /> Complete sale
          </button>
        </div>
      </div>
    </div>
  );
}
