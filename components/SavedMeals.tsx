import { FoodFieldError, useFoodValidation } from '../hooks/useFoodValidation';
import FoodFormModal from './ui/FoodFormModal';
import FoodSaveFeedback from './ui/FoodSaveFeedback';
import React, { useId, useRef, useState } from 'react';
import { FuelLog, SavedMeal } from '../types';
import { MealFood, saveMeal, scaleMealFood } from '../src/meals';
import Modal, { dialogButton, dialogField, dialogPrimaryButton } from './ui/Modal';
import RepeatMealDialog from './RepeatMealDialog';
import MealFoodRow, { mealPreview, MealTotal } from './MealFoodRow';

export default function SavedMeals({ meals, history, onSave, onLog }: {
  meals: SavedMeal[]; history: FuelLog[]; onSave: (meals: SavedMeal[]) => void; onLog: (logs: FuelLog[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SavedMeal | null>(null);
  const [logging, setLogging] = useState<SavedMeal | null>(null);
  const [deleting, setDeleting] = useState<SavedMeal | null>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const createButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const create = () => setEditing({ id: crypto.randomUUID(), name: '', foods: [] });
  return <section aria-label="Saved meals" className="rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-bold text-slate-100">Saved meals</h3><p className="mt-1 text-sm text-slate-300">Reuse a single food or a group of logged foods.</p></div>
      <button className={dialogButton} onClick={() => { setOpen(true); setQuery(''); if (!meals.length) create(); }}>{meals.length ? `View saved meals (${meals.length})` : 'Create saved meal'}</button>
    </div>
    {notice && !open && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
    {open && <Modal label="Saved meals" title="Saved meals" closeLabel="Close saved meals" onClose={() => setOpen(false)} suspended={!!editing || !!logging || !!deleting}
      footer={<><FoodSaveFeedback />{notice && <p role="status" className="w-full text-sm text-emerald-300">{notice}</p>}<button ref={createButton} className={dialogPrimaryButton} onClick={create}>Create saved meal</button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-300">Log a meal, then review its date and amounts.</p>
        {meals.length > 0 && <label className="block">Find a saved meal<input ref={searchInput} type="search" className={dialogField} value={query} onChange={e => setQuery(e.target.value)} /></label>}
        {!meals.length && <p>No saved meals yet. Create one from your food log.</p>}
        {meals.length > 0 && !meals.some(meal => meal.name.toLowerCase().includes(query.toLowerCase())) && <p>No matching meals.</p>}
        {meals.filter(meal => meal.name.toLowerCase().includes(query.toLowerCase())).map(meal => <article key={meal.id} className="rounded-xl border border-slate-700 p-4">
          <h3 className="break-words text-lg font-bold">{meal.name}</h3>
          <p className="mt-1 text-sm text-slate-300">{meal.foods.length} {meal.foods.length === 1 ? 'food' : 'foods'} · {Math.round(meal.foods.reduce((total, food) => total + food.calories, 0) * 100) / 100} kcal</p>
          <details className="mt-2 text-sm text-slate-300"><summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2 focus-visible:outline-emerald-400">Show foods<span className="sr-only"> in {meal.name}</span></summary><ul className="list-disc space-y-1 pl-5">{meal.foods.map((food, i) => <li key={i} className="break-words">{food.name}</li>)}</ul></details>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={dialogPrimaryButton} aria-label={`Log ${meal.name}`} onClick={() => setLogging(meal)}>Log meal</button>
            <details className="text-sm"><summary className={`${dialogButton} cursor-pointer py-3`}>Options<span className="sr-only"> for {meal.name}</span></summary>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={dialogButton} aria-label={`Edit saved meal ${meal.name}`} onClick={() => setEditing(meal)}>Edit</button>
                <button className={dialogButton} aria-label={`Delete saved meal ${meal.name}`} onClick={() => setDeleting(meal)}>Delete</button>
              </div>
            </details>
          </div>
        </article>)}
      </div>
    </Modal>}
    {editing && <MealEditor meal={editing} history={history} onClose={() => setEditing(null)} onSave={meal => {
      onSave(meals.some(item => item.id === meal.id) ? meals.map(item => item.id === meal.id ? meal : item) : [...meals, meal]);
      setNotice(`Updated ${meal.name}.`); setEditing(null);
      if (query && !meal.name.toLowerCase().includes(query.toLowerCase())) requestAnimationFrame(() => searchInput.current?.focus());
    }} />}
    {logging && <RepeatMealDialog name={logging.name} foods={logging.foods} onClose={() => setLogging(null)} onAdd={logs => { onLog(logs); setNotice(`Added ${logs.length} food ${logs.length === 1 ? 'entry' : 'entries'} to ${logs[0].date}.`); }} />}
    {deleting && <Modal label="Delete saved meal" title="Delete saved meal?" closeLabel="Cancel deleting meal" onClose={() => setDeleting(null)}
      footer={<><FoodSaveFeedback /><button className={dialogButton} onClick={() => setDeleting(null)}>Cancel</button><button className={`${dialogPrimaryButton} bg-rose-500 hover:bg-rose-400`} onClick={() => {
        onSave(meals.filter(meal => meal.id !== deleting.id)); setNotice(`Deleted ${deleting.name}.`); setDeleting(null); requestAnimationFrame(() => createButton.current?.focus());
      }}>Delete saved meal</button></>}>
      <p>Delete “{deleting.name}” from saved meals? Previously logged foods will be kept.</p>
    </Modal>}
  </section>;
}

function MealEditor({ meal, history, onClose, onSave }: {
  meal: SavedMeal; history: FuelLog[]; onClose: () => void; onSave: (meal: SavedMeal) => void;
}) {
  const formId = useId();
  const [name, setName] = useState(meal.name);
  const [rows, setRows] = useState<{ key: string; sourceId?: string; food: MealFood; quantity: string }[]>(() => meal.foods.map(food => ({ key: crypto.randomUUID(), food: { ...food }, quantity: '1' })));
  const dates = [...new Set(history.map(log => log.date))].sort().reverse();
  const [date, setDate] = useState(dates[0] ?? '');
  const validation = useFoodValidation(formId);
  const preview = mealPreview(rows.map(row => row.food), rows.map(row => row.quantity));
  const originalDraft = useRef(JSON.stringify({ name, rows }));
  const dirty = JSON.stringify({ name, rows }) !== originalDraft.current;
  return <FoodFormModal dirty={dirty} label="Save meal" title={meal.name ? 'Edit saved meal' : 'Create saved meal'} closeLabel="Cancel saving meal" onClose={onClose}
    footer={<><FoodSaveFeedback />{validation.error && <p id={validation.errorId(validation.error.field)} role="alert" className="w-full text-sm text-rose-300">{validation.error.message}</p>}
      <MealTotal foods={preview} /><button type="submit" form={formId} className={dialogPrimaryButton}>Save meal</button></>}>
    <form id={formId} noValidate className="space-y-4" onChange={validation.clear} onSubmit={event => {
      event.preventDefault();
      try {
        if (!name.trim()) throw new FoodFieldError('name', 'Enter a meal name.');
        if (!rows.length) throw new FoodFieldError('source', 'Choose at least one food.');
        const foods = rows.map(row => { try { return scaleMealFood(row.food, Number(row.quantity)); } catch (e) { throw new FoodFieldError(row.key, `${row.food.name}: ${(e as Error).message}`); } });
        onSave(saveMeal(meal.id, name, foods));
      }
      catch (e) { validation.fail(e); }
    }}>
      <label className="block">Meal name<input {...validation.attributes('name')} className={dialogField} required value={name} onChange={e => { setName(e.target.value); validation.clear(); }} /></label>
      <p className="text-sm text-slate-300">Checked foods are included immediately. Amounts start at 1× the recorded food; expand a food to adjust. Saving sets the meal’s default amounts.</p>
      <details open={meal.foods.length === 0 ? true : undefined} className="rounded-xl border border-slate-700 p-3">
        <summary className="min-h-11 cursor-pointer py-3 font-bold focus-visible:outline-2 focus-visible:outline-emerald-400">Choose foods from your log</summary>
        {!history.length ? <p className="text-sm text-slate-300">Log a food first, then return here to save it.</p> : <div className="space-y-3">
          <label className="block">Food log date<select {...validation.attributes('source')} className={dialogField} value={date} onChange={e => setDate(e.target.value)}>
            {dates.map(value => <option key={value} value={value}>{value}</option>)}
          </select></label>
          {history.filter(log => log.date === date).map(log => <label key={log.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-slate-700 p-3">
            <input className="mt-1 h-5 w-5 shrink-0" type="checkbox" checked={rows.some(row => row.sourceId === log.id)} onChange={e => {
              const checked = e.target.checked;
              setRows(values => checked ? [...values, { key: crypto.randomUUID(), sourceId: log.id, food: log, quantity: '1' }] : values.filter(row => row.sourceId !== log.id)); validation.clear();
            }} />
            <span className="min-w-0 break-words">{log.name}<span className="block text-sm text-slate-300">{log.calories} kcal</span></span>
          </label>)}
        </div>}
      </details>
      <section aria-label="Foods in saved meal" className="space-y-3">
        <h3 className="font-bold">Foods in this meal ({rows.length})</h3>
        {!rows.length && <p className="text-sm text-slate-300">Select foods using the log above.</p>}
        {rows.map(row => <MealFoodRow key={row.key} inputAttributes={validation.attributes(row.key)} food={row.food} quantity={row.quantity} onQuantity={quantity => {
          setRows(values => values.map(item => item.key === row.key ? { ...item, quantity } : item)); validation.clear();
        }} onRemove={() => { setRows(values => values.filter(item => item.key !== row.key)); validation.clear(); }} />)}
      </section>
    </form>
  </FoodFormModal>;
}
