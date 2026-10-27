import { test, expect, type Page } from '@playwright/test';
const exercise = { name: 'Machine Press', category: 'Chest', suggestedSets: 3, warmupCount: 0, suggestedWeight: 30.06, suggestedReps: 8, targetReps: '8-12', restSeconds: 60 };
const routine = { id: 'daily-routine', name: 'Daily workout', exercises: [exercise] };
const draft = { id: 'daily-session', name: routine.name, status: 'active', startTime: Date.now(), exercises: [{ ...exercise, id: 'daily-press', sets: [1, 2, 3].map(n => ({ id: `daily-${n}`, weight: 30.06, reps: 8, unit: 'kgs', completed: false, timestamp: 0 })) }] };
async function seed(page: Page, active = true) {
  await page.goto('/'); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.evaluate(async data => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); await storage.overwriteEverything(data); }, { ironflow_templates: [routine], ...(active ? { ironflow_active_session: draft } : {}), ironflow_settings: { units: 'metric' }, ironflow_library: [{ name: exercise.name, category: 'Chest', muscles: ['Pectorals'], instructions: [], barWeight: 22.56, weightIncrement: 2.5, loadingMode: 'single' }] });
  await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click();
  if (active) await page.getByRole('region', { name: 'Next workout' }).getByRole('button', { name: 'Resume workout', exact: true }).click();
}
async function record(page: Page, key: string) { return page.evaluate(async key => { const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts')); return storage.get(key); }, key); }

test('narrow-screen logging stays compact and rest controls leave the current set usable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 }); await seed(page); await page.setViewportSize({ width: 320, height: 568 });
  // Resize, web-font loading and workout entry scrolling can settle on different
  // frames in CI. Retry the actual geometry requirements, not a fixed delay.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect.poll(async () => (await page.getByTestId('set-daily-1').boundingBox())?.y ?? Infinity, { message: 'First set must be reachable near the top on a 320px screen' }).toBeLessThan(360);
  await expect.poll(async () => (await page.getByTestId('set-daily-2').boundingBox())?.height ?? Infinity, { message: 'Set rows must retain their compact mobile height' }).toBeLessThanOrEqual(140);
  const controls = await page.getByTestId('set-daily-1').getByRole('button').all();
  for (const control of controls) {
    if (await control.isVisible()) {
      const name = await control.getAttribute('aria-label');
      await expect.poll(async () => (await control.boundingBox())?.height ?? 0, { message: `${name}: touch target height` }).toBeGreaterThanOrEqual(44);
      await expect.poll(async () => (await control.boundingBox())?.width ?? 0, { message: `${name}: touch target width` }).toBeGreaterThanOrEqual(43.5);
    }
  }
  await page.getByRole('button', { name: 'Complete set 1 for Machine Press', exact: true }).click();
  const timer = page.getByTestId('rest-timer'); await expect(timer).toBeVisible();
  for (const button of await timer.getByRole('button').all()) {
    const name = await button.getAttribute('aria-label');
    await expect.poll(async () => (await button.boundingBox())?.height ?? 0, { message: `${name}: rest control height` }).toBeGreaterThanOrEqual(44);
    await expect.poll(async () => (await button.boundingBox())?.width ?? 0, { message: `${name}: rest control width` }).toBeGreaterThanOrEqual(44);
  }
  const second = page.getByRole('button', { name: 'Complete set 2 for Machine Press', exact: true });
  await expect(async () => {
    await second.scrollIntoViewIfNeeded();
    const coveredBy = await second.evaluate(el => {
      const b = el.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return el.contains(hit) ? null : hit?.outerHTML.slice(0, 500) ?? 'outside viewport';
    });
    expect(coveredBy, 'The next set must not be covered by the rest timer or navigation').toBeNull();
  }).toPass({ timeout: 5000 });
  await second.click(); await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[1].completed).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('native scrolling clears enlarged mobile navigation and the active workout header', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 }); await seed(page); await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Complete set 1 for Machine Press', exact: true }).click();
  // A larger home-indicator area reproduces the CI overlap reliably. The bar
  // must be measured rather than assuming a particular device or font height.
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-bottom', '48px'));
  const nav = page.locator('nav[aria-label="Main navigation"]').filter({ visible: true });
  await expect.poll(async () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-nav-clearance')))).toBeGreaterThan(130);
  const second = page.getByRole('button', { name: 'Complete set 2 for Machine Press', exact: true });
  await second.evaluate(el => {
    const b = el.getBoundingClientRect(), nav = [...document.querySelectorAll('nav[aria-label="Main navigation"]')].find(item => item.getBoundingClientRect().height > 0)!.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + b.y + b.height / 2 - (nav.top + 10), behavior: 'instant' });
  });
  await expect.poll(() => second.evaluate(el => { const b = el.getBoundingClientRect(); return !!document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('nav'); })).toBe(true);
  await second.evaluate(el => el.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
  await expect.poll(async () => {
    const button = (await second.boundingBox())!, navigation = (await nav.boundingBox())!, header = (await page.getByTestId('workout-controls').boundingBox())!;
    return button.y >= header.y + header.height && button.y + button.height <= navigation.y;
  }, { message: 'The whole set control must fit between the workout header and navigation' }).toBe(true);
  await second.click(); await expect.poll(async () => (await record(page, 'ironflow_active_session')).exercises[0].sets[1].completed).toBe(true);
  await page.getByRole('button', { name: 'Dismiss rest timer', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-nav-clearance')))).toBe(0);
});

test('Finish stays reachable at the end of a workout and retains explicit exertion recording', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); await seed(page);
  for (const n of [1, 2, 3]) await page.getByRole('button', { name: `Complete set ${n} for Machine Press`, exact: true }).click();
  const finish = page.getByRole('button', { name: 'Finish workout', exact: true }); await expect(finish).toBeFocused();
  expect((await finish.boundingBox())!.y).toBeLessThan(180);
  await finish.click(); await page.getByRole('button', { name: '7', exact: true }).click(); await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect.poll(() => record(page, 'ironflow_active_session')).toBeNull();
  const logs = await record(page, 'ironflow_history'); expect(logs).toHaveLength(3); expect(logs.every((r: any) => r.sessionRPE === 7)).toBe(true);
});

for (const width of [360, 1440]) test(`workout edits at ${width}px require explicit timed values and confirm discarding`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await seed(page, false); await page.getByRole('button', { name: 'Manage routines', exact: true }).click(); await page.getByRole('button', { name: 'Manual Overhaul', exact: true }).click();
  const weight = page.getByLabel('Weight (kg)', { exact: true }); expect((await weight.boundingBox())!.width).toBeGreaterThan(140); await weight.fill('32.56');
  await page.getByRole('combobox', { name: 'Track', exact: true }).selectOption('time'); await expect(page.getByLabel('Duration (seconds)', { exact: true })).toBeEmpty();
  await page.getByLabel('Duration (seconds)', { exact: true }).fill('45');
  await page.keyboard.press('Escape'); const confirm = page.getByRole('dialog', { name: 'Discard workout edits', exact: true }); await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Keep editing', exact: true }).click(); await expect(page.getByLabel('Duration (seconds)', { exact: true })).toHaveValue('45'); expect((await record(page, 'ironflow_templates'))[0]).toEqual(routine);
  await page.getByRole('button', { name: width < 1024 ? 'Save workout' : 'Save', exact: true }).click();
  await expect.poll(async () => (await record(page, 'ironflow_templates'))[0].exercises[0].targetReps).toBe('45 seconds');
  const saved = (await record(page, 'ironflow_templates'))[0].exercises[0]; expect(saved.tracking).toBe('time'); expect(saved.suggestedReps).toBe(45); expect(saved.suggestedWeight).toBe(32.56);
});
