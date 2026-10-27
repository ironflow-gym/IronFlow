import type { TrainingCompletion, TrainingOccurrence } from '../types';
export function calendarDayStatus(date: string, today: string, appointments: TrainingOccurrence[], sessions: TrainingCompletion[], activeAppointmentId?: string) {
  const items = appointments.filter(item => item.date === date);
  const planned = items.filter(item => item.kind === 'workout' && item.status === 'planned');
  const missed = planned.filter(item => date < today && item.occurrenceId !== activeAppointmentId).length;
  const scheduled = planned.length - missed;
  const completed = sessions.filter(session => session.date === date).length;
  const rest = items.some(item => item.kind === 'rest' && item.status === 'planned');
  const skipped = items.filter(item => item.kind === 'workout' && item.status === 'skipped').length;
  const inProgress = planned.some(item => item.occurrenceId === activeAppointmentId);
  const descriptions = [scheduled && `${scheduled} scheduled ${scheduled === 1 ? 'workout' : 'workouts'}`, completed && `${completed} completed ${completed === 1 ? 'workout' : 'workouts'}`, missed && `${missed} missed ${missed === 1 ? 'workout' : 'workouts'}`, rest && 'Planned rest', skipped && `${skipped} skipped ${skipped === 1 ? 'workout' : 'workouts'}`, inProgress && 'Workout in progress'].filter(Boolean);
  return { scheduled, completed, missed, rest, label: descriptions.join(', ') || 'No appointments' };
}
