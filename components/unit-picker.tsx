'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import type { PosProduct } from '@/lib/types';
import { fmt } from '@/lib/money';
export function UnitPicker({ product, onClose, onAdd }: { product: PosProduct; onClose: () => void; onAdd: (choice: { saleUnit: string; unitPrice: number }) => void }) {
  const [unit, setUnit] = useState('Carton');
  const price = unit === 'Carton' ? product.cartonPrice || 0 : product.price;
  const blocked = price <= 0 || !(Number(product.cartonWeight) > 0);
  return <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="unit-picker-title" className="modal-shell w-full max-w-md rounded-[16px] p-5">
      <div className="flex items-start justify-between gap-3"><h2 id="unit-picker-title" className="text-lg font-black">{product.name}</h2><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <p className="mt-2 text-sm text-[var(--color-ink-dim)]">Choose the sale unit. Stock is allocated automatically from the oldest receipts.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">{['Carton', 'Kg'].map(value => <button type="button" key={value} onClick={() => setUnit(value)} className={`h-12 rounded-[10px] border text-sm font-bold ${unit === value ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-[var(--color-line)]'}`}>{value} · {fmt(value === 'Carton' ? product.cartonPrice || 0 : product.price)}</button>)}</div>
      {blocked && <p className="mt-3 text-sm text-[var(--color-warn)]">Set the SKU selling price and carton weight before selling.</p>}
      <button type="button" disabled={blocked} onClick={() => onAdd({ saleUnit: unit, unitPrice: price })} className="primary-action mt-4 h-12 w-full rounded-[11px] text-sm font-black disabled:opacity-40">Add {unit} · {fmt(price)}</button>
    </div>
  </div>;
}
