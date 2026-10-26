import React, { useState } from 'react';
import { MealFood, scaleMealFood } from '../src/meals';
import { dialogButton, dialogField } from './ui/Modal';

export function nutrition(food: MealFood): string {
  return `${food.calories} kcal · ${food.protein}g protein · ${food.carbs}g carbs · ${food.fats}g fat`;
}

export function mealPreview(foods: MealFood[], quantities: string[]): MealFood[] | null {
  try { return foods.map((food, i) => scaleMealFood(food, Number(quantities[i]))); }
  catch { return null; }
}

export function MealTotal({ foods }: { foods: MealFood[] | null }) {
  const calories = foods?.reduce((total, food) => total + food.calories, 0);
  return <p role="status" className="mr-auto text-sm font-bold text-slate-100">{calories === undefined ? 'Check food amounts' : `Total: ${Math.round(calories * 100) / 100} kcal`}</p>;
}

export default function MealFoodRow({ food, quantity, onQuantity, onRemove }: {
  food: MealFood; quantity: string; onQuantity: (value: string) => void; onRemove?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  let adjusted: MealFood | null = null;
  try { adjusted = scaleMealFood(food, Number(quantity)); } catch { /* Inline validation keeps the affected food visible. */ }
  return <div className="rounded-xl border border-slate-700 p-3">
    <p className="break-words font-bold">{food.name}</p>
    <p className="mt-1 text-sm text-slate-300">{adjusted ? nutrition(adjusted) : 'Enter a valid amount multiplier.'}</p>
    <details className="mt-2" open={expanded || !adjusted} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400">Adjust amount{Number(quantity) !== 1 ? ` (${quantity}×)` : ''}<span className="sr-only"> for {food.name}</span></summary>
      <div className="space-y-3 pt-2">
        <div role="group" aria-label={`Amount shortcuts for ${food.name}`} className="flex flex-wrap gap-2">
          {[['Half', '0.5'], ['Same', '1'], ['Double', '2']].map(([label, value]) => <button type="button" key={value} className={dialogButton} aria-pressed={quantity === value} onClick={() => onQuantity(value)}>{label}</button>)}
        </div>
        <label className="block text-sm">Amount multiplier for {food.name}<input className={dialogField} type="number" min="0.001" max="1000" step="any" inputMode="decimal" value={quantity} aria-invalid={!adjusted}
          onChange={e => onQuantity(e.target.value)} /></label>
        <details className="text-sm text-slate-300"><summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2 focus-visible:outline-emerald-400">Original recorded amount</summary><p>{nutrition(food)}</p></details>
        {onRemove && <button type="button" className={dialogButton} aria-label={`Remove ${food.name} from saved meal`} onClick={onRemove}>Remove food</button>}
      </div>
    </details>
  </div>;
}
