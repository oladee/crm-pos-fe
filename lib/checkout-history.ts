import { listCheckouts } from './checkouts';
import { recordSale } from './db';
import type { PosSale } from './types';

/** Recover completed transactions even if the PWA was closed when the money arrived. */
export async function recoverCheckoutReceipts(): Promise<PosSale[]> {
  const receipts: PosSale[] = [];
  let before: string | undefined;
  do {
    const page = await listCheckouts(before);
    for (const row of page.data) if (row.status === 'completed' && row.receipt) { await recordSale(row.receipt); receipts.push(row.receipt); }
    before = page.nextCursor || undefined;
  } while (before);
  return receipts;
}
