import InfoButton from './ui/InfoButton';
import FoodFormModal from './ui/FoodFormModal';
import FoodSaveFeedback from './ui/FoodSaveFeedback';
import { FoodFieldError, useFoodValidation } from '../hooks/useFoodValidation';
import React, { useId, useRef, useState } from 'react';
import { FoodItem, FuelLog } from '../types';
import { basisLabel, foodUnit, logFood, scaleFood, validFoodDate } from '../src/food';
import { localDate } from '../src/scheduling';
import { dialogField, dialogPrimaryButton } from './ui/Modal';
export default function FoodQuantityDialog({ item, onClose, onLog, extra, dirtyExtra = false }: { item: FoodItem; onClose: () => void; onLog: (entry: FuelLog) => void; extra?: React.ReactNode; dirtyExtra?: boolean }) {
  const formId = useId();
  const [date, setDate] = useState(localDate());
  const [quantity, setQuantity] = useState(item.nutritionBasis === 'serving' ? '1' : '100');
  const validation = useFoodValidation(formId);
  let preview: ReturnType<typeof scaleFood> | null = null;
  try { preview = scaleFood(item, Number(quantity)); } catch { /* Validate on submit. */ }
  const originalDraft = useRef(JSON.stringify({ date, quantity }));
  const dirty = JSON.stringify({ date, quantity }) !== originalDraft.current;
  return <FoodFormModal dirty={dirty || dirtyExtra} label="Log food" title="Log food" closeLabel="Cancel logging pantry food" onClose={onClose} footer={<><FoodSaveFeedback />{validation.error && <p id={validation.errorId(validation.error.field)} role="alert" className="w-full text-sm text-rose-300">{validation.error.message}</p>}<p role="status" className="mr-auto text-sm">{preview ? `${preview.calories} kcal` : 'Check the amount'}</p><button type="submit" form={formId} className={dialogPrimaryButton}>Add to food log</button></>}>
    <form id={formId} noValidate className="space-y-4" onChange={validation.clear} onSubmit={event => {
      event.preventDefault();
      try {
        if (!validFoodDate(date)) throw new FoodFieldError('date', 'Choose a valid calendar date.');
        try { scaleFood(item, Number(quantity)); } catch (e) { throw new FoodFieldError('amount', `${item.name}: ${(e as Error).message}`); }
        onLog(logFood(item, Number(quantity), date, crypto.randomUUID())); onClose();
      }
      catch (e) { validation.fail(e); }
    }}>
      <h3 className="break-words text-lg font-bold">{item.name}</h3><p className="text-sm text-slate-300">Recorded nutrition: {basisLabel(item.nutritionBasis)}.{item.servingSize ? ` Serving description: ${item.servingSize}.` : ''}</p>
      <label className="block">Date<input {...validation.attributes('date')} type="date" className={`${dialogField} [color-scheme:dark]`} value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="block">Amount ({foodUnit(item.nutritionBasis)})<input {...validation.attributes('amount')} type="number" min="0.001" step="any" inputMode="decimal" className={dialogField} value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
      {preview && <p className="text-sm text-slate-300">{preview.protein}g protein · {preview.carbs}g carbs · {preview.fats}g fat</p>}
      {extra}
      {item.nutritionBasis === 'serving' && <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-300">Amount is in recorded servings.</p><InfoButton topic="portions" /></div>}
    </form>
  </FoodFormModal>;
}
