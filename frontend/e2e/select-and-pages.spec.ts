import { test, expect } from '@playwright/test';
import { enter, expectNoPageScroll, fixture, pastGate } from './helpers';
const scenarios = fixture('scenarios');

test('story list shows a card for every scenario pack, with difficulty and language', async ({ page }) => {
  await pastGate(page);
  for (const s of (scenarios as any).scenarios) {
    const card = page.getByTestId(`scenario-${s.id}`);
    await expect(card).toContainText(s.name);
    await expect(card).toContainText(s.hazard_label);
  }
  await page.getByTestId('difficulty-hard').check();
  await page.getByTestId('language-select').selectOption('hi');
  const req = page.waitForRequest((r) => r.url().endsWith('/api/v1/sessions') && r.method() === 'POST');
  await page.getByTestId('start-dam-release-01').click();
  const body = (await req).postDataJSON();
  expect(body).toMatchObject({ scenario_id: 'dam-release-01', difficulty: 'hard', language: 'hi' });
});

test('each pack loads its own map and its own special order', async ({ page }) => {
  await enter(page, '', 'dam-release-01');
  await expect(page.getByTestId('dam')).toBeAttached();
  await page.getByTestId('group-protect').click();
  await expect(page.getByTestId('action-request_staggered_release')).toBeVisible();
  await expect(page.getByTestId('action-recall_fishing_boats')).toHaveCount(0);

  await page.getByTestId('home').click();
  await page.getByTestId('start-urban-flash-flood-01').click();
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('underpass')).toBeAttached();
  await expect(page.getByTestId('railway')).toBeAttached();
  await page.getByTestId('group-protect').click();
  await expect(page.getByTestId('action-clear_drains')).toBeVisible();

  await page.getByTestId('home').click();
  await page.getByTestId('start-cyclone-surge-01').click();
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('shelter-hill-school')).toBeAttached();
  await expect(page.getByTestId('hud-time')).toBeVisible();
});

test('pages switch by tabs, arrows, dots and keyboard', async ({ page }) => {
  await enter(page);
  const viewport = page.locator('.pager-track');
  await expect(page.getByTestId('tab-act')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('tab-village').click();
  await expect(page.getByTestId('tab-village')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('status-board')).toBeInViewport();
  await page.getByTestId('page-prev').click();
  await expect(page.getByTestId('tab-act')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('page-next').click();
  await expect(page.getByTestId('tab-village')).toHaveAttribute('aria-selected', 'true');
  // Keyboard arrows (focus outside text fields)
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('tab-act')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('tab-village')).toHaveAttribute('aria-selected', 'true');
  // Typing in a field does not switch pages
  await page.getByTestId('chat-input').fill('hello');
  await page.getByTestId('chat-input').press('ArrowLeft');
  await expect(page.getByTestId('tab-village')).toHaveAttribute('aria-selected', 'true');
  await expect(viewport).toBeAttached();
});

for (const [w, h] of [[360, 640], [1366, 768]] as const) {
  test(`no page scroll at ${w}x${h} on every screen`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await pastGate(page);
    await expectNoPageScroll(page);
    await page.getByTestId('start-village-river-01').click();
    await page.getByTestId('intro-skip').click();
    await expectNoPageScroll(page);
    await expect(page.getByTestId('hud')).toBeInViewport();
    await expect(page.getByTestId('emergency-footer')).toBeInViewport();
    await page.getByTestId('action-wait').click();
    await page.getByTestId('help-button').click();
    await expect(page.getByTestId('help-option').first()).toBeVisible();
    await expectNoPageScroll(page);
    await page.getByTestId('tab-village').click();
    await expectNoPageScroll(page);
    await expect(page.getByTestId('emergency-footer')).toBeInViewport();
  });
}
