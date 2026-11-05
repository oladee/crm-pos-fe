'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Checkout, CheckoutMode, CheckoutOptions, cancelCheckout, checkoutAttempt, confirmCheckout, createCheckout, getCheckout } from '@/lib/checkouts';
import { fmt, toKobo } from '@/lib/money';

const inputStyle = 'field-control mt-1 min-h-11 w-full rounded-lg border border-[var(--color-line)] px-3';
const actionStyle = 'primary-action min-h-12 w-full rounded-lg px-3 text-sm font-bold disabled:opacity-40';

export function CheckoutModal({ cart, checkout, options, onCreated, onUpdate, onClose }: {
  cart?: Record<string, unknown>; checkout?: Checkout | null; options: CheckoutOptions;
  onCreated: (row: Checkout) => void; onUpdate: (row: Checkout) => Promise<void>; onClose: () => void;
}) {
  const [initialCart] = useState(cart);
  const [row, setRow] = useState<Checkout | null>(checkout || null);
  const [mode, setMode] = useState<CheckoutMode>('full_payment');
  const [upfront, setUpfront] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [linkedAttempt, setLinkedAttempt] = useState('');
  const [method, setMethod] = useState('Transfer');
  const [account, setAccount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [received, setReceived] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showAccount, setShowAccount] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const guard = useRef(false);
  const creation = useRef<Promise<Checkout> | null>(null);
  const callback = useRef(onUpdate);
  useEffect(() => { callback.current = onUpdate; }, [onUpdate]);
  const total = row?.totalKobo ?? Number(initialCart?.total || 0);
  const payable = row?.attempts.find(a => a.id === linkedAttempt)?.payableKobo ?? row?.dueKobo ?? total;
  const active = row?.attempts.some(a => ['queued', 'pending', 'unknown', 'review'].includes(a.status));
  const checkoutId = row?.id, checkoutStatus = row?.status;

  const accept = async (next: Checkout) => { setRow(next); await callback.current(next); return next; };
  useEffect(() => {
    if (!checkoutId || (checkoutStatus && ['completed', 'cancelled'].includes(checkoutStatus))) return;
    let stopped = false;
    const timer = setInterval(() => { void getCheckout(checkoutId).then(next => { if (!stopped) { setRow(next); void callback.current(next); } }).catch(() => undefined); }, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, [checkoutId, checkoutStatus]);

  const run = async (work: () => Promise<unknown>) => {
    if (guard.current) return; guard.current = true; setBusy(true);
    try { await work(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update checkout'); }
    finally { guard.current = false; setBusy(false); }
  };
  const ensureCheckout = async () => {
    if (row) return row;
    if (!initialCart) throw new Error('Checkout details are unavailable');
    if (!creation.current) creation.current = createCheckout({ ...initialCart, paymentMode: mode, upfrontKobo: toKobo(Number(upfront)), dueDate });
    try { const next = await creation.current; setRow(next); onCreated(next); await callback.current(next); return next; }
    catch (error) { creation.current = null; throw error; }
  };
  const start = (provider: 'moniepoint' | 'squad', paymentMethod: 'card' | 'transfer') => run(async () => {
    const current = await ensureCheckout();
    const id = requestId || crypto.randomUUID(); setRequestId(id);
    const next = await checkoutAttempt(current.id, { provider, method: paymentMethod, clientAttemptId: id, acknowledgeDuplicateRisk: acknowledged });
    setRequestId(null); await accept(next);
  });

  return <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-4">
    <section role="dialog" aria-modal="true" aria-label="Customer checkout" className="modal-shell max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl p-4">
      <header className="flex items-center justify-between"><h2 className="text-lg font-black">{row?.kind === 'repayment' ? 'Credit repayment' : 'Customer checkout'}</h2><button aria-label="Close checkout" disabled={busy} onClick={onClose} className="grid h-11 w-11 place-items-center"><X size={20} /></button></header>
      <p className="text-sm">{row?.customerName || String(initialCart?.customerName || '')}</p>
      <p className="mt-3 text-2xl font-black">{fmt(total)}</p>
      {row && <p className="mt-1 text-sm">{row.status === 'completed' ? 'Recorded — receipt is available in Sales.' : row.status === 'cancelled' ? 'Checkout cancelled' : `To collect now: ${fmt(row.dueKobo)}`}</p>}
      {row?.creditKobo ? <p className="text-sm">Outstanding credit: {fmt(row.creditKobo)}</p> : null}
      {!row && <div className="mt-4 space-y-3">
        <label className="block text-sm font-bold">Payment mode<select aria-label="Payment mode" disabled={busy} className={inputStyle} value={mode} onChange={e => setMode(e.target.value as CheckoutMode)}>
          <option value="full_payment">Full payment</option><option value="partial_credit">Partial credit</option><option value="full_credit">Full credit</option>
        </select></label>
        {mode === 'partial_credit' && <label className="block text-sm font-bold">Upfront amount (₦)<input className={inputStyle} aria-label="Upfront amount" inputMode="decimal" type="number" min="0.01" step="0.01" value={upfront} onChange={e => setUpfront(e.target.value)} /></label>}
        {mode !== 'full_payment' && <label className="block text-sm font-bold">Repayment due date<input className={inputStyle} aria-label="Repayment due date" type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>}
        {mode === 'full_credit' && <button className={actionStyle} disabled={busy || !dueDate} onClick={() => void run(ensureCheckout)}>Record full-credit sale</button>}
      </div>}
      {(!row || !['completed', 'cancelled'].includes(row.status)) && mode !== 'full_credit' && <div className="mt-4 space-y-3">
        {active && <label className="block rounded-lg border border-[var(--color-line)] p-3 text-sm"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /> An earlier payment may still arrive. I understand switching can result in two payments.</label>}
        <fieldset disabled={busy || (active && !acknowledged) || (!row && mode === 'partial_credit' && (!dueDate || !(Number(upfront) > 0)))} className="space-y-2 disabled:opacity-50">
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!options.methods.find(m => m.id === 'moniepoint')?.available} className={actionStyle} onClick={() => void start('moniepoint', 'card')}>Moniepoint card</button>
            <button disabled={!options.methods.find(m => m.id === 'moniepoint')?.available} className={actionStyle} onClick={() => void start('moniepoint', 'transfer')}>Moniepoint transfer</button>
          </div>
          <button disabled={!options.methods.find(m => m.id === 'squad')?.available} className={actionStyle} onClick={() => void start('squad', 'transfer')}>Squad transfer</button>
        </fieldset>
        <p className="text-xs text-[var(--color-ink-dim)]">Unavailable providers are not configured for this till. You can still confirm money you have received.</p>
        <button disabled={busy} className={actionStyle} onClick={() => void run(async () => { const next = await ensureCheckout(); setReceived(String(next.dueKobo / 100)); setManual(true); })}>Confirm payment received</button>
        {row?.attempts.map(attempt => <section key={attempt.id} className="rounded-lg border border-[var(--color-line)] p-3 text-sm">
          <p className="font-bold">{attempt.provider === 'moniepoint' ? 'Moniepoint' : 'Squad'} · {attempt.method} · {attempt.status}</p>
          <p className="break-all text-xs">{attempt.reference}</p>
          {attempt.reviewReason && <p role="status" className="mt-2">{attempt.reviewReason}</p>}
          {attempt.instructions && <div className="mt-2 space-y-2">
            <p>Amount to transfer: {fmt(attempt.payableKobo || 0)}</p><p>Provider charges: {fmt(attempt.feeKobo || 0)}</p>
            {showAccount === attempt.id ? <><p>{attempt.instructions.bankName}</p><p>{attempt.instructions.accountName}</p><p className="font-mono font-bold">{attempt.instructions.accountNumber}</p></> : <button className="min-h-11 underline" onClick={() => setShowAccount(attempt.id)}>Accept total and show account</button>}
          </div>}
        </section>)}
        {manual && row && <form className="space-y-3 border-t border-[var(--color-line)] pt-4" onSubmit={e => { e.preventDefault(); void run(async () => { await accept(await confirmCheckout(row.id, { amountKobo: toKobo(Number(received)), actualMethod: method, account, reason, externalReference: reference, confirmed, attemptId: linkedAttempt || undefined })); setManual(false); }); }}>
          <h3 className="font-bold">Confirm actual receipt</h3>
          <label className="block text-sm">Where was this payment received?<select aria-label="Payment being confirmed" className={inputStyle} value={linkedAttempt} onChange={e => { const id = e.target.value; setLinkedAttempt(id); const attempt = row.attempts.find(a => a.id === id); setReceived(String((attempt?.payableKobo ?? row.dueKobo) / 100)); setAccount(attempt ? attempt.provider : ''); setMethod(attempt?.method === 'card' ? 'Card' : 'Transfer'); }}>
            <option value="">Another account or payment method</option>{row.attempts.filter(a => a.payableKobo != null).map(a => <option key={a.id} value={a.id}>{a.provider}: {a.reference}</option>)}
          </select></label>
          <label className="block text-sm">Amount received (₦)<input aria-label="Amount received" className={inputStyle} type="number" step="0.01" required value={received} onChange={e => setReceived(e.target.value)} /></label>
          <label className="block text-sm">Actual method<select aria-label="Actual method" className={inputStyle} value={method} onChange={e => setMethod(e.target.value)}>{['Transfer', 'Card', 'Cash', 'Other'].map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="block text-sm">Receiving account or method details<input aria-label="Receiving account" className={inputStyle} required value={account} onChange={e => setAccount(e.target.value)} /></label>
          <label className="block text-sm">Reason for manual confirmation<textarea aria-label="Confirmation reason" className={inputStyle} required value={reason} onChange={e => setReason(e.target.value)} /></label>
          <label className="block text-sm">External reference (optional)<input className={inputStyle} value={reference} onChange={e => setReference(e.target.value)} /></label>
          <label className="block text-sm"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I have checked receipt of the full {fmt(payable)} due now.</label>
          <button className={actionStyle} disabled={busy || !confirmed}>Confirm received payment</button>
          <button type="button" disabled={busy} className="min-h-11 w-full underline" onClick={() => setManual(false)}>Go back</button>
        </form>}
        {row && <><button disabled={busy} className="min-h-11 w-full rounded-lg border border-[var(--color-line)]" onClick={() => void run(async () => { await accept(await getCheckout(row.id, true)); })}>Check payment status</button>
          <button disabled={busy} className="min-h-11 w-full underline" onClick={() => void run(async () => { await accept(await cancelCheckout(row.id)); })}>Cancel checkout</button></>}
      </div>}
      <button disabled={busy} className="mt-3 min-h-11 w-full underline" onClick={onClose}>{row?.status === 'completed' ? 'Close' : 'Back to till'}</button>
    </section>
  </div>;
}
