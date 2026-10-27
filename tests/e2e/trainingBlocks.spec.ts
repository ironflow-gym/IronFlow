import { test, expect, type Page } from '@playwright/test';
import { createBlock, blockModeForGoal } from '../../src/trainingBlocks';
import type { BlockGoal } from '../../types';
import { localDate, addDays } from '../../src/scheduling';
test.use({ timezoneId: 'Australia/Brisbane' });
const exercise = { name: 'Machine Press', category: 'Chest', suggestedSets: 2, warmupCount: 0, suggestedWeight: 30.06, suggestedReps: 8, targetReps: '8-12', rationale: 'Control the movement', restSeconds: 60 };
const routines = ['A', 'B', 'C', 'D'].map((name, i) => ({ id: `routine-${i}`, name: `Workout ${name}`, exercises: [exercise] }));
const machine = { name: exercise.name, category: 'Chest', muscles: ['Pectorals'], instructions: [], benefits: '', risks: '', barWeight: 22.56, weightIncrement: 2.5, loadingMode: 'single' };
async function dismiss(page: Page) { await page.getByRole('button', { name: /Skip for now/ }).click(); }
async function seed(page: Page, data: Record<string, unknown> = {}) {
  await page.goto('/'); await dismiss(page);
  await page.evaluate(async data => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); await storage.overwriteEverything(data); }, { ironflow_templates: routines, ironflow_library: [machine], ...data });
  await page.reload(); await dismiss(page);
}
async function record(page: Page, key: string) { return page.evaluate(async key => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.get(key); }, key); }
async function setup(page: Page, goal = 'strength', count = 4, rounds = 2) {
  await page.getByRole('button', { name: 'Manage routines', exact: true }).click();
  await page.getByRole('button', { name: 'Create training block', exact: true }).click();
  const wizard = page.getByRole('dialog', { name: 'Create training block', exact: true });
  await wizard.getByLabel('Block name', { exact: true }).fill('My training block'); await wizard.getByRole('combobox', { name: 'Primary goal', exact: true }).selectOption(goal);
  await wizard.getByLabel('Training days per week', { exact: true }).fill('3'); await wizard.getByLabel('Different workouts per round', { exact: true }).fill(String(count)); await wizard.getByLabel('Number of rounds', { exact: true }).fill(String(rounds)); await wizard.getByLabel('Minutes per workout', { exact: true }).fill('45');
  await wizard.getByRole('combobox', { name: 'Training experience', exact: true }).selectOption('intermediate'); await wizard.getByLabel('Available equipment', { exact: true }).fill('Machine press, dumbbells');
  await wizard.getByRole('button', { name: 'Choose workouts', exact: true }).click(); return wizard;
}
async function create(page: Page, goal = 'strength', count = 4, rounds = 2) {
  const wizard = await setup(page, goal, count, rounds); await wizard.getByText('Choose saved routines', { exact: true }).click();
  for (const routine of routines.slice(0, count)) await wizard.getByRole('checkbox', { name: routine.name, exact: true }).check();
  await wizard.getByRole('button', { name: 'Review block', exact: true }).click(); return wizard;
}
async function closeManager(page: Page) { await page.getByRole('button', { name: 'Close training block', exact: true }).click(); await page.getByRole('button', { name: 'Today', exact: true }).click(); }
async function finish(page: Page, sets = 2) {
  for (let i = 1; i <= sets; i++) await page.getByRole('button', { name: `Complete set ${i} for ${exercise.name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click(); await page.getByRole('button', { name: 'Skip', exact: true }).click();
}

test('four workouts across three training days repeat by rounds and save completion atomically', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await seed(page);
  const wizard = await create(page); await expect(wizard).toContainText('4 workouts × 2 rounds = 8 sessions');
  expect(await record(page, 'ironflow_blocks')).toBeNull();
  await wizard.getByRole('button', { name: 'Start block', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_blocks'))?.[0]?.sessions?.length).toBe(8);
  await closeManager(page);
  await expect(page.getByRole('region', { name: 'Next workout', exact: true })).toContainText('Workout A');
  await expect(page.getByRole('region', { name: 'Next workout', exact: true })).toContainText('Next block session');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click(); await finish(page);
  await expect.poll(async () => (await record(page, 'ironflow_blocks'))?.[0]?.sessions[0]?.status).toBe('completed');
  expect(await record(page, 'ironflow_active_session')).toBeNull();
  expect((await record(page, 'ironflow_history')).every((row: any) => row.blockSessionFulfilled === true)).toBe(true);
  await page.getByRole('button', { name: 'Today', exact: true }).click(); await expect(page.getByRole('region', { name: 'Next workout' })).toContainText('Workout B');
  expect((await record(page, 'ironflow_templates'))).toEqual(routines);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

function fixture(goal: BlockGoal = 'strength', count = 2, rounds = 2) {
  return createBlock({ name: 'Fixture block', goal, daysPerWeek: 3, workoutsPerRound: count, rounds, minutes: 45, experience: 'intermediate', returning: false, equipment: 'Machine press', priorities: '', event: '' }, routines.slice(0, count).map(t => ({ ...t, weightUnit: 'kgs' as const })), blockModeForGoal(goal));
}
async function openBlock(page: Page) { await page.getByRole('button', { name: 'Today', exact: true }).click(); await page.getByRole('region', { name: 'Active training block', exact: true }).getByRole('button').click(); return page.getByRole('dialog', { name: 'Training block', exact: true }); }

test('partial workouts require explicit acceptance; logging only keeps the block session unresolved', async ({ page }) => {
  const block = fixture(); const today = localDate(); const appointment = { id: 'partial-appointment', date: today, kind: 'workout', templateId: block.sessions[0].template.id, blockId: block.id, blockSessionId: block.sessions[0].id };
  await seed(page, { ironflow_blocks: [block], ironflow_schedule: { appointments: [appointment], exceptions: {}, completions: [] } });
  await page.getByRole('region', { name: 'Next workout', exact: true }).getByRole('button', { name: 'Start workout', exact: true }).click(); await finish(page, 1);
  const partial = page.getByRole('dialog', { name: 'Partial block workout', exact: true });
  await expect(partial).toBeVisible(); expect((await record(page, 'ironflow_blocks'))[0].sessions[0].status).toBe('planned');
  await partial.getByRole('button', { name: 'Log workout only', exact: true }).click();
  await expect.poll(async () => await record(page, 'ironflow_active_session')).toBeNull();
  expect((await record(page, 'ironflow_blocks'))[0].sessions[0].status).toBe('planned');
  expect((await record(page, 'ironflow_schedule')).exceptions[`${appointment.id}@${today}`]?.status).not.toBe('completed');
  await page.getByRole('button', { name: 'Today', exact: true }).click(); await page.getByRole('region', { name: 'Next workout', exact: true }).getByRole('button', { name: 'Start workout', exact: true }).click(); await finish(page, 1);
  await partial.getByRole('button', { name: 'Count towards block', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_blocks'))[0].sessions[0].status).toBe('completed');
  expect((await record(page, 'ironflow_blocks'))[0].sessions[0].partial).toBe(true);
  const logs = await record(page, 'ironflow_history'); expect(logs.filter((h: any) => h.blockSessionFulfilled)).toHaveLength(1); expect(logs.filter((h: any) => !h.blockSessionFulfilled)).toHaveLength(1);
});

test('out-of-order sessions and explicit skip/undo preserve the earliest unresolved session', async ({ page }) => {
  const block = fixture(); await seed(page, { ironflow_blocks: [block] });
  const manager = await openBlock(page); await manager.getByRole('combobox', { name: 'View round', exact: true }).selectOption('2');
  await manager.getByRole('article', { name: 'Round 2 of 2 · Workout B', exact: true }).getByRole('button', { name: 'Start session', exact: true }).click(); await finish(page);
  await expect.poll(async () => (await record(page, 'ironflow_blocks'))[0].sessions[3].status).toBe('completed');
  await page.getByRole('button', { name: 'Today', exact: true }).click(); await expect(page.getByRole('region', { name: 'Next workout' })).toContainText('Workout A');
  await page.getByRole('button', { name: 'View block', exact: true }).click(); const first = manager.getByRole('article', { name: 'Round 1 of 2 · Workout A', exact: true });
  await first.getByText('Session details and options', { exact: true }).click(); await first.getByRole('button', { name: 'Skip session', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Confirm block action', exact: true }); await confirmation.getByRole('button', { name: 'Skip session', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_blocks'))[0].sessions[0].status).toBe('skipped');
  await first.getByRole('button', { name: 'Undo skip', exact: true }).click(); await expect.poll(async () => (await record(page, 'ironflow_blocks'))[0].sessions[0].status).toBe('planned');
});

test('calendar conflicts are explicit, multiple same-day workouts work and existing appointments retain priority', async ({ page }) => {
  const block = fixture('strength', 2, 1); const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await seed(page, { ironflow_blocks: [block], ironflow_schedule: { appointments: [{ id: 'existing', date: today, kind: 'workout', templateId: routines[0].id }], exceptions: {}, completions: [] } });
  const manager = await openBlock(page);
  for (const letter of ['A', 'B']) {
    const card = manager.getByRole('article', { name: `Round 1 of 1 · Workout ${letter}`, exact: true }); await card.getByText('Session details and options', { exact: true }).click(); await card.getByRole('button', { name: 'Schedule', exact: true }).click();
    const scheduling = page.getByRole('dialog', { name: 'Schedule block sessions', exact: true });
    await expect(scheduling.getByText('Existing appointments overlap', { exact: true })).toBeVisible(); await expect(scheduling.getByRole('button', { name: 'Save block appointments', exact: true })).toBeDisabled();
    await scheduling.getByRole('checkbox', { name: 'Keep existing appointments and add these sessions', exact: true }).check(); await scheduling.getByRole('button', { name: 'Save block appointments', exact: true }).click();
  }
  await closeManager(page); const schedule = await record(page, 'ironflow_schedule'); expect(schedule.appointments).toHaveLength(3);
  await expect(page.getByRole('region', { name: 'Next workout' })).toContainText('Scheduled today');
  const linked = schedule.appointments.find((a: any) => a.blockSessionId === block.sessions[1].id);
  await page.getByTestId(`appointment-${linked.id}@${linked.date}`).getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.blockSessionId).toBe(block.sessions[1].id); await finish(page);
  await expect.poll(async () => (await record(page, 'ironflow_blocks'))[0].sessions[1].status).toBe('completed');
  expect((await record(page, 'ironflow_schedule')).exceptions['existing@' + today]).toBeUndefined();
});

test('Food changes require approval and restoring previous settings compares newer manual adjustments', async ({ page }) => {
  const profile = { goal: 'Maintenance', preferences: ['Vegetarian'], targetProteinRatio: 1.6, targetMultiplier: 1.1, region: 'Australia' };
  await seed(page, { ironflow_fuel_profile: profile }); let wizard = await create(page, 'muscle', 1, 1);
  const approval = wizard.getByRole('checkbox', { name: 'Apply these Food changes when starting the block', exact: true }); await expect(approval).not.toBeChecked();
  await wizard.getByRole('button', { name: 'Start block', exact: true }).click(); await expect.poll(async () => (await record(page, 'ironflow_blocks'))?.length).toBe(1); expect(await record(page, 'ironflow_fuel_profile')).toEqual(profile);
  await seed(page, { ironflow_fuel_profile: profile }); wizard = await create(page, 'muscle', 1, 1);
  await wizard.getByRole('checkbox', { name: 'Apply these Food changes when starting the block', exact: true }).check(); await wizard.getByRole('button', { name: 'Start block', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_fuel_profile'))?.goal).toBe('Build Muscle'); expect((await record(page, 'ironflow_blocks'))[0].nutrition.previous).toEqual(profile);
  await page.getByRole('button', { name: 'Close training block', exact: true }).click(); await page.getByRole('button', { name: 'Food', exact: true }).click();
  await page.getByText('Today’s totals and targets', { exact: true }).click(); await page.getByLabel('Calorie adjustment', { exact: true }).fill('1.2'); await page.getByRole('button', { name: 'Apply target adjustment', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_fuel_profile')).targetMultiplier).toBe(1.2);
  await page.getByRole('button', { name: 'Review block nutrition', exact: true }).click(); const restore = page.getByRole('dialog', { name: 'Restore block Food settings', exact: true });
  await expect(restore.getByRole('row', { name: 'Calorie adjustment 20% 10%', exact: true })).toBeVisible();
  await restore.getByRole('button', { name: 'Cancel', exact: true }).click(); expect((await record(page, 'ironflow_fuel_profile')).targetMultiplier).toBe(1.2);
  await page.getByRole('button', { name: 'Review block nutrition', exact: true }).click(); await restore.getByRole('button', { name: 'Accept and restore Food settings', exact: true }).click(); await expect.poll(() => record(page, 'ironflow_fuel_profile')).toEqual(profile);
});

test('fixed timed goals preserve seconds and physical load after a unit preference change', async ({ page }) => {
  const block = fixture('mobility', 1, 1); block.workouts[0].exercises[0].tracking = 'time'; block.workouts[0].exercises[0].suggestedReps = 180; block.workouts[0].exercises[0].targetReps = '180 seconds';
  block.sessions[0].template = structuredClone(block.workouts[0]);
  await seed(page, { ironflow_blocks: [block], ironflow_settings: { units: 'imperial' } }); await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const current = await record(page, 'ironflow_active_session'); expect(current.exercises[0].sets[0].weight * 0.45359237).toBeCloseTo(30.06, 4); expect(current.exercises[0].sets[0].reps).toBe(180);
  await expect(page.getByTestId(`progression-${exercise.name}`)).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Time', exact: true }).first().click(); const pad = page.getByRole('dialog', { name: 'Adjust Time (MMSS)', exact: true }); await expect(pad).toContainText('3:00'); await pad.getByRole('button', { name: 'Apply value', exact: true }).click();
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets[0].reps).toBe(180);
});

test('AI receives the block choices, rejects incorrect counts and stages the full coordinated programme', async ({ page }) => {
  await seed(page, { ironflow_history: [{ date: localDate(), exercise: exercise.name, category: 'Chest', weight: 20, reps: 8, unit: 'kgs', sessionId: 'earlier' }] }); await page.evaluate(() => localStorage.setItem('ironflow_gemini_key', 'mock-key'));
  const requests: string[] = []; let good = false;
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    requests.push(route.request().postData() ?? '');
    const templates = routines.slice(0, good ? 2 : 1).map(t => ({ ...t, exercises: t.exercises.map(ex => ({ ...ex, tracking: 'reps' })) }));
    await route.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ templates }) }] }, finishReason: 'STOP' }] } });
  });
  const wizard = await setup(page, 'power', 2, 2);
  await wizard.getByRole('button', { name: 'Generate programme with AI', exact: true }).click();
  await expect(wizard.getByRole('alert')).toBeVisible(); expect((await record(page, 'ironflow_blocks')) ?? []).toHaveLength(0);
  good = true; await wizard.getByRole('button', { name: 'Generate programme with AI', exact: true }).click(); await expect(wizard.getByText('1. Workout A', { exact: true })).toBeVisible();
  const payload = requests.at(-1)!; for (const text of ['Power and explosiveness', '2 DIFFERENT workouts', '3 training DAYS', '2 rounds', '45 minutes', 'Machine press, dumbbells', 'intermediate']) expect(payload).toContain(text);
  await wizard.getByRole('button', { name: 'Review block', exact: true }).click(); await expect(wizard).toContainText('Prescriptions remain fixed');
  await wizard.getByRole('button', { name: 'Start block', exact: true }).click(); await expect.poll(async () => (await record(page, 'ironflow_blocks'))?.[0]?.sessions?.length).toBe(4);
  expect((await record(page, 'ironflow_blocks'))[0].workouts.every((t: any) => t.progressionMode === 'fixed')).toBe(true);
  expect((await record(page, 'ironflow_blocks'))[0].workouts[0].exercises[0].suggestedWeight).toBe(30.06);
});

test('failed offline block saves retain the in-memory programme and retry commits the whole snapshot', async ({ page, context }) => {
  await seed(page); const wizard = await create(page, 'strength', 1, 1); await context.setOffline(true);
  await page.evaluate(() => { const original = IDBObjectStore.prototype.put; (window as any).__restorePut = () => { IDBObjectStore.prototype.put = original; }; IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) { if (args[0].id === 'ironflow_blocks') throw new DOMException('Full', 'QuotaExceededError'); return original.apply(this, args); }; });
  await wizard.getByRole('button', { name: 'Start block', exact: true }).click(); const manager = page.getByRole('dialog', { name: 'Training block', exact: true });
  await expect(manager.getByText('Not saved — keep this tab open', { exact: true })).toBeVisible(); expect(await record(page, 'ironflow_blocks')).toBeNull();
  await page.evaluate(() => (window as any).__restorePut()); await manager.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_blocks'))?.length).toBe(1);
  expect(await record(page, 'ironflow_templates')).toEqual(routines); await context.setOffline(false);
});

test('block snapshots survive JSON restore and undo; older backups clear blocks without inventing them', async ({ page }) => {
  const block = fixture(); await seed(page, { ironflow_blocks: [block] });
  await page.getByRole('button', { name: 'Vault Backup', exact: true }).click(); const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download JSON backup', exact: true }).click();
  const stream = await (await downloading).createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk)); const data = JSON.parse(Buffer.concat(chunks).toString()); expect(data.ironflow_blocks).toEqual([block]);
  await page.getByLabel('Choose JSON backup').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ironflow_history: [] })) });
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click(); await page.getByRole('button', { name: 'Continue to IronFlow', exact: true }).click(); await dismiss(page);
  await expect(page.getByRole('region', { name: 'Active training block', exact: true })).toHaveCount(0); expect(await record(page, 'ironflow_blocks')).toBeNull();
  await page.getByRole('button', { name: 'Vault Backup', exact: true }).click(); await page.getByRole('button', { name: 'Review undo restore', exact: true }).click(); await page.getByRole('button', { name: 'Undo restore', exact: true }).click(); await page.getByRole('button', { name: 'Continue to IronFlow', exact: true }).click(); await dismiss(page);
  expect(await record(page, 'ironflow_blocks')).toEqual([block]); await expect(page.getByRole('region', { name: 'Next workout' })).toContainText('Next block session');
});

test('future-only edits preserve the started snapshot and ending cannot discard an active block workout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const block = fixture(); await seed(page, { ironflow_blocks: [block] });
  await page.getByRole('button', { name: 'Start workout', exact: true }).click(); const before = await record(page, 'ironflow_active_session');
  const manager = await openBlock(page); await manager.getByText('Programme settings and future edits', { exact: true }).click(); await manager.getByRole('button', { name: 'Edit future Workout A', exact: true }).click();
  await page.getByPlaceholder('Unnamed Routine').fill('Future A'); await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_blocks'))[0].sessions[2].template.name).toBe('Future A');
  expect((await record(page, 'ironflow_blocks'))[0].sessions[0].template.name).toBe('Workout A'); expect(await record(page, 'ironflow_active_session')).toEqual(before); expect(await record(page, 'ironflow_templates')).toEqual(routines);
  await manager.getByRole('button', { name: 'End block early', exact: true }).click(); const confirmation = page.getByRole('dialog', { name: 'Confirm block action', exact: true }); await confirmation.getByRole('button', { name: 'End block', exact: true }).click(); await expect(confirmation.getByRole('alert')).toContainText('unfinished workout first');
  expect((await record(page, 'ironflow_blocks'))[0].status).toBe('active'); expect(await record(page, 'ironflow_active_session')).toEqual(before);
});

test('an ordinary workout needs explicit assignment; finishing and repeating creates a separate block', async ({ page }) => {
  const block = fixture('strength', 1, 1); await seed(page, { ironflow_blocks: [block] });
  await page.getByRole('button', { name: 'Manage routines', exact: true }).click();
  // Start a source routine independently, without silently fulfilling its block copy.
  await page.getByRole('button', { name: 'Initialize Program', exact: true }).first().click();
  const before = await record(page, 'ironflow_active_session'); expect(before.blockId).toBeUndefined();
  const manager = await openBlock(page); const slot = manager.getByRole('article', { name: 'Round 1 of 1 · Workout A', exact: true });
  await slot.getByText('Session details and options', { exact: true }).click(); await slot.getByRole('button', { name: 'Assign current workout', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Confirm block action', exact: true }); await confirm.getByRole('button', { name: 'Assign workout', exact: true }).click();
  const assigned = await record(page, 'ironflow_active_session'); expect(assigned.id).toBe(before.id); expect(assigned.exercises).toEqual(before.exercises); expect(assigned.blockSessionId).toBe(block.sessions[0].id);
  await finish(page); await openBlock(page); await manager.getByRole('button', { name: 'Finish block', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_blocks'))[0].status).toBe('finished');
  await manager.getByRole('button', { name: 'Use this programme for a new block', exact: true }).click();
  const wizard = page.getByRole('dialog', { name: 'Create training block', exact: true }); await wizard.getByRole('button', { name: 'Choose workouts', exact: true }).click(); await wizard.getByRole('button', { name: 'Review block', exact: true }).click(); await wizard.getByRole('button', { name: 'Start block', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_blocks')).length).toBe(2);
  const blocks = await record(page, 'ironflow_blocks'); expect(blocks[1].id).not.toBe(block.id); expect(blocks[1].sessions[0].status).toBe('planned'); expect(blocks.filter((b: any) => b.status === 'active')).toHaveLength(1);
});

test('bulk scheduling carries four workouts across three weekdays and calendar skip/undo updates the block', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 }); const block = fixture('strength', 4, 2); await seed(page, { ironflow_blocks: [block] });
  const manager = await openBlock(page); await manager.getByRole('button', { name: 'Schedule remaining sessions', exact: true }).click();
  const scheduler = page.getByRole('dialog', { name: 'Schedule block sessions', exact: true });
  await scheduler.getByLabel('Mon', { exact: true }).check(); await scheduler.getByLabel('Wed', { exact: true }).check(); await scheduler.getByLabel('Fri', { exact: true }).check();
  await scheduler.getByText('Preview appointments', { exact: true }).click(); await expect(scheduler.getByRole('listitem')).toHaveCount(8);
  await expect(scheduler.getByRole('button', { name: 'Save block appointments', exact: true })).toBeEnabled();
  expect(await scheduler.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await scheduler.getByRole('button', { name: 'Save block appointments', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_schedule')).appointments.length).toBe(8);
  const schedule = await record(page, 'ironflow_schedule'); expect(schedule.appointments[3].date > schedule.appointments[2].date).toBe(true);
  await closeManager(page); const first = schedule.appointments[0];
  const next = new Date(`${first.date}T12:00:00`).getDay(); expect([1, 3, 5]).toContain(next);
  const dayName = await page.evaluate(date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }), first.date);
  const dayButton = page.locator('[aria-label="Select day"]').getByRole('button', { name: dayName, exact: true });
  if (!await dayButton.count()) await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await dayButton.click();
  const appointment = page.getByTestId(`appointment-${first.id}@${first.date}`);
  await appointment.getByRole('button', { name: 'Skip block session', exact: true }).click(); await expect.poll(async () => (await record(page, 'ironflow_blocks'))[0].sessions[0].status).toBe('skipped');
  await appointment.getByRole('button', { name: 'Undo skip', exact: true }).click(); await expect.poll(async () => (await record(page, 'ironflow_blocks'))[0].sessions[0].status).toBe('planned');
});

test('block AI keeps an editable draft, explains target problems and prevents unresolved use', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seed(page); await page.evaluate(() => localStorage.setItem('ironflow_gemini_key', 'mock-key'));
  let requests = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    requests++;
    const templates = [{ name: 'Unilateral strength', exercises: [{ ...exercise, tracking: 'reps', targetReps: '8-12 each side' }] }];
    await route.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ templates }) }] }, finishReason: 'STOP' }] } });
  });
  const wizard = await setup(page, 'strength', 1, 1);
  await wizard.getByRole('button', { name: 'Generate programme with AI', exact: true }).click();
  await expect(wizard).toContainText('Your programme needs 1 correction');
  expect(requests).toBe(2);
  const correction = wizard.getByRole('region', { name: 'Correct Machine Press' });
  await expect(correction).toContainText('AI supplied: “8-12 each side”');
  await wizard.getByRole('button', { name: 'Review block', exact: true }).click();
  await expect(wizard.getByRole('alert')).toContainText('Resolve 1 exercise prescription issue');
  expect((await record(page, 'ironflow_blocks')) ?? []).toHaveLength(0);
  await correction.getByLabel('Rep target', { exact: true }).fill('8-12');
  await expect(correction).toContainText('Prescription corrected.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await wizard.getByRole('button', { name: 'Review block', exact: true }).click();
  await wizard.getByRole('button', { name: 'Start block', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_blocks'))?.[0]?.workouts[0].exercises[0].targetReps).toBe('8-12');
  expect(await record(page, 'ironflow_templates')).toEqual(routines);
});

test('unreadable block AI response explains the failure and retains staged workouts', async ({ page }) => {
  await seed(page); await page.evaluate(() => localStorage.setItem('ironflow_gemini_key', 'mock-key'));
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    await route.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: 'not valid JSON' }] }, finishReason: 'STOP' }] } });
  });
  const wizard = await setup(page, 'strength', 1, 1);
  await wizard.getByText('Choose saved routines', { exact: true }).click();
  await wizard.getByRole('checkbox', { name: 'Workout A', exact: true }).check();
  await wizard.getByRole('button', { name: 'Generate programme with AI', exact: true }).click();
  await page.getByRole('button', { name: 'Replace and generate', exact: true }).click();
  await expect(wizard.getByRole('alert')).toContainText('unreadable programme');
  await expect(wizard.getByRole('alert')).toContainText('Try generating again');
  await expect(wizard.getByText('1. Workout A', { exact: true })).toBeVisible();
  expect((await record(page, 'ironflow_blocks')) ?? []).toHaveLength(0);
  expect(await record(page, 'ironflow_templates')).toEqual(routines);
});
