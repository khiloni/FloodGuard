import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/** Open the app, pass the disclaimer gate and close the intro. */
export async function enter(page: Page, query = '') {
  await page.goto(`/${query}`);
  const gate = page.getByTestId('disclaimer-gate');
  await expect(gate).toBeVisible();
  await expect(page.getByTestId('gate-enter')).toBeDisabled();
  await page.getByTestId('gate-check').check();
  await page.getByTestId('gate-enter').click();
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('scene')).toBeVisible();
}

export async function waitAction(page: Page) {
  const before = await page.getByTestId('timeline-tick').textContent();
  await page.getByTestId('action-wait').click();
  await expect(page.getByTestId('timeline-tick')).not.toHaveText(before || '');
}

/** Load a recorded MSW fixture (same JSON the mock server returns). */
export function fixture(name: string): any {
  return JSON.parse(readFileSync(new URL(`../src/mocks/fixtures/${name}.json`, import.meta.url), 'utf8'));
}
