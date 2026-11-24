import { test, expect } from '@playwright/test';
import { enter } from './helpers';

test('ambiguous text asks to clarify; choosing an option advances time', async ({ page }) => {
  await enter(page);
  await page.getByTestId('command-input').fill('do something useful');
  await page.getByTestId('command-send').click();
  await expect(page.getByTestId('clarify')).toBeVisible();
  const options = page.getByTestId('clarify-option');
  expect(await options.count()).toBeGreaterThan(1);
  await expect(page.getByTestId('timeline-tick')).toHaveText('0');
  await options.first().click();
  await expect(page.getByTestId('timeline-tick')).toHaveText('1');
  await expect(page.getByTestId('clarify')).toHaveCount(0);
});

test('example chip runs a command', async ({ page }) => {
  await enter(page);
  await page.getByTestId('example-chip').first().click();
  await expect(page.getByTestId('timeline-tick')).toHaveText('1');
});

test('rejected order is explained and time does not pass', async ({ page }) => {
  await enter(page);
  await page.getByTestId('command-input').fill('restore power');
  await page.getByTestId('command-send').click();
  await expect(page.getByTestId('msg-reject').last()).toContainText('Recovery actions');
  await expect(page.getByTestId('timeline-tick')).toHaveText('0');
});

test('real emergency stops the simulation and shows 112 and 1078', async ({ page }) => {
  await enter(page);
  await page.getByTestId('command-input').fill('this is a real emergency, I am actually trapped');
  await page.getByTestId('command-send').click();
  const screen = page.getByTestId('real-emergency');
  await expect(screen).toBeVisible();
  await expect(screen).toContainText('112');
  await expect(screen).toContainText('1078');
  await expect(page.getByRole('link', { name: /Call 112/ })).toHaveAttribute('href', 'tel:112');
  await page.getByRole('button', { name: /return to the simulation/i }).click();
  await expect(screen).toHaveCount(0);
  await expect(page.getByTestId('timeline-tick')).toHaveText('0');
});
