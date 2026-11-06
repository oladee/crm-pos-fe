import type { PosSale } from './types';
import { getJson } from './remote';
import { getOne, getSales, getStore, put } from './db';

export type Transaction = {
  reference: string;
  kind: 'sale' | 'repayment';
  status: string;
  createdAt: string;
  customerName?: string;
  cashierName?: string;
  cashierId: string;
  deviceId?: string;
  locationId: string;
  locationName?: string;
  tillName?: string;
  totalKobo: number;
  receipt: PosSale | null;
  checkoutId: string | null;
  legacyTransferId: string | null;
  actions: { viewReceipt: boolean; printReceipt: boolean; refund: boolean; void: boolean };
};
type CachedHistory = { id: string; rows: Transaction[] };
const key = (location: string) => `transaction-history:${location}`;

// Dedicated settings entries never pass through recordSale or the stock/outbox stores.
export async function cachedTransactions(location: string) {
  const [saved, sales, store] = await Promise.all([
    getOne<CachedHistory>('settings', key(location)),
    getSales(),
    getStore(),
  ]);
  const rows = new Map<string, Transaction>();
  // Read older locally confirmed receipts without recording them again.
  for (const sale of sales)
    if (
      (sale.hubId || sale.storeId) === location &&
      sale.syncState === 'synced' &&
      !sale.reversalOf
    ) {
      const origin =
        sale.origin ||
        (sale.deviceId === store?.deviceId
          ? { storeName: store.storeName, deviceLabel: store.deviceLabel }
          : {});
      rows.set(sale.id, {
        reference: sale.id,
        kind: sale.kind || 'sale',
        status: sale.status,
        createdAt: sale.createdAt,
        customerName: sale.customerName,
        cashierName: sale.cashierName,
        cashierId: sale.cashierId,
        deviceId: sale.deviceId,
        locationId: location,
        locationName: origin.storeName,
        tillName: origin.deviceLabel,
        totalKobo: sale.total,
        receipt: { ...sale, origin },
        checkoutId: null,
        legacyTransferId: null,
        actions: { viewReceipt: true, printReceipt: true, refund: false, void: false },
      });
    }
  for (const row of saved?.rows || [])
    if (row.locationId === location) rows.set(row.reference, row);
  return [...rows.values()];
}
export async function cacheTransactions(location: string, rows: Transaction[]) {
  const all = new Map((await cachedTransactions(location)).map((row) => [row.reference, row]));
  rows.filter((row) => row.locationId === location).forEach((row) => all.set(row.reference, row));
  await put('settings', { id: key(location), rows: [...all.values()] });
}
export async function listTransactions(location: string, filters: Record<string, string> = {}) {
  const page = await getJson<{ data: Transaction[]; nextCursor: string | null }>(
    `/pos/transactions?${new URLSearchParams(filters)}`,
    true,
  );
  await cacheTransactions(location, page.data);
  return page;
}
export async function transaction(location: string, reference: string) {
  const row = await getJson<Transaction>(
    `/pos/transactions/${encodeURIComponent(reference)}`,
    true,
  );
  if (row.locationId !== location) throw new Error('Transaction belongs to another location');
  await cacheTransactions(location, [row]);
  return row;
}
export async function cacheReceipt(sale: PosSale) {
  const location = sale.hubId || sale.storeId;
  await cacheTransactions(location, [
    {
      reference: sale.id,
      kind: sale.kind || 'sale',
      status: sale.status,
      createdAt: sale.createdAt,
      customerName: sale.customerName,
      cashierName: sale.cashierName,
      cashierId: sale.cashierId,
      deviceId: sale.deviceId,
      locationId: location,
      totalKobo: sale.total,
      receipt: sale,
      checkoutId: null,
      legacyTransferId: null,
      actions: { viewReceipt: true, printReceipt: true, refund: false, void: false },
    },
  ]);
}
