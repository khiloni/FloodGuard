import { test, expect } from '@playwright/test';
import { enter } from './helpers';

test('Future Lens previews both futures, shows one on the map, and runs nothing until confirmed', async ({ page }) => {
  await enter(page, '', 'village-river-01', true);
  await expect(page.getByTestId('lens-toggle')).toBeChecked();
  await page.getByTestId('action-open_shelter').click();
  const pick = page.getByTestId('param-picker');
  if (await pick.isVisible()) await page.getByTestId('picker-confirm').click();
  await expect(page.getByTestId('pending-order')).toBeVisible();
  const lens = page.getByTestId('future-lens');
  await expect(lens).toContainText('If you wait');
  await expect(page.getByTestId('timeline-tick')).toHaveText('0'); // nothing executed yet
  await page.getByTestId('lens-peek-with_order').click();
  await expect(page.getByTestId('future-badge')).toBeVisible();
  await page.getByTestId('pending-confirm').click();
  await expect(page.getByTestId('timeline-tick')).toHaveText('1');
  await expect(page.getByTestId('future-badge')).toHaveCount(0);
});
