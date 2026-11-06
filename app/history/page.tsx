'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Printer, ReceiptText } from 'lucide-react';
import { RequireCashier } from '@/components/route-guards';
import { ReturnModal } from '@/components/sales-history';
import { PinGate } from '@/components/shift-panels';
import { CheckoutModal } from '@/components/checkout-modal';
import { useTill } from '@/contexts/till-context';
import { cachedTransactions, listTransactions, type Transaction } from '@/lib/transactions';
import {
  checkoutOptions,
  checkoutReviews,
  getCheckout,
  type Checkout,
  type CheckoutOptions,
} from '@/lib/checkouts';
import { canFully } from '@/lib/permissions';
import { reverseSale } from '@/lib/db';
import { flushOutbox } from '@/lib/sync';
import { fmt } from '@/lib/money';
import { receiptDate } from '@/lib/receipt';

export default function HistoryPage() {
  return (
    <RequireCashier>
      <Suspense fallback={<p className="p-5">Loading transactions…</p>}>
        <History />
      </Suspense>
    </RequireCashier>
  );
}
function History() {
  const params = useSearchParams();
  const { store, online, cashier, cashiers, refreshSyncState } = useTill();
  const location = store?.hubId || store?.storeId;
  const [rows, setRows] = useState<Transaction[]>([]),
    [cursor, setCursor] = useState<string | null>(null);
  const [q, setQ] = useState(''),
    [date, setDate] = useState(''),
    [status, setStatus] = useState(params.get('status') || '');
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [cached, setCached] = useState(false),
    [revision, setRevision] = useState(0);
  const [checkout, setCheckout] = useState<Checkout | null>(null),
    [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [returnFor, setReturnFor] = useState<{
    row: Transaction;
    mode: 'refunded' | 'voided';
  } | null>(null);
  const [approver, setApprover] = useState<string | null>(null);
  const [reviews, setReviews] = useState<
    Array<{ id: string; reference: string; amountKobo: number; reason: string }>
  >([]);
  const [reviewError, setReviewError] = useState('');
  useEffect(() => {
    if (!online || !location || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.ready
      .then((registration) =>
        registration.active?.postMessage({ type: 'CACHE_HISTORY_ROUTE', path: '/history' }),
      )
      .catch(() => undefined);
  }, [online, location]);
  useEffect(() => {
    if (cashier?.role !== 'manager' || !online) return;
    let active = true;
    void checkoutReviews()
      .then((page) => {
        if (active) {
          setReviews(page.data);
          setReviewError('');
        }
      })
      .catch(() => {
        if (active) setReviewError('Could not load the payment review queue. Refresh to retry.');
      });
    return () => {
      active = false;
    };
  }, [cashier?.role, online, revision]);
  const requestSequence = useRef(0);
  const load = useCallback(
    async (before?: string) => {
      if (!location) return;
      const sequence = ++requestSequence.current;
      setBusy(true);
      setError('');
      try {
        if (!online) {
          const saved = await cachedTransactions(location);
          if (sequence !== requestSequence.current) return;
          setRows(
            saved
              .filter(
                (row) =>
                  (!status || row.status === status) &&
                  (!date ||
                    new Intl.DateTimeFormat('en-CA', {
                      timeZone: 'Africa/Lagos',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    }).format(new Date(row.createdAt)) === date) &&
                  (!q ||
                    (row.reference + ' ' + (row.customerName || ''))
                      .toLowerCase()
                      .includes(q.toLowerCase())),
              )
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
          setCached(true);
          setCursor(null);
        } else {
          const page = await listTransactions(location, {
            ...(q ? { q } : {}),
            ...(date ? { date } : {}),
            ...(status ? { status } : {}),
            ...(before ? { before } : {}),
          });
          if (sequence !== requestSequence.current) return;
          setRows((current) =>
            before
              ? [
                  ...current,
                  ...page.data.filter(
                    (row) => !current.some((old) => old.reference === row.reference),
                  ),
                ]
              : page.data,
          );
          setCursor(page.nextCursor);
          setCached(false);
        }
      } catch (cause) {
        if (sequence === requestSequence.current)
          setError(cause instanceof Error ? cause.message : 'Could not load transactions');
      } finally {
        if (sequence === requestSequence.current) setBusy(false);
      }
    },
    [location, online, q, date, status],
  );
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void load();
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load, revision]);
  const manage = async (row: Transaction) => {
    try {
      const [next, available] = await Promise.all([
        getCheckout(row.checkoutId!),
        checkoutOptions(),
      ]);
      setOptions(available);
      setCheckout(next);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not open payment');
    }
  };
  const commitReturn = async (lines: Record<string, number>, reason: string, full: boolean) => {
    if (!returnFor?.row.receipt || !approver) return;
    try {
      await reverseSale(returnFor.row.receipt, {
        mode: returnFor.mode,
        by: approver,
        reason,
        lines: full ? undefined : lines,
      });
      await flushOutbox();
      await refreshSyncState();
      setReturnFor(null);
      setApprover(null);
      setRevision((value) => value + 1);
      toast.success('Return recorded');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not record return');
      throw cause;
    }
  };
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-10 sm:px-6">
      <header className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-bg)] py-4">
        <Link href="/sell" className="inline-flex min-h-11 items-center gap-2 font-bold">
          <ArrowLeft size={18} />
          Back to POS
        </Link>
        <h1 className="mt-2 text-2xl font-black">Transactions</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
          Sales, repayments and pending payments at {store?.storeName}.
        </p>
      </header>
      {online && (
        <button
          className="my-3 min-h-11 underline"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh transactions
        </button>
      )}
      {reviewError && (
        <p role="alert" className="my-3 text-sm">
          {reviewError}
        </p>
      )}
      {cashier?.role === 'manager' && reviews.length > 0 && (
        <section
          aria-label="Payment review queue"
          className="my-5 border-b border-[var(--color-line)] pb-4"
        >
          <h2 className="text-lg font-bold">Payments needing review</h2>
          {reviews.map((review) => (
            <div key={review.id} className="mt-3 border-t border-[var(--color-line)] pt-3 text-sm">
              <p className="font-bold">{fmt(review.amountKobo || 0)}</p>
              <p className="break-all">{review.reference || 'No payment reference'}</p>
              <p className="mt-1">{review.reason}</p>
            </div>
          ))}
        </section>
      )}
      <form
        className="my-5 grid gap-3 sm:grid-cols-[1fr_170px_190px]"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="text-sm font-bold">
          Search transactions
          <input
            aria-label="Search transactions"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Receipt reference or customer"
            className="field-control mt-1 min-h-11 w-full rounded-lg border border-[var(--color-line)] px-3"
          />
        </label>
        <label className="text-sm font-bold">
          Trading date
          <input
            aria-label="Trading date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="field-control mt-1 min-h-11 w-full rounded-lg border border-[var(--color-line)] px-3"
          />
        </label>
        <label className="text-sm font-bold">
          Status
          <select
            aria-label="Transaction status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="field-control mt-1 min-h-11 w-full rounded-lg border border-[var(--color-line)] px-3"
          >
            <option value="">All transactions</option>
            <option value="completed">Completed</option>
            <option value="awaiting">Awaiting payment</option>
            <option value="review">Needs review</option>
            <option value="cancelled">Cancelled</option>
            <option value="voided">Voided</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
      </form>
      {cached && (
        <p role="status" className="mb-4 text-sm">
          Offline — showing only transactions cached for this location on this device.
        </p>
      )}
      {error && (
        <div role="alert" className="my-4">
          <p>{error}</p>
          <button className="min-h-11 underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {busy && (
        <p role="status" className="py-3">
          Loading transactions…
        </p>
      )}
      {!busy && !error && rows.length === 0 && <p className="py-8">No matching transactions.</p>}
      <div>
        {rows.map((row) => (
          <article key={row.reference} className="border-b border-[var(--color-line)] py-5">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="text-lg font-bold">{row.customerName || 'Customer not recorded'}</h2>
              <p className="text-lg font-black">{fmt(row.totalKobo)}</p>
            </div>
            <p className="mt-1 break-all text-sm">#{row.reference}</p>
            <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
              {row.kind === 'repayment' ? 'Credit repayment' : 'Sale'} · {row.status} ·{' '}
              {receiptDate(row.createdAt)} WAT
            </p>
            <p className="mt-1 text-sm">
              {[row.cashierName, row.tillName].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {row.actions.viewReceipt && (
                <Link
                  href={'/history/' + encodeURIComponent(row.reference)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-line)] px-3 font-bold"
                >
                  <ReceiptText size={17} />
                  View receipt
                </Link>
              )}
              {row.actions.printReceipt && (
                <Link
                  href={'/history/' + encodeURIComponent(row.reference) + '?print=1'}
                  className="primary-action inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-bold"
                >
                  <Printer size={17} />
                  Print receipt
                </Link>
              )}
              {row.checkoutId && online && (
                <button className="min-h-11 px-3 underline" onClick={() => void manage(row)}>
                  Manage payment
                </button>
              )}
              {row.legacyTransferId && (
                <Link href="/sell" className="inline-flex min-h-11 items-center underline">
                  Manage existing transfer in POS Transfers
                </Link>
              )}
              {row.actions.refund && cashier && (
                <button
                  className="min-h-11 px-3 underline"
                  onClick={() => {
                    setReturnFor({ row, mode: 'refunded' });
                    setApprover(null);
                  }}
                >
                  Refund
                </button>
              )}
              {row.actions.void && cashier && (
                <button
                  className="min-h-11 px-3 underline"
                  onClick={() => {
                    setReturnFor({ row, mode: 'voided' });
                    setApprover(null);
                  }}
                >
                  Void
                </button>
              )}
            </div>
            {!row.receipt && (
              <p className="mt-2 text-sm text-[var(--color-ink-dim)]">
                A paid receipt is not available.
              </p>
            )}
          </article>
        ))}
      </div>
      {cursor && (
        <button
          disabled={busy}
          onClick={() => void load(cursor)}
          className="my-5 min-h-12 w-full rounded-lg border border-[var(--color-line)] font-bold"
        >
          Load more
        </button>
      )}
      {checkout && options && (
        <CheckoutModal
          checkout={checkout}
          options={options}
          onCreated={() => undefined}
          onUpdate={async () => {
            setRevision((value) => value + 1);
          }}
          onClose={() => {
            setCheckout(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {returnFor && !approver && (
        <PinGate
          title={returnFor.mode === 'voided' ? 'Void sale' : 'Refund sale'}
          note="A supervisor must approve this return."
          onCancel={() => setReturnFor(null)}
          onVerify={(pin) => {
            const supervisor = cashiers.find(
              (person) =>
                person.pin === pin && person.isActive && canFully(person.role, 'refund.approve'),
            );
            if (!supervisor) toast.error('That PIN cannot approve refunds');
            else setApprover(supervisor.name);
          }}
        />
      )}
      {returnFor?.row.receipt && approver && (
        <ReturnModal
          sale={returnFor.row.receipt}
          mode={returnFor.mode}
          onClose={() => setReturnFor(null)}
          onConfirm={commitReturn}
        />
      )}
    </main>
  );
}
