import type { HistoricalLog } from '../types';
import { calcE1RM, isCardioCategory, isAssisted } from './utils';
export function strengthTrend(history: HistoricalLog[], exercise: string, imperial: boolean, today: string) {
  const byDate = new Map<string, number>();
  history.filter(h => h.exercise === exercise && h.date <= today && !h.isWarmup && h.tracking !== 'time' && !isCardioCategory(h.category) && !isAssisted(h.exercise) && h.weight > 0 && h.reps > 0).forEach(h => {
    const kg = h.weight * (/^lb/i.test(h.unit) ? 0.45359237 : 1);
    const value = calcE1RM(kg, h.reps) * (imperial ? 1 / 0.45359237 : 1);
    byDate.set(h.date, Math.max(value, byDate.get(h.date) ?? 0));
  });
  return [...byDate].sort(([a],[b]) => a.localeCompare(b)).map(([date,value]) => ({date,label:date.slice(5),e1rm:Math.round(value*10)/10}));
}
