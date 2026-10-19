'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PinLogin } from '@/components/pin-login';
import { EnrollTill } from '@/components/enroll-till';
import { BootGate } from '@/components/route-guards';
import { LoginSkeleton } from '@/components/skeletons';
import { useTill } from '@/contexts/till-context';

export default function LoginPage() {
  const router = useRouter();
  const { store, cashier, shift, login, bindStore, deviceAccess, markEnrolled } = useTill();

  useEffect(() => {
    if (!cashier) return;
    router.replace(shift ? '/sell' : '/shift');
  }, [cashier, shift, router]);

  return (
    <BootGate skeleton={<LoginSkeleton />}>
      {store && deviceAccess === 'enroll' ? (
        <EnrollTill store={store} onEnrolled={markEnrolled} onBindStore={bindStore} />
      ) : (
        <PinLogin
          store={store}
          passkey={deviceAccess === 'passkey'}
          onBindStore={bindStore}
          onLogin={async (c) => {
            const result = await login(c);
            router.replace(result.hasShift ? '/sell' : '/shift');
          }}
        />
      )}
    </BootGate>
  );
}
