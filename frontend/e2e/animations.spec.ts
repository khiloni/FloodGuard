import { test, expect } from '@playwright/test';
import { enter, fixture } from './helpers';
const allEvents = fixture('all_events');

// The fixture holds one real recorded event of every engine event type.
const TYPES: string[] = (allEvents as any).events.map((e: any) => e.type);

test('there is one animation for every event type', async ({ page }) => {
  expect(TYPES.length).toBeGreaterThanOrEqual(33);
  await enter(page, '?mock=allEvents');
  await page.getByTestId('action-wait').click();
  await expect(page.getByTestId(`fx-${TYPES[0]}`)).toBeAttached();
  // One snapshot of the effect layer: every type present and drawing something.
  const drawn: Record<string, number> = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('[data-testid^="fx-"]')].map((el) => [
      (el as HTMLElement).dataset.testid!.slice(3), el.querySelectorAll('*').length,
    ])));
  for (const t of TYPES) {
    expect(drawn[t], `animation for ${t}`).toBeGreaterThan(0);
  }
  // Effects are temporary
  await expect(page.locator('[data-testid^="fx-"]')).toHaveCount(0, { timeout: 12000 });
});
