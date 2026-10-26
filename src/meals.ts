import { FuelLog, SavedMeal } from '../types';

export type MealFood = Pick<FuelLog, 'name' | 'calories' | 'protein' | 'carbs' | 'fats' | 'confidence' | 'pantryItemId'>;
export const macroKeys = ['calories', 'protein', 'carbs', 'fats'] as const;

export function saveMeal(id: string, name: string, foods: MealFood[]): SavedMeal {
  if (!name.trim()) throw new Error('Enter a meal name.');
  if (!foods.length) throw new Error('Choose at least one food.');
  return { id, name: name.trim(), foods: foods.map(mealFood) };
}

/** Copy the recorded nutrition, never reinterpret it through AI or live pantry data. */
export function mealFood(log: MealFood): MealFood {
  if (!log.name.trim() || macroKeys.some(key => !Number.isFinite(log[key]) || log[key] < 0)) {
    throw new Error('This food needs a name and valid, non-negative nutrition values.');
  }
  return { name: log.name.trim(), calories: log.calories, protein: log.protein, carbs: log.carbs,
    fats: log.fats, confidence: log.confidence, ...(log.pantryItemId ? { pantryItemId: log.pantryItemId } : {}) };
}

export function scaleMealFood(food: MealFood, quantity: number): MealFood {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) throw new Error('Enter a quantity above 0 and no greater than 1,000.');
  const result = mealFood(food);
  for (const key of macroKeys) {
    const scaled = result[key] * quantity;
    if (!Number.isFinite(scaled)) throw new Error('Nutrition totals are too large.');
    result[key] = Math.round((scaled + Number.EPSILON) * 100) / 100;
  }
  return result;
}

export function repeatMeal(foods: MealFood[], quantities: number[], date: string, id: () => string): FuelLog[] {
  const parsed = new Date(`${date}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) ||
    `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` !== date) {
    throw new Error('Choose a valid calendar date.');
  }
  if (!foods.length || foods.length !== quantities.length) throw new Error('Choose at least one food.');
  return foods.map((food, index) => ({ ...scaleMealFood(food, quantities[index]), id: id(), date }));
}
