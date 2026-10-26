'use client';

import { PosSale } from '@/lib/types';
import { PosTransfer } from '@/lib/remote';
import { fmt } from '@/lib/money';

export function TransferPanel({
  transfer,
  busy,
  onCheck,
  onContinue,
  onCancel,
  onClose,
}: {
  transfer: PosTransfer;
  busy: boolean;
  onCheck: () => void;
  onContinue: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const paid = transfer.status === 'paid';
  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-4">
      <div className="modal-shell w-full max-w-md rounded-[16px] p-5">
        <h2 className="text-lg font-black">{paid ? 'Transfer received' : 'Waiting for transfer'}</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
          {paid ? 'This sale is recorded.' : 'Ask the customer to transfer this exact amount. You can serve the next customer while it confirms.'}
        </p>
        <div className="mt-4 rounded-[12px] bg-[var(--color-surface-2)] p-4 text-center">
          <p className="text-[11px] text-[var(--color-ink-dim)]">Amount to transfer</p>
          <p className="text-3xl font-black">{fmt(transfer.payableKobo)}</p>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Bank" value={transfer.bankName || 'Bank transfer'} />
          <Row label="Account name" value={transfer.accountName || '—'} />
          <Row label="Account number" value={transfer.accountNumber || '—'} mono />
        </dl>
        <div className="mt-5 grid gap-2">
          {!paid && (
            <button type="button" disabled={busy} onClick={onCheck} className="h-12 rounded-[11px] border border-[var(--color-line)] text-sm font-black disabled:opacity-40">
              {busy ? 'Checking…' : 'Check status'}
            </button>
          )}
          <button type="button" onClick={onContinue} className="primary-action h-12 rounded-[11px] text-sm font-black">
            Continue sale
          </button>
          {!paid && (
            <button type="button" onClick={onCancel} className="h-10 text-xs font-bold text-[var(--color-danger)]">
              Cancel this transfer
            </button>
          )}
          <button type="button" onClick={onClose} className="h-10 text-xs font-bold text-[var(--color-ink-dim)]">Close</button>
        </div>
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
  const waiting = transfers.filter((transfer) => transfer.status === 'awaiting');
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
              <span className="mt-0.5 block text-xs text-[var(--color-ink-dim)]">{transfer.accountNumber || 'Account pending'} · {transfer.bankName || 'Bank'}</span>
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
      <dd className={`text-right font-black ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</dd>
    </div>
  );
}

export function saleFromTransfer(transfer: PosTransfer): PosSale | null {
  const sale = transfer.sale?.posSale;
  if (!sale || typeof sale !== 'object') return null;
  return sale as PosSale;
}
