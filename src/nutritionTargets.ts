import { BiometricEntry, FuelProfile, UserSettings } from '../types';
import { deriveMacroRatios } from './utils';
export function clampTargetMultiplier(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1.3, Math.max(0.7, value)) : 1;
}
/** The existing Food calculation, shared without introducing new target rules. */
export function nutritionTargets(profile: FuelProfile, history: BiometricEntry[], settings: UserSettings, now = new Date()) {
  const entries = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const entry = entries[0];
  const weight = entry ? entry.weight * (entry.unit === 'lbs' ? 0.453592 : 1) : 75;
  const height = entries.find(value => value.height != null)?.height || 175;
  const birth = settings.dateOfBirth ? new Date(`${settings.dateOfBirth}T12:00:00`) : null;
  let age = 30;
  if (birth && Number.isFinite(birth.getTime())) {
    age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    age = Math.max(1, age);
  }
  const bmr = 10 * weight + 6.25 * height - 5 * age + (settings.gender === 'female' ? -161 : 5);
  const activity = profile.goal === 'Build Muscle' ? 1.55 : profile.goal === 'Lose Fat' ? 1.4 : 1.375;
  const adjustment = profile.goal === 'Build Muscle' ? 300 : profile.goal === 'Lose Fat' ? -500 : 0;
  let calories = Number(((bmr * activity + adjustment) * clampTargetMultiplier(profile.targetMultiplier)).toFixed(1));
  if (!Number.isFinite(calories) || calories <= 0) calories = 2000;
  const ratios = deriveMacroRatios(profile.goal, profile.preferences ?? []);
  const protein = Number((weight * (profile.targetProteinRatio ?? ratios.proteinRatio)).toFixed(1));
  const remaining = Math.max(0, calories - protein * 4);
  return { calories, protein, carbs: Number((remaining * ratios.carbCalorieFraction / 4).toFixed(1)), fats: Number((remaining * ratios.fatCalorieFraction / 9).toFixed(1)),
    estimated: !entry || !entries.some(value => value.height != null) || !birth || !Number.isFinite(birth.getTime()) || !settings.gender };
}

export function sanitizeProfileUpdate(base: FuelProfile, update?: Partial<FuelProfile>): FuelProfile {
  if (!update) return base;
  const goal = update.goal ?? base.goal;
  const preferences = Array.isArray(update.preferences) ? update.preferences.filter((value): value is string => typeof value === 'string') : base.preferences;
  const ratio = typeof update.targetProteinRatio === 'number' && Number.isFinite(update.targetProteinRatio)
    ? Math.min(3, Math.max(0.6, update.targetProteinRatio))
    : goal !== base.goal ? Number(Math.min(3, Math.max(0.6, deriveMacroRatios(goal, preferences).proteinRatio)).toFixed(2)) : base.targetProteinRatio;
  return { ...base, ...update, goal, preferences, targetProteinRatio: ratio, targetMultiplier: clampTargetMultiplier(update.targetMultiplier ?? base.targetMultiplier) };
}
