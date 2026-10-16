import Image from 'next/image';

export function SalesOsBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="shrink-0" aria-label="SalesOS by Fudfarmer, Retail POS">
      <span className={`salesos-logo-frame block ${compact ? 'w-[104px]' : 'w-[236px]'}`}>
        <Image src="/salesos-logo.svg" alt="SalesOS by Fudfarmer" width={596} height={183} priority className="block h-auto w-full" />
      </span>
      <p className={`${compact ? 'text-[8px]' : 'text-[10px]'} font-black uppercase tracking-[0.16em] text-[var(--color-ink-dim)] mt-1.5`}>Retail POS</p>
    </div>
  );
}
