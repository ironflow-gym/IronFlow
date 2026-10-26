import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyReview } from '../src/weeklyReview';
import { completeAppointment, emptySchedule } from '../src/scheduling';
import type { HistoricalLog } from '../types';
const log = (patch: Partial<HistoricalLog> = {}): HistoricalLog => ({ date: '2026-10-26', sessionId: 's', exercise: 'Squat', category: 'Legs', weight: 60, unit: 'kgs', reps: 10, templateName: 'Strength', ...patch });

test('weekly review uses completed records and exact appointment identities rather than calendar plans as training', () => {
  const schedule = completeAppointment({ ...emptySchedule(), appointments: [{ id: 'a', date: '2026-10-26', kind: 'workout', templateId: 'routine' }, { id: 'b', date: '2026-10-27', kind: 'workout', templateId: 'routine' }, { id: 'r', date: '2026-10-28', kind: 'rest' }] }, { sessionId: 's', name: 'Original name', date: '2026-10-26', appointmentId: 'a@2026-10-26' });
  const review = buildWeeklyReview([log({ appointmentId: 'a@2026-10-26' })], schedule, '2026-10-28', '2026-10-28', 3);
  assert.match(review.facts[0].value, /^1 \/ 3/);
  assert.match(review.facts[1].value, /^2 planned · 1 fulfilled.*1 missed/);
  assert.equal(review.facts[0].records[0].label, 'Original name');
  assert.ok(review.suggestions.every(suggestion => review.facts.some(fact => fact.id === suggestion.factId)));
});
test('volume converts pounds, excludes warmups/deloads/cardio/assistance and exposes source records', () => {
  const review = buildWeeklyReview([log(), log({ weight: 60 / 0.45359237, unit: 'lbs' }), log({ isWarmup: true }), log({ isDeload: true }), log({ category: 'Cardio' }), log({ exercise: 'Assisted Pull-up' })], emptySchedule(), '2026-10-26', '2026-10-26', 3);
  const volume = review.facts.find(f => f.id === 'volume')!;
  assert.match(volume.value, /^1200 kg/);
  assert.equal(volume.records.length, 2);
  assert.equal(review.isPartial, true);
});
test('no invented trends when history is insufficient and adjacent weeks are kept separate', () => {
  const review = buildWeeklyReview([log({ date: '2026-10-25' })], emptySchedule(), '2026-10-26', '2026-10-26', 3);
  assert.match(review.facts[0].value, /^0 \/ 3/);
  assert.equal(review.facts.filter(f => f.id.startsWith('strength:')).length, 0);
  assert.equal(review.from, '2026-10-26');
  assert.equal(review.hasData, false);
});
