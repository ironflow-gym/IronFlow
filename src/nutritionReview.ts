import type { FuelLog } from '../types';
import { addDays } from './scheduling';
import { validFoodDate } from './food';
export function nutritionReviewDays(history: FuelLog[], today: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    const logs = history.filter(log => validFoodDate(log.date) && log.date === date);
    return { date, calories: logs.length ? logs.reduce((sum, log) => sum + log.calories, 0) : null, count: logs.length };
  });
}
