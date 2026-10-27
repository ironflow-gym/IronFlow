import React, { useId, useState, useEffect } from 'react';
import type { BiometricEntry, BlockGoal, BlockSetup, FuelProfile, HistoricalLog, TrainingBlock, WorkoutTemplate, UserSettings, ExerciseLibraryItem } from '../types';
import { blockGoals, blockPrompt, createBlock, validateBlockSetup, goalLabel, templateInUnits } from '../src/trainingBlocks';
import type { GeminiService } from '../services/geminiService';
import Modal, { dialogButton, dialogField, dialogPrimaryButton } from './ui/Modal';
import TemplateEditor from './TemplateEditor';
import BlockNutritionComparison from './BlockNutritionComparison';
import FoodSaveFeedback from './ui/FoodSaveFeedback';
import { localDate } from '../src/scheduling';
import { isCardioCategory } from '../src/utils';
import { formatWeight } from '../src/equipment';

interface Props {
  initial?: TrainingBlock;
  templates: WorkoutTemplate[]; history: HistoricalLog[]; library: ExerciseLibraryItem[]; aiService: GeminiService; settings: UserSettings; biometrics: BiometricEntry[]; profile: FuelProfile;
  modeForGoal: (goal: BlockGoal) => 'double' | 'fixed'; nutritionForGoal: (goal: BlockGoal, current: FuelProfile) => FuelProfile | undefined;
  onClose: () => void; onCreate: (block: TrainingBlock, applyNutrition: boolean) => void;
}
export default function TrainingBlockBuilder(props: Props) {
  const id = useId();
  const [form, setForm] = useState(() => props.initial ? { name: props.initial.name, goal: props.initial.goal as string, days: String(props.initial.daysPerWeek), workouts: String(props.initial.workoutsPerRound), rounds: String(props.initial.rounds), minutes: String(props.initial.minutes), experience: props.initial.experience as string, returning: props.initial.returning, equipment: props.initial.equipment, priorities: props.initial.priorities, event: props.initial.event } : { name: '', goal: '', days: '', workouts: '', rounds: '', minutes: '', experience: '', returning: false, equipment: '', priorities: '', event: '' });
  const [step, setStep] = useState<'setup' | 'workouts' | 'review'>('setup');
  const [staged, setStaged] = useState<WorkoutTemplate[]>(() => props.initial?.workouts.map(t => templateInUnits(t, props.settings.units === 'metric' ? 'kgs' : 'lbs')) ?? []);
  const [editing, setEditing] = useState<{ index?: number; template: WorkoutTemplate }>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [discard, setDiscard] = useState(false);
  const [generation, setGeneration] = useState<{ prompt: string; ids: string[] }>();
  const [replaceGeneration, setReplaceGeneration] = useState(false);
  const [applyNutrition, setApplyNutrition] = useState(false);
  const setup: BlockSetup = { name: form.name, goal: form.goal as BlockGoal, daysPerWeek: Number(form.days), workoutsPerRound: Number(form.workouts), rounds: Number(form.rounds), minutes: Number(form.minutes), experience: form.experience as BlockSetup['experience'], returning: form.returning, equipment: form.equipment, priorities: form.priorities, event: form.event };
  const update = (key: keyof typeof form, value: string | boolean) => { setForm(previous => ({ ...previous, [key]: value })); setError(''); setApplyNutrition(false); };
  const proposal = form.goal ? props.nutritionForGoal(form.goal as BlockGoal, props.profile) : undefined;
  useEffect(() => setApplyNutrition(false), [JSON.stringify(props.profile)]);
  const close = () => { if (!busy) Object.values(form).some(Boolean) || staged.length ? setDiscard(true) : props.onClose(); };
  const validateWorkouts = () => {
    validateBlockSetup(setup);
    if (generation && generation.ids.some(id => staged.some(t => t.id === id)) && generation.prompt !== blockPrompt(setup)) throw new Error('Setup changed after AI generation. Regenerate the programme for the new choices, or remove those workouts and choose/build replacements.');
    createBlock(setup, staged, props.modeForGoal(setup.goal));
  };
  const generate = async () => {
    setError('');
    try {
      validateBlockSetup(setup);
      if (!form.equipment.trim()) throw new Error('Describe your available equipment, or enter bodyweight only, before AI generation.');
      setBusy(true);
      const prompt = blockPrompt(setup);
      const generated = await props.aiService.generateMultiWorkoutProgram(`${prompt}\nStarting weights must be in ${props.settings.units === 'metric' ? 'kilograms (kg)' : 'pounds (lb)'}.`, setup.workoutsPerRound, props.history, props.library.map(e => e.name), prompt);
      // The existing generator validates response schemas/counts. Stage only; no records/settings change.
      createBlock(setup, generated, props.modeForGoal(setup.goal));
      const templates = generated.map(t => ({ ...t, weightUnit: props.settings.units === 'metric' ? 'kgs' as const : 'lbs' as const, id: crypto.randomUUID() }));
      setStaged(templates); setGeneration({ prompt, ids: templates.map(t => t.id) });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  if (editing) return <TemplateEditor template={editing.template} programContext={staged} allSavedTemplates={props.templates} aiService={props.aiService} userSettings={props.settings} history={props.history} onClose={() => setEditing(undefined)} onSave={template => {
    setStaged(previous => editing.index === undefined ? [...previous, { ...template, weightUnit: props.settings.units === 'metric' ? 'kgs' : 'lbs', id: crypto.randomUUID() }] : previous.map((item, index) => index === editing.index ? { ...template, weightUnit: props.settings.units === 'metric' ? 'kgs' : 'lbs', id: item.id } : item)); setEditing(undefined);
  }} />;
  return <><Modal label="Create training block" title={step === 'review' ? 'Review training block' : step === 'workouts' ? 'Choose block workouts' : 'Create training block'} closeLabel="Close block setup" onClose={close} closeDisabled={busy} suspended={discard || replaceGeneration} footer={<>
    <FoodSaveFeedback />{error && <p className="w-full text-sm text-rose-300" role="alert">{error}</p>}{busy && <p role="status" className="w-full text-sm">Generating the complete programme…</p>}
    {step !== 'setup' && <button className={dialogButton} disabled={busy} onClick={() => { setStep(step === 'review' ? 'workouts' : 'setup'); setError(''); }}>Back</button>}
    {step === 'setup' ? <button className={dialogPrimaryButton} type="submit" form={id}>Choose workouts</button> : step === 'workouts' ? <button className={dialogPrimaryButton} disabled={busy} onClick={() => { try { validateWorkouts(); setStep('review'); } catch (e) { setError((e as Error).message); } }}>Review block</button> : <button className={dialogPrimaryButton} onClick={() => {
      try {
        validateWorkouts(); const block = createBlock(setup, staged.map(t => templateInUnits(t, props.settings.units === 'metric' ? 'kgs' : 'lbs')), props.modeForGoal(setup.goal));
        if (proposal && applyNutrition) block.nutrition = { previous: structuredClone(props.profile), approved: structuredClone(proposal) };
        block.baseline = structuredClone([...props.biometrics].filter(b => b.date <= localDate()).sort((a, b) => b.date.localeCompare(a.date))[0]);
        props.onCreate(block, applyNutrition && !!proposal);
      } catch (e) { setError((e as Error).message); }
    }}>Start block</button>}
  </>}>
    {step === 'setup' && <form id={id} className="space-y-4" onSubmit={event => { event.preventDefault(); try { validateBlockSetup(setup); setStep('workouts'); setError(''); } catch (e) { setError((e as Error).message); } }}>
      <label className="block text-sm">Block name<input className={dialogField} required value={form.name} onChange={e => update('name', e.target.value)} /></label>
      <label className="block text-sm">Primary goal<select className={dialogField} required value={form.goal} onChange={e => update('goal', e.target.value)}><option value="" disabled>Choose a goal</option>{blockGoals.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-3">{[['days', 'Training days per week', 7], ['workouts', 'Different workouts per round', 14], ['rounds', 'Number of rounds', 52], ['minutes', 'Minutes per workout', 360]].map(([key, label, max]) => <label key={key} className="block text-sm">{label}<input className={dialogField} required type="number" min="1" max={max} step="1" value={form[key as 'days']} onChange={e => update(key as 'days', e.target.value)} /></label>)}</div>
      <p className="text-sm text-slate-400">Four different workouts can span a three-day training week. Each round repeats the ordered workouts; the block continues until sessions are completed or explicitly skipped.</p>
      <label className="block text-sm">Training experience<select className={dialogField} required value={form.experience} onChange={e => update('experience', e.target.value)}><option value="" disabled>Choose experience</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="experienced">Experienced</option></select></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.returning} onChange={e => update('returning', e.target.checked)} />Returning after a break</label>
      <label className="block text-sm">Available equipment<input className={dialogField} value={form.equipment} onChange={e => update('equipment', e.target.value)} placeholder="For example: dumbbells, cable machine, or bodyweight only" /></label>
      <label className="block text-sm">Priority exercises or areas (optional)<input className={dialogField} value={form.priorities} onChange={e => update('priorities', e.target.value)} /></label>
      {form.goal === 'sport' && <label className="block text-sm">Sport or event, including any date<input className={dialogField} required value={form.event} onChange={e => update('event', e.target.value)} /></label>}
    </form>}
    {step === 'workouts' && <div className="space-y-4"><p className="text-sm">Choose {setup.workoutsPerRound} different workouts in order. Nothing is saved until you accept the review.</p>
      <div className="flex flex-wrap gap-2"><button className={dialogButton} disabled={busy} onClick={() => setEditing({ template: { name: '', exercises: [] } })}>Build a workout manually</button><button className={dialogButton} disabled={busy} onClick={() => staged.length ? setReplaceGeneration(true) : void generate()}>Generate programme with AI</button></div>
      {props.templates.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3 font-bold">Choose saved routines</summary><div className="space-y-2">{props.templates.map(template => <label key={template.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={staged.some(t => t.id === template.id)} disabled={busy} onChange={e => { setStaged(previous => e.target.checked ? [...previous, templateInUnits(template, props.settings.units === 'metric' ? 'kgs' : 'lbs')] : previous.filter(t => t.id !== template.id)); }} />{template.name}</label>)}</div></details>}
      <ol className="space-y-3">{staged.map((template, index) => <li key={template.id ?? index} className="rounded-xl border border-slate-700 p-3"><p className="font-bold">{index + 1}. {template.name}</p><p className="text-sm text-slate-400">{template.exercises.length} exercises</p><div className="mt-2 flex flex-wrap gap-2"><button className={dialogButton} disabled={busy} onClick={() => setEditing({ index, template: templateInUnits(template, props.settings.units === 'metric' ? 'kgs' : 'lbs') })}>Edit workout {index + 1}</button><button className={dialogButton} disabled={busy || index === 0} onClick={() => setStaged(previous => { const copy = [...previous]; [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]; return copy; })}>Move up</button><button className={dialogButton} disabled={busy} onClick={() => setStaged(previous => previous.filter((_, i) => i !== index))}>Remove</button></div></li>)}</ol>
    </div>}
    {step === 'review' && <div className="space-y-4"><h3 className="text-xl font-bold">{setup.name}</h3><p>{goalLabel(setup.goal)} · {setup.daysPerWeek} days/week · {setup.workoutsPerRound} workouts × {setup.rounds} rounds = {setup.workoutsPerRound * setup.rounds} sessions</p><p className="text-sm text-slate-300">{blockGoals.find(g => g.id === setup.goal)?.guidance} {props.modeForGoal(setup.goal) === 'fixed' ? 'Prescriptions remain fixed until explicitly edited; manual adjustments are available.' : 'Resistance working sets use the existing explainable progression.'}</p>
      {staged.map((template, index) => <details key={index} className="rounded-xl border border-slate-700 p-3"><summary className="min-h-11 cursor-pointer font-bold">{index + 1}. {template.name} · {template.exercises.length} exercises</summary><div className="space-y-3">{template.exercises.map((ex, exIndex) => <div key={exIndex} className="border-t border-slate-700 pt-3 text-sm"><p>{ex.name} · {ex.suggestedSets} × {ex.targetReps}</p><p className="text-slate-300">{ex.tracking === 'time' || isCardioCategory(ex.category) ? 'Timed exercise' : 'Repetitions'} · Starting values: {formatWeight(ex.suggestedWeight)} {isCardioCategory(ex.category) ? 'distance / intensity' : props.settings.units === 'metric' ? 'kg' : 'lb'} × {ex.suggestedReps} {ex.tracking === 'time' || isCardioCategory(ex.category) ? 'seconds' : 'reps'}</p></div>)}</div><button className={`${dialogButton} mt-3`} onClick={() => setEditing({ index, template: templateInUnits(template, props.settings.units === 'metric' ? 'kgs' : 'lbs') })}>Edit workout {index + 1}</button></details>)}
      {proposal && <section className="space-y-3 border-t border-slate-700 pt-4"><h3 className="font-bold">Proposed Food settings</h3><BlockNutritionComparison current={props.profile} proposed={proposal} biometrics={props.biometrics} settings={props.settings} /><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={applyNutrition} onChange={e => setApplyNutrition(e.target.checked)} />Apply these Food changes when starting the block</label><p className="text-sm text-slate-400">Previous settings can be reviewed and restored at any time, with a fresh comparison and confirmation.</p></section>}
      <p className="text-sm text-slate-400">Calendar scheduling is optional and available after starting. Source routines stay unchanged.</p>
    </div>}
  </Modal>{replaceGeneration && <Modal label="Replace staged workouts" title="Replace these workouts?" closeLabel="Keep staged workouts" onClose={() => setReplaceGeneration(false)} footer={<><button className={dialogButton} onClick={() => setReplaceGeneration(false)}>Keep workouts</button><button className={dialogPrimaryButton} onClick={() => { setReplaceGeneration(false); void generate(); }}>Replace and generate</button></>}><p>A successful generation replaces the workouts currently staged here. Existing routines and saved data stay unchanged. If generation fails, these workouts are retained.</p></Modal>}{discard && <Modal label="Discard block setup" title="Discard block setup?" closeLabel="Keep editing block" onClose={() => setDiscard(false)} footer={<><button className={dialogButton} onClick={() => setDiscard(false)}>Keep editing</button><button className={`${dialogButton} border-rose-500 text-rose-200`} onClick={props.onClose}>Discard setup</button></>}><p>These unsaved block choices will be discarded.</p></Modal>}</>;
}
