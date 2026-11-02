import type { TrainingBlock, TrainingSchedule, WorkoutSession } from '../types';
import { addDays, localDate, occurrences } from './scheduling';
import { validFoodDate } from './food';

export interface BlockScheduleOptions {
  action: 'move' | 'rebuild' | 'clear'; start: string; weekdays: number[];
  slotId?: string; scope: 'one' | 'later'; includeMissed: boolean;
  conflictPolicy: 'review' | 'avoid' | 'keep';
}
export function blockDatesInCalendar(schedule: TrainingSchedule, blockId: string) {
  return schedule.appointments.flatMap(a => {
    const id = `${a.id}@${a.date}`, e = schedule.exceptions[id];
    if ((e?.blockId ?? a.blockId) !== blockId || e?.blockId === null) return [];
    return [{ ...a, ...e, occurrenceId: id, status: e?.status ?? 'planned' }];
  });
}
export function previewBlockSchedule(schedule: TrainingSchedule, block: TrainingBlock, options: BlockScheduleOptions, active: WorkoutSession | null, today = localDate()) {
  if (block.status !== 'active') throw new Error('Choose an active block.');
  if (!validFoodDate(options.start) || options.start < today) throw new Error('Choose today or a future date.');
  const days = [...new Set(options.weekdays)];
  if (options.action !== 'clear' && (!days.length || days.some(d => !Number.isInteger(d) || d < 0 || d > 6))) throw new Error('Choose at least one training day.');
  if (options.action === 'move' && !block.sessions.some(s => s.id === options.slotId)) throw new Error('Choose a workout to move.');
  const linked = blockDatesInCalendar(schedule, block.id);
  if (linked.some(a => a.repeat)) throw new Error('Recurring block appointments must be edited separately.');
  const eligible = block.sessions.filter(s => s.status === 'planned' && !(active?.blockId === block.id && active.blockSessionId === s.id)
    && !schedule.completions.some(c => c.blockId === block.id && c.blockSessionId === s.id && c.blockSessionFulfilled !== false)
    && !linked.some(a => a.blockSessionId === s.id && (a.occurrenceId === active?.appointmentId || a.status === 'completed' || a.status === 'skipped')));
  const anchor = block.sessions.findIndex(s => s.id === options.slotId);
  const selected = eligible.filter(s => {
    const existing = linked.filter(a => a.blockSessionId === s.id && a.status === 'planned');
    if (options.action === 'clear') return existing.some(a => a.date >= options.start);
    if (options.action === 'move' && (options.scope === 'one' ? s.id !== options.slotId : block.sessions.indexOf(s) < anchor)) return false;
    return options.includeMissed || !existing.length || existing.some(a => a.date >= today);
  });
  const selectedIds = new Set(selected.map(s => s.id));
  const affected = linked.filter(a => a.status === 'planned' && selectedIds.has(a.blockSessionId ?? '') && (options.action !== 'clear' || a.date >= options.start));
  const next = structuredClone(schedule);
  // Remove only selected calendar links. Block progress and completion history are never edited.
  affected.forEach(a => { next.exceptions[a.occurrenceId] = { ...next.exceptions[a.occurrenceId], status: 'removed' }; });
  let date = options.start;
  const conflicts: { date: string; name: string }[] = [];
  const changes = selected.map((slot, index) => {
    const old = affected.filter(a => a.blockSessionId === slot.id);
    if (options.action === 'clear') return { slotId: slot.id, name: `${slot.template.name} · Round ${slot.round}`, before: old.map(a => a.date), after: undefined as string | undefined };
    let attempts = 0;
    while (true) {
      if (++attempts > 36600) throw new Error('No available dates found. Choose another pattern.');
      // A manually moved first session uses the exact date; later sessions follow the pattern.
      if (!(options.action === 'move' && index === 0 && date === options.start) && !days.includes(new Date(`${date}T12:00:00`).getDay())) { date = addDays(date, 1); continue; }
      const overlap = occurrences(next, date, date).filter(a => a.status === 'planned');
      if (overlap.length && options.conflictPolicy === 'avoid') { date = addDays(date, 1); continue; }
      overlap.forEach(a => conflicts.push({ date, name: a.kind === 'rest' ? 'Planned rest' : 'Existing workout' }));
      break;
    }
    const after = date;
    const existing = old[0];
    if (existing) next.exceptions[existing.occurrenceId] = { ...next.exceptions[existing.occurrenceId], status: undefined, date: after };
    else next.appointments.push({ id: crypto.randomUUID(), date: after, kind: 'workout', templateId: slot.template.id, blockId: block.id, blockSessionId: slot.id });
    date = addDays(date, 1);
    return { slotId: slot.id, name: `${slot.template.name} · Round ${slot.round}`, before: old.map(a => a.date), after };
  });
  if (options.action !== 'clear') next.blockWeekdays = { ...next.blockWeekdays, [block.id]: days };
  return { schedule: next, changes, conflicts, appointmentCount: options.action === 'clear' ? affected.length : changes.length };
}
