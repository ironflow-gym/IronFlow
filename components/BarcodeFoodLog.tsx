import React, { useState } from 'react';
import { FoodItem, FuelLog } from '../types';
import FoodQuantityDialog from './FoodQuantityDialog';
/** Keep the choice to retain a newly looked-up product explicit. */
export default function BarcodeFoodLog({ item, isInPantry, onClose, onLog, onSavePantry }: {
  item: FoodItem; isInPantry: boolean; onClose: () => void; onLog: (entry: FuelLog) => void; onSavePantry: (food: FoodItem) => void;
}) {
  const [save, setSave] = useState(false);
  return <FoodQuantityDialog dirtyExtra={save} item={item} onClose={onClose} extra={!isInPantry ? <label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="checkbox" className="h-5 w-5 shrink-0" checked={save} onChange={e => setSave(e.target.checked)} />Also save this food to pantry</label> : undefined} onLog={entry => {
    if (save && !isInPantry) onSavePantry(item);
    onLog(isInPantry || save ? entry : { ...entry, pantryItemId: undefined });
  }} />;
}
