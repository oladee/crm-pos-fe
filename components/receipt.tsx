'use client';

import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import { PosSale, StoreProfile } from '@/lib/types';
import { fmt } from '@/lib/money';
import { receiptDate } from '@/lib/receipt';

export function Receipt({ sale, store, onClose }: { sale: PosSale; store: StoreProfile; onClose: () => void }) {
  const payment = sale.receiptPayment;
  return createPortal(
    <div className="receipt-overlay modal-backdrop fixed inset-0 z-50 grid place-items-center p-4">
      <style>{thermalStyles}</style>
      <section role="dialog" aria-modal="true" aria-label="Transaction receipt" className="receipt-shell w-full max-w-xs overflow-hidden rounded-2xl bg-white text-black">
        <header className="receipt-controls flex items-center justify-between border-b border-black/15 p-3">
          <h1 className="text-sm font-bold">Transaction receipt</h1>
          <button aria-label="Close receipt" onClick={onClose} className="grid h-11 w-11 place-items-center"><X size={18} /></button>
        </header>
        <div className="receipt-preview max-h-[60dvh] overflow-y-auto py-4">
          <article className="receipt-paper" aria-label="Receipt details">
            <header className="text-center">
              <h2>{store.storeName}</h2>
              <p>{sale.kind === 'repayment' ? 'CREDIT REPAYMENT' : sale.status === 'completed' ? 'SALE RECEIPT' : sale.status.toUpperCase()}</p>
              <p>Receipt: {sale.id}</p>
              <p>Transaction: {receiptDate(sale.createdAt)} WAT</p>
              <p>Till: {store.deviceLabel}</p>
              <p>Cashier: {sale.cashierName}</p>
              {sale.customerName && <p>Customer: {sale.customerName}</p>}
            </header>
            <section className="receipt-section" aria-label="Purchased items">
              {sale.lines.map((line, index) => <div className="receipt-item" key={`${line.productId}-${index}`}>
                <p className="font-bold">{line.name}</p>
                <Row label={`${line.qty} ${line.saleUnit || line.unit} × ${fmt(line.unitPrice)}`} value={fmt(line.lineTotal)} />
                {line.discount > 0 && <p>Item discount (included): {fmt(line.discount)}</p>}
              </div>)}
            </section>
            <section className="receipt-section" aria-label="Receipt totals">
              <Row label="Subtotal" value={fmt(sale.subtotal)} />
              {sale.discount > 0 && <Row label="Discount" value={`-${fmt(sale.discount)}`} />}
              {!!sale.tax && <Row label={`${store.taxLabel || 'Tax'}${sale.taxRatePct ? ` ${sale.taxRatePct}%` : ''}`} value={fmt(sale.tax)} />}
              <Row label={sale.kind === 'repayment' ? 'Repayment' : 'Sale total'} value={fmt(sale.total)} strong />
              {sale.creditBalanceKobo != null && <Row label="Credit at transaction" value={fmt(sale.creditBalanceKobo)} />}
              {sale.dueDate && <p>Due: {receiptDate(sale.dueDate)} WAT</p>}
              {payment?.feeKobo != null && <Row label="Provider charges" value={fmt(payment.feeKobo)} />}
              {payment && <Row label="Total paid" value={fmt(payment.paidKobo)} strong />}
            </section>
            <section className="receipt-section" aria-label="Payment details">
              {sale.payments.map((entry, i) => <Row key={i} label={entry.method} value={fmt(entry.amount)} />)}
              {payment && <p>Processor: {{ squad: 'Squad', bachs: 'Bachs', moniepoint: 'Moniepoint', manual: 'Manual confirmation', credit: 'Credit' }[payment.provider]}</p>}
              {payment?.confirmationSource && <p>Confirmation: {payment.confirmationSource}</p>}
              {payment?.actualMethod && <p>Actual method: {payment.actualMethod}</p>}
              {payment?.account && <p>Received into: {payment.account}</p>}
              {payment?.checkoutReference && <p>Payment ref: {payment.checkoutReference}</p>}
              {payment?.confirmedAt && <p>Confirmed: {receiptDate(payment.confirmedAt)} WAT</p>}
              {sale.change > 0 && <Row label="Change" value={fmt(sale.change)} />}
            </section>
            {store.receiptFooter && <p className="receipt-section text-center">{store.receiptFooter}</p>}
          </article>
        </div>
        <footer className="receipt-controls border-t border-black/15 p-3">
          <p className="mb-3 text-xs leading-5">Select the terminal printer and 58 mm paper in the print dialog. You can retry printing from sales history.</p>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-black/30 text-sm font-bold"><Printer size={16} />Print receipt</button>
            <button onClick={onClose} className="min-h-11 flex-1 rounded-xl bg-emerald-700 text-sm font-bold text-white">Close</button>
          </div>
        </footer>
      </section>
    </div>, document.body,
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`receipt-row${strong ? ' receipt-total' : ''}`}><span>{label}</span><span>{value}</span></div>;
}

// The initial 48 mm printable width must be calibrated on the physical Z92.
const thermalStyles = `
.receipt-paper { width: 48mm; margin: 0 auto; color: #000; background: #fff; font: 11px/1.45 Arial, sans-serif; overflow-wrap: anywhere; }
.receipt-paper p { margin: 0 0 3px; }
.receipt-paper h2 { font-size: 15px; font-weight: 800; margin: 0 0 5px; }
.receipt-row { display: grid; grid-template-columns: minmax(0,1fr) max-content; gap: 6px; margin: 3px 0; }
.receipt-row > :last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.receipt-section { border-top: 1px dashed #000; margin-top: 8px; padding-top: 8px; }
.receipt-item { margin-bottom: 8px; break-inside: avoid; }
.receipt-total { font-weight: 800; font-size: 13px; }
@media print {
  @page { size: auto; margin: 0; }
  html, body { width: 58mm !important; min-width: 0 !important; height: auto !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
  body > :not(.receipt-overlay) { display: none !important; }
  .receipt-overlay, .receipt-shell, .receipt-preview { display: block !important; position: static !important; width: 58mm !important; max-width: none !important; height: auto !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; }
  .receipt-controls { display: none !important; }
  .receipt-paper { padding: 3mm 0 8mm; }
  .receipt-paper * { color: #000 !important; border-color: #000 !important; }
}
`;
