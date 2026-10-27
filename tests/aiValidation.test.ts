import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIValidationError, parseAIResponse } from '../src/aiValidation';
import { GeminiService, GeminiError } from '../services/geminiService';
import type { WorkoutTemplate } from '../types';
const template: WorkoutTemplate = { id: 'saved-id', name: 'Strength', excludeFromRotation: true, exercises: [{ name: 'Squat', category: 'Legs', suggestedSets: 3, targetReps: '8-12', suggestedWeight: 60, suggestedReps: 8, rationale: 'Working sets', restSeconds: 90 }] };
const mocked = (result: unknown, raw = false) => {
  const service = new GeminiService();
  (service as any).getAestheticRatioContext = async () => null;
  (service as any).callModelWithFallback = async () => ({ text: raw ? result : JSON.stringify(result), candidates: [{ groundingMetadata: {} }] });
  return service;
};

test('malformed or incomplete AI workout results are rejected before any template change', async () => {
  for (const result of [null, {}, { name: 'X', exercises: [] }, { ...template, exercises: [{ ...template.exercises[0], suggestedSets: -2 }] }, { ...template, exercises: [{ ...template.exercises[0], suggestedSets: 2.5 }] }, { ...template, exercises: [{ ...template.exercises[0], suggestedWeight: '60' }] }, { ...template, exercises: [{ ...template.exercises[0], suggestedWeight: -10 }] }, { ...template, exercises: [{ ...template.exercises[0], restSeconds: 999999 }] }]) {
    const before = structuredClone(template);
    await assert.rejects(mocked(result).editTemplateWithAI(template, 'Add a set'), (error: unknown) => error instanceof GeminiError && error.kind === 'invalid-response');
    assert.deepEqual(template, before);
  }
  await assert.rejects(mocked('not-json', true).editTemplateWithAI(template, 'Add a set'));
  await assert.rejects(mocked('{"name":"X","exercises":[{"suggestedWeight":1e400}]}', true).editTemplateWithAI(template, 'Add a set'));
});
test('valid responses preserve locally-owned IDs and flags and discard model-supplied fields', async () => {
  const output = await mocked({ ...template, id: 'overwrite-another-record', name: 'Updated', settings: { units: 'imperial' }, exercises: [{ ...template.exercises[0], id: 'model-id', completed: true }] }).editTemplateWithAI(template, 'Rename');
  assert.equal(output.id, template.id);
  assert.equal(output.excludeFromRotation, true);
  assert.equal(output.name, 'Updated');
  assert.equal((output as any).settings, undefined);
  assert.equal((output.exercises[0] as any).completed, undefined);
});
test('preflight failure returns the original validated programme without partial generated corrections', async () => {
  const output = await mocked({ templates: [{ name: 'Invalid', exercises: [] }], changes: ['Apply this'] }).preFlightCheck([template], [], [], 'Strength');
  assert.deepEqual(output.templates, [template]);
  assert.deepEqual(output.changes, []);
  assert.match(output.warning ?? '', /unavailable or invalid/);
});
test('all structured response schemas validate arrays, enums, finite numbers and calendar dates', () => {
  const schema = { type: 'ARRAY', items: { type: 'OBJECT', properties: { date: { type: 'STRING' }, weight: { type: 'NUMBER' }, unit: { type: 'STRING', enum: ['kgs', 'lbs'] } }, required: ['date', 'weight', 'unit'] } };
  const valid = [{ date: '2026-10-26', weight: 80, unit: 'kgs' }];
  assert.deepEqual(parseAIResponse(JSON.stringify(valid), schema), valid);
  for (const value of [[{ ...valid[0], date: '2026-02-30' }], [{ ...valid[0], unit: 'stone' }], [{ ...valid[0], weight: -1 }]]) assert.throws(() => parseAIResponse(JSON.stringify(value), schema), AIValidationError);
  assert.throws(() => parseAIResponse('[{"date":"2026-10-26","weight":1e400,"unit":"kgs"}]', schema), AIValidationError);
});

test('block-only generation stages target corrections while ordinary generation stays strict', async () => {
  const draft = { templates: [{ ...template, exercises: [{ ...template.exercises[0], tracking: 'reps', targetReps: '8-12 each side' }] }] };
  const service = mocked(draft);
  let calls = 0;
  (service as any).callModelWithFallback = async () => { calls++; return { text: JSON.stringify(draft) }; };
  const output = await service.generateBlockWorkoutProgram('Strength', 1, [], [], 'block setup');
  assert.equal(calls, 2);
  assert.equal(output[0].exercises[0].targetReps, '8-12 each side');
  assert.equal(output[0].id, undefined);
  await assert.rejects(service.generateMultiWorkoutProgram('Strength', 1, [], []), /invalid rep or time target/);
});

test('block correction retries once, accepts valid correction, preserves draft on failed correction', async () => {
  const draft = { templates: [{ ...template, exercises: [{ ...template.exercises[0], tracking: 'time', targetReps: 'hold for a while' }] }] };
  const valid = structuredClone(draft); valid.templates[0].exercises[0].targetReps = '30 seconds'; valid.templates[0].exercises[0].suggestedReps = 30;
  const service = mocked(draft); let calls = 0;
  (service as any).callModelWithFallback = async () => ({ text: JSON.stringify(++calls === 1 ? draft : valid) });
  const output = await service.generateBlockWorkoutProgram('Mobility', 1, [], [], 'setup');
  assert.equal(calls, 2); assert.equal(output[0].exercises[0].targetReps, '30 seconds');
  calls = 0;
  (service as any).callModelWithFallback = async () => { if (++calls > 1) throw new Error('offline'); return { text: JSON.stringify(draft) }; };
  assert.equal((await service.generateBlockWorkoutProgram('Mobility', 1, [], [], 'setup'))[0].exercises[0].targetReps, 'hold for a while');
});

test('unreviewable block failures give understandable causes and preserve structural validation', async () => {
  await assert.rejects(mocked('not json', true).generateBlockWorkoutProgram('X', 1, [], [], 'setup'), /unreadable programme/);
  await assert.rejects(mocked({ templates: [{ ...template, exercises: [{ ...template.exercises[0], tracking: 'reps' }] }] }).generateBlockWorkoutProgram('X', 4, [], [], 'setup'), /requested 4 workouts.*returned 1/);
  await assert.rejects(mocked({ templates: [{ ...template, exercises: [{ ...template.exercises[0], tracking: 'reps', suggestedSets: -2 }] }] }).generateBlockWorkoutProgram('X', 1, [], [], 'setup'), /Workout 1.*Squat.*working sets.*-2/);
});
