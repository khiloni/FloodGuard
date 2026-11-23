import { test, expect } from '@playwright/test';
import { enter } from './helpers';

test('help lists options; choosing one only pre-fills the order', async ({ page }) => {
  await enter(page);
  await page.getByTestId('help-button').click();
  const opts = page.getByTestId('help-option');
  await expect(opts.first()).toBeVisible();
  expect(await opts.count()).toBeGreaterThanOrEqual(2);
  expect(await opts.count()).toBeLessThanOrEqual(3);
  await expect(page.getByTestId('help-panel').getByTestId('source-template')).toBeVisible();
  await opts.first().getByTestId('help-use').click();
  await expect(page.getByTestId('pending-order')).toBeVisible();
  await expect(page.getByTestId('timeline-tick')).toHaveText('0'); // nothing executed
  await page.getByTestId('pending-confirm').click();
  await expect(page.getByTestId('timeline-tick')).toHaveText('1');
  await expect(page.getByTestId('pending-order')).toHaveCount(0);
});

test('help works with the AI on (AI badge) and with the AI down (template)', async ({ page }) => {
  await enter(page, '?mock=llm');
  await page.getByTestId('help-button').click();
  await expect(page.getByTestId('help-panel').getByTestId('source-llm')).toBeVisible();

  await enter(page, '?mock=llmdown');
  await expect(page.getByTestId('llm-badge')).toContainText('offline');
  await page.getByTestId('help-button').click();
  await expect(page.getByTestId('help-panel').getByTestId('source-template')).toBeVisible();
  await page.getByTestId('help-use').first().click();
  await page.getByTestId('pending-confirm').click();
  await expect(page.getByTestId('timeline-tick')).toHaveText('1'); // fully playable without the AI
});

test('talking to a character shows a reply and a suggestion that never runs by itself', async ({ page }) => {
  await enter(page);
  await page.getByTestId('tab-village').click();
  for (const id of ['village_head', 'rescue_worker', 'family_member', 'health_worker', 'district_official']) {
    await expect(page.getByTestId(`npc-${id}`)).toBeVisible();
  }
  await page.getByTestId('npc-district_official').click();
  await page.getByTestId('chat-input').fill('Can the district help us?');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-lines')).toContainText('convoy');
  const sug = page.getByTestId('npc-suggestion');
  await expect(sug).toContainText('outside support');
  const tickAfterTalk = await page.getByTestId('timeline-tick').textContent();
  await page.getByTestId('adopt-suggestion').click();
  await expect(page.getByTestId('tab-act')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('pending-order')).toContainText('Suggested by');
  await expect(page.getByTestId('timeline-tick')).toHaveText(tickAfterTalk || '1');
});

test('outside support shows its delay and is requested as a turn', async ({ page }) => {
  await enter(page);
  await page.getByTestId('tab-village').click();
  const box = page.getByTestId('support-box');
  await expect(box).toContainText('arrives in');
  const req = page.waitForRequest((r) => r.url().includes('/turns'));
  await page.getByTestId('request-support').click();
  expect((await req).postDataJSON().input.action.name).toBe('request_external_support');
});
