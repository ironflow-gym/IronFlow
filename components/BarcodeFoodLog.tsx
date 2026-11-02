import React, { useState } from 'react';
import { FoodItem, FuelLog } from '../types';
import FoodQuantityDialog from './FoodQuantityDialog';
/** New products are retained by default; users can opt out before logging. */
export default function BarcodeFoodLog({ item, isInPantry, onClose, onLog, onSavePantry }: {
  item: FoodItem; isInPantry: boolean; onClose: () => void; onLog: (entry: FuelLog) => void; onSavePantry: (food: FoodItem) => void;
}) {
  const [save, setSave] = useState(true);
  return <FoodQuantityDialog dirtyExtra={!isInPantry && !save} barcodeSteps={!isInPantry} item={item} onClose={onClose} extra={!isInPantry ? <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3"><input type="checkbox" className="h-5 w-5 shrink-0" checked={save} onChange={e => setSave(e.target.checked)} /><span><span className="block font-semibold text-cyan-100">Also save this food to pantry</span><span className="mt-1 block text-xs text-slate-300">Keep these product details for next time. Uncheck to log only.</span></span></label> : undefined} onLog={entry => {
    if (save && !isInPantry) onSavePantry(item);
    onLog(isInPantry || save ? entry : { ...entry, pantryItemId: undefined });
  }} />;
}
