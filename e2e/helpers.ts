import { expect, type Page } from '@playwright/test';

export async function enterPin(page: Page, pin: string) {
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

export async function loginAs(page: Page, username: string, pin: string) {
  await page.goto('/login');
  await expect(page.getByText('Store checkout')).toBeVisible();
  await page.getByPlaceholder('Username').fill(username);
  await enterPin(page, pin);
  await page.waitForURL(/\/(shift|sell)/, { timeout: 15_000 });
}

export async function openMore(page: Page) {
  await page.getByRole('button', { name: 'More actions' }).click();
}

export async function openShiftIfNeeded(page: Page) {
  if (page.url().includes('/sell')) return;
  await expect(page.getByRole('heading', { name: 'Ready to start selling?' })).toBeVisible();
  await page.getByRole('button', { name: 'Start my shift' }).click();
  await page.getByRole('button', { name: /Start shift/ }).click();
  await page.waitForURL('**/sell', { timeout: 10_000 });
}

export async function loginAndOpenShift(page: Page, username: string, pin: string) {
  await loginAs(page, username, pin);
  await openShiftIfNeeded(page);
  await expect(page).toHaveURL(/\/sell/);
}
