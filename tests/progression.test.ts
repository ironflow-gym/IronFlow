import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyProgressionChoice, convertWeight, getWeightRecommendation, previewWeightIncrease, applyWeightIncrease } from '../src/progression';
import { localDate } from '../src/scheduling';
import type { Exercise, HistoricalLog, ExerciseLibraryItem } from '../types';
const log = (patch: Partial<HistoricalLog> = {}): HistoricalLog => ({ date: localDate(), exercise: 'Squat', category: 'Legs', weight: 60, unit: 'kgs', reps: 12, templateName: 'Old name', templateId: 'routine', sessionId: 'session', exerciseInstanceId: 'exercise', prescribedWorkingSets: 3, prescribedRepRange: '8-12', ...patch });
const session = (reps = [12, 12, 12]) => reps.map((reps, workingSetIndex) => log({ reps, workingSetIndex, completedAt: workingSetIndex + 1 }));
const recommend = (history: HistoricalLog[], count = 3, range = '8-12') => getWeightRecommendation('metric', 'Squat', 'Legs', history, 40, range, undefined, 'Renamed routine', undefined, 1.25, 20, 'paired', { templateId: 'routine', workingSets: count });

test('one successful set cannot trigger progression; a complete qualifying session can', () => {
  const incompletePerformance = session([12, 9, 8]);
  const held = recommend(incompletePerformance);
  assert.equal(held.weight, 60); assert.equal(held.action, 'reps');
  assert.deepEqual(held.sets?.map(set => set.reps), [12, 10, 9]);
  assert.deepEqual(recommend([...incompletePerformance].reverse()), held, 'input record order cannot change the result');
  const increase = recommend(session());
  assert.equal(increase.weight, 62.5); assert.equal(increase.reps, 8); assert.equal(increase.action, 'increase');
  assert.match(increase.reason, /All 3 prescribed working sets/);
});

test('missing prescribed sets, duplicate indices and ambiguous legacy records cannot qualify', () => {
  assert.equal(recommend(session().slice(0, 2)).weight, 60);
  assert.match(recommend(session().slice(0, 2)).reason, /Only 2 of 3/);
  assert.equal(recommend(session().map(row => ({ ...row, workingSetIndex: 0 }))).weight, 60);
  const old = session().map(({ prescribedWorkingSets, prescribedRepRange, exerciseInstanceId, sessionId, ...row }) => row);
  assert.equal(recommend(old).weight, 60);
  assert.equal(recommend(old).action, 'hold');
  assert.equal(recommend(session(), 4).weight, 60);
  assert.equal(recommend(session(), 3, '10-15').weight, 60);
});

test('newer sessions on the same date win, routine IDs survive renames and other routines cannot qualify', () => {
  const oldGood = session().map(row => ({ ...row, sessionId: 'older', completedAt: row.completedAt! + 10 }));
  const recent = session([9, 9, 9]).map(row => ({ ...row, sessionId: 'newer', completedAt: row.completedAt! + 100 }));
  assert.equal(recommend([...oldGood, ...recent]).weight, 60);
  assert.equal(recommend(session()).action, 'increase', 'same stable routine ID despite new display name');
  assert.equal(recommend(session().map(row => ({ ...row, templateId: 'different' }))).weight, 60);
  assert.equal(recommend(session().map(row => ({ ...row, templateId: undefined }))).weight, 60);
});

test('explicit warmups/deloads do not qualify; a lighter working set is retained and blocks increases', () => {
  const actual = session([12, 12, 9]).map((row, i) => ({ ...row, weight: i === 2 ? 30 : 60 }));
  const result = recommend([...actual, log({ isWarmup: true, reps: 50 }), log({ isDeload: true, reps: 50 })]);
  assert.equal(result.action, 'reps');
  assert.deepEqual(result.sets?.map(set => set.weight), [60, 60, 30]);
  const qualified = recommend(actual.map(row => ({ ...row, reps: 12 })));
  assert.deepEqual(qualified.sets?.map(set => set.weight), [62.5, 62.5, 32.5]);
});

test('mixed units, assisted exercises and fractional equipment grids preserve feasible physical loads', () => {
  const mixed = session().map((row, i) => i ? row : { ...row, weight: 60 / 0.45359237, unit: 'lbs' });
  assert.equal(recommend(mixed).weight, 62.5);
  assert.equal(convertWeight(60, 'kgs', 'kg'), 60);
  const result = getWeightRecommendation('metric', 'Assisted Pull-up', 'Back', session().map(row => ({ ...row, exercise: 'Assisted Pull-up', category: 'Back', weight: 30 })), 30, '8-12', undefined, 'A', undefined, 2.5, 0, 'single', { templateId: 'routine', workingSets: 3 });
  assert.equal(result.weight, 27.5); assert.match(result.reason, /Reduce assistance/);
});

test('different exercises do not transfer loads and no-history starts at routine values or equipment base', () => {
  const unrelated = getWeightRecommendation('metric', 'Leg Press', 'Legs', session(), 0, '8-12', undefined, 'A', undefined, 2.5, 22.56, 'single', { workingSets: 3 });
  assert.equal(unrelated.weight, 22.56); assert.equal(unrelated.source, 'routine'); assert.equal(unrelated.needsStartingLoad, true);
  assert.equal(getWeightRecommendation('metric', 'Squat', 'Legs', [], 40, '8-12').weight, 40);
  assert.equal(getWeightRecommendation('metric', 'Squat', 'Legs', [], 0, '8-12').weight, 0);
});

const exercise: Exercise = { id: 'e', name: 'Machine Press', category: 'Chest', sets: [
  { id: 'warmup', weight: 22.56, reps: 10, completed: false, isWarmup: true, unit: 'kgs', timestamp: 0 },
  { id: 'done', weight: 30.06, reps: 12, completed: true, unit: 'kgs', timestamp: 1 },
  { id: 'next', weight: 30.06, reps: 9, completed: false, unit: 'kgs', timestamp: 0 },
  { id: 'lighter', weight: 27.56, reps: 8, completed: false, unit: 'kgs', timestamp: 0 },
  { id: 'deload', weight: 22.56, reps: 8, completed: false, isDeload: true, unit: 'kgs', timestamp: 0 },
] };
const library: ExerciseLibraryItem[] = [{ name: exercise.name, category: 'Chest', muscles: [], instructions: [], benefits: '', risks: '', barWeight: 22.56, weightIncrement: 2.5, loadingMode: 'single' }];

test('manual increase previews and applies one step to unfinished working sets only, without changing reps', () => {
  const preview = previewWeightIncrease(exercise, library);
  assert.deepEqual(preview.changes.map(row => row.to), [32.56, 30.06]);
  const updated = applyWeightIncrease(exercise, preview);
  assert.deepEqual(updated.sets.map(row => row.reps), exercise.sets.map(row => row.reps));
  assert.deepEqual(updated.sets.filter(row => ['warmup', 'done', 'deload'].includes(row.id)), exercise.sets.filter(row => ['warmup', 'done', 'deload'].includes(row.id)));
  assert.equal(exercise.sets[2].weight, 30.06);
  assert.throws(() => applyWeightIncrease({ ...exercise, sets: exercise.sets.map(row => ({ ...row, completed: true })) }, preview), /changed/);
});

test('manual increase means less assistance; imperial and paired loading respect equipment settings', () => {
  const assisted = { ...exercise, name: 'Assisted Pull-up', sets: exercise.sets.map(set => ({ ...set, weight: 30 })) };
  const assistLibrary = [{ ...library[0], name: assisted.name, barWeight: 0 }];
  const preview = previewWeightIncrease(assisted, assistLibrary);
  assert.equal(preview.assisted, true);
  assert.equal(preview.changes[0].to, 27.5);
  const lbs = { ...exercise, sets: exercise.sets.map(row => ({ ...row, unit: 'lbs' as const, weight: row.weight / 0.45359237 })) };
  assert.ok(Math.abs(previewWeightIncrease(lbs, library).changes[0].to * 0.45359237 - 32.56) < 1e-5);
  assert.equal(previewWeightIncrease(exercise, [{ ...library[0], loadingMode: 'paired' }]).changes[0].to, 32.56, 'off-grid loads move to next feasible paired total');
});

test('suggestion and previous choices preserve per-set loads and completed sets; manual entry remains explicit', () => {
  const ex: Exercise = { ...exercise, recommendation: { weight: 32.56, reps: 8, reason: 'Test', source: 'history', unit: 'kgs', sets: [{ weight: 32.56, reps: 8 }, { weight: 32.56, reps: 8 }, { weight: 30.06, reps: 8 }], previousSets: [{ weight: 30.06, reps: 12 }, { weight: 30.06, reps: 10 }, { weight: 27.56, reps: 9 }], previous: { weight: 30.06, reps: 12, date: localDate() } } };
  const suggested = applyProgressionChoice(ex, 'suggestion');
  assert.equal(suggested.sets[1].weight, 30.06); assert.equal(suggested.sets[2].weight, 32.56); assert.equal(suggested.sets[3].weight, 30.06);
  const previous = applyProgressionChoice(ex, 'previous');
  assert.equal(previous.sets[3].weight, 27.56); assert.equal(previous.sets[3].reps, 9);
  const manual = applyProgressionChoice(ex, 'manual', { weight: 35.06, reps: 9 });
  assert.equal(manual.sets[2].weight, 35.06); assert.deepEqual(manual.sets[0], ex.sets[0]);
  assert.equal(applyProgressionChoice(ex, 'manual', { weight: -1, reps: 8 }).sets[2].weight, ex.sets[2].weight);
});

test('assistance floor retains reps and unconfigured equipment does not rewrite a held recorded load', () => {
  const result = getWeightRecommendation('metric', 'Assisted Pull-up', 'Back', session().map(row => ({ ...row, exercise: 'Assisted Pull-up', category: 'Back', weight: 0 })), 0, '8-12', undefined, 'A', undefined, 2.5, 0, 'single', { templateId: 'routine', workingSets: 3 });
  assert.equal(result.weight, 0); assert.equal(result.reps, 12); assert.equal(result.action, 'hold');
  const hold = getWeightRecommendation('metric', 'Squat', 'Legs', session([9, 9, 9]).map(row => ({ ...row, weight: 60.23 })), 0, '8-12', undefined, 'A', undefined, undefined, undefined, undefined, { templateId: 'routine', workingSets: 3 });
  assert.equal(hold.weight, 60.23);
});
