import { test, expect, type Page } from '@playwright/test';
test.use({ timezoneId: 'Australia/Brisbane' });
const draft = { id: 'draft', name: 'Unfinished workout', status: 'active', restEndTime: null, restLabel: 'Rest', startTime: Date.now(), exercises: [{ id: 'press', name: 'Machine Press', category: 'Chest', sets: [{ id: 'set', weight: 30, reps: 8, unit: 'kgs', completed: false, timestamp: 0 }] }] };
async function dismiss(page: Page) {
  await page.getByRole('button', { name: /Skip for now/ }).click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
}
async function seed(page: Page, records: Record<string, unknown>) {
  await page.goto('/'); await dismiss(page);
  await page.evaluate(async data => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    await storage.overwriteEverything(data);
  }, records);
  await page.reload(); await dismiss(page);
}
for (const [device, width, height] of [['mobile', 390, 844], ['desktop', 1440, 1000]] as const) {
  test(`${device} navigation gives Food its own destination and preserves a food draft and unfinished workout`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seed(page, { ironflow_active_session: draft, ironflow_fuel: [
      { id: 'old', date: '2026-01-01', name: 'Old breakfast', calories: 380, protein: 13, carbs: 60, fats: 7, confidence: 1 },
    ] });
    const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
    await expect(navigation.getByRole('button')).toHaveText(['Today', 'Workout', 'Food', 'Stats']);
    await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Manage routines', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Back to Today', exact: true })).toBeVisible();
    await expect(navigation.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: 'Back to Today', exact: true }).click();
    await page.getByRole('button', { name: 'Resume workout', exact: true }).first().click();
    await navigation.getByRole('button', { name: 'Food', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Food', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Food pantry', exact: true })).toBeVisible();
    const placeholder = "Describe meals: '200g Lean Beef' or 'Oat milk latte'...";
    await page.getByPlaceholder(placeholder).click();
    await page.getByPlaceholder(placeholder).last().fill('Breakfast draft to keep');
    await navigation.getByRole('button', { name: 'Stats', exact: true }).click();
    await page.getByRole('button', { name: 'Nutrition', exact: true }).click();
    const review = page.getByRole('region', { name: 'Nutrition review', exact: true });
    await expect(review).toContainText('380 kcal');
    await expect(page.getByPlaceholder(placeholder)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Create saved meal', exact: true })).toHaveCount(0);
    await review.getByRole('button', { name: 'Open food log' }).click();
    await expect(page.getByPlaceholder(placeholder)).toHaveValue('Breakfast draft to keep');
    await navigation.getByRole('button', { name: 'Stats', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Nutrition review', exact: true })).toBeVisible();
    await navigation.getByRole('button', { name: 'Food', exact: true }).click();
    await page.getByRole('button', { name: /Thu, Jan 1/ }).click();
    await page.getByRole('button', { name: 'Edit Old breakfast', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Edit food entry', exact: true })).toBeVisible();
    await page.reload(); await dismiss(page);
    await navigation.getByRole('button', { name: 'Workout', exact: true }).click();
    await expect(page.getByTestId('set-set')).toBeVisible();
    expect(await page.evaluate(async () => {
      const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
      return storage.get('ironflow_active_session');
    })).toEqual(draft);
  });
}


test('returning to Food after local midnight refreshes today without resetting the food screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date('2026-10-26T13:59:00Z') });
  await seed(page, { ironflow_fuel: [
    { id: 'before', date: '2026-10-26', name: 'Before midnight', calories: 100, protein: 1, carbs: 1, fats: 1, confidence: 1 },
    { id: 'after', date: '2026-10-27', name: 'After midnight', calories: 200, protein: 2, carbs: 2, fats: 2, confidence: 1 },
  ] });
  await page.getByRole('button', { name: 'Food', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Today’s food totals', exact: true })).toContainText('100 kcal');
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.clock.fastForward(120000);
  await page.getByRole('button', { name: 'Food', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Today’s food totals', exact: true })).toContainText('200 kcal');
});
