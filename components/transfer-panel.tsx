'use client';

import { useEffect, useRef, useState } from 'react';
import { PosSale } from '@/lib/types';
import { PosTransfer } from '@/lib/remote';
import { fmt } from '@/lib/money';

export function TransferPanel({
  transfer,
  busy,
  onConfirmReceived,
  onCheck,
  onContinue,
  onCancel,
  onClose,
}: {
  transfer: PosTransfer;
  busy: boolean;
  onConfirmReceived: () => Promise<void>;
  onCheck: () => void;
  onContinue: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const paid = transfer.status === 'paid';
  const [showInstructions, setShowInstructions] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirming) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirming]);
  const hasInstructions = Boolean(transfer.accountNumber && transfer.feeKobo != null);
  const held = transfer.reservationState === 'held';
  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-4">
      <div className="modal-shell max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[16px] p-5">
        <h2 className="text-lg font-black">{paid ? 'Transfer received' : transfer.status === 'expired' ? 'Payment request expired' : transfer.status === 'review' || transfer.status === 'initializing' || transfer.status === 'cancelled' ? 'Payment needs checking' : !showInstructions ? 'Review transfer total' : 'Waiting for transfer'}</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
          {paid ? 'This sale is recorded.' : held ? 'Stock is reserved for this sale until payment is confirmed or you cancel it.' : 'This payment requires stock reconciliation before it can be completed.'}
        </p>
        <div className="mt-4 rounded-[12px] bg-[var(--color-surface-2)] p-4 text-center">
          <p className="text-[11px] text-[var(--color-ink-dim)]">Amount to transfer</p>
          <p className="text-3xl font-black">{transfer.feeKobo == null ? 'Checking total…' : fmt(transfer.payableKobo)}</p>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Sale amount" value={fmt(transfer.cartTotalKobo)} />
          <Row label="Provider charges" value={transfer.feeKobo == null ? 'Awaiting provider confirmation' : fmt(transfer.feeKobo)} />
          <Row label="Provider" value={transfer.provider === 'squad' ? 'Squad' : 'Bachs'} />
          <Row label="Reference" value={transfer.clientSaleId} />
        </dl>
        {transfer.status === 'expired' && <p role="status" className="mt-3 text-sm font-bold text-[var(--color-warn)]">Payment request expired — stock still held. Do not pay into an expired account.</p>}
        {transfer.reconciliationReason && <p role="status" className="mt-3 text-sm leading-5 text-[var(--color-warn)]">{transfer.reconciliationReason}</p>}
        {showInstructions && hasInstructions && transfer.status === 'awaiting' && <dl className="mt-4 space-y-2 text-sm">
          <Row label="Bank" value={transfer.bankName || 'Bank transfer'} />
          <Row label="Account name" value={transfer.accountName || '—'} />
          <Row label="Account number" value={transfer.accountNumber || '—'} mono />
        </dl>}
        <div className="mt-5 grid gap-2">
          {!showInstructions && hasInstructions && transfer.status === 'awaiting' && <button type="button" disabled={busy} onClick={() => setShowInstructions(true)} className="primary-action h-12 rounded-[11px] text-sm font-black">Accept total and show account</button>}
          {transfer.canConfirmReceived && <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="primary-action h-12 rounded-[11px] text-sm font-black disabled:opacity-40">I have received payment</button>}
          {!paid && (
            <button type="button" disabled={busy} onClick={onCheck} className="h-12 rounded-[11px] border border-[var(--color-line)] text-sm font-black disabled:opacity-40">
              {busy ? 'Checking…' : 'Check status'}
            </button>
          )}
          <button type="button" disabled={busy} onClick={onContinue} className="primary-action h-12 rounded-[11px] text-sm font-black">
            Serve next customer
          </button>
          {!paid && transfer.canCancel && (
            <button type="button" disabled={busy} onClick={onCancel} className="h-10 text-xs font-bold text-[var(--color-danger)]">
              Cancel this transfer
            </button>
          )}
          <button type="button" disabled={busy} onClick={onClose} className="h-10 text-xs font-bold text-[var(--color-ink-dim)]">Close</button>
        </div>
        <dialog ref={dialog} aria-labelledby="confirm-payment-title" aria-describedby="confirm-payment-description" onCancel={event => { if (busy) event.preventDefault(); else setConfirming(false); }} className="modal-shell m-auto w-[calc(100%_-_2rem)] max-w-md rounded-[16px] p-5 text-[var(--color-ink)] backdrop:bg-black/70">
          <h2 id="confirm-payment-title" className="text-lg font-black">Confirm payment received?</h2>
          <p id="confirm-payment-description" className="mt-3 text-sm leading-6 text-[var(--color-ink-dim)]">Confirm that you have received the full {fmt(transfer.payableKobo)} for transaction {transfer.clientSaleId}. This completes the sale and consumes its reserved stock.</p>
          <div className="mt-5 grid gap-2">
            <button type="button" autoFocus disabled={busy} onClick={() => setConfirming(false)} className="h-12 rounded-[11px] border border-[var(--color-line)] text-sm font-bold">Go back</button>
            <button type="button" disabled={busy} onClick={() => { void onConfirmReceived().then(() => setConfirming(false)).catch(() => undefined); }} className="primary-action h-12 rounded-[11px] text-sm font-black disabled:opacity-40">{busy ? 'Confirming payment…' : 'Confirm payment received'}</button>
          </div>
        </dialog>
      </div>
    </div>
  );
}

export function TransferQueue({
  transfers,
  onOpen,
  onClose,
}: {
  transfers: PosTransfer[];
  onOpen: (transfer: PosTransfer) => void;
  onClose: () => void;
}) {
  const waiting = transfers.filter((transfer) => ['initializing', 'awaiting', 'expired', 'review'].includes(transfer.status) || !!transfer.reconciliationReason);
  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-4">
      <div className="modal-shell w-full max-w-md rounded-[16px] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Transfers</h2>
          <button type="button" onClick={onClose} className="text-sm font-bold text-[var(--color-ink-dim)]">Close</button>
        </div>
        <div className="mt-4 space-y-2">
          {waiting.length === 0 && <p className="text-sm text-[var(--color-ink-dim)]">No transfers are waiting.</p>}
          {waiting.map((transfer) => (
            <button key={transfer.clientSaleId} type="button" onClick={() => onOpen(transfer)} className="w-full rounded-[12px] border border-[var(--color-line)] px-3 py-3 text-left">
              <span className="block text-sm font-black">{fmt(transfer.payableKobo)}</span>
              <span className="block text-xs font-bold">{transfer.status === 'cancelled' ? 'Cancelled — payment needs reconciliation' : transfer.reservationState !== 'held' ? 'Stock needs reconciliation' : transfer.status === 'expired' ? 'Expired — stock held' : transfer.status === 'review' ? 'Needs checking — stock held' : 'Stock reserved'}</span>
              <span className="mt-0.5 block text-xs text-[var(--color-ink-dim)]">{transfer.provider === 'squad' ? 'Squad' : 'Bachs'} · {transfer.clientSaleId}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[var(--color-ink-dim)]">{label}</dt>
      <dd className={`max-w-[65%] break-words text-right font-black ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</dd>
    </div>
  );
}

export function saleFromTransfer(transfer: PosTransfer): PosSale | null {
  const sale = transfer.sale?.posSale;
  if (!sale || typeof sale !== 'object') return null;
  return sale as PosSale;
}
