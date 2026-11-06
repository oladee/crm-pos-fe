import type { PosSale } from './types';
import type { PosTransfer } from './remote';

/** Internal FIFO batch splits are one purchased SKU on the customer's receipt. */
export function printableLines(lines: PosSale['lines']): PosSale['lines'] {
  const grouped = new Map<string, PosSale['lines'][number]>();
  lines.forEach((line, index) => {
    const key = line.productId
      ? JSON.stringify([line.productId, line.name, line.saleUnit || line.unit, line.unitPrice])
      : String(index);
    const previous = grouped.get(key);
    grouped.set(
      key,
      previous
        ? {
            ...previous,
            qty: previous.qty + line.qty,
            lineTotal: previous.lineTotal + line.lineTotal,
            discount: previous.discount + line.discount,
          }
        : { ...line },
    );
  });
  return [...grouped.values()];
}

export function receiptQuantity(quantity: number, unit?: string) {
  return new Intl.NumberFormat('en-NG', {
    maximumFractionDigits: /^(l|lit(er|re)s?)$/i.test((unit || '').trim()) ? 3 : 2,
  }).format(quantity);
}

/** Only backend-confirmed transfers can become paid receipts. */
export function confirmedTransferSale(transfer: PosTransfer): PosSale | null {
  const sale = transfer.sale?.posSale as PosSale | undefined;
  if (
    transfer.status !== 'paid' ||
    !sale ||
    !Array.isArray(sale.lines) ||
    sale.id !== transfer.clientSaleId
  )
    return null;
  return {
    ...sale,
    payments: [
      { method: 'Transfer', amount: transfer.cartTotalKobo, reference: transfer.checkoutId },
    ],
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
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}
