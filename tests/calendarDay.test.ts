import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDayStatus } from '../src/calendarDay';
import { occurrences, emptySchedule } from '../src/scheduling';

test('calendar markers retain mixed statuses and exclude skipped and removed appointments from scheduled counts', () => {
  const date = '2026-10-27';
  const schedule = { ...emptySchedule(), appointments: [
    { id: 'pending', date, kind: 'workout' as const }, { id: 'done', date, kind: 'workout' as const },
    { id: 'skip', date, kind: 'workout' as const }, { id: 'remove', date, kind: 'workout' as const }, { id: 'rest', date, kind: 'rest' as const },
  ], exceptions: { [`done@${date}`]: { status: 'completed' as const, sessionId: 's' }, [`skip@${date}`]: { status: 'skipped' as const }, [`remove@${date}`]: { status: 'removed' as const } } };
  const sessions = [{ sessionId: 's', date, name: 'Scheduled' }, { sessionId: 'u', date, name: 'Unscheduled' }];
  const result = calendarDayStatus(date, date, occurrences(schedule, date, date), sessions);
  assert.deepEqual(result, { scheduled: 1, completed: 2, missed: 0, rest: true, label: '1 scheduled workout, 2 completed workouts, Planned rest, 1 skipped workout' });
});

test('past active appointments are in progress rather than missed; recurrence uses occurrence dates', () => {
  const schedule = { ...emptySchedule(), appointments: [{ id: 'weekly', date: '2026-10-19', kind: 'workout' as const, repeat: 'weekly' as const }, { id: 'active', date: '2026-10-26', kind: 'workout' as const }] };
  const items = occurrences(schedule, '2026-10-26', '2026-11-01');
  const status = calendarDayStatus('2026-10-26', '2026-10-27', items, [], 'active@2026-10-26');
  assert.equal(status.missed, 1); assert.equal(status.scheduled, 1); assert.match(status.label, /in progress/);
  assert.equal(calendarDayStatus('2026-10-28', '2026-10-27', items, []).label, 'No appointments');
});
