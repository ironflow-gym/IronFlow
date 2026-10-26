import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logFood, scaleFood, loggedDayAverage } from '../src/food';
import { FoodItem, UserSettings } from '../types';
import { nutritionTargets } from '../src/nutritionTargets';
const food: FoodItem = { id: 'oats', name: 'Oats', servingSize: '30g', calories: 120, protein: 3, carbs: 20, fats: 3, nutritionBasis: 'serving' };
test('per-serving food logs 120 kcal for one 30g serving; grams and ml use their explicit basis', () => {
  assert.equal(logFood(food, 1, '2026-10-26', 'log').calories, 120);
  assert.equal(scaleFood(food, 0.5).calories, 60);
  assert.equal(scaleFood({ ...food, calories: 400, nutritionBasis: '100g' }, 30).calories, 120);
  assert.equal(logFood({ ...food, nutritionBasis: '100ml' }, 250, '2026-10-26', 'log').servingDescription, '250 ml');
});
test('unknown basis and missing nutrients cannot silently enter a food log', () => {
  assert.throws(() => scaleFood({ ...food, nutritionBasis: undefined }, 1));
  assert.throws(() => scaleFood({ ...food, missingNutrients: ['protein'] }, 1));
  for (const quantity of [0, -1, NaN, Infinity]) assert.throws(() => scaleFood(food, quantity));
  assert.throws(() => logFood(food, 1, '2026-02-30', 'id'));
  assert.throws(() => scaleFood({ ...food, calories: -1 }, 1));
});
test('calendar average uses seven local dates ending today and reports logged-day coverage', () => {
  const log = logFood(food, 1, '2026-10-26', 'id');
  const result = loggedDayAverage([log, { ...log, date: '2026-10-20' }, { ...log, date: '2026-10-19' }, { ...log, date: '2026-10-27' }], '2026-10-26');
  assert.equal(result.days, 2); assert.equal(result.from, '2026-10-20'); assert.equal(result.totals.calories, 120);
});
test('shared targets preserve current Food values and account for units and user multiplier', () => {
  const profile = { goal: 'Maintenance' as const, preferences: [], targetProteinRatio: 1.2 };
  const settings = { gender: 'male', dateOfBirth: '1996-10-26' } as UserSettings;
  const now = new Date('2026-10-26T12:00:00');
  const result = nutritionTargets(profile, [{ date: '2026-10-26', weight: 75, height: 175, unit: 'kgs' }], settings, now);
  assert.equal(result.calories, 2335.8); assert.equal(result.protein, 90);
  const imperial = nutritionTargets(profile, [{ date: '2026-10-26', weight: 75 / 0.453592, height: 175, unit: 'lbs' }], settings, now);
  assert.equal(imperial.calories, result.calories);
  const adjusted = nutritionTargets({ ...profile, targetMultiplier: 1.1 }, [{ date: '2026-10-26', weight: 75, height: 175, unit: 'kgs' }], settings, now);
  assert.equal(adjusted.protein, result.protein); assert.equal(adjusted.calories, 2569.4);
});

test('barcode lookup distinguishes absent nutrition from actual zero and leaves basis unconfirmed', async () => {
  const { lookupBarcode } = await import('../services/openFoodFactsService');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 1, product: { product_name: 'Test product', serving_size: '30g', nutriments: { 'energy-kcal_100g': 0, proteins_100g: 0, fat_100g: 2 } } }), { status: 200 });
  try {
    const result = await lookupBarcode('9300000000001');
    assert.equal(result.found, true);
    if (result.found) {
      assert.deepEqual(result.item.missingNutrients, ['carbs']);
      assert.equal(result.item.calories, 0); assert.equal(result.item.protein, 0);
      assert.equal(result.item.nutritionBasis, undefined);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('label extraction preserves absent nutrients for manual completion and validates explicit basis', async () => {
  const { GeminiService } = await import('../services/geminiService');
  const service = new GeminiService();
  (service as any).callModelWithFallback = async () => ({ text: JSON.stringify({ name: 'Label oats', servingSize: '30g', nutritionBasis: 'serving', calories: 120, protein: 0 }) });
  const result = await service.analyzeNutritionPanel('data:image/jpeg;base64,AA==');
  assert.equal(result.calories, 120); assert.equal(result.protein, 0);
  assert.equal(result.carbs, undefined); assert.equal(result.nutritionBasis, 'serving');
  (service as any).callModelWithFallback = async () => ({ text: JSON.stringify({ name: 'Bad label', servingSize: '30g', nutritionBasis: 'cup' }) });
  await assert.rejects(service.analyzeNutritionPanel('data:image/jpeg;base64,AA=='));
});
