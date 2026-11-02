import React, { useEffect, useState } from 'react';
import type { TrainingBlock, TrainingSchedule, WorkoutSession } from '../types';
import { blockDatesInCalendar, previewBlockSchedule, type BlockScheduleOptions } from '../src/blockScheduling';
import { localDate } from '../src/scheduling';
import Modal, { dialogButton, dialogField, dialogPrimaryButton } from './ui/Modal';

export default function BlockSchedulingAssistant({ blocks, schedule, activeSession, initial, onApply, onClose }: {
  blocks: TrainingBlock[]; schedule: TrainingSchedule; activeSession: WorkoutSession | null;
  initial?: { blockId: string; slotId: string }; onApply: (next: TrainingSchedule) => void; onClose: () => void;
}) {
  const [blockId, setBlockId] = useState(initial?.blockId ?? blocks.find(b => b.status === 'active')?.id ?? '');
  const block = blocks.find(b => b.id === blockId);
  const pattern = (id: string) => schedule.blockWeekdays?.[id] ?? [...new Set(blockDatesInCalendar(schedule, id).filter(a => a.status === 'planned').map(a => new Date(`${a.date}T12:00:00`).getDay()))];
  const [options, setOptions] = useState<BlockScheduleOptions>({ action: initial ? 'move' : 'rebuild', start: localDate(), weekdays: pattern(blockId), scope: 'later', slotId: initial?.slotId, includeMissed: true, conflictPolicy: 'review' });
  const [review, setReview] = useState(false);
  // Invalidate confirmation if another action or sync changes the underlying plan.
  useEffect(() => { setReview(false); }, [schedule, blocks, activeSession]);
  const change = (patch: Partial<BlockScheduleOptions>) => { setReview(false); setOptions(previous => ({ ...previous, ...patch })); };
  let preview: ReturnType<typeof previewBlockSchedule> | undefined, error = '';
  try { if (block) preview = previewBlockSchedule(schedule, block, options, activeSession); else error = 'Choose an active block.'; } catch (e) { error = (e as Error).message; }
  const blocked = !!error || !preview?.changes.length || (!!preview.conflicts.length && options.conflictPolicy === 'review');
  return <Modal label="Scheduling assistant" title={review ? 'Review block dates' : 'Schedule your block'} closeLabel="Cancel scheduling assistant" onClose={onClose} footer={<>
    <button className={dialogButton} onClick={() => review ? setReview(false) : onClose()}>{review ? 'Back' : 'Cancel'}</button>
    <button className={options.action === 'clear' && review ? `${dialogButton} text-rose-300 border-rose-400` : dialogPrimaryButton} disabled={blocked} onClick={() => {
      if (!review) { setReview(true); return; }
      if (preview && !blocked) { onApply(preview.schedule); onClose(); }
    }}>{review ? options.action === 'clear' ? `Clear ${preview?.appointmentCount} dates` : `Apply ${preview?.changes.length} changes` : 'Preview changes'}</button>
  </>}>
    <div className="space-y-4">
      {!review ? <>
        <label className="block text-sm">Training block<select aria-label="Training block" className={dialogField} value={blockId} onChange={e => { setBlockId(e.target.value); change({ weekdays: pattern(e.target.value), slotId: undefined, action: 'rebuild' }); }}>{blocks.filter(b => b.status === 'active').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="block text-sm">What would you like to do?<select aria-label="What would you like to do?" className={dialogField} value={options.action} onChange={e => change({ action: e.target.value as BlockScheduleOptions['action'] })}>
          <option value="move">Move a workout</option><option value="rebuild">Change training days / schedule remaining sessions</option><option value="clear">Clear future dates</option>
        </select></label>
        {options.action === 'move' && <>
          <label className="block text-sm">Workout to move<select aria-label="Workout to move" className={dialogField} value={options.slotId ?? ''} onChange={e => change({ slotId: e.target.value })}><option value="">Choose a session</option>{block?.sessions.filter(s => s.status === 'planned' && s.id !== (activeSession?.blockId === block.id ? activeSession.blockSessionId : undefined)).map(s => <option key={s.id} value={s.id}>{s.template.name} · Round {s.round}</option>)}</select></label>
          <label className="block text-sm">Apply changes to<select aria-label="Apply changes to" className={dialogField} value={options.scope} onChange={e => change({ scope: e.target.value as 'one' | 'later' })}><option value="one">Only this workout</option><option value="later">This and later sessions</option></select></label>
        </>}
        <label className="block text-sm">{options.action === 'clear' ? 'Clear dates from' : options.action === 'move' ? 'Move to' : 'Start scheduling from'}<input className={dialogField} type="date" min={localDate()} value={options.start} onChange={e => change({ start: e.target.value })} /></label>
        {options.action !== 'clear' && <>
          <fieldset><legend className="text-sm font-bold">Training days · {options.weekdays.length} per week</legend><p className="mt-1 text-xs text-slate-300">Choose any number of days. Workout order and block length in sessions stay the same.</p><div className="mt-2 flex flex-wrap gap-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => <label key={day} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-600 p-2 text-sm"><input type="checkbox" checked={options.weekdays.includes(i)} onChange={e => change({ weekdays: e.target.checked ? [...options.weekdays, i] : options.weekdays.filter(d => d !== i) })} />{day}</label>)}</div></fieldset>
          <p className="text-xs text-slate-300">A moved workout starts on your chosen date. Later sessions follow the training days above.</p>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={options.includeMissed} onChange={e => change({ includeMissed: e.target.checked })} />Include missed sessions in the selected scope</label>
        </>}
      </> : <>
        <h3 className="font-bold">{block?.name}</h3>
        <p className="text-sm">{options.action === 'clear' ? `${preview?.appointmentCount} appointments will be removed. The block stays intact; remaining sessions can be trained or rescheduled.` : `${preview?.changes.length} sessions scheduled in workout order · ${options.weekdays.length} training days per week`}</p>
        <ul className="space-y-2" aria-label="Schedule changes">{preview?.changes.map(c => <li key={c.slotId} className="rounded-xl border border-slate-700 p-3 text-sm"><p className="font-bold">{c.name}</p><p className="mt-1 text-slate-300">{c.before.join(', ') || 'Not scheduled'} → <span className="text-emerald-300">{c.after ?? 'No date'}</span></p></li>)}</ul>
      </>}
      {!!preview?.conflicts.length && <section className="rounded-xl border border-amber-500/50 p-3 space-y-2"><h3 className="font-bold text-amber-200">Calendar conflicts</h3><ul className="text-sm">{preview.conflicts.map((c, i) => <li key={i}>{c.date} · {c.name}</li>)}</ul></section>}
      {options.action !== 'clear' && <label className="block text-sm">If a proposed day already has a workout or rest day<select aria-label="If a proposed day already has a workout or rest day" className={dialogField} value={options.conflictPolicy} onChange={e => change({ conflictPolicy: e.target.value as BlockScheduleOptions['conflictPolicy'] })}><option value="review">Require a choice before applying</option><option value="avoid">Use the next available training day</option><option value="keep">Keep existing plans and allow the overlap</option></select></label>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {!error && !preview?.changes.length && <p role="status" className="text-sm text-slate-300">No eligible sessions or dates in this scope.</p>}
      <p className="rounded-xl border border-slate-700 p-3 text-xs text-slate-300">Completed, skipped and in-progress sessions stay unchanged. Other blocks and calendar plans are kept. Nothing changes until you confirm.</p>
    </div>
  </Modal>;
}
