import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySessionAdaptation, proposeSessionAdaptation } from '../src/sessionAdaptation';
import type { ExerciseLibraryItem, WorkoutSession } from '../types';
const session: WorkoutSession = { id: 's', name: 'Strength', status: 'active', startTime: 1, appointmentId: 'a@2026-10-26', exercises: [
  { id: 'a', name: 'Machine Press', category: 'Chest', sets: [
    { id: 'warmup', weight: 22.56, reps: 8, unit: 'kgs', completed: true, timestamp: 1, isWarmup: true },
    { id: 'done', weight: 30.06, reps: 8, unit: 'kgs', completed: true, timestamp: 2 },
    ...Array.from({ length: 5 }, (_, i) => ({ id: `pending-${i}`, weight: 30.06, reps: 8, unit: 'kgs' as const, completed: false, timestamp: 0 })),
  ] },
  { id: 'b', name: 'Assisted Pull-up', category: 'Back', sets: [{ id: 'assistance', weight: 30, reps: 8, unit: 'kgs', completed: false, timestamp: 0 }] },
] };
const library: ExerciseLibraryItem[] = [{ name: 'Machine Press', category: 'Chest', muscles: ['Pectorals'], instructions: [], benefits: '', risks: '', barWeight: 22.56, weightIncrement: 2.5, loadingMode: 'single' }, { name: 'Dumbbell Row', category: 'Back', muscles: ['Lats'], instructions: [], benefits: '', risks: '', weightIncrement: 2.5, loadingMode: 'single' }];

test('low-energy preview changes only unfinished working weights on feasible equipment increments', () => {
  const before = structuredClone(session);
  const proposal = proposeSessionAdaptation(session, { readiness: 'low-energy', replacements: {} }, library);
  assert.deepEqual(session, before);
  assert.deepEqual(proposal.session.exercises[0].sets.slice(0, 2), session.exercises[0].sets.slice(0, 2));
  assert.equal(proposal.session.exercises[0].sets[2].weight, 27.56);
  assert.equal(proposal.session.exercises[1].sets[0].weight, 30, 'assistance is not reduced');
  assert.equal(proposal.session.appointmentId, session.appointmentId);
  const applied = applySessionAdaptation(session, proposal);
  assert.equal(applied.adaptations?.length, 1);
});
test('shortening removes only pending working sets and retains completed values and exercise identities', () => {
  const proposal = proposeSessionAdaptation(session, { minutes: 5, readiness: 'normal', replacements: {} }, library);
  assert.ok(proposal.session.exercises[0].sets.length < session.exercises[0].sets.length);
  assert.deepEqual(proposal.session.exercises[0].sets.slice(0, 2), session.exercises[0].sets.slice(0, 2));
  assert.equal(proposal.session.exercises[0].sets.filter(s => !s.completed).length, 1);
  assert.equal(proposal.session.exercises[0].id, 'a');
});
test('replacement requires an unstarted exercise and never transfers its old machine load', () => {
  assert.throws(() => proposeSessionAdaptation(session, { readiness: 'normal', replacements: { a: 'Dumbbell Row' } }, library), /completed sets/);
  const proposal = proposeSessionAdaptation(session, { readiness: 'normal', replacements: { b: 'Dumbbell Row' } }, library);
  assert.equal(proposal.session.exercises[1].name, 'Dumbbell Row');
  assert.equal(proposal.session.exercises[1].sets[0].weight, 0);
  assert.equal(session.exercises[1].name, 'Assisted Pull-up');
});
test('stale adaptation cannot overwrite a set completed after preview', () => {
  const proposal = proposeSessionAdaptation(session, { readiness: 'low-energy', replacements: {} }, library);
  const current = structuredClone(session); current.exercises[0].sets[2].completed = true;
  assert.throws(() => applySessionAdaptation(current, proposal), /Preview/);
});
