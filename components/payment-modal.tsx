'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, Banknote, Smartphone, User, Check, Delete } from 'lucide-react';
import { PosPayment, PaymentMethod } from '@/lib/types';
import { paid, balanceDue } from '@/lib/cart';
import { fmt, toKobo } from '@/lib/money';
import { getPaymentOptions, type PaymentProviderOption } from '@/lib/remote';

export function PaymentModal({
  total, onClose, onConfirm, hasCustomer, online, onStartTransfer,
}: {
  total: number;
  onClose: () => void;
  onConfirm: (p: PosPayment[]) => Promise<void>;
  hasCustomer: boolean;
  online: boolean;
  onStartTransfer: (provider: 'bachs' | 'squad') => Promise<void>;
}) {
  const [payments, setPayments] = useState<PosPayment[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [entry, setEntry] = useState('');
  const [starting, setStarting] = useState(false);
  const [providers, setProviders] = useState<PaymentProviderOption[]>([]);
  const [provider, setProvider] = useState<'bachs' | 'squad' | ''>('');
  const [providerError, setProviderError] = useState('');
  const [providerLoading, setProviderLoading] = useState(true);
  const [retryOptions, setRetryOptions] = useState(0);
  useEffect(() => {
    let active = true;
    setProviderLoading(true);
    setProviderError('');
    getPaymentOptions().then(options => {
      if (active) { setProviders(options.providers); setProvider(options.providers[0]?.id || ''); }
    }).catch(() => { if (active) setProviderError('Could not load payment providers.'); })
      .finally(() => { if (active) setProviderLoading(false); });
    return () => { active = false; };
  }, [retryOptions]);

  const due = balanceDue(payments, total);
  const entryKobo = toKobo(Number(entry) || 0);
  const withinDue = (nairaText: string) => toKobo(Number(nairaText) || 0) <= due;

  const add = (amountKobo: number) => {
    if (amountKobo <= 0 || amountKobo > due) return;
    if (method === 'Credit' && !hasCustomer) { toast.error('Pick a customer for credit sales'); return; }
    setPayments((p) => [...p, { method, amount: amountKobo }]);
    setEntry('');
  };
  const tap = (d: string) => {
    if (d === 'del') return setEntry((e) => e.slice(0, -1));
    if (d === '.' && entry.includes('.')) return;
    const next = (entry + d).slice(0, 12);
    if (!withinDue(next)) return;
    setEntry(next);
  };

  const METHODS: { m: PaymentMethod; icon: typeof Banknote }[] = [
    { m: 'Cash', icon: Banknote }, { m: 'Transfer', icon: Smartphone }, { m: 'Credit', icon: User },
  ];
  const quick = [1000, 2000, 5000, 10000];

  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-4">
      <div className="modal-shell w-full max-w-md overflow-hidden rounded-[16px]">
        <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-black">Payment</h2>
          <button disabled={starting} onClick={onClose} className="text-[var(--color-ink-dim)]"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-xl bg-[var(--color-surface-2)] p-3 text-center">
            <p className="text-[11px] text-[var(--color-ink-dim)]">Balance due</p>
            <p className={`text-3xl font-black ${due > 0 ? 'text-[var(--color-ink)]' : 'text-[var(--color-brand)]'}`}>{fmt(due)}</p>
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

          <div className="grid grid-cols-3 gap-1.5">
            {METHODS.map(({ m, icon: Icon }) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`h-11 rounded-lg text-[11px] font-bold border flex flex-col items-center justify-center gap-0.5 ${
                  method === m ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'bg-[var(--color-surface-2)] border-[var(--color-line)] text-[var(--color-ink-dim)]'}`}>
                <Icon size={14} /> {m}
              </button>
            ))}
          </div>

          {method === 'Transfer' ? (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-[var(--color-ink-dim)]">
                {online
                  ? 'The customer transfers the full balance. You can start the next sale while this one is confirmed.'
                  : 'Connect to the internet to validate stock and take payment.'}
              </p>
              {providerLoading && <p role="status" className="text-sm">Loading payment providers…</p>}
              {providerError && <p role="alert" className="text-sm text-[var(--color-danger)]">{providerError} <button type="button" className="underline" onClick={() => setRetryOptions(value => value + 1)}>Retry</button></p>}
              {!providerLoading && !providerError && providers.length === 0 && <p className="text-sm text-[var(--color-ink-dim)]">Bank transfer is not enabled. Ask an administrator to configure a payment provider.</p>}
              {providers.length > 0 && <label className="block text-sm font-bold">Payment provider
                <select value={provider} disabled={starting} onChange={event => setProvider(event.target.value as 'bachs' | 'squad')} className="field-control mt-2 h-11 w-full rounded-[10px] px-3">
                  {providers.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>}
              <p className="text-xs leading-5 text-[var(--color-ink-dim)]">The customer pays provider charges. Review the exact total before sharing account details.</p>
              {payments.length > 0 && <p className="text-xs font-bold text-[var(--color-warn)]">Remove the other payments before starting a transfer.</p>}
              <button
                type="button"
                disabled={!online || starting || !provider || providerLoading || !!providerError || due <= 0 || payments.length > 0}
                onClick={() => {
                  setStarting(true);
                  if (provider) void onStartTransfer(provider).finally(() => setStarting(false)).catch(() => undefined);
                }}
                className="primary-action h-12 w-full rounded-[11px] text-sm font-black disabled:opacity-40"
              >
                {starting ? 'Getting the account…' : `Transfer ${fmt(due)}`}
              </button>
            </div>
          ) : (
          <>
          <input value={entry} onChange={(e) => {
            const next = e.target.value.replace(/[^\d.]/g, '').slice(0, 12);
            if (withinDue(next)) setEntry(next);
          }} placeholder="0.00" inputMode="decimal"
            className="w-full h-12 px-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xl font-black text-center outline-none focus:border-[var(--color-brand)]" />

          <div className="grid grid-cols-4 gap-1.5">
            {quick.map((q) => (
              <button key={q} disabled={toKobo(q) > due} onClick={() => setEntry(String(q))} className="h-9 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[11px] font-bold disabled:opacity-30">{q.toLocaleString()}</button>
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
            <button onClick={() => add(entryKobo)} disabled={entryKobo <= 0 || entryKobo > due}
              className="flex-1 h-12 rounded-xl border border-[var(--color-line)] font-bold text-sm disabled:opacity-30">Add payment</button>
            <button onClick={() => add(due)} disabled={due <= 0}
              className="flex-1 h-12 rounded-xl border border-[var(--color-line)] font-bold text-sm disabled:opacity-30">Exact {fmt(due)}</button>
          </div>

          </>
          )}

          {method !== 'Transfer' && (
          <button onClick={() => {
            setStarting(true);
            void onConfirm(payments).catch(error => toast.error(error instanceof Error ? error.message : 'Could not complete sale')).finally(() => setStarting(false));
          }} disabled={!online || starting || due > 0 || payments.length === 0}
            className="w-full h-14 rounded-xl bg-[var(--color-brand)] text-white text-base font-black disabled:opacity-30 flex items-center justify-center gap-2">
            <Check size={18} /> {starting ? 'Validating stock…' : 'Complete sale'}
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
