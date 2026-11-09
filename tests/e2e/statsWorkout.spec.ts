import { createBlock } from '../../src/trainingBlocks';
import { test, expect, type Page } from '@playwright/test';
test.use({ timezoneId: 'Australia/Brisbane' });
const today = '2026-11-10';
const routines = ['Upper', 'Lower'].map((name, i) => ({ id: `r${i}`, name, exercises: [{ name: 'Squat', category: 'Legs', suggestedSets: 1, warmupCount: 0, suggestedWeight: 40, suggestedReps: 8, targetReps: '8-12', rationale: 'Controlled working set' }] }));
const appointment = (id: string, templateId: string, date = today) => ({ id, templateId, date, kind: 'workout' });
async function record(page: Page, key: string) {
 return page.evaluate(async key => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.get(key); }, key);
}
async function seed(page: Page, appointments: unknown[], exceptions = {}, blocks: unknown[] = []) {
 await page.clock.setFixedTime(new Date('2026-11-10T02:00:00Z'));
 await page.goto('/'); await page.getByRole('button', { name: /Skip for now/ }).click();
 await page.evaluate(async data => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); await storage.overwriteEverything(data); }, { ironflow_templates: routines, ironflow_blocks: blocks, ironflow_schedule: { appointments, exceptions, completions: [] } });
 await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click();
 await page.getByRole('button', { name: 'Stats', exact: true }).click();
}
test('Stats previews today’s workout without starting, then resumes the started session', async ({ page }) => {
 await seed(page, [appointment('today', 'r0'), appointment('tomorrow', 'r1', '2026-11-11')]);
 const before = await record(page, 'ironflow_schedule');
 await page.getByRole('button', { name: 'Go to workout', exact: true }).click();
 const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
 await expect(preview).toContainText('Upper'); expect(await record(page, 'ironflow_active_session')).toBeNull();
 await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
 expect(await record(page, 'ironflow_schedule')).toEqual(before);
 await page.getByRole('button', { name: 'Go to workout', exact: true }).click();
 await preview.getByRole('button', { name: 'Start this workout', exact: true }).click();
 await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.appointmentId).toBe('today@2026-11-10');
 const active = await record(page, 'ironflow_active_session');
 await page.getByRole('button', { name: 'Stats', exact: true }).click();
 await page.getByRole('button', { name: 'Go to workout', exact: true }).click();
 await expect(page.getByRole('button', { name: 'Discard workout', exact: true })).toBeVisible();
 expect(await record(page, 'ironflow_active_session')).toEqual(active);
 await expect(preview).toHaveCount(0);
});
test('Stats offers a choice among today’s planned workouts and excludes resolved dates', async ({ page }) => {
 await seed(page, [appointment('first', 'r0'), appointment('second', 'r1'), appointment('done', 'r0')], { 'done@2026-11-10': { status: 'completed' } });
 await page.getByRole('button', { name: 'Go to workout', exact: true }).click();
 const choice = page.getByRole('dialog', { name: 'Choose today’s workout', exact: true });
 await expect(choice.getByRole('button', { name: 'Upper', exact: true })).toHaveCount(1);
 await choice.getByRole('button', { name: 'Lower', exact: true }).click();
 const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
 await expect(preview).toContainText('Lower'); expect(await record(page, 'ironflow_active_session')).toBeNull();
 await preview.getByRole('button', { name: 'Start this workout', exact: true }).click();
 await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.appointmentId).toBe('second@2026-11-10');
});
test('Stats opens the empty Workout screen when no workout is planned today', async ({ page }) => {
 await seed(page, [appointment('future', 'r0', '2026-11-11')]);
 await page.getByRole('button', { name: 'Go to workout', exact: true }).click();
 await expect(page.getByRole('heading', { name: 'No Active Session', exact: true })).toBeVisible();
 expect(await record(page, 'ironflow_active_session')).toBeNull();
});
test('Stats explains an unavailable scheduled routine instead of starting another workout', async ({ page }) => {
 await seed(page, [appointment('missing', 'deleted')]);
 await page.getByRole('button', { name: 'Go to workout', exact: true }).click();
 const choice = page.getByRole('dialog', { name: 'Choose today’s workout', exact: true });
 await expect(choice.getByRole('button', { name: 'Routine unavailable', exact: true })).toBeDisabled();
 await expect(choice).toContainText('Review this appointment in Today');
 expect(await record(page, 'ironflow_active_session')).toBeNull();
});

test('Stats preview and start retain the scheduled block session identity', async ({ page }) => {
 const block = createBlock({ name: 'Strength block', goal: 'strength', daysPerWeek: 2, workoutsPerRound: 2, rounds: 2, minutes: 45, experience: 'intermediate', returning: false, equipment: 'Barbell', priorities: '', event: '' }, routines, 'double');
 const slot = block.sessions[0];
 await seed(page, [{ ...appointment('block-date', slot.template.id!), blockId: block.id, blockSessionId: slot.id }], {}, [block]);
 await page.getByRole('button', { name: 'Go to workout', exact: true }).click();
 const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
 await expect(preview).toContainText('Upper');
 expect((await record(page, 'ironflow_blocks'))[0].sessions[0].status).toBe('planned');
 await preview.getByRole('button', { name: 'Start this workout', exact: true }).click();
 await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.blockSessionId).toBe(slot.id);
 const active = await record(page, 'ironflow_active_session');
 expect(active.blockId).toBe(block.id); expect(active.appointmentId).toBe('block-date@2026-11-10');
});
