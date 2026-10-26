import { dialogButton, dialogField } from './ui/Modal';
import { formatWeight } from '../src/equipment';
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
  const previousOffGrid = !!recommendation.previous && !!recommendation.equipment && (recommendation.previous.weight < recommendation.equipment.base || Math.abs((recommendation.previous.weight - recommendation.equipment.base) / recommendation.equipment.step - Math.round((recommendation.previous.weight - recommendation.equipment.base) / recommendation.equipment.step)) > 1e-5);
  let contextNote = exercise.rationale?.trim() ?? '';
  if (contextNote.startsWith(recommendation.reason)) contextNote = contextNote.slice(recommendation.reason.length);
  else {
    const reason = recommendation.reason.split(' Equipment:')[0];
    if (contextNote.startsWith(reason)) {
      contextNote = contextNote.slice(reason.length);
      if (contextNote.startsWith(' Equipment:')) { const separator = contextNote.indexOf(' — '); contextNote = separator >= 0 ? contextNote.slice(separator + 3) : ''; }
    }
  }
  contextNote = contextNote.replace(/^[\s—–-]+/, '');
  const canChange = exercise.sets.some(s => !s.completed && !s.isWarmup && !s.isDeload);
  const button = dialogButton;
  return <details className="mx-4 mb-4 rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-sm" data-testid={`progression-${exercise.name}`}>
    <summary className="min-h-11 cursor-pointer py-3 font-bold text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400">Suggested: {formatWeight(recommendation.weight)} {unit}{perHand} × {recommendation.reps} · Why?</summary>
    <div className="mt-3 space-y-3">
      <p className="text-sm text-slate-300">{recommendation.source === 'history' ? 'Based on recorded history for this exercise' : recommendation.source === 'related' ? 'Estimate from related exercises' : 'Routine starting values — insufficient matching history'}</p>
      {recommendation.previous && <p>Last time ({recommendation.previous.date}): {Number(recommendation.previous.weight.toFixed(2))} {unit}{perHand} × {recommendation.previous.reps}</p>}
      <p>{recommendation.reason}</p>
      {contextNote && <p className="text-sm text-slate-300">Routine note: {contextNote}</p>}
      <p className="text-sm text-slate-300">Applies to unfinished working sets in this workout only.{perHand && ' Dumbbell weights are per hand.'}</p>
      {previousOffGrid && <p className="text-sm text-amber-300">The previous load does not match your current equipment settings. Use the feasible suggestion or enter your own values explicitly.</p>}
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={!canChange} onClick={() => onChange(applyProgressionChoice(exercise, 'suggestion'))}>Use suggestion</button>
        <button className={button} disabled={!canChange || !recommendation.previous || previousOffGrid} onClick={() => onChange(applyProgressionChoice(exercise, 'previous'))}>Keep previous values</button>
        <button className={button} disabled={!canChange} onClick={() => setManual(!manual)}>Enter my own</button>
      </div>
      {manual && <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); onChange(applyProgressionChoice(exercise, 'manual', { weight: Number(weight), reps: Number(reps) })); setManual(false); }}>
        <label className="text-sm">Weight ({unit}{perHand})<input aria-label={`Custom weight for ${exercise.name}`} className={`${dialogField} w-32`} type="number" min="0" step="any" required value={weight} onChange={e => setWeight(e.target.value)} /></label>
        <label className="text-sm">Reps<input aria-label={`Custom reps for ${exercise.name}`} className={`${dialogField} w-24`} type="number" min="1" step="1" required value={reps} onChange={e => setReps(e.target.value)} /></label>
        <button className={button} disabled={!canChange}>Apply to this workout</button>
      </form>}
      {recommendation.choice && <p role="status" className="text-xs text-emerald-300">{recommendation.choice === 'previous' ? 'Previous values' : recommendation.choice === 'manual' ? 'Your values' : 'Suggestion'} applied to this workout.</p>}
    </div>
  </details>;
}
