'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RequireCashier } from '@/components/route-guards';
import { Receipt } from '@/components/receipt';
import { useTill } from '@/contexts/till-context';
import { cachedTransactions, transaction, type Transaction } from '@/lib/transactions';

export default function TransactionPage() {
  return (
    <RequireCashier>
      <Details />
    </RequireCashier>
  );
}
function Details() {
  const { reference } = useParams<{ reference: string }>();
  const router = useRouter();
  const { store, online } = useTill();
  const location = store?.hubId || store?.storeId;
  const [row, setRow] = useState<Transaction | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [cached, setCached] = useState(false);
  const printed = useRef(false);
  useEffect(() => {
    if (!row?.receipt || !online || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.ready
      .then((registration) =>
        registration.active?.postMessage({
          type: 'CACHE_HISTORY_ROUTE',
          path: window.location.pathname,
        }),
      )
      .catch(() => undefined);
  }, [row, online]);
  useEffect(() => {
    if (!location) return;
    let active = true;
    void (async () => {
      try {
        const next = online
          ? await transaction(location, reference)
          : (await cachedTransactions(location)).find((item) => item.reference === reference);
        if (!next)
          throw new Error('This receipt is not cached on this device. Connect to load it.');
        if (active) {
          setRow(next);
          setCached(!online);
        }
      } catch (cause) {
        const status = (cause as { status?: number }).status;
        // Never substitute cached data for an authorization rejection.
        const saved =
          !status || status >= 500
            ? (await cachedTransactions(location)).find((item) => item.reference === reference)
            : undefined;
        if (active) {
          if (saved) {
            setRow(saved);
            setCached(true);
          } else setError(cause instanceof Error ? cause.message : 'Could not load transaction');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [location, reference, online]);
  useEffect(() => {
    if (
      !row?.receipt ||
      !row.actions.printReceipt ||
      printed.current ||
      new URLSearchParams(window.location.search).get('print') !== '1'
    )
      return;
    let active = true;
    void document.fonts.ready.then(() =>
      requestAnimationFrame(() => {
        if (active && !printed.current) {
          printed.current = true;
          // Consume the request only after the receipt is mounted and ready.
          window.history.replaceState(window.history.state, '', window.location.pathname);
          window.print();
        }
      }),
    );
    return () => {
      active = false;
    };
  }, [row]);
  if (loading)
    return (
      <main className="p-5" role="status">
        Loading transaction…
      </main>
    );
  if (error || !row)
    return (
      <main className="space-y-4 p-5">
        <Link href="/history" className="inline-flex min-h-11 items-center underline">
          Back to transactions
        </Link>
        <p role="alert">{error}</p>
        <button onClick={() => window.location.reload()} className="min-h-11 underline">
          Retry
        </button>
      </main>
    );
  if (!row.receipt)
    return (
      <main className="space-y-4 p-5">
        <Link href="/history" className="inline-flex min-h-11 items-center underline">
          Back to transactions
        </Link>
        <h1 className="text-xl font-bold">Transaction {row.reference}</h1>
        <p>Status: {row.status}. A paid receipt is not available.</p>
      </main>
    );
  return (
    <>
      {cached && (
        <p role="status" className="p-3 text-sm">
          Offline/cached receipt. Reconnect for the latest transaction status.
        </p>
      )}
      <Receipt
        sale={row.receipt}
        store={row.receipt.origin || { storeName: row.locationName, deviceLabel: row.tillName }}
        onClose={() => router.push('/history')}
      />
    </>
  );
}
