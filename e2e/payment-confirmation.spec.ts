import { expect, test, type Page } from '@playwright/test';

test.use({ channel: 'chrome' });
const payment = {
  clientSaleId: 'test-payment-reference', checkoutId: 'test-payment-reference', provider: 'squad',
  status: 'awaiting', bankName: 'GTBank', accountName: 'Lagos Store', accountNumber: '0123456789',
  payableKobo: 10250, cartTotalKobo: 10000, feeKobo: 250, currency: 'NGN', expiresAt: null,
  sale: {}, reservationState: 'held', reconciliationReason: null, canConfirmReceived: true, canCancel: true,
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
      body = fail ? { message: 'Please retry payment confirmation' } : { ...payment, status: 'paid', reservationState: 'consumed', canConfirmReceived: false };
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
