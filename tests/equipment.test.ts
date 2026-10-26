import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equipmentFor, adjustEquipmentWeight, KG_PER_LB } from '../src/equipment';
import { roundToGymWeight, roundWarmupWeight } from '../src/utils';
import { constrainRecommendation, getWeightRecommendation } from '../src/progression';
import { localDate } from '../src/scheduling';
import type { ExerciseLibraryItem, HistoricalLog } from '../types';
const library: ExerciseLibraryItem[] = [{ name: 'Machine Press', category: 'Chest', muscles: ['Pectorals'], instructions: [], benefits: '', risks: '', barWeight: 22.56, weightIncrement: 2.5, loadingMode: 'single' }];
const history = (reps: number, weight = 30.06): HistoricalLog[] => [{ date: localDate(), exercise: 'Machine Press', category: 'Chest', unit: 'kgs', weight, reps, templateName: 'A', sessionId: 'verified-session', exerciseInstanceId: 'exercise', workingSetIndex: 0, prescribedWorkingSets: 1, prescribedRepRange: '8-12' }];
const recommend = (reps: number, weight?: number) => getWeightRecommendation('metric', 'Machine Press', 'Chest', history(reps, weight), 30, '8-12', undefined, 'A', undefined, 2.5, 22.56, 'single');

test('fractional machine base plus single-load plate increments yields feasible totals', () => {
  assert.equal(roundToGymWeight(30, 'kg', [], 2.5, 22.56, false), 30.06);
  assert.equal(roundToGymWeight(30, 'kg', [30], 2.5, 22.56, false), 30.06, 'historic typo cannot bypass equipment');
  assert.equal(roundToGymWeight(10, 'kg', [], 2.5, 22.56, false), 22.56);
  assert.equal(roundWarmupWeight(12, 'kg', 2.5, 22.56, false), 22.56);
});
test('history-based hold and qualified progression all respect the equipment grid', () => {
  assert.equal(recommend(9).weight, 30.06);
  assert.equal(recommend(12).weight, 32.56);
  assert.equal(recommend(6, 30).weight, 30.06);
  assert.match(recommend(12).reason, /22.56 kg starting weight/);
  const fallback = getWeightRecommendation('metric', 'Machine Press', 'Chest', [], 30, '8-12', undefined, 'A', undefined, 2.5, 22.56, 'single');
  assert.equal(fallback.weight, 30.06);
});
test('paired loading doubles the total step, while dumbbells remain per hand', () => {
  assert.equal(roundToGymWeight(30, 'kg', [], 2.5, 22.56, true), 27.56);
  assert.equal(roundToGymWeight(30, 'kg', [], 2.5, undefined, true), 30);
  assert.equal(adjustEquipmentWeight(30.06, 1, 'Machine Press', [{ ...library[0], loadingMode: 'paired' }], 'kgs'), 32.56);
  assert.equal(equipmentFor('Dumbbell Press', [], 'kgs').loadingMode, 'single');
});
test('equipment values remain kg in storage and convert to imperial before calculations', () => {
  const config = equipmentFor('Machine Press', library, 'lbs');
  const rounded = roundToGymWeight(30 / KG_PER_LB, 'lbs', [], config.weightIncrement, config.barWeight, false);
  assert.ok(Math.abs(rounded * KG_PER_LB - 30.06) < 0.00001);
  assert.equal(library[0].barWeight, 22.56);
  assert.equal(equipmentFor('Machine Press', [{ ...library[0], barWeight: 0 }, ...library], 'kgs').barWeight, 22.56, 'custom override wins');
});
test('adjustments snap in the requested direction without decimal drift', () => {
  assert.equal(adjustEquipmentWeight(30, 1, 'Machine Press', library, 'kgs'), 30.06);
  assert.equal(adjustEquipmentWeight(30.06, 1, 'Machine Press', library, 'kgs'), 32.56);
  assert.equal(adjustEquipmentWeight(30.06, -1, 'Machine Press', library, 'kgs'), 27.56);
});
test('progressing an assisted exercise reduces assistance instead of making it easier', () => {
  const logs = history(12, 30).map(h => ({ ...h, exercise: 'Assisted Pull-up', category: 'Back' }));
  const result = getWeightRecommendation('metric', 'Assisted Pull-up', 'Back', logs, 30, '8-12', undefined, 'A', undefined, 2.5, 0, 'single');
  assert.equal(result.weight, 27.5);
  assert.match(result.reason, /Reduce assistance/);
});


test('recommendations restored from an older session are constrained without modifying recorded values', () => {
  const old = { weight: 30, reps: 8, reason: 'Old suggestion', source: 'routine' as const };
  const updated = constrainRecommendation(old, 'Machine Press', 'metric', 2.5, 22.56, 'single');
  assert.equal(updated.weight, 30.06);
  assert.equal(old.weight, 30);
});
