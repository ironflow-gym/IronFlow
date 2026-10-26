import FoodSaveFeedback from './ui/FoodSaveFeedback';
import { FoodFieldError, useFoodValidation } from '../hooks/useFoodValidation';
import { validFoodDate } from '../src/food';
import FoodFormModal from './ui/FoodFormModal';
import React, { useId, useRef, useState } from 'react';
import { FuelLog } from '../types';
import { MealFood, repeatMeal, scaleMealFood } from '../src/meals';
import { localDate } from '../src/scheduling';
import { dialogField, dialogPrimaryButton } from './ui/Modal';
import MealFoodRow, { mealPreview, MealTotal } from './MealFoodRow';

export default function RepeatMealDialog({ name, foods, onClose, onAdd }: {
  name: string; foods: MealFood[]; onClose: () => void; onAdd: (logs: FuelLog[]) => void;
}) {
  const formId = useId();
  const [date, setDate] = useState(() => localDate(new Date()));
  const [quantities, setQuantities] = useState(() => foods.map(() => '1'));
  const validation = useFoodValidation(formId);
  const preview = mealPreview(foods, quantities);
  const originalDraft = useRef(JSON.stringify({ date, quantities }));
  const dirty = JSON.stringify({ date, quantities }) !== originalDraft.current;
  return <FoodFormModal dirty={dirty} label="Log meal" title="Log meal" closeLabel="Cancel logging meal" onClose={onClose}
    footer={<><FoodSaveFeedback />{validation.error && <p id={validation.errorId(validation.error.field)} role="alert" className="w-full text-sm text-rose-300">{validation.error.message}</p>}
      <MealTotal foods={preview} /><button type="submit" form={formId} className={dialogPrimaryButton}>Add to food log</button></>}>
    <form id={formId} noValidate className="space-y-4" onChange={validation.clear} onSubmit={event => {
      event.preventDefault();
      try {
        if (!validFoodDate(date)) throw new FoodFieldError('date', 'Choose a valid calendar date.');
        foods.forEach((food, index) => { try { scaleMealFood(food, Number(quantities[index])); } catch (e) { throw new FoodFieldError(`amount-${index}`, `${food.name}: ${(e as Error).message}`); } });
        const logs = repeatMeal(foods, quantities.map(Number), date, () => crypto.randomUUID());
        onAdd(logs); onClose();
      } catch (e) { validation.fail(e); }
    }}>
      <p className="break-words text-lg font-bold">{name}</p>
      <label className="block">Date<input {...validation.attributes('date')} type="date" required value={date} onChange={e => { setDate(e.target.value); validation.clear(); }} className={`${dialogField} [color-scheme:dark]`} /></label>
      <p className="text-sm text-slate-300">Amounts start at 1× the recorded food. Expand a food to use half, double, or your own multiplier. Estimates remain estimates.</p>
      {foods.map((food, i) => <MealFoodRow key={i} inputAttributes={validation.attributes(`amount-${i}`)} food={food} quantity={quantities[i]} onQuantity={value => {
        setQuantities(values => values.map((current, index) => index === i ? value : current)); validation.clear();
      }} />)}
    </form>
  </FoodFormModal>;
}
