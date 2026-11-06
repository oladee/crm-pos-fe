import { expect, test, type Page } from '@playwright/test';

test.use({ channel: 'chrome' });
const sale = (reference: string, many = false) => ({
  id: reference, deviceId: 'other-till', storeId: 'hub-test', hubId: 'hub-test', cashierId: 'other-cashier', cashierName: 'Other Cashier',
  origin: { storeName: 'Agege Store', deviceLabel: 'Agege Till 2' }, kind: 'sale', status: 'completed', syncState: 'synced',
  customerName: 'Ada', createdAt: '2026-11-05T10:00:00Z', total: 10000, subtotal: 10000, discount: 0, change: 0,
  payments: [{ method: 'Transfer', amount: 10000 }],
  lines: Array.from({ length: many ? 180 : 1 }, (_, index) => ({ productId: 'rice-' + index,
    name: `Rice item ${index + 1} with a very long descriptive product name and reference 123456789012345678901234567890`,
    qty: 1.25, unit: 'Kg', saleUnit: 'Kg', unitPrice: 8000, lineTotal: 10000, discount: 0 })),
});
const row = (index: number, many = false) => ({
  reference: 'receipt-' + index, locationId: 'hub-test', locationName: 'Agege Store', tillName: 'Agege Till 2',
  cashierId: 'other-cashier', cashierName: 'Other Cashier', deviceId: 'other-till', customerName: 'Ada ' + index,
  kind: 'sale', status: 'completed', totalKobo: 10000, createdAt: '2026-11-05T10:00:00Z', receipt: sale('receipt-' + index, many),
  actions: { viewReceipt: true, printReceipt: true, refund: false, void: false }, checkoutId: null, legacyTransferId: null,
});

async function prepare(page: Page, manager = false, noShift = false, count = 61) {
  const rows = Array.from({ length: count }, (_, index) => row(index, index === 0));
  await page.addInitScript(() => { (window as unknown as { printCalls: number }).printCalls = 0; window.print = () => { (window as unknown as { printCalls: number }).printCalls++; }; });
  await page.route('**/pos/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    let body: unknown = { data: [] };
    if (path.endsWith('/devices/status')) body = { registered: true, passkey: false };
    else if (path.endsWith('/catalog')) body = { data: [{ id: 'product-test', name: 'Rice SKU', sku: 'RICE', category: 'Grains', unit: 'Units', price: 10000, stock: 10, trackStock: true, isActive: true }] };
    else if (path.endsWith('/checkouts/options')) body = { enabled: false, methods: [{ id: 'moniepoint', name: 'Moniepoint', available: false, reason: 'No Moniepoint terminal configured for this till.' }, { id: 'squad', name: 'Squad', available: false, reason: 'Squad is not configured.' }, { id: 'manual', available: true }] };
    else if (path.endsWith('/checkouts')) body = { data: [], nextCursor: null };
    else if (path.endsWith('/checkouts/reviews')) body = { data: manager ? [{ id: 'review-1', reference: 'payment-review', amountKobo: 10000, reason: 'Additional payment arrived after checkout completion' }] : [] };
    else if (path.endsWith('/sales/quote')) body = { total: 10000, subtotal: 10000, discount: 0, tax: 0 };
    else if (path.endsWith('/customers')) body = { data: [{ id: 'customer', name: 'Ada' }] };
    else if (path.endsWith('/transactions')) {
      const start = url.searchParams.get('before') ? 50 : 0;
      const filtered = rows.filter(item => !url.searchParams.get('q') || item.reference.includes(url.searchParams.get('q')!));
      body = { data: filtered.slice(start, start + 50), nextCursor: start === 0 && filtered.length > 50 ? 'next-page' : null };
    } else if (path.includes('/transactions/')) body = rows.find(item => item.reference === path.split('/').pop()) || row(0);
    else if (path.endsWith('/staff')) body = { data: [{ id: 'cashier-test', name: 'Cashier', role: manager ? 'manager' : 'cashier', isActive: true }] };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/login'); await expect(page.getByPlaceholder('Username')).toBeVisible();
  await page.evaluate(async ({ manager, noShift }) => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('fudfarmer-pos', 4); request.onsuccess = () => resolve(request.result); });
    const tx = db.transaction(['settings', 'cashiers', 'shifts', 'sales'], 'readwrite');
    tx.objectStore('settings').put({ id: 'store', deviceId: 'device-test', deviceLabel: 'Current Till', hubId: 'hub-test', storeId: 'hub-test', storeName: 'Agege Store', storeType: 'Owned', currency: 'NGN', setupComplete: true });
    tx.objectStore('cashiers').put({ id: 'cashier-test', name: 'Cashier', role: manager ? 'manager' : 'cashier', isActive: true });
    if (!noShift) tx.objectStore('shifts').put({ id: 'shift-test', deviceId: 'device-test', hubId: 'hub-test', cashierId: 'cashier-test', cashierName: 'Cashier', status: 'open', openedAt: '2026-11-05T09:00:00Z', openingFloat: 1000 });
    for (let index = 0; index < 65; index++) tx.objectStore('sales').put({ id: 'local-' + index, deviceId: 'device-test', storeId: 'hub-test', cashierId: 'cashier-test', cashierName: 'Cashier', shiftId: 'shift-test', createdAt: '2026-11-05T10:00:00Z', status: 'completed', syncState: 'synced', total: 10000, subtotal: 10000, discount: 0, change: 0, lines: [], payments: [{ method: 'Cash', amount: 10000 }] });
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); }); db.close();
    sessionStorage.setItem('pos.cashierId', 'cashier-test'); sessionStorage.setItem('pos.pinJwt', 'test-token');
  }, { manager, noShift });
  await page.goto(noShift ? '/history' : '/sell');
  await expect(page.getByRole('heading', { name: noShift ? 'Transactions' : 'Choose products' })).toBeVisible({ timeout: 15000 });
}

for (const width of [360, 390, 1280]) test(`cashier transactions are normal scrolling pages at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 }); await prepare(page);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Transactions', exact: true }).last().click();
  await expect(page).toHaveURL(/\/history$/); await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load more' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Load more' }).click();
  const last = page.locator('article').filter({ hasText: '#receipt-60' }); await last.scrollIntoViewIfNeeded();
  await expect(last.getByRole('link', { name: 'Print receipt' })).toBeVisible();
  await expect(last.getByRole('button', { name: 'Refund' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`transactions-${width}.png`) });
  await page.locator('article').filter({ hasText: '#receipt-0' }).getByRole('link', { name: 'View receipt' }).click();
  await expect(page).toHaveURL(/\/history\/receipt-0$/);
  await expect(page.getByText('Till: Agege Till 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Till: Current Till', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Print receipt' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('history works without a shift and cached receipts do not change local sales or stock', async ({ page }) => {
  await prepare(page, false, true, 2);
  await page.getByRole('link', { name: 'View receipt' }).first().click();
  await expect(page.getByRole('heading', { name: 'Transaction receipt' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const shell = await caches.open('ffpos-v2-shell');
    const page = await shell.match(window.location.pathname);
    return Boolean(page?.headers.get('content-type')?.includes('text/html'));
  }), { timeout: 15000 }).toBe(true);
  await page.context().setOffline(true); await page.reload();
  await expect(page.getByText('Offline/cached receipt.', { exact: false })).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('fudfarmer-pos', 4); request.onsuccess = () => resolve(request.result); });
    const count = await new Promise<number>(resolve => { const request = db.transaction('sales').objectStore('sales').count(); request.onsuccess = () => resolve(request.result); }); db.close(); return count;
  })).toBe(65);
});

test('long receipts continue over 58 mm pages and printing remains explicit and repeatable', async ({ page }, testInfo) => {
  await prepare(page, false, true, 1);
  await page.getByRole('link', { name: 'Print receipt' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
  await page.getByRole('button', { name: 'Print receipt' }).click();
  expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(2);
  await page.screenshot({ path: testInfo.outputPath('receipt-preview.png') });
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Print receipt' })).not.toBeVisible();
  const paper = page.locator('.receipt-paper');
  expect(await paper.evaluate(node => Math.abs(node.getBoundingClientRect().width - 48 * 96 / 25.4) < 1)).toBe(true);
  expect(await paper.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await expect(paper.getByText('Rice item 180', { exact: false })).toBeVisible();
  const pdf = await page.pdf({ path: testInfo.outputPath('long-receipt-58mm.pdf'), width: '58mm', height: '100mm', margin: { top: 0, left: 0, right: 0, bottom: 0 }, preferCSSPageSize: false });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBeGreaterThan(1);
});

test('manager dashboard scrolls as a page and prints a narrow multi-page report', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await prepare(page, true);
  await page.goto('/supervisor');
  await page.getByLabel('Trading date', { exact: true }).fill('2026-11-05');
  await page.getByRole('button', { name: /Transactions/ }).first().click();
  await expect(page.getByRole('button', { name: 'Back to POS' })).toBeVisible();
  await page.locator('.manager-data-record').last().scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Print manager report' }).click();
  await expect(page.getByRole('heading', { name: 'Manager daily report' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('manager-preview.png') });
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('.receipt-paper').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  const pdf = await page.pdf({ path: testInfo.outputPath('manager-report-58mm.pdf'), width: '58mm', height: '100mm' });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBeGreaterThan(1);
});

test('mid-shift report offers a paper-sized preview without closing the shift', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await prepare(page);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'View shift totals' }).click();
  await page.getByRole('button', { name: 'Preview / print' }).click();
  await expect(page.getByRole('heading', { name: 'Mid-shift report' })).toBeVisible();
  await expect(page.getByText('Mid-shift snapshot. Shift remains open.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mid-shift-preview.png') });
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('.receipt-paper').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.pdf({ path: testInfo.outputPath('mid-shift-58mm.pdf'), width: '58mm', height: '100mm' });
});

test('manager payment review queue remains accessible on the history page', async ({ page }) => {
  await prepare(page, true, true, 1);
  await expect(page.getByRole('heading', { name: 'Payments needing review' })).toBeVisible();
  await expect(page.getByText('Additional payment arrived after checkout completion')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('visiting normal pages preserves the cashier cart and selected customer', async ({ page }) => {
  await prepare(page, false, false, 1);
  await page.getByRole('button', { name: /Rice SKU/ }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Ada', exact: true }).click();
  await page.getByRole('button', { name: 'Close checkout' }).click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Transactions', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to POS' }).click();
  await expect(page.getByText('₦100.00 / Units', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByRole('dialog', { name: 'Customer checkout' })).toBeVisible();
  await expect(page.getByLabel('Customer name', { exact: true })).toHaveCount(0);
});

test('end-of-shift preview includes counted cash and printing never closes the shift', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 640 }); await prepare(page);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Close my shift' }).click();
  await page.getByLabel('Counted cash').fill('6510');
  await page.getByRole('button', { name: 'Preview / print' }).click();
  await expect(page.getByRole('heading', { name: 'End-of-shift report' })).toBeVisible();
  await expect(page.getByText('Counted cash', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Print report' }).click();
  await page.getByRole('button', { name: 'Print report' }).click();
  expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(2);
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('.receipt-paper').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.pdf({ path: testInfo.outputPath('close-shift-58mm.pdf'), width: '58mm', height: '100mm' });
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Back to report' }).click();
  expect(await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('fudfarmer-pos', 4); request.onsuccess = () => resolve(request.result); });
    const shift = await new Promise<{ status: string }>(resolve => { const request = db.transaction('shifts').objectStore('shifts').get('shift-test'); request.onsuccess = () => resolve(request.result); }); db.close(); return shift.status;
  })).toBe('open');
});

test('failed checkout settings never fall back to Bachs and Retry restores standard checkout', async ({ page }) => {
  await prepare(page);
  let fail = true;
  await page.route('**/pos/checkouts/options', route => route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { message: 'Unavailable' } : { methods: [{ id: 'manual', available: true }, { id: 'moniepoint', available: false, reason: 'No Moniepoint terminal configured for this till.' }, { id: 'squad', available: false, reason: 'Squad is not configured.' }] }) }));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry checkout settings' })).toBeAttached();
  fail = false;
  // The cart panel is hidden on phones, but this case uses the desktop viewport.
  await page.getByRole('button', { name: 'Retry checkout settings' }).click();
  await expect(page.getByRole('button', { name: 'Retry checkout settings' })).toHaveCount(0);
  await page.getByRole('button', { name: /Rice SKU/ }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Ada', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Customer checkout' })).toBeVisible();
  await expect(page.getByText('No Moniepoint terminal configured for this till.', { exact: true })).toBeVisible();
  await expect(page.getByText('Squad is not configured.', { exact: true })).toBeVisible();
  await expect(page.getByText('Bachs', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm payment received', exact: true })).toBeEnabled();
  await expect(page.getByText('Transfer received', { exact: true })).toHaveCount(0);
});
