import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previousSessionSet, repeatPreviousSet } from '../src/workoutLogging.ts';
import { calcE1RM } from '../src/utils.ts';
import type { Exercise, HistoricalLog } from '../types';

const exercise: Exercise = { id: 'e', name: 'Squat', category: 'Legs', sets: [
  { id: 'warmup', weight: 20, reps: 10, unit: 'kgs', completed: true, timestamp: 1, isWarmup: true },
  { id: 'first', weight: 60, reps: 8, unit: 'kgs', completed: true, timestamp: 2 },
  { id: 'second', weight: 50, reps: 5, unit: 'kgs', completed: false, timestamp: 0, isDeload: true },
] };
const log = (overrides: Partial<HistoricalLog>): HistoricalLog => ({
  date: '2026-10-24', exercise: 'Squat', category: 'Legs', weight: 132.277, reps: 8,
  unit: 'lbs', completedAt: 1, ...overrides,
});

test('repeat copies values without marking a set complete or changing its type', () => {
  assert.deepEqual(repeatPreviousSet(exercise, 2), { weight: 60, reps: 8 });
  assert.equal(exercise.sets[2].completed, false);
  assert.equal(exercise.sets[2].isDeload, true);
  assert.equal(repeatPreviousSet(exercise, 0), null);
  assert.equal(repeatPreviousSet(exercise, 1), null, 'completed sets cannot be overwritten');
});

test('previous comparison converts units and matches working sets independently of warmups', () => {
  const previous = previousSessionSet([
    log({ isWarmup: true, reps: 12 }), log({}),
    log({ date: '2026-10-25', weight: 200, reps: 2 }),
  ], exercise, 1, 'kgs', '2026-10-25');
  assert.equal(previous?.displayWeight, 60);
  assert.equal(previous?.reps, 8);
  assert.equal(previousSessionSet([log({})], exercise, 2, 'kgs', '2026-10-25'), null);
});

test('estimated one-rep max preserves an actual single-rep result', () => {
  assert.equal(calcE1RM(100, 1), 100);
});
