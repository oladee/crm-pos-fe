'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search, Plus, Minus, Trash2, Wifi, WifiOff, LogOut,
  ShoppingCart, UserPlus, Receipt as ReceiptIcon,
  Loader2, User, FileText, PauseCircle, PlayCircle, ShieldCheck, LifeBuoy,
  Settings as Cog, Menu, ChevronRight, Clock, Check, Smartphone,
} from 'lucide-react';
import { PosProduct, PosCustomer, PosSale, PosPayment, HeldSale, IssueType } from '@/lib/types';
import { recordSale, saveHeld, deleteHeld, saveAssist, replaceCatalog } from '@/lib/db';
import { flushOutbox } from '@/lib/sync';
import { CartLine, computeTotals, cartCount, lineKey, lineTotal, toSaleLines, newSaleId, changeDue, pctToAmount, maxDiscountPctInCart } from '@/lib/cart';
import { fetchCatalog, quoteSale, startPosTransfer, listPosTransfers, refreshPosTransfer, cancelPosTransfer, confirmPosTransferReceived, submitPosSale, type PosTransfer } from '@/lib/remote';
import { buildReport, ShiftReport } from '@/lib/shift';
import { fmt } from '@/lib/money';
import { Receipt } from '@/components/receipt';
import { ReportModal, PinGate } from '@/components/shift-panels';
import { RequestHelpModal, MyRequests } from '@/components/assist-panels';
import { PaymentModal } from '@/components/payment-modal';
import { TransferPanel, TransferQueue, saleFromTransfer } from '@/components/transfer-panel';
import { DiscountModal } from '@/components/discount-modal';
import { HeldModal } from '@/components/held-modal';
import { CustomerModal } from '@/components/customer-modal';
import { BatchPicker } from '@/components/batch-picker';
import { RequireShift } from '@/components/route-guards';
import { SellSkeleton } from '@/components/skeletons';
import { useTill } from '@/contexts/till-context';
import { newAssistId, openCount } from '@/lib/assist';
import { can, canFully, roleLabel } from '@/lib/permissions';
import { SalesOsBrand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-provider';

export default function SellPage() {
  return (
    <RequireShift skeleton={<SellSkeleton />}>
      <SellScreen />
    </RequireShift>
  );
}

function SellScreen() {
  const router = useRouter();
  const {
    store, catalog, setCatalog, customers, cashiers, cashier, shift, sales, held, assists,
    online, pending, syncing, todayCount, refreshSyncState,
    logout, closeShift, setActingSupervisor, manualSync, copyPayloadForCrm,
  } = useTill();

  const refreshAvailability = useCallback(async () => {
    const hubId = store?.hubId || store?.storeId;
    if (!online || !hubId || !store?.deviceId) return;
    try {
      const items = await fetchCatalog(hubId, store.deviceId);
      await replaceCatalog(items); setCatalog(items);
    } catch { /* Cached quantities are advisory; checkout still requires server validation. */ }
  }, [online, store?.hubId, store?.storeId, store?.deviceId, setCatalog]);
  useEffect(() => {
    void refreshAvailability();
    const timer = window.setInterval(() => void refreshAvailability(), 30_000);
    window.addEventListener('focus', refreshAvailability);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshAvailability); };
  }, [refreshAvailability]);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [discountFor, setDiscountFor] = useState<string | 'cart' | null>(null);
  const [discountApproved, setDiscountApproved] = useState(false);
  const [discountGate, setDiscountGate] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [lastSale, setLastSale] = useState<PosSale | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showMyRequests, setShowMyRequests] = useState(false);
  const [report, setReport] = useState<{ data: ShiftReport; kind: 'X' | 'Z' } | null>(null);
  const [showHeld, setShowHeld] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');
  const [picking, setPicking] = useState<PosProduct | null>(null);
  const [quote, setQuote] = useState<{ subtotal: number; discount: number; tax: number; total: number } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [transfers, setTransfers] = useState<PosTransfer[]>([]);
  const [activeTransfer, setActiveTransfer] = useState<PosTransfer | null>(null);
  const [showTransfers, setShowTransfers] = useState(false);
  const [checkingTransfer, setCheckingTransfer] = useState(false);

  const categories = useMemo(() => ['All', ...Array.from(new Set(catalog.map((p) => p.category)))], [catalog]);
  const visible = useMemo(() => catalog.filter((p) =>
    p.isActive
    && (category === 'All' || p.category === category)
    && (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  ), [catalog, category, search]);

  const totals = computeTotals(lines, {
    orderDiscount, taxRatePct: store?.taxRatePct, taxInclusive: store?.taxInclusive,
  });
  const payable = online && quote ? quote : totals;
  const { subtotal, discount, tax, total } = payable;

  useEffect(() => {
    if (!online || !lines.length || !store?.deviceId) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    const hubId = store.hubId || store.storeId;
    if (!hubId) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const handle = setTimeout(() => {
      void quoteSale({
        hubId,
        deviceId: store.deviceId,
        orderDiscount,
        lines: lines.map((l) => ({
          productId: l.product.id,
          batchNumber: l.batchNumber,
          saleUnit: l.saleUnit,
          qty: l.qty,
          discount: l.discount,
        })),
      }).then((next) => {
        if (!cancelled) setQuote(next);
      }).catch(() => {
        if (!cancelled) setQuote(null);
      }).finally(() => {
        if (!cancelled) setQuoting(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [lines, orderDiscount, online, store?.deviceId, store?.hubId, store?.storeId]);
  const cartDiscountPct = maxDiscountPctInCart(lines, orderDiscount);
  const needsDiscountApproval = store ? cartDiscountPct > store.discountApprovalThresholdPct : false;
  const waitingAssists = openCount(assists);
  const myOpen = assists.filter((a) => a.cashierId === cashier?.id && (a.status === 'open' || a.status === 'in_progress')).length;
  const myResolved = assists.filter((a) => a.cashierId === cashier?.id && a.status === 'resolved').length;

  const addBatchLine = (p: PosProduct, choice: { batchNumber: string; saleUnit: string; unitPrice: number }) => {
    setLines((cur) => {
      const key = lineKey({ product: p, batchNumber: choice.batchNumber, saleUnit: choice.saleUnit });
      const i = cur.findIndex((l) => lineKey(l) === key);
      if (i >= 0) { const n = [...cur]; n[i] = { ...n[i], qty: n[i].qty + 1, unitPrice: choice.unitPrice }; return n; }
      return [...cur, { product: p, qty: 1, discount: 0, ...choice }];
    });
    setPicking(null);
    setMobileView('cart');
  };
  const setQty = (key: string, qty: number) =>
    setLines((cur) => qty <= 0 ? cur.filter((l) => lineKey(l) !== key) : cur.map((l) => lineKey(l) === key ? { ...l, qty } : l));
  const removeLine = (key: string) => setLines((cur) => cur.filter((l) => lineKey(l) !== key));
  const clearCart = () => { setLines([]); setCustomer(null); setOrderDiscount(0); setDiscountApproved(false); };

  const applyDiscount = (targetId: string | 'cart', amount: number) => {
    const cap = store?.maxDiscountPct ?? 100;
    if (targetId === 'cart') {
      const base = lines.reduce((s2, l) => s2 + lineTotal(l), 0);
      setOrderDiscount(Math.min(Math.max(0, amount), pctToAmount(base, cap)));
    } else {
      setLines((cur) => cur.map((l) => {
        if (lineKey(l) !== targetId) return l;
        const base = (l.unitPrice || l.product.price) * l.qty;
        return { ...l, discount: Math.min(Math.max(0, amount), pctToAmount(base, cap)) };
      }));
    }
    setDiscountApproved(false);
    setDiscountFor(null);
  };

  const startCheckout = () => {
    if (needsDiscountApproval && !discountApproved) { setDiscountGate(true); return; }
    setShowPay(true);
  };
  const authoriseDiscount = (pin: string) => {
    const sup = cashiers.find((c) => c.pin === pin && c.isActive && canFully(c.role, 'discount.approve'));
    if (!sup) { toast.error('That PIN cannot approve discounts'); return; }
    setDiscountApproved(true);
    setDiscountGate(false);
    setShowPay(true);
    toast.success(`Discount authorised by ${sup.name.split(' (')[0]}`);
  };

  const rememberTransfer = (transfer: PosTransfer) => {
    setTransfers((current) => {
      const next = [transfer, ...current.filter((row) => row.clientSaleId !== transfer.clientSaleId)];
      return next;
    });
  };

  const settleTransfer = async (transfer: PosTransfer) => {
    if (transfer.status !== 'paid') {
      rememberTransfer(transfer);
      setActiveTransfer((current) => current?.clientSaleId === transfer.clientSaleId ? transfer : current);
      return;
    }
    const sale = saleFromTransfer(transfer);
    if (sale && !sales.some((row) => row.id === sale.id)) {
      const recorded = { ...sale, payments: [{ method: 'Transfer' as const, amount: transfer.cartTotalKobo, reference: transfer.checkoutId }], syncState: 'synced' as const };
      await recordSale(recorded);
      await refreshSyncState();
      void flushOutbox().then(refreshSyncState);
    }
    setTransfers((current) => current.filter((row) => row.clientSaleId !== transfer.clientSaleId));
    setActiveTransfer(null);
    await refreshAvailability();
    toast.success('Transfer received');
  };

  const startTransfer = async (provider: 'bachs' | 'squad') => {
    if (!store || !cashier || !online) return;
    const hubId = store.hubId || store.storeId;
    if (!hubId) { toast.error('This till has no location yet'); return; }
    const attemptKey = 'pos.transferAttempt.' + store.deviceId;
    let saved: { sale: PosSale; provider: 'bachs' | 'squad' } | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(attemptKey) || 'null'); } catch { /* Ignore a malformed local draft. */ }
    if (saved && (saved.provider !== provider || JSON.stringify(saved.sale.lines) !== JSON.stringify(toSaleLines(lines)))) {
      throw new Error('A previous transfer request has an unknown result. Check Transfers before starting a different payment. Retry the same cart and provider to recover it.');
    }
    const sale: PosSale = saved?.sale || {
      id: newSaleId(store.deviceId),
      deviceId: store.deviceId,
      storeId: hubId,
      hubId,
      cashierId: cashier.id,
      cashierName: cashier.name,
      lines: toSaleLines(lines),
      subtotal, discount, total,
      orderDiscount: orderDiscount || undefined,
      tax: tax || undefined,
      taxRatePct: store.taxRatePct || undefined,
      payments: [{ method: 'Transfer', amount: total }],
      change: 0,
      customerId: customer?.id,
      customerName: customer?.name,
      status: 'completed',
      createdAt: new Date().toISOString(),
      syncState: 'pending',
      shiftId: shift?.id,
    };
    sessionStorage.setItem(attemptKey, JSON.stringify({ sale, provider }));
    try {
      const transfer = await startPosTransfer({
        provider,
        clientSaleId: sale.id,
        hubId,
        deviceId: store.deviceId,
        cashierName: cashier.name,
        customerId: customer?.id,
        customerName: customer?.name,
        shiftId: shift?.id,
        orderDiscount,
        lines: sale.lines.map((line) => ({
          productId: line.productId,
          batchNumber: line.batchNumber,
          saleUnit: line.saleUnit,
          qty: line.qty,
          discount: line.discount,
        })),
        posSale: sale,
      });
      sessionStorage.removeItem(attemptKey);
      if (transfer.status === 'cancelled') throw new Error(transfer.reconciliationReason || 'Transfer could not be started. No stock is held.');
      clearCart();
      await refreshAvailability();
      rememberTransfer({ ...transfer, sale: { ...transfer.sale, posSale: sale } });
      setActiveTransfer({ ...transfer, sale: { ...transfer.sale, posSale: sale } });
      setShowPay(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start the transfer');
      throw err;
    }
  };

  const pullTransfer = async (transfer: PosTransfer, quiet: boolean) => {
    try {
      const next = await refreshPosTransfer(transfer.clientSaleId);
      const merged = { ...next, sale: next.sale?.posSale ? next.sale : transfer.sale };
      await settleTransfer(merged);
    } catch (err) {
      if (!quiet) toast.error(err instanceof Error ? err.message : 'Could not check this transfer');
    }
  };

  const checkTransfer = async (transfer: PosTransfer) => {
    setCheckingTransfer(true);
    try {
      await pullTransfer(transfer, false);
    } finally {
      setCheckingTransfer(false);
    }
  };

  const continueFromTransfer = () => {
    setActiveTransfer(null);
    setShowPay(false);
    toast.success('Next sale is ready. The transfer stays in Transfers.');
  };

  const cancelTransfer = async (transfer: PosTransfer) => {
    try {
      await cancelPosTransfer(transfer.clientSaleId);
      setTransfers((current) => current.filter((row) => row.clientSaleId !== transfer.clientSaleId));
      setActiveTransfer(null);
      await refreshAvailability();
      toast.success('Transfer cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel this transfer');
    }
  };

  useEffect(() => {
    if (!online || !store?.deviceId) return;
    let cancelled = false;
    void listPosTransfers(store.deviceId).then((rows) => {
      if (!cancelled) {
        setTransfers(rows);
        const attemptKey = 'pos.transferAttempt.' + store.deviceId;
        try {
          const attempt = JSON.parse(sessionStorage.getItem(attemptKey) || 'null');
          if (attempt && rows.some(row => row.clientSaleId === attempt.sale?.id)) sessionStorage.removeItem(attemptKey);
        } catch { /* A corrupt draft never changes server payment state. */ }
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [online, store?.deviceId]);

  useEffect(() => {
    const waiting = transfers.filter((transfer) => ['initializing', 'awaiting', 'expired', 'review'].includes(transfer.status));
    if (!online || waiting.length === 0) return;
    const handle = setInterval(() => {
      waiting.forEach((transfer) => { void pullTransfer(transfer, true); });
    }, 120_000);
    return () => clearInterval(handle);
  }, [online, transfers]);

  const completeSale = async (payments: PosPayment[]) => {
    if (!store || !cashier) return;
    if (!online) throw new Error('Connect to the internet to validate available stock.');
    const sale: PosSale = {
      id: newSaleId(store.deviceId),
      deviceId: store.deviceId,
      storeId: store.hubId || store.storeId || '',
      hubId: store.hubId || store.storeId,
      cashierId: cashier.id,
      cashierName: cashier.name,
      lines: toSaleLines(lines),
      subtotal, discount, total,
      orderDiscount: orderDiscount || undefined,
      tax: tax || undefined,
      taxRatePct: store.taxRatePct || undefined,
      payments,
      change: changeDue(payments, total),
      customerId: customer?.id,
      customerName: customer?.name,
      status: 'completed',
      createdAt: new Date().toISOString(),
      syncState: 'pending',
      shiftId: shift?.id,
    };
    await submitPosSale(sale as unknown as Record<string, unknown>);
    sale.syncState = 'synced';
    await recordSale(sale);
    setLastSale(sale);
    setShowPay(false);
    clearCart();
    await refreshSyncState();
    await refreshAvailability();
    toast.success(`Sale ${fmt(total)} recorded${navigator.onLine ? '' : ' — will sync when back online'}`);
    void flushOutbox().then(refreshSyncState);
  };

  const showReport = (kind: 'X' | 'Z') => {
    if (!shift) return;
    setReport({ data: buildReport(shift, sales), kind });
  };

  const raiseAssist = async (d: { type: IssueType; note: string; urgent: boolean; attachCart: boolean }) => {
    if (!cashier || !store) return;
    const req = {
      id: newAssistId(store.deviceId), deviceId: store.deviceId, hubId: store.hubId || store.storeId, shiftId: shift?.id,
      cashierId: cashier.id, cashierName: cashier.name,
      type: d.type, urgent: d.urgent, note: d.note,
      context: d.attachCart && lines.length > 0
        ? { cartTotal: total, cartLines: lines.map((l) => ({ name: l.product.name, qty: l.qty, unit: l.product.unit })) }
        : undefined,
      status: 'open' as const, createdAt: new Date().toISOString(), syncState: 'pending' as const,
    };
    await saveAssist(req);
    await refreshSyncState();
    setShowHelp(false);
    toast.success('Supervisor notified' + (d.urgent ? ' — marked urgent' : ''));
  };

  const openSupervisor = () => {
    if (canFully(cashier?.role, 'sale.viewAll') && cashier) {
      setActingSupervisor(cashier.name);
    }
    router.push('/supervisor');
  };

  const holdCart = async () => {
    if (!cashier || lines.length === 0) return;
    const h: HeldSale = {
      id: `hold-${Date.now().toString(36)}`,
      label: customer?.name || `${cartCount(lines)} items · ${fmt(total)}`,
      lines: lines.map((l) => ({ productId: l.product.id, qty: l.qty, discount: l.discount, batchNumber: l.batchNumber, saleUnit: l.saleUnit, unitPrice: l.unitPrice })),
      customerId: customer?.id, customerName: customer?.name,
      cashierId: cashier.id, createdAt: new Date().toISOString(),
    };
    await saveHeld(h);
    clearCart();
    await refreshSyncState();
    toast.success('Cart held');
  };

  const resumeCart = async (h: HeldSale) => {
    const restored: CartLine[] = h.lines
      .map((l) => {
        const p = catalog.find((x) => x.id === l.productId);
        if (!p || !l.batchNumber || !l.saleUnit) return null;
        const batch = p.batches?.find((b) => b.batchNumber === l.batchNumber);
        const unitPrice = l.unitPrice || (l.saleUnit === 'Carton' ? batch?.cartonPrice : batch?.unitPrice) || p.price;
        return { product: p, qty: l.qty, discount: l.discount, batchNumber: l.batchNumber, saleUnit: l.saleUnit, unitPrice };
      })
      .filter((x): x is CartLine => x !== null);
    setLines(restored);
    setCustomer(h.customerId ? customers.find((c) => c.id === h.customerId) || null : null);
    await deleteHeld(h.id);
    setShowHeld(false);
    await refreshSyncState();
    toast.success('Cart resumed');
  };

  if (!store || !cashier || !shift) return null;

  const MenuAction = ({ icon: Icon, label, onClick, badge, tone }: { icon: typeof Clock; label: string; onClick: () => void; badge?: number; tone?: 'warn' }) => (
    <button onClick={onClick} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold hover:bg-[var(--color-surface-2)] ${tone === 'warn' ? 'text-[var(--color-warn)]' : ''}`}>
      <Icon size={16} className="shrink-0" /><span className="flex-1 text-left">{label}</span>
      {!!badge && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-black">{badge}</span>}
      <ChevronRight size={14} className="text-[var(--color-ink-dim)]" />
    </button>
  );

  return (
    <div className="pos-shell flex h-[100dvh] flex-col bg-[var(--color-bg)]">
      <header className="pos-header relative z-30 flex shrink-0 items-center gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <SalesOsBrand compact />
          <span className="h-8 w-px shrink-0 bg-[var(--color-line)]" />
          <div className="min-w-0">
            <p className="max-w-32 truncate text-sm font-extrabold tracking-[-0.01em] sm:max-w-72">{store.storeName}</p>
            <p className="truncate text-xs text-[var(--color-ink-dim)]">{cashier.name.split(' (')[0]} <span className="mx-1 text-[var(--color-line-strong)]">/</span> Shift open</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={manualSync}
            className={`top-action inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-xs font-bold ${
              online ? 'border-[var(--color-line)] text-[var(--color-ink)]' : 'border-amber-500/40 bg-amber-500/10 text-[var(--color-warn)]'}`}>
            {syncing ? <Loader2 size={14} className="animate-spin" /> : online ? <Wifi size={14} className="text-[var(--color-brand)]" /> : <WifiOff size={14} />}
            <span>{online ? (pending > 0 ? 'Sync' : 'Online') : 'Offline'}</span>
            {pending > 0 && <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-black">{pending}</span>}
          </button>
          <button onClick={() => setShowTransfers(true)} title="Bank transfers waiting for payment"
            className="top-action relative inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-xs font-bold text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
            <Smartphone size={15} /><span className="hidden sm:inline">Transfers</span>
            {transfers.some((transfer) => ['initializing', 'awaiting', 'expired', 'review'].includes(transfer.status)) && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-black">
                {transfers.filter((transfer) => ['initializing', 'awaiting', 'expired', 'review'].includes(transfer.status)).length}
              </span>
            )}
          </button>
          <button onClick={() => setShowHelp(true)} title="Ask a supervisor for help"
            className="top-action relative inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-xs font-bold text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
            <LifeBuoy size={15} /><span className="hidden sm:inline">Help</span>
            {myOpen > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-black">{myOpen}</span>}
          </button>
          <button onClick={() => router.push('/history')} title="Sales and refunds"
            className="top-action hidden h-10 items-center gap-1.5 rounded-[10px] px-3 text-xs font-bold text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] sm:inline-flex">
            <ReceiptIcon size={15} /> Sales
          </button>
          <div className="hidden lg:block"><ThemeToggle compact /></div>
          <button onClick={() => setShowMore((v) => !v)} aria-label="More actions" aria-expanded={showMore} className="top-action inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-xs font-bold">
            <Menu size={16} /> <span className="hidden sm:inline">More</span>
          </button>
        </div>
        {showMore && (
          <div className="modal-shell absolute right-3 top-[4.2rem] z-50 w-72 space-y-1 rounded-[14px] p-2">
            <p className="px-3 py-2 text-xs text-[var(--color-ink-dim)]">{todayCount} sale{todayCount === 1 ? '' : 's'} today <span className="mx-1 text-[var(--color-line-strong)]">/</span> {roleLabel(cashier.role)}</p>
            <MenuAction icon={LifeBuoy} label="My help requests" onClick={() => { setShowMore(false); setShowMyRequests(true); }} badge={myOpen + myResolved} />
            <MenuAction icon={ShieldCheck} label="Manager dashboard" onClick={() => { setShowMore(false); openSupervisor(); }} badge={waitingAssists} />
            <MenuAction icon={ReceiptIcon} label="Sales and refunds" onClick={() => { setShowMore(false); router.push('/history'); }} />
            <MenuAction icon={FileText} label="Send updates to CRM" onClick={() => { setShowMore(false); void copyPayloadForCrm(); }} />
            <MenuAction icon={Clock} label="View shift totals" onClick={() => { setShowMore(false); showReport('X'); }} />
            <MenuAction icon={Check} label="Close my shift" onClick={() => { setShowMore(false); showReport('Z'); }} tone="warn" />
            {(can(cashier.role, 'settings.manage') || can(cashier.role, 'user.manage')) && (
              <MenuAction icon={Cog} label="POS settings" onClick={() => { setShowMore(false); router.push('/settings'); }} />
            )}
            <div className="flex items-center justify-between border-t border-[var(--color-line)] px-3 pt-2 text-xs font-bold text-[var(--color-ink-dim)]"><span>Appearance</span><ThemeToggle compact /></div>
            <MenuAction icon={LogOut} label="Sign out" onClick={() => { setShowMore(false); logout(); router.replace('/login'); }} />
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <section className={`catalog-pane min-w-0 flex-1 flex-col ${mobileView === 'products' ? 'flex' : 'hidden'} md:flex`}>
          <div className="flex items-end justify-between gap-3 px-4 pt-4 sm:px-5">
            <div>
              <h1 className="catalog-heading text-xl font-black sm:text-2xl">Choose products</h1>
              <p className="mt-0.5 text-sm text-[var(--color-ink-dim)]">Tap an item to add it to this sale.</p>
            </div>
            <span className="shrink-0 pb-1 text-xs text-[var(--color-ink-dim)]">{visible.length} products</span>
          </div>
          <div className="flex shrink-0 gap-2 px-4 pb-3 pt-4 sm:px-5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-dim)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or SKU…"
                className="search-control w-full rounded-[12px] pl-10 pr-3 text-sm outline-none" />
            </div>
          </div>
          <div className="category-strip flex shrink-0 gap-1 overflow-x-auto px-4 pb-3 sm:px-5">
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} data-active={category === c}
                className="category-chip whitespace-nowrap rounded-[10px] px-3.5 text-xs font-bold">
                {c}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-5 sm:px-5">
            <div className="product-grid grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {visible.map((p) => {
                const batches = (p.batches || []).filter((b) => b.quantityRemaining > 0);
                const low = batches.length === 0;
                return (
                  <button key={p.id} onClick={() => batches.length ? setPicking(p) : toast.error('This product has no open batch')}
                    className="product-card tap relative p-3.5 text-left sm:p-4">
                    <span className="product-add absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-[10px]"><Plus size={16} /></span>
                    <p className="line-clamp-2 min-h-[2.6rem] pr-10 text-sm font-extrabold leading-[1.25] tracking-[-0.01em] sm:text-[15px]">{p.name}</p>
                    <p className="mt-1.5 text-xs text-[var(--color-ink-dim)]">{batches.length ? `${batches.length} batch${batches.length === 1 ? '' : 'es'}` : 'No open batch'}</p>
                    <p className={`mt-2 text-lg font-black tracking-[-0.02em] ${low ? 'text-[var(--color-danger)]' : 'text-[var(--color-brand)]'}`}>{batches.length ? `from ${fmt(p.price)}` : '—'}</p>
                  </button>
                );
              })}
              {visible.length === 0 && <p className="col-span-full py-10 text-center text-sm text-[var(--color-ink-dim)]">No products match.</p>}
            </div>
          </div>
        </section>

        <aside className={`cart-panel w-full shrink-0 flex-col md:flex md:w-[360px] xl:w-[410px] ${mobileView === 'cart' ? 'flex' : 'hidden'}`}>
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3.5">
            <div className="flex items-center gap-2 text-base font-extrabold"><ShoppingCart size={18} /> Current sale <span className="text-xs font-semibold text-[var(--color-ink-dim)]">{cartCount(lines)} {cartCount(lines) === 1 ? 'item' : 'items'}</span></div>
            {lines.length > 0 && <button onClick={() => { if (window.confirm('Remove every item from this cart?')) clearCart(); }} className="text-xs font-bold text-[var(--color-danger)]">Remove all</button>}
          </div>

          <button onClick={() => setShowCustomers(true)}
            className="cart-customer mx-4 mt-4 flex items-center justify-between gap-2 rounded-[12px] px-3 text-xs font-extrabold">
            {customer ? <><span className="inline-flex min-w-0 items-center gap-2"><User size={16} className="shrink-0 text-[var(--color-brand)]" /><span className="truncate">{customer.name}</span></span><span className="text-[var(--color-brand)]">Change</span></> : <><span className="inline-flex items-center gap-2"><UserPlus size={16} className="text-[var(--color-brand)]" /> Add customer details</span><ChevronRight size={16} className="text-[var(--color-brand)]" /></>}
          </button>

          <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
            {lines.length === 0 && (
              <div className="px-6 py-16 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface-2)]"><ShoppingCart size={24} className="text-[var(--color-ink-dim)]" /></span>
                <p className="mt-4 text-base font-extrabold">No items yet</p>
                <p className="mt-1 text-sm leading-5 text-[var(--color-ink-dim)]">Choose a product to begin this sale.</p>
                <button onClick={() => setMobileView('products')} className="primary-action mt-5 h-11 rounded-[10px] px-5 text-sm font-black md:hidden">Choose products</button>
              </div>
            )}
            {lines.map((l) => {
              const key = lineKey(l);
              return (
              <div key={key} className="cart-line animate-pop p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold leading-tight">{l.product.name}</p>
                    <p className="mt-1 text-xs text-[var(--color-ink-dim)]">Batch {l.batchNumber} · {fmt(l.unitPrice)} / {l.saleUnit}</p>
                  </div>
                  <button onClick={() => removeLine(key)} aria-label={`Remove ${l.product.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[var(--color-ink-dim)] hover:bg-red-500/10 hover:text-[var(--color-danger)]"><Trash2 size={15} /></button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(key, l.qty - 1)} aria-label={`Reduce ${l.product.name} quantity`} className="grid h-9 w-9 place-items-center rounded-[9px] border border-[var(--color-line)] bg-[var(--color-surface)]"><Minus size={14} /></button>
                    <input value={l.qty} aria-label={`${l.product.name} quantity`} onChange={(e) => setQty(key, Math.max(0, Number(e.target.value) || 0))}
                      className="h-9 w-12 rounded-[9px] border border-[var(--color-line)] bg-[var(--color-surface)] text-center text-sm font-bold outline-none" />
                    <button onClick={() => setQty(key, l.qty + 1)} aria-label={`Increase ${l.product.name} quantity`} className="grid h-9 w-9 place-items-center rounded-[9px] border border-[var(--color-line)] bg-[var(--color-surface)]"><Plus size={14} /></button>
                  </div>
                  <div className="text-right">
                    <button onClick={() => setDiscountFor(key)}
                      className={`text-[10px] font-bold ${l.discount > 0 ? 'text-[var(--color-warn)]' : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'}`}>
                      {l.discount > 0 ? `−${fmt(l.discount)} off` : '+ Discount'}
                    </button>
                    <p className="text-sm font-black">{fmt(lineTotal(l))}</p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          <div className="cart-footer shrink-0 space-y-2.5 p-4">
            <div className="flex justify-between text-sm text-[var(--color-ink-dim)]"><span>Subtotal</span><span className="font-semibold text-[var(--color-ink)]">{fmt(subtotal)}</span></div>
            {totals.lineDiscount > 0 && <div className="flex justify-between text-xs text-[var(--color-warn)]"><span>Line discounts</span><span>−{fmt(totals.lineDiscount)}</span></div>}
            {totals.orderDiscount > 0 && <div className="flex justify-between text-xs text-[var(--color-warn)]"><span>Cart discount</span><span>−{fmt(totals.orderDiscount)}</span></div>}
            {lines.length > 0 && (
              <button onClick={() => setDiscountFor('cart')}
                className="w-full text-left text-[10px] font-bold text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
                {orderDiscount > 0 ? 'Edit cart discount' : '+ Cart discount'}
              </button>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-xs text-[var(--color-ink-dim)]">
                <span>{store.taxLabel || 'Tax'} {store.taxRatePct}%{store.taxInclusive ? ' (incl.)' : ''}</span>
                <span>{fmt(tax)}</span>
              </div>
            )}
            {needsDiscountApproval && (
              <p className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-warn)]">
                <ShieldCheck size={11} /> {Math.round(cartDiscountPct)}% discount needs supervisor approval
              </p>
            )}
            <div className="mt-2 flex items-end justify-between border-t border-[var(--color-line)] pt-3"><span className="pb-1 text-sm font-extrabold">Total</span><span className="text-3xl font-black tracking-[-0.04em] text-[var(--color-brand)]">{fmt(total)}</span></div>
            <div className="flex gap-2">
              <button disabled={lines.length === 0} onClick={holdCart}
                className="secondary-action inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-xs font-bold disabled:opacity-40">
                <PauseCircle size={14} /> Hold cart
              </button>
              <button onClick={() => setShowHeld(true)}
                className="secondary-action inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-xs font-bold">
                <PlayCircle size={14} /> Held carts {held.length > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-black">{held.length}</span>}
              </button>
            </div>
            <button disabled={lines.length === 0 || (online && (quoting || !quote))} onClick={startCheckout}
              className="primary-action h-14 w-full rounded-[11px] text-base font-black disabled:opacity-40">
              {online && quoting ? 'Checking price…' : online && lines.length > 0 && !quote ? 'Price check failed' : `Charge ${total > 0 ? fmt(total) : ''}`}
            </button>
          </div>
        </aside>
      </div>

      <nav className="mobile-switcher grid min-h-16 shrink-0 grid-cols-2 gap-2 border-t border-[var(--color-line)] p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] md:hidden">
        <button onClick={() => setMobileView('products')} className={`inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-black ${mobileView === 'products' ? 'bg-[var(--color-ink)] text-[var(--color-ink-inverse)]' : 'text-[var(--color-ink-dim)]'}`}><Search size={17} /> Products</button>
        <button onClick={() => setMobileView('cart')} className={`inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-black ${mobileView === 'cart' ? 'bg-[var(--color-ink)] text-[var(--color-ink-inverse)]' : 'text-[var(--color-ink-dim)]'}`}><ShoppingCart size={17} /> Cart <span className={`rounded-full px-2 py-0.5 text-[11px] ${mobileView === 'cart' ? 'bg-[var(--color-ink-inverse)]/10' : 'bg-[var(--color-surface-2)] text-[var(--color-ink)]'}`}>{cartCount(lines)}</span></button>
      </nav>

      {discountFor && (
        <DiscountModal
          label={discountFor === 'cart' ? 'Cart discount' : lines.find((l) => lineKey(l) === discountFor)?.product.name || ''}
          base={discountFor === 'cart' ? lines.reduce((a, l) => a + lineTotal(l), 0) : (() => { const l = lines.find((x) => lineKey(x) === discountFor); return l ? (l.unitPrice || l.product.price) * l.qty : 0; })()}
          current={discountFor === 'cart' ? orderDiscount : (lines.find((l) => lineKey(l) === discountFor)?.discount || 0)}
          maxPct={store.maxDiscountPct ?? 50}
          approvalPct={store.discountApprovalThresholdPct ?? 10}
          onClose={() => setDiscountFor(null)}
          onApply={(amt) => applyDiscount(discountFor, amt)} />
      )}
      {discountGate && (
        <PinGate title="Approve discount"
          note={`This cart carries a ${Math.round(cartDiscountPct)}% discount, above the ${store.discountApprovalThresholdPct}% limit. A supervisor must authorise it.`}
          onCancel={() => setDiscountGate(false)} onVerify={authoriseDiscount} />
      )}
      {showPay && (
        <PaymentModal
          total={total}
          online={online}
          onClose={() => setShowPay(false)}
          onConfirm={completeSale}
          hasCustomer={!!customer}
          onStartTransfer={startTransfer}
        />
      )}
      {activeTransfer && (
        <TransferPanel
          transfer={activeTransfer}
          busy={checkingTransfer}
          onConfirmReceived={async () => {
            setCheckingTransfer(true);
            try { await settleTransfer(await confirmPosTransferReceived(activeTransfer.clientSaleId)); }
            catch (error) { toast.error(error instanceof Error ? error.message : 'Could not confirm payment'); throw error; }
            finally { setCheckingTransfer(false); }
          }}
          onCheck={() => void checkTransfer(activeTransfer)}
          onContinue={continueFromTransfer}
          onCancel={() => void cancelTransfer(activeTransfer)}
          onClose={() => setActiveTransfer(null)}
        />
      )}
      {showTransfers && (
        <TransferQueue
          transfers={transfers}
          onClose={() => setShowTransfers(false)}
          onOpen={(transfer) => { setShowTransfers(false); setActiveTransfer(transfer); }}
        />
      )}
      {showCustomers && (
        <CustomerModal
          hubId={store.hubId || store.storeId}
          customers={customers}
          onPick={(c) => { setCustomer(c); setShowCustomers(false); }}
          onClear={() => { setCustomer(null); setShowCustomers(false); }}
          onClose={() => setShowCustomers(false)}
        />
      )}
      {picking && <BatchPicker product={picking} onClose={() => setPicking(null)} onAdd={(choice) => addBatchLine(picking, choice)} />}
      {lastSale && <Receipt sale={lastSale} store={store} onClose={() => setLastSale(null)} />}

      {report && (
        <ReportModal report={report.data} store={store} kind={report.kind}
          onClose={() => setReport(null)}
          onConfirmClose={async (counted) => {
            await closeShift(counted);
            setReport(null);
            router.replace('/login');
          }} />
      )}
      {showHeld && (
        <HeldModal
          held={held}
          onResume={resumeCart}
          onClose={() => setShowHeld(false)}
          onDiscard={async (id) => { await deleteHeld(id); await refreshSyncState(); toast.info('Held cart discarded'); }}
        />
      )}

      {showHelp && (
        <RequestHelpModal cartTotal={total}
          cartLines={lines.map((l) => ({ name: l.product.name, qty: l.qty, unit: l.product.unit }))}
          onClose={() => setShowHelp(false)} onSubmit={raiseAssist} />
      )}
      {showMyRequests && (
        <MyRequests mine={assists.filter((a) => a.cashierId === cashier.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt))}
          onClose={() => setShowMyRequests(false)} />
      )}
    </div>
  );
}
