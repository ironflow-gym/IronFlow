import { test, expect, type Page } from '@playwright/test';
test.use({ timezoneId: 'Australia/Brisbane' });
const food = { id: 'original', name: 'Original breakfast', date: '2026-10-25', calories: 300, protein: 20, carbs: 30, fats: 10, confidence: 1 };
async function skip(page: Page) { await page.getByRole('button', { name: /Skip for now/ }).click(); }
async function seed(page: Page, data: Record<string, unknown>) {
  await page.goto('/'); await skip(page);
  await page.evaluate(async data => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    await storage.overwriteEverything(data);
  }, data);
  await page.reload(); await skip(page);
}
async function record(page: Page, key: string) {
  return page.evaluate(async key => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    return storage.get(key);
  }, key);
}
async function open(page: Page) {
  if ((await page.getByRole('button', { name: 'Open menu', exact: true }).isVisible())) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Vault Backup', exact: true }).click();
  return page.getByRole('dialog', { name: 'Backup and restore', exact: true });
}
async function choose(page: Page, data: unknown) {
  await page.getByLabel('Choose JSON backup', { exact: true }).setInputFiles({ name: 'old-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
}
async function continueApp(page: Page) {
  await page.getByRole('button', { name: 'Continue to IronFlow', exact: true }).click(); await skip(page);
}

test('mobile review is compact, cancellation changes nothing, restore and undo survive reopening', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page, { ironflow_fuel: [food], ironflow_saved_meals: [{ id: 'saved', name: 'Breakfast', foods: [food] }], ironflow_settings: { units: 'imperial' } });
  const dialog = await open(page);
  await choose(page, { ironflow_history: [] });
  await expect(dialog.getByRole('heading', { name: 'Review backup' })).toBeFocused();
  await expect(dialog.getByText('Backup date not recorded in this file')).toBeVisible();
  await expect(dialog.getByRole('row', { name: 'Food entries 1 Missing' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Restore this backup', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/ironflow-246-restore-review.png' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await record(page, 'ironflow_fuel')).toEqual([food]);
  expect(await record(page, '__ironflow_restore_recovery')).toBeNull();
  await choose(page, { ironflow_history: [] });
  await dialog.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Backup restored', exact: true })).toBeVisible();
  expect(await record(page, 'ironflow_fuel')).toBeNull();
  expect(await record(page, 'ironflow_settings')).toMatchObject({ units: 'imperial' });
  await continueApp(page);
  await expect(page.getByRole('button', { name: 'Drive backups paused after restore', exact: true }).last()).toBeVisible();
  await page.evaluate(async food => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    await storage.set('ironflow_fuel', [{ ...food, name: 'After restore' }]);
  }, food);
  await page.reload(); await skip(page);
  await open(page);
  await page.getByRole('button', { name: 'Review undo restore', exact: true }).click();
  await expect(dialog.getByText(/changes made since the restore/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Undo restore', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Restore undone', exact: true })).toBeVisible();
  await continueApp(page);
  expect(await record(page, 'ironflow_fuel')).toEqual([food]);
  expect(await record(page, '__ironflow_restore_recovery')).toBeNull();
  expect((await record(page, '__ironflow_backup_state')).pausedAfterRestore).toBe(true);
});

test('malformed file and nested records never reach confirmation or replace current data', async ({ page }) => {
  await seed(page, { ironflow_fuel: [food] }); const dialog = await open(page);
  await page.getByLabel('Choose JSON backup').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(dialog.getByRole('alert')).toContainText('not valid JSON');
  for (const data of [{ hello: 1 }, { ironflow_fuel: [{ ...food, calories: 'three hundred' }] }, { ironflow_schedule: { appointments: 'bad', exceptions: {}, completions: [] } }]) {
    await choose(page, data);
    await expect(dialog.getByRole('alert')).toContainText('Invalid backup');
    await expect(dialog.getByRole('button', { name: 'Restore this backup', exact: true })).toHaveCount(0);
    expect(await record(page, 'ironflow_fuel')).toEqual([food]);
  }
});

test('recovery copy failure leaves original records intact and allows retry without reselecting', async ({ page }) => {
  await seed(page, { ironflow_fuel: [food] }); const dialog = await open(page);
  await choose(page, { ironflow_history: [] });
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).__restorePut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (args[0].id === '__ironflow_restore_recovery') throw new DOMException('Storage is full. Your data has not changed.', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await dialog.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Storage is full');
  expect(await record(page, 'ironflow_fuel')).toEqual([food]);
  expect(await record(page, '__ironflow_restore_recovery')).toBeNull();
  await page.evaluate(() => (window as any).__restorePut());
  await dialog.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Backup restored', exact: true })).toBeVisible();
});

test('cloud review is read-only and automatic uploads remain paused until explicit resume', async ({ page }) => {
  const uploads: string[] = []; const deletes: string[] = [];
  const payload = { lastUpdated: new Date('2026-10-25T00:00:00Z').getTime(), instanceName: 'Other phone', instanceId: 'other-phone', data: { ironflow_fuel: [{ ...food, name: 'Cloud breakfast' }] } };
  await page.route('https://www.googleapis.com/**', async route => {
    const request = route.request(), url = request.url();
    if (request.method() === 'DELETE') { deletes.push(url); await route.fulfill({ json: {} }); }
    else if (url.includes('/upload/')) { uploads.push(request.postData() || ''); await route.fulfill({ json: { id: 'new-file' } }); }
    else if (url.includes('alt=media')) await route.fulfill({ json: payload });
    else if (decodeURIComponent(url).includes('name contains')) await route.fulfill({ json: { files: [0, 1, 2, 3].map(i => ({ id: `source-${i}`, name: 'ironflow_mirror_other-phone.json', createdTime: `2026-10-${25 - i}T00:00:00Z` })) } });
    else await route.fulfill({ json: { files: [] } });
  });
  await seed(page, { ironflow_fuel: [food], ironflow_settings: { ironSyncConnected: true } });
  await page.evaluate(() => {
    localStorage.setItem('ironflow_sync_token', 'test-token');
    localStorage.setItem('ironflow_sync_token_expiry', String(Date.now() + 3600000));
  });
  await page.reload(); await skip(page); const dialog = await open(page);
  await dialog.getByRole('button', { name: 'Restore from Google Drive', exact: true }).click();
  await dialog.getByRole('button', { name: /Other phone/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Review backup' })).toBeVisible();
  expect(deletes).toHaveLength(0); expect(uploads).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Backup restored', exact: true })).toBeVisible();
  await continueApp(page);
  await page.getByRole('button', { name: 'Food', exact: true }).click();
  await page.getByRole('button', { name: 'Log food manually', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Log food manually', exact: true });
  await editor.getByLabel('Food name', { exact: true }).fill('New local food');
  for (const label of ['Calories (kcal)', 'Protein (g)', 'Carbs (g)', 'Fats (g)']) await editor.getByLabel(label, { exact: true }).fill('10');
  await editor.getByRole('button', { name: 'Add to food log', exact: true }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload(); await skip(page);
  // Force the normal queue too: ordinary Backup Now cannot bypass the durable pause.
  await page.evaluate(async () => {
    const { backupQueue } = await import(/* @vite-ignore */ String('/services/backupService.ts'));
    backupQueue.request(); await backupQueue.flush();
  });
  expect(uploads).toHaveLength(0);
  await open(page);
  await dialog.getByRole('button', { name: 'Back up restored data', exact: true }).click();
  await expect.poll(() => uploads.length).toBe(1);
  expect(uploads[0]).toContain('Cloud breakfast'); expect(uploads[0]).toContain('New local food');
  expect(uploads[0]).not.toContain('__ironflow_restore_recovery'); expect(uploads[0]).not.toContain('__ironflow_backup_state');
  expect((await record(page, '__ironflow_backup_state')).pausedAfterRestore).toBe(false);
});

test('unfinished workout warning and unsaved-change blocking protect the current draft', async ({ page }) => {
  const draft = { id: 'unfinished', name: 'Unfinished routine', status: 'active', startTime: Date.now(), exercises: [] };
  await seed(page, { ironflow_active_session: draft });
  const dialog = await open(page); await choose(page, { ironflow_history: [] });
  await expect(dialog.getByText(/Your unfinished workout will be replaced/)).toBeVisible();
  await page.evaluate(async () => {
    const original = IDBObjectStore.prototype.put;
    (window as any).__restorePut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function () { throw new DOMException('Full', 'QuotaExceededError'); };
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    await storage.set('ironflow_fuel', []).catch(() => {});
  });
  await expect(dialog.getByRole('button', { name: 'Restore this backup', exact: true })).toBeDisabled();
  await expect(dialog.getByText('Current changes are not saved.', { exact: false })).toBeVisible();
  expect(await record(page, 'ironflow_active_session')).toMatchObject(draft);
  await page.evaluate(() => (window as any).__restorePut());
  await dialog.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Restore this backup', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Backup restored', exact: true })).toBeVisible();
  expect((await record(page, '__ironflow_restore_recovery')).data.ironflow_active_session).toMatchObject(draft);
});
