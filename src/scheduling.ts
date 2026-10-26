import type { HistoricalLog, TrainingAppointment, TrainingCompletion, TrainingOccurrence, TrainingSchedule, WorkoutTemplate } from '../types';
import { getUpNextTemplateId } from './utils';

export const emptySchedule = (): TrainingSchedule => ({ appointments: [], exceptions: {}, completions: [] });
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days, 12));
}
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return addDays(date, -((new Date(y, m - 1, d, 12).getDay() + 6) % 7));
}
export function normalizeSchedule(value?: Partial<TrainingSchedule> | null): TrainingSchedule {
  return { appointments: value?.appointments ?? [], exceptions: value?.exceptions ?? {}, completions: value?.completions ?? [] };
}
export const occurrenceId = (appointment: TrainingAppointment, date: string) => `${appointment.id}@${date}`;

/** Expand only the requested window, plus moved exceptions originating outside it. */
export function occurrences(schedule: TrainingSchedule, from: string, to: string): TrainingOccurrence[] {
  const result: TrainingOccurrence[] = [];
  for (const appointment of schedule.appointments) {
    const dates = new Set<string>();
    if (appointment.repeat === 'weekly') {
      // Calendar arithmetic avoids DST and UTC date shifts.
      const [y, m, d] = appointment.date.split('-').map(Number);
      const [fy, fm, fd] = from.split('-').map(Number);
      const distance = Math.floor((Date.UTC(fy, fm - 1, fd) - Date.UTC(y, m - 1, d)) / 86400000);
      let date = addDays(appointment.date, Math.max(0, Math.floor(distance / 7)) * 7);
      for (; date <= to && (!appointment.until || date <= appointment.until); date = addDays(date, 7)) dates.add(date);
    } else dates.add(appointment.date);
    const prefix = `${appointment.id}@`;
    for (const key of Object.keys(schedule.exceptions)) {
      if (key.startsWith(prefix)) dates.add(key.slice(prefix.length));
    }
    for (const originalDate of dates) {
      if (originalDate < appointment.date || (appointment.until && originalDate > appointment.until && schedule.exceptions[occurrenceId(appointment, originalDate)]?.status !== 'completed')) continue;
      const id = occurrenceId(appointment, originalDate);
      const exception = schedule.exceptions[id];
      const date = exception?.date ?? originalDate;
      if (date < from || date > to || exception?.status === 'removed') continue;
      result.push({ ...appointment, ...exception, date, originalDate, occurrenceId: id, status: exception?.status ?? 'planned' });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.occurrenceId.localeCompare(b.occurrenceId));
}

/** Include appointments moved earlier than their original series start. */
export function missedAppointments(schedule: TrainingSchedule, today: string, activeAppointmentId?: string): TrainingOccurrence[] {
  const earliest = [...schedule.appointments.map(a => a.date), ...Object.values(schedule.exceptions).flatMap(e => e.date ? [e.date] : [])]
    .reduce((date, candidate) => candidate < date ? candidate : date, today);
  return occurrences(schedule, earliest, addDays(today, -1)).filter(item => item.kind === 'workout' && item.status === 'planned' && item.occurrenceId !== activeAppointmentId);
}

export function editOccurrence(schedule: TrainingSchedule, item: TrainingOccurrence, patch: Partial<TrainingAppointment>, scope: 'one' | 'future', newId: string): TrainingSchedule {
  if (item.status === 'completed') return schedule;
  if (scope === 'one' || !item.repeat) {
    return { ...schedule, exceptions: { ...schedule.exceptions, [item.occurrenceId]: { ...schedule.exceptions[item.occurrenceId], ...patch } } };
  }
  // Split the series; past and completed occurrences retain their identities.
  const exceptions = { ...schedule.exceptions };
  for (const [key, value] of Object.entries(schedule.exceptions)) {
    const prefix = `${item.id}@`;
    if (!key.startsWith(prefix)) continue;
    const original = key.slice(prefix.length);
    if (original < item.originalDate) continue;
    const asUTC = (date: string) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    const shifted = addDays(patch.date ?? item.date, Math.round((asUTC(original) - asUTC(item.originalDate)) / 86400000));
    if (value.status === 'completed') exceptions[`${newId}@${shifted}`] = { status: 'removed' };
    else if (value.status === 'skipped' || value.status === 'removed') exceptions[`${newId}@${shifted}`] = { status: value.status };
  }
  return { ...schedule, exceptions, appointments: [
    ...schedule.appointments.map(a => a.id === item.id ? { ...a, until: addDays(item.originalDate, -1) } : a),
    { ...schedule.appointments.find(a => a.id === item.id)!, ...patch, id: newId, date: patch.date ?? item.date, until: undefined },
  ] };
}
export function dismissOccurrence(schedule: TrainingSchedule, item: TrainingOccurrence, status: 'skipped' | 'removed', scope: 'one' | 'future' = 'one'): TrainingSchedule {
  if (item.status === 'completed') return schedule;
  if (scope === 'future' && item.repeat) return { ...schedule, appointments: schedule.appointments.map(a => a.id === item.id ? { ...a, until: addDays(item.originalDate, -1) } : a) };
  return { ...schedule, exceptions: { ...schedule.exceptions, [item.occurrenceId]: { ...schedule.exceptions[item.occurrenceId], status } } };
}
export function completeAppointment(schedule: TrainingSchedule, completion: TrainingCompletion): TrainingSchedule {
  if (schedule.completions.some(c => c.sessionId === completion.sessionId)) return schedule;
  return { ...schedule, completions: [...schedule.completions, completion], exceptions: completion.appointmentId ? {
    ...schedule.exceptions,
    [completion.appointmentId]: { ...schedule.exceptions[completion.appointmentId], status: 'completed', sessionId: completion.sessionId },
  } : schedule.exceptions };
}
export function completedSessions(history: HistoricalLog[], schedule: TrainingSchedule): TrainingCompletion[] {
  const sessions = new Map(schedule.completions.map(c => [c.sessionId, c]));
  for (const log of history) {
    const id = log.sessionId ?? `legacy:${log.date}:${log.templateName ?? ''}`;
    if (!sessions.has(id)) sessions.set(id, { sessionId: id, date: log.date, name: log.templateName ?? 'Workout', templateId: log.templateId, appointmentId: log.appointmentId });
  }
  return [...sessions.values()];
}
export function todayPriority(templates: WorkoutTemplate[], history: HistoricalLog[], schedule: TrainingSchedule, date: string, hasActiveSession: boolean) {
  if (hasActiveSession) return { kind: 'resume' as const };
  const appointments = occurrences(schedule, date, date).filter(o => o.status === 'planned');
  const workout = appointments.find(o => o.kind === 'workout');
  if (workout) return { kind: 'scheduled' as const, appointment: workout, template: templates.find(t => t.id === workout.templateId) };
  if (appointments.some(o => o.kind === 'rest')) return { kind: 'rest' as const };
  const template = templates.find(t => t.id === getUpNextTemplateId(templates, history));
  return template ? { kind: 'rotation' as const, template } : { kind: 'choose' as const };
}
