import { test, expect } from '@playwright/test';
import { enter, waitAction, fixture } from './helpers';
const session = fixture('session');

test('disclaimer gate blocks the game and the emergency footer is always visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('emergency-footer')).toContainText('112');
  await expect(page.getByTestId('emergency-footer')).toContainText('1078');
  await expect(page.getByTestId('disclaimer-gate')).toContainText('not emergency guidance');
  await expect(page.getByTestId('scene')).toHaveCount(0);
  await expect(page.getByTestId('gate-enter')).toBeDisabled();
});

test('village scene is drawn from the API layout', async ({ page }) => {
  await enter(page);
  const layout = (session as any).layout;
  for (const z of layout.zones) {
    await expect(page.getByTestId(`zone-${z.id}`)).toBeVisible();
    await expect(page.getByTestId(`route-${z.id}`)).toBeAttached();
  }
  await expect(page.getByTestId('river')).toBeAttached();
  await expect(page.getByTestId('embankment')).toBeAttached();
  await expect(page.getByTestId('shelter')).toBeAttached();
  await expect(page.getByTestId('gauge')).toContainText(`${(session as any).summary.water_level_cm} cm`);
  // Screen-reader description comes from the API summary
  await expect(page.locator('#scene-desc')).toContainText('Ward 1');
  await expect(page.getByTestId('llm-badge')).toContainText('AI off');
  await expect(page.getByTestId('phase-chip')).toContainText('Before the flood');
});

test('turn updates the scene, narration has a source badge and is announced', async ({ page }) => {
  await enter(page);
  await page.getByTestId('action-open_shelter').click();
  await expect(page.getByTestId('timeline-tick')).toHaveText('1');
  await expect(page.getByTestId('shelter')).toHaveClass(/open/);
  await expect(page.getByTestId('caption')).toContainText('Shelter');
  await expect(page.getByTestId('msg-narration').last()).toBeAttached();
  await expect(page.getByTestId('source-template').first()).toBeVisible();
  await expect(page.getByTestId('live-narration')).toContainText('Shelter');
});

test('parameter picker sends an action with a ward', async ({ page }) => {
  await enter(page);
  await waitAction(page);
  await waitAction(page);
  await page.getByTestId('action-order_evacuation').click();
  await expect(page.getByTestId('param-picker')).toBeVisible();
  await page.getByTestId('param-picker').getByRole('radio', { name: 'Ward 1 (Lowland Riverside)' }).check();
  await page.getByTestId('picker-confirm').click();
  await expect(page.getByTestId('timeline-tick')).toHaveText('3');
});

test('unavailable recovery action explains why instead of acting', async ({ page }) => {
  await enter(page);
  await page.getByTestId('group-recover').click();
  await page.getByTestId('action-provide_clean_water').click();
  await expect(page.getByTestId('caption')).toContainText('Available after the flood');
  await expect(page.getByTestId('timeline-tick')).toHaveText('0');
});

test('LLM mode shows AI badges and the may-be-wrong label', async ({ page }) => {
  await enter(page, '?mock=llm');
  await expect(page.getByTestId('llm-badge')).toContainText('AI on');
  await expect(page.getByTestId('ai-label')).toContainText('may be wrong');
  await waitAction(page);
  await expect(page.getByTestId('source-llm').first()).toContainText('AI');
});

test('cold start shows the waking-up screen', async ({ page }) => {
  await page.goto('/?mock=slow');
  await expect(page.getByTestId('waking-up')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('disclaimer-gate')).toBeVisible({ timeout: 10000 });
});

test('reduced motion still shows effects, without movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await expect(page.locator('.app')).toHaveClass(/reduced/);
  await page.getByTestId('action-open_shelter').click();
  await expect(page.getByTestId('fx-shelter_opened')).toBeAttached();
  await expect(page.locator('.fx-move')).toHaveCount(0);
});
