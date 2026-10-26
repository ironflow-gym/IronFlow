import type { HistoricalLog, ProgressionRecommendation, Exercise } from '../types';
import { roundToGymWeight, sanitizeHistoryForWeights, parseRepRange, getProgressionSuggestion, calcE1RM } from './utils';

export function convertWeight(weight: number, from: string, to: string): number {
  const pounds = /^(lb|lbs)$/i;
  return pounds.test(from) === pounds.test(to) ? weight : pounds.test(from) ? weight * 0.45359237 : weight / 0.45359237;
}

// Extracted from App.tsx: preserve its progression paths, rounding and thresholds.
export const getWeightRecommendation = (
    units: 'metric' | 'imperial',
    exName: string,
    category: string,
    history: HistoricalLog[],
    templateWeight: number,
    targetReps: string | number | undefined,
    lastRefreshed?: number,
    templateName?: string,
    rationale?: string,
    weightIncrement?: number,
    barWeight?: number
  ): ProgressionRecommendation & { hasHistory: boolean } => {
    const unit = units === 'metric' ? 'kg' : 'lb';
    const weightUnit = units === 'metric' ? 'kg' : 'lbs';
    const isBilateral = /(barbell|squat|bench|deadlift|press|hack|row|leg press)/i.test(exName);
    const { min: repMin, max: repMax } = parseRepRange(targetReps);
    const targetRepMid = (repMin + repMax) / 2;

    // Detect dumbbell exercises by name — weight is logged per side, not total.
    const isDumbbellExercise = (name: string): boolean => {
      const n = name.toLowerCase();
      return n.includes('dumbbell') || n.startsWith('db ') ||
        n.includes(' db ') || n.includes('d/b') || n.includes('db-');
    };

    // Target exercise is dumbbell — weights already in the correct per-side frame.
    const targetIsDumbbell = isDumbbellExercise(exName);

    // Normalise a historical log's weight to a comparable bilateral total.
    // Dumbbell logs are per-side → multiply by 2 to get total load.
    // Used only when comparing across exercises (Paths C/D/E).
    // When comparing an exercise to itself (Paths A/B), no normalisation is needed —
    // both reference and target are in the same per-side or total frame.
    const toBilateralTotal = (h: HistoricalLog): number =>
      isDumbbellExercise(h.exercise) ? h.weight * 2 : h.weight;

    // Convert a bilateral total back to the target exercise's native frame.
    // If the target is a dumbbell exercise, halve it (per-side); otherwise leave it.
    const fromBilateralTotal = (total: number): number =>
      targetIsDumbbell ? total / 2 : total;

    // Sanitized history sorted newest-first. Reliable for imported logs
    // (date string sort, not completedAt which can be 0 for imported data).
    const cleanHistory = sanitizeHistoryForWeights(history.map(h => ({ ...h, weight: convertWeight(h.weight, h.unit, units === 'metric' ? 'kgs' : 'lbs'), unit: units === 'metric' ? 'kgs' : 'lbs' })));
    const exerciseHistory = cleanHistory
      .filter(h => h.exercise.toLowerCase() === exName.toLowerCase())
      .sort((a, b) => b.date.localeCompare(a.date));

    const usedWeights = exerciseHistory.map(h => h.weight);
    // round() snaps the loadable portion to equipment increments and enforces
    // the barWeight floor. isBilateral drives per-side vs total snapping.
    const round = (w: number) => {
      const snapped = roundToGymWeight(w, weightUnit, usedWeights, weightIncrement, barWeight, isBilateral);
      return barWeight !== undefined ? Math.max(snapped, barWeight) : snapped;
    };

    // Helper: given a historical log entry with a potentially different rep range,
    // project its weight to the current program's rep target via e1RM.
    // Takes normalised bilateral total as input, returns target-native weight.
    // If the rep ranges are close (within 2 reps) we trust the raw weight directly.
    const projectWeightFromBilateral = (bilateralTotal: number, reps: number): number => {
      const repDelta = Math.abs(reps - targetRepMid);
      if (repDelta <= 2) return fromBilateralTotal(bilateralTotal);
      const e1rm = calcE1RM(bilateralTotal, reps);
      const projected = e1rm / (1 + targetRepMid / 30) * 0.95;
      return fromBilateralTotal(Math.max(projected, 0));
    };

    // Same-exercise projection (Paths A/B) — no bilateral normalisation needed.
    const projectWeightSameExercise = (h: HistoricalLog): number => {
      const repDelta = Math.abs(h.reps - targetRepMid);
      if (repDelta <= 2) return h.weight;
      const e1rm = calcE1RM(h.weight, h.reps);
      const projected = e1rm / (1 + targetRepMid / 30) * 0.95;
      return Math.max(projected, 0);
    };

    // Helper: parse explicit percentage guidance from the AI rationale field.
    // Recognises patterns like "Start at 70% of your 1RM", "Use 80% 1RM", "65% of max".
    const parseRationalePercentage = (): number | null => {
      if (!rationale) return null;
      const match = rationale.match(/(\d{2,3})\s*%\s*(?:of\s+)?(?:your\s+)?(?:1\s*RM|1RM|max|one[\s-]rep\s+max)/i);
      if (!match) return null;
      const pct = parseInt(match[1]);
      if (pct < 30 || pct > 100) return null; // sanity gate
      return pct / 100;
    };

    // ── Path A: same-protocol history exists — highest priority ─────────────
    // Prefer sets logged under the same template name. This ensures that when
    // a user runs Day 2 of PPL, the weight for Bench Press is based on what
    // they actually lifted in Day 1 of PPL — not a heavier single they did in
    // a different program with a completely different set/rep context.
    // Same exercise → same weight frame → no bilateral normalisation needed.
    if (templateName && exerciseHistory.length > 0) {
      const sameProtocol = exerciseHistory.filter(
        h => h.templateName && h.templateName.toLowerCase() === templateName.toLowerCase()
      );
      if (sameProtocol.length > 0) {
        const last = sameProtocol[0];
        return { ...getProgressionSuggestion(last.weight, last.reps, targetReps, weightUnit, isBilateral, usedWeights), source: 'history', previous: { weight: last.weight, reps: last.reps, date: last.date }, hasHistory: true };
      }
    }

    // ── Path B: cross-protocol history — rep-range adjusted ─────────────────
    // Exercise has been done before but under a different program. Same exercise
    // → same weight frame (both DB or both barbell) → no bilateral normalisation.
    if (exerciseHistory.length > 0) {
      const last = exerciseHistory[0];
      const repDelta = Math.abs(last.reps - targetRepMid);

      if (repDelta <= 2) {
        return { ...getProgressionSuggestion(last.weight, last.reps, targetReps, weightUnit, isBilateral, usedWeights), source: 'history', previous: { weight: last.weight, reps: last.reps, date: last.date }, hasHistory: true };
      }

      const projected = round(projectWeightSameExercise(last));
      return {
        weight: projected,
        reps: repMin,
        reason: `${projected}${unit} — projected from your ${last.exercise} history (${last.weight}${unit} × ${last.reps} reps) scaled to this program's ${repMin}–${repMax} rep range. Adjust if needed — different protocol context.`,
        source: 'history', previous: { weight: last.weight, reps: last.reps, date: last.date }, hasHistory: true
      };
    }

    // ── Path C: no history — rationale guidance takes priority ───────────────
    // Uses category history which may mix dumbbell and barbell exercises.
    // Normalise all to bilateral total before computing e1RM, then convert
    // the result back to the target exercise's native weight frame.
    const rationalePercent = parseRationalePercentage();
    const categoryHistory = cleanHistory
      .filter(h => h.category.toLowerCase() === category.toLowerCase())
      .sort((a, b) => b.date.localeCompare(a.date));

    if (rationalePercent !== null && categoryHistory.length > 0) {
      const catE1RM = Math.max(...categoryHistory.slice(0, 10).map(h =>
        calcE1RM(toBilateralTotal(h), h.reps)
      ));
      if (catE1RM > 0) {
        const guidedTotal = catE1RM * rationalePercent;
        const guided = round(fromBilateralTotal(guidedTotal));
        const frameNote = targetIsDumbbell ? ' per side' : '';
        return {
          weight: guided,
          reps: repMin,
          reason: `${guided}${unit}${frameNote} — derived from program guidance (${Math.round(rationalePercent * 100)}% of estimated 1RM from your ${category} history).`,
          source: 'related', hasHistory: false
        };
      }
    }

    // ── Path D: AI suggestedWeight — sanity-clamped against category average ─
    // Category average normalised to bilateral total for comparison, then
    // converted back to target frame for the clamp check.
    if (templateWeight > 0 && lastRefreshed && (Date.now() - lastRefreshed < 24 * 60 * 60 * 1000)) {
      if (categoryHistory.length > 0) {
        const catAvgBilateral = categoryHistory.slice(0, 10)
          .reduce((s, h) => s + toBilateralTotal(h), 0) / Math.min(categoryHistory.length, 10);
        // templateWeight is in the target exercise's native frame; convert to bilateral for comparison
        const templateWeightBilateral = targetIsDumbbell ? templateWeight * 2 : templateWeight;
        const clamped = templateWeightBilateral >= catAvgBilateral * 0.6 && templateWeightBilateral <= catAvgBilateral * 1.4;
        if (clamped) {
          const rounded = round(templateWeight);
          const frameNote = targetIsDumbbell ? ' per side' : '';
          return { weight: rounded, reps: repMin, reason: `${rounded}${unit}${frameNote} — AI starting estimate from program design. Adjust freely.`, source: 'routine', hasHistory: false };
        }
        // Failed clamp — fall through to category average
      } else {
        const rounded = round(templateWeight);
        const frameNote = targetIsDumbbell ? ' per side' : '';
        return { weight: rounded, reps: repMin, reason: `${rounded}${unit}${frameNote} — AI starting estimate, no prior history. Adjust freely.`, source: 'routine', hasHistory: false };
      }
    }

    // ── Path E: category average — same muscle group, no exact match ─────────
    // Cross-exercise comparison: normalise source to bilateral total, project
    // for rep range, then convert to target frame.
    if (categoryHistory.length > 0) {
      const ref = categoryHistory[0];
      const refBilateral = toBilateralTotal(ref);
      const projected = round(projectWeightFromBilateral(refBilateral, ref.reps));
      const frameNote = targetIsDumbbell ? ' per side' : '';
      const sourceNote = isDumbbellExercise(ref.exercise)
        ? `${ref.weight}${unit}/side (${ref.weight * 2}${unit} total)`
        : `${ref.weight}${unit}`;
      return {
        weight: projected,
        reps: repMin,
        reason: `${projected}${unit}${frameNote} — estimated from your ${ref.exercise} history (${sourceNote}), scaled to this program's rep range.`,
        source: 'related', hasHistory: false
      };
    }

    // ── Path F: absolute fallback — no data anywhere ─────────────────────────
    const fallback = round(templateWeight > 0 ? templateWeight : 20);
    const frameNote = targetIsDumbbell ? ' per side' : '';
    return { weight: fallback, reps: repMin, reason: `${fallback}${unit}${frameNote} — no history found, adjust to a weight you know is right.`, source: 'routine', hasHistory: false };
  };


/** Only uncompleted working sets change. Completed sets, warmups and deloads remain intact. */
export function applyProgressionChoice(exercise: Exercise, choice: 'suggestion' | 'previous' | 'manual', manual?: { weight: number; reps: number }): Exercise {
  const recommendation = exercise.recommendation;
  const values = choice === 'manual' ? manual : choice === 'previous' ? recommendation?.previous : recommendation;
  if (!recommendation || !values || !Number.isFinite(values.weight) || values.weight < 0 || !Number.isInteger(values.reps) || values.reps < 1) return exercise;
  return { ...exercise, recommendation: { ...recommendation, choice }, sets: exercise.sets.map(set => {
    if (set.completed || set.isWarmup || set.isDeload) return set;
    const weight = convertWeight(values.weight, recommendation.unit ?? exercise.sets[0]?.unit ?? 'kgs', set.unit);
    return { ...set, weight, reps: values.reps };
  }) };
}
