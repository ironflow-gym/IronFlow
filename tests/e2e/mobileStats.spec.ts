import { test, expect, type Page } from '@playwright/test';
import { createBlock } from '../../src/trainingBlocks';
test.use({ timezoneId: 'Australia/Brisbane' });
const base = { exercise: 'Squat', category: 'Legs', templateId: 'routine', templateName: 'Strength', weight: 60, reps: 8, unit: 'kgs' };
const history = [
  { ...base, date: '2026-10-01', sessionId: 'first' },
  { ...base, date: '2026-10-27', sessionId: 'second', weight: 65 },
  { ...base, date: '2026-10-27', sessionId: 'third', exercise: 'Bench Press', weight: 30 },
  { ...base, date: '2026-10-10', exercise: 'Old Curl', weight: 10 },
  { ...base, date: '2026-10-10', exercise: 'Old Row', templateName: 'Another old routine', weight: 10 },
];
async function seed(page: Page, data: Record<string, unknown> = {}) {
  await page.clock.setFixedTime(new Date('2026-10-27T02:00:00Z'));
  await page.goto('/'); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.evaluate(async data => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); await storage.overwriteEverything(data); }, { ironflow_history: history, ironflow_settings: { units: 'metric', weeklyWorkoutGoal: 3 }, ...data });
  await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click(); await page.getByRole('button', { name: 'Stats', exact: true }).click();
}
async function record(page: Page, key: string) { return page.evaluate(async key => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.get(key); }, key); }

test('mobile recent training counts same-day sessions and conservative legacy totals and shows comparable loads', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 }); await seed(page);
  const summary = page.getByRole('region', { name: 'Recent training progress', exact: true });
  await expect(summary.getByText('4', { exact: true })).toBeVisible(); await expect(summary.getByText('2 / 3', { exact: true })).toBeVisible();
  await expect(summary).toContainText('Squat: 60 → 65 kg × 8 reps');
  await summary.getByText('Weekly consistency and calculation', { exact: true }).click(); await expect(summary).toContainText('current week, still in progress');
  await page.getByText('All-time totals', { exact: true }).click(); const count = page.getByText('Total Workouts', { exact: true }).locator('..'); await expect(count).toContainText('4');
  const recovery = page.getByRole('region', { name: 'Recovery guidance', exact: true }); await expect(recovery).toContainText('No explicitly recorded lighter session'); await recovery.getByText('How this is calculated', { exact: true }).click(); await expect(recovery).toContainText('not programme progress');
  await expect(page.getByText(/Block week|Loading Block Status/)).toHaveCount(0);
  await page.screenshot({ path: '/tmp/stats-mobile-train.png' }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await record(page, 'ironflow_history')).toMatchObject(history); // Existing hydration may backfill muscle tags.
});

test('mobile weight summary exposes measured averages, dates and sparse fallback without future readings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const measurements = ['2026-10-15', '2026-10-17', '2026-10-20', '2026-10-22', '2026-10-24', '2026-10-27'].map(date => ({ date, weight: date < '2026-10-21' ? 80 : 79, unit: 'kgs', waist: date === '2026-10-15' ? 90 : date === '2026-10-27' ? 89 : undefined }));
  await seed(page, { ironflow_biometrics: [...measurements, { date: '2026-10-28', weight: 100, unit: 'kgs' }] }); await page.getByRole('button', { name: 'Bios', exact: true }).click();
  const trend = page.getByRole('region', { name: 'Body weight trend', exact: true }); await expect(trend).toContainText('7-day recorded average: 79.0 kg'); await expect(trend).toContainText('-1.0 kg versus the previous seven days'); await expect(trend).toContainText('Waist: -1.0 cm'); await expect(trend).not.toContainText('100.0 kg');
  await trend.getByText('How this is calculated', { exact: true }).click(); await expect(trend).toContainText('at least three distinct measurement days'); await page.screenshot({ path: '/tmp/stats-mobile-bios.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.clock.setFixedTime(new Date('2026-10-28T02:00:00Z')); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(trend).toContainText('100.0 kg'); await expect(trend).toContainText('today');
  await seed(page, { ironflow_biometrics: [{ date: '2026-09-01', weight: 80, unit: 'kgs' }, { date: '2026-09-08', weight: 79, unit: 'kgs' }] }); await page.getByRole('button', { name: 'Bios', exact: true }).click();
  await expect(trend).toContainText('Recorded change: -1.0 kg'); await expect(trend).toContainText('49 days ago'); await expect(trend).toContainText('Too few recent measurement days'); await expect(trend.getByRole('img')).toHaveCount(0);
});

test('recovery labels use recorded dates and viewing stats does not advance a training block', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const block = createBlock({ name: 'My programme', goal: 'strength', daysPerWeek: 3, workoutsPerRound: 1, rounds: 2, minutes: 45, experience: 'intermediate', returning: false, equipment: 'Barbell', priorities: '', event: '' }, [{ id: 'r', name: 'Strength', exercises: [{ name: 'Squat', category: 'Legs', suggestedSets: 3, suggestedReps: 8, suggestedWeight: 60, targetReps: '8-12', rationale: 'Controlled repetitions' }] }], 'double');
  await seed(page, { ironflow_blocks: [block], ironflow_history: [...history, { ...base, date: '2026-10-13', sessionId: 'lighter', isDeload: true }] });
  const recovery = page.getByRole('region', { name: 'Recovery guidance', exact: true }); await expect(recovery).toContainText('2 weeks since your last recorded lighter session'); await recovery.getByText('How this is calculated', { exact: true }).click(); await expect(recovery).toContainText('does not advance your training block');
  expect(await record(page, 'ironflow_blocks')).toEqual([block]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('desktop keeps its detailed panels and counts two sessions in the same week correctly', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await seed(page, { ironflow_biometrics: [{ date: '2026-10-27', weight: 79, bodyFat: 20, height: 175, unit: 'kgs' }] });
  await expect(page.getByRole('region', { name: 'Recent training progress', exact: true })).toHaveCount(0);
  await expect(page.getByText('2 / 3', { exact: true })).toBeVisible(); await expect(page.getByText('Loading Block Status', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Biometrics', exact: true }).click();
  await expect(page.getByText('Relative Strength and Composition Trajectory', { exact: true })).toBeVisible();
});
