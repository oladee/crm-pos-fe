'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { PosCustomer } from '@/lib/types';
import { createPosCustomer, searchPosCustomers } from '@/lib/remote';

export function CustomerModal({
  hubId, customers, onPick, onClear, onClose,
}: {
  hubId?: string;
  customers: PosCustomer[];
  onPick: (c: PosCustomer) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [matches, setMatches] = useState<PosCustomer[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = `${name} ${phone}`.trim();
    let cancelled = false;
    const local = customers.filter((c) => {
      if (!q) return true;
      const blob = `${c.name} ${c.phone || ''}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    }).slice(0, 10);
    const handle = setTimeout(() => {
      if (!hubId || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        if (!cancelled) setMatches(local);
        return;
      }
      void searchPosCustomers(q).then((rows) => {
        if (!cancelled) setMatches(rows.slice(0, 10));
      }).catch(() => {
        if (!cancelled) setMatches(local);
      });
    }, q ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [name, phone, hubId, customers]);

  const saveNew = async () => {
    if (!name.trim() || !phone.trim() || busy) return;
    setBusy(true);
    try {
      const created = await createPosCustomer({ name: name.trim(), phone: phone.trim() });
      onPick(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save this customer');
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
          <h2 className="font-black">Customer</h2>
          <button onClick={onClose} className="text-[var(--color-ink-dim)]"><X size={20} /></button>
        </div>
        <div className="space-y-2 p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
            className="w-full h-11 px-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-sm outline-none focus:border-[var(--color-brand)]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" inputMode="tel"
            className="w-full h-11 px-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-sm outline-none focus:border-[var(--color-brand)]" />
        </div>
        <div className="max-h-56 overflow-y-auto px-3 pb-3 space-y-1.5">
          {matches.map((c) => (
            <button key={c.id} onClick={() => onPick(c)} className="w-full text-left rounded-lg bg-[var(--color-surface-2)] px-3 py-2.5 hover:border-[var(--color-brand)] border border-transparent">
              <p className="text-sm font-bold">{c.name}</p>
              {c.phone && <p className="text-[11px] text-[var(--color-ink-dim)]">{c.phone}</p>}
            </button>
          ))}
          {matches.length === 0 && (
            <p className="text-center text-xs text-[var(--color-ink-dim)] py-4">
              {name.trim() || phone.trim() ? 'No customer at this location matches yet.' : 'No customers at this location yet.'}
            </p>
          )}
        </div>
        <div className="space-y-2 border-t border-[var(--color-line)] p-3">
          <button type="button" disabled={busy || !name.trim() || !phone.trim()} onClick={() => void saveNew()}
            className="primary-action h-10 w-full rounded-lg text-xs font-black disabled:opacity-40">
            {busy ? 'Saving…' : 'Save as new customer'}
          </button>
          <button onClick={onClear} className="w-full h-10 rounded-lg border border-[var(--color-line)] text-xs font-bold text-[var(--color-ink-dim)]">Walk-in (no customer)</button>
        </div>
      </div>
    </div>
  );
}
