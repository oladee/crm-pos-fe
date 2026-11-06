'use client';
import { createPortal } from 'react-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { thermalStyles } from '@/lib/thermal';

export function ThermalDocument({
  title,
  children,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack: () => void;
}) {
  return createPortal(
    <main className="receipt-overlay thermal-document min-h-dvh bg-[var(--color-bg)]">
      <style>{thermalStyles}</style>
      <header className="receipt-controls sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-bg)] p-4">
        <button onClick={onBack} className="inline-flex min-h-11 items-center gap-2 font-bold">
          <ArrowLeft size={18} />
          Back to report
        </button>
        <button
          onClick={() => window.print()}
          className="primary-action inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-bold"
        >
          <Printer size={17} />
          Print report
        </button>
        <h1 className="w-full text-lg font-black">{title}</h1>
      </header>
      <div className="receipt-shell receipt-preview mx-auto my-6 w-fit bg-white py-5 text-black">
        <article className="receipt-paper" aria-label="58 mm report preview">
          {children}
        </article>
      </div>
      <p className="receipt-controls mx-auto max-w-xl px-4 pb-8 text-sm">
        58 mm roll · 48 mm content width. Choose the terminal printer and 58 mm paper. Long reports
        continue across the printer’s pages.
      </p>
    </main>,
    document.body,
  );
}

export function ThermalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={'receipt-row' + (strong ? ' receipt-total' : '')}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
