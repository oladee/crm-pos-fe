'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Delete } from 'lucide-react';
import { Cashier, StoreProfile } from '@/lib/types';
import { startAuthentication } from '@simplewebauthn/browser';
import { authenticationOptions, verifyPin, type RemoteStore } from '@/lib/remote';
import { SalesOsBrand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-provider';

export function PinLogin({
  store,
  passkey = false,
  onLogin,
  onBindStore,
}: {
  store: StoreProfile | null;
  passkey?: boolean;
  onLogin: (c: Cashier) => void | Promise<void>;
  onBindStore?: (remote: RemoteStore) => Promise<void> | void;
}) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [assertion, setAssertion] = useState<unknown | undefined>(passkey ? undefined : null);
  const ready = !passkey || assertion !== undefined;

  const unlock = async () => {
    if (!store || busy) return;
    setBusy(true);
    try {
      const challenge = await authenticationOptions(store.deviceId);
      if (challenge.legacy || !challenge.options) {
        setAssertion(null);
        return;
      }
      const signed = await startAuthentication({ optionsJSON: challenge.options as never });
      setAssertion(signed);
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (name === 'NotAllowedError') toast.error('The passkey prompt was cancelled');
      else toast.error(err instanceof Error ? err.message : 'This till could not be unlocked');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (value: string) => {
    const ident = username.trim().toLowerCase();
    if (!ident || busy || !ready || !store) return;
    if (!/^\d{4}$/.test(value)) return;
    setBusy(true);
    try {
      const isEmail = ident.includes('@');
      const verified = await verifyPin({
        username: isEmail ? undefined : ident,
        email: isEmail ? ident : undefined,
        pin: value,
        deviceId: store.deviceId,
        deviceLabel: store.deviceLabel,
        assertion: assertion ?? undefined,
      });
      if (verified.location) await onBindStore?.(verified.location);
      await onLogin(verified.staff);
      toast.success(`Welcome, ${verified.staff.name.split(' ')[0]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wrong username or PIN');
      setPin('');
      if (passkey) setAssertion(undefined);
      setBusy(false);
    }
  };

  const tap = (d: string) => {
    if (busy) return;
    if (d === 'del') return setPin((p) => p.slice(0, -1));
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) setTimeout(() => submit(next), 120);
  };

  return (
    <div className="pos-shell relative grid min-h-[100dvh] place-items-center p-4 sm:p-8">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8"><ThemeToggle /></div>
      <div className="grid w-full max-w-4xl items-center gap-8 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
        <div className="md:pl-4">
          <SalesOsBrand />
          <p className="mt-7 text-sm font-bold text-[var(--color-brand)]">Store checkout</p>
          <h1 className="mt-2 max-w-sm text-3xl font-black leading-[1.05] tracking-[-0.045em] sm:text-4xl">{store?.storeName || 'Your retail store'}</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--color-ink-dim)]">Sign in with your username and 4-digit PIN. Your sales and shift records stay attached to your name.</p>
          <div className="mt-5 flex items-center gap-2 text-xs text-[var(--color-ink-dim)]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" /> {store?.deviceLabel || 'Store till'} ready
          </div>
        </div>

        <div className="modal-shell w-full rounded-[16px] p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-lg font-black tracking-[-0.02em]">{ready ? 'Sign in' : 'Unlock this till'}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-dim)]">{ready ? 'Enter your username, then your PIN.' : 'Confirm this device with its passkey, then sign in with your PIN.'}</p>
          </div>
          {!ready && (
            <button type="button" disabled={busy} onClick={() => void unlock()} className="primary-action h-14 w-full rounded-[11px] text-base font-black disabled:opacity-40">
              {busy ? 'Waiting for the passkey…' : 'Use this device’s passkey'}
            </button>
          )}
          {ready && <>
          <label className="mb-4 block">
            <span className="sr-only">Username</span>
            <input
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              disabled={busy}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="field-control w-full rounded-[12px] px-3 text-sm outline-none"
            />
          </label>
          <div className="mb-5 flex justify-center gap-2" aria-label={`${pin.length} PIN digits entered`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`h-3.5 w-3.5 rounded-full border ${i < pin.length ? 'border-[var(--color-brand)] bg-[var(--color-brand)]' : 'border-[var(--color-line)] bg-[var(--color-surface-2)]'}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => k === '' ? <span key={i} /> : (
              <button key={i} type="button" onClick={() => tap(k)} disabled={busy} aria-label={k === 'del' ? 'Delete' : k}
                className="secondary-action grid h-16 place-items-center rounded-[11px] text-xl font-black disabled:opacity-50">
                {k === 'del' ? <Delete size={20} /> : k}
              </button>
            ))}
          </div>
          </>}
        </div>
      </div>

      {busy && ready && (
        <div className="signing-overlay fixed inset-0 z-50 grid place-items-center bg-[var(--color-backdrop)]" role="status" aria-live="polite" aria-busy="true">
          <div className="text-center">
            <div className="logo-pulse mx-auto w-[220px]">
              <SalesOsBrand />
            </div>
            <p className="mt-6 text-sm font-bold text-[var(--color-ink)]">Signing you in</p>
          </div>
        </div>
      )}
    </div>
  );
}
