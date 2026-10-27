import React from 'react';
import type { WorkoutTemplate } from '../types';
import { isTimedExercise, isCardioCategory } from '../src/utils';
import { formatWeight } from '../src/equipment';
import { dialogField } from './ui/Modal';
export function workoutInputError(templates: WorkoutTemplate[]): string | undefined {
  for (const template of templates) {
    if (!template.name.trim() || !template.exercises.length) return 'Keep a named workout with at least one exercise.';
    for (const ex of template.exercises) {
      if (!ex.name.trim() || !Number.isInteger(ex.suggestedSets) || ex.suggestedSets < 1 || !Number.isInteger(ex.suggestedReps) || ex.suggestedReps < 1 || !Number.isFinite(ex.suggestedWeight) || ex.suggestedWeight < 0 || !ex.targetReps.trim()) return `Check sets, starting values and target for ${ex.name || 'this exercise'}.`;
    }
  }
}
export default function WorkoutPrescriptionFields({ exercise, unit, onChange }: { exercise: WorkoutTemplate['exercises'][number]; unit: string; onChange: (patch: Partial<WorkoutTemplate['exercises'][number]>) => void }) {
  const timed = isTimedExercise(exercise);
  return <div className="space-y-3 min-w-0">
    <label className="block text-sm text-slate-300">Track<select className={dialogField} value={timed ? 'time' : 'reps'} disabled={isCardioCategory(exercise.category)} onChange={event => { const tracking = event.target.value as 'time' | 'reps'; onChange({ tracking, suggestedReps: 0, targetReps: '' }); }}><option value="reps">Repetitions</option><option value="time">Time (seconds)</option></select></label>
    <div className="grid min-w-0 grid-cols-2 items-end gap-3">
      <label className="block min-w-0 text-sm text-slate-300">Sets<input className={dialogField} type="number" min="1" step="1" value={exercise.suggestedSets || ''} onChange={event => onChange({ suggestedSets: Number(event.target.value) })} /></label>
      <label className="block min-w-0 text-sm text-slate-300">{timed ? 'Duration (seconds)' : 'Starting reps'}<input className={dialogField} type="number" min="1" step="1" value={exercise.suggestedReps || ''} onChange={event => { const value = Number(event.target.value); onChange({ suggestedReps: value, ...(timed ? { targetReps: value > 0 ? `${value} seconds` : '' } : {}) }); }} /></label>
      <label className="col-span-2 block min-w-0 text-sm text-slate-300">{isCardioCategory(exercise.category) ? 'Distance / intensity' : `Weight (${unit.toLowerCase()})`}<input className={dialogField} type="number" min="0" step="any" value={formatWeight(exercise.suggestedWeight)} onChange={event => onChange({ suggestedWeight: Number(event.target.value) })} /></label>
      {!timed && <label className="col-span-2 block text-sm text-slate-300">Rep target<input className={dialogField} value={exercise.targetReps} placeholder="For example: 8-12" onChange={event => onChange({ targetReps: event.target.value })} /></label>}
    </div>
    {timed && !exercise.suggestedReps && <p className="text-sm text-amber-200">Enter a duration in seconds. Rep values are not converted to time.</p>}
  </div>;
}
