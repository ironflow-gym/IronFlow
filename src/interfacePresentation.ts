import type { WorkoutSession } from '../types';
import { formatWeight } from './equipment';

/** Calendar dates are rendered locally, never parsed as UTC midnight. */
export function displayDate(value: string, includeYear = true): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', ...(includeYear ? { year: 'numeric' as const } : {}) }).format(new Date(year, month - 1, day, 12));
}

/** Summarize the applied result, rather than repeating intermediate per-set steps. */
export function summarizeAdaptation(before: WorkoutSession, after: WorkoutSession) {
  return after.exercises.flatMap(exercise => {
    const original = before.exercises.find(item => item.id === exercise.id);
    if (!original) return [];
    const removed = original.sets.filter(set => !exercise.sets.some(item => item.id === set.id)).length;
    const loads = new Map<string, { count: number; text: string }>();
    for (const set of exercise.sets) {
      const previous = original.sets.find(item => item.id === set.id);
      if (!previous || previous.weight === set.weight && previous.reps === set.reps) continue;
      const text = `${formatWeight(previous.weight)} → ${formatWeight(set.weight)} ${set.unit === 'kgs' ? 'kg' : 'lb'} × ${set.reps}`;
      const key = `${text}:${!!set.isWarmup}:${!!set.isDeload}`;
      const existing = loads.get(key);
      loads.set(key, { text, count: (existing?.count ?? 0) + 1 });
    }
    const replacement = original.name !== exercise.name;
    if (!removed && !loads.size && !replacement) return [];
    return [{ id: exercise.id, name: exercise.name, previousName: replacement ? original.name : undefined, removed, loads: [...loads.values()] }];
  });
}
