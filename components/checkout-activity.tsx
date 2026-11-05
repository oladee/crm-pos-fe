'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Checkout, CustomerCredit, checkoutReviews, createRepayment, customerCredits, listCheckouts } from '@/lib/checkouts';
import { fmt, toKobo } from '@/lib/money';

export function CheckoutActivity({ manager, onOpen, onClose }: { manager: boolean; onOpen: (row: Checkout) => void; onClose: () => void }) {
  const [rows, setRows] = useState<Checkout[]>([]), [cursor, setCursor] = useState<string | null>(null), [busy, setBusy] = useState(true);
  const [reviews, setReviews] = useState<Array<{ id: string; reference: string; amountKobo: number; reason: string }>>([]);
  useEffect(() => { let active = true; void listCheckouts().then(page => { if (active) { setRows(page.data); setCursor(page.nextCursor); } }).catch(() => toast.error('Could not load checkouts')).finally(() => { if (active) setBusy(false); });
    if (manager) void checkoutReviews().then(page => { if (active) setReviews(page.data); }).catch(() => undefined);
    return () => { active = false; };
  }, [manager]);
  return <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-4"><section role="dialog" aria-label="Checkout activity" className="modal-shell max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl p-4">
    <h2 className="text-lg font-bold">Checkouts</h2>
    {busy && <p role="status">Loading…</p>}
    {rows.map(row => <button key={row.id} className="mt-2 min-h-14 w-full rounded-lg border border-[var(--color-line)] p-3 text-left" onClick={() => onOpen(row)}><span className="block font-bold">{row.customerName} · {fmt(row.totalKobo)}</span><span className="text-sm">{row.kind === 'repayment' ? 'Credit repayment' : row.paymentMode.replaceAll('_', ' ')} · {row.status}</span></button>)}
    {!busy && rows.length === 0 && <p className="py-4">No checkouts yet.</p>}
    {cursor && <button disabled={busy} className="min-h-11 w-full underline" onClick={() => { setBusy(true); void listCheckouts(cursor).then(page => { setRows(current => [...current, ...page.data]); setCursor(page.nextCursor); }).catch(() => toast.error('Could not load more checkouts')).finally(() => setBusy(false)); }}>Load more</button>}
    {reviews.length > 0 && <><h3 className="mt-4 font-bold">Payments needing review</h3>{reviews.map(review => <div key={review.id} className="my-2 border-t border-[var(--color-line)] py-2 text-sm"><p>{fmt(review.amountKobo || 0)} · {review.reference || 'No reference'}</p><p>{review.reason}</p></div>)}</>}
    <button className="mt-3 min-h-11 w-full underline" onClick={onClose}>Close</button>
  </section></div>;
}

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
