import { test, expect, type Page } from '@playwright/test';
test.use({ timezoneId: 'Australia/Brisbane' });
async function openFood(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.getByRole('button', { name: 'Food', exact: true }).click();
}
async function records(page: Page) {
  return page.evaluate(async () => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    return storage.get('ironflow_fuel') as Promise<any[] | null>;
  });
}
test('manual food logging validates totals offline and historical corrections and deletion are explicit', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await openFood(page);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Log food manually', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Log food manually', exact: true });
  await editor.getByLabel('Food name', { exact: true }).fill('Manual oats');
  await editor.getByLabel('Date', { exact: true }).fill('2026-01-01');
  await editor.getByLabel('Calories (kcal)', { exact: true }).fill('-10');
  for (const label of ['Protein (g)', 'Carbs (g)', 'Fats (g)']) await editor.getByLabel(label, { exact: true }).fill('0');
  await editor.getByRole('button', { name: 'Add to food log', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('calories must be a number');
  await expect(editor.getByLabel('Calories (kcal)', { exact: true })).toBeFocused();
  await expect(editor.getByLabel('Calories (kcal)', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await editor.getByLabel('Calories (kcal)', { exact: true }).fill('120');
  await editor.getByRole('button', { name: 'Add to food log', exact: true }).click();
  await expect.poll(async () => (await records(page))?.length).toBe(1);
  await page.getByRole('button', { name: /Thu, Jan 1/ }).click();
  await page.getByRole('button', { name: 'Edit Manual oats', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit food entry', exact: true });
  await edit.getByLabel('Date', { exact: true }).fill('2026-01-02');
  await edit.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(async () => (await records(page))?.[0]?.date).toBe('2026-01-02');
  await page.getByRole('button', { name: /Fri, Jan 2/ }).click();
  await page.getByRole('button', { name: 'Delete Manual oats', exact: true }).click();
  const deletion = page.getByRole('dialog', { name: 'Delete food entry', exact: true });
  await deletion.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await records(page))?.length).toBe(1);
  await page.getByRole('button', { name: 'Delete Manual oats', exact: true }).click();
  await deletion.getByRole('button', { name: 'Delete entry', exact: true }).click();
  await expect.poll(async () => await records(page)).toEqual([]);
  await context.setOffline(false);
});

const legacy = { id: 'oats', name: 'Per-serving oats', servingSize: '30g', calories: 120, protein: 3, carbs: 20, fats: 3, barcode: '9300000000001' };
async function seed(page: Page, data: Record<string, unknown>, ai = false) {
  await page.goto('/'); await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.evaluate(async ({ data, ai }) => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    await storage.overwriteEverything(data);
    if (ai) localStorage.setItem('ironflow_gemini_key', 'mock-key-for-browser-test');
  }, { data, ai });
  await page.reload();
  if (!ai) await page.getByRole('button', { name: /Skip for now/ }).click();
  await page.getByRole('button', { name: 'Food', exact: true }).click();
}
async function record(page: Page, key: string) {
  return page.evaluate(async key => {
    const { storage } = await import(/* @vite-ignore */ String('/services/storageService.ts'));
    return storage.get(key);
  }, key);
}
async function enterBarcode(page: Page, code: string) {
  await page.getByRole('button', { name: 'Scan barcode', exact: true }).click();
  const scanner = page.getByRole('dialog', { name: 'Scan barcode', exact: true });
  await scanner.getByRole('button', { name: 'Enter code manually', exact: true }).click();
  await scanner.getByLabel('Barcode numbers', { exact: true }).fill(code);
  await scanner.getByRole('button', { name: 'Look up barcode', exact: true }).click();
}

test('legacy basis confirmation fixes serving scaling, updates barcode matching immediately and leaves history unchanged', async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const original = { id: 'old', date: '2026-01-01', name: 'Historical oats', calories: 36, protein: 0.9, carbs: 6, fats: 0.9, confidence: 1, pantryItemId: 'oats' };
  await seed(page, { ironflow_pantry: [legacy], ironflow_fuel: [original] });
  await page.getByRole('button', { name: 'Food pantry', exact: true }).click();
  const pantry = page.getByRole('dialog', { name: 'Food pantry', exact: true });
  await pantry.getByRole('button', { name: 'Log Per-serving oats', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit pantry food', exact: true });
  await expect(editor.getByLabel('Values on the label')).toHaveValue('');
  await editor.getByRole('button', { name: 'Save pantry food', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Choose what the values');
  await editor.getByLabel('Values on the label').selectOption('serving');
  await editor.getByRole('button', { name: 'Save pantry food', exact: true }).click();
  let quantity = page.getByRole('dialog', { name: 'Log food', exact: true });
  await expect(quantity.getByRole('status')).toContainText('120 kcal');
  const action = (await quantity.getByRole('button', { name: 'Add to food log' }).boundingBox())!;
  expect(action.y + action.height).toBeLessThanOrEqual(640);
  await quantity.getByRole('button', { name: 'Add to food log' }).click();
  await expect.poll(async () => (await records(page))?.length).toBe(2);
  expect((await records(page))?.find(entry => entry.id === 'old')).toEqual(original);
  await pantry.getByRole('button', { name: 'Close food pantry' }).click();
  await context.setOffline(true);
  await enterBarcode(page, legacy.barcode);
  await expect(page.getByRole('dialog', { name: 'Edit pantry food' })).toHaveCount(0);
  quantity = page.getByRole('dialog', { name: 'Log food', exact: true });
  await quantity.getByLabel('Amount (servings)', { exact: true }).fill('2');
  await expect(quantity.getByRole('status')).toContainText('240 kcal');
  await quantity.getByRole('button', { name: 'Add to food log' }).click();
  await expect.poll(async () => (await records(page))?.length).toBe(3);
  expect(((await record(page, 'ironflow_pantry')) as any[])[0].nutritionBasis).toBe('serving');
  await context.setOffline(false);
});

test('barcode unknown nutrients stay blank and must be completed, with an explicit per-100ml basis', async ({ page }) => {
  await openFood(page);
  let calls = 0;
  await page.route('https://world.openfoodfacts.org/api/v2/product/**', route => { calls++; return route.fulfill({ json: { status: 1, product: { product_name: 'Test milk', serving_size: '250ml', nutriments: { 'energy-kcal_100g': 40, proteins_100g: 0, fat_100g: 1 } } } }); });
  await enterBarcode(page, '0930000000001');
  const editor = page.getByRole('dialog', { name: 'Review product details', exact: true });
  await editor.getByLabel('Values on the label').selectOption('100ml');
  await expect(editor.getByLabel('Protein (g)', { exact: true })).toHaveValue('0');
  await expect(editor.getByLabel('Carbs (g)', { exact: true })).toHaveValue('');
  await editor.getByRole('button', { name: 'Continue to amount' }).click();
  await expect(editor.getByRole('alert')).toContainText('Enter carbs');
  await editor.getByLabel('Carbs (g)', { exact: true }).fill('9');
  await editor.getByRole('button', { name: 'Continue to amount' }).click();
  const quantity = page.getByRole('dialog', { name: 'Log food', exact: true });
  await quantity.getByLabel('Amount (ml)', { exact: true }).fill('250');
  await expect(quantity.getByRole('status')).toContainText('100 kcal');
  await quantity.getByLabel('Also save this food to pantry').check();
  await quantity.getByRole('button', { name: 'Add to food log' }).click();
  await expect.poll(async () => (await records(page))?.length).toBe(1);
  expect((await records(page))?.[0]).toMatchObject({ calories: 100, protein: 0, carbs: 22.5, servingDescription: '250 ml' });
  await enterBarcode(page, '0930000000001');
  await expect(page.getByRole('dialog', { name: 'Log food' })).toBeVisible();
  expect(calls).toBe(1);
});

async function mockAI(page: Page, data: unknown) {
  await page.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(data) }] }, finishReason: 'STOP' }] } }));
}
test('AI pantry matching retains the complete batch, stages all entries, and profile updates require opt-in', async ({ page }) => {
  const profile = { goal: 'Maintenance', preferences: [], targetProteinRatio: 1.2 };
  await seed(page, { ironflow_pantry: [legacy], ironflow_fuel_profile: profile }, true);
  const result = { logs: [
    { name: 'Oats estimate', calories: 999, protein: 20, carbs: 80, fats: 20, confidence: 0.5 },
    { name: 'Coffee', calories: 80, protein: 4, carbs: 6, fats: 4, confidence: 0.8 },
    { name: 'Banana', calories: 100, protein: 1, carbs: 23, fats: 0, confidence: 0.8 },
  ], updatedProfile: { goal: 'Lose Fat', targetProteinRatio: 1.8 } };
  await mockAI(page, result);
  await page.getByRole('textbox', { name: 'Describe food (AI)', exact: true }).fill('Oats, coffee and a banana; I want to lose fat');
  await page.getByRole('button', { name: 'Review food entries', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review food entries', exact: true });
  await expect(review.getByRole('article')).toHaveCount(3);
  expect(await records(page)).toBeNull();
  await review.getByText('Edit food for Oats estimate', { exact: true }).click();
  await review.getByRole('group', { name: 'Suggested pantry matches for Oats estimate' }).getByRole('button', { name: /Per-serving oats/ }).click();
  await review.getByRole('button', { name: 'Check food details' }).click();
  const definition = page.getByRole('dialog', { name: 'Edit pantry food', exact: true });
  await definition.getByLabel('Values on the label').selectOption('serving');
  await definition.getByRole('button', { name: 'Save pantry food' }).click();
  await expect(review.getByRole('button', { name: 'Choose pantry food for Oats estimate', exact: true })).toBeFocused();
  await expect(review.getByRole('article')).toHaveCount(3);
  await review.getByLabel('Amount for Oats estimate (servings)', { exact: true }).fill('2');
  await review.getByRole('button', { name: 'Add 3 foods', exact: true }).click();
  await expect.poll(async () => (await records(page))?.length).toBe(3);
  expect((await records(page))?.map(log => log.calories)).toEqual([240, 80, 100]);
  expect(await record(page, 'ironflow_fuel_profile')).toEqual(profile);
  await page.getByRole('textbox', { name: 'Describe food (AI)', exact: true }).fill('Oats, coffee and a banana; I want to lose fat');
  await page.getByRole('button', { name: 'Review food entries', exact: true }).click();
  await review.getByLabel('Apply these profile changes', { exact: true }).check();
  await review.getByRole('button', { name: 'Add 3 foods', exact: true }).click();
  await expect.poll(async () => ((await record(page, 'ironflow_fuel_profile')) as any)?.goal).toBe('Lose Fat');
});

test('Food and Stats show the same targets and logged-day coverage excludes future records', async ({ page }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await seed(page, { ironflow_fuel: [
    { id: 'today', date: today, name: 'Today food', calories: 100, protein: 1, carbs: 2, fats: 3, confidence: 1 },
    { id: 'future', date: '2099-01-01', name: 'Future food', calories: 9999, protein: 99, carbs: 99, fats: 99, confidence: 1 },
  ] });
  await page.getByText('Today’s totals and targets', { exact: true }).click();
  const calories = await page.getByText('Calories', { exact: true }).locator('..').locator('dd').textContent();
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await page.getByRole('button', { name: 'Nutrition', exact: true }).click();
  const review = page.getByRole('region', { name: 'Nutrition review', exact: true });
  await expect(review).toContainText('Average across 1 logged day');
  await expect(review).toContainText(`goal ${calories?.replace(' kcal', '')}kcal`);
});

test('manual pantry creation logs per-100g amounts, supports keyboard cancellation, and survives save retry', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); await openFood(page);
  await page.getByRole('button', { name: 'Food pantry', exact: true }).click();
  const pantry = page.getByRole('dialog', { name: 'Food pantry', exact: true });
  const addButton = pantry.getByRole('button', { name: 'Add pantry food' });
  await addButton.click();
  const editor = page.getByRole('dialog', { name: 'Add pantry food', exact: true });
  await page.keyboard.press('Escape'); await expect(addButton).toBeFocused();
  await addButton.click();
  await editor.getByLabel('Food name', { exact: true }).fill('Manual rice');
  await editor.getByLabel('Values on the label').selectOption('100g');
  for (const [label, value] of [['Calories (kcal)', '400'], ['Protein (g)', '10'], ['Carbs (g)', '80'], ['Fats (g)', '2']]) await editor.getByLabel(label, { exact: true }).fill(value);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    (window as any).__restorePut = () => { IDBObjectStore.prototype.put = put; };
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) { if (args[0].id === 'ironflow_pantry') throw new DOMException('Storage full', 'QuotaExceededError'); return put.apply(this, args); };
  });
  await editor.getByRole('button', { name: 'Save pantry food' }).click();
  await expect(pantry.getByText('Not saved — keep this tab open', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).__restorePut());
  await pantry.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(pantry.getByText('Not saved — keep this tab open', { exact: true })).toHaveCount(0);
  await pantry.getByRole('button', { name: 'Close food pantry' }).click();
  await expect.poll(async () => ((await record(page, 'ironflow_pantry')) as any[])?.[0]?.name).toBe('Manual rice');
  await page.getByRole('button', { name: 'Food pantry', exact: true }).click();
  await pantry.getByRole('button', { name: 'Log Manual rice', exact: true }).click();
  const quantity = page.getByRole('dialog', { name: 'Log food', exact: true });
  await quantity.getByLabel('Amount (g)', { exact: true }).fill('30');
  await expect(quantity.getByRole('status')).toContainText('120 kcal');
  await quantity.getByRole('button', { name: 'Add to food log' }).click();
  await expect.poll(async () => (await records(page))?.[0]?.calories).toBe(120);
});

test('AI confirmation preserves manual food logged while the request was in flight', async ({ page }) => {
  await seed(page, {}, true);
  let release: (() => void) | undefined;
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ logs: [{ name: 'AI banana', calories: 100, protein: 1, carbs: 23, fats: 0, confidence: 0.5 }] }) }] }, finishReason: 'STOP' }] } });
  });
  await page.getByRole('textbox', { name: 'Describe food (AI)', exact: true }).fill('A banana');
  await page.getByRole('button', { name: 'Review food entries', exact: true }).click();
  await expect.poll(() => !!release).toBe(true);
  await page.getByRole('button', { name: 'Log food manually', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Log food manually', exact: true });
  await editor.getByLabel('Food name', { exact: true }).fill('Manual apple');
  for (const [label, value] of [['Calories (kcal)', '80'], ['Protein (g)', '0'], ['Carbs (g)', '20'], ['Fats (g)', '0']]) await editor.getByLabel(label, { exact: true }).fill(value);
  await editor.getByRole('button', { name: 'Add to food log', exact: true }).click();
  await expect.poll(async () => (await records(page))?.length).toBe(1);
  release!();
  const review = page.getByRole('dialog', { name: 'Review food entries', exact: true });
  await review.getByRole('button', { name: 'Add 1 food' }).click();
  await expect.poll(async () => (await records(page))?.length).toBe(2);
  expect((await records(page))?.map(log => log.name)).toEqual(['Manual apple', 'AI banana']);
});

test('compact AI summaries keep total and Add visible, with searchable pantry selection and field-specific errors', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page, { ironflow_pantry: [{ ...legacy, nutritionBasis: 'serving' }, { ...legacy, id: 'milk', name: 'Milk', nutritionBasis: '100ml' }] }, true);
  await mockAI(page, { logs: [
    { name: 'Oats estimate', calories: 300, protein: 10, carbs: 50, fats: 5, confidence: 0.5 },
    { name: 'Coffee', calories: 80, protein: 4, carbs: 6, fats: 4, confidence: 0.8 },
    { name: 'Banana', calories: 100, protein: 1, carbs: 23, fats: 0, confidence: 0.5 },
  ] });
  await page.getByRole('textbox', { name: 'Describe food (AI)', exact: true }).fill('Breakfast');
  await page.getByRole('button', { name: 'Review food entries', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review food entries', exact: true });
  await expect(review.getByRole('spinbutton')).toHaveCount(0);
  await expect(review.getByRole('status')).toContainText('Total: 480 kcal');
  const action = (await review.getByRole('button', { name: 'Add 3 foods' }).boundingBox())!;
  expect(action.y + action.height).toBeLessThanOrEqual(640);
  await review.getByText('Edit food for Oats estimate', { exact: true }).click();
  await review.getByRole('button', { name: 'Choose pantry food for Oats estimate', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Choose pantry food', exact: true });
  await chooser.getByLabel('Search pantry', { exact: true }).fill('Milk');
  await chooser.getByRole('button', { name: 'Milk per 100ml', exact: true }).click();
  await expect(review).toContainText('Pantry · per 100ml');
  await review.getByText('Edit food for Banana', { exact: true }).click();
  const banana = review.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Banana', exact: true }) });
  await banana.getByLabel('Protein (g)', { exact: true }).fill('-1');
  await review.getByRole('button', { name: 'Add 3 foods' }).click();
  await expect(review.getByRole('alert')).toContainText('protein for Banana');
  await expect(banana.getByLabel('Protein (g)', { exact: true })).toBeFocused();
  await expect(banana.getByLabel('Protein (g)', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  expect(await records(page)).toBeNull();
});

test('changed food forms and unconfirmed AI reviews ask before discarding and Keep editing preserves values', async ({ page }) => {
  await openFood(page);
  await page.getByRole('button', { name: 'Log food manually', exact: true }).click();
  let editor = page.getByRole('dialog', { name: 'Log food manually', exact: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Discard food changes' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Log food manually', exact: true }).click();
  editor = page.getByRole('dialog', { name: 'Log food manually', exact: true });
  await editor.getByLabel('Food name', { exact: true }).fill('Keep these oats');
  await page.keyboard.press('Escape');
  let discard = page.getByRole('dialog', { name: 'Discard food changes', exact: true });
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).last().click();
  await expect(editor.getByLabel('Food name', { exact: true })).toHaveValue('Keep these oats');
  await editor.getByRole('button', { name: 'Cancel food entry' }).click();
  await discard.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Log food manually', exact: true })).toBeFocused();
  expect(await records(page)).toBeNull();
  await page.evaluate(() => localStorage.setItem('ironflow_gemini_key', 'mock-key-for-browser-test'));
  await page.reload(); await page.getByRole('button', { name: 'Food', exact: true }).click();
  await mockAI(page, { logs: [{ name: 'AI oats', calories: 120, protein: 3, carbs: 20, fats: 3, confidence: 0.5 }] });
  await page.getByRole('textbox', { name: 'Describe food (AI)', exact: true }).fill('Oats');
  await page.getByRole('button', { name: 'Review food entries', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review food entries', exact: true });
  await expect(review).toBeVisible(); await page.keyboard.press('Escape');
  discard = page.getByRole('dialog', { name: 'Discard food changes', exact: true });
  await page.keyboard.press('Escape'); await expect(discard).toHaveCount(0);
  await expect(review).toBeVisible(); await page.keyboard.press('Escape');
  await discard.getByRole('button', { name: 'Discard changes' }).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Describe food (AI)', exact: true })).toHaveValue('Oats');
  expect(await records(page)).toBeNull();
});

test('calorie adjustment previews the proposed kcal target without applying it until confirmed', async ({ page }) => {
  await openFood(page);
  await page.getByText('Today’s totals and targets', { exact: true }).click();
  const oldTarget = await page.getByText('Calories', { exact: true }).locator('..').locator('dd').textContent();
  await page.getByLabel('Calorie adjustment', { exact: true }).fill('1.1');
  await expect(page.getByText(/Current target: .*→ proposed:/)).toContainText('(110%)');
  await expect(page.getByText('Calories', { exact: true }).locator('..').locator('dd')).toHaveText(oldTarget!);
  await page.getByRole('button', { name: 'Apply target adjustment' }).click();
  await expect.poll(async () => ((await record(page, 'ironflow_fuel_profile')) as any)?.targetMultiplier).toBe(1.1);
  await expect(page.getByText('Calories', { exact: true }).locator('..').locator('dd')).not.toHaveText(oldTarget!);
});
