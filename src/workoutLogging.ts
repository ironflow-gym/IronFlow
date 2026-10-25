import type { Exercise, HistoricalLog, SetLog } from '../types';

/** Compare working sets with working sets, and warmups/deloads with their own kind. */
export function previousSessionSet(
  history: HistoricalLog[], exercise: Exercise, index: number, unit: SetLog['unit'], beforeDate: string,
): (HistoricalLog & { displayWeight: number }) | null {
  const set = exercise.sets[index];
  const matchesKind = (entry: { isWarmup?: boolean; isDeload?: boolean }) =>
    !!entry.isWarmup === !!set.isWarmup && !!entry.isDeload === !!set.isDeload;
  const candidates = history.filter(log => log.exercise.toLowerCase() === exercise.name.toLowerCase()
    && log.date < beforeDate && matchesKind(log));
  const date = candidates.reduce((latest, log) => log.date > latest ? log.date : latest, '');
  const previous = candidates.filter(log => log.date === date)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
  const kindIndex = exercise.sets.slice(0, index).filter(matchesKind).length;
  const entry = previous[kindIndex];
  if (!entry) return null;
  const weightKg = entry.unit === 'lbs' ? entry.weight * 0.45359237 : entry.weight;
  const displayWeight = Math.round((unit === 'lbs' ? weightKg / 0.45359237 : weightKg) * 100) / 100;
  return { ...entry, displayWeight };
}

/** Copy values only. Never copy completion, timestamps, IDs or set classification. */
export function repeatPreviousSet(exercise: Exercise, index: number): Partial<SetLog> | null {
  const source = exercise.sets[index - 1];
  const target = exercise.sets[index];
  if (!source || !target || target.completed) return null;
  const weightKg = source.unit === 'lbs' ? source.weight * 0.45359237 : source.weight;
  return {
    weight: Math.round((target.unit === 'lbs' ? weightKg / 0.45359237 : weightKg) * 100) / 100,
    reps: source.reps,
  };
}
