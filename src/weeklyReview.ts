import type { HistoricalLog, TrainingSchedule } from '../types';
import { addDays, completedSessions, occurrences, weekStart } from './scheduling';
import { calcE1RM, isAssisted, isCardioCategory } from './utils';
import { KG_PER_LB } from './equipment';

export interface ReviewRecord { date: string; label: string; detail: string; sessionId?: string; appointmentId?: string; }
export interface WeeklyReviewFact { id: string; label: string; value: string; records: ReviewRecord[]; }

/** Factual calculations only. No network, model-generated numbers or inferred recovery state. */
export function buildWeeklyReview(history: HistoricalLog[], schedule: TrainingSchedule, selectedDate: string, today: string, goal: number) {
  const from = weekStart(selectedDate);
  const to = addDays(from, 6);
  const cutoff = today < to ? today : to;
  const previousFrom = addDays(from, -7);
  const previousTo = addDays(from, -1);
  const within = (date: string) => date >= from && date <= cutoff;
  const sessions = completedSessions(history, schedule).filter(s => within(s.date));
  const bookings = occurrences(schedule, from, to).filter(o => o.kind === 'workout');
  const fulfilled = bookings.filter(o => sessions.some(s => s.appointmentId === o.occurrenceId));
  const skipped = bookings.filter(o => o.status === 'skipped');
  const missed = bookings.filter(o => o.status === 'planned' && o.date < today && o.date <= to);
  const working = (log: HistoricalLog) => !log.isWarmup && !log.isDeload && !isCardioCategory(log.category);
  const logs = history.filter(h => within(h.date) && working(h));
  const previousLogs = history.filter(h => h.date >= previousFrom && h.date <= previousTo && working(h));
  const kg = (h: HistoricalLog) => h.unit === 'lbs' || h.unit === 'lb' ? h.weight * KG_PER_LB : h.weight;
  const volume = (items: HistoricalLog[]) => items.filter(h => !isAssisted(h.exercise)).reduce((total, h) => total + kg(h) * h.reps, 0);
  const tonnage = volume(logs);
  const previousTonnage = volume(previousLogs);
  const setRecord = (h: HistoricalLog): ReviewRecord => ({ date: h.date, label: h.exercise, detail: `${h.weight} ${h.unit} × ${h.reps}`, sessionId: h.sessionId, appointmentId: h.appointmentId });
  const appointmentRecord = (o: typeof bookings[number]): ReviewRecord => ({ date: o.date, label: 'Scheduled workout', detail: o.status, appointmentId: o.occurrenceId });
  const facts: WeeklyReviewFact[] = [
    { id: 'sessions', label: 'Completed sessions', value: `${sessions.length} / ${goal} weekly goal`, records: sessions.map(s => ({ date: s.date, label: s.name, detail: s.appointmentId ? 'Scheduled completion' : 'Unscheduled completion', sessionId: s.sessionId, appointmentId: s.appointmentId })) },
    { id: 'plan', label: 'Calendar appointments', value: `${bookings.length} planned · ${fulfilled.length} fulfilled in this week · ${skipped.length} skipped · ${missed.length} missed`, records: bookings.map(appointmentRecord) },
    { id: 'sets', label: 'Recorded working sets', value: `${logs.length} strength sets (warmups and deloads excluded)`, records: logs.map(setRecord) },
    { id: 'volume', label: 'Recorded training volume', value: `${Math.round(tonnage)} kg × reps${previousLogs.length ? ` · previous week ${Math.round(previousTonnage)} kg × reps` : ' · no previous-week comparison'}`, records: [...logs.filter(h => !isAssisted(h.exercise)), ...previousLogs.filter(h => !isAssisted(h.exercise))].map(setRecord) },
  ];
  const names = [...new Set(logs.map(h => h.exercise))];
  for (const name of names) {
    if (isAssisted(name)) continue;
    const current = logs.filter(h => h.exercise === name && h.weight > 0 && h.reps > 0);
    const previous = previousLogs.filter(h => h.exercise.toLowerCase() === name.toLowerCase() && h.weight > 0 && h.reps > 0);
    if (!current.length || !previous.length) continue;
    const best = (items: HistoricalLog[]) => Math.max(...items.map(h => calcE1RM(kg(h), h.reps)));
    facts.push({ id: `strength:${name}`, label: `${name}: best estimated 1RM`, value: `${Number(best(current).toFixed(1))} kg · previous week ${Number(best(previous).toFixed(1))} kg`, records: [...current, ...previous].map(setRecord) });
  }
  const suggestions: { text: string; factId: string }[] = [];
  if (missed.length) suggestions.push({ text: 'Review the missed appointments and explicitly reschedule or skip those you no longer intend to do. Nothing has been moved automatically.', factId: 'plan' });
  if (sessions.length < goal) suggestions.push({ text: 'If the weekly goal still suits your available time, use the calendar to plan the remaining sessions. A partial week is not a failed week.', factId: 'sessions' });
  if (logs.length && previousLogs.length && tonnage < previousTonnage) suggestions.push({ text: 'Recorded volume is lower than the previous week. Check whether this reflects a shorter week, planned lighter training or incomplete logging before changing the programme.', factId: 'volume' });
  if (!suggestions.length) suggestions.push({ text: 'Review your recorded sets and keep or adjust your plan based on your goals and available time. These records alone do not establish fatigue or recovery.', factId: 'sessions' });
  return { from, to, cutoff, facts, suggestions, summary: { completed: sessions.length, planned: bookings.length, fulfilled: fulfilled.length, skipped: skipped.length, missed: missed.length, volume: tonnage, previousVolume: previousLogs.length ? previousTonnage : null }, isPartial: cutoff < to, hasData: !!sessions.length || !!bookings.length || !!logs.length };
}
