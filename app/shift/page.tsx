'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { OpenShiftModal, PinGate } from '@/components/shift-panels';
import { RequireCashier } from '@/components/route-guards';
import { useTill } from '@/contexts/till-context';
import { canFully } from '@/lib/permissions';

export default function ShiftPage() {
  return (
    <RequireCashier>
      <ShiftScreen />
    </RequireCashier>
  );
}

function ShiftScreen() {
  const router = useRouter();
  const { cashier, cashiers, shift, openShift, logout, setActingSupervisor } = useTill();
  const [showOpen, setShowOpen] = useState(false);
  const [supervisorGate, setSupervisorGate] = useState(false);

  useEffect(() => {
    if (shift) router.replace('/sell');
  }, [shift, router]);

  if (shift) return null;

  const openSupervisor = () => {
    if (canFully(cashier?.role, 'sale.viewAll')) {
      setActingSupervisor(cashier!.name);
      router.push('/supervisor');
    } else {
      setSupervisorGate(true);
    }
  };

  const authoriseSupervisor = (pin: string) => {
    const sup = cashiers.find((c) => c.pin === pin && c.isActive && canFully(c.role, 'sale.viewAll'));
    if (!sup) { toast.error('That PIN cannot open the supervisor view'); return; }
    setActingSupervisor(sup.name);
    setSupervisorGate(false);
    router.push('/supervisor');
  };

  return (
    <>
      <div className="h-screen grid place-items-center p-6 text-center">
        <div>
          <Clock size={40} className="mx-auto text-[var(--color-ink-dim)]" />
          <h1 className="text-lg font-black mt-3">No open shift</h1>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1">Open a shift to start selling.</p>
          <div className="flex gap-2 justify-center mt-4">
            <button
              onClick={() => { logout(); router.replace('/login'); }}
              className="h-11 px-4 rounded-xl border border-[var(--color-line)] text-sm font-bold"
            >
              Sign out
            </button>
            <button
              onClick={openSupervisor}
              className="h-11 px-4 rounded-xl border border-[var(--color-line)] text-sm font-bold inline-flex items-center gap-1.5"
            >
              <ShieldCheck size={15} /> Supervisor
            </button>
            <button
              onClick={() => setShowOpen(true)}
              className="h-11 px-5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-black"
            >
              Open shift
            </button>
          </div>
        </div>
      </div>
      {showOpen && cashier && (
        <OpenShiftModal
          cashierName={cashier.name}
          onClose={() => setShowOpen(false)}
          onOpen={async (float) => {
            await openShift(float);
            setShowOpen(false);
            router.replace('/sell');
          }}
        />
      )}
      {supervisorGate && (
        <PinGate
          title="Supervisor access"
          note="Cashier performance and end-of-day reconciliation are supervisor-only."
          onCancel={() => setSupervisorGate(false)}
          onVerify={authoriseSupervisor}
        />
      )}
    </>
  );
}
