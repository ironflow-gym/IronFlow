import { test, expect, type Page } from '@playwright/test';
import { addDays } from '../../src/scheduling';
test.use({ timezoneId: 'Australia/Brisbane' });
const name = 'Incline Dumbbell Bench Press';
const settings = { units: 'metric', defaultRestTimer: 60 };
const draft = { id: 'ui-session', name: 'Upper body', status: 'active', startTime: Date.now(), exercises: [{ id: 'press', name, category: 'Chest', targetReps: '8-12', sets: [
  { id: 'warmup', weight: 10, reps: 10, unit: 'kgs', completed: false, isWarmup: true, timestamp: 0 },
  { id: 'working', weight: 20, reps: 8, unit: 'kgs', completed: false, timestamp: 0 },
  { id: 'next', weight: 20, reps: 9, unit: 'kgs', completed: false, timestamp: 0 },
  { id: 'deload', weight: 5, reps: 12, unit: 'kgs', completed: false, isDeload: true, timestamp: 0 },
] }] };
async function seed(page: Page, data: Record<string, unknown> = {}) {
  await page.goto('/'); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.evaluate(async records => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); await storage.overwriteEverything(records); }, { ironflow_active_session: draft, ironflow_settings: settings, ...data });
  await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.getByRole('region', { name: 'Next workout' }).getByRole('button', { name: 'Resume workout', exact: true }).click();
}
async function record(page: Page) { return page.evaluate(async () => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.get('ironflow_active_session'); }); }

test('mobile header is readable, increase is discoverable and copied warmup keeps the working classification', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); await seed(page);
  const progression = page.getByTestId(`progression-${name}`);
  await expect(progression.locator('details')).not.toHaveAttribute('open');
  await expect(progression.getByRole('button', { name: 'Increase weight', exact: true })).toBeVisible();
  for (const label of [`Get coaching advice for ${name}`, `View history for ${name}`, `View instructions for ${name}`]) {
    const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: `Copy warmup 1 to set 2 of ${name}`, exact: true }).click();
  await expect.poll(async () => (await record(page)).exercises[0].sets[1].weight).toBe(10);
  expect((await record(page)).exercises[0].sets[1].isWarmup).not.toBe(true);
  await expect(page.getByLabel(`Set 2 classification for ${name}`, { exact: true })).toHaveValue('working');
  await page.getByRole('button', { name: `View history for ${name}`, exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/ironflow-247-compact-active.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('number pad traps focus, cancels without edits, applies a value and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); await seed(page);
  const trigger = page.getByTestId('set-working').getByRole('button', { name: 'Edit kg', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Adjust weight', exact: true });
  await expect(dialog.getByRole('button', { name: 'Apply value', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: 'Apply value', exact: true }).focus(); await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close value editor', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: '3', exact: true }).click();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  expect((await record(page)).exercises[0].sets[1].weight).toBe(20);
  await trigger.click(); await dialog.getByRole('button', { name: '3', exact: true }).click(); await dialog.getByRole('button', { name: '0', exact: true }).click();
  await page.screenshot({ path: '/tmp/ironflow-247-number-pad.png' });
  await dialog.getByRole('button', { name: 'Apply value', exact: true }).click();
  await expect.poll(async () => (await record(page)).exercises[0].sets[1].weight).toBe(30);
  await expect(page.getByTestId(`progression-${name}`).locator('summary')).not.toContainText('Choose a starting load');
});

test('manual starting load clears the stale prompt and uses exercise-specific wording', async ({ page }) => {
  await seed(page, { ironflow_active_session: { ...draft, exercises: [{ ...draft.exercises[0], suggestedWeight: 0, sets: draft.exercises[0].sets.map(s => ({ ...s, weight: 0 })) }] } });
  const progression = page.getByTestId(`progression-${name}`); await progression.locator('summary').click();
  await progression.getByRole('button', { name: 'Enter my own', exact: true }).click();
  await progression.getByLabel(`Custom weight for ${name}`).fill('30'); await progression.getByLabel(`Custom reps for ${name}`).fill('10');
  await progression.getByRole('button', { name: 'Apply to this exercise', exact: true }).click();
  await expect(progression.locator('summary')).toContainText('Selected: 30 kg per hand × 10');
  await expect(progression.locator('summary')).not.toContainText('Choose a starting load');
});

test('delete and discard require confirmation; classification remains keyboard accessible and deloads get no PR', async ({ page }) => {
  await seed(page);
  const classification = page.getByLabel(`Set 2 classification for ${name}`, { exact: true });
  await classification.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(classification).toHaveValue('warmup');
  await page.getByRole('button', { name: `Delete set 3 for ${name}`, exact: true }).click();
  const deletion = page.getByRole('dialog', { name: 'Delete set?', exact: true });
  await deletion.getByRole('button', { name: 'Keep set', exact: true }).click(); expect((await record(page)).exercises[0].sets).toHaveLength(4);
  await page.getByRole('button', { name: `Delete set 3 for ${name}`, exact: true }).click(); await deletion.getByRole('button', { name: 'Delete set', exact: true }).click();
  await expect.poll(async () => (await record(page)).exercises[0].sets.length).toBe(3);
  await page.getByRole('button', { name: 'Discard workout', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard workout?', exact: true });
  await page.keyboard.press('Escape'); await expect(discard).toHaveCount(0); expect(await record(page)).not.toBeNull();
  await page.getByRole('button', { name: 'Discard workout', exact: true }).click();
  await discard.getByRole('button', { name: 'Discard workout', exact: true }).click();
  await expect.poll(() => record(page)).toBeNull();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await seed(page, { ironflow_history: [1, 2].map(days => ({ date: addDays(today, -days), exercise: name, category: 'Chest', weight: 1, reps: 8, unit: 'kgs' })) });
  // Five kg x 12 would exceed both prior sessions if this were a working set.
  await page.getByRole('button', { name: `Complete set 4 for ${name}`, exact: true }).click();
  await expect(page.getByTestId('set-deload')).not.toContainText('PR ·');
});

test('plate details nest above the value editor and both dialogs close with Escape and restore focus', async ({ page }) => {
  await seed(page);
  const trigger = page.getByTestId('set-working').getByRole('button', { name: 'Edit kg', exact: true });
  await trigger.click(); const editor = page.getByRole('dialog', { name: 'Adjust weight', exact: true });
  await editor.locator('summary').click();
  await editor.getByRole('button', { name: 'View plate loading details', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Plate loading', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Plate loading', exact: true })).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'View plate loading details', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(editor).toHaveCount(0); await expect(trigger).toBeFocused();
});
