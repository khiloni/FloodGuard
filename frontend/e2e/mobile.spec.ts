import { test, expect } from '@playwright/test';
import { enter } from './helpers';

test('usable at 360px: no horizontal scroll, scene and controls reachable', async ({ page }) => {
  await enter(page);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(360);
  await expect(page.getByTestId('scene')).toBeVisible();
  const btn = page.getByTestId('action-open_shelter');
  await btn.scrollIntoViewIfNeeded();
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44); // touch target
  await btn.tap();
  await expect(page.getByTestId('timeline-tick')).toHaveText('1');
  await expect(page.getByTestId('emergency-footer')).toBeVisible();
});

test('keyboard only: Tab to an action and press Enter', async ({ page }) => {
  await enter(page);
  const target = page.getByTestId('action-wait');
  let found = false;
  for (let i = 0; i < 80 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await target.evaluate((el) => el === document.activeElement);
  }
  expect(found).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('timeline-tick')).toHaveText('1');
});

async function swipe(page: import('@playwright/test').Page, selector: string, dx: number) {
  await page.locator(selector).first().evaluate((el, d) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const opts = (cx: number) => ({ bubbles: true, pointerType: 'touch', clientX: cx, clientY: y, pointerId: 7, isPrimary: true });
    el.dispatchEvent(new PointerEvent('pointerdown', opts(x)));
    el.dispatchEvent(new PointerEvent('pointerup', opts(x + d)));
  }, dx);
}

test('swipe switches pages; a swipe on the map does not', async ({ page }) => {
  await enter(page);
  await swipe(page, '[data-testid="caption"]', -150);
  await expect(page.getByTestId('tab-village')).toHaveAttribute('aria-selected', 'true');
  await swipe(page, '[data-testid="briefing"]', 150);
  await expect(page.getByTestId('tab-act')).toHaveAttribute('aria-selected', 'true');
  await swipe(page, '[data-testid="scene"]', -150);
  await expect(page.getByTestId('tab-act')).toHaveAttribute('aria-selected', 'true');
});
