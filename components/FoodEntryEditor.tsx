import FoodFormModal from './ui/FoodFormModal';
import FoodSaveFeedback from './ui/FoodSaveFeedback';
import { FoodFieldError, foodNumber, useFoodValidation } from '../hooks/useFoodValidation';
import React, { useId, useRef, useState } from 'react';
import { FuelLog } from '../types';
import { nutrients, validFoodDate } from '../src/food';
import { localDate } from '../src/scheduling';
import { dialogField, dialogPrimaryButton } from './ui/Modal';
export default function FoodEntryEditor({ entry, onClose, onSave }: {
  entry?: FuelLog; onClose: () => void; onSave: (entry: FuelLog) => void;
}) {
  const formId = useId();
  const [name, setName] = useState(entry?.name ?? '');
  const [date, setDate] = useState(entry?.date ?? localDate());
  const [amount, setAmount] = useState(entry?.servingDescription ?? '');
  const [values, setValues] = useState(() => Object.fromEntries(nutrients.map(key => [key, entry ? String(entry[key]) : ''])) as Record<typeof nutrients[number], string>);
  const validation = useFoodValidation(formId);
  const originalDraft = useRef(JSON.stringify({ name, date, amount, values }));
  const dirty = JSON.stringify({ name, date, amount, values }) !== originalDraft.current;
  return <FoodFormModal dirty={dirty} label={entry ? 'Edit food entry' : 'Log food manually'} title={entry ? 'Edit food entry' : 'Log food manually'} closeLabel="Cancel food entry" onClose={onClose}
    footer={<><FoodSaveFeedback />{validation.error && <p id={validation.errorId(validation.error.field)} role="alert" className="w-full text-sm text-rose-300">{validation.error.message}</p>}<button className={dialogPrimaryButton} type="submit" form={formId}>{entry ? 'Save changes' : 'Add to food log'}</button></>}>
    <form noValidate id={formId} className="space-y-4" onChange={validation.clear} onSubmit={event => {
      event.preventDefault();
      try {
        if (!name.trim()) throw new FoodFieldError('name', 'Enter a food name.');
        if (!validFoodDate(date)) throw new FoodFieldError('date', 'Choose a valid calendar date.');
        const macros = Object.fromEntries(nutrients.map(key => [key, foodNumber(values[key], key, key)])) as Pick<FuelLog, typeof nutrients[number]>;
        const changedNutrition = !entry || nutrients.some(key => macros[key] !== entry[key]);
        onSave({ ...entry, id: entry?.id ?? crypto.randomUUID(), name: name.trim(), date, ...macros,
          servingDescription: amount.trim() || undefined, confidence: changedNutrition ? 1 : entry.confidence,
          nutritionSource: changedNutrition ? 'manual' : entry.nutritionSource });
        onClose();
      } catch (e) { validation.fail(e); }
    }}>
      <label className="block">Food name<input {...validation.attributes('name')} className={dialogField} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block">Date<input {...validation.attributes('date')} type="date" className={`${dialogField} [color-scheme:dark]`} value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="block">Amount eaten (optional)<input className={dialogField} placeholder="For example, 30g or 1 bowl" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <p className="text-sm text-slate-300">Enter totals for the amount eaten. These values will be recorded as entered, without AI.</p>
      <div className="grid grid-cols-2 gap-3">{nutrients.map(key => <label key={key} className="block capitalize">{key === 'calories' ? 'Calories (kcal)' : `${key[0].toUpperCase()}${key.slice(1)} (g)`}<input {...validation.attributes(key)} type="number" min="0" step="any" inputMode="decimal" className={dialogField} value={values[key]} onChange={e => setValues(current => ({ ...current, [key]: e.target.value }))} /></label>)}</div>
    </form>
  </FoodFormModal>;
}
