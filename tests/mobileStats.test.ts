import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordedSessions, recentTraining, bodyWeightSummary, recoveryContext } from '../src/mobileStats';
import type { HistoricalLog, BiometricEntry } from '../types';
const row = (patch: Partial<HistoricalLog> = {}): HistoricalLog => ({ date: '2026-10-27', sessionId: 'one', exercise: 'Squat', category: 'Legs', templateId: 'routine', weight: 60, reps: 8, unit: 'kgs', ...patch });
const today = '2026-10-27';
test('workout totals use IDs and conservatively group legacy records by date, excluding future rows', () => {
  const rows = [row(), row(), row({ sessionId: 'two' }), row({ sessionId: undefined }), row({ sessionId: undefined, templateName: 'Other old name' }), row({ date: '2026-10-28', sessionId: 'future' })];
  assert.equal(recordedSessions(rows, today).length, 3);
  const summary = recentTraining(rows, 3, today); assert.equal(summary.total, 3); assert.equal(summary.count, 3); assert.equal(summary.weeks.at(-1)!.count, 3); assert.equal(summary.weeks.at(-1)!.partial, true); assert.equal(summary.weeks.reduce((sum, week) => sum + week.count, 0), summary.count);
  assert.equal(recentTraining([row({ date: '2026-09-29' }), row({ date: '2026-09-30', sessionId: 'inside' })], 3, today).count, 1);
});
test('comparable improvements retain exact reps and routine identity, convert units and exclude misleading sets', () => {
  const earlier = row({ date: '2026-10-01', sessionId: 'first' });
  const later = row({ weight: 65 / 0.45359237, unit: 'lbs', sessionId: 'last', templateName: 'Renamed' });
  const excluded = [row({ weight: 100, isWarmup: true }), row({ weight: 100, isDeload: true }), row({ weight: 100, tracking: 'time' }), row({ weight: 100, reps: 10 }), row({ weight: 100, templateId: 'different' }), row({ weight: 100, category: 'Cardio' })];
  const data = recentTraining([earlier, later, ...excluded], 3, today); assert.equal(data.improvements.length, 1); assert.ok(Math.abs(data.improvements[0].last - 65) < 1e-6); assert.equal(data.improvements[0].reps, 8);
  assert.equal(recentTraining([earlier, { ...later, templateId: 'different' }], 3, today).improvements.length, 0);
  assert.equal(recentTraining([{ ...earlier, templateId: undefined, templateName: undefined }, { ...later, templateId: undefined, templateName: undefined }], 3, today).improvements.length, 0);
});
test('ambiguous ordering on one day cannot manufacture a strength improvement', () => {
  assert.equal(recentTraining([row({ weight: 50 }), row({ weight: 60, sessionId: 'two' })], 3, today).improvements.length, 0);
  assert.equal(recentTraining([row({ weight: 50, completedAt: 1 }), row({ weight: 60, sessionId: 'two', completedAt: 2 })], 3, today).improvements.length, 1);
});
test('weight averages use distinct measured days, explicit units and no future or invented values', () => {
  const measurements: BiometricEntry[] = ['2026-10-15', '2026-10-17', '2026-10-20', '2026-10-22', '2026-10-24', '2026-10-27'].map(date => ({ date, weight: date < '2026-10-21' ? 80 : 79 / 0.45359237, unit: date < '2026-10-21' ? 'kgs' : 'lbs' }));
  const data = bodyWeightSummary([...measurements, { date: '2026-10-28', weight: 100, unit: 'kgs' }], today);
  assert.equal(data.current!.count, 3); assert.ok(Math.abs(data.current!.weight - 79) < 1e-6); assert.equal(data.previous!.weight, 80); assert.equal(data.latest!.date, today); assert.equal(data.daysSinceLatest, 0);
  assert.equal(data.points.find(p => p.date === '2026-10-23')!.recorded, null);
  const duplicate = bodyWeightSummary([measurements[3], measurements[3], measurements[3]], today); assert.equal(duplicate.current, null);
});
test('sparse and stale weight readings show dated changes, with waist units retained and no smoothed claim', () => {
  const data = bodyWeightSummary([{ date: '2026-09-01', weight: 80, unit: 'kgs', waist: 90 }, { date: '2026-09-08', weight: 79, unit: 'kgs', waist: 89 }], today);
  assert.equal(data.current, null); assert.equal(data.previous, null); assert.equal(data.recordedChange!.change, -1); assert.equal(data.recordedChange!.from, '2026-09-01'); assert.equal(data.waistChange!.change, -1); assert.equal(data.daysSinceLatest, 49); assert.ok(data.points.every(p => p.recorded === null && p.average === null));
  assert.equal(bodyWeightSummary([], today).latest, undefined);
});
test('recovery wording distinguishes real marked dates from inferred boundaries without altering the recommendation', () => {
  const estimate = { blockWeek: 6, targetBlockLength: 5, weeksUntilDue: -1, status: 'overdue', rpeTrend: 'rising', volumeZone: 'heavy', rpeConfidence: true, lastDeloadDate: '2026-10-01', reasoning: 'existing estimate' } as const;
  const before = structuredClone(estimate);
  const inferred = recoveryContext([row()], estimate, today); assert.equal(inferred.recorded, false); assert.match(inferred.label, /estimated/);
  const explicit = recoveryContext([row({ date: '2026-10-13', isDeload: true }), row({ date: '2026-10-28', isDeload: true })], estimate, today); assert.equal(explicit.date, '2026-10-13'); assert.match(explicit.label, /2 weeks/); assert.deepEqual(estimate, before);
  assert.match(recoveryContext([], null, today).label, /Not enough/);
});

test('weekly streaks count distinct sessions on the same day and do not split legacy records', async () => {
  const { calcWeeklyStreak } = await import('../src/utils'); const { localDate, weekStart, addDays } = await import('../src/scheduling');
  const date = addDays(weekStart(localDate()), -7);
  assert.equal(calcWeeklyStreak([row({ date }), row({ date, sessionId: 'two' }), row({ date })], 2), 1);
  assert.equal(calcWeeklyStreak([row({ date, sessionId: undefined }), row({ date, sessionId: undefined, templateName: 'Another old name' })], 2), 0);
});
