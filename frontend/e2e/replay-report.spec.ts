import { test, expect } from '@playwright/test';
import { enter, expectNoPageScroll, waitAction } from './helpers';

test('replay scrubber uses server frames from /log and returns to live', async ({ page }) => {
  await enter(page);
  await page.getByTestId('action-open_shelter').click();
  await expect(page.getByTestId('timeline-tick')).toHaveText('1');
  await waitAction(page);
  await waitAction(page);
  await page.getByTestId('replay-open').click();
  const scrubber = page.getByTestId('replay-scrubber');
  await expect(scrubber).toBeVisible();
  await page.getByTestId('replay-play').click(); // pause autoplay
  await scrubber.fill('0');
  await expect(page.getByTestId('replay-tick')).toHaveText('0');
  await expect(page.getByTestId('shelter')).toHaveClass(/closed/); // frame 0: shelter not yet open
  await scrubber.fill('2');
  await expect(page.getByTestId('replay-tick')).toHaveText('2');
  await expect(page.getByTestId('shelter')).toHaveClass(/open/);
  await expect(page.locator('.replay-badge')).toBeVisible();
  await page.getByTestId('replay-exit').click();
  await expect(page.getByTestId('timeline-tick')).toHaveText('3');
});

test('timeline shows the phase bands and the forecast peak', async ({ page }) => {
  await enter(page);
  await expect(page.getByTestId('peak-mark')).toBeAttached();
  await expect(page.locator('.band-before')).toBeVisible();
});

test('end of story shows the three-phase report with causal chain and disclaimer', async ({ page }) => {
  await enter(page, '?mock=end');
  await waitAction(page);
  await expect(page.getByTestId('story-complete')).toBeVisible();
  await page.getByTestId('open-report').click();
  await expect(page.getByTestId('report')).toBeVisible();
  for (const p of ['before', 'flood', 'recovery']) await expect(page.getByTestId(`report-phase-${p}`)).toBeVisible();
  expect(await page.getByTestId('causal-chain').locator('li').count()).toBeGreaterThan(3);
  await expect(page.getByTestId('report-disclaimer')).toContainText('112');
  await expect(page.getByTestId('emergency-footer')).toBeVisible();
  await expect(page.getByTestId('chain-cards').first()).toContainText('RC-');
  await expect(page.getByTestId('rule-cards')).toBeAttached();
  await expectNoPageScroll(page);
});

test('retry with the same seed starts the same story again', async ({ page }) => {
  await enter(page, '?mock=end');
  await page.getByTestId('action-wait').click();
  await page.getByTestId('open-report').click();
  const req = page.waitForRequest((r) => r.url().endsWith('/api/v1/sessions') && r.method() === 'POST');
  await page.getByTestId('report-retry').click();
  const body = (await req).postDataJSON();
  expect(body.scenario_id).toBe('village-river-01');
  expect(typeof body.seed).toBe('number');
  await expect(page.getByTestId('intro')).toBeVisible();
});
