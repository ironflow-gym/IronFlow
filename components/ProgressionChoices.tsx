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
  const previousOffGrid = !!recommendation.equipment && (recommendation.previousSets ?? (recommendation.previous ? [recommendation.previous] : [])).some(set => set.weight < recommendation.equipment!.base || Math.abs((set.weight - recommendation.equipment!.base) / recommendation.equipment!.step - Math.round((set.weight - recommendation.equipment!.base) / recommendation.equipment!.step)) > 1e-5);
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
  const mixed = recommendation.sets && new Set(recommendation.sets.map(set => `${set.weight}:${set.reps}`)).size > 1;
  const selected = recommendation.choice ? exercise.sets.filter(s => !s.completed && !s.isWarmup && !s.isDeload) : [];
  const selection = selected.length && new Set(selected.map(s => `${s.weight}:${s.reps}:${s.unit}`)).size === 1 ? `Selected: ${formatWeight(selected[0].weight)} ${selected[0].unit === 'lbs' ? 'lb' : 'kg'}${perHand} × ${selected[0].reps}` : selected.length ? 'Selected: per-set targets' : undefined;
  return <div className="mx-4 mb-3 space-y-2" data-testid={`progression-${exercise.name}`}><details className="rounded-xl border border-slate-700 bg-slate-950/40 px-3 text-sm">
    <summary className="min-h-11 cursor-pointer py-3 font-bold text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400">{selection ?? (recommendation.needsStartingLoad ? `Choose a starting load · ${formatWeight(recommendation.weight)} ${unit}${perHand} base` : mixed ? 'Suggested: per-set targets' : `Suggested: ${formatWeight(recommendation.weight)} ${unit}${perHand} × ${recommendation.reps}`)} · Why?</summary>
    <div className="mt-3 space-y-3">
      <p className="text-sm text-slate-300">{recommendation.source === 'history' ? 'Based on recorded history for this exercise' : recommendation.source === 'related' ? 'Estimate from related exercises' : 'Routine starting values — insufficient matching history'}</p>
      {(recommendation.previousSets || recommendation.previous) && <table className="w-full text-left text-xs"><caption className="pb-2 text-left text-slate-400">Working sets · last performed {recommendation.previous?.date}</caption><thead><tr><th className="py-1 font-normal">Set</th><th className="font-normal">Previous</th><th className="font-normal">Suggested</th></tr></thead><tbody>{(recommendation.sets ?? [recommendation]).map((set, index) => {
        const previous = recommendation.previousSets?.[index] ?? (index === 0 ? recommendation.previous : undefined);
        return <tr key={index} className="border-t border-slate-800"><th className="py-2 font-normal">{index + 1}</th><td>{previous ? `${formatWeight(previous.weight)} × ${previous.reps}` : '—'}</td><td>{formatWeight(set.weight)} × {set.reps}</td></tr>;
      })}</tbody></table>}
      <p className="text-xs text-slate-400">Weights in {unit}{perHand}.</p>
      <p>{recommendation.choice && recommendation.reason.startsWith('Choose a starting load') ? 'You selected starting values for this exercise. Future suggestions depend on completed working sets.' : recommendation.reason.split(' Equipment:')[0]}</p>
      {recommendation.equipment && <p className="text-xs text-slate-400">Equipment: {formatWeight(recommendation.equipment.base)} {unit} base + {formatWeight(recommendation.equipment.step)} {unit} total steps.</p>}
      {contextNote && <p className="text-sm text-slate-300">Routine note: {contextNote}</p>}
      <p className="text-sm text-slate-300">Applies to unfinished working sets in this exercise only.{perHand && ' Dumbbell weights are per hand.'}</p>
      {previousOffGrid && <p className="text-sm text-amber-300">The previous load does not match your current equipment settings. Use the feasible suggestion or enter your own values explicitly.</p>}
      <div className="flex flex-wrap gap-2">
        <button className={`${button} border-emerald-600 text-emerald-200`} disabled={!canChange} onClick={() => onChange(applyProgressionChoice(exercise, 'suggestion'))}>Use suggestion</button>
        <button className={button} disabled={!canChange || !recommendation.previous || previousOffGrid} onClick={() => onChange(applyProgressionChoice(exercise, 'previous'))}>Keep previous values</button>
        <button className={button} disabled={!canChange} onClick={() => setManual(!manual)}>Enter my own</button>
      </div>
      {manual && <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); onChange(applyProgressionChoice(exercise, 'manual', { weight: Number(weight), reps: Number(reps) })); setManual(false); }}>
        <label className="text-sm">Weight ({unit}{perHand})<input aria-label={`Custom weight for ${exercise.name}`} className={`${dialogField} w-32`} type="number" min="0" step="any" required value={weight} onChange={e => setWeight(e.target.value)} /></label>
        <label className="text-sm">Reps<input aria-label={`Custom reps for ${exercise.name}`} className={`${dialogField} w-24`} type="number" min="1" step="1" required value={reps} onChange={e => setReps(e.target.value)} /></label>
        <button className={button} disabled={!canChange}>Apply to this exercise</button>
      </form>}
      {recommendation.choice && <p role="status" className="text-xs text-emerald-300">{recommendation.choice === 'previous' ? 'Previous values' : recommendation.choice === 'manual' ? 'Your values' : 'Suggestion'} applied to this exercise.</p>}
    </div>
  </details></div>;
}
