import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAdaptation, displayDate } from '../src/interfacePresentation';
import type { WorkoutSession } from '../types';
const before: WorkoutSession = { id: 's', name: 'Press', status: 'active', startTime: 1, exercises: [{ id: 'press', name: 'Machine Press', category: 'Chest', sets: Array.from({ length: 5 }, (_, i) => ({ id: String(i), weight: 30.06, reps: 8, unit: 'kgs', completed: false, timestamp: 0 })) }] };

test('presentation groups only retained identical load changes and counts removed sets separately', () => {
  const after = structuredClone(before);
  after.exercises[0].sets = after.exercises[0].sets.slice(0, 3).map(set => ({ ...set, weight: 27.56 }));
  const summary = summarizeAdaptation(before, after);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].removed, 2);
  assert.deepEqual(summary[0].loads, [{ count: 3, text: '30.06 → 27.56 kg × 8' }]);
  assert.equal(before.exercises[0].sets.length, 5);
});
test('presentation keeps different set prescriptions distinct and formats calendar dates locally', () => {
  const after = structuredClone(before);
  after.exercises[0].sets[0].weight = 27.56;
  after.exercises[0].sets[1].weight = 25.06;
  assert.equal(summarizeAdaptation(before, after)[0].loads.length, 2);
  assert.match(displayDate('2026-10-26'), /26/);
  assert.doesNotMatch(displayDate('2026-10-26'), /2026-10-26/);
});
