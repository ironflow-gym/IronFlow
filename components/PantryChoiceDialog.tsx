import React, { useState } from 'react';
import { FoodItem } from '../types';
import { basisLabel } from '../src/food';
import Modal, { dialogButton, dialogField } from './ui/Modal';
export default function PantryChoiceDialog({ pantry, foodName, onClose, onChoose }: {
  pantry: FoodItem[]; foodName: string; onClose: () => void; onChoose: (food: FoodItem) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = pantry.filter(food => `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Modal label="Choose pantry food" title="Choose pantry food" closeLabel="Cancel choosing pantry food" onClose={onClose}>
    <label className="block">Search pantry<input type="search" className={dialogField} value={query} onChange={e => setQuery(e.target.value)} /></label>
    <p className="my-3 text-sm text-slate-300">Choose a food for {foodName}. This changes only this reviewed entry.</p>
    {!matches.length && <p>No matches. Change or clear the search to see other foods.</p>}
    <div className="space-y-2">{matches.map(food => <button key={food.id} type="button" className={`${dialogButton} block w-full text-left`} onClick={() => { onChoose(food); onClose(); }}><span className="block break-words">{food.name}</span><span className="block text-sm font-normal text-slate-300">{food.brand ? `${food.brand} · ` : ''}{basisLabel(food.nutritionBasis)}</span></button>)}</div>
  </Modal>;
}
