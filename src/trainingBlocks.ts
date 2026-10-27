import { sanitizeProfileUpdate } from './nutritionTargets';
import { convertWeight } from './progression';
import type { BlockGoal, BlockSession, BlockSetup, HistoricalLog, TrainingBlock, TrainingSchedule, WorkoutTemplate, FuelProfile } from '../types';
import { validFoodDate } from './food';
import { addDays, localDate, occurrences } from './scheduling';
import { isCardioCategory, calcE1RM, isAssisted } from './utils';

export const blockGoals: { id: BlockGoal; label: string; guidance: string }[] = [
  { id: 'strength', label: 'Build strength', guidance: 'Prioritise selected lifts, repeatable technique and adequate rest. Evaluate comparable recorded loads/reps.' },
  { id: 'muscle', label: 'Build muscle / bulk', guidance: 'Use sustainable resistance volume and recovery. Training volume alone does not establish muscle growth.' },
  { id: 'fat-loss', label: 'Lose body fat', guidance: 'Retain resistance training and include appropriate activity. Nutrition and measured body-weight trends matter.' },
  { id: 'recomposition', label: 'Build muscle and lose fat', guidance: 'Combine consistent resistance work with nutrition support. Do not infer muscle gain from tonnage.' },
  { id: 'fitness', label: 'General fitness', guidance: 'Balance strength, aerobic activity and movement within the available time.' },
  { id: 'cardio-endurance', label: 'Cardiovascular endurance', guidance: 'Use timed sessions and appropriate recovery. Do not apply strength rep/load progression to cardio.' },
  { id: 'muscular-endurance', label: 'Muscular endurance', guidance: 'Prioritise repeated muscular effort and suitable recovery rather than maximum loads.' },
  { id: 'power', label: 'Power and explosiveness', guidance: 'Prioritise fast, controlled movement and adequate rest. Do not chase fatigue or automatically add reps.' },
  { id: 'mobility', label: 'Mobility', guidance: 'Use controlled movement and range practice; identify timed holds explicitly. Range of motion is not measured by this app.' },
  { id: 'healthy-ageing', label: 'Healthy ageing / everyday function', guidance: 'Include appropriate strength, balance and aerobic activity, adapted to experience and capacity.' },
  { id: 'sport', label: 'Sport / event preparation', guidance: 'Use the specified sport/event demands and date context. Do not assume gym strength is the event result.' },
  { id: 'maintenance', label: 'Maintain fitness', guidance: 'Sustain selected capabilities with a manageable, repeatable workload.' },
];
export const goalLabel = (goal: BlockGoal) => blockGoals.find(item => item.id === goal)?.label ?? goal;
export const nextBlockSession = (block?: TrainingBlock) => block?.sessions.find(item => item.status === 'planned');
export const activeBlock = (blocks: TrainingBlock[]) => blocks.find(block => block.status === 'active');
export const blockProgress = (block: TrainingBlock) => ({ completed: block.sessions.filter(s => s.status === 'completed').length, skipped: block.sessions.filter(s => s.status === 'skipped').length, total: block.sessions.length });
export const blockSessionLabel = (block: TrainingBlock, slot: BlockSession) => `Round ${slot.round} of ${block.rounds} · ${slot.template.name}`;
export function validateBlockSetup(setup: BlockSetup) {
  if (!setup.name.trim()) throw new Error('Enter a block name.');
  if (!blockGoals.some(goal => goal.id === setup.goal)) throw new Error('Choose a supported goal.');
  for (const [label, value, max] of [['Training days per week', setup.daysPerWeek, 7], ['Different workouts', setup.workoutsPerRound, 14], ['Rounds', setup.rounds, 52], ['Session minutes', setup.minutes, 360]] as const) {
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`${label} must be between 1 and ${max}.`);
  }
  if (!['beginner', 'intermediate', 'experienced'].includes(setup.experience)) throw new Error('Choose your experience level.');
  if (setup.goal === 'sport' && !setup.event.trim()) throw new Error('Describe the sport or event.');
}
export function blockPrompt(setup: BlockSetup) {
  validateBlockSetup(setup);
  return [`Create one coordinated training block: ${setup.name}.`, `Primary goal: ${goalLabel(setup.goal)}. ${blockGoals.find(g => g.id === setup.goal)!.guidance}`,
    `${setup.workoutsPerRound} DIFFERENT workouts per round; ${setup.rounds} rounds; ${setup.daysPerWeek} training DAYS per week. Workouts per round are independent of weekly availability; carry the sequence into later weeks.`,
    `Session time: ${setup.minutes} minutes including rest. Experience: ${setup.experience}. Returning after a break: ${setup.returning ? 'yes; start conservatively' : 'no'}.`,
    `Available equipment: ${setup.equipment.trim() || 'Not specified; do not assume specialist machines.'}`, `Priorities: ${setup.priorities.trim() || 'Balanced training for the selected goal.'}`, `Sport/event context: ${setup.event.trim() || 'None.'}`,
    'Return exactly the requested number of distinct workouts, not one template for every round. Label timed exercises with tracking="time" and suggestedReps as SECONDS; targetReps must describe time clearly. Use tracking="reps" for repetition-based exercises. Do not prescribe automatic weekly load/volume increases. Do not change nutrition or settings. Starting weights are reviewed by the user and calibrated locally from matching history/equipment.',
  ].join('\n');
}
export function createBlock(setup: BlockSetup, templates: WorkoutTemplate[], mode: 'double' | 'fixed', now = Date.now()): TrainingBlock {
  validateBlockSetup(setup);
  if (templates.length !== setup.workoutsPerRound) throw new Error(`Choose exactly ${setup.workoutsPerRound} different workouts.`);
  if (new Set(templates.map(t => t.name.trim().toLowerCase())).size !== templates.length) throw new Error('Give each workout a distinct name.');
  templates.forEach(validateBlockWorkout);
  const id = crypto.randomUUID();
  const workouts = templates.map((template, index) => ({ ...structuredClone(template), id: `block:${id}:workout:${index}`, progressionMode: mode }));
  const sessions = Array.from({ length: setup.rounds }, (_, round) => workouts.map(template => ({ id: crypto.randomUUID(), round: round + 1, workoutId: template.id!, template: structuredClone(template), status: 'planned' as const }))).flat();
  return { ...structuredClone(setup), name: setup.name.trim(), id, createdAt: now, status: 'active', workouts, sessions };
}
export function resolveBlockSession(block: TrainingBlock, slotId: string, state: 'completed' | 'skipped', actualId?: string, partial = false): TrainingBlock {
  if (block.status !== 'active') throw new Error('This block is no longer active.');
  const slot = block.sessions.find(s => s.id === slotId);
  if (!slot || slot.status !== 'planned') throw new Error('This block session is already resolved or unavailable.');
  if (state === 'completed' && !actualId) throw new Error('A completed workout identity is required.');
  if (actualId && block.sessions.some(s => s.completedSessionId === actualId)) throw new Error('This workout already fulfils a block session.');
  return { ...block, sessions: block.sessions.map(s => s.id === slotId ? { ...s, status: state, ...(actualId ? { completedSessionId: actualId, completedAt: Date.now(), partial } : {}) } : s) };
}
export function editFutureWorkout(block: TrainingBlock, workoutId: string, template: WorkoutTemplate, activeSlotId?: string): TrainingBlock {
  if (!template.exercises.length || !template.name.trim()) throw new Error('Keep a named workout with at least one exercise.');
  const copy = { ...structuredClone(template), id: workoutId, progressionMode: block.workouts.find(w => w.id === workoutId)?.progressionMode };
  return { ...block, workouts: block.workouts.map(w => w.id === workoutId ? copy : w), sessions: block.sessions.map(s => s.workoutId === workoutId && s.status === 'planned' && s.id !== activeSlotId ? { ...s, template: structuredClone(copy) } : s) };
}
export function blockDates(block: TrainingBlock, start: string, weekdays: number[]): { slotId: string; date: string }[] {
  if (!validFoodDate(start)) throw new Error('Choose a valid start date.');
  const days = new Set(weekdays);
  if (days.size !== block.daysPerWeek || [...days].some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error(`Choose ${block.daysPerWeek} training days.`);
  let date = start;
  return block.sessions.filter(s => s.status === 'planned').map(slot => {
    while (!days.has(new Date(`${date}T12:00:00`).getDay())) date = addDays(date, 1);
    const result = { slotId: slot.id, date }; date = addDays(date, 1); return result;
  });
}
export function scheduleBlockSlots(schedule: TrainingSchedule, block: TrainingBlock, dates: { slotId: string; date: string }[]): TrainingSchedule {
  let result = structuredClone(schedule);
  for (const { slotId, date } of dates) {
    if (date < localDate() || !validFoodDate(date)) throw new Error('Choose today or a future calendar date.');
    const slot = block.sessions.find(s => s.id === slotId && s.status === 'planned');
    if (!slot) throw new Error('Only unresolved block sessions can be scheduled.');
    const existing = result.appointments.find(a => (result.exceptions[`${a.id}@${a.date}`]?.blockId ?? a.blockId) === block.id && result.exceptions[`${a.id}@${a.date}`]?.blockId !== null && (result.exceptions[`${a.id}@${a.date}`]?.blockSessionId ?? a.blockSessionId) === slotId && !['completed', 'skipped', 'removed'].includes(result.exceptions[`${a.id}@${a.date}`]?.status ?? ''));
    if (existing) result.exceptions[`${existing.id}@${existing.date}`] = { ...result.exceptions[`${existing.id}@${existing.date}`], date };
    else result.appointments.push({ id: crypto.randomUUID(), kind: 'workout', date, templateId: slot.template.id, blockId: block.id, blockSessionId: slotId });
  }
  return result;
}
export function blockAppointment(schedule: TrainingSchedule, blockId: string, slotId: string) {
  const item = schedule.appointments.find(a => (schedule.exceptions[`${a.id}@${a.date}`]?.blockId ?? a.blockId) === blockId && schedule.exceptions[`${a.id}@${a.date}`]?.blockId !== null && (schedule.exceptions[`${a.id}@${a.date}`]?.blockSessionId ?? a.blockSessionId) === slotId && !['completed', 'skipped', 'removed'].includes(schedule.exceptions[`${a.id}@${a.date}`]?.status ?? ''));
  return item ? { id: `${item.id}@${item.date}`, date: schedule.exceptions[`${item.id}@${item.date}`]?.date ?? item.date } : undefined;
}
export function scheduleConflicts(schedule: TrainingSchedule, dates: { date: string; slotId?: string }[], blockId?: string) {
  return [...new Set(dates.map(d => d.date))].flatMap(date => occurrences(schedule, date, date).filter(item => item.status === 'planned' && !(item.blockId === blockId && dates.some(d => d.slotId === item.blockSessionId))));
}
export function blockFacts(block: TrainingBlock, history: HistoricalLog[]) {
  const ids = new Set(block.sessions.map(s => s.completedSessionId).filter(Boolean));
  const logs = history.filter(h => ids.has(h.sessionId));
  const working = logs.filter(h => !h.isWarmup && !h.isDeload);
  const timedMinutes = working.filter(h => h.tracking === 'time' || isCardioCategory(h.category)).reduce((n, h) => n + (h.duration ?? h.reps ?? 0) / 60, 0);
  const resistance = working.filter(h => h.tracking !== 'time' && !isCardioCategory(h.category) && !isAssisted(h.exercise));
  const strength = [...new Set(resistance.map(h => h.exercise))].flatMap(name => {
    const rows = resistance.filter(h => h.exercise === name).sort((a, b) => a.date.localeCompare(b.date) || (a.completedAt ?? 0) - (b.completedAt ?? 0));
    const sessions = [...new Set(rows.map(h => h.sessionId))];
    if (sessions.length < 2) return [];
    const best = (id: string | undefined) => Math.max(...rows.filter(h => h.sessionId === id).map(h => calcE1RM(h.weight * (/^lb/i.test(h.unit) ? 0.45359237 : 1), h.reps)));
    return [{ name, first: best(sessions[0]), last: best(sessions.at(-1)) }];
  });
  return { ...blockProgress(block), workingSets: working.length, timedMinutes, strength };
}

/** Reject damaged records before import/hydration; never infer a block from old history. */
export function validateTrainingBlocks(value: unknown): asserts value is TrainingBlock[] {
  const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
  const text = (v: unknown) => typeof v === 'string' && v.length > 0;
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const check = (ok: boolean) => { if (!ok) throw new Error('Invalid training-block records. No imported changes were applied.'); };
  check(Array.isArray(value)); if (!Array.isArray(value)) return;
  const ids = new Set<string>(); let active = 0;
  for (const block of value) {
    check(object(block)); if (!object(block)) return;
    check(text(block.id) && !ids.has(block.id)); ids.add(block.id);
    validateBlockSetup(block as BlockSetup);
    check(number(block.createdAt) && ['active', 'finished', 'ended'].includes(block.status));
    if (block.status === 'active') active++;
    check(typeof block.returning === 'boolean' && ['equipment', 'priorities', 'event'].every(k => typeof block[k] === 'string'));
    check(Array.isArray(block.workouts) && block.workouts.length === block.workoutsPerRound && Array.isArray(block.sessions) && block.sessions.length === block.workoutsPerRound * block.rounds);
    if (!Array.isArray(block.workouts) || !Array.isArray(block.sessions)) return;
    block.workouts.forEach(validateBlockWorkout);
    const workoutIds = new Set(block.workouts.map((w: any) => w?.id)); check(workoutIds.size === block.workouts.length);
    const slotIds = new Set<string>(), positions = new Set<string>();
    for (const slot of block.sessions) {
      check(object(slot));
      check(text(slot.id) && !slotIds.has(slot.id)); slotIds.add(slot.id);
      const position = `${slot.round}:${slot.workoutId}`;
      check(!positions.has(position) && Number.isInteger(slot.round) && slot.round >= 1 && slot.round <= block.rounds && workoutIds.has(slot.workoutId)); positions.add(position);
      check(['planned', 'completed', 'skipped'].includes(slot.status) && object(slot.template) && slot.template.id === slot.workoutId);
      validateBlockWorkout(slot.template);
      if (slot.status === 'completed') check(text(slot.completedSessionId) && number(slot.completedAt));
    }
    const completedIds = block.sessions.filter((s: any) => s.status === 'completed').map((s: any) => s.completedSessionId);
    check(new Set(completedIds).size === completedIds.length);
    if (block.status === 'finished') check(!block.sessions.some((s: any) => s.status === 'planned'));
    if (block.nutrition !== undefined) {
      check(object(block.nutrition));
      for (const profile of [block.nutrition.previous, block.nutrition.approved]) check(object(profile) && ['Build Muscle', 'Lose Fat', 'Maintenance'].includes(profile.goal) && Array.isArray(profile.preferences) && profile.preferences.every((p: any) => typeof p === 'string') && number(profile.targetProteinRatio) && (profile.targetMultiplier === undefined || number(profile.targetMultiplier)));
    }
  }
  check(active <= 1);
}

export function validateBlockWorkout(template: WorkoutTemplate) {
  if (!template || typeof template.name !== 'string' || !template.name.trim() || !Array.isArray(template.exercises) || !template.exercises.length) throw new Error('Each block workout needs a name and at least one exercise.');
  if (template.progressionMode !== undefined && !['double', 'fixed'].includes(template.progressionMode)) throw new Error('Invalid workout progression mode.');
  if (template.weightUnit !== undefined && !['kgs', 'lbs'].includes(template.weightUnit)) throw new Error('Invalid workout weight unit.');
  for (const ex of template.exercises) {
    if (!ex || typeof ex.name !== 'string' || !ex.name.trim() || typeof ex.category !== 'string' || !ex.category.trim() || typeof ex.targetReps !== 'string' || !ex.targetReps.trim()) throw new Error('Every block exercise needs a name, category and target.');
    for (const [value, min, max, integer] of [[ex.suggestedSets, 1, 20, true], [ex.suggestedReps, 1, 36000, true], [ex.suggestedWeight, 0, 10000, false], [ex.restSeconds ?? 0, 0, 3600, true], [ex.warmupCount ?? 0, 0, 10, true]] as const) {
      if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`Check sets, starting values and rest for ${ex.name}.`);
    }
    if (ex.tracking !== undefined && !['reps', 'time'].includes(ex.tracking)) throw new Error(`Choose repetitions or seconds for ${ex.name}.`);
  }
}

/** User-approved first-release policies. Nutrition always requires separate approval. */
export const blockModeForGoal = (goal: BlockGoal): 'double' | 'fixed' => ['power', 'mobility', 'cardio-endurance', 'muscular-endurance', 'sport'].includes(goal) ? 'fixed' : 'double';

export function blockNutritionForGoal(goal: BlockGoal, current: FuelProfile): FuelProfile | undefined {
  const mapped = goal === 'fat-loss' ? 'Lose Fat' : goal === 'muscle' ? 'Build Muscle' : ['recomposition', 'maintenance'].includes(goal) ? 'Maintenance' : undefined;
  if (!mapped) return undefined;
  const proposed = sanitizeProfileUpdate(current, { goal: mapped });
  return JSON.stringify(current) === JSON.stringify(proposed) ? undefined : proposed;
}
export function templateInUnits(template: WorkoutTemplate, unit: 'kgs' | 'lbs'): WorkoutTemplate {
  return { ...structuredClone(template), weightUnit: unit, exercises: template.exercises.map(ex => ({ ...ex, suggestedWeight: convertWeight(ex.suggestedWeight, template.weightUnit ?? unit, unit) })) };
}
export function appointmentBlockTemplate(blocks: TrainingBlock[], blockId?: string | null, slotId?: string | null) {
  const block = blocks.find(b => b.id === blockId);
  const slot = block?.sessions.find(s => s.id === slotId);
  return block && slot ? { block, slot, template: slot.template } : undefined;
}

export function linkedBlockAppointment(blocks: TrainingBlock[], schedule: TrainingSchedule, occurrenceId?: string) {
  const appointment = schedule.appointments.find(a => `${a.id}@${a.date}` === occurrenceId);
  if (!appointment) return undefined;
  const current = { ...appointment, ...schedule.exceptions[occurrenceId!] };
  return appointmentBlockTemplate(blocks, current.blockId, current.blockSessionId);
}
