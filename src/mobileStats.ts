import type { BiometricEntry, HistoricalLog } from '../types';
import type { DeloadRecommendation } from './utils';
import { isAssisted, isTimedExercise } from './utils';
import { addDays, localDate, weekStart } from './scheduling';
import { validFoodDate } from './food';
import { recordedSessionKey } from './sessionIdentity';
export { recordedSessionKey } from './sessionIdentity';
const kg = (value: number, unit: string) => value * (/^lb/i.test(unit) ? 0.45359237 : 1);
/** IDs identify sessions. Legacy rows are conservatively one group per date. */
export function recordedSessions(history: HistoricalLog[], today = localDate()) {
  const sessions = new Map<string, { id: string; date: string }>();
  for (const row of history) {
    if (!validFoodDate(row.date) || row.date > today) continue;
    const id = recordedSessionKey(row), previous = sessions.get(id);
    if (!previous || row.date < previous.date) sessions.set(id, { id, date: row.date });
  }
  return [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function recentTraining(history: HistoricalLog[], goal: number, today = localDate()) {
  const from = addDays(today, -27), sessions = recordedSessions(history, today);
  const weeks: { start: string; end: string; count: number; partial: boolean; current: boolean }[] = [];
  for (let monday = weekStart(from); monday <= today; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6), start = monday < from ? from : monday, end = sunday > today ? today : sunday;
    weeks.push({ start, end, count: sessions.filter(s => s.date >= start && s.date <= end).length, partial: start !== monday || end !== sunday, current: monday === weekStart(today) });
  }
  const groups = new Map<string, HistoricalLog[]>();
  for (const row of history) {
    if (row.date < from || row.date > today || !validFoodDate(row.date) || row.isWarmup || row.isDeload || isTimedExercise(row) || isAssisted(row.exercise) || !(row.weight > 0 && row.reps > 0)) continue;
    if (!row.templateId && !row.templateName) continue; // Routine identity cannot be established.
    const context = row.templateId ? `id:${row.templateId}` : `name:${row.templateName ?? ''}`;
    const key = JSON.stringify([row.exercise.toLowerCase(), row.category.toLowerCase(), context, row.reps]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const improvements = [...groups.values()].flatMap(rows => {
    const bySession = new Map<string, { date: string; time: number; weight: number; name: string; reps: number }>();
    for (const row of rows) {
      const id = recordedSessionKey(row), weight = kg(row.weight, row.unit), previous = bySession.get(id);
      if (!previous || weight > previous.weight) bySession.set(id, { date: row.date, time: row.completedAt ?? 0, weight, name: row.exercise, reps: row.reps });
    }
    const entries = [...bySession.values()].sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time);
    if (entries.length < 2) return [];
    const first = entries[0], last = entries.at(-1)!;
    if (last.weight <= first.weight + 1e-5 || (last.date === first.date && last.time <= first.time)) return [];
    return [{ name: last.name, reps: last.reps, first: first.weight, last: last.weight, from: first.date, to: last.date, percent: (last.weight / first.weight - 1) * 100 }];
  }).sort((a, b) => b.percent - a.percent);
  const unique = improvements.filter((row, index) => improvements.findIndex(other => other.name.toLowerCase() === row.name.toLowerCase()) === index).slice(0, 2);
  return { from, to: today, count: sessions.filter(s => s.date >= from).length, goal, weeks, improvements: unique, total: sessions.length };
}
const dayDistance = (from: string, to: string) => {
  const parse = (date: string) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((parse(to) - parse(from)) / 86400000);
};
export function recoveryContext(history: HistoricalLog[], recommendation: DeloadRecommendation | null, today = localDate()) {
  const date = history.filter(h => h.isDeload && validFoodDate(h.date) && h.date <= today).map(h => h.date).sort().at(-1);
  if (date) {
    const days = dayDistance(date, today), weeks = Math.floor(days / 7);
    return { recorded: true, date, label: days === 0 ? 'Recorded lighter session today' : weeks > 0 ? `${weeks} ${weeks === 1 ? 'week' : 'weeks'} since your last recorded lighter session` : `${days} ${days === 1 ? 'day' : 'days'} since your last recorded lighter session` };
  }
  return { recorded: false, date: undefined, label: recommendation ? 'No explicitly recorded lighter session; recovery timing is estimated.' : 'Not enough recorded history for a recovery estimate.' };
}
/** One daily reading per date; no invented readings or interpolation over gaps. */
export function bodyWeightSummary(history: BiometricEntry[], today = localDate()) {
  const byDate = new Map<string, BiometricEntry>();
  for (const entry of history) if (validFoodDate(entry.date) && entry.date <= today && Number.isFinite(entry.weight) && entry.weight > 0) byDate.set(entry.date, entry);
  const entries = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const average = (end: string) => {
    const rows = entries.filter(row => row.date >= addDays(end, -6) && row.date <= end);
    return rows.length >= 3 ? { weight: rows.reduce((sum, row) => sum + kg(row.weight, row.unit), 0) / rows.length, count: rows.length } : null;
  };
  const current = average(today), previous = average(addDays(today, -7));
  const recent = entries.filter(row => row.date >= addDays(today, -27));
  const pair = recent.length >= 2 ? [recent[0], recent.at(-1)!] : entries.slice(-2);
  const waists = entries.filter(row => Number.isFinite(row.waist) && row.waist! > 0);
  const recentWaists = waists.filter(row => row.date >= addDays(today, -27));
  const waistPair = recentWaists.length >= 2 ? [recentWaists[0], recentWaists.at(-1)!] : waists.slice(-2);
  return { latest: entries.at(-1), daysSinceLatest: entries.length ? dayDistance(entries.at(-1)!.date, today) : null, current, previous,
    recordedChange: pair.length === 2 ? { from: pair[0].date, to: pair[1].date, change: kg(pair[1].weight, pair[1].unit) - kg(pair[0].weight, pair[0].unit) } : null,
    waistChange: waistPair.length === 2 ? { from: waistPair[0].date, to: waistPair[1].date, change: waistPair[1].waist! - waistPair[0].waist! } : null,
    points: Array.from({ length: 28 }, (_, index) => { const date = addDays(today, index - 27), row = byDate.get(date); return { date, recorded: row ? kg(row.weight, row.unit) : null, average: average(date)?.weight ?? null }; }),
  };
}
