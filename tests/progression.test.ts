import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyProgressionChoice, convertWeight, getWeightRecommendation } from '../src/progression';
import { getProgressionSuggestion } from '../src/utils';
import type { Exercise, HistoricalLog } from '../types';
const date = new Date();
const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const log = (patch: Partial<HistoricalLog> = {}): HistoricalLog => ({ date: local, exercise: 'Squat', category: 'Legs', weight: 60, unit: 'kgs', reps: 12, templateName: 'A', ...patch });

test('extraction preserves existing same-protocol progression numbers across the rep range', () => {
  for (const reps of [5, 8, 9, 11, 12, 15]) {
    const result = getWeightRecommendation('metric', 'Squat', 'Legs', [log({ reps })], 40, '8-12', undefined, 'A');
    const old = getProgressionSuggestion(60, reps, '8-12', 'kg', true, [60]);
    assert.equal(result.weight, old.weight); assert.equal(result.reps, old.reps);
    assert.equal(result.source, 'history'); assert.equal(result.previous?.reps, reps);
  }
});
test('recommendations distinguish exact history, related estimates and routine starting values', () => {
  assert.equal(getWeightRecommendation('metric', 'Squat', 'Legs', [log()], 40, '8-12').source, 'history');
  assert.equal(getWeightRecommendation('metric', 'Leg Press', 'Legs', [log()], 40, '8-12').source, 'related');
  assert.equal(getWeightRecommendation('metric', 'Squat', 'Legs', [], 40, '8-12').source, 'routine');
});
test('mixed-unit history is converted before suggesting weight and displaying previous values', () => {
  const result = getWeightRecommendation('metric', 'Squat', 'Legs', [log({ weight: 60 / 0.45359237, unit: 'lbs' })], 40, '8-12', undefined, 'A');
  assert.equal(result.weight, 62.5); assert.ok(Math.abs(result.previous!.weight - 60) < 0.0001);
  assert.equal(convertWeight(60, 'kgs', 'kg'), 60);
  assert.ok(Math.abs(convertWeight(60, 'kgs', 'lbs') - 132.277357) < 0.001);
});
test('explicit choices only modify unfinished working sets, never completed sets or routine defaults', () => {
  const exercise: Exercise = { id: 'e', name: 'Dumbbell Curl', category: 'Arms', recommendation: { weight: 12.5, reps: 8, reason: 'Test', source: 'history', previous: { weight: 10, reps: 12, date: local } }, sets: [
    { id: 'warmup', weight: 5, reps: 10, completed: false, isWarmup: true, unit: 'kgs', timestamp: 0 },
    { id: 'done', weight: 10, reps: 12, completed: true, unit: 'kgs', timestamp: 1 },
    { id: 'next', weight: 12.5, reps: 8, completed: false, unit: 'kgs', timestamp: 0 },
  ] };
  const previous = applyProgressionChoice(exercise, 'previous');
  assert.equal(previous.sets[2].weight, 10); assert.equal(previous.sets[2].reps, 12);
  assert.deepEqual(previous.sets.slice(0, 2), exercise.sets.slice(0, 2));
  assert.equal(exercise.sets[2].weight, 12.5);
  const manual = applyProgressionChoice(previous, 'manual', { weight: 11, reps: 9 });
  assert.equal(manual.sets[2].weight, 11);
  assert.equal(applyProgressionChoice(manual, 'suggestion').sets[2].weight, 12.5);
  assert.deepEqual(applyProgressionChoice(exercise, 'manual', { weight: -1, reps: 8 }), exercise);
});


test('choice units remain tied to the recommendation when a set uses another unit', () => {
  const exercise: Exercise = { id: 'e', name: 'Squat', category: 'Legs', recommendation: { unit: 'kgs', weight: 60, reps: 8, reason: 'Test', source: 'history' }, sets: [
    { id: 'warmup', weight: 20, reps: 10, completed: false, isWarmup: true, unit: 'lbs', timestamp: 0 },
    { id: 'working', weight: 50, reps: 8, completed: false, unit: 'kgs', timestamp: 0 },
  ] };
  assert.equal(applyProgressionChoice(exercise, 'suggestion').sets[1].weight, 60);
});
