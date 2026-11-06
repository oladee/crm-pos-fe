'use client';

import { createPortal } from 'react-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { PosSale, StoreProfile } from '@/lib/types';
import { fmt } from '@/lib/money';
import { printableLines, receiptDate, receiptQuantity } from '@/lib/receipt';
import { thermalStyles } from '@/lib/thermal';

export function Receipt({
  sale,
  store,
  onClose,
}: {
  sale: PosSale;
  store: Partial<StoreProfile>;
  onClose: () => void;
}) {
  const payment = sale.receiptPayment;
  return createPortal(
    <div className="receipt-overlay min-h-dvh bg-[var(--color-bg)]">
      <style>{thermalStyles}</style>
      <section
        aria-label="Transaction receipt"
        className="receipt-shell mx-auto w-full max-w-3xl pb-8"
      >
        <header className="receipt-controls sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-bg)] p-4">
          <button onClick={onClose} className="inline-flex min-h-11 items-center gap-2 font-bold">
            <ArrowLeft size={18} />
            Back to transactions
          </button>
          <button
            onClick={() => window.print()}
            className="primary-action inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-bold"
          >
            <Printer size={16} />
            Print receipt
          </button>
          <h1 className="w-full text-lg font-black">Transaction receipt</h1>
        </header>
        <div className="receipt-preview mx-auto my-6 w-fit bg-white px-4 py-5 text-black">
          <article className="receipt-paper" aria-label="Receipt details">
            <header className="text-center">
              {store.storeName && <h2>{store.storeName}</h2>}
              <p>
                {sale.kind === 'repayment'
                  ? 'CREDIT REPAYMENT'
                  : sale.status === 'completed'
                    ? 'SALE RECEIPT'
                    : sale.status.toUpperCase()}
              </p>
              <p>Receipt: {sale.id}</p>
              <p>Transaction: {receiptDate(sale.createdAt)} WAT</p>
              {store.deviceLabel && <p>Till: {store.deviceLabel}</p>}
              <p>Cashier: {sale.cashierName}</p>
              {sale.customerName && <p>Customer: {sale.customerName}</p>}
            </header>
            <section className="receipt-section" aria-label="Purchased items">
              {printableLines(sale.lines).map((line, index) => (
                <div className="receipt-item" key={`${line.productId}-${index}`}>
                  <p className="font-bold">{line.name}</p>
                  <Row
                    label={`${receiptQuantity(line.qty, line.saleUnit || line.unit)} ${line.saleUnit || line.unit || ''} × ${fmt(line.unitPrice)}`}
                    value={fmt(line.lineTotal)}
                  />
                  {line.discount > 0 && <p>Item discount (included): {fmt(line.discount)}</p>}
                </div>
              ))}
            </section>
            <section className="receipt-section" aria-label="Receipt totals">
              <Row label="Subtotal" value={fmt(sale.subtotal)} />
              {sale.discount > 0 && <Row label="Discount" value={`-${fmt(sale.discount)}`} />}
              {!!sale.tax && (
                <Row
                  label={`${store.taxLabel || 'Tax'}${sale.taxRatePct ? ` ${sale.taxRatePct}%` : ''}`}
                  value={fmt(sale.tax)}
                />
              )}
              <Row
                label={sale.kind === 'repayment' ? 'Repayment' : 'Sale total'}
                value={fmt(sale.total)}
                strong
              />
              {sale.creditBalanceKobo != null && (
                <Row label="Credit at transaction" value={fmt(sale.creditBalanceKobo)} />
              )}
              {sale.dueDate && <p>Due: {receiptDate(sale.dueDate)} WAT</p>}
              {payment?.feeKobo != null && (
                <Row label="Provider charges" value={fmt(payment.feeKobo)} />
              )}
              {payment && <Row label="Total paid" value={fmt(payment.paidKobo)} strong />}
            </section>
            <section className="receipt-section" aria-label="Payment details">
              {sale.payments.map((entry, i) => (
                <Row key={i} label={entry.method} value={fmt(entry.amount)} />
              ))}
              {payment && (
                <p>
                  Processor:{' '}
                  {
                    {
                      squad: 'Squad',
                      bachs: 'Bachs',
                      moniepoint: 'Moniepoint',
                      manual: 'Manual confirmation',
                      credit: 'Credit',
                    }[payment.provider]
                  }
                </p>
              )}
              {payment?.confirmationSource && <p>Confirmation: {payment.confirmationSource}</p>}
              {payment?.actualMethod && <p>Actual method: {payment.actualMethod}</p>}
              {payment?.account && <p>Received into: {payment.account}</p>}
              {payment?.checkoutReference && <p>Payment ref: {payment.checkoutReference}</p>}
              {payment?.confirmedAt && <p>Confirmed: {receiptDate(payment.confirmedAt)} WAT</p>}
              {sale.change > 0 && <Row label="Change" value={fmt(sale.change)} />}
            </section>
            {store.receiptFooter && (
              <p className="receipt-section text-center">{store.receiptFooter}</p>
            )}
          </article>
        </div>
        <footer className="receipt-controls px-4 text-sm text-[var(--color-ink-dim)]">
          Select the terminal printer and 58 mm paper in the print dialog. You can retry printing
          from Transactions.
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`receipt-row${strong ? ' receipt-total' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
