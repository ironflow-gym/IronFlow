import InfoButton from './ui/InfoButton';
import FoodFormModal from './ui/FoodFormModal';
import React, { useId, useRef, useState } from 'react';
import { FoodItem } from '../types';
import { basisLabel, FoodBasis, nutrients } from '../src/food';
import { FoodFieldError, foodNumber, useFoodValidation } from '../hooks/useFoodValidation';
import FoodSaveFeedback from './ui/FoodSaveFeedback';
import { dialogField, dialogPrimaryButton } from './ui/Modal';
export default function FoodDefinitionEditor({ item, onClose, onSave, purpose = 'pantry' }: {
  item: FoodItem; purpose?: 'pantry' | 'barcode'; onClose: () => void; onSave: (food: FoodItem) => void;
}) {
  const formId = useId();
  const [name, setName] = useState(item.name);
  const [brand, setBrand] = useState(item.brand ?? '');
  const [barcode, setBarcode] = useState(item.barcode ?? '');
  const [basis, setBasis] = useState<FoodBasis | ''>(item.nutritionBasis ?? '');
  const [serving, setServing] = useState(item.servingSize);
  const [values, setValues] = useState(() => Object.fromEntries(nutrients.map(key => [key, item.missingNutrients?.includes(key) ? '' : String(item[key])])) as Record<typeof nutrients[number], string>);
  const validation = useFoodValidation(formId);
  const title = purpose === 'barcode' ? 'Review product details' : item.name ? 'Edit pantry food' : 'Add pantry food';
  const originalDraft = useRef(JSON.stringify({ name, brand, barcode, basis, serving, values }));
  const dirty = JSON.stringify({ name, brand, barcode, basis, serving, values }) !== originalDraft.current;
  return <FoodFormModal dirty={dirty} label={title} title={title} closeLabel={purpose === 'barcode' ? 'Cancel product review' : 'Cancel pantry food changes'} onClose={onClose}
    footer={<><FoodSaveFeedback />{validation.error && <p id={validation.errorId(validation.error.field)} role="alert" className="w-full text-sm text-rose-300">{validation.error.message}</p>}<button className={dialogPrimaryButton} form={formId} type="submit">{purpose === 'barcode' ? 'Continue to amount' : 'Save pantry food'}</button></>}>
    <form id={formId} noValidate className="space-y-4" onChange={validation.clear} onSubmit={event => {
      event.preventDefault();
      try {
        if (!name.trim()) throw new FoodFieldError('name', 'Enter a food name.');
        if (!basis) throw new FoodFieldError('basis', 'Choose what the values on your label describe.');
        if (barcode.trim() && !/^\d{8,14}$/.test(barcode.trim())) throw new FoodFieldError('barcode', 'Enter an 8–14 digit barcode or leave it blank.');
        const macros = Object.fromEntries(nutrients.map(key => [key, foodNumber(values[key], key, key)])) as Pick<FoodItem, typeof nutrients[number]>;
        const changedNutrition = nutrients.some(key => macros[key] !== item[key]) || !!item.missingNutrients?.length;
        onSave({ ...item, name: name.trim(), brand: brand.trim() || undefined, barcode: barcode.trim() || undefined, servingSize: serving.trim(), nutritionBasis: basis, ...macros, missingNutrients: [], nutritionSource: changedNutrition ? 'manual' : item.nutritionSource ?? 'manual' });
        onClose();
      } catch (e) { validation.fail(e); }
    }}>
      {purpose === 'barcode' && <p className="text-sm text-slate-300">Check these values, then continue to the amount eaten. You can choose whether to save this product to the pantry on the next screen.</p>}
      {!item.nutritionBasis && !!item.name && <p className="rounded-xl border border-amber-500/50 p-3 text-sm text-amber-200">Choose whether these stored values are per 100g, per 100ml, or per serving. Check the product label before continuing. Existing food logs will be kept.</p>}
      {!!item.missingNutrients?.length && !!item.name && <p className="text-sm text-amber-200">Missing values are blank. Check the label; a blank value does not mean zero.</p>}
      <label className="block">Food name<input {...validation.attributes('name')} className={dialogField} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block">Brand (optional)<input className={dialogField} value={brand} onChange={e => setBrand(e.target.value)} /></label>
      <label className="block">Values on the label<select {...validation.attributes('basis')} className={dialogField} value={basis} onChange={e => setBasis(e.target.value as FoodBasis | '')}><option value="">Choose from the label</option>{(['100g', '100ml', 'serving'] as const).map(value => <option key={value} value={value}>{basisLabel(value)}</option>)}</select></label>
      <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-300">Values: {basis ? basisLabel(basis) : 'choose a basis'}. Changing basis does not convert numbers. Blank = unknown; 0 = confirmed zero.</p><InfoButton topic="portions" /></div>
      <div className="grid grid-cols-2 gap-3">{nutrients.map(key => <label key={key} className="block capitalize">{key === 'calories' ? 'Calories (kcal)' : `${key[0].toUpperCase()}${key.slice(1)} (g)`}<input {...validation.attributes(key)} type="number" min="0" step="any" inputMode="decimal" className={dialogField} value={values[key]} onChange={e => setValues(current => ({ ...current, [key]: e.target.value }))} /></label>)}</div>
      <label className="block">Serving description (optional)<input className={dialogField} value={serving} onChange={e => setServing(e.target.value)} placeholder="For example, 1 bar (30g)" /></label>
      <label className="block">Barcode (optional)<input {...validation.attributes('barcode')} className={dialogField} inputMode="numeric" value={barcode} onChange={e => setBarcode(e.target.value)} /></label>
    </form>
  </FoodFormModal>;
}
