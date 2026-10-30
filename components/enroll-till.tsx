'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { startRegistration } from '@simplewebauthn/browser';
import { SalesOsBrand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-provider';
import { enrollDevice, fetchStores, registrationOptions } from '@/lib/remote';
import type { StoreProfile } from '@/lib/types';
import type { RemoteStore } from '@/lib/remote';

const REGISTRATION_STEPS = [
  { title: 'Checking registration code', hint: 'Connecting to your store securely…' },
  { title: 'Creating this till’s passkey', hint: 'Complete the fingerprint, face or PIN prompt on your device.' },
  { title: 'Registering this till', hint: 'Saving your passkey and assigning a till number…' },
  { title: 'Loading your location', hint: 'Getting your till ready to sign in…' },
];

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
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const submit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || submitting.current) return;
    submitting.current = true;
    setStep(0);
    setElapsed(0);
    setBusy(true);
    try {
      const { options } = await registrationOptions(store.deviceId, trimmed);
      setStep(1);
      const response = await startRegistration({ optionsJSON: options as never });
      setStep(2);
      const enrolled = await enrollDevice({
        deviceId: store.deviceId,
        code: trimmed,
        label: store.deviceLabel,
        response,
      });
      setStep(3);
      await onEnrolled(enrolled.credentialId, enrolled.label);
      const locations = await fetchStores(store.deviceId);
      if (locations[0]) await onBindStore?.(locations[0]);
      toast.success('This till is registered');
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (name === 'NotAllowedError') toast.error('The passkey prompt was cancelled');
      else toast.error(err instanceof Error ? err.message : 'Could not register this till');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="pos-shell relative grid min-h-[100dvh] place-items-center p-4 sm:p-8">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8"><ThemeToggle /></div>
      <div aria-busy={busy} className="modal-shell w-full max-w-md rounded-[16px] p-5 sm:p-7">
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
          {busy ? (
            <span className="inline-flex items-center justify-center gap-2">
              <LoaderCircle aria-hidden="true" className="h-5 w-5 motion-safe:animate-spin" />
              Registering this till…
            </span>
          ) : 'Register this till'}
        </button>
        {busy && (
          <div className="mt-5 border-t border-[var(--color-line)] pt-4">
            <div role="status" aria-live="polite" aria-atomic="true">
              <p className="text-sm font-bold">{REGISTRATION_STEPS[step].title}</p>
              <p className="mt-1 text-sm leading-5 text-[var(--color-ink-dim)]">{REGISTRATION_STEPS[step].hint}</p>
            </div>
            <div className="mt-4 flex gap-1.5" aria-hidden="true">
              {REGISTRATION_STEPS.map((item, index) => (
                <div key={item.title} className={`h-1.5 flex-1 rounded-full motion-safe:transition-colors motion-safe:duration-200 ${index <= step ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-line)]'}`} />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--color-ink-dim)]">
              <span className="inline-flex items-center gap-1.5">
                {step > 0 && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                Step {step + 1} of {REGISTRATION_STEPS.length}
              </span>
              <span className="tabular-nums">{elapsed}s elapsed</span>
            </div>
            {elapsed >= 30 && (
              <p className="mt-3 text-xs leading-5 text-[var(--color-ink-dim)]">
                {step === 1 ? 'Still waiting for your device. Check for a passkey prompt to continue.' : 'This is taking a little longer. Keep this screen open while setup finishes.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
