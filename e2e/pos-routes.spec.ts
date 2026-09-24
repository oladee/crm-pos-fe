import { expect, test } from '@playwright/test';
import { loginAndOpenShift, loginAs, openShiftIfNeeded } from './helpers';

test.describe('POS route split', () => {
  test('unsigned / redirects to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login', { timeout: 15_000 });
    await expect(page.getByPlaceholder('Username')).toBeVisible();
  });

  test('cashier PIN login lands on /shift', async ({ page }) => {
    await loginAs(page, 'aisha', '1234');
    await expect(page).toHaveURL(/\/shift/);
    await expect(page.getByRole('heading', { name: 'No open shift' })).toBeVisible();
  });

  test('/sell without an open shift bounces to /shift', async ({ page }) => {
    await loginAs(page, 'aisha', '1234');
    await page.goto('/sell');
    await page.waitForURL('**/shift', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'No open shift' })).toBeVisible();
  });

  test('opening a shift goes to /sell', async ({ page }) => {
    await loginAndOpenShift(page, 'aisha', '1234');
    await expect(page.getByPlaceholder('Search product or SKU')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Charge' })).toBeDisabled();
  });

  test('cashier can sell on /sell and open /history', async ({ page }) => {
    await loginAndOpenShift(page, 'aisha', '1234');
    await page.getByRole('button', { name: /Goat Meat/ }).click();
    await expect(page.getByRole('button', { name: /Charge/ })).toBeEnabled();
    await page.getByRole('button', { name: /Charge/ }).click();
    await page.getByRole('button', { name: /Exact/ }).click();
    await page.getByRole('button', { name: /Complete sale/ }).click();
    await expect(page.getByText(/recorded/i)).toBeVisible({ timeout: 10_000 });

    await page.locator('div.fixed.inset-0').getByRole('button').first().click();
    await page.getByRole('button', { name: 'Sales & refunds' }).click();
    await page.waitForURL('**/history', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Sales' })).toBeVisible();
    await page.locator('h2', { hasText: 'Sales' }).locator('..').getByRole('button').first().click();
    await page.waitForURL('**/sell', { timeout: 10_000 });
  });

  test('cashier is kept off /settings and gated on /supervisor', async ({ page }) => {
    await loginAndOpenShift(page, 'aisha', '1234');
    await expect(page.getByRole('button', { name: 'POS settings' })).toHaveCount(0);

    await page.goto('/settings');
    await page.waitForURL('**/sell', { timeout: 10_000 });

    await page.goto('/supervisor');
    await page.waitForURL('**/supervisor', { timeout: 10_000 });
    await expect(page.getByText('Supervisor access')).toBeVisible();
  });

  test('admin reaches /settings and supervisor without a PIN gate', async ({ page }) => {
    await loginAndOpenShift(page, 'admin', '0000');
    await expect(page.getByRole('button', { name: 'POS settings' })).toBeVisible();

    await page.getByRole('button', { name: 'POS settings' }).click();
    await page.waitForURL('**/settings', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'POS Settings' })).toBeVisible();
    await expect(page.getByText('Store & receipt')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForURL('**/sell', { timeout: 10_000 });

    await page.getByRole('button', { name: /Supervisor/ }).click();
    await page.waitForURL('**/supervisor', { timeout: 10_000 });
    await expect(page.getByText('Supervisor access')).toHaveCount(0);
  });

  test('signed-in /login and / redirect to /sell; sign out returns to /login', async ({ page }) => {
    await loginAndOpenShift(page, 'aisha', '1234');

    await page.goto('/login');
    await page.waitForURL('**/sell', { timeout: 10_000 });

    await page.goto('/');
    await page.waitForURL('**/sell', { timeout: 10_000 });

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page.getByPlaceholder('Username')).toBeVisible();
  });
});
