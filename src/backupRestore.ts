/** Public snapshot keys only. Device-local recovery and queue metadata never travel. */
export const backupKeys = [
  'ironflow_history', 'ironflow_biometrics', 'ironflow_templates', 'ironflow_trash',
  'ironflow_library', 'ironflow_deleted_exercises', 'ironflow_settings', 'ironflow_morphology',
  'ironflow_fuel', 'ironflow_fuel_profile', 'ironflow_narrative_vault', 'ironflow_pantry',
  'ironflow_schedule', 'ironflow_saved_meals', 'ironflow_active_session',
] as const;
export const backupCategories = [
  ['Workouts (recorded sets)', 'ironflow_history'], ['Routines', 'ironflow_templates'],
  ['Food entries', 'ironflow_fuel'], ['Saved meals', 'ironflow_saved_meals'],
  ['Pantry items', 'ironflow_pantry'], ['Measurements', 'ironflow_biometrics'],
  ['Calendar appointments', 'ironflow_schedule'], ['Body assessments', 'ironflow_morphology'],
  ['Custom exercises', 'ironflow_library'],
] as const;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const text = (v: unknown) => typeof v === 'string';
const date = (v: unknown) => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string) && !Number.isNaN(Date.parse(v as string)) && new Date(v as string).toISOString().slice(0, 10) === v;
function requireValue(ok: boolean, field: string): asserts ok { if (!ok) throw new Error(`Invalid backup: check ${field}. No data has been changed.`); }
function fields(row: any, required: Record<string, (v: any) => boolean>, label: string) {
  requireValue(object(row), label);
  for (const [key, check] of Object.entries(required)) requireValue(check(row[key]), `${label} → ${key}`);
}
function rows(value: any, label: string, check: (row: any, label: string) => void) {
  requireValue(Array.isArray(value), label);
  value.forEach((row: any, i: number) => check(row, `${label} ${i + 1}`));
}
const macros = { name: text, calories: number, protein: number, carbs: number, fats: number };
const template = (row: any, label: string) => {
  fields(row, { name: text, exercises: Array.isArray }, label);
  rows(row.exercises, label, (exercise, at) => fields(exercise, { name: text, category: text, suggestedSets: number, targetReps: text, suggestedWeight: number, suggestedReps: number }, at));
};
const appointment = (row: any, label: string) => {
  fields(row, { id: text, date, kind: v => v === 'rest' || v === 'workout' }, label);
  requireValue(row.repeat === undefined || row.repeat === 'weekly', `${label} repetition`);
  requireValue(row.until === undefined || date(row.until), `${label} end date`);
};
export function validateBackup(input: unknown): Record<string, any> {
  requireValue(object(input), 'file contents');
  // Accept both existing raw JSON exports and the existing Drive envelope.
  const source = Object.hasOwn(input, 'data') ? input.data : input;
  requireValue(object(source), 'data');
  const data = Object.fromEntries(backupKeys.filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]]));
  requireValue(Object.keys(data).length > 0, 'IronFlow records');
  for (const [key, value] of Object.entries(data)) {
    switch (key) {
      case 'ironflow_history': rows(value, 'workout history', (r, l) => fields(r, { date: text, exercise: text, category: text, weight: number, reps: number, unit: text }, l)); break;
      case 'ironflow_biometrics': rows(value, 'measurements', (r, l) => fields(r, { date, weight: number, unit: text }, l)); break;
      case 'ironflow_templates': case 'ironflow_trash': rows(value, 'routines', template); break;
      case 'ironflow_fuel': rows(value, 'food entries', (r, l) => fields(r, { ...macros, id: text, date }, l)); break;
      case 'ironflow_pantry': rows(value, 'pantry items', (r, l) => {
        // Older pantry definitions may lack newer optional metadata/serving text.
        fields(r, { ...macros, id: text }, l);
        requireValue(r.nutritionBasis === undefined || ['100g', '100ml', 'serving'].includes(r.nutritionBasis), `${l} label values`);
        requireValue(r.missingNutrients === undefined || Array.isArray(r.missingNutrients) && r.missingNutrients.every((v: any) => ['calories', 'protein', 'carbs', 'fats'].includes(v)), `${l} missing nutrients`);
      }); break;
      case 'ironflow_saved_meals': rows(value, 'saved meals', (r, l) => { fields(r, { id: text, name: text, foods: Array.isArray }, l); rows(r.foods, l, (food, at) => fields(food, macros, at)); }); break;
      case 'ironflow_library': case 'ironflow_deleted_exercises': rows(value, 'exercise library', (r, l) => fields(r, { name: text, category: text, muscles: v => Array.isArray(v) && v.every(text), instructions: v => Array.isArray(v) && v.every(text) }, l)); break;
      case 'ironflow_morphology': rows(value, 'body assessments', (r, l) => fields(r, { id: text, date: text, assessment: v => object(v) && Object.values(v).every(number) }, l)); break;
      case 'ironflow_schedule':
        fields(value, { appointments: Array.isArray, exceptions: object, completions: Array.isArray }, 'calendar');
        rows(value.appointments, 'appointments', appointment);
        for (const exception of Object.values(value.exceptions)) {
          requireValue(object(exception), 'calendar exceptions');
          requireValue(exception.date === undefined || date(exception.date), 'moved appointment date');
          requireValue(exception.status === undefined || ['skipped', 'removed', 'completed'].includes(exception.status), 'appointment status');
        }
        rows(value.completions, 'completed sessions', (r, l) => fields(r, { sessionId: text, date, name: text }, l)); break;
      case 'ironflow_active_session':
        fields(value, { id: text, name: text, startTime: number, status: v => v === 'active' || v === 'completed', exercises: Array.isArray }, 'unfinished workout');
        rows(value.exercises, 'workout exercises', (r, l) => { fields(r, { id: text, name: text, category: text, sets: Array.isArray }, l); rows(r.sets, l, (s, at) => fields(s, { id: text, weight: number, reps: number, unit: text, completed: v => typeof v === 'boolean' }, at)); }); break;
      case 'ironflow_fuel_profile': fields(value, { goal: v => ['Build Muscle', 'Lose Fat', 'Maintenance'].includes(v), preferences: v => Array.isArray(v) && v.every(text), targetProteinRatio: number }, 'nutrition preferences'); break;
      case 'ironflow_narrative_vault': requireValue(object(value), 'saved reviews'); break;
      case 'ironflow_settings': requireValue(object(value), 'settings'); break; // Current device settings are retained.
    }
  }
  return data;
}
export function backupCount(data: Record<string, any>, key: string): number {
  return key === 'ironflow_schedule' ? data[key]?.appointments?.length ?? 0 : data[key]?.length ?? 0;
}
