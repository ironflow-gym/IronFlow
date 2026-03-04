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
export function getMuscleGroup(category: string): string {
  const c = category.toLowerCase();
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
    const mg = getMuscleGroup(log.category);
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

/** Default MEV/MAV/MRV values per muscle group. */
export const DEFAULT_MEV_MRV: Record<string, { mev: number; mav: number; mrv: number }> = {
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
export function calcACWR(logs: HistoricalLog[]): { acwr: number; acute: number; chronic: number } | null {
  const now = new Date();
  const day = (d: Date) => Math.floor(d.getTime() / 86400000);
  const todayDay = day(now);

  const validLogs = logs.filter(l => !l.isWarmup && !isCardioCategory(l.category) && l.weight > 0 && l.reps > 0);
  if (validLogs.length === 0) return null;

  // Sum tonnage per calendar day
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

  return { acwr: acute / chronic, acute, chronic };
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

/** Strength standards: relative 1RM as multiples of bodyweight, by gender. */
export const STRENGTH_STANDARDS: Record<string, { label: string; male: number[]; female: number[] }> = {
  // thresholds: [beginner, novice, intermediate, advanced, elite]
  'bench':    { label: 'Bench Press',  male: [0.5, 0.75, 1.0, 1.5, 2.0], female: [0.25, 0.5, 0.75, 1.0, 1.5] },
  'squat':    { label: 'Squat',        male: [0.75, 1.0, 1.5, 2.0, 2.5], female: [0.5, 0.75, 1.0, 1.5, 2.0] },
  'deadlift': { label: 'Deadlift',     male: [1.0, 1.25, 1.75, 2.25, 3.0], female: [0.75, 1.0, 1.25, 1.75, 2.5] },
  'ohp':      { label: 'Overhead Press', male: [0.25, 0.5, 0.75, 1.0, 1.5], female: [0.15, 0.3, 0.5, 0.65, 1.0] },
  'row':      { label: 'Barbell Row',  male: [0.5, 0.75, 1.0, 1.5, 2.0], female: [0.25, 0.5, 0.75, 1.0, 1.5] },
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
 */
export function getRelativeStrength(
  logs: HistoricalLog[],
  biometrics: { weight: number; unit: string; date?: string }[],
  gender: 'male' | 'female' = 'male'
): RelativeStrengthEntry[] {
  if (biometrics.length === 0) return [];

  const sorted = [...biometrics].sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );
  const latest = sorted[sorted.length - 1];
  const bwKg = latest.unit === 'lbs' ? latest.weight * 0.453592 : latest.weight;
  if (bwKg <= 0) return [];

  // Recency cutoff — 90 days back from today
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RELATIVE_STRENGTH_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Best e1RM per matched lift within the recency window
  const bests: Record<string, { e1rm: number; name: string; date: string }> = {};
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
      if (!bests[key] || e1rm > bests[key].e1rm) {
        bests[key] = { e1rm, name: l.exercise, date: l.date };
      }
    });

  const today = new Date().toISOString().slice(0, 10);

  return Object.entries(bests).map(([key, { e1rm, name, date }]) => {
    const std = STRENGTH_STANDARDS[key];
    const thresholds = gender === 'female' ? std.female : std.male;
    const ratio = e1rm / bwKg;
    // -1 = below the first (Foundations) threshold
    let levelIndex = -1;
    for (let i = 0; i < thresholds.length; i++) {
      if (ratio >= thresholds[i]) levelIndex = i;
    }
    const daysAgo = Math.round(
      (new Date(today).getTime() - new Date(date).getTime()) / 86400000
    );
    return {
      lift: name,
      label: std.label,
      e1rm: Math.round(e1rm),
      ratio: Math.round(ratio * 100) / 100,
      levelIndex,
      levelLabel: levelIndex < 0 ? STRENGTH_LEVEL_LABEL_DEVELOPING : STRENGTH_LEVEL_LABELS[levelIndex],
      daysAgo,
    };
  }).sort((a, b) => b.ratio - a.ratio);
}

/** Linear regression helper: returns slope and intercept for y = mx + b */
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
