'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { startRegistration } from '@simplewebauthn/browser';
import { SalesOsBrand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-provider';
import { enrollDevice, fetchStores, registrationOptions } from '@/lib/remote';
import type { StoreProfile } from '@/lib/types';
import type { RemoteStore } from '@/lib/remote';

export function EnrollTill({
  store,
  onEnrolled,
  onBindStore,
}: {
  store: StoreProfile;
  onEnrolled: (credentialId: string, label?: string) => Promise<void> | void;
  onBindStore?: (remote: RemoteStore) => Promise<void> | void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const { options } = await registrationOptions(store.deviceId, trimmed);
      const response = await startRegistration({ optionsJSON: options as never });
      const enrolled = await enrollDevice({
        deviceId: store.deviceId,
        code: trimmed,
        label: store.deviceLabel,
        response,
      });
      await onEnrolled(enrolled.credentialId, enrolled.label);
      const locations = await fetchStores(store.deviceId);
      if (locations[0]) await onBindStore?.(locations[0]);
      toast.success('This till is registered');
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (name === 'NotAllowedError') toast.error('The passkey prompt was cancelled');
      else toast.error(err instanceof Error ? err.message : 'Could not register this till');
      setBusy(false);
    }
  };

  return (
    <div className="pos-shell relative grid min-h-[100dvh] place-items-center p-4 sm:p-8">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8"><ThemeToggle /></div>
      <div className="modal-shell w-full max-w-md rounded-[16px] p-5 sm:p-7">
        <SalesOsBrand compact />
        <h1 className="mt-6 text-2xl font-black tracking-[-0.03em]">This till is not registered</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-ink-dim)]">
          Ask a hub manager for a registration code from the CRM. Entering it creates a passkey on this device. The till stays closed until that is done.
        </p>
        <label className="mt-5 block">
          <span className="sr-only">Registration code</span>
          <input
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            disabled={busy}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Registration code"
            className="field-control w-full rounded-[12px] px-3 text-center text-lg font-black tracking-[0.2em] outline-none"
          />
        </label>
        <button
          type="button"
          disabled={busy || code.trim().length < 4}
          onClick={() => void submit()}
          className="primary-action mt-4 h-14 w-full rounded-[11px] text-base font-black disabled:opacity-40"
        >
          {busy ? 'Waiting for the passkey…' : 'Register this till'}
        </button>
      </div>
    </div>
  );
}
