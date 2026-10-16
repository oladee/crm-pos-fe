'use client';

import Image from 'next/image';
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  X, Users, Scale, AlertTriangle, CheckCircle2, Clock, CloudOff, Printer,
  TrendingUp, Receipt, Percent, RotateCcw, ShieldCheck, ChevronDown, ChevronUp,
  ListOrdered, Boxes, Search, Cloud, Loader2, Save, LifeBuoy, LayoutDashboard,
  ArrowRight,
} from 'lucide-react';
import { PosSale, Shift, Cashier, StoreProfile, PosProduct, AssistRequest, ResolutionKind } from '@/lib/types';
import { AssistQueue } from './assist-panels';
import { openCount } from '@/lib/assist';
import {
  cashierPerformance, reconcileDay, closingInventory, todayStr, dayOf,
  CashierPerf, DayReconciliation, ClosingInventory,
} from '@/lib/supervisor';
import { fmt } from '@/lib/money';
import { ThemeToggle } from './theme-provider';

type Tab = 'overview' | 'assist' | 'cashiers' | 'transactions' | 'stock' | 'reconcile';

export function SupervisorView({
  sales, shifts, cashiers, catalog, store, unsynced, stockCounts, onSaveCount,
  assists, onClaimAssist, onResolveAssist, onCancelAssist, onClose,
}: {
  sales: PosSale[]; shifts: Shift[]; cashiers: Cashier[]; catalog: PosProduct[];
  store: StoreProfile; unsynced: number;
  /** day → (productId → counted qty) */
  stockCounts: Record<string, Record<string, number>>;
  onSaveCount: (day: string, counts: Record<string, number>) => void;
  assists: AssistRequest[];
  onClaimAssist: (a: AssistRequest) => void;
  onResolveAssist: (a: AssistRequest, kind: ResolutionKind, note: string, payload: { productId?: string; newValue?: number; amount?: number }) => void;
  onCancelAssist: (a: AssistRequest) => void;
  onClose: () => void;
}) {
  const waiting = openCount(assists);
  const [tab, setTab] = useState<Tab>(waiting > 0 ? 'assist' : 'overview');
  const [day, setDay] = useState(todayStr());
  const [expanded, setExpanded] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const showActive = () => {
      if (window.innerWidth < 768) navRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    showActive();
    window.addEventListener('resize', showActive);
    return () => window.removeEventListener('resize', showActive);
  }, [tab]);

  const perf = useMemo(() => cashierPerformance(sales, shifts, cashiers, day), [sales, shifts, cashiers, day]);
  const recon = useMemo(() => reconcileDay(sales, shifts, day, unsynced, assists), [sales, shifts, day, unsynced, assists]);
  const stock = useMemo(() => closingInventory(catalog, sales, day, stockCounts[day]), [catalog, sales, day, stockCounts]);
  const dayTxns = useMemo(
    () => sales.filter((s) => dayOf(s.createdAt) === day).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sales, day],
  );
  const closeReady = recon.canClose && recon.balanced && recon.shifts.every((r) => r.reconciled && r.variance === 0)
    && stock.fullyCounted && stock.discrepancies.length === 0;

  const nav = [
    ['overview', 'Overview', LayoutDashboard, undefined],
    ['assist', 'Assist', LifeBuoy, waiting || undefined],
    ['cashiers', 'Cashiers', Users, perf.length || undefined],
    ['transactions', 'Transactions', ListOrdered, dayTxns.length || undefined],
    ['stock', 'Closing stock', Boxes, stock.discrepancies.length || undefined],
    ['reconcile', 'Reconciliation', Scale, recon.openShifts || undefined],
  ] as [Tab, string, typeof Users, number | undefined][];

  return (
    <div className="manager-shell fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-[var(--color-bg)]">
      <header className="manager-header flex min-h-[72px] shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="salesos-logo-frame hidden shrink-0 sm:block">
            <Image src="/salesos-logo.svg" alt="SalesOS by Fudfarmer" width={596} height={183} className="h-auto w-[104px]" priority />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="shrink-0 text-[var(--color-brand)]" />
              <h2 className="truncate text-sm font-black sm:text-base">Manager <span className="hidden sm:inline">workspace</span></h2>
            </div>
            <p className="hidden truncate text-[11px] text-[var(--color-ink-dim)] sm:block sm:text-xs">{store.storeName} / {store.deviceLabel}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="hidden text-[11px] font-bold text-[var(--color-ink-dim)] md:block" htmlFor="manager-date">Trading date</label>
          <input id="manager-date" type="date" value={day} onChange={(e) => setDay(e.target.value)}
            className="manager-control h-10 w-[110px] px-2 text-[11px] outline-none sm:w-[150px] sm:text-xs" />
          <ThemeToggle compact />
          <button aria-label="Print manager report" title="Print report" onClick={() => window.print()} className="manager-icon-button manager-print-button">
            <Printer size={16} />
          </button>
          <button aria-label="Back to point of sale" title="Back to POS" onClick={onClose} className="manager-icon-button"><X size={18} /></button>
        </div>
      </header>

      <div className="min-h-0 flex-1 md:grid md:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="manager-sidebar border-b border-[var(--color-line)] md:border-b-0 md:border-r">
          <nav ref={navRef} aria-label="Manager sections" className="manager-nav flex gap-1 overflow-x-auto p-2 md:flex-col md:gap-1 md:p-3">
            {nav.map(([k, label, Icon, count]) => (
              <button key={k} onClick={() => setTab(k)} data-active={tab === k}
                className={`manager-nav-item ${k === 'assist' && waiting > 0 ? 'manager-nav-urgent' : ''}`}>
                <Icon size={16} />
                <span>{label}</span>
                {count != null && <span className="manager-nav-count">{count}</span>}
              </button>
            ))}
          </nav>
          <div className="mx-4 mt-auto hidden border-t border-[var(--color-line)] py-4 md:block">
            <p className="text-[11px] font-bold text-[var(--color-ink-dim)]">Close readiness</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              {closeReady
                ? <CheckCircle2 size={15} className="text-[var(--color-brand)]" />
                : <AlertTriangle size={15} className="text-[var(--color-warn)]" />}
              <span>{closeReady ? 'Ready to close' : 'Action required'}</span>
            </div>
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
            {tab === 'overview' && <OverviewTab perf={perf} recon={recon} stock={stock} waiting={waiting} setTab={setTab} />}
            {tab === 'assist' && <AssistQueue assists={assists} catalog={catalog} onClaim={onClaimAssist} onResolve={onResolveAssist} onCancel={onCancelAssist} />}
            {tab === 'cashiers' && <CashierTab perf={perf} expanded={expanded} setExpanded={setExpanded} />}
            {tab === 'transactions' && <TransactionsTab txns={dayTxns} cashiers={cashiers} expanded={expanded} setExpanded={setExpanded} />}
            {tab === 'stock' && <StockTab stock={stock} day={day} onSaveCount={onSaveCount} />}
            {tab === 'reconcile' && <ReconcileTab recon={recon} stock={stock} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function OverviewTab({
  perf, recon, stock, waiting, setTab,
}: {
  perf: CashierPerf[]; recon: DayReconciliation; stock: ClosingInventory;
  waiting: number; setTab: (tab: Tab) => void;
}) {
  const cashierFlags = perf.reduce((sum, p) => sum + p.flags.length, 0);
  const items: { title: string; detail: string; tab: Tab; tone: 'urgent' | 'warn' | 'quiet' }[] = [];

  if (waiting > 0) items.push({ title: `${waiting} help request${waiting === 1 ? '' : 's'} waiting`, detail: 'A customer or attendant may be blocked at the till.', tab: 'assist', tone: 'urgent' });
  if (recon.openShifts > 0) items.push({ title: `${recon.openShifts} shift${recon.openShifts === 1 ? '' : 's'} still open`, detail: 'Close and count each till before reconciling the day.', tab: 'reconcile', tone: 'warn' });
  if (recon.unsynced > 0) items.push({ title: `${recon.unsynced} update${recon.unsynced === 1 ? '' : 's'} not in CRM`, detail: 'Review queued transactions and send them when online.', tab: 'transactions', tone: 'warn' });
  if (recon.totalVariance !== 0) items.push({ title: `Cash is ${recon.totalVariance < 0 ? 'short' : 'over'} by ${fmt(Math.abs(recon.totalVariance))}`, detail: 'Review counted cash against the expected drawer balance.', tab: 'reconcile', tone: 'urgent' });
  if (stock.discrepancies.length > 0) items.push({ title: `${stock.discrepancies.length} stock discrepanc${stock.discrepancies.length === 1 ? 'y' : 'ies'}`, detail: 'Check the physical count before accepting the close.', tab: 'stock', tone: 'urgent' });
  else if (stock.countedProducts === 0) items.push({ title: 'Closing stock has not been counted', detail: 'Enter the physical count before end-of-day review.', tab: 'stock', tone: 'quiet' });
  if (cashierFlags > 0) items.push({ title: `${cashierFlags} cashier flag${cashierFlags === 1 ? '' : 's'} to review`, detail: 'Check refunds, discounts, open shifts, and drawer variance.', tab: 'cashiers', tone: 'warn' });

  const clear = items.length === 0;
  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">Daily overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-ink-dim)]">Sales, tills, stock, and exceptions in one place.</p>
        </div>
        <div className={`manager-readiness ${clear ? 'manager-readiness-clear' : ''}`}>
          {clear ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{clear ? 'No exceptions to review' : `${items.length} item${items.length === 1 ? '' : 's'} need attention`}</span>
        </div>
      </div>

      <section aria-label="Trading summary" className="manager-summary-grid">
        <div className="manager-primary-metric">
          <p className="manager-label">Net sales</p>
          <p className="manager-number mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">{fmt(recon.net)}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--color-ink-dim)]">
            <span><b className="text-[var(--color-ink)]">{recon.transactions}</b> completed sales</span>
            <span><b className="text-[var(--color-ink)]">{fmt(recon.refunds)}</b> refunded</span>
          </div>
        </div>
        <div className="manager-secondary-metrics">
          <div>
            <p className="manager-label">Expected cash</p>
            <p className="manager-number mt-2 text-xl font-black">{fmt(recon.totalExpected)}</p>
          </div>
          <div>
            <p className="manager-label">Closing stock value</p>
            <p className="manager-number mt-2 text-xl font-black">{fmt(stock.totalClosingValue)}</p>
          </div>
          <div>
            <p className="manager-label">Units sold</p>
            <p className="manager-number mt-2 text-xl font-black">{stock.totalSoldUnits}</p>
          </div>
          <div>
            <p className="manager-label">Cashiers active</p>
            <p className="manager-number mt-2 text-xl font-black">{perf.length}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black">Needs attention</h2>
              <p className="mt-0.5 text-xs text-[var(--color-ink-dim)]">Work from the top down before close.</p>
            </div>
          </div>
          {clear ? (
            <div className="manager-empty-state">
              <CheckCircle2 size={22} className="text-[var(--color-brand)]" />
              <div><p className="font-bold">Everything checks out</p><p className="mt-0.5 text-xs text-[var(--color-ink-dim)]">No open exceptions were found for this date.</p></div>
            </div>
          ) : (
            <div className="border-y border-[var(--color-line)]">
              {items.map((item, index) => (
                <button key={`${item.tab}-${index}`} onClick={() => setTab(item.tab)} className="manager-attention-row">
                  <span className={`manager-attention-icon manager-attention-${item.tone}`}>
                    {item.tone === 'quiet' ? <Clock size={16} /> : <AlertTriangle size={16} />}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-bold">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-[var(--color-ink-dim)]">{item.detail}</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-[var(--color-ink-dim)]" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black">Cashier activity</h2>
              <p className="mt-0.5 text-xs text-[var(--color-ink-dim)]">Net sales for the selected date.</p>
            </div>
            <button onClick={() => setTab('cashiers')} className="text-xs font-bold text-[var(--color-brand)]">View details</button>
          </div>
          {perf.length === 0 ? (
            <div className="manager-empty-state"><Users size={21} /><p className="text-sm text-[var(--color-ink-dim)]">No cashier activity recorded.</p></div>
          ) : (
            <div className="border-y border-[var(--color-line)]">
              {perf.slice(0, 5).map((p, index) => (
                <button key={p.cashierId} onClick={() => setTab('cashiers')} className="manager-cashier-row">
                  <span className="manager-rank">{index + 1}</span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-bold">{p.cashierName.split(' (')[0]}</span>
                    <span className="block text-xs text-[var(--color-ink-dim)]">{p.transactions} sales / {p.itemsSold} items</span>
                  </span>
                  <span className="manager-number text-sm font-black">{fmt(p.net)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─────────── Cashier performance ─────────── */
function CashierTab({ perf, expanded, setExpanded }: { perf: CashierPerf[]; expanded: string | null; setExpanded: (v: string | null) => void }) {
  const best = perf[0];
  return (
    <div className="manager-module mx-auto max-w-5xl">
      <ModuleHeader title="Cashier activity" description="Compare pace, basket value, controls, and drawer position across the team." aside={perf.length ? `${perf.length} active` : undefined} />

      {perf.length === 0 ? (
        <div className="manager-empty-state"><Users size={22} /><div><p className="font-bold">No cashier activity</p><p className="mt-0.5 text-xs text-[var(--color-ink-dim)]">No shifts or sales were recorded on this date.</p></div></div>
      ) : (
        <>
          {best.net > 0 && (
            <div className="manager-insight-line">
              <TrendingUp size={16} />
              <p><b>{best.cashierName.split(' (')[0]}</b> leads the day with {fmt(best.net)} from {best.transactions} completed sales.</p>
            </div>
          )}

          <section aria-label="Cashier comparison" className="manager-data-surface">
            <div className="manager-cashier-head">
              <span>Cashier</span><span>Sales / items</span><span>Average basket</span><span>Cash taken</span><span>Net sales</span><span aria-hidden="true" />
            </div>
            {perf.map((p, index) => {
              const open = expanded === p.cashierId;
              return (
                <div key={p.cashierId} className="manager-data-record">
                  <button onClick={() => setExpanded(open ? null : p.cashierId)} className="manager-cashier-summary" aria-expanded={open}>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="manager-rank">{index + 1}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{p.cashierName.split(' (')[0]}</span>
                        <span className="block text-[11px] text-[var(--color-ink-dim)]">{p.hours >= 1 ? `${p.hours.toFixed(1)} hours worked` : p.hours > 0 ? 'Less than 1 hour worked' : 'No shift hours'}{p.openShifts > 0 ? ' / shift open' : ''}</span>
                      </span>
                    </span>
                    <MetricCell label="Sales / items" value={`${p.transactions} / ${p.itemsSold}`} />
                    <MetricCell label="Average basket" value={fmt(p.avgBasket)} />
                    <MetricCell label="Cash taken" value={fmt(p.cashTaken)} />
                    <MetricCell label="Net sales" value={fmt(p.net)} strong />
                    <span className="manager-row-chevron">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                  </button>

                  {p.flags.length > 0 && (
                    <div className="manager-flag-line">
                      {p.flags.map((f, i) => <span key={i} className={f.level === 'high' ? 'text-[var(--color-danger)]' : 'text-[var(--color-warn)]'}><AlertTriangle size={12} />{f.text}</span>)}
                    </div>
                  )}

                  {open && (
                    <div className="manager-expanded-grid">
                      <div>
                        <p className="manager-section-label">Sales controls</p>
                        <div className="mt-3 space-y-2.5">
                          <Row icon={Receipt} label="Gross sales" value={fmt(p.gross)} />
                          <Row icon={RotateCcw} label={`Refunds (${p.refundCount})`} value={p.refunds > 0 ? `-${fmt(p.refunds)}` : fmt(0)} tone={p.refunds > 0 ? 'bad' : undefined} />
                          <Row icon={Percent} label="Discounts given" value={fmt(p.discountGiven)} tone={p.discountGiven > 0 ? 'warn' : undefined} />
                          <Row icon={Scale} label="Drawer variance" value={p.openShifts > 0 ? 'Pending close' : p.variance === 0 ? 'Balanced' : `${p.variance > 0 ? '+' : '-'}${fmt(Math.abs(p.variance))}`} tone={p.openShifts > 0 ? 'warn' : p.variance === 0 ? 'good' : p.variance < 0 ? 'bad' : 'warn'} />
                        </div>
                      </div>
                      <div>
                        <p className="manager-section-label">Payment mix</p>
                        {p.byMethod.length > 0 ? <div className="mt-3 divide-y divide-[var(--color-line)]">{p.byMethod.map((m) => <div key={m.method} className="flex justify-between py-2 text-xs"><span className="text-[var(--color-ink-dim)]">{m.method}</span><span className="font-bold">{fmt(m.amount)}</span></div>)}</div> : <p className="mt-3 text-xs text-[var(--color-ink-dim)]">No payments recorded.</p>}
                        <div className="mt-4 border-t border-[var(--color-line)] pt-3"><Row icon={Clock} label="Sales per hour" value={p.hours >= .25 ? fmt(p.salesPerHour) : 'Too early to compare'} /></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}

/* ─────────── Transaction journal ─────────── */
const syncChip = (s: PosSale) => {
  if (s.syncState === 'synced') return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-brand)]"><Cloud size={12} /> Synced</span>;
  if (s.syncState === 'syncing') return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400"><Loader2 size={12} className="animate-spin" /> Syncing</span>;
  if (s.syncState === 'failed') return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-danger)]"><CloudOff size={12} /> Retrying</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-warn)]"><CloudOff size={12} /> Queued</span>;
};

function TransactionsTab({
  txns, cashiers, expanded, setExpanded,
}: { txns: PosSale[]; cashiers: Cashier[]; expanded: string | null; setExpanded: (v: string | null) => void }) {
  const [q, setQ] = useState('');
  const [who, setWho] = useState('all');
  const [kind, setKind] = useState<'all' | 'sales' | 'reversals'>('all');

  const list = txns
    .filter((t) => who === 'all' || t.cashierId === who)
    .filter((t) => kind === 'all' || (kind === 'sales' ? !t.reversalOf : !!t.reversalOf))
    .filter((t) => !q || t.id.toLowerCase().includes(q.toLowerCase())
      || (t.customerName || '').toLowerCase().includes(q.toLowerCase())
      || t.lines.some((l) => l.name.toLowerCase().includes(q.toLowerCase())));

  const gross = list.filter((t) => !t.reversalOf).reduce((a, t) => a + t.total, 0);

  return (
    <div className="manager-module mx-auto max-w-5xl">
      <ModuleHeader title="Transaction journal" description="Trace each sale from till to payment and CRM sync." aside={`${txns.length} record${txns.length === 1 ? '' : 's'}`} />

      <div className="manager-toolbar">
        <label className="manager-search-field">
          <span className="manager-section-label">Search transactions</span>
          <span className="relative mt-1.5 block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-dim)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Receipt, customer, or product"
              className="manager-control h-11 w-full pl-9 pr-3 text-sm outline-none" />
          </span>
        </label>
        <label className="min-w-[170px]">
          <span className="manager-section-label">Cashier</span>
          <select value={who} onChange={(e) => setWho(e.target.value)} className="manager-control mt-1.5 h-11 w-full px-3 text-xs outline-none">
            <option value="all">All cashiers</option>
            {cashiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div>
          <span className="manager-section-label">Entry type</span>
          <div className="manager-segmented mt-1.5" aria-label="Filter by entry type">
            {(['all', 'sales', 'reversals'] as const).map((k) => <button key={k} onClick={() => setKind(k)} data-active={kind === k}>{k === 'all' ? 'All' : k === 'sales' ? 'Sales' : 'Refunds'}</button>)}
          </div>
        </div>
      </div>

      <div className="manager-result-line"><span>{list.length} transaction{list.length !== 1 ? 's' : ''} shown</span><span>Gross value <b>{fmt(gross)}</b></span></div>

      {list.length === 0 ? (
        <div className="manager-empty-state"><Receipt size={22} /><div><p className="font-bold">No matching transactions</p><p className="mt-0.5 text-xs text-[var(--color-ink-dim)]">Try a different search term or broaden the filters.</p></div></div>
      ) : (
        <section aria-label="Transactions" className="manager-data-surface">
          <div className="manager-journal-head"><span>Time and receipt</span><span>Cashier and customer</span><span>Payment and sync</span><span>Total</span><span aria-hidden="true" /></div>
          {list.map((t) => {
            const open = expanded === t.id;
            const reversed = !!t.reversalOf;
            return (
              <div key={t.id} className={`manager-data-record ${reversed ? 'manager-record-alert' : ''}`}>
                <button onClick={() => setExpanded(open ? null : t.id)} className="manager-journal-row" aria-expanded={open}>
                  <span>
                    <span className="block text-sm font-black">{new Date(t.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="block truncate text-[10px] text-[var(--color-ink-dim)]">#{t.id}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">{t.cashierName.split(' (')[0]}</span>
                    <span className="block truncate text-[11px] text-[var(--color-ink-dim)]">{t.customerName || 'Walk-in customer'} / {t.lines.length} line{t.lines.length !== 1 ? 's' : ''}</span>
                  </span>
                  <span>
                    {syncChip(t)}
                    <span className="mt-1 block text-[10px] text-[var(--color-ink-dim)]">{t.payments.map((p) => p.method).join(' + ')}</span>
                  </span>
                  <span className={`manager-number text-sm font-black ${reversed ? 'text-[var(--color-danger)]' : ''}`}>{reversed ? '-' : ''}{fmt(Math.abs(t.total))}<span className="mt-0.5 block text-[10px] font-bold text-[var(--color-ink-dim)]">{reversed ? t.status : 'Completed'}</span><span className="manager-mobile-sync">{syncChip(t)}</span></span>
                  <span className="manager-row-chevron">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                </button>

                {open && (
                  <div className="manager-expanded-grid">
                    <div>
                      <p className="manager-section-label">Basket</p>
                      <div className="mt-2 divide-y divide-[var(--color-line)]">{t.lines.map((l, i) => <div key={i} className="flex justify-between gap-4 py-2 text-xs"><span className="min-w-0 truncate">{l.qty} {l.unit} x {l.name}{l.discount ? ` (-${fmt(l.discount)})` : ''}</span><span className="shrink-0 font-bold">{fmt(l.lineTotal)}</span></div>)}</div>
                    </div>
                    <div>
                      <p className="manager-section-label">Payment detail</p>
                      <div className="mt-2 space-y-2 text-xs">
                        <Line label="Subtotal" value={fmt(t.subtotal)} />
                        {t.discount !== 0 && <Line label="Discount" value={`-${fmt(Math.abs(t.discount))}`} />}
                        <Line label="Total" value={fmt(t.total)} strong />
                        {t.payments.map((p, i) => <Line key={i} label={`Paid by ${p.method}`} value={fmt(p.amount)} />)}
                        {t.change > 0 && <Line label="Change" value={fmt(t.change)} />}
                      </div>
                      {reversed && t.refundedBy && <p className="mt-3 flex items-start gap-1.5 text-[11px] text-[var(--color-danger)]"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{t.status} by {t.refundedBy}{t.refundReason ? `: ${t.refundReason}` : ''}</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

/* ─────────── Closing stock ─────────── */
function StockTab({ stock, day, onSaveCount }: { stock: ClosingInventory; day: string; onSaveCount: (day: string, c: Record<string, number>) => void }) {
  const [counting, setCounting] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [onlyMoved, setOnlyMoved] = useState(true);

  const rows = onlyMoved ? stock.movedRows : stock.rows;

  const save = () => {
    const counts: Record<string, number> = Object.fromEntries(stock.rows.filter((r) => r.counted != null).map((r) => [r.productId, r.counted!]));
    Object.entries(draft).forEach(([id, v]) => { if (v === '') delete counts[id]; else counts[id] = Number(v); });
    onSaveCount(day, counts);
    setCounting(false);
    setDraft({});
  };

  return (
    <div className="manager-module mx-auto max-w-5xl">
      <ModuleHeader title="Closing stock" description="Count the shelf, compare with expected stock, and surface shrinkage before close."
        aside={counting ? 'Count in progress' : stock.fullyCounted ? 'Count complete' : `${stock.countedProducts} of ${stock.rows.length} counted`} />

      <section aria-label="Inventory summary" className="manager-metric-strip">
        <div className="manager-metric-primary"><span className="manager-label">Closing stock value</span><strong>{fmt(stock.totalClosingValue)}</strong></div>
        <div><span className="manager-label">Units sold</span><strong>{stock.totalSoldUnits}</strong></div>
        <div><span className="manager-label">Count progress</span><strong>{stock.countedProducts}/{stock.rows.length}</strong></div>
      </section>

      {stock.countedProducts > 0 && (
        <div className={`manager-status-line ${stock.discrepancies.length === 0 ? 'manager-status-good' : 'manager-status-bad'}`}>
          {stock.discrepancies.length === 0
            ? <CheckCircle2 size={16} />
            : <AlertTriangle size={16} />}
          <div>
            {stock.discrepancies.length === 0
              ? <p><b>Counted stock matches.</b> {stock.countedProducts} product{stock.countedProducts === 1 ? '' : 's'} checked with no discrepancy.</p>
              : <p><b>{stock.discrepancies.length} discrepanc{stock.discrepancies.length === 1 ? 'y' : 'ies'}.</b> {stock.totalVarianceUnits > 0 ? '+' : ''}{stock.totalVarianceUnits} units ({stock.totalVarianceValue < 0 ? '-' : ''}{fmt(Math.abs(stock.totalVarianceValue))} at cost).</p>}
          </div>
        </div>
      )}

      <div className="manager-action-bar">
        <div className="manager-segmented" aria-label="Filter stock rows">
          <button onClick={() => setOnlyMoved(true)} data-active={onlyMoved}>Moved today</button>
          <button onClick={() => setOnlyMoved(false)} data-active={!onlyMoved}>All products</button>
        </div>
        {counting
          ? <div className="flex gap-1.5">
              <button onClick={() => { setCounting(false); setDraft({}); }} className="manager-secondary-button">Cancel</button>
              <button onClick={save} className="manager-primary-button"><Save size={13} /> Save count</button>
            </div>
          : <button onClick={() => { setOnlyMoved(false); setCounting(true); }} className="manager-primary-button">Enter stock count</button>}
      </div>

      <section aria-label="Stock count sheet" className="manager-data-surface">
        <div className="manager-stock-head">
          <span>Product</span><span>Opening</span><span>Sold</span><span>Expected close</span><span>{counting ? 'Physical count' : 'Variance'}</span>
        </div>
        {rows.map((r) => (
          <div key={r.productId} className="manager-stock-row">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{r.name}</p>
              <p className="text-[10px] text-[var(--color-ink-dim)]">{r.unit} / {fmt(r.closingValue)}{r.returned > 0 ? ` / ${r.returned} returned` : ''}</p>
            </div>
            <MetricCell label="Opening" value={String(r.opening)} />
            <MetricCell label="Sold" value={String(r.sold || 0)} />
            <MetricCell label="Expected close" value={String(r.expectedClosing)} strong />
            <span className="manager-stock-count">
              <span className="manager-mobile-label">{counting ? 'Physical count' : 'Variance'}</span>
                {counting ? (
                  <input value={draft[r.productId] ?? (r.counted != null ? String(r.counted) : '')}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.productId]: e.target.value.replace(/\D/g, '') }))}
                    inputMode="numeric" placeholder="0" aria-label={`Physical count for ${r.name}`}
                    className="manager-control h-9 w-20 px-2 text-right text-xs font-bold outline-none" />
                ) : r.variance == null ? (
                  <span className="text-xs text-[var(--color-ink-dim)]">Pending</span>
                ) : (
                  <span className={`text-xs font-black ${r.variance === 0 ? 'text-[var(--color-brand)]' : 'text-[var(--color-danger)]'}`}>
                    {r.variance === 0 ? 'Matches' : r.variance > 0 ? `+${r.variance}` : r.variance}
                  </span>
                )}
            </span>
          </div>
        ))}
        {rows.length === 0 && <div className="manager-empty-state border-0"><Boxes size={21} /><p className="text-sm text-[var(--color-ink-dim)]">No stock moved on this date. Switch to all products to count the full store.</p></div>}
      </section>
      <p className="manager-footnote">
        Opening stock is derived from the live balance: <b>opening = closing + sold - returned</b>. A physical count reveals any shrinkage.
      </p>
    </div>
  );
}

/* ─────────── Day reconciliation ─────────── */
function ReconcileTab({ recon, stock }: { recon: DayReconciliation; stock: ClosingInventory }) {
  const cashCountComplete = recon.shifts.length > 0 && recon.shifts.every((r) => r.reconciled);
  const drawerExceptions = recon.shifts.filter((r) => r.reconciled && r.variance !== 0).length;
  const everyDrawerBalanced = cashCountComplete && drawerExceptions === 0;
  const varTone = !cashCountComplete || drawerExceptions > 0 ? 'warn' : recon.totalVariance === 0 ? 'good' : recon.totalVariance < 0 ? 'bad' : 'warn';
  const checks = [
    { label: 'All shifts closed', detail: recon.openShifts === 0 ? `${recon.shifts.length} shifts recorded` : `${recon.openShifts} still open`, done: recon.openShifts === 0 && recon.shifts.length > 0 },
    { label: 'CRM records synced', detail: recon.unsynced === 0 ? 'No queued updates' : `${recon.unsynced} waiting to sync`, done: recon.unsynced === 0 },
    { label: 'Cash drawers balanced', detail: recon.shifts.length === 0 ? 'No drawer counts recorded' : !cashCountComplete ? 'Close and count every drawer' : drawerExceptions > 0 ? `${drawerExceptions} drawer${drawerExceptions === 1 ? '' : 's'} out of balance` : 'Every drawer count matches', done: everyDrawerBalanced },
    { label: 'Closing stock counted', detail: stock.fullyCounted ? `${stock.rows.length} products checked` : `${stock.countedProducts} of ${stock.rows.length} checked`, done: stock.fullyCounted },
    { label: 'Stock count matches', detail: stock.countedProducts === 0 ? 'Enter a physical count' : stock.discrepancies.length === 0 ? 'No discrepancies found' : `${stock.discrepancies.length} product${stock.discrepancies.length === 1 ? '' : 's'} need review`, done: stock.fullyCounted && stock.discrepancies.length === 0 },
  ];
  const complete = checks.filter((item) => item.done).length;
  return (
    <div className="manager-module mx-auto max-w-5xl">
      <ModuleHeader title="Day reconciliation" description="A single sign-off view for trading, cash, CRM sync, and closing inventory." aside={`${complete} of ${checks.length} checks complete`} />

      <div className={`manager-status-line ${complete === checks.length ? 'manager-status-good' : 'manager-status-warn'}`}>
        {complete === checks.length ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
        <div><p className="font-bold">{complete === checks.length ? 'The day is ready to close' : `${checks.length - complete} close check${checks.length - complete === 1 ? '' : 's'} need attention`}</p><p className="mt-0.5 text-[11px] opacity-80">Resolve outstanding items before signing off the trading day.</p></div>
      </div>

      <div className="manager-reconcile-grid">
        <section className="manager-reconcile-cash">
          <div className="flex items-start justify-between gap-4">
            <div><p className="manager-section-label">Cash position</p><h2 className="mt-1 text-lg font-black">Expected against counted</h2></div>
            <span className={`manager-balance-state ${varTone === 'good' ? 'manager-balance-good' : varTone === 'bad' ? 'manager-balance-bad' : 'manager-balance-warn'}`}>{!cashCountComplete ? 'Awaiting count' : drawerExceptions > 0 ? 'Review shifts' : recon.totalVariance === 0 ? 'Balanced' : recon.totalVariance > 0 ? 'Over' : 'Short'}</span>
          </div>
          <div className="manager-cash-hero">
            <div><span>Expected</span><strong>{fmt(recon.totalExpected)}</strong></div>
            <div><span>Counted</span><strong>{fmt(recon.totalCounted)}</strong></div>
            <div className={varTone === 'good' ? 'text-[var(--color-brand)]' : varTone === 'bad' ? 'text-[var(--color-danger)]' : 'text-[var(--color-warn)]'}><span>Variance</span><strong>{!cashCountComplete ? 'Pending' : recon.totalVariance === 0 ? fmt(0) : `${recon.totalVariance > 0 ? '+' : '-'}${fmt(Math.abs(recon.totalVariance))}`}</strong></div>
          </div>
          <div className="manager-cash-equation">
            <Line label="Opening floats" value={fmt(recon.totalFloat)} />
            <Line label="Cash sales" value={fmt(recon.totalCashSales)} />
            {recon.totalCashRefunds > 0 && <Line label="Less cash refunds" value={`-${fmt(recon.totalCashRefunds)}`} />}
            {recon.totalCashDrops > 0 && <Line label="Less cash drops" value={`-${fmt(recon.totalCashDrops)}`} />}
          </div>
        </section>

        <section className="manager-close-checks">
          <p className="manager-section-label">Close checklist</p>
          <div className="mt-3 divide-y divide-[var(--color-line)]">
            {checks.map((item) => <div key={item.label} className="manager-check-row">{item.done ? <CheckCircle2 size={17} className="text-[var(--color-brand)]" /> : <AlertTriangle size={17} className="text-[var(--color-warn)]" />}<div><p className="text-xs font-bold">{item.label}</p><p className="mt-0.5 text-[10px] text-[var(--color-ink-dim)]">{item.detail}</p></div></div>)}
          </div>
        </section>
      </div>

      <div className="manager-trading-grid">
        <section>
          <p className="manager-section-label">Trading summary</p>
          <div className="manager-trading-numbers"><div><span>Gross sales</span><strong>{fmt(recon.gross)}</strong><small>{recon.transactions} transactions</small></div><div><span>Refunds</span><strong>{recon.refunds > 0 ? `-${fmt(recon.refunds)}` : fmt(0)}</strong><small>Returned value</small></div><div><span>Net sales</span><strong>{fmt(recon.net)}</strong><small>After refunds</small></div></div>
          {recon.byMethod.length > 0 && <div className="mt-4 border-t border-[var(--color-line)] pt-2">{recon.byMethod.map((m) => <div key={m.method} className="flex justify-between py-1.5 text-xs"><span className="text-[var(--color-ink-dim)]">{m.method}</span><span className="font-bold">{fmt(m.amount)}</span></div>)}</div>}
        </section>
        <section>
          <p className="manager-section-label">Closing stock</p>
          <div className="mt-3 space-y-2.5 text-xs"><Line label="Units sold" value={String(stock.totalSoldUnits)} /><Line label="Stock value at cost" value={fmt(stock.totalClosingValue)} strong /><Line label="Products counted" value={`${stock.countedProducts} of ${stock.rows.length}`} /><Line label="Count variance" value={stock.countedProducts === 0 ? 'Not counted' : stock.discrepancies.length === 0 ? 'Matches' : `${stock.discrepancies.length} discrepancies`} /></div>
        </section>
      </div>

      {recon.shifts.length > 0 && (
        <section className="manager-shift-list">
          <div className="manager-shift-head"><div><p className="manager-section-label">Shift reconciliation</p><p className="mt-1 text-xs text-[var(--color-ink-dim)]">Each till must be closed and counted.</p></div><span>{recon.shifts.length} shift{recon.shifts.length === 1 ? '' : 's'}</span></div>
          <div>
            {recon.shifts.map((r) => (
              <div key={r.shift.id} className="manager-shift-row">
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{r.shift.cashierName}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--color-ink-dim)]">
                    <Clock size={9} />
                    {new Date(r.shift.openedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    {r.shift.closedAt ? ` to ${new Date(r.shift.closedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}` : ' / open'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {r.reconciled ? (
                    <>
                      <p className={`text-xs font-black ${r.variance === 0 ? 'text-[var(--color-brand)]' : (r.variance || 0) < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-warn)]'}`}>
                        {r.variance === 0 ? 'Balanced' : `${(r.variance || 0) > 0 ? '+' : '-'}${fmt(Math.abs(r.variance || 0))}`}
                      </p>
                      <p className="text-[10px] text-[var(--color-ink-dim)]">expected {fmt(r.expected)} / counted {fmt(r.counted || 0)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-[var(--color-warn)]">Not reconciled</p>
                      <p className="text-[10px] text-[var(--color-ink-dim)]">expected {fmt(r.expected)}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {recon.shifts.length === 0 && <div className="manager-empty-state"><Scale size={22} /><div><p className="font-bold">No shifts to reconcile</p><p className="mt-0.5 text-xs text-[var(--color-ink-dim)]">There was no till activity on this date.</p></div></div>}
    </div>
  );
}

/* ─────────── bits ─────────── */
function ModuleHeader({ title, description, aside }: { title: string; description: string; aside?: string }) {
  return (
    <div className="manager-module-header">
      <div><h1>{title}</h1><p>{description}</p></div>
      {aside && <span>{aside}</span>}
    </div>
  );
}
function MetricCell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <span className="manager-metric-cell"><span className="manager-mobile-label">{label}</span><span className={strong ? 'font-black' : 'font-bold'}>{value}</span></span>;
}
function Row({ icon: Icon, label, value, tone }: { icon: typeof Receipt; label: string; value: string; tone?: 'good' | 'bad' | 'warn' }) {
  const c = tone === 'good' ? 'text-[var(--color-brand)]' : tone === 'bad' ? 'text-[var(--color-danger)]' : tone === 'warn' ? 'text-[var(--color-warn)]' : '';
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="inline-flex items-center gap-1.5 text-[var(--color-ink-dim)]"><Icon size={12} /> {label}</span>
      <span className={`font-bold ${c}`}>{value}</span>
    </div>
  );
}
function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? 'font-black' : ''}`}><span className={strong ? '' : 'text-[var(--color-ink-dim)]'}>{label}</span><span>{value}</span></div>;
}
