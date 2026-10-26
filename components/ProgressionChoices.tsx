import React, { useState } from 'react';
import type { Exercise } from '../types';
import { applyProgressionChoice } from '../src/progression';

export default function ProgressionChoices({ exercise, onChange }: { exercise: Exercise; onChange: (exercise: Exercise) => void }) {
  const recommendation = exercise.recommendation;
  const [manual, setManual] = useState(false);
  const [weight, setWeight] = useState(String(recommendation?.weight ?? 0));
  const [reps, setReps] = useState(String(recommendation?.reps ?? 8));
  if (!recommendation) return null;
  const unit = (recommendation.unit ?? exercise.sets[0]?.unit) === 'lbs' ? 'lb' : 'kg';
  const perHand = /dumbbell|\bdb\b|d\/b/i.test(exercise.name) ? ' per hand' : '';
  const canChange = exercise.sets.some(s => !s.completed && !s.isWarmup && !s.isDeload);
  const button = 'rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold disabled:opacity-40';
  return <details className="mx-4 mb-4 rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-sm" data-testid={`progression-${exercise.name}`}>
    <summary className="cursor-pointer font-bold text-emerald-300">Suggested: {recommendation.weight} {unit}{perHand} × {recommendation.reps} · Why?</summary>
    <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-400">{recommendation.source === 'history' ? 'Based on recorded history for this exercise' : recommendation.source === 'related' ? 'Estimate from related exercises' : 'Routine starting values — insufficient matching history'}</p>
      {recommendation.previous && <p>Last time ({recommendation.previous.date}): {Number(recommendation.previous.weight.toFixed(2))} {unit}{perHand} × {recommendation.previous.reps}</p>}
      <p>{recommendation.reason}</p>
      <p className="text-xs text-slate-400">Changes affect uncompleted working sets in this workout only. Edit the routine separately to change future defaults.{perHand && ' Dumbbell weights are per hand.'}</p>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={!canChange} onClick={() => onChange(applyProgressionChoice(exercise, 'suggestion'))}>Use suggestion</button>
        <button className={button} disabled={!canChange || !recommendation.previous} onClick={() => onChange(applyProgressionChoice(exercise, 'previous'))}>Keep previous values</button>
        <button className={button} disabled={!canChange} onClick={() => setManual(!manual)}>Enter my own</button>
      </div>
      {manual && <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); onChange(applyProgressionChoice(exercise, 'manual', { weight: Number(weight), reps: Number(reps) })); setManual(false); }}>
        <label className="text-xs">Weight ({unit}{perHand})<input aria-label={`Custom weight for ${exercise.name}`} className="block w-28 rounded bg-slate-800 p-2" type="number" min="0" step="any" required value={weight} onChange={e => setWeight(e.target.value)} /></label>
        <label className="text-xs">Reps<input aria-label={`Custom reps for ${exercise.name}`} className="block w-20 rounded bg-slate-800 p-2" type="number" min="1" step="1" required value={reps} onChange={e => setReps(e.target.value)} /></label>
        <button className={button} disabled={!canChange}>Apply to this workout</button>
      </form>}
      {recommendation.choice && <p role="status" className="text-xs text-emerald-300">{recommendation.choice === 'previous' ? 'Previous values' : recommendation.choice === 'manual' ? 'Your values' : 'Suggestion'} applied to this workout.</p>}
    </div>
  </details>;
}
