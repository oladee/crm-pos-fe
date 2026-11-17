'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SupervisorView } from '@/components/supervisor-view';
import { PinGate } from '@/components/shift-panels';
import { RequireCashier } from '@/components/route-guards';
import { SupervisorSkeleton } from '@/components/skeletons';
import { useTill } from '@/contexts/till-context';
import { getJson } from '@/lib/remote';
import { listTransactions } from '@/lib/transactions';
import type { PosSale, Shift } from '@/lib/types';
import { canFully } from '@/lib/permissions';

export default function SupervisorPage() {
  return (
    <RequireCashier skeleton={<SupervisorSkeleton />}>
      <SupervisorScreen />
    </RequireCashier>
  );
}

function SupervisorScreen() {
  const router = useRouter();
  const {
    store, online, cashiers, catalog, pending, stockCounts, assists,
    cashier, shift, actingSupervisor, setActingSupervisor,
    saveDayCount, claimAssist, resolveAssist, cancelAssist,
  } = useTill();
  const [gate, setGate] = useState(false);
  const [day, setDay] = useState('');
  const [revision, setRevision] = useState(0);
  const [dataError, setDataError] = useState('');
  const location = store?.hubId || store?.storeId;
  const manager = canFully(cashier?.role, 'sale.viewAll');
  const [report, setReport] = useState<{ location: string; day: string; sales: PosSale[]; shifts: Shift[]; at: Date }>();
  const current = report?.location === location && report?.day === day ? report : undefined;

  useEffect(() => {
    if (!actingSupervisor || !manager || !location || !online) return;
    let active = true;
    let loading = false;
    async function load() {
      if (loading) return;
      loading = true;
      try {
        const sales = new Map<string, PosSale>();
        const shiftsRequest = getJson<{ data: RemoteShift[] }>('/pos/shifts', true);
        const salesRequest = (async () => {
          let before: string | null = null;
          do {
            const page = await listTransactions(location!, { ...(day ? { date: day } : {}), ...(before ? { before } : {}) });
            for (const row of page.data) {
              if (row.locationId !== location) continue;
              if (row.receipt) sales.set(row.reference, row.receipt);
            }
            before = page.nextCursor;
          } while (active && before);
        })();
        const [shifts] = await Promise.all([shiftsRequest, salesRequest]);
        if (!active) return;
        setReport({ location: location!, day, sales: [...sales.values()], shifts: shifts.data.map(mapShift), at: new Date() });
        setDataError('');
      } catch (error) {
        if (active) setDataError(error instanceof Error ? error.message : 'Could not load location activity');
      } finally {
        loading = false;
      }
    }
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [actingSupervisor, manager, location, day, online, revision]);


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
          day={day}
          setDay={setDay}
          refreshedAt={current?.at}
          dataError={dataError}
          online={online}
          refresh={() => setRevision(value => value + 1)}
          sales={current?.sales || []}
          shifts={current?.shifts || []}
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

type RemoteShift = {
  client_shift_id: string; device_id: string; hub: string; cashier: string; cashier_name: string;
  opened_at: string; closed_at?: string; opening_float: number; counted_cash?: number;
  expected_cash?: number; variance?: number; status: Shift['status']; note?: string;
};

function mapShift(row: RemoteShift): Shift {
  return {
    id: row.client_shift_id, deviceId: row.device_id, hubId: row.hub, cashierId: row.cashier,
    cashierName: row.cashier_name, openedAt: row.opened_at, closedAt: row.closed_at,
    openingFloat: row.opening_float, countedCash: row.counted_cash, expectedCash: row.expected_cash,
    variance: row.variance, status: row.status, note: row.note,
  };
}
