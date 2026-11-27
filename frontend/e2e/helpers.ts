import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/** Open the app and pass the disclaimer gate (lands on the story list). */
export async function pastGate(page: Page, query = '', lens = false) {
  // Future Lens is on by default for players; most tests send orders directly.
  await page.addInitScript((on) => { window.localStorage.setItem('floodguard.lens', on ? '1' : '0'); }, lens);
  await page.goto(`/${query}`);
  const gate = page.getByTestId('disclaimer-gate');
  await expect(gate).toBeVisible();
  await expect(page.getByTestId('gate-enter')).toBeDisabled();
  await page.getByTestId('gate-check').check();
  await page.getByTestId('gate-enter').click();
  await expect(page.getByTestId('scenario-select')).toBeVisible();
}

/** Open the app, pass the gate, start a story and close the intro. */
export async function enter(page: Page, query = '', scenario = 'village-river-01', lens = false) {
  await pastGate(page, query, lens);
  await page.getByTestId(`start-${scenario}`).click();
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('scene')).toBeVisible();
}

/** The document itself never scrolls: only inner panels do. */
export async function expectNoPageScroll(page: Page) {
  const m = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight, ih: window.innerHeight,
    sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    bh: document.body.scrollHeight,
  }));
  expect(m.sh, 'page height').toBeLessThanOrEqual(m.ih);
  expect(m.bh, 'body height').toBeLessThanOrEqual(m.ih);
  expect(m.sw, 'page width').toBeLessThanOrEqual(m.iw);
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
