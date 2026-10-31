import type { PosSale } from './types';
import type { PosTransfer } from './remote';

/** Only backend-confirmed transfers can become paid receipts. */
export function confirmedTransferSale(transfer: PosTransfer): PosSale | null {
  const sale = transfer.sale?.posSale as PosSale | undefined;
  if (transfer.status !== 'paid' || !sale || !Array.isArray(sale.lines) || sale.id !== transfer.clientSaleId) return null;
  return {
    ...sale,
    payments: [{ method: 'Transfer', amount: transfer.cartTotalKobo, reference: transfer.checkoutId }],
    syncState: 'synced',
    receiptPayment: {
      provider: transfer.provider,
      checkoutReference: transfer.checkoutId || undefined,
      feeKobo: transfer.feeKobo ?? undefined,
      paidKobo: transfer.payableKobo,
      confirmedAt: transfer.confirmedAt || undefined,
    },
  };
}

export function receiptDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'medium',
  }).format(new Date(value));
}
