import { test, expect, type Page } from '@playwright/test';
test.use({ timezoneId: 'Australia/Brisbane' });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const machine = { name: 'Machine Press', category: 'Chest', muscles: ['Pectorals'], instructions: [], benefits: '', risks: '', barWeight: 22.56, weightIncrement: 2.5, loadingMode: 'single' };
const routine = { id: 'routine', name: 'Renamed routine', exercises: [{ name: machine.name, category: machine.category, targetReps: '8-12', suggestedSets: 3, suggestedWeight: 30.06, suggestedReps: 8, warmupCount: 0, rationale: '' }] };
const history = (reps: number[]) => reps.map((reps, i) => ({ date: today, exercise: machine.name, category: machine.category, weight: 30.06, reps, unit: 'kgs', templateName: 'Original name', templateId: routine.id, sessionId: 'previous', exerciseInstanceId: 'exercise', workingSetIndex: i, prescribedWorkingSets: 3, prescribedRepRange: '8-12', completedAt: i + 1 }));
const draft = { id: 'current', name: routine.name, templateId: routine.id, status: 'active', startTime: Date.now(), exercises: [{ id: 'exercise', name: machine.name, category: machine.category, targetReps: '8-12', sets: [
  { id: 'warmup', weight: 22.56, reps: 10, unit: 'kgs', completed: false, isWarmup: true, timestamp: 0 },
  { id: 'done', weight: 30.06, reps: 12, unit: 'kgs', completed: true, timestamp: 1 },
  { id: 'next', weight: 30.06, reps: 9, unit: 'kgs', completed: false, timestamp: 0 },
  { id: 'last', weight: 27.56, reps: 8, unit: 'kgs', completed: false, timestamp: 0 },
  { id: 'deload', weight: 22.56, reps: 10, unit: 'kgs', completed: false, isDeload: true, timestamp: 0 },
] }] };
async function dismiss(page: Page) { await page.getByRole('button', { name: /Skip for now/ }).click(); }
async function seed(page: Page, data: Record<string, unknown>) {
  await page.goto('/'); await dismiss(page);
  await page.evaluate(async data => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    await storage.overwriteEverything(data);
  }, { ironflow_templates: [routine], ironflow_library: [machine], ...data });
  await page.reload(); await dismiss(page);
}
async function record(page: Page, key: string) {
  return page.evaluate(async key => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    return storage.get(key);
  }, key);
}
async function resume(page: Page) { await page.getByRole('region', { name: 'Next workout' }).getByRole('button', { name: 'Resume workout', exact: true }).click(); }

test('one top set holds load; a complete qualifying session increases load despite routine rename', async ({ page }) => {
  await seed(page, { ironflow_history: history([12, 9, 8]) });
  await page.getByRole('button', { name: 'Preview workout', exact: true }).click();
  const progression = page.getByTestId(`progression-${machine.name}`);
  await progression.locator('summary').click();
  await expect(progression).toContainText('Last session: 12, 9, 8 reps');
  await expect(progression.getByRole('row', { name: '2 30.06 × 9 30.06 × 10', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start this workout', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.exercises[0].sets.map((s: any) => s.weight)).toEqual([30.06, 30.06, 30.06]);
  expect((await record(page, 'ironflow_active_session')).exercises[0].recommendation.action).toBe('reps');
  await seed(page, { ironflow_history: history([12, 12, 12]) });
  await page.getByRole('button', { name: 'Preview workout', exact: true }).click();
  await progression.locator('summary').click();
  await expect(progression).toContainText('All 3 prescribed working sets reached 12 reps');
  await expect(progression).toContainText('Suggested: 32.56 kg × 8');
});

test('manual increase is reviewed, cancel is reversible and apply preserves reps, completed sets and routine defaults', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page, { ironflow_active_session: draft }); await resume(page);
  await page.getByTestId(`progression-${machine.name}`).locator('summary').click();
  const trigger = page.getByRole('button', { name: 'Increase weight', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Increase weight', exact: true });
  await expect(dialog).toContainText('30.06 → 32.56 kg');
  await expect(dialog).toContainText('27.56 → 30.06 kg');
  await expect(dialog.getByRole('button', { name: 'Apply to this exercise', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/ironflow-247-increase.png' });
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets).toEqual(draft.exercises[0].sets);
  await trigger.click(); await dialog.getByRole('button', { name: 'Apply to this exercise', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets.map((s: any) => s.weight)).toEqual([22.56, 30.06, 32.56, 30.06, 22.56]);
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets.map((s: any) => s.reps)).toEqual([10, 12, 9, 8, 10]);
  expect((await record(page, 'ironflow_templates'))[0]).toEqual(routine);
  await page.reload(); await dismiss(page); await resume(page);
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets[2].weight).toBe(32.56);
});

test('completion records prescription and partial completion cannot qualify the next workout', async ({ page }) => {
  const ex = { ...draft.exercises[0], sets: [0, 1, 2].map(i => ({ id: `working-${i}`, weight: 30.06, reps: 12, unit: 'kgs', completed: i < 2, timestamp: i + 1 })) };
  await seed(page, { ironflow_active_session: { ...draft, exercises: [ex] } }); await resume(page);
  await page.getByRole('button', { name: /Finish workout/ }).click(); await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_history'))?.length).toBe(2);
  const records = await record(page, 'ironflow_history');
  expect(records[0]).toMatchObject({ prescribedWorkingSets: 3, prescribedRepRange: '8-12', workingSetIndex: 0, exerciseInstanceId: 'exercise', templateId: routine.id });
  await page.reload(); await dismiss(page);
  await page.getByRole('button', { name: 'Preview workout', exact: true }).click();
  const progression = page.getByTestId(`progression-${machine.name}`); await progression.locator('summary').click();
  await expect(progression).toContainText('Only 2 of 3 prescribed working sets');
  await expect(progression).toContainText('Suggested: 30.06 kg');
});

test('full completion qualifies after one session and exported/restored metadata retains that decision', async ({ page }) => {
  const ex = { ...draft.exercises[0], sets: [0, 1, 2].map(i => ({ id: `working-${i}`, weight: 30.06, reps: 12, unit: 'kgs', completed: true, timestamp: Date.now() + i })) };
  await seed(page, { ironflow_active_session: { ...draft, exercises: [ex] } }); await resume(page);
  await page.getByRole('button', { name: /Finish workout/ }).click(); await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_history'))?.length).toBe(3);
  await page.reload(); await dismiss(page);
  await page.getByRole('button', { name: 'Vault Backup', exact: true }).click();
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download JSON backup', exact: true }).click();
  const stream = await (await downloading).createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.ironflow_history.every((row: any) => row.prescribedWorkingSets === 3)).toBe(true);
  await page.getByLabel('Choose JSON backup').setInputFiles({ name: 'snapshot.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to IronFlow', exact: true }).click(); await dismiss(page);
  await page.getByRole('button', { name: 'Preview workout', exact: true }).click();
  await expect(page.getByTestId(`progression-${machine.name}`)).toContainText('Suggested: 32.56 kg × 8');
});

test('older history cannot qualify and new exercises use equipment base rather than unrelated history', async ({ page }) => {
  const old = history([12, 12, 12]).map(({ prescribedWorkingSets, prescribedRepRange, exerciseInstanceId, sessionId, ...row }) => row);
  await seed(page, { ironflow_history: old });
  await page.getByRole('button', { name: 'Preview workout', exact: true }).click();
  const progression = page.getByTestId(`progression-${machine.name}`); await progression.locator('summary').click();
  await expect(progression).toContainText('cannot qualify a weight increase');
  await expect(progression).toContainText('Suggested: 30.06 kg');
  await seed(page, { ironflow_templates: [{ ...routine, exercises: [{ ...routine.exercises[0], suggestedWeight: 0 }] }], ironflow_history: history([12, 12, 12]).map(row => ({ ...row, exercise: 'Unrelated chest exercise', weight: 100 })) });
  await page.getByRole('button', { name: 'Preview workout', exact: true }).click();
  await expect(progression).toContainText('Choose a starting load · 22.56 kg base');
});

test('assisted exercises offer Reduce assistance, and manual changes do not qualify an automatic increase', async ({ page }) => {
  const name = 'Assisted Pull-up';
  const exercise = { ...draft.exercises[0], name, category: 'Back', sets: draft.exercises[0].sets.map(s => ({ ...s, weight: 30 })) };
  await seed(page, { ironflow_active_session: { ...draft, exercises: [exercise] }, ironflow_library: [{ ...machine, name, category: 'Back', barWeight: 0 }] }); await resume(page);
  await page.getByTestId(`progression-${name}`).locator('summary').click();
  await page.getByRole('button', { name: 'Reduce assistance', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reduce assistance', exact: true });
  await expect(dialog).toContainText('30 → 27.5 kg');
  await dialog.getByRole('button', { name: 'Apply to this exercise', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[2].weight).toBe(27.5);
  await page.getByRole('button', { name: /Finish workout/ }).click(); await page.getByRole('button', { name: 'Skip', exact: true }).click();
  const logs = await record(page, 'ironflow_history');
  expect(logs).toHaveLength(1); expect(logs[0].prescribedWorkingSets).toBe(3);
});

test('imperial manual increase previews pounds and applies the same physical equipment step', async ({ page }) => {
  const imperial = { ...draft, exercises: draft.exercises.map(ex => ({ ...ex, sets: ex.sets.map(set => ({ ...set, unit: 'lbs', weight: set.weight / 0.45359237 })) })) };
  await seed(page, { ironflow_active_session: imperial, ironflow_settings: { units: 'imperial' } }); await resume(page);
  await page.getByTestId(`progression-${machine.name}`).locator('summary').click();
  await page.getByRole('button', { name: 'Increase weight', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Increase weight', exact: true });
  await expect(dialog).toContainText('lb');
  await dialog.getByRole('button', { name: 'Apply to this exercise', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[2].weight * 0.45359237).toBeCloseTo(32.56, 5);
});

test('old draft suggestions are recalculated without changing its recorded values or repeating the obsolete explanation', async ({ page }) => {
  const oldRecommendation = { weight: 32.56, reps: 8, source: 'history', reason: 'You reached the top after one set', unit: 'kgs' };
  await seed(page, { ironflow_active_session: { ...draft, exercises: [{ ...draft.exercises[0], rationale: oldRecommendation.reason, recommendation: oldRecommendation }] }, ironflow_history: history([12, 9, 8]) }); await resume(page);
  const progression = page.getByTestId(`progression-${machine.name}`); await progression.locator('summary').click();
  await expect(progression).not.toContainText('You reached the top after one set');
  await expect(progression).toContainText('Reach 12 reps on all 3 working sets');
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets).toEqual(draft.exercises[0].sets);
});
