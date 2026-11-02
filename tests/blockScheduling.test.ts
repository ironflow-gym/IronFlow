import { test } from 'node:test';
import { validateBackup } from '../src/backupRestore.ts';
import assert from 'node:assert/strict';
import { createBlock } from '../src/trainingBlocks.ts';
import { emptySchedule, occurrences, normalizeSchedule } from '../src/scheduling.ts';
import { previewBlockSchedule, type BlockScheduleOptions } from '../src/blockScheduling.ts';
import type { WorkoutSession } from '../types';
const make = () => createBlock({ name: 'Block', goal: 'strength', daysPerWeek: 3, workoutsPerRound: 3, rounds: 2, minutes: 45, experience: 'intermediate', returning: false, equipment: '', priorities: '', event: '' }, ['A','B','C'].map(name => ({ id: name, name, exercises: [{ name: 'Squat', category: 'Legs', suggestedSets: 2, suggestedReps: 8, targetReps: '8', suggestedWeight: 20, rationale: 'Control' }] })), 'double');
const options: BlockScheduleOptions = { action: 'rebuild', start: '2026-11-03', weekdays: [2,4,6], scope: 'later', includeMissed: true, conflictPolicy: 'review' };
const run = (schedule: ReturnType<typeof emptySchedule>, block: ReturnType<typeof make>, opts = options, active: WorkoutSession | null = null) => previewBlockSchedule(schedule, block, opts, active, '2026-11-03');
test('Tuesday to Thursday cascades in workout order without duplicating appointments', () => {
 const block = make(), before = run(emptySchedule(), block).schedule;
 const result = run(before, block, { ...options, action: 'move', slotId: block.sessions[0].id, start: '2026-11-05' });
 assert.deepEqual(result.changes.map(c => c.after), ['2026-11-05','2026-11-07','2026-11-10','2026-11-12','2026-11-14','2026-11-17']);
 assert.equal(result.schedule.appointments.length, 6);
 assert.equal(before.exceptions && Object.keys(before.exceptions).length, 0);
 const again = run(result.schedule, block, { ...options, action: 'move', slotId: block.sessions[0].id, start: '2026-11-05' });
 assert.equal(again.schedule.appointments.length, 6);
});
test('frequency can change without changing block workouts or progress', () => {
 const block = make(), original = structuredClone(block);
 const result = run(emptySchedule(), block, { ...options, weekdays: [2,4] });
 assert.deepEqual(result.changes.map(c => c.after), ['2026-11-03','2026-11-05','2026-11-10','2026-11-12','2026-11-17','2026-11-19']);
 assert.deepEqual(block, original); assert.deepEqual(normalizeSchedule(result.schedule).blockWeekdays?.[block.id], [2,4]);
});
test('clear unlinks only selected future dates and preserves history, block, and unrelated rest', () => {
 const block = make(), before = run(emptySchedule(), block).schedule;
 before.appointments.push({ id: 'rest', date: '2026-11-05', kind: 'rest' });
 before.exceptions[`${before.appointments[0].id}@2026-11-03`] = { status: 'completed' };
 block.sessions[0].status = 'completed';
 const result = run(before, block, { ...options, action: 'clear' });
 assert.equal(result.appointmentCount, 5); assert.deepEqual(result.schedule.completions, before.completions);
 assert.equal(occurrences(result.schedule,'2026-11-03','2026-12-01').length, 2);
 assert.equal(block.sessions[1].status, 'planned');
 const rebuilt = run(result.schedule, block); assert.equal(rebuilt.changes.length, 5);
});
test('missed sessions are offered for catch-up and in-progress sessions are protected', () => {
 const block = make(), before = run(emptySchedule(), block).schedule;
 before.exceptions[`${before.appointments[0].id}@2026-11-03`] = { date: '2026-11-01' };
 assert.equal(run(before,block,{...options,includeMissed:false}).changes.length,5);
 assert.equal(run(before,block).changes.length,6);
 assert.equal(run(before,block,options,{ blockId:block.id,blockSessionId:block.sessions[1].id } as WorkoutSession).changes.length,5);
});
test('conflicts require a choice, can be avoided, or explicitly retained', () => {
 const block=make(), schedule=emptySchedule(); schedule.appointments.push({id:'rest',date:'2026-11-03',kind:'rest'});
 assert.equal(run(schedule,block).conflicts.length,1);
 const avoided=run(schedule,block,{...options,conflictPolicy:'avoid'}); assert.equal(avoided.changes[0].after,'2026-11-05'); assert.equal(avoided.conflicts.length,0);
 assert.equal(run(schedule,block,{...options,conflictPolicy:'keep'}).changes[0].after,'2026-11-03');
 assert.throws(()=>run(schedule,block,{...options,weekdays:[]}),/at least one/);
});
test('single-session moves preserve other appointments and completed sessions are excluded', () => {
 const block=make(), before=run(emptySchedule(),block).schedule;
 const result=run(before,block,{...options,action:'move',scope:'one',slotId:block.sessions[2].id,start:'2026-11-06'});
 assert.equal(result.changes.length,1); assert.equal(result.changes[0].after,'2026-11-06');
 assert.equal(occurrences(result.schedule,'2026-11-03','2026-11-03').length,1);
 block.sessions[0].status='skipped'; assert.equal(run(before,block).changes.length,5);
});

test('weekday preferences round trip in backups and malformed patterns are rejected', () => {
 const block=make(), schedule=run(emptySchedule(),block).schedule;
 assert.deepEqual(validateBackup({ ironflow_schedule: schedule }).ironflow_schedule.blockWeekdays, schedule.blockWeekdays);
 assert.throws(()=>validateBackup({ ironflow_schedule: { ...schedule, blockWeekdays: { [block.id]: [8] } } }), /block training days/);
});
