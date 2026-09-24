'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SalesHistory, ReturnModal } from '@/components/sales-history';
import { PinGate } from '@/components/shift-panels';
import { Receipt } from '@/components/receipt';
import { RequireShift } from '@/components/route-guards';
import { useTill } from '@/contexts/till-context';
import { can, canFully } from '@/lib/permissions';
import { reverseSale } from '@/lib/db';
import { flushOutbox } from '@/lib/sync';
import { fmt } from '@/lib/money';
import { PosSale } from '@/lib/types';

export default function HistoryPage() {
  return (
    <RequireShift>
      <HistoryScreen />
    </RequireShift>
  );
}

function HistoryScreen() {
  const router = useRouter();
  const { store, sales, cashiers, cashier, refreshSyncState } = useTill();
  const [pendingReversal, setPendingReversal] = useState<{ sale: PosSale; mode: 'refunded' | 'voided' } | null>(null);
  const [returnFor, setReturnFor] = useState<{ sale: PosSale; mode: 'refunded' | 'voided' } | null>(null);
  const [returnAuth, setReturnAuth] = useState<string | null>(null);
  const [viewSale, setViewSale] = useState<PosSale | null>(null);

  const authoriseReversal = (pin: string) => {
    if (!pendingReversal) return;
    const sup = cashiers.find((c) => c.pin === pin && c.isActive && canFully(c.role, 'refund.approve'));
    if (!sup) { toast.error('That PIN cannot approve refunds'); return; }
    setReturnAuth(sup.name);
    setReturnFor(pendingReversal);
    setPendingReversal(null);
  };

  const commitReturn = async (lines: Record<string, number>, reason: string, full: boolean) => {
    if (!returnFor || !returnAuth) return;
    const { sale, mode } = returnFor;
    const rev = await reverseSale(sale, { mode, by: returnAuth, reason, lines: full ? undefined : lines });
    setReturnFor(null);
    setReturnAuth(null);
    await refreshSyncState();
    toast.success(`${full ? 'Full' : 'Partial'} ${mode === 'voided' ? 'void' : 'refund'} ${fmt(Math.abs(rev.total))} — by ${returnAuth.split(' (')[0]}`);
    void flushOutbox().then(refreshSyncState);
  };

  if (!store || !cashier) return null;

  return (
    <>
      <SalesHistory
        sales={sales}
        onClose={() => router.replace('/sell')}
        canRefund={can(cashier.role, 'refund.process')}
        canVoid={can(cashier.role, 'transaction.void')}
        onView={(s) => setViewSale(s)}
        onRefund={(s) => setPendingReversal({ sale: s, mode: 'refunded' })}
        onVoid={(s) => setPendingReversal({ sale: s, mode: 'voided' })}
      />
      {pendingReversal && (
        <PinGate
          title={pendingReversal.mode === 'voided' ? 'Void sale' : 'Refund sale'}
          note={`${pendingReversal.mode === 'voided' ? 'Voiding' : 'Refunding'} up to ${fmt(pendingReversal.sale.total)} — supervisor PIN required. You'll pick the items next.`}
          onCancel={() => setPendingReversal(null)}
          onVerify={authoriseReversal}
        />
      )}
      {returnFor && (
        <ReturnModal
          sale={returnFor.sale}
          mode={returnFor.mode}
          onClose={() => { setReturnFor(null); setReturnAuth(null); }}
          onConfirm={commitReturn}
        />
      )}
      {viewSale && <Receipt sale={viewSale} store={store} onClose={() => setViewSale(null)} />}
    </>
  );
}
