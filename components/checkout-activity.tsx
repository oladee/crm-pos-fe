'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Checkout, CustomerCredit, createRepayment, customerCredits } from '@/lib/checkouts';
import { fmt, toKobo } from '@/lib/money';

export function RepayCreditModal({ customerId, customerName, deviceId, shiftId, onCreated, onClose }: {
  customerId: string; customerName: string; deviceId: string; shiftId?: string; onCreated: (row: Checkout) => void; onClose: () => void;
}) {
  const [credits, setCredits] = useState<CustomerCredit[]>([]), [selected, setSelected] = useState(''), [amount, setAmount] = useState(''), [busy, setBusy] = useState(false);
  const [requestId] = useState(() => `repay-${deviceId}-${crypto.randomUUID()}`);
  useEffect(() => { let active = true; void customerCredits(customerId).then(result => { if (active) setCredits(result.data); }).catch(() => toast.error('Could not load customer credit')); return () => { active = false; }; }, [customerId]);
  return <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-4"><form role="dialog" aria-label="Repay customer credit" className="modal-shell w-full max-w-md space-y-3 rounded-2xl p-4" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true);
    void createRepayment({ clientSaleId: requestId, customerId, creditId: selected, amountKobo: toKobo(Number(amount)), shiftId }).then(onCreated).catch(error => toast.error(error.message)).finally(() => setBusy(false)); }}>
    <h2 className="text-lg font-bold">Repay credit · {customerName}</h2>
    <label className="block text-sm">Outstanding sale<select aria-label="Outstanding credit sale" className="field-control mt-1 min-h-11 w-full rounded-lg px-3" required value={selected} onChange={e => { setSelected(e.target.value); const credit = credits.find(c => c.id === e.target.value); setAmount(credit ? String(credit.amountKobo / 100) : ''); }}><option value="">Choose a credit sale</option>{credits.map(c => <option key={c.id} value={c.id}>{c.saleReference} · {fmt(c.amountKobo)}</option>)}</select></label>
    <label className="block text-sm">Amount to collect (₦)<input aria-label="Credit repayment amount" className="field-control mt-1 min-h-11 w-full rounded-lg px-3" required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
    <button disabled={busy || !selected} className="primary-action min-h-12 w-full rounded-lg font-bold">Continue to collection</button>
    <button type="button" disabled={busy} className="min-h-11 w-full underline" onClick={onClose}>Back</button>
  </form></div>;
}
