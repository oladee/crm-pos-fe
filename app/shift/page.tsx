'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Clock } from 'lucide-react';
import { SalesOsBrand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-provider';
import { OpenShiftModal } from '@/components/shift-panels';
import { RequireCashier } from '@/components/route-guards';
import { ShiftSkeleton } from '@/components/skeletons';
import { useTill } from '@/contexts/till-context';
import { canFully } from '@/lib/permissions';

export default function ShiftPage() {
  return (
    <RequireCashier skeleton={<ShiftSkeleton />}>
      <ShiftScreen />
    </RequireCashier>
  );
}

function ShiftScreen() {
  const router = useRouter();
  const { cashier, shift, openShift, logout } = useTill();
  const [showOpen, setShowOpen] = useState(false);

  useEffect(() => {
    if (shift) router.replace('/sell');
  }, [shift, router]);

  if (shift) return null;

  const openSupervisor = () => router.push('/supervisor');

  return (
    <>
      <div className="pos-shell grid min-h-[100dvh] place-items-center p-5">
        <div className="modal-shell w-full max-w-md rounded-[16px] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <SalesOsBrand compact />
            <span className="h-9 w-px bg-[var(--color-line)]" />
            <div className="min-w-0">
              <p className="truncate font-black">{cashier?.name.split(' (')[0]}</p>
              <p className="text-xs text-[var(--color-ink-dim)]">Ready for a new shift</p>
            </div>
            <div className="ml-auto"><ThemeToggle compact /></div>
          </div>
          <div className="mt-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-[14px] border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/10"><Clock size={26} className="text-[var(--color-brand)]" /></span>
            <h1 className="mt-4 text-2xl font-black tracking-[-0.03em]">Ready to start selling?</h1>
            <p className="mt-1 text-sm leading-5 text-[var(--color-ink-dim)]">Start your shift, enter the cash already in the drawer, then choose products for the customer.</p>
          </div>
          <div className="mt-5 space-y-3 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4 text-sm">
            {['Count the cash already in the drawer', 'Start the shift', 'Tap products to add them to the cart'].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-brand)]/15 text-xs font-black text-[var(--color-brand)]">{i + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setShowOpen(true)} className="primary-action mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-[11px] text-base font-black">Start my shift <ChevronRight size={18} /></button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {canFully(cashier?.role, 'sale.viewAll') && <button type="button" role="switch" aria-checked={false} onClick={openSupervisor} className="secondary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-3 text-xs font-bold">
              <span aria-hidden="true" className="flex h-4 w-7 items-center rounded-full bg-[var(--color-line-strong)] p-0.5"><span className="h-3 w-3 rounded-full bg-white " /></span>
              Manager view
            </button>}
            <button onClick={() => { logout(); router.replace('/login'); }} className="secondary-action h-11 rounded-[10px] text-xs font-bold text-[var(--color-ink-dim)]">Use another account</button>
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
    </>
  );
}
