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
  // New scenario events have their own drawings, not the generic label.
  const NEW_TYPES = ['support_arrived', 'support_requested', 'resource_depleted', 'drains_cleared', 'drain_overflow',
    'dam_release_notice', 'dam_release_started', 'release_staggered', 'fishing_boats_recalled', 'fishing_boats_returned',
    'cyclone_landfall', 'fishers_stranded'];
  for (const t of NEW_TYPES) expect(TYPES, t).toContain(t);
  expect(await page.getByTestId('fx-support_arrived').locator('.fx-move').count(), 'convoy of trucks').toBeGreaterThanOrEqual(3);
  expect(await page.getByTestId('fx-embankment_reinforced').locator('rect').count(), 'stacked sandbags').toBeGreaterThan(3);
  // Effects are temporary
  await expect(page.locator('[data-testid^="fx-"]')).toHaveCount(0, { timeout: 12000 });
});
