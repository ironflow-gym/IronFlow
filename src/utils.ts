export const isCardioCategory = (cat: string) => {
  const c = cat.toLowerCase();
  return c.includes('cardio') || c.includes('running') || c.includes('cycling') || c.includes('rowing') || c.includes('swimming') || c.includes('endurance') || c.includes('hiit');
};

export const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const isAssisted = (name: string): boolean =>
  name.toLowerCase().includes('assisted');

/**
 * Derives science-based macro ratios from the user's goal and dietary preferences.
 *
 * Returns:
 *   proteinRatio        — g of protein per kg bodyweight
 *   carbCalorieFraction — fraction of post-protein calories allocated to carbs
 *   fatCalorieFraction  — fraction of post-protein calories allocated to fats
 *
 * Scientific basis:
 *   - Protein targets: ISSN Position Stand (Jäger et al. 2017)
 *   - Vegan/vegetarian uplift: lower plant protein bioavailability ~80% vs ~95%
 *     (Gorissen et al. 2018; Norton & Layman 2006)
 *   - Keto macro split: <50g/day carb ceiling, fat fills remainder
 *   - Lose Fat carb/fat split: slightly higher fat for satiety (Stiegler & Cunliffe 2006)
 */
export interface MacroRatios {
  proteinRatio: number;          // g per kg bodyweight
  carbCalorieFraction: number;   // share of remaining kcal (after protein) for carbs
  fatCalorieFraction: number;    // share of remaining kcal (after protein) for fats
}

export function deriveMacroRatios(
  goal: 'Build Muscle' | 'Lose Fat' | 'Maintenance',
  preferences: string[]
): MacroRatios {
  const prefs = preferences.map(p => p.toLowerCase());

  const isVegan       = prefs.some(p => p.includes('vegan') || p.includes('plant-based') || p.includes('plant based'));
  const isVegetarian  = !isVegan && prefs.some(p => p.includes('vegetarian'));
  const isKeto        = prefs.some(p => p.includes('keto') || p.includes('ketogenic') || p.includes('low carb') || p.includes('low-carb'));
  const isHighProtein = prefs.some(p => p.includes('high protein') || p.includes('high-protein'));

  // ── Base protein ratio by goal (ISSN position stand) ──────────────────────
  let proteinRatio =
    goal === 'Build Muscle' ? 1.6 :
    goal === 'Lose Fat'     ? 1.8 :   // Higher protein preserves lean mass during cut
                              1.2;    // Maintenance

  // ── Dietary adjustments to protein ────────────────────────────────────────
  // Vegan: ~15% uplift to compensate for lower plant protein bioavailability
  // Vegetarian (includes dairy/eggs): ~8% uplift (smaller gap)
  if (isVegan)            proteinRatio = proteinRatio * 1.15;
  else if (isVegetarian)  proteinRatio = proteinRatio * 1.08;

  // High-protein preference: floor at 2.2 g/kg, uplift still applies
  if (isHighProtein) proteinRatio = Math.max(proteinRatio, 2.2);

  // Clamp to physiologically safe range (ISSN upper ceiling ~3.1 g/kg in
  // highly trained athletes; 2.8 is a conservative safe maximum for this app)
  proteinRatio = Math.min(2.8, proteinRatio);

  // ── Carb / fat split of remaining calories ────────────────────────────────
  if (isKeto) {
    // Ketogenic: carbs strictly minimal (<50g/day), fat fills the rest
    return { proteinRatio, carbCalorieFraction: 0.08, fatCalorieFraction: 0.92 };
  }

  if (goal === 'Lose Fat') {
    // Slightly higher fat fraction → greater satiety during a deficit
    return { proteinRatio, carbCalorieFraction: 0.45, fatCalorieFraction: 0.55 };
  }

  // Build Muscle / Maintenance (including plant-based — legumes & grains are
  // carbohydrate-rich protein sources, so a carb-forward split is appropriate)
  return { proteinRatio, carbCalorieFraction: 0.58, fatCalorieFraction: 0.42 };
}

// =============================================================================
// Desktop Stats Utilities
// =============================================================================

import type { HistoricalLog } from '../types';

/** Maps exercise category strings to one of 14 canonical muscle groups. */
export function getMuscleGroup(category: string, primaryMuscle?: string): string {
  // Prefer the richer primary muscle tag written at log time (e.g. "Lats", "Quadriceps")
  const source = (primaryMuscle || category).toLowerCase();
  const c = source;
  if (c.includes('chest') || c.includes('pec'))                          return 'Chest';
  if (c.includes('front delt') || c.includes('anterior'))                return 'Front Delts';
  if (c.includes('side delt') || c.includes('lateral delt'))             return 'Side Delts';
  if (c.includes('rear delt') || c.includes('posterior delt') || c.includes('face pull')) return 'Rear Delts';
  if (c.includes('shoulder') || c.includes('delt') || c.includes('overhead')) return 'Side Delts';
  if (c.includes('bicep') || c.includes('curl'))                         return 'Biceps';
  if (c.includes('tricep') || c.includes('pushdown') || c.includes('extension')) return 'Triceps';
  if (c.includes('upper back') || c.includes('row') || c.includes('rhomboid') || c.includes('mid back')) return 'Upper Back';
  if (c.includes('lat') || c.includes('pulldown') || c.includes('pull-up') || c.includes('pullup')) return 'Lats';
  if (c.includes('trap') || c.includes('shrug'))                         return 'Traps';
  if (c.includes('quad') || c.includes('leg press') || c.includes('squat')) return 'Quads';
  if (c.includes('hamstring') || c.includes('deadlift') || c.includes('leg curl')) return 'Hamstrings';
  if (c.includes('glute') || c.includes('hip thrust') || c.includes('hip extension')) return 'Glutes';
  if (c.includes('calf') || c.includes('calves') || c.includes('gastro')) return 'Calves';
  if (c.includes('core') || c.includes('abs') || c.includes('plank') || c.includes('crunch')) return 'Core';
  if (c.includes('back'))                                                 return 'Upper Back';
  if (c.includes('arm'))                                                  return 'Biceps';
  if (c.includes('leg'))                                                  return 'Quads';
  return 'Other';
}

/**
 * Epley e1RM formula. Reps capped at 36 to avoid extrapolation artefacts.
 * Returns weight if reps === 1 (exact 1RM).
 */
export function calcE1RM(weight: number, reps: number): number {
  if (weight <= 0) return 0;
  const r = Math.min(reps, 36);
  if (r <= 1) return weight;
  return weight * (1 + r / 30);
}

/**
 * Rounds a suggested weight to the nearest practical gym increment,
 * unless the exact weight has already been used for this exercise in
 * sanitized history (in which case it is returned unchanged — the user
 * has actually lifted that value and the equipment supports it).
 *
 * Increments:
 *   kg  → nearest 0.5 kg
 *   lbs → nearest 5 lbs
 *
 * usedWeights should be pre-filtered through sanitizeHistory so warmups,
 * cardio, and statistical warmups are excluded.
 */
export function roundToGymWeight(
  weight: number,
  unit: 'kg' | 'lbs',
  usedWeights: number[]
): number {
  if (weight <= 0) return weight;
  // If this exact value appears in sanitized history, the user has used it —
  // preserve it as-is regardless of whether it falls on a standard increment.
  if (usedWeights.includes(weight)) return weight;
  const increment = unit === 'lbs' ? 5 : 0.5;
  return Math.round(weight / increment) * increment;
}

/**
 * Exported wrapper around the sanitization logic used by GeminiService —
 * warmups stripped, cardio excluded, statistical warmups removed, 6-month
 * window applied. Used by App.tsx getWeightRecommendation to ensure weight
 * comparisons use only real working sets.
 */
export function sanitizeHistoryForWeights(history: HistoricalLog[]): HistoricalLog[] {
  const now = new Date().getTime();
  const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
  const resistanceOnly = history.filter(log => !isCardioCategory(log.category));

  const dailyExercisePeaks: Record<string, number> = {};
  resistanceOnly.forEach(log => {
    const key = `${log.date}_${log.exercise}`;
    const assisted = isAssisted(log.exercise);
    if (!dailyExercisePeaks[key] ||
        (assisted ? log.weight < dailyExercisePeaks[key] : log.weight > dailyExercisePeaks[key])) {
      dailyExercisePeaks[key] = log.weight;
    }
  });

  return resistanceOnly.filter(log => {
    const [y, m, d] = log.date.split('-').map(Number);
    const logDate = new Date(y, m - 1, d).getTime();
    if ((now - logDate) > SIX_MONTHS_MS) return false;
    const peakWeight = dailyExercisePeaks[`${log.date}_${log.exercise}`] || 0;
    const isStatisticalWarmup = !isAssisted(log.exercise) &&
      peakWeight > 0 && log.weight <= (peakWeight * 0.6);
    return !log.isWarmup && !isStatisticalWarmup;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Parses a rep range string into { min, max }.
 * Handles: "8-12", "8–12", "10", "8-10 reps", "8 to 12", etc.
 * Single number → min === max.
 */
export function parseRepRange(targetReps: string | number | undefined): { min: number; max: number } {
  if (!targetReps) return { min: 8, max: 12 };
  const s = String(targetReps).trim();
  // Range with hyphen, en-dash, or "to"
  const rangeMatch = s.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/i);
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1]);
    const b = parseInt(rangeMatch[2]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  // Single number
  const single = parseInt(s.match(/\d+/)?.[0] || '');
  if (!isNaN(single) && single > 0) return { min: single, max: single };
  return { min: 8, max: 12 };
}

/**
 * Double-progression suggestion: given the most recent working set for an
 * exercise and the template rep range, returns the next weight and target
 * reps to pre-populate.
 *
 * Logic:
 * - Last reps >= max of range → increase weight by one increment, target = min
 * - Last reps < min of range  → hold weight, target = min (something regressed)
 * - Otherwise                 → hold weight, target = last reps + 1
 *
 * The increment is the smallest practical gym plate step for the unit.
 * Bilateral compounds (barbell movements) get a larger step than isolation/
 * unilateral work.
 */
export function getProgressionSuggestion(
  lastWeight: number,
  lastReps: number,
  targetReps: string | number | undefined,
  unit: 'kg' | 'lbs',
  isBilateral: boolean,
  usedWeights: number[]
): { weight: number; reps: number; reason: string } {
  const { min, max } = parseRepRange(targetReps);
  const increment = unit === 'lbs'
    ? (isBilateral ? 5 : 2.5)
    : (isBilateral ? 2.5 : 1.25);

  if (lastReps >= max) {
    // Hit top of range — add weight, reset reps to bottom of range
    const newWeight = roundToGymWeight(lastWeight + increment, unit, usedWeights);
    return {
      weight: newWeight,
      reps: min,
      reason: `⬆ Weight up to ${newWeight}${unit} — you hit ${lastReps} reps last session, time to progress.`
    };
  }

  if (lastReps < min) {
    // Below range — hold weight, aim for bottom of range
    const held = roundToGymWeight(lastWeight, unit, usedWeights);
    return {
      weight: held,
      reps: min,
      reason: `Hold at ${held}${unit} — last session was ${lastReps} reps, aim for ${min} today.`
    };
  }

  // Within range — hold weight, add one rep
  const held = roundToGymWeight(lastWeight, unit, usedWeights);
  return {
    weight: held,
    reps: lastReps + 1,
    reason: `${held}${unit} — aim for ${lastReps + 1} reps today (was ${lastReps} last session).`
  };
}

/**
 * Calculates the 4-week e1RM trend for a single exercise.
 *
 * Splits the last 28 days into two equal fortnights:
 *   - older:  days 15–28 ago
 *   - recent: days 1–14 ago
 *
 * Compares the peak e1RM in each window:
 *   - 'up'   : recent peak is >2.5% above older peak
 *   - 'down' : recent peak is >2.5% below older peak
 *   - 'flat' : within ±2.5%
 *   - null   : insufficient data (no sessions in one or both windows)
 *
 * Warmups and cardio are excluded. Assisted exercises use inverted
 * comparison (lower weight = better).
 */
export function getExerciseTrend(
  exerciseName: string,
  history: HistoricalLog[]
): 'up' | 'flat' | 'down' | null {
  const now = Date.now();
  const DAY_MS = 86400000;
  const assisted = isAssisted(exerciseName);

  const workingSets = history.filter(h =>
    h.exercise.toLowerCase() === exerciseName.toLowerCase() &&
    !h.isWarmup &&
    !isCardioCategory(h.category) &&
    h.weight > 0 &&
    h.reps > 0
  );

  if (workingSets.length === 0) return null;

  // Peak e1RM per day, restricted to the 28-day window
  const dailyPeak: Record<string, number> = {};
  for (const h of workingSets) {
    const [y, m, d] = h.date.split('-').map(Number);
    const age = now - new Date(y, m - 1, d).getTime();
    if (age > 28 * DAY_MS) continue;
    const e1rm = calcE1RM(h.weight, h.reps);
    if (!dailyPeak[h.date]) {
      dailyPeak[h.date] = e1rm;
    } else {
      dailyPeak[h.date] = assisted
        ? Math.min(dailyPeak[h.date], e1rm)
        : Math.max(dailyPeak[h.date], e1rm);
    }
  }

  const entries = Object.entries(dailyPeak);
  if (entries.length < 2) return null;

  // Split into older (days 15–28) and recent (days 1–14) fortnights
  const olderPeaks: number[] = [];
  const recentPeaks: number[] = [];
  for (const [date, peak] of entries) {
    const [y, m, d] = date.split('-').map(Number);
    const ageDays = (now - new Date(y, m - 1, d).getTime()) / DAY_MS;
    if (ageDays <= 14) recentPeaks.push(peak);
    else olderPeaks.push(peak);
  }

  if (olderPeaks.length === 0 || recentPeaks.length === 0) return null;

  const olderBest = assisted
    ? Math.min(...olderPeaks)
    : Math.max(...olderPeaks);
  const recentBest = assisted
    ? Math.min(...recentPeaks)
    : Math.max(...recentPeaks);

  if (olderBest === 0) return null;

  const changePct = ((recentBest - olderBest) / olderBest) * 100;
  // For assisted: lower is better, so invert the sign
  const adjustedChange = assisted ? -changePct : changePct;

  if (adjustedChange > 2.5) return 'up';
  if (adjustedChange < -2.5) return 'down';
  return 'flat';
}

/** Returns the ISO week number for a given date. */
function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Counts the most recent consecutive ISO weeks where the user logged
 * at least `weeklyGoal` distinct workout days.
 */
/**
 * Returns the best motivational strength delta for a given exercise.
 * Prefers a 3-month window; falls back to "since you started" if < 90 days of data.
 * Returns null (silent) if there is no meaningful improvement (< 5%).
 * For assisted exercises, a lower e1RM = stronger, so delta is inverted.
 */
export interface StrengthDelta {
  exerciseName: string;
  pct: number;          // always positive — represents improvement
  label: string;        // e.g. "3 months ago" | "when you started"
}

export function getStrengthDelta(
  exerciseName: string,
  history: HistoricalLog[]
): StrengthDelta | null {
  const assisted = isAssisted(exerciseName);
  const DAY_MS = 86400000;
  const now = Date.now();

  const workingSets = history.filter(h =>
    h.exercise.toLowerCase() === exerciseName.toLowerCase() &&
    !h.isWarmup &&
    !isCardioCategory(h.category) &&
    h.weight > 0 &&
    h.reps > 0
  );
  if (workingSets.length === 0) return null;

  // Build daily peak e1RM map across all time
  const dailyPeak: Record<string, number> = {};
  for (const h of workingSets) {
    const e1rm = calcE1RM(h.weight, h.reps);
    if (!dailyPeak[h.date]) {
      dailyPeak[h.date] = e1rm;
    } else {
      dailyPeak[h.date] = assisted
        ? Math.min(dailyPeak[h.date], e1rm)
        : Math.max(dailyPeak[h.date], e1rm);
    }
  }

  const dates = Object.keys(dailyPeak).sort();
  if (dates.length < 2) return null;

  const firstDate = dates[0];
  const firstAgeMs = now - new Date(firstDate).getTime();
  const hasThreeMonths = firstAgeMs >= 85 * DAY_MS;

  // Current best: peak e1RM in the last 14 days
  const recentCutoff = now - 14 * DAY_MS;
  const recentPeaks = dates
    .filter(d => new Date(d).getTime() >= recentCutoff)
    .map(d => dailyPeak[d]);
  if (recentPeaks.length === 0) return null;
  const currentBest = assisted ? Math.min(...recentPeaks) : Math.max(...recentPeaks);

  let baselineBest: number;
  let label: string;

  if (hasThreeMonths) {
    // Baseline: best e1RM from any session older than 75 days.
    // Using a broad window rather than a narrow band avoids the common case
    // where the user has no session in a specific 2-week range, which previously
    // fell back to all-time-earliest and inflated the delta badly.
    const baselineCutoff = now - 75 * DAY_MS;
    const baselinePeaks = dates
      .filter(d => new Date(d).getTime() <= baselineCutoff)
      .map(d => dailyPeak[d]);
    if (baselinePeaks.length === 0) return null;
    baselineBest = assisted ? Math.min(...baselinePeaks) : Math.max(...baselinePeaks);
    label = '3 months ago';
  } else {
    // Fallback: best e1RM in the first 14 days of logging this exercise.
    // Using a 14-day window rather than just day one prevents a single light
    // exploratory session from becoming an artificially low baseline.
    const startCutoff = new Date(firstDate).getTime() + 14 * DAY_MS;
    const startPeaks = dates
      .filter(d => new Date(d).getTime() <= startCutoff)
      .map(d => dailyPeak[d]);
    baselineBest = assisted ? Math.min(...startPeaks) : Math.max(...startPeaks);
    label = 'when you started';
  }

  if (!baselineBest || baselineBest === 0) return null;

  const rawDelta = assisted
    ? (baselineBest - currentBest) / baselineBest
    : (currentBest - baselineBest) / baselineBest;

  const pct = Math.round(rawDelta * 100);

  // Sanity cap — anything above 150% over a training period is almost certainly
  // a data artefact (e.g. first session was a very light technique session).
  // Return null rather than surface a misleading number.
  if (pct > 150) return null;

  if (pct < 5) return null;

  return { exerciseName, pct, label };
}

/**
 * Across all exercises in history, returns the single most impressive
 * StrengthDelta — the one with the highest pct improvement.
 * Used to power the hero card on the history overview.
 */
export function getBestStrengthDelta(history: HistoricalLog[]): StrengthDelta | null {
  const exercises = [...new Set(
    history
      .filter(h => !h.isWarmup && !isCardioCategory(h.category) && h.weight > 0 && h.reps > 0)
      .map(h => h.exercise)
  )];

  let best: StrengthDelta | null = null;
  for (const ex of exercises) {
    const delta = getStrengthDelta(ex, history);
    if (delta && (!best || delta.pct > best.pct)) best = delta;
  }
  return best;
}

export function calcWeeklyStreak(logs: HistoricalLog[], weeklyGoal: number): number {
  if (logs.length === 0) return 0;

  // Build map: isoWeek → Set of distinct dates
  const weekDays: Record<string, Set<string>> = {};
  logs.forEach(log => {
    const w = isoWeek(new Date(log.date));
    if (!weekDays[w]) weekDays[w] = new Set();
    weekDays[w].add(log.date);
  });

  // Walk weeks backwards from current week
  const today = new Date();
  let streak = 0;
  const checked = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  for (let i = 0; i < 104; i++) { // max 2 year scan
    const weekKey = isoWeek(checked);
    const days = weekDays[weekKey]?.size ?? 0;

    // Allow current (partial) week to count if already met goal
    if (i === 0 && days < weeklyGoal) {
      // current week not yet met — don't break, just skip it
      checked.setUTCDate(checked.getUTCDate() - 7);
      continue;
    }
    if (days >= weeklyGoal) {
      streak++;
      checked.setUTCDate(checked.getUTCDate() - 7);
    } else {
      break;
    }
  }
  return streak;
}

export interface WeeklyMuscleData {
  week: string;         // ISO week label e.g. "W12"
  [muscleGroup: string]: number | string;
}

/**
 * Returns per-ISO-week set counts per muscle group for trailing N weeks.
 */
export function getWeeklySetsPerMuscleGroup(logs: HistoricalLog[], weeks: number): WeeklyMuscleData[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - weeks * 7);

  const recent = logs.filter(l => new Date(l.date) >= cutoff && !l.isWarmup);

  // Aggregate sets per week per muscle group
  const weekData: Record<string, Record<string, number>> = {};
  recent.forEach(log => {
    const w = isoWeek(new Date(log.date));
    const mg = getMuscleGroup(log.category, log.primaryMuscle);
    if (mg === 'Other') return;
    if (!weekData[w]) weekData[w] = {};
    weekData[w][mg] = (weekData[w][mg] || 0) + 1;
  });

  // Build sorted week array for trailing N weeks
  const result: WeeklyMuscleData[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    const w = isoWeek(d);
    const weekNum = w.split('-W')[1];
    result.push({ week: `W${weekNum}`, ...(weekData[w] || {}) });
  }
  return result;
}

/**
 * Counts exercises where the best e1RM this calendar month
 * exceeds the best e1RM last calendar month.
 */
export function getMonthlyPRs(logs: HistoricalLog[]): number {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonth = logs.filter(l => new Date(l.date) >= thisMonthStart && !l.isWarmup);
  const lastMonth = logs.filter(l => {
    const d = new Date(l.date);
    return d >= lastMonthStart && d < thisMonthStart && !l.isWarmup;
  });

  const bestE1RM = (entries: HistoricalLog[]): Record<string, number> => {
    const bests: Record<string, number> = {};
    entries.forEach(l => {
      const e = calcE1RM(l.weight, l.reps);
      if (!bests[l.exercise] || e > bests[l.exercise]) bests[l.exercise] = e;
    });
    return bests;
  };

  const thisBests = bestE1RM(thisMonth);
  const lastBests = bestE1RM(lastMonth);

  return Object.keys(thisBests).filter(ex =>
    thisBests[ex] > (lastBests[ex] ?? 0)
  ).length;
}

export interface PRResult {
  e1rm: number;       // new e1RM in kg
  prevBest: number;   // previous best e1RM in kg
  delta: number;      // improvement in kg (rounded)
}

/**
 * Determines whether a given set constitutes a personal record for that exercise.
 *
 * Rules:
 *  - 90-day rolling window only
 *  - Warmups and statistical warmups excluded from both candidate and history
 *  - At least 2 prior *sessions* (distinct dates) must exist for the exercise
 *    in the window — otherwise returns null (insufficient baseline)
 *  - Must beat the best e1RM across those prior sessions
 *  - Cardio exercises excluded (caller should gate on isCardioCategory)
 *  - weight param should already be in kg
 *
 * Returns a PRResult if it's a PR, otherwise null.
 */
export function isPR(
  exerciseName: string,
  weightKg: number,
  reps: number,
  history: HistoricalLog[],
  sessionDate: string  // YYYY-MM-DD of the current session
): PRResult | null {
  if (weightKg <= 0 || reps <= 0) return null;

  const WINDOW_DAYS = 90;
  const MIN_PRIOR_SESSIONS = 2;

  const windowStart = new Date(sessionDate);
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  // Filter history to prior sessions for this exercise within the window.
  // Exclude warmups; statistical warmup exclusion uses per-date peak weight.
  const exerciseLogs = history.filter(h =>
    h.exercise.toLowerCase() === exerciseName.toLowerCase() &&
    h.date < sessionDate &&
    h.date >= windowStartStr &&
    !h.isWarmup &&
    !isCardioCategory(h.category ?? '')
  );

  if (exerciseLogs.length === 0) return null;

  // Build per-date peak weights to identify statistical warmups
  const datePeaks: Record<string, number> = {};
  exerciseLogs.forEach(h => {
    const wKg = h.unit === 'lbs' ? h.weight * 0.453592 : h.weight;
    if (!datePeaks[h.date] || wKg > datePeaks[h.date]) datePeaks[h.date] = wKg;
  });

  // Remove statistical warmups (≤60% of their date's peak)
  const effectiveLogs = exerciseLogs.filter(h => {
    const wKg = h.unit === 'lbs' ? h.weight * 0.453592 : h.weight;
    return wKg > (datePeaks[h.date] ?? 0) * 0.6;
  });

  // Count distinct prior session dates
  const priorDates = new Set(effectiveLogs.map(h => h.date));
  if (priorDates.size < MIN_PRIOR_SESSIONS) return null;

  // Best e1RM across prior sessions
  const prevBest = effectiveLogs.reduce((best, h) => {
    const wKg = h.unit === 'lbs' ? h.weight * 0.453592 : h.weight;
    const e = calcE1RM(wKg, h.reps);
    return e > best ? e : best;
  }, 0);

  const candidateE1RM = calcE1RM(weightKg, reps);
  if (candidateE1RM <= prevBest) return null;

  return {
    e1rm: Math.round(candidateE1RM * 10) / 10,
    prevBest: Math.round(prevBest * 10) / 10,
    delta: Math.round((candidateE1RM - prevBest) * 10) / 10,
  };
}

/**
 * Returns a gentle deload nudge if a muscle group has been trained 3+ times
 * in the last 7 days AND its e1RM has not improved (flat or declining).
 *
 * Returns the name of the most overreached muscle group, or null if no nudge
 * is warranted.
 */
/**
 * One-shot migration: enriches existing HistoricalLog entries that lack a
 * primaryMuscle by looking up the exercise name in the combined library.
 *
 * Returns a new array only when at least one log was changed; returns the
 * original reference unchanged when nothing needed backfilling, so the caller
 * can cheaply detect whether a write-back is necessary.
 */
export function backfillPrimaryMuscles(
  logs: HistoricalLog[],
  library: { name: string; muscles: string[] }[]
): { logs: HistoricalLog[]; changed: boolean } {
  // Build a fast lookup map: lowercase name → muscles[0]
  const muscleMap = new Map<string, string>();
  library.forEach(item => {
    if (item.muscles?.[0]) {
      muscleMap.set(item.name.toLowerCase(), item.muscles[0]);
    }
  });

  let changed = false;
  const enriched = logs.map(log => {
    if (log.primaryMuscle !== undefined) return log; // already set
    const primary = muscleMap.get(log.exercise.toLowerCase());
    if (!primary) return log; // not in library — leave untouched
    changed = true;
    return { ...log, primaryMuscle: primary };
  });

  return { logs: changed ? enriched : logs, changed };
}

/**
 * Milestone ladder per exercise category (kg).
 * Maps a lowercase keyword to an ordered array of meaningful round-number targets.
 * The function picks the first milestone above the user's current e1RM.
 */
const MILESTONE_LADDERS: { keywords: string[]; milestones: number[] }[] = [
  { keywords: ['bench', 'press', 'chest'],         milestones: [40,60,80,100,120,140,160,180,200] },
  { keywords: ['squat'],                            milestones: [60,80,100,120,140,160,180,200,220,240] },
  { keywords: ['deadlift'],                         milestones: [80,100,120,140,160,180,200,220,240,260] },
  { keywords: ['overhead', 'ohp', 'shoulder press'],milestones: [40,50,60,70,80,90,100,110,120] },
  { keywords: ['row', 'pull'],                      milestones: [40,60,80,100,120,140,160] },
  { keywords: ['curl', 'bicep'],                    milestones: [20,30,40,50,60,70,80] },
  { keywords: ['tricep', 'pushdown', 'extension'],  milestones: [20,30,40,50,60,70,80] },
  { keywords: ['lat pulldown'],                     milestones: [40,60,80,100,120,140] },
  { keywords: ['lunge', 'leg press', 'hack'],       milestones: [60,80,100,120,140,160,180,200] },
  { keywords: ['hip thrust', 'glute'],              milestones: [60,80,100,120,140,160,180,200] },
  { keywords: ['rdl', 'romanian'],                  milestones: [60,80,100,120,140,160,180] },
];

function getMilestoneLadder(exerciseName: string): number[] {
  const n = exerciseName.toLowerCase();
  // Longest-keyword-match wins to avoid 'press' swallowing 'overhead press'
  let best: { ladder: number[]; matchLen: number } | null = null;
  for (const entry of MILESTONE_LADDERS) {
    for (const kw of entry.keywords) {
      if (n.includes(kw)) {
        if (!best || kw.length > best.matchLen) {
          best = { ladder: entry.milestones, matchLen: kw.length };
        }
      }
    }
  }
  // Generic fallback: multiples of 20 up to 200
  return best?.ladder ?? [20,40,60,80,100,120,140,160,180,200];
}

export interface PRPrediction {
  exerciseName: string;
  currentE1RM: number;       // kg
  targetMilestone: number;   // kg
  weeksAway: number;         // projected weeks (may be fractional)
  weeklyGainKg: number;      // average weekly e1RM gain
}

/**
 * For each exercise with sufficient recent data, projects the next round-number
 * milestone and returns up to `maxLifts` lifts sorted by soonest.
 *
 * Inclusion criteria:
 * - At least 4 working sessions in the last 90 days
 * - Positive weekly gain rate
 * - Next milestone reachable within `maxWeeks`
 *
 * Uses average weekly e1RM gain (conservative) rather than regression.
 */
export function getPRPredictions(
  logs: HistoricalLog[],
  maxWeeks = 12,
  maxLifts = 5
): PRPrediction[] {
  const DAY_MS = 86400000;
  const today = new Date();
  const cutoffDate = new Date(today.getTime() - 90 * DAY_MS);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const recentLogs = logs.filter(l =>
    l.date >= cutoffStr &&
    !l.isWarmup &&
    !isCardioCategory(l.category ?? '') &&
    !isAssisted(l.exercise) &&
    l.weight > 0 &&
    l.reps > 0
  );

  // Group by exercise, build daily peak e1RM map
  const byExercise: Record<string, Record<string, number>> = {};
  for (const l of recentLogs) {
    const wKg = l.unit === 'lbs' ? l.weight * 0.453592 : l.weight;
    const e = calcE1RM(wKg, l.reps);
    if (!byExercise[l.exercise]) byExercise[l.exercise] = {};
    const prev = byExercise[l.exercise][l.date] ?? 0;
    byExercise[l.exercise][l.date] = Math.max(prev, e);
  }

  const predictions: PRPrediction[] = [];

  for (const [exerciseName, dailyPeaks] of Object.entries(byExercise)) {
    const dates = Object.keys(dailyPeaks).sort();
    if (dates.length < 4) continue; // not enough sessions

    // Current e1RM: best in last 14 days
    const recentCutoff = new Date(today.getTime() - 14 * DAY_MS).toISOString().slice(0, 10);
    const recentPeaks = dates.filter(d => d >= recentCutoff).map(d => dailyPeaks[d]);
    if (recentPeaks.length === 0) continue;
    const currentE1RM = Math.max(...recentPeaks);

    // Average weekly gain: (last e1RM - first e1RM) / weeks elapsed
    const firstE1RM = dailyPeaks[dates[0]];
    const weeksElapsed = (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / (7 * DAY_MS);
    if (weeksElapsed < 1) continue;
    const weeklyGainKg = (currentE1RM - firstE1RM) / weeksElapsed;
    if (weeklyGainKg <= 0) continue; // not progressing

    // Find next milestone above current e1RM
    const ladder = getMilestoneLadder(exerciseName);
    const target = ladder.find(m => m > currentE1RM);
    if (!target) continue;

    const weeksAway = (target - currentE1RM) / weeklyGainKg;
    if (weeksAway > maxWeeks) continue;

    predictions.push({
      exerciseName,
      currentE1RM: Math.round(currentE1RM * 10) / 10,
      targetMilestone: target,
      weeksAway: Math.round(weeksAway * 10) / 10,
      weeklyGainKg: Math.round(weeklyGainKg * 100) / 100,
    });
  }

  return predictions
    .sort((a, b) => a.weeksAway - b.weeksAway)
    .slice(0, maxLifts);
}

export interface AnniversaryData {
  yearNumber: number;
  firstSessionDate: string;
  workoutsThisYear: number;
  setsThisYear: number;
  bestDelta: StrengthDelta | null;
  weeklyStreak: number;
  bodyFatChangedPct?: number; // only populated when reduced
}

/**
 * Returns anniversary data if today falls within the +7 day window after
 * a yearly anniversary of the user's first session. Returns null otherwise.
 */
export function getAnniversaryData(
  logs: HistoricalLog[],
  biometrics: { date: string; weight: number; bodyFat?: number; unit: string }[],
  weeklyGoal: number
): AnniversaryData | null {
  if (logs.length === 0) return null;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Find the earliest session date
  const allDates = logs.map(l => l.date).sort();
  const firstDate = allDates[0];
  const firstDt = new Date(firstDate);

  // Calculate how many full years have elapsed
  const yearNumber = today.getFullYear() - firstDt.getFullYear();
  if (yearNumber < 1) return null;

  // Anniversary date for this year
  const anniversary = new Date(firstDt);
  anniversary.setFullYear(today.getFullYear());
  const anniversaryStr = anniversary.toISOString().slice(0, 10);

  // Window: anniversary to anniversary + 7 days
  const windowEnd = new Date(anniversary);
  windowEnd.setDate(windowEnd.getDate() + 7);
  const windowEndStr = windowEnd.toISOString().slice(0, 10);

  if (todayStr < anniversaryStr || todayStr > windowEndStr) return null;

  // Year window: anniversary - 1 year to anniversary
  const yearStart = new Date(anniversary);
  yearStart.setFullYear(anniversary.getFullYear() - 1);
  const yearStartStr = yearStart.toISOString().slice(0, 10);

  const yearLogs = logs.filter(l => l.date >= yearStartStr && l.date <= anniversaryStr);

  // Stats within the year
  const workoutDates = new Set(yearLogs.map(l => l.date));
  const workoutsThisYear = workoutDates.size;
  const setsThisYear = yearLogs.filter(l => !l.isWarmup && !isCardioCategory(l.category ?? '')).length;

  // Best strength delta — scoped to year logs only
  const exercises = [...new Set(
    yearLogs
      .filter(h => !h.isWarmup && !isCardioCategory(h.category) && h.weight > 0 && h.reps > 0)
      .map(h => h.exercise)
  )];
  let bestDelta: StrengthDelta | null = null;
  for (const ex of exercises) {
    const delta = getStrengthDelta(ex, yearLogs);
    if (delta && (!bestDelta || delta.pct > bestDelta.pct)) bestDelta = delta;
  }

  // Weekly streak within the year
  const weeklyStreak = calcWeeklyStreak(yearLogs, weeklyGoal);

  // Biometrics — first and last entry within the year window
  const yearBios = [...biometrics]
    .filter(b => b.date >= yearStartStr && b.date <= anniversaryStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  let bodyFatChangedPct: number | undefined;

  if (yearBios.length >= 2) {
    const first = yearBios[0];
    const last = yearBios[yearBios.length - 1];

    if (first.bodyFat != null && last.bodyFat != null) {
      const bfDelta = last.bodyFat - first.bodyFat;
      if (bfDelta < -0.5) bodyFatChangedPct = Math.round(bfDelta * 10) / 10;
    }
  }

  return {
    yearNumber,
    firstSessionDate: firstDate,
    workoutsThisYear,
    setsThisYear,
    bestDelta,
    weeklyStreak,
    ...(bodyFatChangedPct !== undefined && { bodyFatChangedPct }),
  };
}

export function getDeloadNudge(logs: HistoricalLog[]): string | null {
  if (logs.length === 0) return null;

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const recentLogs = logs.filter(l =>
    l.date >= sevenDaysAgoStr &&
    l.date <= todayStr &&
    !l.isWarmup &&
    !isCardioCategory(l.category ?? '')
  );

  // Count distinct session dates per muscle group in last 7 days
  const sessionDates: Record<string, Set<string>> = {};
  recentLogs.forEach(l => {
    const mg = getMuscleGroup(l.category, l.primaryMuscle);
    if (mg === 'Other') return;
    if (!sessionDates[mg]) sessionDates[mg] = new Set();
    sessionDates[mg].add(l.date);
  });

  // Find muscle groups trained 3+ times in 7 days
  const candidates = Object.entries(sessionDates)
    .filter(([, dates]) => dates.size >= 3)
    .map(([mg]) => mg);

  if (candidates.length === 0) return null;

  // For each candidate, check if e1RM is flat or declining vs the prior 7-day window
  const priorStart = new Date(today);
  priorStart.setDate(priorStart.getDate() - 14);
  const priorStartStr = priorStart.toISOString().slice(0, 10);

  const priorLogs = logs.filter(l =>
    l.date >= priorStartStr &&
    l.date < sevenDaysAgoStr &&
    !l.isWarmup &&
    !isCardioCategory(l.category ?? '')
  );

  const bestE1RM = (entries: HistoricalLog[]): Record<string, number> => {
    const bests: Record<string, number> = {};
    entries.forEach(l => {
      const mg = getMuscleGroup(l.category, l.primaryMuscle);
      const wKg = l.unit === 'lbs' ? l.weight * 0.453592 : l.weight;
      const e = calcE1RM(wKg, l.reps);
      if (!bests[mg] || e > bests[mg]) bests[mg] = e;
    });
    return bests;
  };

  const recentBests = bestE1RM(recentLogs);
  const priorBests = bestE1RM(priorLogs);

  // Pick the first candidate where e1RM hasn't improved vs prior window
  for (const mg of candidates) {
    const recent = recentBests[mg] ?? 0;
    const prior = priorBests[mg] ?? 0;
    // No prior data means we can't confirm stagnation — skip
    if (prior === 0) continue;
    if (recent <= prior * 1.01) return mg; // flat or declining (within 1% noise threshold)
  }

  return null;
}


// ── Deload Scheduler ──────────────────────────────────────────────────────────

export type DeloadStatus = 'none' | 'approaching' | 'due' | 'overdue';
export type RPETrend = 'rising' | 'stable' | 'falling' | 'insufficient';
export type VolumeZone = 'below' | 'productive' | 'heavy' | 'excess' | 'mixed' | 'insufficient';

export interface DeloadRecommendation {
  status: DeloadStatus;
  blockWeek: number;           // Current week in loading block (1-based)
  targetBlockLength: number;   // Recommended block length in weeks (4–8)
  weeksUntilDue: number;       // Negative means overdue
  rpeTrend: RPETrend;
  volumeZone: VolumeZone;
  rpeConfidence: boolean;      // true when enough RPE data to trust the trend
  lastDeloadDate: string | null;
  reasoning: string;           // Human-readable explanation of the recommendation
}

/**
 * Determines whether a deload is recommended based on:
 * 1. Block position — weeks since last deload or training start
 * 2. Volume zone — from MEV/MRV landmarks (near MRV → shorter block)
 * 3. RPE trend — rising RPE with flat/declining performance accelerates recommendation
 *
 * Block length targets:
 *   - Excess/heavy volume zone → 4-week block (more stress, sooner reset)
 *   - Productive zone         → 6-week block
 *   - Below MEV               → 8-week block (low stress, can train longer)
 *   - RPE trending up + e1RM flat → subtract 1 week from target (accelerate)
 */
export function getDeloadRecommendation(logs: HistoricalLog[]): DeloadRecommendation | null {
  if (logs.length === 0) return null;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Need at least 3 weeks of data to make a meaningful recommendation
  const allDates = [...new Set(logs.map(l => l.date))].sort();
  if (allDates.length < 3) return null;

  const firstDate = allDates[0];
  const totalWeeks = Math.floor(
    (today.getTime() - new Date(firstDate).getTime()) / (7 * 86400000)
  );
  if (totalWeeks < 3) return null;

  // ── Detect last deload ────────────────────────────────────────────────────
  // A deload week is identified as a 7-day window with ≤50% of the user's
  // median weekly session count AND (if RPE data exists) average RPE ≤ 6.
  // We look back up to 12 weeks to find the most recent one.

  const medianWeeklySessions = (() => {
    const weeklyCounts: number[] = [];
    for (let w = 0; w < Math.min(totalWeeks, 12); w++) {
      const wStart = new Date(today);
      wStart.setDate(today.getDate() - (w + 1) * 7);
      const wEnd = new Date(today);
      wEnd.setDate(today.getDate() - w * 7);
      const wStartStr = wStart.toISOString().slice(0, 10);
      const wEndStr = wEnd.toISOString().slice(0, 10);
      const count = new Set(
        logs.filter(l => l.date >= wStartStr && l.date < wEndStr).map(l => l.date)
      ).size;
      weeklyCounts.push(count);
    }
    const sorted = [...weeklyCounts].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 3;
  })();

  let lastDeloadDate: string | null = null;
  let blockWeek = totalWeeks; // fallback: entire history is one block

  for (let w = 0; w < Math.min(totalWeeks, 12); w++) {
    const wStart = new Date(today);
    wStart.setDate(today.getDate() - (w + 1) * 7);
    const wEnd = new Date(today);
    wEnd.setDate(today.getDate() - w * 7);
    const wStartStr = wStart.toISOString().slice(0, 10);
    const wEndStr = wEnd.toISOString().slice(0, 10);

    const weekLogs = logs.filter(l => l.date >= wStartStr && l.date < wEndStr);
    const weekSessions = new Set(weekLogs.map(l => l.date)).size;
    const weekRPEs = weekLogs.map(l => l.sessionRPE).filter((r): r is number => r !== undefined);
    const avgRPE = weekRPEs.length > 0 ? weekRPEs.reduce((a, b) => a + b, 0) / weekRPEs.length : null;

    const isLowVolume = weekSessions <= medianWeeklySessions * 0.5;
    const isLowRPE = avgRPE === null || avgRPE <= 6;

    if (isLowVolume && isLowRPE && w > 0) {
      // w=0 is current week — skip. w=1+ means last week or earlier was a deload.
      lastDeloadDate = wEndStr;
      blockWeek = w; // weeks since that deload
      break;
    }
  }

  // ── Volume zone ───────────────────────────────────────────────────────────
  // Reuse getVolumeLandmarkSnapshot logic — summarise into a single zone
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const recentWorkingLogs = logs.filter(l =>
    l.date >= sevenDaysAgoStr &&
    l.date <= todayStr &&
    !l.isWarmup &&
    !isCardioCategory(l.category ?? '')
  );

  const setsByMuscle: Record<string, number> = {};
  recentWorkingLogs.forEach(l => {
    const mg = getMuscleGroup(l.category, l.primaryMuscle);
    if (mg === 'Other') return;
    setsByMuscle[mg] = (setsByMuscle[mg] || 0) + 1;
  });

  const zoneStatuses = Object.entries(setsByMuscle).map(([mg, sets]) => {
    const thresholds = DEFAULT_MEV_MRV[mg];
    if (!thresholds) return 'productive';
    if (sets >= thresholds.mrv) return 'excess';
    if (sets >= thresholds.mav) return 'heavy';
    if (sets >= thresholds.mev) return 'productive';
    return 'below';
  });

  let volumeZone: VolumeZone = 'insufficient';
  if (zoneStatuses.length > 0) {
    const counts = { excess: 0, heavy: 0, productive: 0, below: 0 };
    zoneStatuses.forEach(s => counts[s as keyof typeof counts]++);
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    if (counts.excess > 0 && counts.excess >= zoneStatuses.length * 0.3) {
      volumeZone = 'excess';
    } else if (counts.heavy > 0 && (counts.excess + counts.heavy) >= zoneStatuses.length * 0.4) {
      volumeZone = 'heavy';
    } else if (counts.productive >= zoneStatuses.length * 0.5) {
      volumeZone = 'productive';
    } else if (counts.below >= zoneStatuses.length * 0.6) {
      volumeZone = 'below';
    } else {
      volumeZone = 'mixed';
    }
  }

  // ── Base block length from volume zone ────────────────────────────────────
  let targetBlockLength: number;
  switch (volumeZone) {
    case 'excess':       targetBlockLength = 4; break;
    case 'heavy':        targetBlockLength = 5; break;
    case 'productive':   targetBlockLength = 6; break;
    case 'mixed':        targetBlockLength = 6; break;
    case 'below':        targetBlockLength = 8; break;
    default:             targetBlockLength = 6; break; // insufficient data
  }

  // ── RPE trend ─────────────────────────────────────────────────────────────
  // Look at average session RPE per week for last 3 weeks
  const weeklyRPEs: (number | null)[] = [];
  for (let w = 0; w < 3; w++) {
    const wStart = new Date(today);
    wStart.setDate(today.getDate() - (w + 1) * 7);
    const wEnd = new Date(today);
    wEnd.setDate(today.getDate() - w * 7);
    const wStartStr = wStart.toISOString().slice(0, 10);
    const wEndStr = wEnd.toISOString().slice(0, 10);
    const rpes = logs
      .filter(l => l.date >= wStartStr && l.date < wEndStr && l.sessionRPE !== undefined)
      .map(l => l.sessionRPE as number);
    weeklyRPEs.unshift(rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null);
  }

  const validRPEWeeks = weeklyRPEs.filter((r): r is number => r !== null);
  const rpeConfidence = validRPEWeeks.length >= 2;

  let rpeTrend: RPETrend = 'insufficient';
  if (rpeConfidence) {
    const first = weeklyRPEs.find((r): r is number => r !== null)!;
    const last = [...weeklyRPEs].reverse().find((r): r is number => r !== null)!;
    const diff = last - first;
    if (diff >= 0.75) rpeTrend = 'rising';
    else if (diff <= -0.75) rpeTrend = 'falling';
    else rpeTrend = 'stable';
  }

  // Rising RPE with available data → shorten block by 1 week (accelerate deload)
  if (rpeTrend === 'rising') {
    targetBlockLength = Math.max(4, targetBlockLength - 1);
  }

  // ── Status ────────────────────────────────────────────────────────────────
  const weeksUntilDue = targetBlockLength - blockWeek;

  let status: DeloadStatus;
  if (weeksUntilDue > 2) status = 'none';
  else if (weeksUntilDue > 0) status = 'approaching';
  else if (weeksUntilDue === 0) status = 'due';
  else status = 'overdue';

  // ── Reasoning ─────────────────────────────────────────────────────────────
  const zoneLabel: Record<VolumeZone, string> = {
    excess: 'above MRV', heavy: 'approaching MRV', productive: 'in productive zone',
    mixed: 'mixed across muscle groups', below: 'below MEV', insufficient: 'insufficient recent data',
  };
  const rpeLabel: Record<RPETrend, string> = {
    rising: 'session RPE trending up', stable: 'session RPE stable',
    falling: 'session RPE falling', insufficient: 'limited RPE data',
  };

  let reasoning = `Week ${blockWeek} of loading block. Volume ${zoneLabel[volumeZone]}. ${rpeLabel[rpeTrend]}.`;
  if (status === 'approaching') reasoning += ` Deload recommended in ${weeksUntilDue} week${weeksUntilDue > 1 ? 's' : ''}.`;
  else if (status === 'due') reasoning += ` Deload due this week.`;
  else if (status === 'overdue') reasoning += ` Deload overdue by ${Math.abs(weeksUntilDue)} week${Math.abs(weeksUntilDue) > 1 ? 's' : ''}.`;

  return {
    status,
    blockWeek,
    targetBlockLength,
    weeksUntilDue,
    rpeTrend,
    volumeZone,
    rpeConfidence,
    lastDeloadDate,
    reasoning,
  };
}: Record<string, { mev: number; mav: number; mrv: number }> = {
  'Chest':       { mev: 8,  mav: 12, mrv: 20 },
  'Front Delts': { mev: 6,  mav: 10, mrv: 18 },
  'Side Delts':  { mev: 6,  mav: 10, mrv: 18 },
  'Rear Delts':  { mev: 6,  mav: 10, mrv: 18 },
  'Biceps':      { mev: 6,  mav: 10, mrv: 20 },
  'Triceps':     { mev: 6,  mav: 10, mrv: 20 },
  'Upper Back':  { mev: 8,  mav: 14, mrv: 22 },
  'Lats':        { mev: 8,  mav: 14, mrv: 22 },
  'Traps':       { mev: 8,  mav: 14, mrv: 22 },
  'Quads':       { mev: 8,  mav: 14, mrv: 20 },
  'Hamstrings':  { mev: 6,  mav: 10, mrv: 16 },
  'Glutes':      { mev: 6,  mav: 10, mrv: 18 },
  'Calves':      { mev: 8,  mav: 14, mrv: 20 },
  'Core':        { mev: 6,  mav: 10, mrv: 16 },
};

// ── New desktop analytics utilities ──────────────────────────────────────────

export interface VolumeLandmarkEntry {
  muscle: string;
  sets: number;
  status: 'below' | 'productive' | 'heavy' | 'excess';
}

/**
 * Returns a snapshot of each muscle group's current 7-day rolling set count
 * vs MEV/MAV/MRV thresholds.
 *
 * Only includes muscle groups trained at least once in the last 30 days.
 * Sorted heaviest status first so over-reached muscles appear at the top.
 */
export function getVolumeLandmarkSnapshot(logs: HistoricalLog[]): VolumeLandmarkEntry[] {
  if (logs.length === 0) return [];

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  // Muscle groups active in last 30 days
  const activeMuscles = new Set<string>();
  logs.forEach(l => {
    if (l.date >= thirtyDaysAgoStr && l.date <= todayStr && !l.isWarmup && !isCardioCategory(l.category ?? '')) {
      const mg = getMuscleGroup(l.category, l.primaryMuscle);
      if (mg !== 'Other') activeMuscles.add(mg);
    }
  });

  if (activeMuscles.size === 0) return [];

  // Count working sets per muscle group in last 7 days
  const sevenDaySets: Record<string, number> = {};
  logs.forEach(l => {
    if (l.date >= sevenDaysAgoStr && l.date <= todayStr && !l.isWarmup && !isCardioCategory(l.category ?? '')) {
      const mg = getMuscleGroup(l.category, l.primaryMuscle);
      if (activeMuscles.has(mg)) {
        sevenDaySets[mg] = (sevenDaySets[mg] ?? 0) + 1;
      }
    }
  });

  const statusOrder = { excess: 0, heavy: 1, productive: 2, below: 3 };

  return Array.from(activeMuscles).map(muscle => {
    const sets = sevenDaySets[muscle] ?? 0;
    const thresholds = DEFAULT_MEV_MRV[muscle];
    let status: VolumeLandmarkEntry['status'] = 'below';
    if (thresholds) {
      if (sets >= thresholds.mrv) status = 'excess';
      else if (sets >= thresholds.mav) status = 'heavy';
      else if (sets >= thresholds.mev) status = 'productive';
    }
    return { muscle, sets, status };
  }).sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}


export interface WeeklyTonnageData {
  week: string;
  tonnage: number;   // kg·reps (normalised to kg)
  sessions: number;
}

/**
 * Returns weekly total tonnage (weight × reps, excluding warmups/cardio)
 * for trailing N weeks. Weights stored in lbs are converted to kg.
 */
export function getWeeklyTonnage(logs: HistoricalLog[], weeks: number): WeeklyTonnageData[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - weeks * 7);

  const recent = logs.filter(l => {
    if (new Date(l.date) < cutoff) return false;
    if (l.isWarmup) return false;
    if (isCardioCategory(l.category)) return false;
    return l.weight > 0 && l.reps > 0;
  });

  const weekMap: Record<string, { tonnage: number; dates: Set<string> }> = {};

  recent.forEach(log => {
    const w = isoWeekKey(new Date(log.date));
    if (!weekMap[w]) weekMap[w] = { tonnage: 0, dates: new Set() };
    const kg = log.unit === 'lbs' ? log.weight * 0.453592 : log.weight;
    weekMap[w].tonnage += kg * log.reps;
    weekMap[w].dates.add(log.date);
  });

  const result: WeeklyTonnageData[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    const w = isoWeekKey(d);
    const num = w.split('-W')[1];
    const entry = weekMap[w];
    result.push({
      week: `W${num}`,
      tonnage: entry ? Math.round(entry.tonnage) : 0,
      sessions: entry ? entry.dates.size : 0,
    });
  }
  return result;
}

/**
 * Acute:Chronic Workload Ratio.
 * acute  = mean daily tonnage over last 7 days
 * chronic = mean daily tonnage over last 28 days
 * Returns null if insufficient data (<7 days of training).
 */
export function calcACWR(logs: HistoricalLog[]): { acwr: number; acute: number; chronic: number; rpeWeighted: boolean } | null {
  const now = new Date();
  const day = (d: Date) => Math.floor(d.getTime() / 86400000);
  const todayDay = day(now);

  // ── RPE-weighted path ────────────────────────────────────────────────────
  // Use Foster session load (RPE × duration mins) when sufficient sessions
  // have RPE data. "Sufficient" = at least half of sessions in the 28-day
  // window have been rated — below that threshold fall back to tonnage so
  // the gauge doesn't misrepresent partial data.

  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - 28);
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  // Group logs by date within 28-day window
  const sessionDates = [...new Set(
    logs.filter(l => l.date >= windowStartStr).map(l => l.date)
  )];
  const ratedDates = sessionDates.filter(d =>
    logs.some(l => l.date === d && l.sessionRPE !== undefined)
  );
  const rpeWeighted = sessionDates.length > 0 && ratedDates.length >= sessionDates.length / 2;

  if (rpeWeighted) {
    // Daily session load: take the sessionLoad from any log for that date
    const dailyLoad: Record<number, number> = {};
    logs.forEach(l => {
      if (l.sessionLoad === undefined) return;
      const d = day(new Date(l.date));
      if (!dailyLoad[d]) dailyLoad[d] = l.sessionLoad;
    });

    const sum = (fromDaysAgo: number, toDaysAgo: number) => {
      let total = 0;
      for (let i = toDaysAgo; i <= fromDaysAgo; i++) {
        total += dailyLoad[todayDay - i] || 0;
      }
      return total;
    };

    const acute = sum(6, 0) / 7;
    const chronic = sum(27, 0) / 28;
    if (chronic === 0) return null;
    return { acwr: acute / chronic, acute, chronic, rpeWeighted: true };
  }

  // ── Tonnage fallback ─────────────────────────────────────────────────────
  const validLogs = logs.filter(l => !l.isWarmup && !isCardioCategory(l.category) && l.weight > 0 && l.reps > 0);
  if (validLogs.length === 0) return null;

  const dailyTonnage: Record<number, number> = {};
  validLogs.forEach(l => {
    const d = day(new Date(l.date));
    const kg = l.unit === 'lbs' ? l.weight * 0.453592 : l.weight;
    dailyTonnage[d] = (dailyTonnage[d] || 0) + kg * l.reps;
  });

  const sum = (fromDaysAgo: number, toDaysAgo: number) => {
    let total = 0;
    for (let i = toDaysAgo; i <= fromDaysAgo; i++) {
      total += dailyTonnage[todayDay - i] || 0;
    }
    return total;
  };

  const acute = sum(6, 0) / 7;
  const chronic = sum(27, 0) / 28;
  if (chronic === 0) return null;
  return { acwr: acute / chronic, acute, chronic, rpeWeighted: false };
}

/** Returns count of sessions per day-of-week (0=Sun … 6=Sat) from all history. */
export function getTrainingDayDistribution(logs: HistoricalLog[]): { day: string; count: number }[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const seen: Record<string, boolean> = {};
  logs.forEach(l => {
    if (seen[l.date]) return;
    seen[l.date] = true;
    counts[new Date(l.date).getDay()]++;
  });
  return days.map((day, i) => ({ day, count: counts[i] }));
}

/** Returns weekly average session duration (ms) for trailing N weeks. */
export function getWeeklySessionDuration(logs: HistoricalLog[], weeks: number): { week: string; avgMins: number }[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - weeks * 7);

  // Collect duration per session date (take max sessionDuration per date)
  const dateDuration: Record<string, number> = {};
  logs.forEach(l => {
    if (new Date(l.date) < cutoff) return;
    if (!l.sessionDuration || l.sessionDuration <= 0) return;
    if (!dateDuration[l.date] || l.sessionDuration > dateDuration[l.date]) {
      dateDuration[l.date] = l.sessionDuration;
    }
  });

  const weekMap: Record<string, number[]> = {};
  Object.entries(dateDuration).forEach(([date, ms]) => {
    const w = isoWeekKey(new Date(date));
    if (!weekMap[w]) weekMap[w] = [];
    weekMap[w].push(ms);
  });

  const result: { week: string; avgMins: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    const w = isoWeekKey(d);
    const num = w.split('-W')[1];
    const durations = weekMap[w] || [];
    const avg = durations.length > 0
      ? durations.reduce((s, v) => s + v, 0) / durations.length / 60000
      : 0;
    result.push({ week: `W${num}`, avgMins: Math.round(avg) });
  }
  return result;
}

/** Strength standards: relative 1RM as multiples of bodyweight, by gender.
 *  Thresholds calibrated against recreational consensus (Nippard/calcffmi/miniwebtool).
 *  Five levels map to: Foundations / Developing / Established / Forged / Elite
 */
export const STRENGTH_STANDARDS: Record<string, { label: string; male: number[]; female: number[] }> = {
  // thresholds: [Foundations, Developing, Established, Forged, Elite]
  'bench':    { label: 'Bench Press',    male: [0.50, 0.75, 1.00, 1.50, 2.00], female: [0.25, 0.50, 0.75, 1.00, 1.50] },
  'squat':    { label: 'Squat',          male: [0.75, 1.00, 1.25, 1.75, 2.50], female: [0.50, 0.75, 1.00, 1.50, 2.00] },
  'deadlift': { label: 'Deadlift',       male: [1.00, 1.25, 1.50, 2.00, 2.75], female: [0.75, 1.00, 1.25, 1.75, 2.50] },
  'ohp':      { label: 'Overhead Press', male: [0.35, 0.50, 0.65, 1.00, 1.40], female: [0.20, 0.30, 0.50, 0.65, 1.00] },
  'row':      { label: 'Barbell Row',    male: [0.50, 0.75, 1.00, 1.40, 1.80], female: [0.30, 0.50, 0.75, 1.00, 1.50] },
};

// Index 0–4 map to the five standard levels. -1 = below the first threshold (Developing).
const STRENGTH_LEVEL_LABELS = ['Foundations', 'Developing', 'Established', 'Forged', 'Elite'];
const STRENGTH_LEVEL_LABEL_DEVELOPING = 'Building';

/**
 * Match an exercise name to a strength standard key.
 *
 * Surrogate acceptance criteria — only exercises where the biomechanical
 * overlap is close enough that published strength standards transfer:
 *
 * BENCH:  flat barbell bench and close variations (wide/narrow grip flat),
 *         dumbbell bench (acceptable proxy), weighted push-up.
 *         EXCLUDED: incline/decline bench (different pec recruitment angle,
 *         different absolute load), dips, machine chest press.
 *
 * SQUAT:  barbell back squat (high and low bar) and safety bar squat.
 *         EXCLUDED: hack squat (machine-assisted, more quad-isolated, far
 *         higher loads possible), goblet squat, front squat (different
 *         torso angle, systematically lower loads), box squat, leg press,
 *         Bulgarian split squat. These do not share back-squat standards.
 *
 * DEADLIFT: conventional and sumo deadlift (sumo is accepted as equivalent
 *         in all major standards), trap bar deadlift (high handles).
 *         EXCLUDED: Romanian/stiff-leg/single-leg deadlift (partial ROM,
 *         significantly lower loads), good morning, rack pull.
 *
 * OHP:    strict barbell overhead press (military/OHP) only.
 *         EXCLUDED: push press (leg drive inflates load), seated press,
 *         dumbbell press, Arnold press.
 *
 * ROW:    barbell bent-over row only (overhand or underhand).
 *         EXCLUDED: cable/machine rows, dumbbell row, T-bar row.
 */
function matchStrengthLift(name: string): string | null {
  const n = name.toLowerCase().trim();

  // ── Squat — back squat variants only ────────────────────────────────────────
  // Explicit exclusion list checked first to block false positives from
  // the broad 'squat' substring (e.g. "hack squat", "goblet squat").
  const SQUAT_EXCLUSIONS = [
    'hack squat', 'goblet squat', 'front squat', 'box squat',
    'bulgarian', 'split squat', 'jump squat', 'leg press',
    'belt squat', 'pistol squat', 'landmine squat', 'zercher squat',
  ];
  if (SQUAT_EXCLUSIONS.some(ex => n.includes(ex))) return null;
  if (n.includes('squat') || n.includes('safety bar')) return 'squat';

  // ── Bench — flat barbell and close dumbbell equivalents ─────────────────────
  // Excluded: incline, decline, dips, machine, cable
  const BENCH_EXCLUSIONS = [
    'incline', 'decline', 'dip', 'machine', 'cable', 'floor press',
    'pin press', 'board press',
  ];
  if (
    n.includes('bench') ||
    n.includes('chest press') ||
    n.includes('dumbbell press') ||
    n.includes('db press') ||
    n.includes('push-up') ||
    n.includes('pushup')
  ) {
    if (BENCH_EXCLUSIONS.some(ex => n.includes(ex))) return null;
    return 'bench';
  }

  // ── Deadlift — conventional and sumo only ───────────────────────────────────
  const DEADLIFT_EXCLUSIONS = [
    'romanian', 'rdl', 'stiff', 'single leg', 'single-leg',
    'suitcase', 'rack pull', 'good morning', 'snatch grip',
  ];
  if (n.includes('deadlift') || n.includes('trap bar') || n.includes('hex bar')) {
    if (DEADLIFT_EXCLUSIONS.some(ex => n.includes(ex))) return null;
    return 'deadlift';
  }

  // ── Overhead press — strict barbell only ────────────────────────────────────
  const OHP_EXCLUSIONS = [
    'push press', 'jerk', 'seated', 'dumbbell', 'db ', 'arnold',
    'machine', 'cable', 'lateral', 'behind neck',
  ];
  if (
    n.includes('overhead press') || n.includes('ohp') ||
    n.includes('military press') || n.includes('strict press')
  ) {
    if (OHP_EXCLUSIONS.some(ex => n.includes(ex))) return null;
    return 'ohp';
  }

  // ── Barbell row ─────────────────────────────────────────────────────────────
  if (
    (n.includes('barbell row') || n.includes('bent-over row') ||
     n.includes('bent over row') || n.includes('pendlay row')) &&
    !n.includes('dumbbell') && !n.includes('cable') && !n.includes('machine')
  ) return 'row';

  return null;
}

export interface RelativeStrengthEntry {
  lift: string;
  label: string;
  e1rm: number;
  ratio: number;        // e1RM / bodyweight
  levelIndex: number;   // 0–4 (beginner to elite)
  levelLabel: string;
  daysAgo: number;      // age of the most recent set used (for UI staleness hints)
  ageAdjusted: boolean; // true when age bracket multiplier was applied
  ageMultiplier: number; // the actual multiplier applied (1.0 if no adjustment)
  thresholds: number[]; // the actual thresholds used for classification (age-adjusted if applicable)
}

// 90 days — one full training macrocycle. Lifts with no data within this
// window are excluded entirely rather than carrying stale all-time PRs.
const RELATIVE_STRENGTH_WINDOW_DAYS = 90;

/**
 * Returns relative strength data for key compound lifts.
 * Only considers logs within the last 90 days (one full training block).
 * Lifts not performed in that window are omitted rather than haunting
 * the panel with stale all-time PRs.
 * Requires bodyweight from the most recent BiometricEntry.
 * When dateOfBirth is provided, thresholds are adjusted downward for users
 * aged 40+ to reflect realistic strength capacity at that age bracket.
 */
export function getRelativeStrength(
  logs: HistoricalLog[],
  biometrics: { weight: number; unit: string; date?: string }[],
  gender: 'male' | 'female' = 'male',
  dateOfBirth?: string
): RelativeStrengthEntry[] {
  if (biometrics.length === 0) return [];

  const sorted = [...biometrics].sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );
  const latest = sorted[sorted.length - 1];
  const bwKg = latest.unit === 'lbs' ? latest.weight * 0.453592 : latest.weight;
  if (bwKg <= 0) return [];

  // Age bracket multiplier — thresholds scale down for 40+ users so bands
  // reflect realistic capacity rather than a 28-year-old peak population norm.
  // Brackets align broadly with Masters powerlifting age categories.
  let ageMultiplier = 1.0;
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    if (!isNaN(dob.getTime())) {
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear() -
        (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      if      (age >= 70) ageMultiplier = 0.80;
      else if (age >= 60) ageMultiplier = 0.85;
      else if (age >= 50) ageMultiplier = 0.90;
      else if (age >= 40) ageMultiplier = 0.95;
    }
  }
  const ageAdjusted = ageMultiplier < 1.0;

  // Recency cutoff — 90 days back from today
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RELATIVE_STRENGTH_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Best e1RM per matched lift within the recency window.
  // Also track the most recent set date separately — the best e1RM may be
  // from an older session (heavier day), but the UI should show when the lift
  // was last performed, not when the peak was hit.
  const bests: Record<string, { e1rm: number; name: string; date: string; mostRecentDate: string }> = {};
  logs
    .filter(l =>
      !l.isWarmup &&
      !isCardioCategory(l.category) &&
      l.weight > 0 &&
      l.reps > 0 &&
      l.date >= cutoffStr          // recency gate
    )
    .forEach(l => {
      const key = matchStrengthLift(l.exercise);
      if (!key) return;
      const kgRaw = l.unit === 'lbs' ? l.weight * 0.453592 : l.weight;
      // Dumbbell exercises log weight per arm — double to get total bilateral load
      // before calculating e1RM so the result is comparable to barbell standards.
      const n = l.exercise.toLowerCase();
      const isDumbbell = n.includes('dumbbell') || n.startsWith('db ') ||
        n.includes(' db ') || n.includes('d/b') || n.includes('db-');
      const kg = isDumbbell ? kgRaw * 2 : kgRaw;
      const e1rm = calcE1RM(kg, l.reps);
      if (!bests[key]) {
        bests[key] = { e1rm, name: l.exercise, date: l.date, mostRecentDate: l.date };
      } else {
        // Update best e1RM if this set is stronger
        if (e1rm > bests[key].e1rm) {
          bests[key].e1rm = e1rm;
          bests[key].name = l.exercise;
          bests[key].date = l.date;
        }
        // Always update mostRecentDate to the latest session regardless of load
        if (l.date > bests[key].mostRecentDate) {
          bests[key].mostRecentDate = l.date;
        }
      }
    });

  const today = new Date().toISOString().slice(0, 10);

  return Object.entries(bests).map(([key, { e1rm, name, date, mostRecentDate }]) => {
    const std = STRENGTH_STANDARDS[key];
    const rawThresholds = gender === 'female' ? std.female : std.male;
    // Apply age multiplier — lower thresholds proportionally so older users
    // are judged against age-appropriate standards.
    const thresholds = ageAdjusted
      ? rawThresholds.map(t => t * ageMultiplier)
      : rawThresholds;
    const ratio = e1rm / bwKg;
    // -1 = below the first (Foundations) threshold
    let levelIndex = -1;
    for (let i = 0; i < thresholds.length; i++) {
      if (ratio >= thresholds[i]) levelIndex = i;
    }
    // daysAgo reflects the most recent session for this lift — even if the
    // peak e1RM came from an earlier session within the window.
    const daysAgo = Math.round(
      (new Date(today).getTime() - new Date(mostRecentDate).getTime()) / 86400000
    );
    return {
      lift: name,
      label: std.label,
      e1rm: Math.round(e1rm),
      ratio: Math.round(ratio * 100) / 100,
      levelIndex,
      levelLabel: levelIndex < 0 ? STRENGTH_LEVEL_LABEL_DEVELOPING : STRENGTH_LEVEL_LABELS[levelIndex],
      daysAgo,
      ageAdjusted,
      ageMultiplier,
      thresholds,
    };
  }).sort((a, b) => b.ratio - a.ratio);
}



function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const num = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
  const den = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: meanY - slope * meanX };
}

export interface BodyCompositionProjection {
  /** Historical entries mapped to { date, weight, bodyFat, lean, fat } */
  history: { date: string; weight: number; lean: number | null; fat: number | null }[];
  /** 90-day projection for weight, lean, fat */
  projection: { date: string; weight: number | null; lean: number | null; fat: number | null }[];
  /** Whether there's enough data to project */
  hasProjection: boolean;
}

/**
 * Projects body composition 90 days forward using linear regression
 * on existing BiometricEntry data.
 */
export function getBodyCompositionProjection(
  entries: { date: string; weight: number; bodyFat?: number; unit: string }[]
): BodyCompositionProjection {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return { history: [], projection: [], hasProjection: false };

  const toKg = (e: typeof sorted[0]) => e.unit === 'lbs' ? e.weight * 0.453592 : e.weight;
  const origin = new Date(sorted[0].date).getTime();
  const dayMs = 86400000;

  const pts = sorted.map(e => ({
    x: (new Date(e.date).getTime() - origin) / dayMs,
    weightKg: toKg(e),
    lean: e.bodyFat != null ? toKg(e) * (1 - e.bodyFat / 100) : null,
    fat:  e.bodyFat != null ? toKg(e) * (e.bodyFat / 100) : null,
    date: e.date,
  }));

  const weightReg = linearRegression(pts.map(p => ({ x: p.x, y: p.weightKg })));
  const leanPts = pts.filter(p => p.lean != null).map(p => ({ x: p.x, y: p.lean as number }));
  const fatPts  = pts.filter(p => p.fat  != null).map(p => ({ x: p.x, y: p.fat  as number }));
  const leanReg = leanPts.length >= 2 ? linearRegression(leanPts) : null;
  const fatReg  = fatPts.length  >= 2 ? linearRegression(fatPts)  : null;

  const history = pts.map(p => ({
    date: p.date,
    weight: Math.round(p.weightKg * 10) / 10,
    lean: p.lean != null ? Math.round(p.lean * 10) / 10 : null,
    fat:  p.fat  != null ? Math.round(p.fat  * 10) / 10 : null,
  }));

  const hasProjection = weightReg !== null && sorted.length >= 3;
  const projection: BodyCompositionProjection['projection'] = [];

  if (hasProjection) {
    const lastX = pts[pts.length - 1].x;
    for (let i = 7; i <= 90; i += 7) {
      const x = lastX + i;
      const d = new Date(origin + x * dayMs);
      const dateStr = d.toISOString().slice(0, 10);
      projection.push({
        date: dateStr,
        weight: weightReg ? Math.round((weightReg.slope * x + weightReg.intercept) * 10) / 10 : null,
        lean:   leanReg   ? Math.round((leanReg.slope   * x + leanReg.intercept)   * 10) / 10 : null,
        fat:    fatReg    ? Math.round((fatReg.slope     * x + fatReg.intercept)    * 10) / 10 : null,
      });
    }
  }

  return { history, projection, hasProjection };
}

/** isoWeekKey helper (internal use — mirrors the private isoWeek fn) */
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
