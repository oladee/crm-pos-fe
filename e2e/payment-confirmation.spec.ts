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
  await page.route('**/pos/**', async route => {
    const url = new URL(route.request().url());
    let body: unknown = { data: [] }, status = 200;
    if (url.pathname.endsWith('/devices/status')) body = { registered: true, passkey: false };
    else if (url.pathname.endsWith('/catalog')) body = { data: [{ id: 'product-test', name: 'Rice SKU', sku: 'RICE', category: 'Grains', unit: 'Units', price: 10000, stock: 10, trackStock: true, isActive: true, batches: [{ batchNumber: 'old', quantityRemaining: 3, unitPrice: 1 }, { batchNumber: 'new', quantityRemaining: 7, unitPrice: 99999 }] }] };
    else if (url.pathname.endsWith('/sales/quote')) body = { subtotal: 10000, total: 10000, discount: 0, tax: 0 };
    else if (url.pathname.endsWith('/payments/options')) body = { providers: [{ id: 'squad', name: 'Squad' }], manualConfirmationEnabled: true };
    else if (url.pathname.endsWith('/confirm-received')) {
      confirmations++;
      status = fail ? 503 : 200;
      body = fail ? { message: 'Please retry payment confirmation' } : { ...payment, ...overrides, status: 'paid', confirmedAt: '2026-10-31T09:05:00.000Z', reservationState: 'consumed', canConfirmReceived: false };
    } else if (url.pathname.endsWith('/payments/transfers/test-payment-reference')) {
      body = { ...payment, ...overrides, status: overrides.refreshStatus || 'awaiting', confirmedAt: '2026-10-31T09:05:00.000Z' };
    } else if (url.pathname.endsWith('/payments/transfers')) body = { data: [{ ...payment, ...overrides }] };
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
  const receipt = page.getByRole('dialog', { name: 'Transaction receipt' });
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
  await receipt.getByRole('button', { name: 'Close receipt' }).click();
  await page.goto('/history');
  await page.getByRole('button').filter({ hasText: '#test-payment-reference' }).click();
  await expect(page.getByRole('dialog', { name: 'Transaction receipt' }).getByText('Processor: Squad')).toBeVisible();
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
  await expect(page.getByRole('dialog', { name: 'Transaction receipt' })).toHaveCount(0);
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
  await page.getByRole('button').filter({ hasText: '#legacy-long-receipt' }).click();
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
  await expect(page.getByRole('button', { name: 'View receipt' })).toBeVisible();
  await page.reload();
  await expect(page.getByTitle('Bank transfers waiting for payment')).toBeVisible();
  await expect(page.getByRole('button', { name: 'View receipt' })).toHaveCount(0);
  await page.goto('/history');
  await page.getByRole('button').filter({ hasText: '#test-payment-reference' }).click();
  await expect(page.getByText('Processor: Squad')).toBeVisible();
});
