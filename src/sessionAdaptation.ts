import type { Exercise, ExerciseLibraryItem, WorkoutSession } from '../types';
import { equipmentFor, formatWeight, snapWeight } from './equipment';
import { isAssisted, isCardioCategory } from './utils';

export interface AdaptationRequest {
  minutes?: number;
  readiness: 'normal' | 'low-energy';
  replacements: Record<string, string>; // exercise ID → explicitly selected available library exercise
}
export interface SessionAdaptation {
  fingerprint: string;
  session: WorkoutSession;
  changes: string[];
  notes: string[];
  remainingMinutes: number;
}
export const sessionFingerprint = (session: WorkoutSession) => JSON.stringify({ id: session.id, exercises: session.exercises });
export function estimateRemainingMinutes(session: WorkoutSession, defaultRest = 90): number {
  return Math.ceil(session.exercises.reduce((total, ex) => total + ex.sets.filter(s => !s.completed).reduce((sum, set) => sum + (isCardioCategory(ex.category) ? (set.duration ?? set.reps ?? 60) : 45) + (set.isWarmup ? 30 : ex.restSeconds ?? defaultRest), 0), 0) / 60);
}

/** Deterministic, reversible preview. Neither its input nor routine defaults are mutated. */
export function proposeSessionAdaptation(session: WorkoutSession, request: AdaptationRequest, library: ExerciseLibraryItem[], defaultRest = 90): SessionAdaptation {
  if (request.minutes !== undefined && (!Number.isInteger(request.minutes) || request.minutes < 5 || request.minutes > 180)) throw new Error('Choose a time between 5 and 180 minutes.');
  const result: WorkoutSession = structuredClone(session);
  const changes: string[] = [];
  const notes: string[] = [];
  for (const exercise of result.exercises) {
    const replacementName = request.replacements[exercise.id];
    if (replacementName && replacementName !== exercise.name) {
      if (exercise.sets.some(s => s.completed)) throw new Error(`Keep ${exercise.name}: it has completed sets. Substitute only exercises that have not started.`);
      const replacement = library.find(item => item.name === replacementName);
      if (!replacement) throw new Error('Choose an available replacement from the exercise library.');
      if (isCardioCategory(exercise.category) !== isCardioCategory(replacement.category)) throw new Error('Choose a replacement of the same strength or cardio type.');
      // No automatic load transfer between different movements/machines.
      const originalName = exercise.name;
      exercise.name = replacement.name;
      exercise.category = replacement.category;
      exercise.primaryMuscle = replacement.muscles[0];
      exercise.recommendation = undefined;
      exercise.rationale = `You selected ${replacement.name} instead of ${originalName}. Set your starting values before beginning this exercise.`;
      const unit = exercise.sets[0]?.unit ?? 'kgs';
      const equipment = equipmentFor(replacement.name, library, unit);
      exercise.sets = exercise.sets.map(set => isCardioCategory(replacement.category)
        ? { ...set, weight: 0, distance: undefined, intensity: undefined }
        : { ...set, weight: equipment.barWeight ?? 0 });
      changes.push(`Replace ${originalName} with ${replacement.name}; starting load reset to ${formatWeight(equipment.barWeight ?? 0)} ${unit === 'kgs' ? 'kg' : 'lb'}${isCardioCategory(replacement.category) ? ' (distance/intensity reset)' : ''}. Check its weight and reps before starting.`);
    }
    if (request.readiness === 'low-energy' && !isCardioCategory(exercise.category)) {
      if (isAssisted(exercise.name)) {
        notes.push(`${exercise.name}: assistance weight left unchanged; lower assistance would make the exercise harder.`);
        continue;
      }
      let changed = false;
      exercise.sets = exercise.sets.map(set => {
        if (set.completed || set.isWarmup || set.isDeload || set.weight <= 0) return set;
        const equipment = equipmentFor(exercise.name, library, set.unit);
        const increment = equipment.weightIncrement ?? (set.unit === 'kgs' ? 1.25 : 2.5);
        const weight = snapWeight(set.weight * 0.9, increment, equipment.barWeight ?? 0, equipment.loadingMode === 'paired');
        if (weight >= set.weight) return set;
        changed = true;
        changes.push(`${exercise.name}: ${formatWeight(set.weight)} → ${formatWeight(weight)} ${set.unit === 'kgs' ? 'kg' : 'lb'} × ${set.reps} for an unfinished working set.`);
        return { ...set, weight };
      });
      if (changed) exercise.recommendation = undefined;
    }
  }
  if (request.minutes !== undefined) {
    // Trim from the end in rounds, retaining every completed set, all warmups
    // and at least one unfinished working set for each unfinished exercise.
    let removed = true;
    while (estimateRemainingMinutes(result, defaultRest) > request.minutes && removed) {
      removed = false;
      for (let i = result.exercises.length - 1; i >= 0; i--) {
        if (estimateRemainingMinutes(result, defaultRest) <= request.minutes) break;
        const ex = result.exercises[i];
        const pending = ex.sets.filter(s => !s.completed && !s.isWarmup && !s.isDeload);
        if (pending.length <= 1) continue;
        const last = pending[pending.length - 1];
        ex.sets = ex.sets.filter(s => s.id !== last.id);
        changes.push(`${ex.name}: remove one unfinished working set (${last.reps} reps).`);
        removed = true;
      }
    }
    if (estimateRemainingMinutes(result, defaultRest) > request.minutes) notes.push('The estimate exceeds your time limit after retaining completed sets, warmups and at least one pending working set per exercise. No exercises were removed automatically.');
  }
  if (!changes.length) notes.push('No changes are needed for the selected options.');
  return { fingerprint: sessionFingerprint(session), session: result, changes, notes, remainingMinutes: estimateRemainingMinutes(result, defaultRest) };
}
export function applySessionAdaptation(current: WorkoutSession, proposal: SessionAdaptation): WorkoutSession {
  if (sessionFingerprint(current) !== proposal.fingerprint) throw new Error('The workout changed. Preview the adaptation again before applying.');
  return { ...current, exercises: proposal.session.exercises, adaptations: [...(current.adaptations ?? []), { at: Date.now(), changes: proposal.changes }] };
}
