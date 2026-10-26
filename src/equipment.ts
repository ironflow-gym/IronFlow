import type { ExerciseLibraryItem } from '../types';
export type LoadingMode = 'single' | 'paired';
export const KG_PER_LB = 0.45359237;
export const tidyWeight = (weight: number) => Math.round(weight * 1_000_000) / 1_000_000;
export const formatWeight = (weight: number) => Number(weight.toFixed(2)).toString();
export const equipmentToUnit = (weightKg: number | undefined, unit: 'kgs' | 'lbs') => weightKg === undefined ? undefined : weightKg / (unit === 'lbs' ? KG_PER_LB : 1);
export function defaultLoadingMode(name: string): LoadingMode {
  if (/dumbbell|\bdb\b|d\/b|cable|stack|machine/i.test(name)) return 'single';
  return /barbell|smith|leg press|hack squat|bench press|deadlift|^squat$/i.test(name) ? 'paired' : 'single';
}
export function equipmentFor(name: string, library: ExerciseLibraryItem[], unit: 'kgs' | 'lbs') {
  const item = [...library].reverse().find(i => i.name.toLowerCase() === name.toLowerCase());
  const base = item?.barWeight !== undefined && Number.isFinite(item.barWeight) && item.barWeight >= 0 && item.barWeight <= 10000 ? item.barWeight : undefined;
  const step = item?.weightIncrement !== undefined && Number.isFinite(item.weightIncrement) && item.weightIncrement >= 0.001 && item.weightIncrement <= 1000 ? item.weightIncrement : undefined;
  return {
    weightIncrement: equipmentToUnit(step ?? (base !== undefined ? 1.25 : undefined), unit),
    barWeight: equipmentToUnit(base, unit),
    loadingMode: item?.loadingMode === 'single' || item?.loadingMode === 'paired' ? item.loadingMode : defaultLoadingMode(name),
  };
}
/** Explicit equipment settings override historic loads; a past typo is not proof of loadability. */
export function snapWeight(weight: number, increment: number, base = 0, paired = false): number {
  const step = (Number.isFinite(increment) && increment > 0 ? increment : 0.5) * (paired ? 2 : 1);
  const floor = Number.isFinite(base) && base >= 0 ? base : 0;
  return tidyWeight(floor + Math.max(0, Math.round(((Number.isFinite(weight) ? weight : floor) - floor) / step)) * step);
}
export function equipmentStep(increment: number | undefined, paired: boolean, fallback: number): number {
  return increment !== undefined && Number.isFinite(increment) && increment > 0 ? increment * (paired ? 2 : 1) : fallback;
}


export function adjustEquipmentWeight(weight: number, direction: number, name: string, library: ExerciseLibraryItem[], unit: 'kgs' | 'lbs'): number {
  const config = equipmentFor(name, library, unit);
  const fallback = unit === 'kgs' ? 1.25 : 2.5;
  if (config.weightIncrement === undefined && config.barWeight === undefined) return tidyWeight(Math.max(0, weight + Math.sign(direction) * fallback));
  const step = equipmentStep(config.weightIncrement, config.loadingMode === 'paired', fallback);
  const base = config.barWeight ?? 0;
  const position = (weight - base) / step;
  const index = direction > 0 ? Math.floor(position + 1e-6) + 1 : Math.ceil(position - 1e-6) - 1;
  return tidyWeight(base + Math.max(0, index) * step);
}
