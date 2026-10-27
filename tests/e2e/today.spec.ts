import { enterWeight } from './helpers/workout';
import { test, expect, type Page } from '@playwright/test';
import { addDays } from '../../src/scheduling';

test.use({ timezoneId: 'Australia/Brisbane' });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const routine = { id: 'routine-a', name: 'Strength A', exercises: [{ name: 'Squat', category: 'Legs', suggestedSets: 1, warmupCount: 0, targetReps: '8-12', suggestedWeight: 40, suggestedReps: 8, rationale: '' }] };
const second = { ...routine, id: 'routine-b', name: 'Strength B' };
const empty = { appointments: [], exceptions: {}, completions: [] };
async function dismissKey(page: Page) {
  await page.getByRole('button', { name: /Skip for now/ }).click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
}
async function seed(page: Page, data: Record<string, unknown>) {
  await page.goto('/'); await dismissKey(page);
  await page.evaluate(async records => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    await storage.overwriteEverything(records);
  }, data);
  await page.reload(); await dismissKey(page);
}
async function record(page: Page, key: string) {
  return page.evaluate(async id => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    return storage.get(id);
  }, key);
}

test('Today is the mobile default, previews explain progression and custom choices persist only in the session', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await seed(page, { ironflow_templates: [routine], ironflow_history: [{ date: today, exercise: 'Squat', category: 'Legs', weight: 60, unit: 'kgs', reps: 12, templateName: routine.name, templateId: routine.id, sessionId: 'verified', exerciseInstanceId: 'exercise', workingSetIndex: 0, prescribedWorkingSets: 1, prescribedRepRange: '8-12' }] });
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Preview workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview' });
  await preview.getByText(/Suggested: 62.5 kg × 8/).click();
  await expect(preview.getByText(/prescribed working set reached 12 reps/)).toBeVisible();
  await preview.getByRole('button', { name: 'Keep previous values' }).click();
  await preview.getByRole('button', { name: 'Enter my own' }).click();
  await preview.getByLabel('Custom weight for Squat').fill('57.5');
  await preview.getByLabel('Custom reps for Squat').fill('10');
  await preview.getByRole('button', { name: 'Apply to this exercise' }).click();
  await preview.getByRole('button', { name: 'Start this workout' }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.exercises[0].sets[0].weight).toBe(57.5);
  expect((await record(page, 'ironflow_templates'))[0].exercises[0].suggestedWeight).toBe(40);
  await page.getByTestId('progression-Squat').locator('summary').click();
  await page.getByRole('button', { name: 'Use suggestion' }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[0].weight).toBe(62.5);
  await expect(page.getByRole('button', { name: 'Edit kg', exact: true }).first()).toContainText('62.5');
  await enterWeight(page, page.getByRole('button', { name: 'Edit kg', exact: true }).first(), 63.75);
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[0].weight).toBe(63.75);
  await page.reload(); await dismissKey(page);
  await page.getByRole('region', { name: 'Next workout' }).getByRole('button', { name: 'Resume workout' }).click();
  await expect(page.getByTestId('progression-Squat')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('calendar creates weekly appointments, edits one occurrence and links completion atomically', async ({ page }) => {
  await seed(page, { ironflow_templates: [routine, second] });
  await page.getByRole('button', { name: 'Schedule workout or rest' }).click();
  let editor = page.getByRole('dialog', { name: 'Schedule appointment' });
  await editor.getByRole('combobox', { name: 'Routine', exact: true }).selectOption('routine-b');
  await editor.getByLabel('Repeat weekly').check();
  await editor.getByRole('button', { name: 'Save appointment' }).click();
  await expect.poll(async () => (await record(page, 'ironflow_schedule'))?.appointments.length).toBe(1);
  const schedule = await record(page, 'ironflow_schedule');
  const appointmentId = `${schedule.appointments[0].id}@${today}`;
  await page.getByTestId(`appointment-${appointmentId}`).getByRole('button', { name: 'Edit / reschedule' }).click();
  editor = page.getByRole('dialog', { name: 'Schedule appointment' });
  await editor.getByRole('combobox', { name: 'Routine', exact: true }).selectOption('routine-a');
  await editor.getByRole('button', { name: 'Save appointment' }).click();
  await expect(page.getByRole('region', { name: 'Next workout' }).getByRole('heading', { name: 'Strength A' })).toBeVisible();
  await page.getByRole('region', { name: 'Next workout' }).getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.appointmentId).toBe(appointmentId);
  await page.getByRole('button', { name: 'Complete set 1 for Squat', exact: true }).click();
  await page.getByRole('button', { name: /Finish workout/ }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_schedule')).exceptions[appointmentId].status).toBe('completed');
  const history = await record(page, 'ironflow_history');
  expect(history[0].appointmentId).toBe(appointmentId);
  expect(history[0].sessionId).toBe((await record(page, 'ironflow_schedule')).completions[0].sessionId);
  expect(await record(page, 'ironflow_active_session')).toBeNull();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Weekly progress' })).toContainText('1 / 3 sessions');
  await expect(page.getByTestId(`appointment-${appointmentId}`)).toContainText('Completed');
});

test('missed and deleted-routine appointments remain actionable and never shift automatically', async ({ page }) => {
  const yesterday = addDays(today, -1);
  await seed(page, { ironflow_templates: [routine], ironflow_schedule: { ...empty, appointments: [{ id: 'missing', date: yesterday, kind: 'workout', templateId: 'deleted' }] } });
  const missed = page.getByRole('region', { name: 'Missed sessions' });
  await expect(missed).toContainText('Routine unavailable');
  await missed.getByRole('button', { name: 'Replace / reschedule' }).click();
  const editor = page.getByRole('dialog', { name: 'Schedule appointment' });
  await editor.getByRole('combobox', { name: 'Routine', exact: true }).selectOption('routine-a');
  await editor.getByLabel('Date', { exact: true }).fill(today);
  await editor.getByRole('button', { name: 'Save appointment' }).click();
  await expect(missed).toHaveCount(0);
  const schedule = await record(page, 'ironflow_schedule');
  expect(schedule.appointments[0].date).toBe(yesterday);
  expect(schedule.exceptions[`missing@${yesterday}`].date).toBe(today);
  await expect(page.getByRole('region', { name: 'Next workout' })).toContainText('Scheduled today');
});

test('explicit rest and multiple appointments work on mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { ironflow_templates: [routine] });
  await page.getByRole('button', { name: 'Schedule workout or rest' }).click();
  const editor = page.getByRole('dialog', { name: 'Schedule appointment' });
  await editor.getByRole('combobox', { name: 'Type', exact: true }).selectOption('rest');
  await editor.getByRole('button', { name: 'Save appointment' }).click();
  await expect(page.getByRole('region', { name: 'Next workout' })).toContainText('Recovery is on the plan');
  await page.getByRole('button', { name: 'Schedule workout or rest' }).click();
  await editor.getByRole('button', { name: 'Save appointment' }).click();
  await expect.poll(async () => (await record(page, 'ironflow_schedule')).appointments.length).toBe(2);
  await expect(page.getByRole('region', { name: 'Next workout' })).toContainText('Scheduled today');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('JSON export includes scheduling and restoring an older backup starts with no calendar data', async ({ page }) => {
  const schedule = { ...empty, appointments: [{ id: 'booking', date: today, kind: 'workout', templateId: 'routine-a' }] };
  await seed(page, { ironflow_templates: [routine], ironflow_schedule: schedule });
  await page.getByRole('button', { name: 'Vault Backup', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON backup' }).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const data = JSON.parse(Buffer.concat(chunks).toString());
  expect(data.ironflow_schedule).toEqual(schedule);
  delete data.ironflow_schedule;
  await page.locator('input[type=file]').setInputFiles({ name: 'old-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backup restored', exact: true })).toBeVisible();
  await page.reload(); await dismissKey(page);
  await expect(page.getByRole('region', { name: 'Training calendar' })).not.toContainText('Strength A');
  await expect(page.getByRole('region', { name: 'Next workout' })).toContainText('Next in rotation');
});


test('calendar saves work offline and failed writes remain visible until retried', async ({ page, context }) => {
  await seed(page, { ironflow_templates: [routine] });
  await context.setOffline(true);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).__restorePut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (args[0].id === 'ironflow_schedule') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Schedule workout or rest' }).click();
  await page.getByRole('dialog', { name: 'Schedule appointment' }).getByRole('button', { name: 'Save appointment' }).click();
  await expect(page.getByText('Not saved — keep this tab open', { exact: true })).toBeVisible();
  expect(await record(page, 'ironflow_schedule')).toBeNull();
  await page.evaluate(() => (window as any).__restorePut());
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  expect((await record(page, 'ironflow_schedule')).appointments[0].date).toBe(today);
});


test('routine edits affect future bookings while an already-started workout keeps its name and values', async ({ page }) => {
  await seed(page, { ironflow_templates: [routine], ironflow_schedule: { ...empty, appointments: [{ id: 'booking', date: today, kind: 'workout', templateId: routine.id, repeat: 'weekly' }] } });
  await page.getByRole('region', { name: 'Next workout' }).getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.name).toBe(routine.name);
  const before = await record(page, 'ironflow_active_session');
  await page.evaluate(async updated => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    await storage.set('ironflow_templates', [updated]);
  }, { ...routine, name: 'Renamed strength', exercises: [{ ...routine.exercises[0], suggestedWeight: 90 }] });
  await page.reload(); await dismissKey(page);
  await expect(page.getByRole('region', { name: 'Next workout' })).toContainText('Strength A');
  await expect(page.getByTestId(`appointment-booking@${today}`)).toContainText('Renamed strength');
  expect((await record(page, 'ironflow_active_session')).exercises).toEqual(before.exercises);
  await page.getByRole('region', { name: 'Next workout' }).getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Complete set 1 for Squat', exact: true }).click();
  await page.getByRole('button', { name: /Finish workout/ }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_history'))?.[0]?.templateName).toBe('Strength A');
});

test('calendar recurrence editor applies changes to this and future occurrences', async ({ page }) => {
  const yesterday = addDays(today, -1);
  await seed(page, { ironflow_templates: [routine, second], ironflow_schedule: { ...empty, appointments: [{ id: 'series', date: yesterday, kind: 'workout', templateId: routine.id, repeat: 'weekly' }] } });
  await page.getByRole('region', { name: 'Missed sessions' }).getByRole('button', { name: 'Edit / reschedule' }).click();
  const editor = page.getByRole('dialog', { name: 'Schedule appointment' });
  await editor.getByRole('combobox', { name: 'Routine', exact: true }).selectOption(second.id);
  await editor.getByRole('combobox', { name: 'Apply changes to', exact: true }).selectOption('future');
  await editor.getByLabel('Date', { exact: true }).fill(today);
  await editor.getByRole('button', { name: 'Save appointment' }).click();
  await expect(page.getByRole('region', { name: 'Next workout' })).toContainText(second.name);
  await expect.poll(async () => (await record(page, 'ironflow_schedule')).appointments.length).toBe(2);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(page.getByTestId(`calendar-${addDays(today, 7)}`)).toContainText(second.name);
});

test('calendar day strip shows dates, mixed workout markers, rest and missed sessions on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.clock.install({ time: new Date('2026-10-28T02:00:00Z') });
  const schedule = { appointments: [
    { id: 'missed', date: '2026-10-26', kind: 'workout', templateId: routine.id },
    { id: 'rest', date: '2026-10-27', kind: 'rest' },
    ...[1, 2, 3].map(i => ({ id: `planned-${i}`, date: '2026-10-28', kind: 'workout', templateId: routine.id })),
    { id: 'done', date: '2026-10-28', kind: 'workout', templateId: routine.id },
  ], exceptions: { 'done@2026-10-28': { status: 'completed', sessionId: 'done-session' } }, completions: [{ sessionId: 'done-session', date: '2026-10-28', name: 'Finished A', appointmentId: 'done@2026-10-28' }, { sessionId: 'unscheduled', date: '2026-10-29', name: 'Extra workout' }] };
  await seed(page, { ironflow_templates: [routine], ironflow_schedule: schedule });
  const calendar = page.getByRole('region', { name: 'Training calendar', exact: true });
  const strip = calendar.getByLabel('Select day', { exact: true });
  const current = strip.getByRole('button', { name: /Today, 3 scheduled workouts, 1 completed workout/ });
  await expect(current).toHaveAttribute('aria-current', 'date'); await expect(current).toHaveAttribute('aria-pressed', 'true');
  await expect(current).toContainText('28'); await expect(current).toContainText('3+'); await expect(current).toContainText('✓');
  const missed = strip.getByRole('button', { name: /1 missed workout/ }); await expect(missed).toContainText('!');
  const rest = strip.getByRole('button', { name: /Planned rest/ }); await expect(rest).toContainText('–');
  await rest.click(); await expect(rest).toHaveAttribute('aria-pressed', 'true'); await expect(current).toHaveAttribute('aria-pressed', 'false'); await expect(current).toHaveAttribute('aria-current', 'date');
  await expect(page.getByTestId('calendar-2026-10-27')).toContainText('Rest day');
  const extra = strip.getByRole('button', { name: /1 completed workout/ }).filter({ hasText: '29' });
  await expect(extra).toContainText('✓'); await extra.click(); await expect(page.getByTestId('calendar-2026-10-29')).toContainText('Extra workout');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(strip).toBeHidden(); await expect(calendar.getByTestId('appointment-planned-1@2026-10-28')).toContainText('Planned');
});
