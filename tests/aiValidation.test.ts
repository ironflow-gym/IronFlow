import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIValidationError, parseAIResponse } from '../src/aiValidation';
import { GeminiService, GeminiError } from '../services/geminiService';
import type { WorkoutTemplate } from '../types';
const template: WorkoutTemplate = { id: 'saved-id', name: 'Strength', excludeFromRotation: true, exercises: [{ name: 'Squat', category: 'Legs', suggestedSets: 3, targetReps: '8-12', suggestedWeight: 60, suggestedReps: 8, rationale: 'Working sets', restSeconds: 90 }] };
const mocked = (result: unknown, raw = false) => {
  const service = new GeminiService();
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
