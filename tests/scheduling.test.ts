import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, completeAppointment, completedSessions, dismissOccurrence, editOccurrence, emptySchedule, localDate, missedAppointments, normalizeSchedule, occurrences, todayPriority, weekStart } from '../src/scheduling';
import type { TrainingSchedule, WorkoutTemplate } from '../types';
const templates: WorkoutTemplate[] = [{ id: 'a', name: 'Strength A', exercises: [] }, { id: 'b', name: 'Strength B', exercises: [] }];
const schedule = (): TrainingSchedule => ({ ...emptySchedule(), appointments: [{ id: 'booking', date: '2026-10-26', kind: 'workout', templateId: 'b', repeat: 'weekly' }] });

test('Today prioritizes unfinished sessions, explicit appointments and rest over rotation', () => {
  assert.equal(todayPriority(templates, [], schedule(), '2026-10-26', true).kind, 'resume');
  const scheduled = todayPriority(templates, [], schedule(), '2026-10-26', false);
  assert.equal(scheduled.kind, 'scheduled');
  assert.equal('template' in scheduled && scheduled.template?.id, 'b');
  assert.equal(todayPriority(templates, [], emptySchedule(), '2026-10-26', false).kind, 'rotation');
  assert.equal(todayPriority([], [], emptySchedule(), '2026-10-26', false).kind, 'choose');
  const rest = { ...emptySchedule(), appointments: [{ id: 'rest', date: '2026-10-26', kind: 'rest' as const }] };
  assert.equal(todayPriority(templates, [], rest, '2026-10-26', false).kind, 'rest');
});
test('scheduled completion fulfills only the exact appointment, unscheduled completion fulfills none', () => {
  const two = schedule(); two.appointments.push({ id: 'other', date: '2026-10-26', kind: 'workout', templateId: 'b' });
  const completion = { sessionId: 'session', date: '2026-10-26', name: 'Strength B', templateId: 'b' };
  assert.equal(occurrences(completeAppointment(two, completion), completion.date, completion.date).filter(o => o.status === 'completed').length, 0);
  const completed = completeAppointment(two, { ...completion, appointmentId: 'booking@2026-10-26' });
  assert.equal(occurrences(completed, completion.date, completion.date).filter(o => o.status === 'completed').length, 1);
  assert.equal(completeAppointment(completed, completion).completions.length, 1);
});
test('missed sessions remain at their original dates until explicitly moved or skipped', () => {
  const original = occurrences(schedule(), '2026-10-26', '2026-11-03');
  assert.deepEqual(original.map(o => o.date), ['2026-10-26', '2026-11-02']);
  const moved = editOccurrence(schedule(), original[0], { date: '2026-10-29' }, 'one', 'unused');
  assert.equal(occurrences(moved, '2026-10-26', '2026-10-26').length, 0);
  assert.equal(occurrences(moved, '2026-10-29', '2026-10-29')[0].occurrenceId, 'booking@2026-10-26');
  const skipped = dismissOccurrence(schedule(), original[0], 'skipped');
  assert.equal(occurrences(skipped, '2026-10-26', '2026-10-26')[0].status, 'skipped');
  assert.equal(completedSessions([], skipped).length, 0);
});
test('a moved weekly occurrence remains visible outside its original expansion window', () => {
  const item = occurrences(schedule(), '2026-10-26', '2026-10-26')[0];
  const moved = editOccurrence(schedule(), item, { date: '2026-12-03' }, 'one', 'unused');
  assert.equal(occurrences(moved, '2026-12-03', '2026-12-03')[0].originalDate, '2026-10-26');
});
test('this-occurrence edits leave the rest of a weekly series unchanged', () => {
  const item = occurrences(schedule(), '2026-11-02', '2026-11-02')[0];
  const edited = editOccurrence(schedule(), item, { templateId: 'a' }, 'one', 'unused');
  assert.deepEqual(occurrences(edited, '2026-10-26', '2026-11-09').map(o => o.templateId), ['b', 'a', 'b']);
});
test('this-and-future edits split series and preserve completed identities and names', () => {
  const completed = completeAppointment(schedule(), { sessionId: 's', date: '2026-11-02', name: 'Original name', appointmentId: 'booking@2026-11-02' });
  const item = occurrences(completed, '2026-10-26', '2026-10-26')[0];
  const edited = editOccurrence(completed, item, { templateId: 'a' }, 'future', 'new');
  const list = occurrences(edited, '2026-10-26', '2026-11-09');
  assert.deepEqual(list.map(o => o.status), ['planned', 'completed', 'planned']);
  assert.equal(list[1].occurrenceId, 'booking@2026-11-02');
  assert.equal(edited.completions[0].name, 'Original name');
  const removed = dismissOccurrence(completed, item, 'removed', 'future');
  assert.equal(occurrences(removed, '2026-10-26', '2026-11-09').length, 1);
});
test('renamed routines resolve by ID, deleted routines remain explicitly unavailable', () => {
  const renamed = [{ ...templates[1], name: 'Renamed' }];
  const found = todayPriority(renamed, [], schedule(), '2026-10-26', false);
  assert.equal('template' in found && found.template?.name, 'Renamed');
  const deleted = todayPriority([], [], schedule(), '2026-10-26', false);
  assert.equal(deleted.kind, 'scheduled');
  assert.equal('template' in deleted && deleted.template, undefined);
});
test('old backups default to empty scheduling and completed session IDs avoid same-day conflation', () => {
  assert.deepEqual(normalizeSchedule(undefined), emptySchedule());
  const two = completeAppointment(completeAppointment(emptySchedule(), { sessionId: 'a', date: '2026-10-26', name: 'A' }), { sessionId: 'b', date: '2026-10-26', name: 'A' });
  assert.equal(completedSessions([], two).length, 2);
});
test('calendar dates use local date parts and cross month, year and DST boundaries', () => {
  assert.equal(localDate(new Date(2026, 9, 26, 0, 5)), '2026-10-26');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(weekStart('2026-11-01'), '2026-10-26');
});


test('an appointment explicitly moved before its series start remains visible when missed', () => {
  const item = occurrences(schedule(), '2026-10-26', '2026-10-26')[0];
  const moved = editOccurrence(schedule(), item, { date: '2026-10-20' }, 'one', 'unused');
  assert.equal(missedAppointments(moved, '2026-10-25')[0].date, '2026-10-20');
  assert.equal(missedAppointments(moved, '2026-10-25', item.occurrenceId).length, 0);
});
