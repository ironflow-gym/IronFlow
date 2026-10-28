// Run against `npm run dev -- --host 127.0.0.1 --port 5174`.
// Uses fictional records in an isolated browser; never connects Drive or AI.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('public/help', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 1100 }, deviceScaleFactor: 1, timezoneId: 'Australia/Brisbane', serviceWorkers: 'block' });
  await page.clock.setFixedTime(new Date('2026-10-28T02:00:00Z'));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  const routine = { id: 'help-routine', name: 'Starter strength', exercises: [{ name: 'Machine Press', category: 'Chest', suggestedSets: 3, suggestedWeight: 30.06, suggestedReps: 8, targetReps: '8-12', warmupCount: 0, rationale: '', restSeconds: 90 }] };
  const data = { ironflow_templates: [routine], ironflow_settings: { units: 'metric', weeklyWorkoutGoal: 3 }, ironflow_library: [{ name: 'Machine Press', category: 'Chest', muscles: ['Pectorals'], instructions: [], benefits: '', risks: '', barWeight: 22.56, weightIncrement: 2.5, loadingMode: 'single' }], ironflow_history: [0, 1, 2].map(index => ({ date: '2026-10-26', exercise: 'Machine Press', category: 'Chest', weight: 30.06, reps: 12, unit: 'kgs', sessionId: 'help-session', templateId: routine.id, templateName: routine.name, exerciseInstanceId: 'press', workingSetIndex: index, prescribedWorkingSets: 3, prescribedRepRange: '8-12', completedAt: index + 1 })) };
  await page.goto('http://127.0.0.1:5174');
  await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.evaluate(async data => { const { storage } = await import('/services/storageService.ts'); await storage.overwriteEverything(data); }, data);
  await page.reload(); await page.getByRole('button', { name: /Skip for now/ }).click();
  const mark = async (locator, letter) => locator.evaluate((element, letter) => {
    element.style.position = 'relative'; element.style.outline = '2px solid #34d399'; element.style.outlineOffset = '2px';
    const marker = document.createElement('span'); marker.textContent = letter; marker.setAttribute('aria-hidden', 'true'); marker.dataset.helpMarker = 'true';
    marker.style.cssText = 'position:absolute;top:-12px;left:-9px;background:#a7f3d0;color:#052e16;border:2px solid #020617;border-radius:50%;width:23px;height:23px;display:flex;align-items:center;justify-content:center;font:bold 13px Arial;z-index:5';
    element.append(marker);
  }, letter);
  await mark(page.getByRole('button', { name: 'Manage routines', exact: true }), 'A');
  await mark(page.getByRole('button', { name: 'Preview workout', exact: true }), 'B');
  const header = await page.getByTestId('today-screen').locator('header').boundingBox();
  const card = await page.getByRole('region', { name: 'Next workout', exact: true }).boundingBox();
  await page.screenshot({ path: 'public/help/first-workout.png', clip: { x: header.x - 4, y: header.y - 12, width: header.width + 8, height: card.y + card.height - header.y + 24 } });
  await page.getByRole('button', { name: 'Preview workout', exact: true }).click();
  const choices = page.getByTestId('progression-Machine Press'); await choices.locator('summary').click();
  await mark(choices.locator('summary'), 'A'); await choices.locator('summary [data-help-marker]').evaluate(element => { element.style.top = '-6px'; }); await mark(choices.getByRole('button', { name: 'Use suggestion', exact: true }), 'B');
  const box = await choices.boundingBox();
  await page.screenshot({ path: 'public/help/choose-weight.png', clip: { x: box.x - 12, y: box.y - 8, width: box.width + 24, height: box.height + 16 } });
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click(); await page.getByRole('button', { name: 'Vault Backup', exact: true }).click();
  await page.getByLabel('Choose JSON backup', { exact: true }).setInputFiles({ name: 'example-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ironflow_history: data.ironflow_history, ironflow_templates: [routine] })) });
  const review = page.getByRole('dialog', { name: 'Backup and restore', exact: true });
  const warning = review.getByText('Restoring replaces the data on this device with this backup. Missing categories will be cleared. Device settings and the Google Drive connection stay unchanged.', { exact: true });
  await warning.waitFor(); await mark(warning, 'A');
  const row = review.getByRole('row', { name: 'Food entries 0 Missing', exact: true }); await mark(row.getByRole('cell').last(), 'B');
  const top = await review.boundingBox(); const bottom = await row.boundingBox();
  await page.screenshot({ path: 'public/help/restore-backup.png', clip: { x: top.x, y: top.y, width: top.width, height: bottom.y + bottom.height - top.y + 12 } });
} finally { await browser.close(); }
