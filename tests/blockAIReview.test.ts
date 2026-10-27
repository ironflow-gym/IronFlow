import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockAIIssues, normaliseBlockTarget } from '../src/blockAIReview';
import type { WorkoutTemplate } from '../types';
const ex = { name: 'Squat', category: 'Legs', tracking: 'reps' as const, suggestedSets: 3, targetReps: '8-12', suggestedReps: 8, suggestedWeight: 0, rationale: '' };
test('block prescriptions require consistent targets and explicit time units without guessing', () => {
  const issues = (patch: object) => blockAIIssues([{ name: 'A', exercises: [{ ...ex, ...patch }] } as WorkoutTemplate]);
  assert.equal(issues({ targetReps: '8–12' }).length, 0);
  assert.equal(normaliseBlockTarget('30 sec'), '30 seconds');
  for (const patch of [{ targetReps: '12-8' }, { targetReps: '8 each side' }, { targetReps: '1:30' }, { targetReps: '30 seconds' }, { suggestedReps: 15 }, { tracking: 'time', targetReps: '30', suggestedReps: 30 }, { tracking: 'time', targetReps: '2 minutes', suggestedReps: 120 }]) assert.equal(issues(patch).length, 1);
  assert.equal(issues({ tracking: 'time', targetReps: '30-45 seconds', suggestedReps: 30 }).length, 0);
  assert.equal(issues({ targetReps: 'AMRAP' }).length, 0);
});
