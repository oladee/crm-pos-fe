'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTill } from '@/contexts/till-context';
import { SellSkeleton } from '@/components/skeletons';

export function BootGate({ children, skeleton }: { children: React.ReactNode; skeleton?: React.ReactNode }) {
  const { booting } = useTill();
  if (booting) return <>{skeleton ?? <SellSkeleton />}</>;
  return <>{children}</>;
}

export function RequireCashier({ children, skeleton }: { children: React.ReactNode; skeleton?: React.ReactNode }) {
  const { booting, cashier } = useTill();
  const router = useRouter();

  useEffect(() => {
    if (!booting && !cashier) router.replace('/login');
  }, [booting, cashier, router]);

  if (booting || !cashier) return <>{skeleton ?? <SellSkeleton />}</>;
  return <>{children}</>;
}

export function RequireShift({ children, skeleton }: { children: React.ReactNode; skeleton?: React.ReactNode }) {
  const { booting, cashier, shift } = useTill();
  const router = useRouter();

  useEffect(() => {
    if (booting) return;
    if (!cashier) router.replace('/login');
    else if (!shift) router.replace('/shift');
  }, [booting, cashier, shift, router]);

  if (booting || !cashier || !shift) return <>{skeleton ?? <SellSkeleton />}</>;
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

  return <SellSkeleton />;
}
