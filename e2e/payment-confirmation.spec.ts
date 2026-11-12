import { expect, test, type Page } from '@playwright/test';

test.use({ channel: 'chrome' });
const payment = {
  clientSaleId: 'test-payment-reference', checkoutId: 'test-payment-reference', provider: 'squad',
  status: 'awaiting', bankName: 'GTBank', accountName: 'Lagos Store', accountNumber: '0123456789',
  payableKobo: 10250, cartTotalKobo: 10000, feeKobo: 250, currency: 'NGN', expiresAt: null,
  sale: { posSale: {
    id: 'test-payment-reference', deviceId: 'device-test', storeId: 'hub-test', cashierId: 'cashier-test', cashierName: 'Test Cashier',
    lines: [{ productId: 'product-test', name: 'Rice SKU', sku: 'RICE', unit: 'kg', qty: 1, unitPrice: 10000, discount: 0, lineTotal: 10000 }],
    subtotal: 10000, discount: 0, total: 10000, payments: [{ method: 'Transfer', amount: 10000 }], change: 0,
    status: 'completed', createdAt: '2026-10-31T09:00:00.000Z', syncState: 'pending',
  } }, reservationState: 'held', reconciliationReason: null, canConfirmReceived: true, canCancel: true,
};

async function prepare(page: Page, overrides: Record<string, unknown> = {}, fail = false, openTransfer = true) {
  let confirmations = 0;
  let paid = overrides.status === 'paid';
  const receiptSale = { ...payment.sale.posSale, syncState: 'synced', origin: { storeName: 'Lagos Store', deviceLabel: 'Till 1' },
    receiptPayment: { provider: 'squad', checkoutReference: payment.checkoutId, feeKobo: payment.feeKobo, paidKobo: payment.payableKobo, confirmedAt: '2026-10-31T09:05:00.000Z' } };
  const transactionRow = (sale: Record<string, unknown>) => ({ reference: sale.id, kind: 'sale', status: 'completed', createdAt: sale.createdAt,
    locationId: 'hub-test', locationName: 'Lagos Store', tillName: 'Till 1', customerName: sale.customerName, cashierName: sale.cashierName,
    cashierId: 'cashier-test', deviceId: 'device-test', totalKobo: sale.total, receipt: sale, checkoutId: null, legacyTransferId: null,
    actions: { viewReceipt: true, printReceipt: true, refund: false, void: false } });
  await page.route('**/pos/**', async route => {
    const url = new URL(route.request().url());
    let body: unknown = { data: [] }, status = 200;
    if (url.pathname.endsWith('/devices/status')) body = { registered: true, passkey: false };
    else if (url.pathname.endsWith('/catalog')) body = { data: [{ id: 'product-test', name: 'Rice SKU', sku: 'RICE', category: 'Grains', unit: 'Units', price: 10000, stock: 10, trackStock: true, isActive: true, batches: [{ batchNumber: 'old', quantityRemaining: 3, unitPrice: 1 }, { batchNumber: 'new', quantityRemaining: 7, unitPrice: 99999 }] }] };
    else if (url.pathname.endsWith('/sales/quote')) body = { subtotal: 10000, total: 10000, discount: 0, tax: 0 };
    else if (url.pathname.endsWith('/payments/options')) body = { providers: [{ id: 'squad', name: 'Squad' }], manualConfirmationEnabled: true };
    else if (url.pathname.endsWith('/checkouts/options')) body = { methods: [{ id: 'manual', available: true }, { id: 'moniepoint', available: false }, { id: 'squad', available: false }] };
    else if (url.pathname.endsWith('/checkouts')) body = { data: [], nextCursor: null };
    else if (url.pathname.endsWith('/confirm-received')) {
      confirmations++; if (!fail) paid = true;
      status = fail ? 503 : 200;
      body = fail ? { message: 'Please retry payment confirmation' } : { ...payment, ...overrides, status: 'paid', confirmedAt: '2026-10-31T09:05:00.000Z', reservationState: 'consumed', canConfirmReceived: false };
    } else if (url.pathname.endsWith('/payments/transfers/test-payment-reference')) {
      if (overrides.refreshStatus === 'paid') paid = true;
      body = { ...payment, ...overrides, status: overrides.refreshStatus || 'awaiting', confirmedAt: '2026-10-31T09:05:00.000Z' };
    } else if (url.pathname.endsWith('/payments/transfers')) body = { data: [{ ...payment, ...overrides }] };
    else if (url.pathname.includes('/transactions')) {
      const local = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('fudfarmer-pos', 4); request.onsuccess = () => resolve(request.result); });
        const sales = await new Promise<Record<string, unknown>[]>(resolve => { const request = db.transaction('sales').objectStore('sales').getAll(); request.onsuccess = () => resolve(request.result); }); db.close(); return sales;
      });
      const rows = local.map(transactionRow); if (paid && !rows.some(row => row.reference === payment.clientSaleId)) rows.push(transactionRow(receiptSale));
      body = url.pathname.endsWith('/transactions') ? { data: rows, nextCursor: null } : rows.find(row => row.reference === url.pathname.split('/').pop());
    }
    else if (url.pathname.endsWith('/staff')) body = { data: [{ id: 'cashier-test', name: 'Test Cashier', email: 'cashier@example.com', role: 'cashier', isActive: true }] };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/login');
  await expect(page.getByPlaceholder('Username')).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('fudfarmer-pos', 4); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const tx = db.transaction(['settings', 'cashiers', 'shifts'], 'readwrite');
    const profile = { id: 'store', deviceId: 'device-test', deviceLabel: 'Till 1', hubId: 'hub-test', storeId: 'hub-test', storeName: 'Lagos Store', storeType: 'Owned', currency: 'NGN', setupComplete: true };
    tx.objectStore('settings').put(profile);
    tx.objectStore('cashiers').put({ id: 'cashier-test', name: 'Test Cashier', role: 'cashier', isActive: true });
    tx.objectStore('shifts').put({ id: 'shift-test', deviceId: 'device-test', hubId: 'hub-test', cashierId: 'cashier-test', cashierName: 'Test Cashier', status: 'open', openedAt: new Date().toISOString(), openingFloat: 0 });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close(); sessionStorage.setItem('pos.cashierId', 'cashier-test'); sessionStorage.setItem('pos.pinJwt', 'test-token');
  });
  await page.reload();
  await page.waitForURL('**/sell');
  if (openTransfer) {
    await page.getByTitle('Bank transfers waiting for payment').click();
    await page.getByRole('button', { name: /102.50/ }).click();
  }
  return () => confirmations;
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`manual confirmation requires explicit consent at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const count = await prepare(page);
    await expect(page.getByText('Provider charges')).toBeVisible();
    await expect(page.getByText('0123456789', { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'Accept total and show account' }).click();
    await expect(page.getByText('0123456789', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'I have received payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm payment received?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Go back' })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`confirm-${viewport.width}.png`) });
    await dialog.getByRole('button', { name: 'Go back' }).click();
    expect(count()).toBe(0);
    await page.getByRole('button', { name: 'I have received payment' }).click();
    await dialog.getByRole('button', { name: 'Confirm payment received', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(count()).toBe(1);
  });
}

test('live checkout notice sounds once across tabs and leaves the active cart intact', async ({ page, context }) => {
  test.skip(process.env.NEXT_PUBLIC_POS_LIVE_ENABLED !== 'true', 'Live till browser build must be enabled');
  await context.addInitScript(() => {
    class FakeAudio {
      state = 'running';
      currentTime = 0;
      destination = {};
      async resume() {}
      createOscillator() {
        return {
          frequency: { setValueAtTime() {} },
          connect: (node: object) => node,
          start() { localStorage.setItem('test.notification-tones', String(Number(localStorage.getItem('test.notification-tones') || 0) + 1)); },
          stop() {},
        };
      }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    }
    Object.defineProperty(window, 'AudioContext', { value: FakeAudio });
  });
  const broadcast: Array<(item: object) => void> = [];
  await context.routeWebSocket('**/pos/live', ws => {
    ws.onMessage(raw => {
      const message = JSON.parse(String(raw));
      if (message.type !== 'authenticate') return;
      ws.send(JSON.stringify({ type: 'authenticated', transportReady: true }));
      ws.send(JSON.stringify({ type: 'notifications', items: [{
        id: 'historical', kind: 'payment-confirmed', title: 'Historical payment', reference: 'historical',
      }] }));
      broadcast.push(item => ws.send(JSON.stringify({ type: 'notification', item })));
    });
  });
  await prepare(page, {}, false, false);
  const second = await context.newPage();
  await prepare(second, {}, false, false);
  await expect.poll(() => broadcast.length).toBeGreaterThanOrEqual(2);
  for (const tab of [page, second]) {
    await tab.getByLabel('Notifications', { exact: true }).click();
    await tab.getByRole('button', { name: 'Enable notification sound' }).click();
    await expect(tab.getByRole('button', { name: 'Mute notifications' })).toBeVisible();
    await tab.getByLabel('Notifications', { exact: true }).click();
  }
  await page.getByRole('button', { name: /Rice SKU/ }).click();
  const cart = page.getByRole('button', { name: /^Continue / });
  await expect(cart).toBeEnabled();
  const payment = { id: 'new-live-payment', title: 'Payment confirmed', kind: 'payment-confirmed', reference: 'older-order' };
  for (const send of broadcast.slice(-2)) { send(payment); send(payment); }
  await expect.poll(() => page.evaluate(() => localStorage.getItem('test.notification-tones'))).toBe('1');
  await expect(page).toHaveURL(/\/sell$/);
  await expect(cart).toBeEnabled();
  await page.getByLabel('Notifications', { exact: true }).click();
  await page.getByRole('button', { name: 'Mute notifications' }).click();
  await second.getByLabel('Notifications', { exact: true }).click();
  await expect(second.getByRole('button', { name: 'Enable notification sound' })).toBeVisible();
  for (const send of broadcast.slice(-2)) send({ ...payment, id: 'muted-live-payment' });
  await expect(second.getByText('Payment confirmed · View receipt')).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem('test.notification-tones'))).toBe('1');
});

test('live checkout notice survives a racing snapshot and unavailable notification storage', async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_POS_LIVE_ENABLED !== 'true', 'Live till browser build must be enabled');
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name, version) => {
      if (name === 'fudfarmer-pos-live') throw new DOMException('Storage unavailable', 'SecurityError');
      return open(name, version);
    };
  });
  const item = { id: 'racing-notice', kind: 'payment-confirmed', title: 'Racing payment confirmed', reference: 'prior-checkout' };
  let disconnectTransport: (() => void) | undefined;
  await page.routeWebSocket('**/pos/live', ws => {
    ws.onMessage(raw => {
      if (JSON.parse(String(raw)).type !== 'authenticate') return;
      disconnectTransport = () => ws.send(JSON.stringify({ type: 'transport', transportReady: false }));
      ws.send(JSON.stringify({ type: 'authenticated', transportReady: true }));
      ws.send(JSON.stringify({ type: 'notification', item }));
      ws.send(JSON.stringify({ type: 'notifications', items: [] }));
      ws.send(JSON.stringify({ type: 'notification', item }));
    });
  });
  await prepare(page, {}, false, false);
  await expect(page.getByText(item.title, { exact: true })).toHaveCount(1);
  await page.getByLabel('Notifications', { exact: true }).click();
  await expect(page.getByRole('button', { name: `${item.title} · View receipt` })).toHaveCount(1);
  await page.getByLabel('Notifications', { exact: true }).click();
  const recovered = { ...payment.sale.posSale, id: 'fallback-checkout', syncState: 'synced' };
  await page.route('**/pos/checkouts', route => route.fulfill({
    json: { data: [{ status: 'completed', receipt: recovered }], nextCursor: null },
  }));
  disconnectTransport?.();
  await expect(page.getByText('Payment received: Customer · #fallback-checkout', { exact: true })).toBeVisible();
});
test('a failed confirmation keeps the dialog and payment pending', async ({ page }) => {
  const count = await prepare(page, {}, true);
  await page.getByRole('button', { name: 'I have received payment' }).click();
  await page.getByRole('button', { name: 'Confirm payment received', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm payment received?' })).toBeVisible();
  expect(count()).toBe(1);
});
test('expired requests retain holds and hidden actions stay unavailable', async ({ page }) => {
  await prepare(page, { status: 'expired', canConfirmReceived: false });
  await expect(page.getByText('Payment request expired — stock still held.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I have received payment' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel this transfer' })).toBeVisible();
});
test('adding a SKU uses its price directly without a batch picker', async ({ page }) => {
  await prepare(page, {}, false, false);
  await page.getByRole('button', { name: /Rice SKU/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('₦100.00 / Units', { exact: true })).toBeVisible();
  await expect(page.getByText(/Choose the purchase batch/)).toHaveCount(0);
});

test('confirmed payment receipt prints only 48 mm content and reopens from history', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await page.getByRole('button', { name: 'I have received payment' }).click();
  await page.getByRole('button', { name: 'Confirm payment received', exact: true }).click();
  await page.getByRole('button', { name: 'View receipt' }).click();
  const receipt = page.locator('section[aria-label="Transaction receipt"]');
  await expect(receipt.getByText('Processor: Squad')).toBeVisible();
  await expect(receipt.getByText(/Confirmed:/)).toContainText('10:05');
  await expect(receipt.getByText(/Transaction:/)).toContainText('10:00');
  await expect(receipt.getByText('Provider charges')).toBeVisible();
  await expect(receipt.getByText('Total paid')).toBeVisible();
  await page.evaluate(() => { window.print = () => { document.body.dataset.printCalls = String(Number(document.body.dataset.printCalls || 0) + 1); }; });
  await receipt.getByRole('button', { name: 'Print receipt' }).click();
  await receipt.getByRole('button', { name: 'Print receipt' }).click();
  expect(await page.locator('body').getAttribute('data-print-calls')).toBe('2');
  await page.emulateMedia({ media: 'print' });
  await expect(receipt.getByRole('button', { name: 'Print receipt' })).not.toBeVisible();
  await expect(page.getByTitle('Bank transfers waiting for payment')).not.toBeVisible();
  const paper = page.locator('.receipt-paper');
  const width = await paper.evaluate(node => node.getBoundingClientRect().width);
  expect(width).toBeCloseTo(48 * 96 / 25.4, 0);
  expect(await paper.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('thermal-receipt.png'), fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await receipt.getByRole('button', { name: 'Back to transactions' }).click();
  await page.goto('/history');
  await page.locator('article').filter({ hasText: '#test-payment-reference' }).getByRole('link', { name: 'View receipt' }).click();
  await expect(page.locator('section[aria-label="Transaction receipt"]').getByText('Processor: Squad')).toBeVisible();
  expect(await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('fudfarmer-pos', 4); r.onsuccess = () => resolve(r.result); });
    const rows = await new Promise<unknown[]>(resolve => { const r = db.transaction('sales').objectStore('sales').getAll(); r.onsuccess = () => resolve(r.result); });
    db.close(); return rows.length;
  })).toBe(1);
});

test('webhook-confirmed status offers a receipt without opening a modal over the cart', async ({ page }) => {
  await prepare(page, { refreshStatus: 'paid' });
  await page.getByRole('button', { name: 'Check status' }).click();
  await expect(page.getByRole('button', { name: 'View receipt' })).toBeVisible();
  await expect(page.locator('section[aria-label="Transaction receipt"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'View receipt' }).click();
  await expect(page.getByText('Processor: Squad')).toBeVisible();
});

test('long receipts and legacy sales fit without scroll clipping in print', async ({ page }, testInfo) => {
  await prepare(page, {}, false, false);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('fudfarmer-pos', 4); r.onsuccess = () => resolve(r.result); });
    const t = db.transaction('sales', 'readwrite');
    t.objectStore('sales').put({
      id: 'legacy-long-receipt', deviceId: 'device-test', storeId: 'hub-test', cashierName: 'Test Cashier',
      createdAt: '2026-10-31T09:00:00Z', status: 'completed', syncState: 'synced', subtotal: 123456789, discount: 1234,
      tax: 100, taxRatePct: 7.5, total: 123455655, payments: [{ method: 'Cash', amount: 123455655 }], change: 0,
      lines: Array.from({ length: 40 }, (_, i) => ({
        productId: String(i), name: 'VeryLongUnbrokenProductNameThatMustWrapWithoutClipping' + i, sku: String(i),
        unit: 'kg', qty: 1.25, unitPrice: 1234567, lineTotal: 1543209, discount: 50,
      })),
    });
    await new Promise<void>(resolve => { t.oncomplete = () => resolve(); }); db.close();
  });
  await page.goto('/history');
  await page.locator('article').filter({ hasText: '#legacy-long-receipt' }).getByRole('link', { name: 'View receipt' }).click();
  await expect(page.getByText('Processor: Squad')).toHaveCount(0);
  await page.emulateMedia({ media: 'print' });
  const paper = page.locator('.receipt-paper');
  expect(await paper.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  expect(await page.locator('.receipt-preview').evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
  await expect(page.getByText('VeryLongUnbrokenProductNameThatMustWrapWithoutClipping39')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('long-thermal-receipt.png'), fullPage: true });
});

test('paid receipt recovery is idempotent across reloads', async ({ page }) => {
  await prepare(page, { status: 'paid', confirmedAt: '2026-10-31T09:05:00Z' }, false, false);
  // Historical confirmations restore silently instead of implying a new payment.
  await expect(page.getByRole('button', { name: 'View receipt' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTitle('Bank transfers waiting for payment')).toBeVisible();
  await expect(page.getByRole('button', { name: 'View receipt' })).toHaveCount(0);
  await page.goto('/history');
  await page.locator('article').filter({ hasText: '#test-payment-reference' }).getByRole('link', { name: 'View receipt' }).click();
  await expect(page.getByText('Processor: Squad')).toBeVisible();
});
