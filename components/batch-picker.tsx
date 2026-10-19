'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { PosProduct } from '@/lib/types';
import { fmt } from '@/lib/money';

export function isCartonProduct(unit?: string) {
  return String(unit || '').trim().toLowerCase().startsWith('carton');
}

export function BatchPicker({
  product,
  onClose,
  onAdd,
}: {
  product: PosProduct;
  onClose: () => void;
  onAdd: (choice: { batchNumber: string; saleUnit: string; unitPrice: number }) => void;
}) {
  const batches = (product.batches || []).filter((b) => b.quantityRemaining > 0);
  const carton = isCartonProduct(product.unit);
  const [batchNumber, setBatchNumber] = useState(batches[0]?.batchNumber || '');
  const [saleUnit, setSaleUnit] = useState(carton ? 'Kg' : product.unit || 'Units');
  const batch = batches.find((b) => b.batchNumber === batchNumber);
  const unitPrice = batch ? (saleUnit === 'Carton' ? batch.cartonPrice : batch.unitPrice) : 0;
  const blocked = !batch || unitPrice <= 0 || (saleUnit === 'Carton' && !(batch.cartonWeight > 0));

  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-4">
      <div className="modal-shell w-full max-w-md rounded-[16px] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-[-0.02em]">{product.name}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-dim)]">Choose the purchase batch for this line.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-ink-dim)]"><X size={20} /></button>
        </div>
        {batches.length === 0 && <p className="mt-5 text-sm text-[var(--color-ink-dim)]">This product has no open batch.</p>}
        <div className="mt-4 space-y-2">
          {batches.map((row) => (
            <button
              key={row.batchNumber}
              type="button"
              onClick={() => setBatchNumber(row.batchNumber)}
              className={`w-full rounded-[12px] border px-3 py-3 text-left ${row.batchNumber === batchNumber ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10' : 'border-[var(--color-line)]'}`}
            >
              <span className="block text-sm font-black">Batch {row.batchNumber}</span>
              <span className="mt-0.5 block text-xs text-[var(--color-ink-dim)]">{row.quantityRemaining} {carton ? 'kg' : product.unit} left</span>
            </button>
          ))}
        </div>
        {carton && batch && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['Kg', 'Carton'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => setSaleUnit(unit)}
                className={`h-11 rounded-[10px] text-sm font-black ${saleUnit === unit ? 'bg-[var(--color-ink)] text-[var(--color-ink-inverse)]' : 'border border-[var(--color-line)]'}`}
              >
                {unit} · {fmt(unit === 'Carton' ? batch.cartonPrice : batch.unitPrice)}
              </button>
            ))}
          </div>
        )}
        {saleUnit === 'Carton' && batch && !(batch.cartonWeight > 0) && (
          <p className="mt-3 text-xs font-bold text-[var(--color-warn)]">This batch has no carton weight, so it cannot be sold by the carton.</p>
        )}
        <button
          type="button"
          disabled={blocked}
          onClick={() => batch && onAdd({ batchNumber: batch.batchNumber, saleUnit, unitPrice })}
          className="primary-action mt-4 h-12 w-full rounded-[11px] text-sm font-black disabled:opacity-40"
        >
          {blocked ? 'Select a batch' : `Add ${saleUnit} · ${fmt(unitPrice)}`}
        </button>
      </div>
    </div>
  );
}
