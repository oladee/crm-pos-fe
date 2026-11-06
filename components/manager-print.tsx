'use client';
import { ThermalDocument, ThermalRow } from './thermal-document';
import { fmt } from '@/lib/money';
import { receiptDate } from '@/lib/receipt';
import type { PosSale, StoreProfile } from '@/lib/types';
import type { CashierPerf, ClosingInventory, DayReconciliation } from '@/lib/supervisor';

export function ManagerPrint({
  store,
  day,
  recon,
  perf,
  stock,
  transactions,
  unsynced,
  onBack,
}: {
  store: StoreProfile;
  day: string;
  recon: DayReconciliation;
  perf: CashierPerf[];
  stock: ClosingInventory;
  transactions: PosSale[];
  unsynced: number;
  onBack: () => void;
}) {
  return (
    <ThermalDocument title="Manager daily report" onBack={onBack}>
      <header className="text-center">
        <h2>{store.storeName}</h2>
        <p>MANAGER DAILY REPORT</p>
        <p>Till: {store.deviceLabel}</p>
        <p>Trading date: {day}</p>
        <p>Printed: {receiptDate(new Date().toISOString())} WAT</p>
      </header>
      <section className="receipt-section">
        <h3>Sales summary</h3>
        <ThermalRow label="Transactions" value={String(recon.transactions)} />
        <ThermalRow label="Gross sales" value={fmt(recon.gross)} />
        <ThermalRow label="Refunds" value={fmt(recon.refunds)} />
        <ThermalRow label="Net sales" value={fmt(recon.net)} strong />
        {recon.byMethod.map((method) => (
          <ThermalRow key={method.method} label={method.method} value={fmt(method.amount)} />
        ))}
      </section>
      <section className="receipt-section">
        <h3>Cash reconciliation</h3>
        <ThermalRow label="Opening float" value={fmt(recon.totalFloat)} />
        <ThermalRow label="Cash collected" value={fmt(recon.totalCashSales)} />
        <ThermalRow label="Cash refunds" value={fmt(recon.totalCashRefunds)} />
        <ThermalRow label="Cash drops" value={fmt(recon.totalCashDrops)} />
        <ThermalRow label="Expected cash" value={fmt(recon.totalExpected)} strong />
        <ThermalRow
          label="Counted cash"
          value={
            recon.shifts.some((shift) => shift.counted != null)
              ? fmt(recon.totalCounted)
              : 'Not counted'
          }
        />
        <ThermalRow
          label="Variance"
          value={
            recon.shifts.some((shift) => shift.counted != null)
              ? fmt(recon.totalVariance)
              : 'Not available'
          }
        />
        <ThermalRow label="Open shifts" value={String(recon.openShifts)} />
        <ThermalRow label="Unsynced records" value={String(unsynced)} />
      </section>
      <section className="receipt-section">
        <h3>Cashiers</h3>
        {perf.map((person) => (
          <div className="receipt-item" key={person.cashierId}>
            <p className="font-bold">{person.cashierName}</p>
            <ThermalRow label={String(person.transactions) + ' sales'} value={fmt(person.net)} />
            <ThermalRow label="Cash taken" value={fmt(person.cashTaken)} />
            <ThermalRow label="Drawer variance" value={fmt(person.variance)} />
          </div>
        ))}
      </section>
      <section className="receipt-section">
        <h3>Transactions</h3>
        {transactions.map((sale) => (
          <div className="receipt-item receipt-section" key={sale.id}>
            <p>{sale.id}</p>
            <p>{sale.customerName || 'Customer not recorded'}</p>
            <p>
              {sale.cashierName} · {receiptDate(sale.createdAt)} WAT
            </p>
            <ThermalRow
              label={sale.kind === 'repayment' ? 'Repayment' : sale.status}
              value={fmt(sale.total)}
            />
            {sale.payments.map((payment, index) => (
              <ThermalRow key={index} label={payment.method} value={fmt(payment.amount)} />
            ))}
          </div>
        ))}
      </section>
      <section className="receipt-section">
        <h3>Closing stock</h3>
        {stock.rows.map((product) => (
          <div className="receipt-item" key={product.productId}>
            <p className="font-bold">{product.name}</p>
            <ThermalRow
              label="Expected closing"
              value={String(product.expectedClosing) + ' ' + product.unit}
            />
            {product.counted != null && (
              <ThermalRow label="Counted" value={String(product.counted)} />
            )}
            <ThermalRow label="Closing value" value={fmt(product.closingValue)} />
          </div>
        ))}
      </section>
      <p className="receipt-section text-center">End of report. Printing does not close shifts.</p>
    </ThermalDocument>
  );
}
