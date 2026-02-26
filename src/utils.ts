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
