// Start Vite on 127.0.0.1:5174 first. Real UI captures with fictional records only.
// Network requests outside the local app are blocked; Drive and barcode responses are mocked.
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
await mkdir('public/help', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' });
const dimensions = {};
const now = new Date('2026-10-28T02:00:00Z');
const machine = { name: 'Machine Press', category: 'Chest', muscles: ['Pectorals'], instructions: [], benefits: '', risks: '', barWeight: 22.56, weightIncrement: 2.5, loadingMode: 'single' };
const routines = ['A', 'B', 'C', 'D'].map((letter, i) => ({ id: `help-${i}`, name: `Workout ${letter}`, exercises: [{ name: machine.name, category: 'Chest', suggestedSets: 3, suggestedWeight: 30.06, suggestedReps: 8, targetReps: '8-12', restSeconds: 90, warmupCount: 0, rationale: '' }] }));
const draft = { id: 'help-session', name: 'Workout A', templateId: 'help-0', status: 'active', startTime: now.getTime() - 600000, exercises: [{ id: 'press', name: machine.name, category: 'Chest', targetReps: '8-12', restSeconds: 90, sets: [1, 2, 3].map(i => ({ id: `help-set-${i}`, weight: 30.06, reps: 8, unit: 'kgs', completed: false, timestamp: 0 })) }] };
const foods = [{ id: 'oats', date: '2026-10-28', name: 'Breakfast oats', calories: 380, protein: 13, carbs: 60, fats: 7, confidence: 1 }, { id: 'coffee', date: '2026-10-28', name: 'Coffee', calories: 80, protein: 4, carbs: 6, fats: 4, confidence: 1 }];
async function fresh(extra = {}, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 1100 }, deviceScaleFactor: 1, timezoneId: 'Australia/Brisbane', serviceWorkers: 'block', locale: 'en-AU' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.clock.setFixedTime(now);
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:5174') ? route.continue() : route.abort());
  if (options.drive) await page.route('https://www.googleapis.com/**', route => route.fulfill({ json: { files: [], id: 'fictional-backup' } }));
  await page.goto('http://127.0.0.1:5174');
  await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.evaluate(async ({ extra, drive, block }) => {
    const { storage } = await import('/services/storageService.ts');
    if (drive) {
      localStorage.setItem('ironflow_sync_token', 'fictional-help-token');
      localStorage.setItem('ironflow_sync_token_expiry', String(Date.now() + 3600000));
      localStorage.setItem('ironflow_instance_name', 'Example phone');
    }
    if (block) {
      const { createBlock } = await import('/src/trainingBlocks.ts');
      extra.ironflow_blocks = [createBlock({ name: 'Build strength', goal: 'strength', daysPerWeek: 3, workoutsPerRound: 4, rounds: 2, minutes: 45, experience: 'intermediate', returning: false, equipment: 'Machine and dumbbells', priorities: '', event: '' }, extra.ironflow_templates, 'double')];
    }
    await storage.overwriteEverything(extra);
  }, { extra: { ironflow_settings: { units: 'metric', defaultRestTimer: 90, ...options.settings }, ironflow_templates: routines, ironflow_library: [machine], ...extra }, drive: options.drive, block: options.block });
  await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.addStyleTag({ content: '*,*::before,*::after { transition: none !important; animation: none !important; caret-color: transparent !important; }' });
  return page;
}
async function menu(page, name) { await page.getByRole('button', { name: 'Open menu', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); }
async function clearMarks(page) { await page.evaluate(() => document.querySelectorAll('[data-help-marker]').forEach(marker => { marker.helpTarget.style.outline = marker.dataset.originalOutline; marker.helpTarget.style.outlineOffset = marker.dataset.originalOffset; marker.remove(); })); }
async function mark(locator, letter) {
  await locator.evaluate((element, letter) => {
    const box = element.getBoundingClientRect();
    const marker = document.createElement('span'); marker.dataset.helpMarker = 'true'; marker.textContent = letter; marker.setAttribute('aria-hidden', 'true');
    marker.dataset.originalOutline = element.style.outline; marker.dataset.originalOffset = element.style.outlineOffset; marker.helpTarget = element;
    element.style.outline = '2px solid #34d399'; element.style.outlineOffset = '2px';
    const top = box.y - (element.matches('h1,h2,h3,p') ? 23 : 7);
    marker.style.cssText = `position:fixed;top:${top}px;left:${box.x - 5}px;background:#a7f3d0;color:#052e16;border:2px solid #020617;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font:bold 12px Arial;z-index:9999;pointer-events:none`;
    (element.closest('dialog[open]') || document.body).append(marker);
  }, letter);
}
async function shot(page, file, region, marks) {
  await clearMarks(page);
  await region.scrollIntoViewIfNeeded();
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  const regionHandle = await region.elementHandle();
  const box = await regionHandle.boundingBox();
  const targets = await Promise.all(marks.map(async ([locator, letter]) => [await locator.elementHandle(), letter]));
  for (const [element, letter] of targets) await mark(element, letter);
  await regionHandle.evaluate(element => {
    if (element.matches('[data-testid^="set-"]')) document.querySelectorAll('[data-testid^="set-"]').forEach(row => { if (row !== element) { row.dataset.helpSuppressed = 'true'; row.style.visibility = 'hidden'; } });
  });
  if (!box || box.height > 1070) throw new Error(`${file}: crop is too tall (${box?.height})`);
  const paddingY = file === 'workout-actions' ? 2 : 12;
  await page.screenshot({ path: `public/help/${file}.png`, clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - paddingY), width: Math.min(390 - Math.max(0, box.x - 10), box.width + 20), height: box.height + paddingY * 2 } });
  await page.evaluate(() => document.querySelectorAll('[data-help-suppressed]').forEach(row => { row.style.visibility = ''; delete row.dataset.helpSuppressed; }));
  const png = await readFile(`public/help/${file}.png`);
  dimensions[file] = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  await chmod(`public/help/${file}.png`, 0o644);
  process.stdout.write(`${file}\n`);
}
try {
  // Everyday logging, then real tap and hold states. Do not delete any set.
  let page = await fresh({ ironflow_active_session: draft });
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  const row = page.getByTestId('set-help-set-2');
  await shot(page, 'workout-values', row, [[row.getByRole('button', { name: 'Edit kg', exact: true }), 'A'], [row.getByRole('button', { name: 'Edit reps', exact: true }), 'B'], [row.getByRole('button', { name: 'Complete set 2 for Machine Press', exact: true }), 'C']]);
  const exercise = page.getByRole('button', { name: 'Change exercise for Machine Press', exact: true }).locator('../..');
  await shot(page, 'workout-actions', exercise, [[page.getByRole('button', { name: 'Change exercise for Machine Press', exact: true }), 'A'], [page.getByRole('button', { name: 'Increase weight for Machine Press', exact: true }), 'B'], [page.getByRole('button', { name: 'More options for Machine Press', exact: true }), 'C']]);
  await clearMarks(page);
  await page.getByRole('button', { name: 'Complete set 1 for Machine Press', exact: true }).click();
  await shot(page, 'workout-finish-rest', page.getByTestId('workout-controls'), [[page.getByRole('button', { name: 'Finish workout', exact: true }), 'A'], [page.getByTestId('rest-timer'), 'B']]);
  const marker = row.getByRole('button', { name: /^Set 2 type:/ });
  await marker.click();
  await expect(marker).toHaveAttribute('aria-label', /type: warmup/);
  await shot(page, 'set-warmup', row, [[marker, 'A']]);
  await clearMarks(page); await marker.click();
  await expect(marker).toHaveAttribute('aria-label', /type: deload/);
  await shot(page, 'set-deload', row, [[marker, 'A']]);
  await clearMarks(page); await marker.click();
  await marker.hover(); await page.mouse.down(); await page.waitForTimeout(850); await page.mouse.up();
  await expect(row.getByRole('button', { name: 'Delete set 2 for Machine Press', exact: true })).toBeVisible();
  await shot(page, 'set-delete', row, [[marker, 'A'], [row.getByRole('button', { name: 'Delete set 2 for Machine Press', exact: true }), 'B']]);
  await page.context().close();

  // Builder and active block use actual UI, with no AI generation.
  page = await fresh(); await page.getByRole('button', { name: 'Manage routines', exact: true }).click(); await page.getByRole('button', { name: 'Create training block', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Create training block', exact: true });
  await builder.getByLabel('Block name', { exact: true }).fill('Build strength'); await builder.getByRole('combobox', { name: 'Primary goal', exact: true }).selectOption('strength');
  await builder.getByLabel('Training days per week', { exact: true }).fill('3'); await builder.getByLabel('Different workouts per round', { exact: true }).fill('4'); await builder.getByLabel('Number of rounds', { exact: true }).fill('2'); await builder.getByLabel('Minutes per workout', { exact: true }).fill('45');
  await shot(page, 'block-structure', builder.getByLabel('Training days per week', { exact: true }).locator('../..'), [[builder.getByLabel('Training days per week', { exact: true }), 'A'], [builder.getByLabel('Different workouts per round', { exact: true }), 'B'], [builder.getByLabel('Number of rounds', { exact: true }), 'C']]);
  await page.context().close();
  page = await fresh({}, { block: true }); await page.getByRole('button', { name: 'View block', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'Training block', exact: true });
  const session = manager.getByRole('article', { name: 'Round 1 of 2 · Workout A', exact: true });
  await session.getByText('Session details and options', { exact: true }).click();
  await shot(page, 'block-session', session, [[session.getByRole('button', { name: 'Start session', exact: true }), 'A'], [session.getByRole('button', { name: 'Schedule', exact: true }), 'B'], [session.getByRole('button', { name: 'Skip session', exact: true }), 'C']]);
  await page.context().close();

  // Populated week: missed Monday, rest Tuesday, scheduled today and completed today.
  page = await fresh({ ironflow_schedule: { appointments: [{ id: 'missed', date: '2026-10-26', kind: 'workout', templateId: 'help-0' }, { id: 'rest', date: '2026-10-27', kind: 'rest' }, { id: 'planned', date: '2026-10-28', kind: 'workout', templateId: 'help-1' }], exceptions: {}, completions: [{ sessionId: 'done', date: '2026-10-28', name: 'Workout A' }] } });
  const calendar = page.getByRole('region', { name: 'Training calendar', exact: true });
  await shot(page, 'calendar-week', calendar, [[calendar.getByLabel('Select day', { exact: true }), 'A'], [calendar.getByTestId('calendar-2026-10-28'), 'B']]);
  await page.context().close();

  // Repeat an entry, then select a real grouped saved meal.
  page = await fresh({ ironflow_fuel: foods }); await page.getByRole('button', { name: 'Food', exact: true }).click();
  const repeat = page.getByRole('button', { name: 'Repeat Breakfast oats', exact: true });
  await shot(page, 'meal-repeat-action', repeat.locator('xpath=ancestor::article'), [[repeat, 'A']]);
  await clearMarks(page); await repeat.click();
  const logMeal = page.getByRole('dialog', { name: 'Log meal', exact: true });
  await logMeal.getByText('Adjust amount for Breakfast oats', { exact: true }).click();
  await shot(page, 'meal-repeat-review', logMeal, [[logMeal.getByLabel('Date', { exact: true }), 'A'], [logMeal.getByRole('group', { name: 'Amount shortcuts for Breakfast oats', exact: true }), 'B'], [logMeal.getByRole('button', { name: 'Add to food log', exact: true }), 'C']]);
  await page.context().close();
  page = await fresh({ ironflow_fuel: foods }); await page.getByRole('button', { name: 'Food', exact: true }).click();
  await page.getByRole('button', { name: 'Create saved meal', exact: true }).click();
  const saveMeal = page.getByRole('dialog', { name: 'Save meal', exact: true });
  await saveMeal.getByLabel('Meal name', { exact: true }).fill('Usual breakfast');
  await saveMeal.getByRole('checkbox', { name: /Breakfast oats/ }).check(); await saveMeal.getByRole('checkbox', { name: /Coffee/ }).check();
  await shot(page, 'meal-save-group', saveMeal, [[saveMeal.getByLabel('Meal name', { exact: true }), 'A'], [saveMeal.getByRole('checkbox', { name: /Coffee/ }).locator('..'), 'B'], [saveMeal.getByRole('button', { name: 'Save meal', exact: true }), 'C']]);
  await page.context().close();

  // Fictional barcode product; never contacts the live product database.
  page = await fresh(); await page.getByRole('button', { name: 'Food', exact: true }).click();
  await page.route('https://world.openfoodfacts.org/api/v2/product/**', route => route.fulfill({ json: { status: 1, product: { product_name: 'Example oat drink', serving_size: '250ml', nutriments: { 'energy-kcal_100g': 40, proteins_100g: 1, carbohydrates_100g: 6, fat_100g: 1.3 } } } }));
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  const scanner = page.getByRole('dialog', { name: 'Scan barcode', exact: true });
  await scanner.getByRole('button', { name: 'Enter code manually', exact: true }).click(); await scanner.getByLabel('Barcode numbers', { exact: true }).fill('0930000000001'); await scanner.getByRole('button', { name: 'Look up barcode', exact: true }).click();
  const product = page.getByRole('dialog', { name: 'Review product details', exact: true });
  await product.getByRole('combobox', { name: /Values on the label/ }).selectOption('100ml');
  await shot(page, 'barcode-basis', product, [[product.getByRole('combobox', { name: /Values on the label/ }), 'A'], [product.getByRole('button', { name: 'Continue to amount', exact: true }), 'B']]);
  await clearMarks(page); await product.getByRole('button', { name: 'Continue to amount', exact: true }).click();
  const amount = page.getByRole('dialog', { name: 'Log food', exact: true }); await amount.getByLabel('Amount (ml)', { exact: true }).fill('250');
  await shot(page, 'barcode-amount', amount, [[amount.getByLabel('Amount (ml)', { exact: true }), 'A'], [amount.getByRole('status'), 'B'], [amount.getByRole('button', { name: 'Add to food log', exact: true }), 'C']]);
  await page.context().close();

  // Equipment setup, then the actual plate calculator for its configured machine.
  page = await fresh(); await menu(page, 'Library'); await page.getByPlaceholder('Search exercises...').fill('Machine Press'); await page.getByRole('button', { name: /Machine Press Chest/ }).click(); await page.getByRole('button', { name: 'Edit equipment', exact: true }).click();
  const equipment = page.getByRole('dialog', { name: 'Equipment settings', exact: true });
  await shot(page, 'equipment-settings', equipment, [[page.getByLabel('Starting weight (kg)', { exact: true }), 'A'], [page.getByLabel('Smallest plate or stack increment (kg)', { exact: true }), 'B'], [page.getByRole('combobox', { name: 'How is weight added?', exact: true }), 'C']]);
  await page.context().close();
  page = await fresh({ ironflow_active_session: draft }); await page.getByRole('button', { name: 'Resume workout', exact: true }).click(); await page.getByTestId('set-help-set-1').getByRole('button', { name: 'Edit kg', exact: true }).click();
  const weight = page.getByRole('dialog', { name: 'Adjust weight', exact: true }); await weight.locator('summary').click();
  await weight.getByRole('button', { name: 'View plate loading details', exact: true }).click();
  const plates = page.getByRole('dialog', { name: 'Plate loading', exact: true });
  await shot(page, 'equipment-plates', plates, [[plates.getByText('30.06 kg total', { exact: true }), 'A'], [plates.getByText('5', { exact: true }).locator('..'), 'B'], [plates.getByText(/^Starting weight:/), 'C']]);
  await page.context().close();

  // Mocked Drive connection, followed by a real local restore to show the persisted pause.
  page = await fresh({}, { drive: true, settings: { ironSyncConnected: true, lastCloudSync: now.getTime(), instanceName: 'Example phone' } });
  await menu(page, 'Settings');
  const backupSection = page.getByRole('button', { name: 'Backup Now', exact: true }).locator('xpath=ancestor::section');
  await shot(page, 'drive-connected', backupSection, [[backupSection.getByText('Vault Active', { exact: true }), 'A'], [backupSection.getByPlaceholder('e.g. iPhone, Desktop...'), 'B'], [backupSection.getByRole('button', { name: 'Backup Now', exact: true }), 'C']]);
  await page.context().close();
  page = await fresh({}, { drive: true, settings: { ironSyncConnected: true } }); await menu(page, 'Vault Backup');
  const vault = page.getByRole('dialog', { name: 'Backup and restore', exact: true });
  await vault.getByLabel('Choose JSON backup', { exact: true }).setInputFiles({ name: 'example-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ironflow_history: [], ironflow_fuel: foods })) });
  await vault.getByRole('button', { name: 'Restore this backup', exact: true }).click(); await vault.getByRole('button', { name: 'Continue to IronFlow', exact: true }).click();
  await page.getByRole('button', { name: /Skip for now/ }).click(); await menu(page, 'Vault Backup');
  await shot(page, 'drive-paused', vault, [[vault.getByRole('heading', { name: 'Drive backups paused after restore', exact: true }), 'A'], [vault.getByRole('button', { name: 'Back up restored data', exact: true }), 'B']]);
  await page.context().close();
} finally { await browser.close(); }

// Reserve image space in Help before lazy-loaded images arrive.
await writeFile('components/help/workflowImageSizes.json', JSON.stringify(dimensions, null, 2) + '\n');
