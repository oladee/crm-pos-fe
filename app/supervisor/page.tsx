'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SupervisorView } from '@/components/supervisor-view';
import { PinGate } from '@/components/shift-panels';
import { RequireCashier } from '@/components/route-guards';
import { useTill } from '@/contexts/till-context';
import { canFully } from '@/lib/permissions';

export default function SupervisorPage() {
  return (
    <RequireCashier>
      <SupervisorScreen />
    </RequireCashier>
  );
}

function SupervisorScreen() {
  const router = useRouter();
  const {
    store, sales, allShifts, cashiers, catalog, pending, stockCounts, assists,
    cashier, shift, actingSupervisor, setActingSupervisor,
    saveDayCount, claimAssist, resolveAssist, cancelAssist,
  } = useTill();
  const [gate, setGate] = useState(false);

  useEffect(() => {
    if (actingSupervisor) return;
    if (canFully(cashier?.role, 'sale.viewAll') && cashier) {
      setActingSupervisor(cashier.name);
      return;
    }
    setGate(true);
  }, [actingSupervisor, cashier, setActingSupervisor]);

  const leave = () => {
    setActingSupervisor(null);
    router.replace(shift ? '/sell' : '/shift');
  };

  const authorise = (pin: string) => {
    const sup = cashiers.find((c) => c.pin === pin && c.isActive && canFully(c.role, 'sale.viewAll'));
    if (!sup) { toast.error('That PIN cannot open the supervisor view'); return; }
    setActingSupervisor(sup.name);
    setGate(false);
  };

  if (!store) return null;

  return (
    <>
      {gate && (
        <PinGate
          title="Supervisor access"
          note="Cashier performance and end-of-day reconciliation are supervisor-only."
          onCancel={leave}
          onVerify={authorise}
        />
      )}
      {actingSupervisor && (
        <SupervisorView
          sales={sales}
          shifts={allShifts}
          cashiers={cashiers}
          catalog={catalog}
          store={store}
          unsynced={pending}
          stockCounts={stockCounts}
          onSaveCount={saveDayCount}
          assists={assists}
          onClaimAssist={claimAssist}
          onResolveAssist={resolveAssist}
          onCancelAssist={cancelAssist}
          onClose={leave}
        />
      )}
    </>
  );
}
