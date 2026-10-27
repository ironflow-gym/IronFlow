import { test, expect, type Page } from '@playwright/test';
const exercise = { name: 'Machine Press', category: 'Chest', suggestedSets: 3, warmupCount: 0, suggestedWeight: 30.06, suggestedReps: 8, targetReps: '8-12', restSeconds: 60 };
const routine = { id: 'daily-routine', name: 'Daily workout', exercises: [exercise] };
const draft = { id: 'daily-session', name: routine.name, status: 'active', startTime: Date.now(), exercises: [{ ...exercise, id: 'daily-press', sets: [1, 2, 3].map(n => ({ id: `daily-${n}`, weight: 30.06, reps: 8, unit: 'kgs', completed: false, timestamp: 0 })) }] };
async function seed(page: Page, active = true) {
  await page.goto('/'); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.evaluate(async data => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); await storage.overwriteEverything(data); }, { ironflow_templates: [routine], ...(active ? { ironflow_active_session: draft } : {}), ironflow_settings: { units: 'metric' }, ironflow_library: [{ name: exercise.name, category: 'Chest', muscles: ['Pectorals'], instructions: [], barWeight: 22.56, weightIncrement: 2.5, loadingMode: 'single' }] });
  await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click();
  if (active) await page.getByRole('region', { name: 'Next workout' }).getByRole('button', { name: 'Resume workout', exact: true }).click();
}
async function record(page: Page, key: string) { return page.evaluate(async key => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.get(key); }, key); }

test('narrow-screen logging stays compact and rest controls leave the current set usable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 }); await seed(page); await page.setViewportSize({ width: 320, height: 568 });
  expect((await page.getByTestId('set-daily-1').boundingBox())!.y).toBeLessThan(360);
  expect((await page.getByTestId('set-daily-2').boundingBox())!.height).toBeLessThanOrEqual(140);
  const controls = await page.getByTestId('set-daily-1').getByRole('button').all();
  for (const control of controls) { if (await control.isVisible()) { const box = (await control.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(43.5); } }
  await page.getByRole('button', { name: 'Complete set 1 for Machine Press', exact: true }).click();
  const timer = page.getByTestId('rest-timer'); await expect(timer).toBeVisible();
  for (const button of await timer.getByRole('button').all()) { const box = (await button.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44); }
  const second = page.getByRole('button', { name: 'Complete set 2 for Machine Press', exact: true }); await second.scrollIntoViewIfNeeded();
  expect(await second.evaluate(el => { const b = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)); })).toBe(true);
  await second.click(); await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[1].completed).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Finish stays reachable at the end of a workout and retains explicit exertion recording', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); await seed(page);
  for (const n of [1, 2, 3]) await page.getByRole('button', { name: `Complete set ${n} for Machine Press`, exact: true }).click();
  const finish = page.getByRole('button', { name: 'Finish workout', exact: true }); await expect(finish).toBeFocused();
  expect((await finish.boundingBox())!.y).toBeLessThan(180);
  await finish.click(); await page.getByRole('button', { name: '7', exact: true }).click(); await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect.poll(() => record(page, 'ironflow_active_session')).toBeNull();
  const logs = await record(page, 'ironflow_history'); expect(logs).toHaveLength(3); expect(logs.every((r: any) => r.sessionRPE === 7)).toBe(true);
});

for (const width of [360, 1440]) test(`workout edits at ${width}px require explicit timed values and confirm discarding`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await seed(page, false); await page.getByRole('button', { name: 'Manage routines', exact: true }).click(); await page.getByRole('button', { name: 'Manual Overhaul', exact: true }).click();
  const weight = page.getByLabel('Weight (kg)', { exact: true }); expect((await weight.boundingBox())!.width).toBeGreaterThan(140); await weight.fill('32.56');
  await page.getByRole('combobox', { name: 'Track', exact: true }).selectOption('time'); await expect(page.getByLabel('Duration (seconds)', { exact: true })).toBeEmpty();
  await page.getByLabel('Duration (seconds)', { exact: true }).fill('45');
  await page.keyboard.press('Escape'); const confirm = page.getByRole('dialog', { name: 'Discard workout edits', exact: true }); await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Keep editing', exact: true }).click(); await expect(page.getByLabel('Duration (seconds)', { exact: true })).toHaveValue('45'); expect((await record(page, 'ironflow_templates'))[0]).toEqual(routine);
  await page.getByRole('button', { name: width < 1024 ? 'Save workout' : 'Save', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_templates'))[0].exercises[0].targetReps).toBe('45 seconds');
  const saved = (await record(page, 'ironflow_templates'))[0].exercises[0]; expect(saved.tracking).toBe('time'); expect(saved.suggestedReps).toBe(45); expect(saved.suggestedWeight).toBe(32.56);
});
