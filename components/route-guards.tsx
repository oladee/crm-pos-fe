'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useTill } from '@/contexts/till-context';

function BootSpinner() {
  return (
    <div className="h-screen grid place-items-center text-[var(--color-ink-dim)]">
      <Loader2 className="animate-spin" />
    </div>
  );
}

export function BootGate({ children }: { children: React.ReactNode }) {
  const { booting } = useTill();
  if (booting) return <BootSpinner />;
  return <>{children}</>;
}

export function RequireCashier({ children }: { children: React.ReactNode }) {
  const { booting, cashier } = useTill();
  const router = useRouter();

  useEffect(() => {
    if (!booting && !cashier) router.replace('/login');
  }, [booting, cashier, router]);

  if (booting || !cashier) return <BootSpinner />;
  return <>{children}</>;
}

export function RequireShift({ children }: { children: React.ReactNode }) {
  const { booting, cashier, shift } = useTill();
  const router = useRouter();

  useEffect(() => {
    if (booting) return;
    if (!cashier) router.replace('/login');
    else if (!shift) router.replace('/shift');
  }, [booting, cashier, shift, router]);

  if (booting || !cashier || !shift) return <BootSpinner />;
  return <>{children}</>;
}

export function RedirectHome() {
  const { booting, cashier, shift } = useTill();
  const router = useRouter();

  useEffect(() => {
    if (booting) return;
    if (!cashier) router.replace('/login');
    else if (!shift) router.replace('/shift');
    else router.replace('/sell');
  }, [booting, cashier, shift, router]);

  return <BootSpinner />;
}
