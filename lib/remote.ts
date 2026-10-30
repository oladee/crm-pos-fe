import type { Cashier, OutboxItem, PosProduct, StoreProfile, StoreType } from './types';
import type { PosRole } from './permissions';

const API_URL = (process.env.NEXT_PUBLIC_POS_API_URL || 'http://localhost:3478').replace(/\/$/, '');
const TOKEN_KEY = 'pos.pinJwt';

export type RemoteStore = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  code?: string;
  storeType: StoreType;
  location_type?: string;
  ownership_type?: string | null;
  taxRatePct?: number;
  taxInclusive?: boolean;
  maxDiscountPct?: number;
};

export type RemoteStaff = {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  role: PosRole;
  hubId?: string | null;
  storeId?: string | null;
  isActive: boolean;
};

export function getPinToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setPinToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearPinToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function readJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (body as { message?: string }).message || `POS API ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

async function getJson<T>(path: string, auth = false): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getPinToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store', headers });
  return readJson<T>(res);
}

async function sendJson<T>(path: string, method: string, body: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getPinToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  return readJson<T>(res);
}

export async function fetchStores(deviceId?: string): Promise<RemoteStore[]> {
  const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
  const res = await getJson<{ data: RemoteStore[] }>(`/pos/locations${q}`);
  return res.data ?? [];
}

export async function fetchStaff(hubId?: string, deviceId?: string): Promise<Cashier[]> {
  const params = new URLSearchParams();
  if (hubId) params.set('hubId', hubId);
  if (deviceId) params.set('deviceId', deviceId);
  const q = params.toString() ? `?${params}` : '';
  const res = await getJson<{ data: RemoteStaff[] }>(`/pos/staff${q}`);
  return (res.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    pin: '',
    role: s.role,
    isActive: s.isActive,
  }));
}

export async function fetchCatalog(hubId: string, deviceId?: string): Promise<PosProduct[]> {
  const params = new URLSearchParams({ hubId });
  if (deviceId) params.set('deviceId', deviceId);
  const res = await getJson<{ data: PosProduct[] }>(`/pos/catalog?${params}`);
  return res.data ?? [];
}

export async function bindDevice(input: { deviceId: string; hubId: string; label?: string }) {
  return sendJson('/pos/devices/bind', 'POST', input, false);
}

export async function fetchDeviceStatus(deviceId: string) {
  return getJson<{ registered: boolean; passkey: boolean }>(
    `/pos/devices/status?deviceId=${encodeURIComponent(deviceId)}`,
  );
}

export async function registrationOptions(deviceId: string, code: string) {
  return sendJson<{ options: Record<string, unknown> }>(
    '/pos/devices/register/options',
    'POST',
    { deviceId, code },
    false,
  );
}

export async function enrollDevice(input: {
  deviceId: string;
  code: string;
  label?: string;
  response: unknown;
}) {
  return sendJson<{ deviceId: string; hubId: string; credentialId: string; label: string }>(
    '/pos/devices/enroll',
    'POST',
    input,
    false,
  );
}

export async function authenticationOptions(deviceId: string) {
  return sendJson<{ legacy: boolean; options?: Record<string, unknown> }>(
    '/pos/devices/authenticate/options',
    'POST',
    { deviceId },
    false,
  );
}

function toCashier(staff: RemoteStaff, pin = ''): Cashier {
  return {
    id: staff.id,
    name: staff.name,
    pin,
    role: staff.role,
    isActive: staff.isActive,
  };
}

export async function createCashier(input: {
  full_name: string;
  phone: string;
  email?: string;
  pin?: string;
}): Promise<{ staff: Cashier; pin: string }> {
  const body = await sendJson<{ staff: RemoteStaff; pin: string }>('/pos/staff', 'POST', input);
  return { staff: toCashier(body.staff, body.pin), pin: body.pin };
}

export async function resetCashierPin(staffId: string): Promise<{ staff: Cashier; pin: string }> {
  const body = await sendJson<{ staff: RemoteStaff; pin: string }>(
    `/pos/staff/${encodeURIComponent(staffId)}/pin`,
    'POST',
    {},
  );
  return { staff: toCashier(body.staff, body.pin), pin: body.pin };
}

export async function verifyPin(input: {
  hubId?: string;
  storeId?: string;
  userId?: string;
  username?: string;
  email?: string;
  pin: string;
  deviceId?: string;
  deviceLabel?: string;
  assertion?: unknown;
}): Promise<{ staff: Cashier; location?: RemoteStore }> {
  const body = await sendJson<{ staff: RemoteStaff; token: string; location?: RemoteStore }>(
    '/pos/auth/pin',
    'POST',
    input,
    false,
  );
  if (body.token) setPinToken(body.token);
  const staff = body.staff;
  return {
    staff: {
      id: staff.id,
      name: staff.name,
      pin: input.pin,
      role: staff.role,
      isActive: staff.isActive,
    },
    location: body.location,
  };
}

export function applyRemoteStore(store: StoreProfile, remote: RemoteStore): StoreProfile {
  return {
    ...store,
    storeId: remote.id,
    hubId: remote.id,
    storeName: remote.name,
    storeType: remote.storeType || store.storeType,
    setupComplete: true,
    taxRatePct: remote.taxRatePct ?? store.taxRatePct,
    taxInclusive: remote.taxInclusive ?? store.taxInclusive,
    maxDiscountPct: remote.maxDiscountPct ?? store.maxDiscountPct,
  };
}

export type PosTransfer = {
  clientSaleId: string;
  checkoutId: string;
  status: 'initializing' | 'awaiting' | 'paid' | 'cancelled' | 'expired' | 'review';
  provider: 'bachs' | 'squad';
  feeKobo: number | null;
  reservationState: 'held' | 'consumed' | 'released' | 'needs_review';
  reconciliationReason: string | null;
  canConfirmReceived: boolean;
  canCancel: boolean;
  confirmationSource: string | null;
  bankName: string;
  accountName: string;
  accountNumber: string;
  payableKobo: number;
  cartTotalKobo: number;
  currency: string;
  expiresAt: string | null;
  sale: Record<string, unknown>;
};

export type PaymentProviderOption = { id: 'bachs' | 'squad'; name: string };
export function getPaymentOptions() {
  return getJson<{ providers: PaymentProviderOption[]; manualConfirmationEnabled: boolean }>('/pos/payments/options', true);
}
export function confirmPosTransferReceived(id: string) {
  return sendJson<PosTransfer>(`/pos/payments/transfers/${encodeURIComponent(id)}/confirm-received`, 'POST', {});
}
export function submitPosSale(sale: Record<string, unknown>) {
  return sendJson('/pos/sales', 'POST', { ...sale, clientSaleId: sale.id });
}

export async function startPosTransfer(body: Record<string, unknown>) {
  return sendJson<PosTransfer>('/pos/payments/transfers', 'POST', body);
}

export async function listPosTransfers(deviceId: string) {
  const res = await getJson<{ data: PosTransfer[] }>(
    `/pos/payments/transfers?deviceId=${encodeURIComponent(deviceId)}`,
    true,
  );
  return res.data ?? [];
}

export async function refreshPosTransfer(clientSaleId: string) {
  return getJson<PosTransfer>(`/pos/payments/transfers/${encodeURIComponent(clientSaleId)}?refresh=1`, true);
}

export async function cancelPosTransfer(clientSaleId: string) {
  return sendJson<PosTransfer>(`/pos/payments/transfers/${encodeURIComponent(clientSaleId)}/cancel`, 'POST', {});
}

export async function quoteSale(input: {
  hubId: string;
  deviceId: string;
  orderDiscount?: number;
  lines: Array<{ productId: string; batchNumber?: string; saleUnit: string; qty: number; discount: number }>;
}) {
  return sendJson<{
    subtotal: number;
    discount: number;
    tax: number;
    taxRatePct: number;
    taxInclusive: boolean;
    total: number;
  }>('/pos/sales/quote', 'POST', input);
}

export async function searchPosCustomers(q: string) {
  const res = await getJson<{ data: Array<{ id: string; name: string; phone?: string }> }>(
    `/pos/customers?q=${encodeURIComponent(q)}`,
    true,
  );
  return (res.data ?? []).map((row) => ({ id: row.id, name: row.name, phone: row.phone }));
}

export async function createPosCustomer(input: { name: string; phone: string }) {
  const res = await sendJson<{ data: { id: string; name: string; phone?: string } }>('/pos/customers', 'POST', input);
  return { id: res.data.id, name: res.data.name, phone: res.data.phone };
}

function saleHubId(payload: Record<string, unknown>, fallback?: string) {
  return String(payload.hubId || payload.storeId || fallback || '');
}

export const posBackend = {
  async reachable() {
    return typeof navigator !== 'undefined' && navigator.onLine && Boolean(getPinToken());
  },
  async push(item: OutboxItem) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('offline');
    if (!getPinToken()) throw new Error('not signed in');
    const payload = (item.payload ?? {}) as Record<string, unknown>;
    if (item.type === 'sale') {
      await sendJson('/pos/sales', 'POST', { ...payload, clientSaleId: item.refId, hubId: saleHubId(payload) });
      return;
    }
    if (item.type === 'refund' || item.type === 'void') {
      const originalId = String(payload.reversalOf || '');
      if (!originalId) throw new Error('missing original sale id');
      const path = item.type === 'void'
        ? `/pos/sales/${encodeURIComponent(originalId)}/void`
        : `/pos/sales/${encodeURIComponent(originalId)}/refund`;
      await sendJson(path, 'POST', { ...payload, reversalId: item.refId, hubId: saleHubId(payload) });
      return;
    }
    if (item.type === 'shift') {
      await sendJson('/pos/shifts', 'POST', payload);
      return;
    }
    if (item.type === 'assist') {
      await sendJson('/pos/assists', 'POST', payload);
      return;
    }
    if (item.type === 'stock_count') {
      await sendJson('/pos/stock-counts', 'POST', payload);
      return;
    }
  },
};
