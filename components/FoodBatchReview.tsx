import FoodFormModal from './ui/FoodFormModal';
import React, { useId, useRef, useState } from 'react';
import { FoodItem, FuelLog, FuelProfile } from '../types';
import { basisLabel, foodUnit, logFood, nutrients, scaleFood, validFoodDate } from '../src/food';
import { localDate } from '../src/scheduling';
import { sanitizeProfileUpdate } from '../src/nutritionTargets';
import { FoodFieldError, foodNumber, useFoodValidation } from '../hooks/useFoodValidation';
import FoodDefinitionEditor from './FoodDefinitionEditor';
import PantryChoiceDialog from './PantryChoiceDialog';
import FoodSaveFeedback from './ui/FoodSaveFeedback';
import Modal, { dialogButton, dialogField, dialogPrimaryButton } from './ui/Modal';
export default function FoodBatchReview({ logs, update, profile, pantry, onSavePantry, onClose, onConfirm }: {
  logs: FuelLog[]; update?: Partial<FuelProfile>; profile: FuelProfile; pantry: FoodItem[]; onSavePantry: (items: FoodItem[]) => void;
  onClose: () => void; onConfirm: (logs: FuelLog[], profile?: FuelProfile) => void;
}) {
  const formId = useId();
  const [date, setDate] = useState(localDate());
  const [rows, setRows] = useState(() => logs.map(log => ({ key: log.id, log, name: log.name, matchId: '', quantity: '1', values: Object.fromEntries(nutrients.map(key => [key, String(log[key])])) as Record<typeof nutrients[number], string> })));
  const [applyProfile, setApplyProfile] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const validation = useFoodValidation(formId);
  const restoreSource = useRef<HTMLElement | null>(null);
  const proposed = sanitizeProfileUpdate(profile, update);
  const rowMacros = (row: typeof rows[number]): Pick<FuelLog, typeof nutrients[number]> => {
    const match = pantry.find(item => item.id === row.matchId);
    if (row.matchId && !match) throw new FoodFieldError(`${row.key}-source`, `${row.log.name}: choose an available pantry food.`);
    if (match) {
      try { return scaleFood(match, Number(row.quantity)); }
      catch (e) { throw new FoodFieldError(`${row.key}-${!match.nutritionBasis || match.missingNutrients?.length ? 'source' : 'amount'}`, `${row.log.name}: ${(e as Error).message}`); }
    }
    return Object.fromEntries(nutrients.map(key => [key, foodNumber(row.values[key], `${row.key}-${key}`, `${key} for ${row.log.name}`)])) as Pick<FuelLog, typeof nutrients[number]>;
  };
  let total: number | null = 0;
  try { total = rows.reduce((sum, row) => sum + rowMacros(row).calories, 0); } catch { total = null; }
  const choose = (key: string, food: FoodItem) => { setRows(values => values.map(row => row.key === key ? { ...row, matchId: food.id, quantity: food.nutritionBasis === 'serving' ? '1' : '100' } : row)); validation.clear(); };
  return <><FoodFormModal dirty={rows.length > 0 || !!update} suspended={!!editingFood || !!choosing} label="Review food entries" title="Review food entries" closeLabel="Cancel food review" onClose={onClose}
    footer={<><FoodSaveFeedback />{validation.error && <p id={validation.errorId(validation.error.field)} role="alert" className="w-full text-sm text-rose-300">{validation.error.message}</p>}
      <p role="status" className="mr-auto text-sm font-bold">{total === null ? 'Check food details' : `Total: ${Math.round(total * 100) / 100} kcal`}</p><button className={dialogPrimaryButton} type="submit" form={formId}>{rows.length ? `Add ${rows.length} ${rows.length === 1 ? 'food' : 'foods'}` : 'Apply profile changes'}</button></>}>
    <form id={formId} noValidate className="space-y-4" onChange={validation.clear} onSubmit={event => {
      event.preventDefault();
      try {
        if (!validFoodDate(date)) throw new FoodFieldError('date', 'Choose a valid calendar date.');
        if (!rows.length && !(update && applyProfile)) throw new FoodFieldError('date', 'Keep at least one food or choose the profile update.');
        const confirmed = rows.map(row => {
          const macros = rowMacros(row);
          const match = pantry.find(item => item.id === row.matchId);
          if (match) return logFood(match, Number(row.quantity), date, row.log.id);
          if (!row.name.trim()) throw new FoodFieldError(`${row.key}-name`, `Enter a food name for ${row.log.name}.`);
          return { id: row.log.id, date, name: row.name.trim(), ...macros, confidence: Math.min(row.log.confidence, 0.8), nutritionSource: 'ai' as const };
        });
        onConfirm(confirmed, update && applyProfile ? proposed : undefined); onClose();
      } catch (e) { validation.fail(e); }
    }}>
      <p className="text-sm text-slate-300">Review the foods below. Expand a food to edit its values or use a pantry food. AI values are estimates.</p>
      <label className="block">Date<input {...validation.attributes('date')} type="date" className={`${dialogField} [color-scheme:dark]`} value={date} onChange={e => setDate(e.target.value)} /></label>
      {rows.map(row => {
        const match = pantry.find(item => item.id === row.matchId);
        const change = (values: Partial<typeof row>) => { setRows(current => current.map(item => item.key === row.key ? { ...item, ...values } : item)); validation.clear(); };
        let preview: ReturnType<typeof rowMacros> | null = null;
        try { preview = rowMacros(row); } catch { /* Mark and focus specific fields on submit. */ }
        const terms = row.log.name.toLowerCase().split(/\W+/).filter(term => term.length > 2);
        const suggestions = pantry.map(food => ({ food, score: terms.filter(term => food.name.toLowerCase().includes(term)).length })).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
        return <article key={row.key} className="rounded-xl border border-slate-700 p-3">
          <h3 className="break-words font-bold">{match?.name ?? row.name}</h3>
          <p className="mt-1 text-sm text-slate-300">{preview ? `${preview.calories} kcal · ${preview.protein}g protein · ${preview.carbs}g carbs · ${preview.fats}g fat` : 'Check food details before adding.'}</p>
          <p className="mt-1 text-sm text-slate-300">{match ? `Pantry · ${basisLabel(match.nutritionBasis)}` : 'AI estimate'}</p>
          <details className="mt-2" open={!!expanded[row.key]} onToggle={event => { const open = event.currentTarget.open; setExpanded(values => values[row.key] === open ? values : { ...values, [row.key]: open }); }}>
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400">Edit food<span className="sr-only"> for {row.log.name}</span></summary>
            <div className="space-y-3">
              <button {...validation.attributes(`${row.key}-source`)} type="button" className={dialogButton} aria-label={`Choose pantry food for ${row.log.name}`} onClick={() => setChoosing(row.key)}>{match ? 'Choose another pantry food' : 'Choose pantry food'}</button>
              {!match && !!suggestions.length && <div role="group" aria-label={`Suggested pantry matches for ${row.log.name}`} className="space-y-2"><p className="text-sm text-slate-300">Suggested pantry matches</p>{suggestions.map(({ food }) => <button key={food.id} className={`${dialogButton} block w-full text-left`} type="button" onClick={() => choose(row.key, food)}>{food.name} · {basisLabel(food.nutritionBasis)}</button>)}</div>}
              {match ? <>
                <button type="button" className={dialogButton} onClick={() => change({ matchId: '' })}>Use editable AI estimate</button>
                <label className="block text-sm">Amount for {row.log.name} ({foodUnit(match.nutritionBasis)})<input {...validation.attributes(`${row.key}-amount`)} className={dialogField} type="number" step="any" inputMode="decimal" value={row.quantity} onChange={e => change({ quantity: e.target.value })} /></label>
                {(!match.nutritionBasis || !!match.missingNutrients?.length) && <><p className="text-sm text-amber-200">Check the food details before logging.</p><button type="button" className={dialogButton} onClick={event => { restoreSource.current = event.currentTarget.closest('article')?.querySelector('button[data-field]') ?? null; setEditingFood(match); }}>Check food details</button></>}
              </> : <>
                <label className="block text-sm">Food name for {row.log.name}<input {...validation.attributes(`${row.key}-name`)} className={dialogField} value={row.name} onChange={e => change({ name: e.target.value })} /></label>
                <div className="grid grid-cols-2 gap-3">{nutrients.map(key => <label key={key} className="block text-sm">{key === 'calories' ? 'Calories (kcal)' : `${key[0].toUpperCase()}${key.slice(1)} (g)`}<input {...validation.attributes(`${row.key}-${key}`)} className={dialogField} type="number" step="any" min="0" inputMode="decimal" value={row.values[key]} onChange={e => change({ values: { ...row.values, [key]: e.target.value } })} /></label>)}</div>
              </>}
              <button type="button" className={dialogButton} aria-label={`Remove ${row.log.name} from review`} onClick={() => setRows(values => values.filter(item => item.key !== row.key))}>Remove food</button>
            </div>
          </details>
        </article>;
      })}
      {update && <section className="space-y-3 rounded-xl border border-amber-500/50 p-4" aria-label="Proposed nutrition profile changes"><h3 className="font-bold">Proposed profile changes</h3>
        <dl className="space-y-2 text-sm">{[
          ['Goal', profile.goal, proposed.goal], ['Preferences', profile.preferences.join(', ') || 'None', proposed.preferences.join(', ') || 'None'],
          ['Protein target (g/kg)', profile.targetProteinRatio, proposed.targetProteinRatio], ['Calorie adjustment', `${Math.round((profile.targetMultiplier ?? 1) * 100)}%`, `${Math.round((proposed.targetMultiplier ?? 1) * 100)}%`], ['Region', profile.region || 'Not set', proposed.region || 'Not set'],
        ].filter(([, before, after]) => before !== after).map(([label, before, after]) => <div key={label}><dt className="font-bold">{label}</dt><dd>{before} → {after}</dd></div>)}</dl>
        <label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="checkbox" className="h-5 w-5 shrink-0" checked={applyProfile} onChange={e => setApplyProfile(e.target.checked)} />Apply these profile changes</label>
      </section>}
    </form>
  </FoodFormModal>
  {choosing && <PantryChoiceDialog pantry={pantry} foodName={rows.find(row => row.key === choosing)?.log.name ?? ''} onClose={() => setChoosing(null)} onChoose={food => choose(choosing, food)} />}
  {editingFood && <FoodDefinitionEditor item={editingFood} onClose={() => setEditingFood(null)} onSave={food => {
    onSavePantry(pantry.map(item => item.id === food.id ? food : item));
    setRows(values => values.map(row => row.matchId === food.id ? { ...row, quantity: food.nutritionBasis === 'serving' ? '1' : '100' } : row));
    requestAnimationFrame(() => restoreSource.current?.focus());
  }} />}</>;
}
