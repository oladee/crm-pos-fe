import { expect, test, type Page } from '@playwright/test';

test.use({ channel: 'chrome' });

async function prepare(page: Page) {
  let row: Record<string, unknown> | null = null;
  const createdCustomers: Record<string, unknown>[] = [];
  const confirmations: Record<string, unknown>[] = [];
  await page.route('**/pos/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let body: unknown = { data: [] };
    if (path.endsWith('/devices/status')) body = { registered: true, passkey: false };
    else if (path.endsWith('/catalog')) body = { data: [{ id: 'product-test', name: 'Rice SKU', sku: 'RICE', category: 'Grains', unit: 'Units', price: 10000, stock: 10, trackStock: true, isActive: true }] };
    else if (path.endsWith('/sales/quote')) body = { subtotal: 10000, total: 10000, discount: 0, tax: 0 };
    else if (path.endsWith('/checkouts/options')) body = { enabled: true, methods: [{ id: 'manual', available: true }, { id: 'moniepoint', available: false }, { id: 'squad', available: false }] };
    else if (path.endsWith('/customers') && request.method() === 'POST') {
      createdCustomers.push(request.postDataJSON()); body = { data: { id: 'customer-test', ...request.postDataJSON() } };
    } else if (path.endsWith('/customers')) body = { data: [{ id: 'existing-customer', name: 'Existing Customer' }] };
    else if (path.endsWith('/checkouts') && request.method() === 'POST') {
      const input = request.postDataJSON();
      row = { id: 'checkout-test', ...input, kind: 'sale', customerName: 'Ada', status: 'awaiting', totalKobo: 10000,
        dueKobo: input.paymentMode === 'partial_credit' ? input.upfrontKobo : 10000, creditKobo: input.paymentMode === 'partial_credit' ? 10000 - input.upfrontKobo : 0,
        receipt: null, attempts: [], canConfirmReceived: true, createdAt: new Date().toISOString() };
      body = row;
    } else if (path.endsWith('/confirm-received')) {
      confirmations.push(request.postDataJSON()); row = { ...row, status: 'completed', canConfirmReceived: false }; body = row;
    } else if (path.endsWith('/checkouts/checkout-test')) body = row;
    else if (path.endsWith('/checkouts')) body = { data: row ? [row] : [], nextCursor: null };
    else if (path.endsWith('/staff')) body = { data: [{ id: 'cashier-test', name: 'Cashier', role: 'cashier', isActive: true }] };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/login');
  await expect(page.getByPlaceholder('Username')).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('fudfarmer-pos', 4); r.onsuccess = () => resolve(r.result); });
    const tx = db.transaction(['settings', 'cashiers', 'shifts'], 'readwrite');
    tx.objectStore('settings').put({ id: 'store', deviceId: 'device-test', deviceLabel: 'Till 1', hubId: 'hub-test', storeId: 'hub-test', storeName: 'Lagos Store', storeType: 'Owned', currency: 'NGN', setupComplete: true });
    tx.objectStore('cashiers').put({ id: 'cashier-test', name: 'Cashier', role: 'cashier', isActive: true });
    tx.objectStore('shifts').put({ id: 'shift-test', deviceId: 'device-test', hubId: 'hub-test', cashierId: 'cashier-test', cashierName: 'Cashier', status: 'open', openedAt: new Date().toISOString(), openingFloat: 0 });
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); }); db.close();
    sessionStorage.setItem('pos.cashierId', 'cashier-test'); sessionStorage.setItem('pos.pinJwt', 'test-token');
  });
  await page.reload(); await page.waitForURL('**/sell');
  await page.getByRole('button', { name: /Rice SKU/ }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  return { createdCustomers, confirmations, getRow: () => row };
}

test('requires a customer and preserves the cart when customer selection is cancelled', async ({ page }) => {
  await prepare(page);
  await expect(page.getByLabel('Customer name', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Walk-in/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close customer' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Existing Customer', exact: true }).click();
  const checkout = page.getByRole('dialog', { name: 'Customer checkout' });
  await expect(checkout).toBeVisible(); await expect(checkout.getByText('₦100.00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close checkout' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(checkout).toBeVisible(); await expect(page.getByLabel('Customer name', { exact: true })).toHaveCount(0);
});

test('creates a named customer without a phone and permits manual collection with providers disabled', async ({ page }) => {
  const state = await prepare(page);
  await page.getByLabel('Customer name', { exact: true }).fill('Ada');
  await page.getByRole('button', { name: 'Save as new customer' }).click();
  expect(state.createdCustomers).toEqual([{ name: 'Ada' }]);
  const checkout = page.getByRole('dialog', { name: 'Customer checkout' });
  await expect(checkout.getByRole('button', { name: 'Moniepoint card' })).toBeDisabled();
  await expect(checkout.getByRole('button', { name: 'Squad transfer' })).toBeDisabled();
  await checkout.getByRole('button', { name: 'Confirm payment received', exact: true }).click();
  await page.getByLabel('Receiving account', { exact: true }).fill('Cash drawer');
  await page.getByLabel('Actual method', { exact: true }).selectOption('Cash');
  await page.getByLabel('Confirmation reason').fill('Counted received notes');
  await expect(page.getByRole('button', { name: 'Confirm received payment', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: /I have checked receipt/ }).check();
  await page.getByRole('button', { name: 'Confirm received payment', exact: true }).click();
  await expect(checkout.getByText(/Recorded/)).toBeVisible();
  expect(state.confirmations).toHaveLength(1);
  expect(state.confirmations[0]).toMatchObject({ amountKobo: 10000, actualMethod: 'Cash', confirmed: true });
});

test('sends the partial-credit upfront amount and due date', async ({ page }) => {
  const state = await prepare(page);
  await page.getByRole('button', { name: 'Existing Customer', exact: true }).click();
  await page.getByLabel('Payment mode').selectOption('partial_credit');
  await page.getByLabel('Upfront amount', { exact: true }).fill('40');
  await page.getByLabel('Repayment due date', { exact: true }).fill('2099-01-01');
  await page.getByRole('button', { name: 'Confirm payment received', exact: true }).click();
  await expect(page.getByLabel('Amount received', { exact: true })).toHaveValue('40');
  expect(state.getRow()).toMatchObject({ paymentMode: 'partial_credit', upfrontKobo: 4000, dueDate: '2099-01-01', creditKobo: 6000 });
});
