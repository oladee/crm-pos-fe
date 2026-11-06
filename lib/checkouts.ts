import type { PosSale } from './types';
import { getJson, sendJson } from './remote';

export type CheckoutMode = 'full_payment' | 'partial_credit' | 'full_credit';
export type CheckoutOptions = { methods: Array<{ id: 'moniepoint' | 'squad' | 'manual'; name: string; available: boolean; reason?: string | null }> };
export type CheckoutAttempt = { id: string; clientAttemptId: string; reference: string; provider: 'moniepoint' | 'squad'; method: string;
  status: string; amountKobo: number; payableKobo: number | null; feeKobo: number | null; reviewReason: string | null;
  instructions: { bankName: string; accountName: string; accountNumber: string } | null };
export type Checkout = { id: string; clientSaleId: string; kind: 'sale' | 'repayment'; customerId: string; customerName: string;
  status: 'awaiting' | 'completed' | 'cancelled' | 'review'; paymentMode: CheckoutMode; totalKobo: number; dueKobo: number; creditKobo: number;
  dueDate?: string; receipt: PosSale | null; attempts: CheckoutAttempt[]; canConfirmReceived: boolean; reviewReason: string | null; createdAt: string };
export type CustomerCredit = { id: string; saleReference: string; amountKobo: number; dueDate: string; status: string };

export async function checkoutOptions() {
  const options = await getJson<CheckoutOptions>('/pos/checkouts/options', true);
  if (!Array.isArray(options.methods)) throw new Error('Checkout settings are unavailable. Retry to reload them.');
  return options;
}
export async function createCheckout(input: Record<string, unknown>) {
  const key = `pos.pendingCheckout.${input.deviceId}`;
  let saved: Record<string, unknown> | null = null;
  try { saved = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { /* Ignore malformed local drafts. */ }
  if (saved && JSON.stringify({ customer: saved.customerId, lines: saved.lines, mode: saved.paymentMode, upfront: saved.upfrontKobo, dueDate: saved.dueDate }) !==
    JSON.stringify({ customer: input.customerId, lines: input.lines, mode: input.paymentMode, upfront: input.upfrontKobo, dueDate: input.dueDate })) {
    throw new Error('An earlier checkout has an unknown result. Retry its original customer, cart and payment mode to recover it before starting a different checkout. You can inspect it in Checkouts.');
  }
  const payload = saved || input;
  sessionStorage.setItem(key, JSON.stringify(payload));
  try {
    const row = await sendJson<Checkout>('/pos/checkouts', 'POST', payload);
    sessionStorage.removeItem(key); return row;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status && status >= 400 && status < 500) sessionStorage.removeItem(key);
    throw error;
  }
}
export const getCheckout = (id: string, refresh = false) => getJson<Checkout>(`/pos/checkouts/${encodeURIComponent(id)}${refresh ? '?refresh=1' : ''}`, true);
export const checkoutAttempt = (id: string, input: Record<string, unknown>) => sendJson<Checkout>(`/pos/checkouts/${encodeURIComponent(id)}/payment-attempts`, 'POST', input);
export const confirmCheckout = (id: string, input: Record<string, unknown>) => sendJson<Checkout>(`/pos/checkouts/${encodeURIComponent(id)}/confirm-received`, 'POST', input);
export const cancelCheckout = (id: string) => sendJson<Checkout>(`/pos/checkouts/${encodeURIComponent(id)}/cancel`, 'POST', {});
export const listCheckouts = (before?: string) => getJson<{ data: Checkout[]; nextCursor: string | null }>(`/pos/checkouts${before ? '?before=' + encodeURIComponent(before) : ''}`, true);
export const customerCredits = (id: string) => getJson<{ data: CustomerCredit[] }>(`/pos/customers/${encodeURIComponent(id)}/credits`, true);
export const createRepayment = (input: Record<string, unknown>) => sendJson<Checkout>('/pos/credit-collections', 'POST', input);
export const checkoutReviews = () => getJson<{ data: Array<{ id: string; provider: string; reference: string; amountKobo: number; reason: string }> }>('/pos/checkouts/reviews', true);

