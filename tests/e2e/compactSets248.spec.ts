import { test, expect, type Page } from '@playwright/test';
const name = 'Machine Press';
const draft = { id: 'compact', name: 'Compact workout', status: 'active', startTime: Date.now(), exercises: [{ id: 'press', name, category: 'Chest', targetReps: '8-12', sets: [
  { id: 'first', weight: 30, reps: 8, unit: 'kgs', completed: false, timestamp: 0 },
  { id: 'second', weight: 30, reps: 8, unit: 'kgs', completed: false, timestamp: 0 },
  { id: 'done', weight: 30, reps: 8, unit: 'kgs', completed: true, timestamp: 1 },
] }] };
async function seed(page: Page, session: any = draft) {
  await page.goto('/'); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.evaluate(async draft => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); await storage.overwriteEverything({ ironflow_active_session: draft }); }, session);
  await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.getByRole('region', { name: 'Next workout' }).getByRole('button', { name: 'Resume workout', exact: true }).click();
}
async function record(page: Page) { return page.evaluate(async () => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.get('ironflow_active_session'); }); }
async function hold(page: Page, marker: ReturnType<Page['getByRole']>) {
  await marker.scrollIntoViewIfNeeded(); const box = (await marker.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
}

test('short taps cycle working, warmup and deload without dropdowns or extra delete controls', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); await seed(page);
  const marker = page.getByTestId('set-first').getByRole('button', { name: /^Set 1 type:/ });
  for (const kind of ['warmup', 'deload', 'working']) { await marker.click(); await expect(marker).toHaveAttribute('aria-label', new RegExp(`type: ${kind}`)); }
  await expect(page.getByRole('combobox', { name: /classification/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Delete set/ })).toHaveCount(0);
  await marker.focus(); await page.keyboard.press('Enter'); await expect(marker).toHaveAttribute('aria-label', /type: warmup/);
  await page.keyboard.press('Space'); await expect(marker).toHaveAttribute('aria-label', /type: deload/);
  expect((await record(page)).exercises[0].sets[0]).toMatchObject({ completed: false, weight: 30, reps: 8 });
});

test('holding the number arms deletion on the tick; release does not cycle or delete', async ({ page }) => {
  await seed(page); const marker = page.getByTestId('set-first').getByRole('button', { name: /^Set 1 type:/ });
  await hold(page, marker); await expect(marker).toHaveAttribute('aria-label', /type: working/);
  const tick = page.getByRole('button', { name: `Delete set 1 for ${name}`, exact: true });
  await expect(tick).toBeVisible(); expect((await record(page)).exercises[0].sets).toHaveLength(3);
  await expect(page.getByRole('dialog', { name: 'Delete set?' })).toHaveCount(0);
  await tick.click(); await expect.poll(async () => (await record(page)).exercises[0].sets.length).toBe(2);
  expect((await record(page)).exercises[0].sets.some((set: any) => set.id === 'first')).toBe(false);
});

test('Escape cancels armed deletion and completed sets cannot be armed for deletion', async ({ page }) => {
  await seed(page); const marker = page.getByTestId('set-second').getByRole('button', { name: /^Set 2 type:/ });
  await marker.focus(); await page.keyboard.press('Delete');
  await expect(page.getByRole('button', { name: `Delete set 2 for ${name}`, exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: `Complete set 2 for ${name}`, exact: true })).toBeVisible();
  await hold(page, page.getByTestId('set-done').getByRole('button', { name: /^Set 3 type:/ }));
  await expect(page.getByRole('button', { name: /^Delete set/ })).toHaveCount(0);
  expect((await record(page)).exercises[0].sets).toHaveLength(3);
  await expect(page.getByTestId('set-done').getByRole('button', { name: /^Set 3 type:/ })).toHaveAttribute('aria-label', /type: working/);
});

test('the toolbar icon applies only to its own exercise, with no extra button below the suggestion', async ({ page }) => {
  const second = { ...draft.exercises[0], id: 'second-exercise', name: 'Leg Press', sets: [{ id: 'leg', weight: 40, reps: 9, unit: 'kgs', completed: false, timestamp: 0 }] };
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page, { ...draft, exercises: [...draft.exercises, second] });
  const icon = page.getByRole('button', { name: 'Increase weight for Leg Press', exact: true });
  await icon.click(); const dialog = page.getByRole('dialog', { name: 'Increase weight', exact: true });
  await expect(dialog).toContainText('Leg Press');
  await dialog.getByRole('button', { name: 'Apply to this exercise', exact: true }).click();
  await expect.poll(async () => (await record(page)).exercises[1].sets[0].weight).toBeGreaterThan(40);
  expect((await record(page)).exercises[0].sets).toEqual(draft.exercises[0].sets);
  await expect(page.getByTestId('progression-Leg Press').getByRole('button', { name: /Increase weight/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
