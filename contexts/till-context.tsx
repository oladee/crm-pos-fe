'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AssistRequest, Cashier, HeldSale, PosProduct, PosCustomer, PosSale, ResolutionKind,
  Shift, StoreProfile,
} from '@/lib/types';
import { ensureSeeded } from '@/lib/seed';
import {
  applyRemoteStore, bindDevice, clearPinToken, createCashier, fetchCatalog, fetchStaff,
  resetCashierPin, type RemoteStore,
} from '@/lib/remote';
import {
  getCatalog, getCustomers, getCashiers, getSales, getOutbox, getShifts,
  getHeld, getStockCounts, getAssists, saveAssist, saveProduct, saveStore,
  saveShift, replaceCashiers, replaceCatalog, saveStockCount,
} from '@/lib/db';
import { flushOutbox, startSync, exportPayload } from '@/lib/sync';
import { openShiftFor, newShiftId, buildReport } from '@/lib/shift';
import { fmt } from '@/lib/money';

const CASHIER_KEY = 'pos.cashierId';

type TillContextValue = {
  booting: boolean;
  store: StoreProfile | null;
  catalog: PosProduct[];
  customers: PosCustomer[];
  cashiers: Cashier[];
  cashier: Cashier | null;
  shift: Shift | null;
  sales: PosSale[];
  held: HeldSale[];
  allShifts: Shift[];
  stockCounts: Record<string, Record<string, number>>;
  assists: AssistRequest[];
  online: boolean;
  pending: number;
  syncing: boolean;
  todayCount: number;
  actingSupervisor: string | null;
  setActingSupervisor: (name: string | null) => void;
  setCatalog: (items: PosProduct[]) => void;
  refreshSyncState: () => Promise<void>;
  login: (c: Cashier) => Promise<{ hasShift: boolean }>;
  logout: () => void;
  bindStore: (remote: RemoteStore) => Promise<void>;
  openShift: (openingFloat: number) => Promise<void>;
  closeShift: (countedCash: number) => Promise<void>;
  saveSettings: (patch: Partial<StoreProfile>) => Promise<void>;
  claimAssist: (a: AssistRequest) => Promise<void>;
  cancelAssist: (a: AssistRequest) => Promise<void>;
  resolveAssist: (
    a: AssistRequest,
    kind: ResolutionKind,
    note: string,
    payload: { productId?: string; newValue?: number; amount?: number },
  ) => Promise<void>;
  saveDayCount: (day: string, counts: Record<string, number>) => Promise<void>;
  createTillCashier: (input: { full_name: string; phone: string; email?: string; pin?: string }) => Promise<string>;
  resetTillCashierPin: (staffId: string) => Promise<string>;
  manualSync: () => Promise<void>;
  copyPayloadForCrm: () => Promise<void>;
};

const TillContext = createContext<TillContextValue | null>(null);

export function TillProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [catalog, setCatalog] = useState<PosProduct[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [cashier, setCashier] = useState<Cashier | null>(null);
  const [booting, setBooting] = useState(true);
  const [shift, setShift] = useState<Shift | null>(null);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [stockCounts, setStockCounts] = useState<Record<string, Record<string, number>>>({});
  const [assists, setAssists] = useState<AssistRequest[]>([]);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [held, setHeld] = useState<HeldSale[]>([]);
  const [actingSupervisor, setActingSupervisor] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  const refreshSyncState = useCallback(async () => {
    const [ob, allSales, heldList, shifts, counts, cat, asks] = await Promise.all([
      getOutbox(), getSales(), getHeld(), getShifts(), getStockCounts(), getCatalog(), getAssists(),
    ]);
    setPending(ob.length);
    setSales(allSales);
    setHeld(heldList);
    setAllShifts(shifts);
    setCatalog(cat);
    setStockCounts(Object.fromEntries(counts.map((c) => [c.day, c.counts])));
    setAssists(asks);
    const t = new Date().toISOString().slice(0, 10);
    setTodayCount(allSales.filter((s) => s.createdAt.slice(0, 10) === t && !s.reversalOf).length);
  }, []);

  useEffect(() => {
    (async () => {
      const s = await ensureSeeded();
      try {
        const hubId = s.hubId || s.storeId;
        if (hubId) {
          const [staff, remoteCatalog] = await Promise.all([
            fetchStaff(hubId, s.deviceId),
            fetchCatalog(hubId, s.deviceId),
          ]);
          if (staff.length) await replaceCashiers(staff);
          if (remoteCatalog.length) await replaceCatalog(remoteCatalog);
        }
      } catch {
        // Offline: keep IndexedDB cache.
      }
      const [cat, cus, csh, shifts] = await Promise.all([
        getCatalog(), getCustomers(), getCashiers(), getShifts(),
      ]);
      setStore(s);
      setCatalog(cat);
      setCustomers(cus);
      setCashiers(csh);
      const savedId = sessionStorage.getItem(CASHIER_KEY);
      const restored = savedId ? csh.find((c) => c.id === savedId && c.isActive) : null;
      if (restored) {
        setCashier(restored);
        const open = openShiftFor(shifts, restored.id);
        if (open) setShift(open);
      }
      await refreshSyncState();
      setBooting(false);
    })();
  }, [refreshSyncState]);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const stop = startSync(refreshSyncState);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      stop();
    };
  }, [refreshSyncState]);

  const login = useCallback(async (c: Cashier) => {
    setCashier(c);
    sessionStorage.setItem(CASHIER_KEY, c.id);
    const shifts = await getShifts();
    const open = openShiftFor(shifts, c.id);
    if (open) {
      setShift(open);
      toast.success(`Welcome back, ${c.name.split(' ')[0]} — shift resumed`);
      return { hasShift: true };
    }
    return { hasShift: false };
  }, []);

  const logout = useCallback(() => {
    setCashier(null);
    setShift(null);
    setActingSupervisor(null);
    sessionStorage.removeItem(CASHIER_KEY);
    clearPinToken();
  }, []);

  const bindStore = useCallback(async (remote: RemoteStore) => {
    if (!store) return;
    const next = applyRemoteStore(store, remote);
    await saveStore(next);
    setStore(next);
    try {
      await bindDevice({
        deviceId: next.deviceId,
        hubId: next.hubId || next.storeId || remote.id,
        label: next.deviceLabel,
      });
      const hubId = next.hubId || next.storeId;
      const [staff, remoteCatalog] = await Promise.all([
        fetchStaff(hubId, next.deviceId),
        hubId ? fetchCatalog(hubId, next.deviceId) : Promise.resolve([]),
      ]);
      if (staff.length) {
        await replaceCashiers(staff);
        setCashiers(staff);
      }
      if (remoteCatalog.length) {
        await replaceCatalog(remoteCatalog);
        setCatalog(remoteCatalog);
      }
    } catch {
      toast.error('Could not pull staff for this location. Using cached till data.');
    }
  }, [store]);

  const openShift = useCallback(async (openingFloat: number) => {
    if (!cashier || !store) return;
    const s: Shift = {
      id: newShiftId(store.deviceId),
      deviceId: store.deviceId,
      hubId: store.hubId || store.storeId,
      cashierId: cashier.id,
      cashierName: cashier.name,
      openedAt: new Date().toISOString(),
      openingFloat,
      status: 'open',
    };
    await saveShift(s);
    setShift(s);
    await refreshSyncState();
    toast.success(`Shift open — float ${fmt(openingFloat)}`);
  }, [cashier, store, refreshSyncState]);

  const closeShift = useCallback(async (countedCash: number) => {
    if (!shift) return;
    const r = buildReport(shift, sales, countedCash);
    const closed: Shift = {
      ...shift,
      status: 'closed',
      closedAt: new Date().toISOString(),
      countedCash,
      expectedCash: r.expectedCash,
      variance: r.variance,
    };
    await saveShift(closed);
    setShift(null);
    setCashier(null);
    sessionStorage.removeItem(CASHIER_KEY);
    await refreshSyncState();
    const v = r.variance ?? 0;
    if (v === 0) toast.success('Shift closed — drawer balances');
    else toast.warning(`Shift closed — drawer ${v > 0 ? 'over' : 'short'} ${fmt(Math.abs(v))}`);
  }, [shift, sales, refreshSyncState]);

  const saveSettings = useCallback(async (patch: Partial<StoreProfile>) => {
    if (!store) return;
    const next = { ...store, ...patch };
    await saveStore(next);
    setStore(next);
    toast.success('Settings saved');
  }, [store]);

  const claimAssist = useCallback(async (a: AssistRequest) => {
    await saveAssist({
      ...a,
      status: 'in_progress',
      claimedBy: actingSupervisor || 'Supervisor',
      claimedAt: new Date().toISOString(),
    });
    await refreshSyncState();
  }, [actingSupervisor, refreshSyncState]);

  const cancelAssist = useCallback(async (a: AssistRequest) => {
    await saveAssist({
      ...a,
      status: 'cancelled',
      resolvedBy: actingSupervisor || 'Supervisor',
      resolvedAt: new Date().toISOString(),
    });
    await refreshSyncState();
    toast.info('Request dismissed');
  }, [actingSupervisor, refreshSyncState]);

  const resolveAssist = useCallback(async (
    a: AssistRequest,
    kind: ResolutionKind,
    note: string,
    payload: { productId?: string; newValue?: number; amount?: number },
  ) => {
    const by = actingSupervisor || 'Supervisor';
    const product = payload.productId ? catalog.find((p) => p.id === payload.productId) : undefined;
    let action: AssistRequest['action'] = { kind };
    let done = note;

    if (kind === 'price_override' && product && payload.newValue != null) {
      action = { kind, productId: product.id, productName: product.name, oldValue: product.price, newValue: payload.newValue };
      await saveProduct({ ...product, price: payload.newValue });
      done = note || `Price set to ${fmt(payload.newValue)}`;
    } else if (kind === 'stock_correction' && product && payload.newValue != null) {
      action = { kind, productId: product.id, productName: product.name, oldValue: product.stock ?? 0, newValue: payload.newValue };
      await saveProduct({ ...product, stock: payload.newValue });
      done = note || `Stock corrected to ${payload.newValue}`;
    } else if (kind === 'cash_drop' && payload.amount != null) {
      action = { kind, amount: payload.amount };
      done = note || `${fmt(payload.amount)} removed from drawer`;
    } else if (kind === 'sync_retry') {
      await flushOutbox();
      done = note || 'Sync retried';
    }

    await saveAssist({
      ...a,
      status: 'resolved',
      resolvedBy: by,
      resolvedAt: new Date().toISOString(),
      resolution: done,
      action,
    });
    await refreshSyncState();
    toast.success('Resolved — ' + done);
  }, [actingSupervisor, catalog, refreshSyncState]);

  const saveDayCount = useCallback(async (day: string, counts: Record<string, number>) => {
    await saveStockCount({
      id: day,
      day,
      counts,
      countedBy: actingSupervisor || cashier?.name || 'Supervisor',
      countedAt: new Date().toISOString(),
      deviceId: store?.deviceId,
      hubId: store?.hubId || store?.storeId,
    });
    await refreshSyncState();
    const n = Object.keys(counts).length;
    toast.success(`Stock count saved — ${n} product${n !== 1 ? 's' : ''}`);
  }, [actingSupervisor, cashier, refreshSyncState, store]);

  const createTillCashier = useCallback(async (input: {
    full_name: string;
    phone: string;
    email?: string;
    pin?: string;
  }) => {
    const res = await createCashier(input);
    const next = [...cashiers.filter((c) => c.id !== res.staff.id), res.staff];
    await replaceCashiers(next);
    setCashiers(next);
    return res.pin;
  }, [cashiers]);

  const resetTillCashierPin = useCallback(async (staffId: string) => {
    const res = await resetCashierPin(staffId);
    return res.pin;
  }, []);

  const manualSync = useCallback(async () => {
    setSyncing(true);
    const res = await flushOutbox();
    await refreshSyncState();
    setSyncing(false);
    if (res.pushed) toast.success(`Synced ${res.pushed} record${res.pushed !== 1 ? 's' : ''}`);
    else if (res.remaining) toast.error(`${res.remaining} still queued — no connection`);
    else toast.info('Everything is already synced');
  }, [refreshSyncState]);

  const copyPayloadForCrm = useCallback(async () => {
    if (!store) return;
    const json = exportPayload({
      deviceId: store.deviceId,
      deviceLabel: store.deviceLabel,
      storeName: store.storeName,
    });
    try {
      await navigator.clipboard.writeText(json);
      toast.success('Sync payload copied — paste it into your CRM — POS Sync');
    } catch {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `pos-sync-${store.deviceLabel.replace(/\s+/g, '-')}.json`;
      a.click();
      toast.success('Sync payload downloaded');
    }
  }, [store]);

  const value = useMemo<TillContextValue>(() => ({
    booting, store, catalog, customers, cashiers, cashier, shift, sales, held,
    allShifts, stockCounts, assists, online, pending, syncing, todayCount,
    actingSupervisor, setActingSupervisor, setCatalog, refreshSyncState,
    login, logout, bindStore, openShift, closeShift, saveSettings,
    claimAssist, cancelAssist, resolveAssist, saveDayCount,
    createTillCashier, resetTillCashierPin, manualSync, copyPayloadForCrm,
  }), [
    booting, store, catalog, customers, cashiers, cashier, shift, sales, held,
    allShifts, stockCounts, assists, online, pending, syncing, todayCount,
    actingSupervisor, refreshSyncState, login, logout, bindStore, openShift,
    closeShift, saveSettings, claimAssist, cancelAssist, resolveAssist,
    saveDayCount, createTillCashier, resetTillCashierPin, manualSync, copyPayloadForCrm,
  ]);

  return <TillContext.Provider value={value}>{children}</TillContext.Provider>;
}

export function useTill() {
  const ctx = useContext(TillContext);
  if (!ctx) throw new Error('useTill must be used inside TillProvider');
  return ctx;
}
