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
