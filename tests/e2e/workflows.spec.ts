import { test, expect, type Page } from '@playwright/test';

const draft = {
  id: 'session-1', name: 'Test strength session', status: 'active', restLabel: 'Rest', restEndTime: null, startTime: Date.now() - 600000,
  exercises: [{ id: 'squat', name: 'Squat', category: 'Legs', suggestedWeight: 60, suggestedReps: 8, targetReps: '8-12', sets: [
    { id: 'one', weight: 60, reps: 8, unit: 'kgs', completed: false, timestamp: 0 },
    { id: 'two', weight: 50, reps: 5, unit: 'kgs', completed: false, timestamp: 0 },
  ] }],
};
const previous = { date: '2026-01-01', exercise: 'Squat', category: 'Legs', weight: 55, reps: 8, unit: 'kgs', completedAt: 1 };

async function skipKey(page: Page) {
  await page.getByRole('button', { name: /Skip for now/ }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  const resume = page.getByRole('button', { name: 'Resume workout', exact: true }).first();
  if (await resume.isVisible()) await resume.click();
}
async function seed(page: Page, data: Record<string, unknown>) {
  await page.goto('/');
  await skipKey(page);
  await page.evaluate(async records => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('IronFlow_NeuralCore', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('vault', 'readwrite');
        const store = tx.objectStore('vault');
        store.clear();
        Object.entries(records).forEach(([id, value]) => store.put({ id, value }));
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, data);
  await page.reload();
  await skipKey(page);
}
async function record(page: Page, key: string) {
  return page.evaluate(async id => {
    return new Promise<any>((resolve, reject) => {
      const request = indexedDB.open('IronFlow_NeuralCore', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('vault', 'readonly');
        const get = tx.objectStore('vault').get(id);
        tx.oncomplete = () => { db.close(); resolve(get.result?.value ?? null); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, key);
}

test('mobile logging repeats values, supports sustained adjustment, resumes and completes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await seed(page, { ironflow_active_session: draft, ironflow_history: [previous] });
  await expect(page.getByTestId('set-one')).toContainText('Last time (2026-01-01): 55 kg × 8');
  await page.getByRole('button', { name: 'Repeat previous set for set 2 of Squat' }).click();
  await expect(page.getByTestId('set-two').getByRole('button', { name: 'Edit kg' })).toContainText('60');
  const increase = page.getByTestId('set-two').getByRole('button', { name: 'Increase kg', exact: true });
  await increase.scrollIntoViewIfNeeded();
  const box = (await increase.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[1].weight).toBeGreaterThan(62.5);
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  const beforeReload = await record(page, 'ironflow_active_session');
  await page.reload();
  await skipKey(page);
  await expect(page.getByTestId('set-two').getByRole('button', { name: 'Edit kg' })).toContainText(String(beforeReload.exercises[0].sets[1].weight));
  await page.getByRole('button', { name: 'Complete set 1 for Squat', exact: true }).click();
  await page.getByRole('button', { name: 'Complete set 2 for Squat', exact: true }).click();
  await page.getByRole('button', { name: /Complete Flow/ }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_history')).length).toBe(3);
  expect(await record(page, 'ironflow_active_session')).toBeNull();
  expect(errors).toEqual([]);
});

test('failed local saves are visible and retry preserves the latest edits', async ({ page }) => {
  await seed(page, { ironflow_active_session: draft });
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).__restorePut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (args[0].id === 'ironflow_history') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.getByTestId('set-one').getByRole('button', { name: 'Increase kg', exact: true }).click();
  await expect(page.getByText('Not saved — keep this tab open', { exact: true })).toBeVisible();
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets[0].weight).toBe(60);
  await page.evaluate(() => (window as any).__restorePut());
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  expect((await record(page, 'ironflow_active_session')).exercises[0].sets[0].weight).toBe(61.25);
});

test('offline edits upload the committed state after reconnect through mocked Drive', async ({ page, context }) => {
  const uploads: string[] = [];
  await page.route('https://www.googleapis.com/**', async route => {
    if (route.request().url().includes('/upload/')) {
      uploads.push(route.request().postData() || '');
      await route.fulfill({ json: { id: 'test-file' } });
    } else await route.fulfill({ json: { files: [] } });
  });
  await seed(page, { ironflow_active_session: draft, ironflow_settings: { ironSyncConnected: true }, ironflow_saved_meals: [{ id: 'saved-oats', name: 'Saved oats', foods: [{ name: 'Oats', calories: 380, protein: 13, carbs: 60, fats: 7, confidence: 1 }] }], ironflow_schedule: { appointments: [{ id: 'drive-calendar', date: '2026-10-26', kind: 'rest' }], exceptions: {}, completions: [] } });
  await page.evaluate(() => {
    localStorage.setItem('ironflow_sync_token', 'test-token');
    localStorage.setItem('ironflow_sync_token_expiry', String(Date.now() + 3600000));
  });
  await page.reload();
  await skipKey(page);
  await context.setOffline(true);
  await page.getByTestId('set-one').getByRole('button', { name: 'Increase kg', exact: true }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  expect((await record(page, '__ironflow_backup_state')).pending).toBe(true);
  expect(uploads).toHaveLength(0);
  await context.setOffline(false);
  await expect.poll(() => uploads.length).toBeGreaterThan(0);
  expect(uploads.at(-1)).toContain('61.25');
  expect(uploads.at(-1)).toContain('ironflow_schedule');
  expect(uploads.at(-1)).toContain('drive-calendar');
  expect(uploads.at(-1)).toContain('ironflow_saved_meals');
  expect(uploads.at(-1)).toContain('saved-oats');
  await expect.poll(async () => (await record(page, '__ironflow_backup_state')).pending).toBe(false);
  await expect(page.getByRole('button', { name: /Backed up at/ }).last()).toBeVisible();
});

test('library and JSON export/restore preserve existing records', async ({ page }) => {
  await seed(page, { ironflow_history: [previous], ironflow_pantry: [{ id: 'oats', name: 'Oats', calories: 380 }] });
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByPlaceholder('Search exercises...').fill('Squat');
  await expect(page.getByRole('button', { name: /Squat Legs/i })).toBeVisible();
  await page.keyboard.press('Escape');
  // Reload closes the library without relying on an unlabeled close icon.
  await page.reload();
  await skipKey(page);
  await page.getByRole('button', { name: 'Vault Backup', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export Local Vault/ }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.ironflow_history[0]).toMatchObject(previous);
  expect(exported.ironflow_pantry[0].name).toBe('Oats');
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await page.getByRole('button', { name: 'Confirm Neural Sync', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Neural Core Re-initialized', exact: true })).toBeVisible();
  expect((await record(page, 'ironflow_history'))[0]).toMatchObject(previous);
});

test('a manual routine can be created, edited, saved and started without AI', async ({ page }) => {
  await page.goto('/');
  await skipKey(page);
  await page.getByRole('button', { name: 'New Template', exact: true }).click();
  await page.getByPlaceholder('Unnamed Routine').fill('My strength routine');
  await page.getByPlaceholder('Filter by name...').fill('Squat');
  await page.getByRole('button', { name: /Squat Legs/i }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_templates'))?.[0]?.name).toBe('My strength routine');
  expect((await record(page, 'ironflow_templates'))[0].exercises[0].name).toBe('Squat');
  await page.reload();
  await skipKey(page);
  await expect(page.getByText('My strength routine', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manage routines', exact: true }).click();
  await page.getByRole('button', { name: 'Manual Overhaul', exact: true }).click();
  await page.getByPlaceholder('Unnamed Routine').fill('Updated strength routine');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Initialize Program', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_active_session'))?.name).toBe('Updated strength routine');
});

test('a failed initial read does not enable autosave over existing records', async ({ page }) => {
  await seed(page, { ironflow_history: [previous] });
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.get;
    (window as any).__restoreGet = () => { IDBObjectStore.prototype.get = original; };
    IDBObjectStore.prototype.get = function (...args: Parameters<typeof original>) {
      const request = original.apply(this, args);
      if (args[0] === 'ironflow_history') request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your records could not be loaded' })).toBeVisible();
  await page.evaluate(() => (window as any).__restoreGet());
  expect((await record(page, 'ironflow_history'))[0]).toMatchObject(previous);
});

test('manual measurements and existing meal edits persist without AI', async ({ page }) => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  await seed(page, { ironflow_fuel: [{ id: 'meal', date, name: 'Breakfast oats', calories: 380, protein: 13, carbs: 60, fats: 7, confidence: 1 }] });
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await page.getByRole('button', { name: 'Biometrics', exact: true }).click();
  await page.getByRole('button', { name: 'Register New Indices', exact: true }).click();
  await page.getByPlaceholder('0.0', { exact: true }).first().fill('82.5');
  await page.getByRole('button', { name: 'Commit Indices', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_biometrics'))?.[0]?.weight).toBe(82.5);
  await page.getByRole('button', { name: 'Fuel', exact: true }).click();
  const mealCard = page.getByRole('heading', { name: 'Breakfast oats', exact: true }).locator('..').locator('..');
  await mealCard.getByRole('button').first().click();
  const editor = page.getByRole('heading', { name: 'Recalibrate Intake', exact: true }).locator('..').locator('..');
  await editor.locator('input[type=number]').last().fill('400');
  await page.getByRole('button', { name: 'Update Instance', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_fuel'))?.[0]?.calories).toBe(400);
  await page.reload();
  await skipKey(page);
  expect((await record(page, 'ironflow_biometrics'))[0].weight).toBe(82.5);
  expect((await record(page, 'ironflow_fuel'))[0].calories).toBe(400);
});
