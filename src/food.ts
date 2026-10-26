import { FoodItem, FuelLog } from '../types';
import { localDate } from './scheduling';
export const nutrients = ['calories', 'protein', 'carbs', 'fats'] as const;
export type Nutrient = typeof nutrients[number];
export type FoodBasis = '100g' | '100ml' | 'serving';
export const basisLabel = (basis?: FoodBasis) => basis === '100g' ? 'per 100g' : basis === '100ml' ? 'per 100ml' : basis === 'serving' ? 'per serving' : 'Check label values';
export const foodUnit = (basis?: FoodBasis) => basis === '100g' ? 'g' : basis === '100ml' ? 'ml' : 'servings';
export function nutritionNumber(value: string | number, label: string): number {
  if (String(value).trim() === '') throw new Error(`Enter ${label}; enter 0 only if the label says zero.`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000) throw new Error(`${label} must be a number from 0 to 100,000.`);
  return number;
}
export function validFoodDate(date: string): boolean {
  const parsed = new Date(`${date}T12:00:00`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsed.getTime()) && localDate(parsed) === date;
}
export function scaleFood(item: FoodItem, quantity: number): Pick<FuelLog, Nutrient> {
  if (!item.nutritionBasis) throw new Error('Confirm whether this food’s nutrition is per 100g, per 100ml, or per serving.');
  if (item.missingNutrients?.length) throw new Error('Complete the missing nutrition values before logging.');
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) throw new Error('Enter an amount above 0 and no greater than 100,000.');
  const factor = quantity / (item.nutritionBasis === 'serving' ? 1 : 100);
  return Object.fromEntries(nutrients.map(key => [key, Math.round(nutritionNumber(item[key], key) * factor * 100) / 100])) as Pick<FuelLog, Nutrient>;
}
export function logFood(item: FoodItem, quantity: number, date: string, id: string): FuelLog {
  if (!validFoodDate(date)) throw new Error('Choose a valid calendar date.');
  if (!item.name.trim()) throw new Error('Enter a food name.');
  return { id, date, name: item.name.trim(), ...scaleFood(item, quantity), pantryItemId: item.id,
    servingDescription: `${quantity} ${foodUnit(item.nutritionBasis)}`, nutritionSource: item.nutritionSource ?? 'manual',
    confidence: item.nutritionSource === 'ai' ? 0.5 : 1 };
}
export function loggedDayAverage(history: FuelLog[], today = localDate()) {
  const start = new Date(`${today}T12:00:00`); start.setDate(start.getDate() - 6);
  const from = localDate(start);
  const logs = history.filter(log => validFoodDate(log.date) && log.date >= from && log.date <= today);
  const days = new Set(logs.map(log => log.date)).size;
  const totals = Object.fromEntries(nutrients.map(key => [key, Math.round(logs.reduce((sum, log) => sum + log[key], 0) / (days || 1))])) as Pick<FuelLog, Nutrient>;
  return { from, through: today, days, totals };
}
