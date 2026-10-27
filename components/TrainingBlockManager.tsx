import React, { useState } from 'react';
import type { TrainingBlock, HistoricalLog, BiometricEntry, TrainingSchedule, WorkoutSession, WorkoutTemplate, UserSettings } from '../types';
import { blockAppointment, blockDates, blockFacts, blockProgress, blockSessionLabel, editFutureWorkout, goalLabel, nextBlockSession, resolveBlockSession, scheduleConflicts, templateInUnits } from '../src/trainingBlocks';
import { localDate } from '../src/scheduling';
import type { GeminiService } from '../services/geminiService';
import Modal, { dialogButton, dialogField, dialogPrimaryButton } from './ui/Modal';
import TemplateEditor from './TemplateEditor';
import FoodSaveFeedback from './ui/FoodSaveFeedback';

interface Props {
  block: TrainingBlock; biometrics: BiometricEntry[]; history: HistoricalLog[]; schedule: TrainingSchedule; activeSession: WorkoutSession | null; settings: UserSettings; aiService: GeminiService;
  onClose: () => void; onUpdate: (block: TrainingBlock) => void; onStart: (slotId: string, preview?: boolean) => void; onResume: () => void;
  onSchedule: (dates: { slotId: string; date: string }[]) => void; onRestoreNutrition: () => void; onAssign: (slotId: string) => void; onRepeat: () => void;
}
export default function TrainingBlockManager(props: Props) {
  const { block } = props;
  const next = nextBlockSession(block), progress = blockProgress(block), facts = blockFacts(block, props.history);
  const [round, setRound] = useState(next?.round ?? 1); const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{ type: 'skip' | 'end' | 'assign'; slotId?: string }>();
  const [scheduling, setScheduling] = useState<{ slotId?: string }>();
  const [date, setDate] = useState(localDate()); const [weekdays, setWeekdays] = useState<number[]>([]); const [acknowledge, setAcknowledge] = useState(false);
  const [editing, setEditing] = useState<WorkoutTemplate>();
  const latestBiometric = [...props.biometrics].filter(b => b.date <= localDate()).sort((a, b) => b.date.localeCompare(a.date))[0];
  const kg = (entry: BiometricEntry) => entry.weight * (entry.unit === 'lbs' ? 0.45359237 : 1);
  const reviewNote = block.goal === 'power' ? 'Power output is not measured; review recorded loads, repetitions and technique.' : block.goal === 'mobility' ? 'Range of motion is not measured; logged practice time is not proof of increased mobility.' : block.goal === 'sport' ? 'Event performance must be assessed separately.' : block.goal === 'cardio-endurance' ? 'Logged time is not a measurement of aerobic capacity.' : block.goal === 'muscle' ? 'Training volume alone does not establish muscle growth.' : ['fat-loss', 'recomposition'].includes(block.goal) ? 'Weight changes do not establish changes in body fat or muscle.' : 'Strength estimates are not tested maximums; compare like-for-like exercise performance.';
  const currentSlot = props.activeSession?.blockId === block.id ? props.activeSession.blockSessionId : undefined;
  const action = (run: () => void) => { try { run(); setError(''); } catch (e) { setError((e as Error).message); } };
  let dates: { slotId: string; date: string }[] = []; let scheduleError = '';
  if (scheduling) try { dates = scheduling.slotId ? [{ slotId: scheduling.slotId, date }] : blockDates(block, date, weekdays).filter(item => item.slotId !== currentSlot); } catch (e) { scheduleError = (e as Error).message; }
  const conflicts = scheduleConflicts(props.schedule, dates, block.id);
  if (editing) return <TemplateEditor template={editing} programContext={block.workouts} aiService={props.aiService} userSettings={props.settings} history={props.history} onClose={() => setEditing(undefined)} onSave={template => action(() => { props.onUpdate(editFutureWorkout(block, editing.id!, template, currentSlot)); setEditing(undefined); })} />;
  return <><Modal label="Training block" title={block.name} closeLabel="Close training block" onClose={props.onClose} suspended={!!confirmation || !!scheduling} footer={<><FoodSaveFeedback />{error && <p className="w-full text-sm text-rose-300" role="alert">{error}</p>}<button className={dialogButton} onClick={props.onClose}>Done</button></>}>
    <div className="space-y-5"><p className="text-sm text-slate-300">{goalLabel(block.goal)} · {block.daysPerWeek} days/week · {block.workouts.length} workouts × {block.rounds} rounds</p>
      <div className="rounded-xl border border-emerald-500/30 p-3"><p className="min-w-0 break-words font-bold">{progress.completed} completed · {progress.skipped} skipped · {progress.total - progress.completed - progress.skipped} remaining</p><p className="mt-1 text-sm text-slate-400">Skipped sessions do not count as completed training. Calendar weeks do not automatically advance this block.</p></div>
      {block.status === 'active' && next && <div className="flex flex-wrap gap-2"><button className={dialogButton} onClick={() => { setDate(localDate()); setWeekdays([]); setAcknowledge(false); setScheduling({}); }}>Schedule remaining sessions</button></div>}
      <label className="block text-sm">View round<select className={dialogField} value={round} onChange={e => setRound(Number(e.target.value))}>{Array.from({ length: block.rounds }, (_, i) => <option key={i} value={i + 1}>Round {i + 1}</option>)}</select></label>
      <div className="space-y-3">{block.sessions.filter(slot => slot.round === round).map(slot => {
        const appointment = blockAppointment(props.schedule, block.id, slot.id); const inProgress = slot.id === currentSlot;
        return <article key={slot.id} className="space-y-2 rounded-xl border border-slate-700 p-3" aria-label={blockSessionLabel(block, slot)}>
          <h3 className="min-w-0 break-words font-bold">{slot.template.name}</h3><p className="text-sm text-slate-300">{inProgress ? 'In progress' : slot.status === 'completed' ? `Completed${slot.partial ? ' · partial workout accepted' : ''}` : slot.status === 'skipped' ? 'Skipped' : 'Not completed'}{appointment && ` · ${appointment.date}`}</p>
          {block.status === 'active' && slot.status === 'planned' && <div className="flex flex-wrap gap-2">{inProgress ? <button className={dialogPrimaryButton} onClick={props.onResume}>Resume workout</button> : <><button className={dialogPrimaryButton} onClick={() => props.onStart(slot.id)}>{props.activeSession ? 'Resume unfinished workout' : 'Start session'}</button><button className={dialogButton} disabled={!!props.activeSession} onClick={() => props.onStart(slot.id, true)}>Preview</button></>}
          </div>}
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-bold">Session details and options</summary><ul className="space-y-1 text-sm">{slot.template.exercises.map((exercise, index) => <li key={index}>{exercise.name} · {exercise.suggestedSets} × {exercise.targetReps}</li>)}</ul>
            {block.status === 'active' && slot.status === 'planned' && !inProgress && <div className="mt-3 flex flex-wrap gap-2"><button className={dialogButton} onClick={() => { setDate(appointment?.date ?? localDate()); setAcknowledge(false); setScheduling({ slotId: slot.id }); }}>{appointment ? 'Reschedule' : 'Schedule'}</button><button className={dialogButton} onClick={() => setConfirmation({ type: 'skip', slotId: slot.id })}>Skip session</button>{props.activeSession && !props.activeSession.blockSessionId && <button className={dialogButton} onClick={() => setConfirmation({ type: 'assign', slotId: slot.id })}>Assign current workout</button>}</div>}
            {block.status === 'active' && slot.status === 'skipped' && <button className={`${dialogButton} mt-3`} onClick={() => action(() => props.onUpdate({ ...block, sessions: block.sessions.map(s => s.id === slot.id ? { ...s, status: 'planned' } : s) }))}>Undo skip</button>}
          </details>
        </article>;
      })}</div>
      <details><summary className="min-h-11 cursor-pointer py-3 font-bold">Programme settings and future edits</summary><p className="mb-3 text-sm text-slate-300">Edits affect unresolved future sessions of that workout. Started/completed sessions and source routines stay unchanged.</p>{block.workouts.map(workout => <button key={workout.id} className={`${dialogButton} mb-2 mr-2`} disabled={block.status !== 'active'} onClick={() => setEditing(templateInUnits(workout, props.settings.units === 'metric' ? 'kgs' : 'lbs'))}>Edit future {workout.name}</button>)}</details>
      <section className="space-y-2 border-t border-slate-700 pt-4" aria-label="Block review"><h3 className="min-w-0 break-words font-bold">Recorded block results</h3><p className="text-sm">{facts.workingSets} working sets · {Math.round(facts.timedMinutes)} timed minutes across fulfilled sessions</p>
        {['strength', 'muscle', 'fat-loss', 'recomposition', 'fitness', 'maintenance'].includes(block.goal) && facts.strength.length > 0 && <table className="w-full text-left text-sm"><caption className="text-left text-slate-400">Estimated strength, first versus latest fulfilled session (kg)</caption><tbody>{facts.strength.map(row => <tr key={row.name}><th className="py-2 pr-2 font-normal">{row.name}</th><td>{row.first.toFixed(1)} → {row.last.toFixed(1)}</td></tr>)}</tbody></table>}
        <p className="text-sm text-slate-400">{reviewNote} Incomplete attempts that did not fulfil a session remain in workout history.</p>
      </section>
      {block.baseline && latestBiometric && <p className="text-sm text-slate-300">Recorded body weight: {kg(block.baseline).toFixed(1)} kg ({block.baseline.date}) → {kg(latestBiometric).toFixed(1)} kg ({latestBiometric.date}).</p>}
      {block.nutrition && <button className={dialogButton} onClick={props.onRestoreNutrition}>Review previous Food settings</button>}
      {block.status === 'active' ? <div className="flex flex-wrap gap-2 border-t border-slate-700 pt-4">{!next && <button className={dialogPrimaryButton} onClick={() => action(() => { if (currentSlot) throw new Error('Finish or discard this block’s unfinished workout first.'); props.onUpdate({ ...block, status: 'finished', endedAt: Date.now() }); })}>Finish block</button>}<button className={dialogButton} onClick={() => setConfirmation({ type: 'end' })}>End block early</button></div> : <div><p className="mb-3 text-sm">{block.status === 'finished' ? 'Block finished' : 'Block ended early'}. History and previous Food settings remain available.</p><button className={dialogButton} onClick={props.onRepeat}>Use this programme for a new block</button></div>}
    </div>
  </Modal>
  {confirmation && <Modal label="Confirm block action" title={confirmation.type === 'skip' ? 'Skip this session?' : confirmation.type === 'assign' ? 'Assign current workout?' : 'End block early?'} closeLabel="Cancel block action" onClose={() => setConfirmation(undefined)} footer={<><button className={dialogButton} onClick={() => setConfirmation(undefined)}>Cancel</button><button className={dialogPrimaryButton} onClick={() => action(() => {
    if (confirmation.type === 'skip') props.onUpdate(resolveBlockSession(block, confirmation.slotId!, 'skipped'));
    else if (confirmation.type === 'assign') props.onAssign(confirmation.slotId!);
    else { if (currentSlot) throw new Error('Finish or discard this block’s unfinished workout first.'); props.onUpdate({ ...block, status: 'ended', endedAt: Date.now() }); }
    setConfirmation(undefined);
  })}>{confirmation.type === 'skip' ? 'Skip session' : confirmation.type === 'assign' ? 'Assign workout' : 'End block'}</button>{error && <p className="w-full text-sm text-rose-300" role="alert">{error}</p>}</>}>
    <p>{confirmation.type === 'skip' ? 'Completing every session is encouraged. Skipping advances past this session without counting it as completed training. You can undo the skip while the block is active.' : confirmation.type === 'assign' ? `Explicitly link “${props.activeSession?.name}” to the selected block session. Its current exercises and values stay unchanged. Partial completion will still require confirmation.` : 'Keep all recorded history and cancel unresolved block appointments. Food settings stay unchanged until you approve a restoration comparison.'}</p>
  </Modal>}
  {scheduling && <Modal label="Schedule block sessions" title={scheduling.slotId ? 'Schedule block session' : 'Schedule remaining sessions'} closeLabel="Cancel block scheduling" onClose={() => setScheduling(undefined)} footer={<><button className={dialogButton} onClick={() => setScheduling(undefined)}>Cancel</button><button className={dialogPrimaryButton} disabled={!!scheduleError || !dates.length || (!!conflicts.length && !acknowledge)} onClick={() => action(() => { props.onSchedule(dates); setScheduling(undefined); })}>Save block appointments</button>{error && <p className="w-full text-sm text-rose-300" role="alert">{error}</p>}</>}>
    <div className="space-y-4"><label className="block text-sm">{scheduling.slotId ? 'Date' : 'Start date'}<input className={dialogField} type="date" min={localDate()} value={date} onChange={e => { setDate(e.target.value); setAcknowledge(false); }} /></label>
      {!scheduling.slotId && <fieldset><legend className="text-sm">Choose {block.daysPerWeek} training days</legend><div className="mt-2 flex flex-wrap gap-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <label key={day} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-600 px-3 text-sm"><input type="checkbox" checked={weekdays.includes(index)} onChange={e => { setWeekdays(previous => e.target.checked ? [...previous, index] : previous.filter(d => d !== index)); setAcknowledge(false); }} />{day}</label>)}</div></fieldset>}
      {scheduleError ? <p className="text-sm text-amber-200">{scheduleError}</p> : <p className="text-sm">{dates.length} explicit appointments will be saved. The workout order spans weeks; no missed sessions move automatically.</p>}
      {dates.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3 font-bold">Preview appointments</summary><ul className="space-y-1 text-sm">{dates.map(item => <li key={item.slotId}>{item.date} · {block.sessions.find(s => s.id === item.slotId)?.template.name}</li>)}</ul></details>}
      {conflicts.length > 0 && <section className="space-y-2 rounded-xl border border-amber-500/40 p-3"><p className="font-bold text-amber-200">Existing appointments overlap</p><p className="text-sm">Existing workouts and rest days will stay. Multiple workouts on one day are supported.</p><ul className="text-sm">{conflicts.map(item => <li key={item.occurrenceId}>{item.date} · {item.kind === 'rest' ? 'Rest day' : 'Existing workout'}</li>)}</ul><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} />Keep existing appointments and add these sessions</label></section>}
    </div>
  </Modal>}
  </>;
}
