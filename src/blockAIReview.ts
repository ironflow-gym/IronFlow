import { AIValidationError, parseAIResponse } from './aiValidation';
import type { WorkoutTemplate } from '../types';
import { isTimedExercise } from './utils';

export interface BlockAIIssue { workout: number; exercise: number; original: string; message: string }
const target = /^(\d+)(?:\s*-\s*(\d+))?(?:\s+(reps?|seconds?))?$/i;
export function normaliseBlockTarget(value: string): string {
  return value.trim().replace(/[–—−]/g, '-').replace(/\s+to\s+/gi, '-').replace(/(\d)\s*(?:secs?|s)$/i, '$1 seconds');
}
export function blockTargetIssue(ex: WorkoutTemplate['exercises'][number]): string | undefined {
  const text = normaliseBlockTarget(ex.targetReps);
  if (!isTimedExercise(ex) && /^(AMRAP|to failure|until failure|maximum reps)$/i.test(text)) return;
  const m = target.exec(text);
  const timed = isTimedExercise(ex);
  if (!m || +m[1] < 1 || +m[1] > 36000 || (m[2] && (+m[2] < +m[1] || +m[2] > 36000))) return 'Enter a rep target such as 8-12, or select time and enter a duration in seconds.';
  if (timed && !/^seconds?$/i.test(m[3] ?? '')) return 'This exercise tracks time. Enter the target in seconds, for example 30 seconds.';
  if (!timed && /^seconds?$/i.test(m[3] ?? '')) return 'The target describes time but this exercise tracks repetitions. Choose the intended tracking mode and starting value.';
  if (!Number.isInteger(ex.suggestedReps) || ex.suggestedReps < +m[1] || ex.suggestedReps > +(m[2] ?? m[1])) return `The starting ${timed ? 'duration' : 'reps'} must be within the target ${m[1]}${m[2] ? `-${m[2]}` : ''}.`;
}
export function blockAIIssues(templates: WorkoutTemplate[]): BlockAIIssue[] {
  return templates.flatMap((t, workout) => t.exercises.flatMap((ex, exercise) => {
    const message = blockTargetIssue(ex);
    return message ? [{ workout, exercise, original: ex.targetReps, message }] : [];
  }));
}
/** Only block generation uses this parser. Structural and numeric validation remains strict. */
export function parseBlockAIResponse(text: string | undefined, schema: unknown): unknown {
  if (!text || text.length > 2_000_000) throw new Error('The AI returned an empty or oversized programme. Try generating again. Your existing workouts are unchanged.');
  let raw: any;
  try { raw = JSON.parse(text); } catch { throw new Error('The AI returned an unreadable programme rather than valid workout data. Try generating again. Your existing workouts are unchanged.'); }
  const originals = new Map<string, string>();
  if (Array.isArray(raw?.templates)) raw.templates.forEach((t: any, wi: number) => {
    if (Array.isArray(t?.exercises)) t.exercises.forEach((ex: any, ei: number) => {
      if (typeof ex?.targetReps === 'string' && ex.targetReps.length <= 20000) {
        originals.set(`${wi}:${ei}`, ex.targetReps); ex.targetReps = '8-12';
      }
    });
  });
  try {
    const clean = parseAIResponse(JSON.stringify(raw), schema) as { templates: WorkoutTemplate[] };
    clean.templates.forEach((t, wi) => t.exercises.forEach((ex, ei) => { const original = originals.get(`${wi}:${ei}`) ?? ex.targetReps;
      const normalised = normaliseBlockTarget(original);
      ex.targetReps = blockTargetIssue({ ...ex, targetReps: normalised }) ? original : normalised; }));
    return clean;
  } catch (error) {
    const message = (error as Error).message;
    const match = /response\.templates\[(\d+)\](?:\.exercises\[(\d+)\])?(?:\.(\w+))?: ([^.]+)/.exec(message);
    if (error instanceof AIValidationError && match) {
      const t = raw?.templates?.[+match[1]], ex = t?.exercises?.[+match[2]];
      const location = `Workout ${+match[1] + 1}${typeof t?.name === 'string' ? ` (${t.name.slice(0, 100)})` : ''}${match[2] !== undefined ? ` · ${typeof ex?.name === 'string' ? ex.name.slice(0, 100) : `Exercise ${+match[2] + 1}`}` : ''}`;
      const labels: Record<string, string> = { suggestedSets: 'working sets', suggestedReps: 'starting reps or seconds', suggestedWeight: 'starting weight', restSeconds: 'rest in seconds', warmupCount: 'warmup sets', tracking: 'repetition or time tracking', targetReps: 'rep or time target' };
      const value = match[3] ? (match[2] !== undefined ? ex?.[match[3]] : t?.[match[3]]) : undefined;
      throw new Error(`${location}: ${labels[match[3]] ?? match[3] ?? 'workout structure'} — ${match[4]}${value !== undefined ? `. AI supplied ${JSON.stringify(value).slice(0, 120)}` : ''}. This response cannot be safely reviewed. Generate again or build a workout manually. Your existing workouts are unchanged.`);
    }
    throw new Error('The AI returned an incomplete programme: required workout names or exercise details are missing or invalid. Generate again or build a workout manually. Your existing workouts are unchanged.');
  }
}
