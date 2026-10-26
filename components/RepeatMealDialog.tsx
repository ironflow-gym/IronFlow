import React, { useId, useRef, useState } from 'react';
import { FuelLog } from '../types';
import { MealFood, repeatMeal } from '../src/meals';
import { localDate } from '../src/scheduling';
import Modal, { dialogField, dialogPrimaryButton } from './ui/Modal';
import MealFoodRow, { mealPreview, MealTotal } from './MealFoodRow';

export default function RepeatMealDialog({ name, foods, onClose, onAdd }: {
  name: string; foods: MealFood[]; onClose: () => void; onAdd: (logs: FuelLog[]) => void;
}) {
  const formId = useId();
  const [date, setDate] = useState(() => localDate(new Date()));
  const [quantities, setQuantities] = useState(() => foods.map(() => '1'));
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const preview = mealPreview(foods, quantities);
  return <Modal label="Log meal" title="Log meal" closeLabel="Cancel logging meal" onClose={onClose}
    footer={<>{error && <p ref={errorRef} tabIndex={-1} role="alert" className="w-full text-sm text-rose-300 outline-none">{error}</p>}
      <MealTotal foods={preview} /><button type="submit" form={formId} className={dialogPrimaryButton}>Add to food log</button></>}>
    <form id={formId} noValidate className="space-y-4" onSubmit={event => {
      event.preventDefault();
      try {
        const logs = repeatMeal(foods, quantities.map(Number), date, () => crypto.randomUUID());
        onAdd(logs); onClose();
      } catch (e) { setError((e as Error).message); requestAnimationFrame(() => errorRef.current?.focus()); }
    }}>
      <p className="break-words text-lg font-bold">{name}</p>
      <label className="block">Date<input type="date" required value={date} onChange={e => { setDate(e.target.value); setError(''); }} className={`${dialogField} [color-scheme:dark]`} /></label>
      <p className="text-sm text-slate-300">Amounts start at 1× the recorded food. Expand a food to use half, double, or your own multiplier. Estimates remain estimates.</p>
      {foods.map((food, i) => <MealFoodRow key={i} food={food} quantity={quantities[i]} onQuantity={value => {
        setQuantities(values => values.map((current, index) => index === i ? value : current)); setError('');
      }} />)}
    </form>
  </Modal>;
}
