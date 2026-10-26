import { defaultLoadingMode, equipmentStep, adjustEquipmentWeight, type LoadingMode, formatWeight } from './equipment';
import type { HistoricalLog, ProgressionRecommendation, Exercise, ExerciseLibraryItem } from '../types';
import { roundToGymWeight, parseRepRange, isAssisted, isCardioCategory } from './utils';

export function convertWeight(weight: number, from: string, to: string): number {
  const pounds = /^(lb|lbs)$/i;
  return pounds.test(from) === pounds.test(to) ? weight : pounds.test(from) ? weight * 0.45359237 : weight / 0.45359237;
}
export interface ProgressionContext { templateId?: string; workingSets?: number; }
const sameRange = (a: string | undefined, b: string | number | undefined) => {
  if (a === undefined || b === undefined) return false;
  const x = parseRepRange(a), y = parseRepRange(b);
  return x.min === y.min && x.max === y.max;
};
const isWorking = (set: { isWarmup?: boolean; isDeload?: boolean }) => !set.isWarmup && !set.isDeload;

/** Evaluate an entire completed exercise. Record order cannot qualify one successful set. */
export function getWeightRecommendation(
  units: 'metric' | 'imperial', exName: string, category: string, history: HistoricalLog[],
  templateWeight: number, targetReps: string | number | undefined, _lastRefreshed?: number,
  templateName?: string, _rationale?: string, weightIncrement?: number, barWeight?: number,
  loadingMode?: LoadingMode, context: ProgressionContext = {},
): ProgressionRecommendation & { hasHistory: boolean } {
  const unit = units === 'metric' ? 'kg' : 'lbs';
  const paired = (loadingMode ?? defaultLoadingMode(exName)) === 'paired';
  const { min, max } = parseRepRange(targetReps);
  const count = Math.max(1, context.workingSets ?? 1);
  let recordedWeights: number[] = [];
  const round = (weight: number) => roundToGymWeight(weight, unit, recordedWeights, weightIncrement, barWeight, paired);
  const finish = (result: ProgressionRecommendation & { hasHistory: boolean }) => ({
    ...constrainRecommendation({ ...result, version: 2 }, exName, units, weightIncrement, barWeight, loadingMode), hasHistory: result.hasHistory,
  });
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const candidates = history.filter(log => !isCardioCategory(category) && !isCardioCategory(log.category)
    && log.exercise.toLowerCase() === exName.toLowerCase() && isWorking(log)
    && Number.isFinite(log.weight) && log.weight >= 0 && log.weight <= 10000
    && Number.isInteger(log.reps) && log.reps > 0 && log.date <= local
    && Date.now() - new Date(`${log.date}T12:00:00`).getTime() <= 180 * 86400000)
    .map(log => ({ ...log, weight: convertWeight(log.weight, log.unit, units === 'metric' ? 'kgs' : 'lbs') }));
  const matchesContext = (log: HistoricalLog) => context.templateId
    ? log.templateId === context.templateId
    : !log.templateId && !!templateName && log.templateName?.toLowerCase() === templateName.toLowerCase();
  recordedWeights = candidates.map(row => row.weight);
  const matching = candidates.filter(matchesContext);
  const pool = matching.length ? matching : candidates;
  if (!pool.length) {
    // No transfers from unrelated exercises, even when they share a muscle category.
    const weight = round(templateWeight > 0 && Number.isFinite(templateWeight) ? templateWeight : barWeight ?? 0);
    return finish({ weight, reps: min, sets: Array.from({ length: count }, () => ({ weight, reps: min })),
      reason: templateWeight > 0 ? 'Routine starting values; no recent matching exercise history. Check the load before starting.' : 'Choose a starting load before beginning. No recent matching exercise history or routine starting weight is available.',
      source: 'routine', action: 'starting', needsStartingLoad: !(templateWeight > 0), hasHistory: false });
  }
  const groups = new Map<string, typeof pool>();
  for (const log of pool) {
    const key = `${log.sessionId ?? `legacy:${log.date}:${log.templateId ?? log.templateName ?? ''}`}|${log.exerciseInstanceId ?? exName.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), log]);
  }
  const latest = [...groups.entries()].sort(([ka, a], [kb, b]) => {
    const dateA = a.reduce((date, row) => row.date > date ? row.date : date, '');
    const dateB = b.reduce((date, row) => row.date > date ? row.date : date, '');
    return dateB.localeCompare(dateA) || Math.max(...b.map(r => r.completedAt ?? 0)) - Math.max(...a.map(r => r.completedAt ?? 0)) || ka.localeCompare(kb);
  })[0][1].sort((a, b) => (a.workingSetIndex ?? a.completedAt ?? 0) - (b.workingSetIndex ?? b.completedAt ?? 0) || a.weight - b.weight || a.reps - b.reps);
  const first = latest[0];
  const sameContext = latest.every(matchesContext);
  const knownPrescription = latest.every(row => !!row.sessionId && !!row.exerciseInstanceId
    && row.prescribedWorkingSets === count && sameRange(row.prescribedRepRange, targetReps)
    && Number.isInteger(row.workingSetIndex) && row.workingSetIndex! >= 0 && row.workingSetIndex! < count);
  const complete = knownPrescription && latest.length === count && new Set(latest.map(row => row.workingSetIndex)).size === count;
  const qualified = sameContext && complete && latest.every(row => row.reps >= max);
  const compatible = sameContext && latest.every(row => sameRange(row.prescribedRepRange, targetReps));
  const step = equipmentStep(weightIncrement, paired, units === 'metric' ? paired ? 2.5 : 1.25 : paired ? 5 : 2.5);
  const previousSets = latest.map(row => ({ weight: row.weight, reps: row.reps }));
  // Preserve differing working loads when the set layout is comparable; never
  // replace a heavy/back-off prescription with a single selected set's load.
  const previousForIndex = (i: number) => latest.length === count ? latest[i] : first;
  const sets = Array.from({ length: count }, (_, i) => {
    const prior = previousForIndex(i);
    const weight = round(qualified ? Math.max(barWeight ?? 0, prior.weight + (isAssisted(exName) ? -step : step)) : prior.weight);
    const loadChanged = Math.abs(weight - prior.weight) > 1e-5;
    const reps = qualified && loadChanged ? min : Math.max(min, Math.min(max, prior.reps + (compatible && !qualified ? 1 : 0)));
    return { weight, reps };
  });
  const changedLoad = qualified && sets.some((set, i) => Math.abs(set.weight - previousForIndex(i).weight) > 1e-5);
  let reason: string;
  if (changedLoad) reason = `${count === 1 ? 'The prescribed working set reached' : `All ${count} prescribed working sets reached`} ${max} reps in one completed session. ${isAssisted(exName) ? 'Reduce assistance' : 'Increase weight'} by one equipment increment and return to ${min} reps.`;
  else if (!sameContext) reason = 'Same-exercise history is shown as a starting reference. The matching routine identity is not confirmed, so it does not qualify this routine for a weight increase. Check the load and rep target.';
  else if (!knownPrescription) reason = 'Keep the previous load. This history does not confirm the current prescribed set count and rep range, so it cannot qualify a weight increase.';
  else if (!complete) reason = `Keep the load. Only ${latest.length} of ${count} prescribed working sets were recorded; incomplete sessions do not qualify a weight increase.`;
  else if (qualified) reason = 'All working sets reached the target, but the equipment settings allow no further increase in difficulty. Keep the load or enter your own values.';
  else reason = `Keep the load. Last session: ${latest.map(row => row.reps).join(', ')} reps. Reach ${max} reps on all ${count} working sets before increasing; build reps within the range.`;
  const action = changedLoad ? 'increase' : compatible && sets.some((set, i) => set.reps > previousForIndex(i).reps) ? 'reps' : 'hold';
  return finish({ ...sets[0], sets, previousSets, reason, action, source: 'history', hasHistory: true,
    previous: { weight: first.weight, reps: first.reps, date: first.date } });
}

/** Only unfinished working sets change; completed sets and routine defaults stay intact. */
export function applyProgressionChoice(exercise: Exercise, choice: 'suggestion' | 'previous' | 'manual', manual?: { weight: number; reps: number }): Exercise {
  const recommendation = exercise.recommendation;
  const fallback = choice === 'manual' ? manual : choice === 'previous' ? recommendation?.previous : recommendation;
  if (!recommendation || !fallback || !Number.isFinite(fallback.weight) || fallback.weight < 0 || !Number.isInteger(fallback.reps) || fallback.reps < 1) return exercise;
  const prescriptions = choice === 'suggestion' ? recommendation.sets : choice === 'previous' ? recommendation.previousSets : undefined;
  let index = 0;
  const sets = exercise.sets.map(set => {
    if (!isWorking(set)) return set;
    const position = index++;
    if (prescriptions && !prescriptions[position]) return set;
    const values = prescriptions?.[position] ?? fallback;
    if (set.completed || !Number.isFinite(values.weight) || values.weight < 0 || !Number.isInteger(values.reps) || values.reps < 1) return set;
    return { ...set, weight: convertWeight(values.weight, recommendation.unit ?? exercise.sets[0]?.unit ?? 'kgs', set.unit), reps: values.reps };
  });
  return { ...exercise, recommendation: { ...recommendation, choice, needsStartingLoad: false }, sets };
}

export function constrainRecommendation(recommendation: ProgressionRecommendation, name: string, units: 'metric' | 'imperial', increment?: number, base?: number, loadingMode?: LoadingMode): ProgressionRecommendation {
  if (increment === undefined && base === undefined) return recommendation;
  const unit = units === 'metric' ? 'kg' : 'lb';
  const paired = (loadingMode ?? defaultLoadingMode(name)) === 'paired';
  const step = (increment ?? (base !== undefined ? unit === 'kg' ? 1.25 : 2.5 : unit === 'kg' ? 0.5 : 5)) * (paired ? 2 : 1);
  const snap = (weight: number) => roundToGymWeight(weight, units === 'metric' ? 'kg' : 'lbs', [], increment, base, paired);
  const weight = snap(recommendation.weight);
  const reason = recommendation.reason.split(' Equipment:')[0];
  return { ...recommendation, weight, sets: recommendation.sets?.map(set => ({ ...set, weight: snap(set.weight) })), equipment: { base: base ?? 0, step }, reason: `${reason} Equipment: ${formatWeight(base ?? 0)} ${unit} starting weight plus ${formatWeight(step)} ${unit} total steps${paired ? ' (plates added on both sides)' : ''}; suggested total ${formatWeight(weight)} ${unit}.` };
}

/** A deterministic preview, checked again before applying to avoid stale edits. */
export function previewWeightIncrease(exercise: Exercise, library: ExerciseLibraryItem[]) {
  const assisted = isAssisted(exercise.name);
  const changes = exercise.sets.filter(set => !set.completed && isWorking(set)).map(set => ({
    id: set.id, from: set.weight, to: adjustEquipmentWeight(set.weight, assisted ? -1 : 1, exercise.name, library, set.unit), unit: set.unit,
  })).filter(change => Math.abs(change.to - change.from) > 1e-6);
  return { fingerprint: JSON.stringify(exercise.sets), changes, assisted };
}
export function applyWeightIncrease(exercise: Exercise, preview: ReturnType<typeof previewWeightIncrease>): Exercise {
  if (JSON.stringify(exercise.sets) !== preview.fingerprint) throw new Error('The exercise changed. Review the weight increase again.');
  return { ...exercise, recommendation: exercise.recommendation ? { ...exercise.recommendation, choice: 'manual', needsStartingLoad: false } : undefined,
    sets: exercise.sets.map(set => { const change = preview.changes.find(item => item.id === set.id); return change ? { ...set, weight: change.to } : set; }) };
}
