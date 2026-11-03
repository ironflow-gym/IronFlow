import { addDays, localDate, weekStart } from './scheduling';
export const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
export function shiftMonth(date: string, offset: number) {
  const [year, month] = date.split('-').map(Number);
  return localDate(new Date(year, month - 1 + offset, 1, 12));
}
/** Six Monday-first rows also expose workouts just outside the displayed month. */
export function monthCalendarDates(date: string) {
  const first = weekStart(monthStart(date));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}
export function calendarDateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
