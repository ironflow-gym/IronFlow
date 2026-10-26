import { test, expect, type Page } from '@playwright/test';
import { addDays } from '../../src/scheduling';
test.use({ timezoneId: 'Australia/Brisbane' });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const machine = { name: 'Machine Press', category: 'Chest', muscles: ['Pectorals'], instructions: ['Press'], benefits: 'Training', risks: 'Use appropriate load', weightIncrement: 2.5, barWeight: 22.56, loadingMode: 'single' };
const template = { id: 'routine', name: 'Machine day', exercises: [{ name: machine.name, category: 'Chest', suggestedSets: 1, warmupCount: 0, suggestedWeight: 30, suggestedReps: 8, targetReps: '8-12', rationale: '' }] };
const draft = { id: 's', name: 'Machine day', status: 'active', startTime: Date.now() - 100000, templateId: 'routine', exercises: [{ id: 'press', name: machine.name, category: 'Chest', targetReps: '8-12', suggestedWeight: 30.06, sets: [
  { id: 'done', weight: 30.06, reps: 8, unit: 'kgs', completed: true, timestamp: 1 },
  ...Array.from({ length: 5 }, (_, i) => ({ id: `pending-${i}`, weight: 30.06, reps: 8, unit: 'kgs', completed: false, timestamp: 0 })),
] }] };
async function dismiss(page: Page) {
  await page.getByRole('button', { name: /Skip for now/ }).click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
}
async function seed(page: Page, data: Record<string, unknown>) {
  await page.goto('/'); await dismiss(page);
  await page.evaluate(async records => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    await storage.overwriteEverything(records);
  }, data);
  await page.reload(); await dismiss(page);
}
async function record(page: Page, key: string) {
  return page.evaluate(async id => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    return storage.get(id);
  }, key);
}

test('fractional equipment settings persist and all recommendations and adjustments use the configured base', async ({ page }) => {
  await seed(page, { ironflow_templates: [template], ironflow_library: [{ ...machine, barWeight: undefined, weightIncrement: undefined }] });
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByPlaceholder('Search exercises...').fill('Machine Press');
  await page.getByRole('button', { name: /Machine Press Chest/ }).click();
  await page.getByRole('button', { name: 'Edit equipment', exact: true }).click();
  await page.getByLabel('Starting weight (kg)').fill('22.56');
  await page.getByLabel('Smallest plate or stack increment (kg)').fill('2.5');
  await page.getByRole('combobox', { name: 'How is weight added?' }).selectOption('paired');
  await expect(page.getByText('22.56 kg + 15 kg = 37.56 kg', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'How is weight added?' }).selectOption('single');
  await expect(page.getByText('22.56 kg + 7.5 kg = 30.06 kg', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save equipment' }).click();
  await expect.poll(async () => (await record(page, 'ironflow_library'))?.find((item: any) => item.name === machine.name)?.barWeight).toBe(22.56);
  await page.reload(); await dismiss(page);
  await page.getByRole('button', { name: 'Preview workout' }).click();
  await page.getByTestId('progression-Machine Press').locator('summary').click();
  await expect(page.getByTestId('progression-Machine Press')).toContainText('Suggested: 30.06 kg × 8');
  await expect(page.getByTestId('progression-Machine Press')).toContainText('22.56 kg starting weight plus 2.5 kg total steps');
  await page.getByRole('button', { name: 'Start this workout' }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.exercises[0].sets[0].weight).toBe(30.06);
  await page.getByRole('button', { name: 'Increase kg', exact: true }).first().click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[0].weight).toBe(32.56);
});

test('imperial sessions convert configured kg equipment while keeping the same physical load', async ({ page }) => {
  await seed(page, { ironflow_templates: [template], ironflow_library: [machine], ironflow_settings: { units: 'imperial' }, ironflow_history: [{ date: today, exercise: machine.name, category: 'Chest', weight: 30.06, unit: 'kgs', reps: 9, templateName: template.name }] });
  await page.getByRole('button', { name: 'Preview workout' }).click();
  await expect(page.getByTestId('progression-Machine Press')).toContainText('Suggested: 66.27 lb × 10');
  await page.getByRole('button', { name: 'Start this workout' }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.exercises[0].sets[0].unit).toBe('lbs');
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets[0].weight * 0.45359237).toBeCloseTo(30.06, 4);
});

test('adaptation is previewed, can be cancelled and applies only to pending working sets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { ironflow_templates: [template], ironflow_active_session: draft, ironflow_library: [machine] });
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Adapt this workout', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Adapt this workout' });
  await dialog.getByRole('combobox', { name: 'How do you feel?' }).selectOption('low-energy');
  await dialog.getByLabel('Time available (minutes)').fill('5');
  await dialog.getByRole('button', { name: 'Preview adaptation' }).click();
  await expect(dialog.getByRole('region', { name: 'Proposed adaptation' })).toContainText('30.06 → 27.56 kg');
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets[1].weight).toBe(30.06);
  await dialog.getByRole('button', { name: 'Cancel adaptation' }).click();
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets).toEqual(draft.exercises[0].sets);
  await page.getByRole('button', { name: 'Adapt this workout', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Adapt this workout' });
  await dialog.getByRole('combobox', { name: 'How do you feel?' }).selectOption('low-energy');
  await dialog.getByLabel('Time available (minutes)').fill('5');
  await dialog.getByRole('button', { name: 'Preview adaptation' }).click();
  await dialog.getByRole('button', { name: 'Apply changes' }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[1].weight).toBe(27.56);
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets[0]).toEqual(draft.exercises[0].sets[0]);
  expect((await record(page, 'ironflow_templates'))[0]).toEqual(template);
  await page.reload(); await dismiss(page);
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(page.getByText('Changes made (1)', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Complete set 2 for Machine Press', exact: true }).click();
  await page.getByRole('button', { name: /Complete Flow/ }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_schedule'))?.completions[0]?.adaptations?.length).toBe(1);
});

test('weekly review works offline and separates factual records from optional suggestions', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { ironflow_templates: [template], ironflow_history: [{ date: today, exercise: machine.name, category: 'Chest', weight: 30.06, reps: 8, unit: 'kgs', sessionId: 'completed', templateName: 'Historical routine name' }, { date: addDays(today, -7), exercise: machine.name, category: 'Chest', weight: 27.56, reps: 8, unit: 'kgs', sessionId: 'previous', templateName: 'Historical routine name' }] });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Review this week' }).click();
  const review = page.getByRole('dialog', { name: 'Weekly training review' });
  await expect(review.getByRole('region', { name: 'Weekly highlights' })).toBeVisible();
  await review.getByText('Details and supporting records', { exact: true }).click();
  await expect(review.getByRole('region', { name: 'Recorded weekly facts' })).toContainText('1 / 3 weekly goal');
  await expect(review.getByRole('region', { name: 'Recorded weekly facts' })).toContainText('240 kg × reps');
  await review.getByText('View supporting records (1)', { exact: true }).first().click();
  await expect(review.getByText(/Historical routine name/).first()).toBeVisible();
  await review.getByText('Suggestions to consider', { exact: true }).click();
  await expect(review.getByRole('region', { name: 'Optional coaching suggestions' })).toContainText('Nothing is applied automatically');
  await review.getByRole('button', { name: 'Previous review week' }).click();
  await expect(review.getByRole('region', { name: 'Recorded weekly facts' })).toContainText('220 kg × reps');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('malformed AI editing output is rejected without replacing the routine or its saved ID', async ({ page }) => {
  await seed(page, { ironflow_templates: [template], ironflow_library: [machine] });
  await page.evaluate(() => localStorage.setItem('ironflow_gemini_key', 'mock-key-for-browser-test'));
  await page.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ id: 'another-record', name: 'Corrupt routine', exercises: [{ ...template.exercises[0], suggestedWeight: -50 }] }) }] }, finishReason: 'STOP' }] } }));
  await page.reload();
  await page.getByRole('button', { name: 'Manage routines' }).click();
  await page.getByRole('button', { name: 'Manual Overhaul', exact: true }).click();
  const alertPromise = page.waitForEvent('dialog');
  await page.getByPlaceholder('AI edit this day…').fill('Add a set');
  await page.getByPlaceholder('AI edit this day…').press('Enter');
  const alert = await alertPromise;
  expect(alert.message()).toContain('incomplete or invalid data');
  await alert.accept();
  expect((await record(page, 'ironflow_templates'))[0]).toEqual(template);
  await expect(page.getByPlaceholder('Unnamed Routine')).toHaveValue(template.name);
});


test('equipment substitutions require explicit selection and never transfer a different exercise load', async ({ page }) => {
  const cable = { name: 'Cable Row', category: 'Back', muscles: ['Lats'], instructions: [], benefits: '', risks: '' };
  const dumbbell = { ...cable, name: 'Dumbbell Row', barWeight: 0, weightIncrement: 2.5, loadingMode: 'single' };
  const session = { ...draft, exercises: [...draft.exercises, { id: 'row', name: cable.name, category: 'Back', targetReps: '8-12', sets: [{ id: 'row-1', weight: 40, reps: 10, unit: 'kgs', completed: false, timestamp: 0 }] }] };
  await seed(page, { ironflow_active_session: session, ironflow_templates: [template], ironflow_library: [machine, cable, dumbbell] });
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Adapt this workout', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Adapt this workout' });
  await dialog.getByText('Change exercise', { exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Exercise to change', exact: true }).locator('option[value=press]')).toHaveJSProperty('disabled', true);
  await dialog.getByRole('combobox', { name: 'Exercise to change', exact: true }).selectOption('row');
  await dialog.getByRole('combobox', { name: 'Replace with (Cable Row)', exact: true }).selectOption('Dumbbell Row');
  await dialog.getByRole('button', { name: 'Preview adaptation' }).click();
  await expect(dialog.getByRole('region', { name: 'Proposed adaptation' })).toContainText('40 → 0 kg');
  expect((await record(page, 'ironflow_active_session')).exercises[1].name).toBe('Cable Row');
  await dialog.getByRole('button', { name: 'Apply changes' }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[1].name).toBe('Dumbbell Row');
  expect((await record(page, 'ironflow_active_session')).exercises[1].sets[0].weight).toBe(0);
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets[0]).toEqual(draft.exercises[0].sets[0]);
});


test('an existing workout keeps its actual units after a global preference change', async ({ page }) => {
  await seed(page, { ironflow_active_session: draft, ironflow_settings: { units: 'imperial' }, ironflow_library: [machine] });
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(page.getByText('This workout keeps its recorded units; your unit preference applies to new workouts.')).toBeVisible();
  const set = page.getByTestId('set-pending-0');
  await expect(set.getByRole('button', { name: 'Edit kg', exact: true })).toContainText('30.06');
  await set.getByRole('button', { name: 'Increase kg', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[1].weight).toBe(32.56);
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets[1].unit).toBe('kgs');
});

test('an exercise added by the AI is calibrated to equipment before populating its sets', async ({ page }) => {
  await seed(page, { ironflow_active_session: { ...draft, exercises: [] }, ironflow_library: [machine] });
  await page.evaluate(() => localStorage.setItem('ironflow_gemini_key', 'mock-key-for-browser-test'));
  await page.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ name: 'Added press', exercises: [{ ...template.exercises[0], restSeconds: 90 }] }) }] }, finishReason: 'STOP' }] } }));
  await page.reload();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Inject Movement', exact: true }).click();
  await page.getByPlaceholder(/Add a heavy back finisher/).fill('Add Machine Press');
  await page.getByRole('button', { name: 'Generate exercise', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.exercises[0]?.sets[0]?.weight).toBe(30.06);
  expect((await record(page, 'ironflow_active_session')).exercises[0].suggestedWeight).toBe(30.06);
});


test('dialogs trap keyboard focus, close with Escape and restore focus through nested previews', async ({ page }) => {
  await seed(page, { ironflow_templates: [template], ironflow_library: [machine] });
  const opener = page.getByRole('button', { name: 'Preview workout', exact: true });
  await opener.click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview.getByRole('heading', { name: template.name, exact: true })).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('dialog')?.getAttribute('aria-label'))).toBe('Workout preview');
  }
  const adapt = preview.getByRole('button', { name: 'Adapt this workout', exact: true });
  await adapt.click();
  const dialog = page.getByRole('dialog', { name: 'Adapt this workout', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Adapt this workout', exact: true })).toBeFocused();
  expect(await page.locator('dialog[aria-modal=true]').count()).toBe(1);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('dialog')?.getAttribute('aria-label'))).toBe('Adapt this workout');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(adapt).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('mobile adaptation groups repeated sets and keeps Apply visible after preview', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page, { ironflow_active_session: draft, ironflow_library: [machine] });
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Adapt this workout', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Adapt this workout', exact: true });
  await dialog.getByRole('combobox', { name: 'How do you feel?', exact: true }).selectOption('low-energy');
  await dialog.getByRole('button', { name: 'Preview adaptation' }).click();
  const preview = dialog.getByRole('region', { name: 'Proposed adaptation' });
  await expect(preview.getByRole('heading', { name: /Review changes/ })).toBeFocused();
  await expect(preview.locator('article')).toHaveCount(1);
  await expect(preview.getByText('5 sets: 30.06 → 27.56 kg × 8', { exact: true })).toBeVisible();
  const apply = dialog.getByRole('button', { name: 'Apply changes', exact: true });
  const box = (await apply.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  const editBox = (await dialog.getByRole('button', { name: 'Edit options' }).boundingBox())!;
  expect(Math.abs(editBox.y - box.y)).toBeLessThanOrEqual(2);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Edit options' }).click();
  await expect(dialog.getByLabel('Time available (minutes)')).toBeFocused();
  await expect(dialog.getByRole('combobox', { name: 'How do you feel?' })).toHaveValue('low-energy');
});

test('the unified Change exercise flow retains optional AI suggestions and previews before applying', async ({ page }) => {
  const session = { ...draft, exercises: [{ ...draft.exercises[0], sets: draft.exercises[0].sets.slice(1) }] };
  await seed(page, { ironflow_active_session: session, ironflow_library: [machine], ironflow_templates: [template] });
  await page.evaluate(() => localStorage.setItem('ironflow_gemini_key', 'mock-key-for-browser-test'));
  let calls = 0;
  await page.route('https://generativelanguage.googleapis.com/**', route => { calls++; return route.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ alternatives: [{ name: 'AI Cable Press', category: 'Chest', rationale: 'An alternative press using available cable equipment.' }] }) }] }, finishReason: 'STOP' }] } }); });
  await page.reload();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Change exercise for Machine Press', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Adapt this workout', exact: true });
  await expect(dialog.getByRole('combobox', { name: 'Replace with (Machine Press)', exact: true })).toBeFocused();
  expect(calls).toBe(0);
  await dialog.getByRole('button', { name: 'Suggest with AI', exact: true }).click();
  await dialog.getByRole('button', { name: /Use AI Cable Press/ }).click();
  expect((await record(page, 'ironflow_active_session')).exercises[0].name).toBe('Machine Press');
  await dialog.getByRole('button', { name: 'Preview adaptation' }).click();
  await expect(dialog.getByRole('region', { name: 'Proposed adaptation' })).toContainText('Machine Press → AI Cable Press');
  await dialog.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].name).toBe('AI Cable Press');
  expect((await record(page, 'ironflow_templates'))[0]).toEqual(template);
});


test('focused equipment editor keeps Save visible on mobile and Escape discards unsaved changes', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page, { ironflow_library: [machine] });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByPlaceholder('Search exercises...').fill('Machine Press');
  await page.getByRole('button', { name: /Machine Press Chest/ }).click();
  const edit = page.getByRole('button', { name: 'Edit equipment', exact: true });
  await expect(page.getByRole('dialog', { name: 'Equipment settings', exact: true })).toHaveCount(0);
  await edit.click();
  const dialog = page.getByRole('dialog', { name: 'Equipment settings', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Equipment settings', exact: true })).toBeFocused();
  await dialog.getByLabel('Starting weight (kg)').fill('25');
  const save = dialog.getByRole('button', { name: 'Save equipment', exact: true });
  const box = (await save.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(edit).toBeFocused();
  expect((await record(page, 'ironflow_library'))[0].barWeight).toBe(22.56);
  await edit.click();
  await expect(dialog.getByLabel('Starting weight (kg)')).toHaveValue('22.56');
  await dialog.getByLabel('Starting weight (kg)').fill('23.06');
  await save.click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await record(page, 'ironflow_library'))[0].barWeight).toBe(23.06);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
