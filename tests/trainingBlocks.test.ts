import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockDates, blockPrompt, blockProgress, createBlock, editFutureWorkout, nextBlockSession, resolveBlockSession, scheduleBlockSlots, scheduleConflicts, validateTrainingBlocks, blockFacts } from '../src/trainingBlocks.ts';
import { emptySchedule, addDays, localDate, occurrences } from '../src/scheduling.ts';
import { validateBackup } from '../src/backupRestore.ts';
import type { BlockSetup, WorkoutTemplate } from '../types';
const setup: BlockSetup = { name: 'Strength block', goal: 'strength', daysPerWeek: 3, workoutsPerRound: 4, rounds: 2, minutes: 45, experience: 'intermediate', returning: true, equipment: 'Dumbbells and bench', priorities: 'Press strength', event: '' };
const workouts: WorkoutTemplate[] = ['A', 'B', 'C', 'D'].map(name => ({ id: name, name, exercises: [{ name: 'Dumbbell Press', category: 'Chest', suggestedSets: 3, targetReps: '8-12', suggestedWeight: 20, suggestedReps: 8, rationale: 'Controlled repetitions', restSeconds: 90 }] }));
const block = () => createBlock(setup, workouts, 'double');

test('different workouts and rounds are independent of training days; source routines remain independent', () => {
  const created = block(); assert.equal(created.sessions.length, 8);
  assert.deepEqual(created.sessions.map(s => s.template.name), ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D']);
  assert.deepEqual(created.sessions.map(s => s.round), [1, 1, 1, 1, 2, 2, 2, 2]);
  assert.equal(new Set(created.sessions.map(s => s.id)).size, 8);
  assert.equal(created.sessions[0].template.id, created.sessions[4].template.id, 'same workout keeps its progression context across rounds');
  created.workouts[0].name = 'Edited copy'; assert.equal(workouts[0].name, 'A'); assert.equal(created.sessions[0].template.name, 'A');
});

test('out-of-order completion and explicit skips do not fulfil an unrelated next session', () => {
  let created = block(); const later = created.sessions[5].id, first = created.sessions[0].id;
  created = resolveBlockSession(created, later, 'completed', 'actual-later'); assert.equal(nextBlockSession(created)?.id, first);
  created = resolveBlockSession(created, first, 'skipped'); assert.deepEqual(blockProgress(created), { completed: 1, skipped: 1, total: 8 });
  assert.equal(nextBlockSession(created)?.id, created.sessions[1].id);
  assert.throws(() => resolveBlockSession(created, later, 'completed', 'another'), /resolved/);
  assert.throws(() => resolveBlockSession(created, created.sessions[1].id, 'completed', 'actual-later'), /already fulfils/);
});

test('partial acceptance is explicit and retains actual workout identity', () => {
  const created = block(); const accepted = resolveBlockSession(created, created.sessions[0].id, 'completed', 'partial-session', true);
  assert.equal(accepted.sessions[0].partial, true); assert.equal(accepted.sessions[0].completedSessionId, 'partial-session');
  assert.equal(created.sessions[0].status, 'planned', 'unaccepted attempt does not alter block by itself');
});

test('future edits preserve started/completed prescriptions and historical names', () => {
  let created = block(); created = resolveBlockSession(created, created.sessions[0].id, 'completed', 'done');
  const original = structuredClone(created.sessions[0]);
  const changed = editFutureWorkout(created, created.workouts[0].id!, { ...created.workouts[0], name: 'Renamed A' });
  assert.deepEqual(changed.sessions[0], original); assert.equal(changed.sessions[4].template.name, 'Renamed A');
  const started = editFutureWorkout(created, created.workouts[0].id!, { ...created.workouts[0], name: 'Future A' }, created.sessions[4].id);
  assert.equal(started.sessions[4].template.name, 'A');
});

test('calendar expansion carries a four-workout round across a three-day training week', () => {
  const created = block(); const dates = blockDates(created, '2026-10-26', [1, 3, 5]);
  assert.deepEqual(dates.slice(0, 5).map(d => d.date), ['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02', '2026-11-04']);
  assert.throws(() => blockDates(created, '2026-02-30', [1, 3, 5]), /valid/);
  assert.throws(() => blockDates(created, '2026-10-26', []), /Choose 3/);
});

test('explicit scheduling supports multiple workouts per day, rescheduling and preserved unrelated/rest appointments', () => {
  const created = block(), today = localDate();
  const existing = { ...emptySchedule(), appointments: [{ id: 'rest', date: today, kind: 'rest' as const }] };
  const planned = [{ slotId: created.sessions[0].id, date: today }, { slotId: created.sessions[1].id, date: today }];
  assert.equal(scheduleConflicts(existing, planned, created.id).length, 1);
  const scheduled = scheduleBlockSlots(existing, created, planned);
  assert.equal(occurrences(scheduled, today, today).length, 3); assert.equal(existing.appointments.length, 1);
  const moved = scheduleBlockSlots(scheduled, created, [{ slotId: created.sessions[0].id, date: addDays(today, 2) }]);
  assert.equal(moved.appointments.length, 3); assert.equal(occurrences(moved, addDays(today, 2), addDays(today, 2)).length, 1);
  assert.equal(occurrences(scheduled, today, today).length, 3, 'nothing shifted in the original snapshot');
  assert.throws(() => scheduleBlockSlots(existing, created, [{ slotId: created.sessions[0].id, date: addDays(today, -1) }]), /today or a future/);
});

test('AI context includes every block choice and separates workout count from training days', () => {
  const prompt = blockPrompt(setup);
  for (const text of ['Build strength', '4 DIFFERENT workouts', '2 rounds', '3 training DAYS', '45 minutes', 'intermediate', 'Returning after a break: yes', 'Dumbbells and bench', 'Press strength']) assert.ok(prompt.includes(text), text);
});

test('goal catalogue supports timed/fixed prescriptions without inventing resistance progression', () => {
  const created = createBlock({ ...setup, goal: 'mobility' }, workouts.map(w => ({ ...w, exercises: w.exercises.map(ex => ({ ...ex, tracking: 'time', targetReps: '30 seconds', suggestedReps: 30 })) })), 'fixed');
  assert.equal(created.workouts[0].progressionMode, 'fixed'); assert.equal(created.sessions[0].template.exercises[0].tracking, 'time');
});

test('malformed programmes, duplicate workout names and multiple active blocks fail validation', () => {
  assert.throws(() => createBlock(setup, workouts.slice(0, 2), 'double'), /exactly 4/);
  assert.throws(() => createBlock(setup, workouts.map(w => ({ ...w, name: 'same' })), 'double'), /distinct/);
  assert.throws(() => createBlock(setup, workouts.map(w => ({ ...w, exercises: [] })), 'double'), /at least one/);
  assert.throws(() => validateTrainingBlocks([block(), block()]), /Invalid/);
  const bad = block(); bad.sessions[0].round = 99; assert.throws(() => validateTrainingBlocks([bad]), /Invalid/);
});

test('backup validation retains block snapshots and nutrition recovery settings; older backups remain unchanged', () => {
  const created = block(); created.nutrition = { previous: { goal: 'Maintenance', preferences: [], targetProteinRatio: 1.6, targetMultiplier: 1.1 }, approved: { goal: 'Build Muscle', preferences: [], targetProteinRatio: 2, targetMultiplier: 1.1 } };
  const data = { ironflow_blocks: [created], ironflow_history: [] }; assert.deepEqual(validateBackup(data), data);
  assert.deepEqual(validateBackup({ ironflow_history: [] }), { ironflow_history: [] });
  const bad = structuredClone(created); bad.sessions[0].template.exercises[0].suggestedSets = -1; assert.throws(() => validateBackup({ ironflow_blocks: [bad] }), /Check/);
});

test('review counts only explicitly fulfilled sessions, excludes warmups and does not treat skipped sessions as training', () => {
  let created = block(); created = resolveBlockSession(created, created.sessions[0].id, 'completed', 'fulfilled'); created = resolveBlockSession(created, created.sessions[1].id, 'skipped');
  const log = { date: localDate(), exercise: 'Dumbbell Press', category: 'Chest', weight: 20, reps: 8, unit: 'kgs' };
  const facts = blockFacts(created, [{ ...log, sessionId: 'fulfilled' }, { ...log, sessionId: 'fulfilled', isWarmup: true }, { ...log, sessionId: 'ordinary-unassigned' }]);
  assert.equal(facts.completed, 1); assert.equal(facts.skipped, 1); assert.equal(facts.workingSets, 1);
});

test('approved goal policies retain existing Food calculation and avoid automatic non-strength progression', async () => {
  const { blockNutritionForGoal, blockModeForGoal, blockGoals, templateInUnits } = await import('../src/trainingBlocks.ts');
  const current = { goal: 'Maintenance' as const, preferences: ['Vegetarian'], targetProteinRatio: 1.6, targetMultiplier: 1.15 };
  assert.equal(blockGoals.length, 12);
  assert.equal(blockNutritionForGoal('fat-loss', current)?.goal, 'Lose Fat');
  const bulk = blockNutritionForGoal('muscle', current)!;
  assert.equal(bulk.goal, 'Build Muscle'); assert.equal(bulk.targetMultiplier, 1.15); assert.deepEqual(bulk.preferences, current.preferences);
  assert.equal(blockNutritionForGoal('power', current), undefined);
  assert.equal(blockNutritionForGoal('recomposition', { ...current, goal: 'Build Muscle' })?.goal, 'Maintenance');
  for (const goal of ['power', 'mobility', 'cardio-endurance', 'muscular-endurance', 'sport'] as const) assert.equal(blockModeForGoal(goal), 'fixed');
  assert.equal(blockModeForGoal('strength'), 'double');
  const metric = { ...workouts[0], weightUnit: 'kgs' as const };
  const imperial = templateInUnits(metric, 'lbs');
  assert.ok(Math.abs(imperial.exercises[0].suggestedWeight * 0.45359237 - 20) < 0.00001);
  assert.equal(metric.exercises[0].suggestedWeight, 20);
});

test('detached calendar links survive JSON and partial attempts leave the planned appointment unresolved', async () => {
  const { linkedBlockAppointment, blockAppointment } = await import('../src/trainingBlocks.ts');
  const { completeAppointment } = await import('../src/scheduling.ts');
  const created = block(), today = localDate(), slot = created.sessions[0];
  const scheduled = scheduleBlockSlots(emptySchedule(), created, [{ slotId: slot.id, date: today }]);
  const id = blockAppointment(scheduled, created.id, slot.id)!.id;
  const partial = completeAppointment(scheduled, { sessionId: 'partial', date: today, name: slot.template.name, appointmentId: id, blockId: created.id, blockSessionId: slot.id, blockSessionFulfilled: false });
  assert.equal(occurrences(partial, today, today)[0].status, 'planned'); assert.equal(partial.completions.length, 1);
  const detached = JSON.parse(JSON.stringify({ ...partial, exceptions: { [id]: { blockId: null, blockSessionId: null, templateId: 'replacement' } } }));
  assert.equal(linkedBlockAppointment([created], detached, id), undefined);
  assert.equal(blockAppointment(detached, created.id, slot.id), undefined);
});

test('timed loaded holds cannot inflate recorded resistance volume or strength estimates', async () => {
  const { buildWeeklyReview } = await import('../src/weeklyReview.ts');
  const timed = { date: '2026-10-26', sessionId: 'hold', exercise: 'Loaded Hold', category: 'Core', tracking: 'time' as const, weight: 20, reps: 180, duration: 180, unit: 'kgs' };
  const review = buildWeeklyReview([timed], emptySchedule(), '2026-10-26', '2026-10-26', 3);
  assert.equal(review.summary.volume, 0);
  assert.equal(review.facts.filter(f => f.id.startsWith('strength:')).length, 0);
  let created = block(); created = resolveBlockSession(created, created.sessions[0].id, 'completed', 'hold');
  const facts = blockFacts(created, [timed]); assert.equal(facts.timedMinutes, 3); assert.deepEqual(facts.strength, []);
});
