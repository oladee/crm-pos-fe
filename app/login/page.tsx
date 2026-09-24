'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PinLogin } from '@/components/pin-login';
import { BootGate } from '@/components/route-guards';
import { useTill } from '@/contexts/till-context';

export default function LoginPage() {
  const router = useRouter();
  const { store, cashier, shift, login, bindStore } = useTill();

  useEffect(() => {
    if (!cashier) return;
    router.replace(shift ? '/sell' : '/shift');
  }, [cashier, shift, router]);

  return (
    <BootGate>
      <PinLogin
        store={store}
        onBindStore={bindStore}
        onLogin={async (c) => {
          const result = await login(c);
          router.replace(result.hasShift ? '/sell' : '/shift');
        }}
      />
    </BootGate>
  );
}
