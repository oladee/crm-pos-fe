'use client';

import { useState } from 'react';
import {
  X, LifeBuoy, AlertTriangle, CheckCircle2, Hand, Zap,
  Tag, Boxes, Banknote, RefreshCw, MessageSquare, User, ChevronRight,
} from 'lucide-react';
import { AssistRequest, IssueType, ISSUE_TYPES, ResolutionKind, PosProduct } from '@/lib/types';
import { waitingMinutes, SUGGESTED_ACTION, ACTION_LABEL, openAssists } from '@/lib/assist';
import { fmt, toKobo } from '@/lib/money';

const ACTION_ICON: Record<ResolutionKind, typeof Tag> = {
  price_override: Tag,
  stock_correction: Boxes,
  cash_drop: Banknote,
  sync_retry: RefreshCw,
  guidance: MessageSquare,
};

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop fixed inset-0 z-[60] grid place-items-center p-4">
      <div className={`modal-shell w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-[16px] overflow-hidden max-h-[92vh] flex flex-col`}>
        <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between shrink-0">
          <h2 className="font-black text-sm">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-[10px] grid place-items-center text-[var(--color-ink-dim)] hover:bg-[var(--color-surface-2)]"><X size={20} /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ─────────── Cashier: raise a request ─────────── */
export function RequestHelpModal({
  cartTotal, cartLines, onClose, onSubmit,
}: {
  cartTotal: number;
  cartLines: { name: string; qty: number; unit: string }[];
  onClose: () => void;
  onSubmit: (d: { type: IssueType; note: string; urgent: boolean; attachCart: boolean }) => void;
}) {
  const [type, setType] = useState<IssueType>('Price override');
  const [note, setNote] = useState('');
  const [urgent, setUrgent] = useState(true);
  const [attachCart, setAttachCart] = useState(cartLines.length > 0);

  return (
    <Shell title="Ask a supervisor" onClose={onClose}>
      <p className="text-xs text-[var(--color-ink-dim)] mb-3">
        Your till keeps working. Hold the cart and carry on if you need to.
      </p>

      <label className="text-[11px] font-bold text-[var(--color-ink-dim)]">What&apos;s the problem?</label>
      <div className="grid grid-cols-2 gap-1.5 mt-1.5 mb-3">
        {ISSUE_TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`px-2 py-2 rounded-lg text-[11px] font-bold border text-left ${type === t ? 'bg-[var(--color-brand)] text-[var(--color-brand-ink)] border-[var(--color-brand)]' : 'bg-[var(--color-surface-2)] border-[var(--color-line)] text-[var(--color-ink-dim)]'}`}>
            {t}
          </button>
        ))}
      </div>

      <label className="text-[11px] font-bold text-[var(--color-ink-dim)]">Details</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
        placeholder="e.g. Rice is ringing at ₦78,000 but the shelf says ₦74,000"
        className="w-full mt-1.5 mb-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] p-2.5 text-sm outline-none focus:border-[var(--color-brand)]" />

      <div className="space-y-2 mb-4">
        <button onClick={() => setUrgent((v) => !v)} className="w-full flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] p-2.5">
          <span className="text-xs font-bold inline-flex items-center gap-1.5"><Zap size={13} className="text-[var(--color-warn)]" /> Customer is waiting</span>
          <span className={`h-5 w-9 rounded-full transition-colors relative ${urgent ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-line)]'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${urgent ? 'left-4.5' : 'left-0.5'}`} style={{ left: urgent ? 18 : 2 }} />
          </span>
        </button>
        {cartLines.length > 0 && (
          <button onClick={() => setAttachCart((v) => !v)} className="w-full flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] p-2.5">
            <span className="text-xs font-bold">Attach current cart ({fmt(cartTotal)})</span>
            <span className={`h-5 w-9 rounded-full transition-colors relative ${attachCart ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-line)]'}`}>
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: attachCart ? 18 : 2 }} />
            </span>
          </button>
        )}
      </div>

      <button onClick={() => onSubmit({ type, note, urgent, attachCart })}
        className="w-full h-12 rounded-xl bg-[var(--color-brand)] text-[var(--color-brand-ink)] font-black text-sm inline-flex items-center justify-center gap-2">
        <LifeBuoy size={16} /> Send to supervisor
      </button>
    </Shell>
  );
}

/* ─────────── Cashier: status of their own requests ─────────── */
export function MyRequests({ mine, onClose }: { mine: AssistRequest[]; onClose: () => void }) {
  return (
    <Shell title="My help requests" onClose={onClose}>
      {mine.length === 0 && <p className="text-center text-sm text-[var(--color-ink-dim)] py-8">No requests yet.</p>}
      <div className="space-y-2">
        {mine.map((a) => (
          <div key={a.id} className="rounded-xl bg-[var(--color-surface-2)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold">{a.type}{a.urgent && <span className="ml-1.5 text-[9px] font-black text-[var(--color-warn)]">URGENT</span>}</p>
                <p className="text-[11px] text-[var(--color-ink-dim)] mt-0.5">{a.note || 'None'}</p>
              </div>
              <StatusChip a={a} />
            </div>
            {a.status === 'resolved' && (
              <div className="mt-2 pt-2 border-t border-[var(--color-line)] text-[11px]">
                <p className="text-[var(--color-brand)] font-bold flex items-center gap-1"><CheckCircle2 size={11} /> {a.resolvedBy}</p>
                {a.resolution && <p className="text-[var(--color-ink-dim)] mt-0.5">{a.resolution}</p>}
                {a.action && a.action.kind !== 'guidance' && <ActionSummary action={a.action} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}

function StatusChip({ a }: { a: AssistRequest }) {
  const map: Record<string, string> = {
    open: 'bg-amber-500/15 text-[var(--color-warn)]',
    in_progress: 'bg-sky-500/15 text-sky-300',
    resolved: 'bg-emerald-500/15 text-[var(--color-brand)]',
    cancelled: 'bg-[var(--color-line)] text-[var(--color-ink-dim)]',
  };
  const label = a.status === 'in_progress' ? 'Being handled' : a.status;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black capitalize ${map[a.status]}`}>{label}</span>;
}

function ActionSummary({ action }: { action: NonNullable<AssistRequest['action']> }) {
  const Icon = ACTION_ICON[action.kind];
  const body =
    action.kind === 'price_override' ? `${action.productName}: ${fmt(action.oldValue || 0)} → ${fmt(action.newValue || 0)}`
    : action.kind === 'stock_correction' ? `${action.productName}: ${action.oldValue} → ${action.newValue} units`
    : action.kind === 'cash_drop' ? `${fmt(action.amount || 0)} removed from drawer`
    : action.kind === 'sync_retry' ? 'Sync retried'
    : '';
  if (!body) return null;
  return <p className="mt-1 text-[10px] text-[var(--color-brand)] font-bold inline-flex items-center gap-1"><Icon size={10} /> {body}</p>;
}

/* ─────────── Supervisor: the queue ─────────── */
export function AssistQueue({
  assists, catalog, onClaim, onResolve, onCancel,
}: {
  assists: AssistRequest[];
  catalog: PosProduct[];
  onClaim: (a: AssistRequest) => void;
  onResolve: (a: AssistRequest, kind: ResolutionKind, note: string, payload: { productId?: string; newValue?: number; amount?: number }) => void;
  onCancel: (a: AssistRequest) => void;
}) {
  const [resolving, setResolving] = useState<AssistRequest | null>(null);
  const open = openAssists(assists).sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.createdAt.localeCompare(b.createdAt));
  const done = assists.filter((a) => a.status === 'resolved' || a.status === 'cancelled')
    .sort((a, b) => (b.resolvedAt || '').localeCompare(a.resolvedAt || '')).slice(0, 12);
  const urgent = open.filter((a) => a.urgent).length;

  return (
    <div className="manager-module mx-auto max-w-5xl">
      <div className="manager-module-header">
        <div><h1>Assist queue</h1><p>Clear the requests blocking attendants and customers at the tills.</p></div>
        <span>{open.length} open</span>
      </div>

      <section aria-label="Assist summary" className="manager-metric-strip">
        <div className="manager-metric-primary"><span className="manager-label">Open requests</span><strong>{open.length}</strong></div>
        <div><span className="manager-label">Customer waiting</span><strong>{urgent}</strong></div>
        <div><span className="manager-label">Handled recently</span><strong>{done.length}</strong></div>
      </section>

      {open.length === 0 && (
        <div className="manager-empty-state">
          <CheckCircle2 size={22} className="text-[var(--color-brand)]" />
          <div><p className="font-bold">Every till is unblocked</p><p className="mt-0.5 text-xs text-[var(--color-ink-dim)]">New requests will appear here in priority order.</p></div>
        </div>
      )}

      {open.length > 0 && <section aria-label="Open assist requests" className="manager-data-surface">
        {open.map((a) => (
          <div key={a.id} className={`manager-assist-row ${a.urgent ? 'manager-assist-urgent' : ''}`}>
            <div className="manager-assist-priority">
              <span className={a.urgent ? 'text-[var(--color-warn)]' : 'text-[var(--color-ink-dim)]'}>{a.urgent ? <Zap size={17} /> : <LifeBuoy size={17} />}</span>
              <strong>{waitingMinutes(a)}m</strong><small>waiting</small>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-black">{a.type}</h2>
                {a.urgent && <span className="manager-inline-status text-[var(--color-warn)]">Customer waiting</span>}
                {a.status === 'in_progress' && <span className="manager-inline-status text-[var(--color-info)]">{a.claimedBy?.split(' (')[0]} is handling</span>}
              </div>
              <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-ink-dim)]"><User size={11} />{a.cashierName.split(' (')[0]}</p>
              {a.note && <p className="mt-2 max-w-2xl text-xs leading-relaxed">{a.note}</p>}
              {a.context?.cartLines && a.context.cartLines.length > 0 && (
                <div className="manager-attached-cart">
                  <p className="manager-section-label">Attached cart / {fmt(a.context.cartTotal || 0)}</p>
                  <div className="mt-1">{a.context.cartLines.map((l, i) => <p key={i} className="text-[11px] text-[var(--color-ink-dim)]">{l.qty} {l.unit} x {l.name}</p>)}</div>
                </div>
              )}
            </div>
            <div className="manager-assist-actions">
              {a.status === 'open' && <button onClick={() => onClaim(a)} className="manager-secondary-button"><Hand size={13} />Take request</button>}
              <button onClick={() => setResolving(a)} className="manager-primary-button">Resolve<ChevronRight size={14} /></button>
              <button onClick={() => onCancel(a)} className="manager-text-button">Dismiss</button>
            </div>
          </div>
        ))}
      </section>}

      {done.length > 0 && (
        <section className="manager-history">
          <div className="manager-history-head"><div><h2>Recently handled</h2><p>Latest resolved and dismissed requests.</p></div><span>{done.length} shown</span></div>
          <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {done.map((a) => (
              <div key={a.id} className="px-1 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{a.type} <span className="font-normal text-[var(--color-ink-dim)]">/ {a.cashierName.split(' (')[0]}</span></p>
                    {a.resolution && <p className="mt-0.5 text-[11px] text-[var(--color-ink-dim)]">{a.resolution}</p>}
                    {a.action && a.action.kind !== 'guidance' && <ActionSummary action={a.action} />}
                  </div>
                  <span className={`manager-inline-status shrink-0 ${a.status === 'resolved' ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink-dim)]'}`}>
                    {a.status === 'resolved' ? a.resolvedBy?.split(' (')[0] : 'dismissed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {resolving && (
        <ResolveModal request={resolving} catalog={catalog}
          onClose={() => setResolving(null)}
          onResolve={(kind, note, payload) => { onResolve(resolving, kind, note, payload); setResolving(null); }} />
      )}
    </div>
  );
}

/* ─────────── Supervisor: resolve with a real action ─────────── */
function ResolveModal({
  request, catalog, onClose, onResolve,
}: {
  request: AssistRequest;
  catalog: PosProduct[];
  onClose: () => void;
  onResolve: (kind: ResolutionKind, note: string, payload: { productId?: string; newValue?: number; amount?: number }) => void;
}) {
  const [kind, setKind] = useState<ResolutionKind>(SUGGESTED_ACTION[request.type]);
  const [productId, setProductId] = useState(request.context?.productId || catalog[0]?.id || '');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const product = catalog.find((p) => p.id === productId);

  const needsProduct = kind === 'price_override' || kind === 'stock_correction';
  const needsAmount = kind === 'cash_drop';
  const ready = kind === 'guidance' || kind === 'sync_retry'
    ? note.trim().length > 0 || kind === 'sync_retry'
    : value.trim().length > 0 && (!needsProduct || !!product);

  const submit = () => {
    const payload: { productId?: string; newValue?: number; amount?: number } = {};
    if (needsProduct) {
      payload.productId = productId;
      payload.newValue = kind === 'price_override' ? toKobo(Number(value) || 0) : Number(value) || 0;
    }
    if (needsAmount) payload.amount = toKobo(Number(value) || 0);
    onResolve(kind, note, payload);
  };

  return (
    <Shell title={`Resolve: ${request.type}`} onClose={onClose} wide>
      <p className="text-xs text-[var(--color-ink-dim)] mb-3">
        {request.cashierName.split(' (')[0]}: &ldquo;{request.note || 'no details'}&rdquo;
      </p>

      <p className="manager-section-label">Choose an action</p>
      <div className="manager-resolution-actions mt-2 mb-4" role="group" aria-label="Resolution action">
        {(Object.keys(ACTION_LABEL) as ResolutionKind[]).map((k) => {
          const Icon = ACTION_ICON[k];
          return (
            <button key={k} onClick={() => { setKind(k); setValue(''); }} aria-pressed={kind === k}
              className="manager-resolution-choice">
              <Icon size={15} /> <span>{ACTION_LABEL[k]}</span>
            </button>
          );
        })}
      </div>

      {needsProduct && (
        <>
          <label htmlFor="resolution-product" className="manager-section-label">Product</label>
          <select id="resolution-product" value={productId} onChange={(e) => setProductId(e.target.value)}
            className="w-full h-10 px-2 my-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] text-sm outline-none">
            {catalog.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p className="text-[11px] text-[var(--color-ink-dim)] mb-2">
            Current {kind === 'price_override' ? `price: ${fmt(product?.price || 0)}` : `stock: ${product?.stock ?? 0} ${product?.unit || ''}`}
          </p>
        </>
      )}

      {(needsProduct || needsAmount) && (
        <>
          <label htmlFor="resolution-value" className="manager-section-label">
            {kind === 'price_override' ? 'New price (₦)' : kind === 'stock_correction' ? 'Correct stock (units)' : 'Amount removed (₦)'}
          </label>
          <input id="resolution-value" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0"
            className="w-full h-11 px-3 my-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] text-lg font-black text-center outline-none focus:border-[var(--color-brand)]" />
        </>
      )}

      {kind === 'cash_drop' && (
        <p className="text-[10px] text-[var(--color-warn)] mb-2 flex items-start gap-1">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" /> This reduces the cash expected in the drawer at close.
        </p>
      )}

      <label htmlFor="resolution-note" className="manager-section-label">Note to cashier</label>
      <textarea id="resolution-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2}
        placeholder="What you did / what they should do next"
        className="w-full mt-1.5 mb-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] p-2.5 text-sm outline-none focus:border-[var(--color-brand)]" />

      <button onClick={submit} disabled={!ready}
        className="w-full h-12 rounded-xl bg-[var(--color-brand)] text-[var(--color-brand-ink)] font-black text-sm disabled:opacity-30 inline-flex items-center justify-center gap-2">
        <CheckCircle2 size={16} /> Apply &amp; resolve
      </button>
    </Shell>
  );
}
