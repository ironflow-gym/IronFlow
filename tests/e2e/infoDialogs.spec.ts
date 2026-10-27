import { test, expect, type Page } from '@playwright/test';
import { localDate, addDays } from '../../src/scheduling';
test.use({ timezoneId: 'Australia/Brisbane' });
async function start(page: Page, data: Record<string, unknown> = {}) {
  await page.goto('/'); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.evaluate(async data => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); await storage.overwriteEverything(data); }, data);
  await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click();
}
async function snapshot(page: Page) { return page.evaluate(async () => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.getEverything(); }); }
async function information(page: Page, title: string) {
  const trigger = page.getByRole('button', { name: `About ${title}`, exact: true }).first();
  const box = (await trigger.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: title, exact: true }); await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.keyboard.press('Tab'); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
}

test('nested food information preserves a dirty form, stays read-only and does not trigger discard', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await start(page);
  await page.getByRole('button', { name: 'Food', exact: true }).click();
  await page.getByRole('button', { name: 'Log food manually', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Log food manually', exact: true });
  await editor.getByLabel('Food name', { exact: true }).fill('Unsaved breakfast');
  await editor.getByLabel('Calories (kcal)', { exact: true }).fill('320');
  const before = await snapshot(page);
  await information(page, 'Manual food totals');
  await expect(editor.getByLabel('Food name', { exact: true })).toHaveValue('Unsaved breakfast');
  await expect(editor.getByLabel('Calories (kcal)', { exact: true })).toHaveValue('320');
  await expect(page.getByRole('dialog', { name: 'Discard food changes' })).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
});

test('block setup and Food target information preserve selections without applying changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await start(page);
  await information(page, 'Training calendar');
  await page.getByRole('button', { name: 'Manage routines', exact: true }).click();
  await page.getByRole('button', { name: 'Create training block', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Create training block', exact: true });
  await builder.getByLabel('Block name', { exact: true }).fill('Draft block');
  await builder.getByLabel('Training days per week', { exact: true }).fill('3');
  await information(page, 'Days, workouts and rounds');
  await expect(builder.getByLabel('Block name', { exact: true })).toHaveValue('Draft block');
  await expect(builder.getByLabel('Training days per week', { exact: true })).toHaveValue('3');
  await page.getByRole('button', { name: 'Close block setup', exact: true }).click();
  await page.getByRole('button', { name: 'Discard setup', exact: true }).click();
  await page.getByRole('button', { name: 'Food', exact: true }).click();
  await page.getByText('Today’s totals and targets', { exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Calorie adjustment' }); await slider.fill('1.12');
  const before = await snapshot(page); await information(page, 'Food targets and preferences');
  await expect(slider).toHaveValue('1.12'); expect(await snapshot(page)).toEqual(before);
});

test('desktop chart information uses accessible modals with audited definitions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const today = localDate();
  await start(page, { ironflow_history: [{ date: today, exercise: 'Squat', category: 'Legs', weight: 60, reps: 8, unit: 'kgs', sessionId: 's' }], ironflow_biometrics: [0, 7, 14].map(days => ({ date: addDays(today, -days), weight: 80, unit: 'kgs', height: 180, bodyFat: 20 })) });
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await information(page, 'Weekly tonnage'); await information(page, 'Acute:Chronic Workload Ratio'); await information(page, 'Muscle volume landmarks');
  await page.getByRole('button', { name: 'Biometrics', exact: true }).click();
  await information(page, 'Relative strength references'); await information(page, 'Composition projection');
});
