'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Delete } from 'lucide-react';
import { Cashier, StoreProfile } from '@/lib/types';
import { fetchStores, verifyPin, type RemoteStore } from '@/lib/remote';

export function PinLogin({
  store,
  onLogin,
  onBindStore,
}: {
  store: StoreProfile | null;
  onLogin: (c: Cashier) => void | Promise<void>;
  onBindStore?: (remote: RemoteStore) => Promise<void> | void;
}) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [remoteStores, setRemoteStores] = useState<RemoteStore[]>([]);

  useEffect(() => {
    fetchStores(store?.deviceId)
      .then(setRemoteStores)
      .catch(() => setRemoteStores([]));
  }, [store?.deviceId]);

  const hubId = store?.hubId || store?.storeId || '';

  const submit = async (value: string) => {
    const ident = username.trim().toLowerCase();
    if (!ident || busy) return;
    if (!hubId) {
      toast.error('Select a location first');
      setPin('');
      return;
    }
    if (!/^\d{4}$/.test(value)) return;
    setBusy(true);
    try {
      const isEmail = ident.includes('@');
      const verified = await verifyPin({
        hubId,
        username: isEmail ? undefined : ident,
        email: isEmail ? ident : undefined,
        pin: value,
        deviceId: store?.deviceId,
        deviceLabel: store?.deviceLabel,
      });
      await onLogin(verified);
      toast.success(`Welcome, ${verified.name.split(' ')[0]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wrong username or PIN');
      setPin('');
    } finally {
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
    <div className="h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="h-14 w-14 rounded-2xl bg-[var(--color-brand)] grid place-items-center font-black text-white text-lg mx-auto">FF</span>
          <h1 className="text-xl font-black mt-3">{store?.storeName || 'FudFarmer POS'}</h1>
          <p className="text-xs text-[var(--color-ink-dim)]">{store?.deviceLabel} · Sign in to sell</p>
        </div>

        <div className="space-y-3">
          {remoteStores.length > 0 && store && (
            <select
              value={hubId}
              onChange={async (e) => {
                const remote = remoteStores.find((s) => s.id === e.target.value);
                if (!remote) return;
                await onBindStore?.(remote);
              }}
              className="w-full h-11 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] px-3 text-sm"
            >
              <option value="">Select location</option>
              {remoteStores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
              ))}
            </select>
          )}

          <label className="block">
            <span className="sr-only">Username</span>
            <input
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full h-12 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] px-3 text-sm outline-none focus:border-[var(--color-brand)]"
            />
          </label>

          <div className="flex justify-center gap-2 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-surface-2)]'}`} />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => k === '' ? <span key={i} /> : (
              <button key={i} type="button" onClick={() => tap(k)} disabled={busy}
                className="h-16 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] text-xl font-black active:scale-95 transition-transform grid place-items-center disabled:opacity-50">
                {k === 'del' ? <Delete size={20} /> : k}
              </button>
            ))}
          </div>

          <p className="text-center text-[11px] text-[var(--color-ink-dim)] pt-1">
            Enter your username and 4-digit PIN.
          </p>
        </div>
      </div>
    </div>
  );
}
