'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsPanel } from '@/components/settings-panel';
import { RequireCashier } from '@/components/route-guards';
import { SettingsSkeleton } from '@/components/skeletons';
import { useTill } from '@/contexts/till-context';
import { can } from '@/lib/permissions';

export default function SettingsPage() {
  return (
    <RequireCashier skeleton={<SettingsSkeleton />}>
      <SettingsScreen />
    </RequireCashier>
  );
}

function SettingsScreen() {
  const router = useRouter();
  const { store, cashiers, cashier, shift, saveSettings, createTillCashier, resetTillCashierPin } = useTill();
  const canOpenSettings = !!cashier && (
    can(cashier.role, 'settings.manage') || can(cashier.role, 'user.manage')
  );
  const staffOnly = !!cashier && can(cashier.role, 'user.manage') && !can(cashier.role, 'settings.manage');

  useEffect(() => {
    if (cashier && !canOpenSettings) {
      router.replace(shift ? '/sell' : '/shift');
    }
  }, [cashier, shift, router, canOpenSettings]);

  if (!store || !cashier || !canOpenSettings) return null;

  const leave = () => router.replace(shift ? '/sell' : '/shift');

  return (
    <SettingsPanel
      store={store}
      cashiers={cashiers}
      staffOnly={staffOnly}
      canManageStaff={can(cashier.role, 'user.manage')}
      onCreateCashier={createTillCashier}
      onResetPin={resetTillCashierPin}
      onSave={async (patch) => {
        await saveSettings(patch);
        leave();
      }}
      onClose={leave}
    />
  );
}
