import { test, expect, type Page } from '@playwright/test';
import { createBlock } from '../../src/trainingBlocks';
import { previewBlockSchedule } from '../../src/blockScheduling';
import { emptySchedule } from '../../src/scheduling';
test.use({ timezoneId: 'Australia/Brisbane' });
function fixture() {
  return createBlock({ name: 'Scheduling block', goal: 'strength', daysPerWeek: 3, workoutsPerRound: 3, rounds: 2, minutes: 45, experience: 'intermediate', returning: false, equipment: '', priorities: '', event: '' }, ['A','B','C'].map(name => ({ id: name, name, exercises: [{ name: 'Squat', category: 'Legs', suggestedSets: 2, targetReps: '8', suggestedReps: 8, suggestedWeight: 20, rationale: '' }] })), 'double');
}
async function seed(page: Page, scheduled = false, conflict = false) {
  const block = fixture();
  const schedule = scheduled ? previewBlockSchedule(emptySchedule(), block, { action: 'rebuild', start: '2026-11-03', weekdays: [2,4,6], scope: 'later', includeMissed: true, conflictPolicy: 'review' }, null, '2026-11-03').schedule : emptySchedule();
  if (conflict) schedule.appointments.push({ id: 'rest', kind: 'rest', date: '2026-11-03' });
  await page.clock.install({ time: new Date('2026-11-03T02:00:00Z') });
  await page.goto('/'); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.evaluate(async data => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); await storage.overwriteEverything(data); }, { ironflow_blocks: [block], ironflow_schedule: schedule });
  await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click();
  return block;
}
async function record(page: Page, key = 'ironflow_schedule') { return page.evaluate(async key => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.get(key); }, key); }
const assistant = (page: Page) => page.getByRole('dialog', { name: 'Scheduling assistant', exact: true });

test('schedule an already-started block at a different weekly frequency, reload, clear and undo', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); const block = await seed(page);
  await page.getByRole('button', { name: 'Scheduling assistant', exact: true }).click();
  const dialog = assistant(page);
  await dialog.getByRole('checkbox', { name: 'Tue', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'Thu', exact: true }).check();
  await dialog.getByRole('button', { name: 'Preview changes', exact: true }).click();
  await expect(dialog.getByRole('list', { name: 'Schedule changes' })).toContainText('2026-11-19');
  expect((await record(page)).appointments).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Apply 6 changes', exact: true }).click();
  await expect.poll(async () => (await record(page)).appointments.length).toBe(6);
  expect((await record(page, 'ironflow_blocks'))[0]).toEqual(block);
  await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.getByRole('button', { name: 'Scheduling assistant', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Tue', exact: true })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Sat', exact: true })).not.toBeChecked();
  await dialog.getByLabel('What would you like to do?', { exact: true }).selectOption('clear');
  await dialog.getByRole('button', { name: 'Preview changes', exact: true }).click();
  await expect(dialog).toContainText('The block stays intact');
  await dialog.getByRole('button', { name: 'Clear 6 dates', exact: true }).click();
  await expect.poll(async () => Object.values((await record(page)).exceptions).filter((e: any) => e.status === 'removed').length).toBe(6);
  expect((await record(page, 'ironflow_blocks'))[0]).toEqual(block);
  await page.getByRole('button', { name: 'Undo scheduling change', exact: true }).click();
  await expect.poll(async () => Object.keys((await record(page)).exceptions).length).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('moving Tuesday to Thursday cascades through the selected weekdays and cancellation writes nothing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await seed(page, true);
  const before = await record(page);
  await page.getByRole('button', { name: 'Move block workouts', exact: true }).first().click();
  const dialog = assistant(page);
  await dialog.getByLabel('Move to', { exact: true }).fill('2026-11-05');
  await dialog.getByRole('button', { name: 'Preview changes', exact: true }).click();
  await expect(dialog.getByRole('list', { name: 'Schedule changes' })).toContainText('2026-11-17');
  await page.screenshot({ path: '/tmp/ironflow-scheduling-preview.png' });
  await dialog.getByRole('button', { name: 'Cancel scheduling assistant', exact: true }).click();
  expect(await record(page)).toEqual(before);
  await page.getByRole('button', { name: 'Move block workouts', exact: true }).first().click();
  await dialog.getByLabel('Move to', { exact: true }).fill('2026-11-05');
  await dialog.getByRole('button', { name: 'Preview changes', exact: true }).click();
  await dialog.getByRole('button', { name: 'Apply 6 changes', exact: true }).click();
  await expect.poll(async () => Object.values((await record(page)).exceptions).map((e: any) => e.date).sort()).toEqual(['2026-11-05','2026-11-07','2026-11-10','2026-11-12','2026-11-14','2026-11-17']);
});

test('calendar conflicts require a choice and can move the plan to free training days', async ({ page }) => {
  await seed(page, false, true);
  await page.getByRole('button', { name: 'Scheduling assistant', exact: true }).click();
  const dialog = assistant(page);
  await dialog.getByRole('checkbox', { name: 'Tue', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'Thu', exact: true }).check();
  await expect(dialog.getByRole('button', { name: 'Preview changes', exact: true })).toBeDisabled();
  await expect(dialog).toContainText('Planned rest');
  await dialog.getByLabel('If a proposed day already has a workout or rest day', { exact: true }).selectOption('avoid');
  await dialog.getByRole('button', { name: 'Preview changes', exact: true }).click();
  await expect(dialog.getByRole('list', { name: 'Schedule changes' }).locator('li').first()).toContainText('2026-11-05');
  await dialog.getByRole('button', { name: 'Apply 6 changes', exact: true }).click();
  await expect.poll(async () => (await record(page)).appointments.length).toBe(7);
  expect((await record(page)).appointments.find((a: any) => a.id === 'rest')).toEqual({ id: 'rest', kind: 'rest', date: '2026-11-03' });
});
