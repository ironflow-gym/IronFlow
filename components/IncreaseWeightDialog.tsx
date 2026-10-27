import InfoButton from './ui/InfoButton';
import React, { useState } from 'react';
import type { Exercise, ExerciseLibraryItem } from '../types';
import { applyWeightIncrease, previewWeightIncrease } from '../src/progression';
import { formatWeight } from '../src/equipment';
import Modal, { dialogButton, dialogPrimaryButton } from './ui/Modal';

export default function IncreaseWeightDialog({ exercise, library, onApply, onClose }: {
  exercise: Exercise; library: ExerciseLibraryItem[]; onApply: (exercise: Exercise) => void; onClose: () => void;
}) {
  const [preview] = useState(() => previewWeightIncrease(exercise, library));
  const [error, setError] = useState('');
  const title = preview.assisted ? 'Reduce assistance' : 'Increase weight';
  const groups = new Map<string, { from: number; to: number; unit: string; count: number }>();
  preview.changes.forEach(change => {
    const key = `${change.from}:${change.to}:${change.unit}`;
    const previous = groups.get(key);
    groups.set(key, { ...change, count: (previous?.count ?? 0) + 1 });
  });
  const perHand = /dumbbell|\bdb\b|d\/b/i.test(exercise.name) ? ' per hand' : '';
  return <Modal label={title} title={title} closeLabel={`Close ${title.toLowerCase()}`} onClose={onClose} footer={<>
    {error && <p className="w-full text-sm text-rose-300" role="alert">{error}</p>}
    <button className={dialogButton} onClick={onClose}>Cancel</button>
    <button className={dialogPrimaryButton} disabled={!preview.changes.length} onClick={() => {
      try { onApply(applyWeightIncrease(exercise, preview)); } catch (e) { setError((e as Error).message); }
    }}>Apply to this exercise</button>
  </>}>
    <div className="space-y-4"><p className="font-bold">{exercise.name}</p>
      <p className="text-sm text-slate-300">{preview.assisted ? 'Less assistance makes this exercise harder.' : 'Move up one equipment increment.'} Unfinished working sets only; reps and routine defaults stay unchanged.</p>
      {[...groups.values()].map((change, index) => <p key={index} className="rounded-xl border border-slate-700 p-3 font-bold">{formatWeight(change.from)} → {formatWeight(change.to)} {change.unit === 'lbs' ? 'lb' : 'kg'}{perHand}<span className="mt-1 block text-sm font-normal text-slate-300">{change.count} unfinished working {change.count === 1 ? 'set' : 'sets'}</span></p>)}
      {!preview.changes.length && <p className="text-sm text-amber-200">There are no unfinished working sets that can increase in difficulty with the current equipment settings.</p>}
      <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-300">Manual adjustment · current workout only.</p><InfoButton topic="progression" /></div>
    </div>
  </Modal>;
}
