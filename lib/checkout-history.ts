import { listCheckouts } from './checkouts';
import { recordSale } from './db';
import { cacheReceipt } from './transactions';
import type { PosSale } from './types';

/** Recover completed transactions even if the PWA was closed when the money arrived. */
export async function recoverCheckoutReceipts(deviceId: string): Promise<PosSale[]> {
  const receipts: PosSale[] = [];
  let before: string | undefined;
  do {
    const page = await listCheckouts(before);
    for (const row of page.data) if (row.status === 'completed' && row.receipt) {
      await cacheReceipt(row.receipt);
      if (row.receipt.deviceId === deviceId) { await recordSale(row.receipt); receipts.push(row.receipt); }
    }
    before = page.nextCursor || undefined;
  } while (before);
  return receipts;
}
