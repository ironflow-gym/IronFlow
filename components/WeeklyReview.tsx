import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HistoricalLog, TrainingSchedule } from '../types';
import { buildWeeklyReview } from '../src/weeklyReview';
import { addDays, weekStart } from '../src/scheduling';
import { displayDate } from '../src/interfacePresentation';
import Modal, { dialogButton } from './ui/Modal';

export default function WeeklyReview({ history, schedule, today, goal, onClose }: { history: HistoricalLog[]; schedule: TrainingSchedule; today: string; goal: number; onClose: () => void }) {
  const [selected, setSelected] = useState(today);
  const review = useMemo(() => buildWeeklyReview(history, schedule, selected, today, goal), [history, schedule, selected, today, goal]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  return <Modal label="Weekly training review" title="Weekly training review" closeLabel="Close review" onClose={onClose} wide>
    <div className="space-y-5">
      <nav aria-label="Review week" className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
        <button className={`${dialogButton} flex w-11 items-center justify-center px-0`} aria-label="Previous review week" onClick={() => setSelected(addDays(review.from, -7))}><ChevronLeft size={20} /></button>
        <p className="text-center text-sm font-bold" aria-live="polite">{displayDate(review.from, false)} – {displayDate(review.to)}</p>
        <button className={`${dialogButton} flex w-11 items-center justify-center px-0`} aria-label="Next review week" disabled={review.from >= weekStart(today)} onClick={() => setSelected(addDays(review.from, 7))}><ChevronRight size={20} /></button>
      </nav>
      {review.isPartial && <p className="text-sm text-slate-300">Week in progress · records through {displayDate(review.cutoff, false)}</p>}
      {!review.hasData && <p className="text-sm text-slate-300">No training or appointments recorded this week.</p>}
      <section aria-label="Weekly highlights" className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-700 p-4"><h3 className="text-sm text-slate-300">Completed sessions</h3><p className="mt-2 text-2xl font-bold">{review.summary.completed} <span className="text-base font-normal text-slate-300">/ {goal}</span></p><p className="mt-1 text-sm text-slate-300">Current weekly goal</p></article>
        <article className="rounded-xl border border-slate-700 p-4"><h3 className="text-sm text-slate-300">Planned workouts</h3><p className="mt-2 text-2xl font-bold">{review.summary.planned ? <>{review.summary.fulfilled} <span className="text-base font-normal text-slate-300">/ {review.summary.planned}</span></> : '—'}</p><p className="mt-1 text-sm text-slate-300">{review.summary.planned ? 'Completed as planned' : 'No workouts scheduled'}</p>{!!review.summary.missed && <p className="mt-2 text-sm font-bold text-amber-300">{review.summary.missed} missed</p>}{!!review.summary.skipped && <p className="mt-1 text-sm text-slate-300">{review.summary.skipped} skipped</p>}</article>
        <article className="rounded-xl border border-slate-700 p-4"><h3 className="text-sm text-slate-300">Recorded volume</h3><p className="mt-2 text-2xl font-bold">{Math.round(review.summary.volume).toLocaleString()}</p><p className="mt-1 text-sm text-slate-300">kg × reps</p><p className="mt-2 text-sm text-slate-300">{review.summary.previousVolume === null ? 'No previous-week comparison' : `Previous week: ${Math.round(review.summary.previousVolume).toLocaleString()}`}</p></article>
      </section>
      <details open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)} className="rounded-xl border border-slate-700 px-4">
        <summary className="min-h-11 cursor-pointer py-3 font-bold text-slate-200">Details and supporting records</summary>
        <section aria-label="Recorded weekly facts" className="space-y-4 pb-4 pt-2">{review.facts.map(fact => <article key={fact.id} id={`review-${fact.id}`} tabIndex={-1} aria-labelledby={`review-title-${fact.id}`} className="focus:outline-2 focus:outline-emerald-400 border-t border-slate-700 pt-3 first:border-t-0"><h3 id={`review-title-${fact.id}`} className="font-bold">{fact.label}</h3><p className="mt-1 text-sm text-slate-300">{fact.value}</p><details className="mt-2 text-sm text-slate-300"><summary className="min-h-11 cursor-pointer py-3">View supporting records ({fact.records.length})</summary><ul className="space-y-2">{fact.records.map((record, index) => <li key={index}><span className="font-medium">{displayDate(record.date, false)} · {record.label}</span><span className="block text-slate-300">{record.detail}</span></li>)}</ul>{!fact.records.length && <p>No supporting records in this period.</p>}</details></article>)}</section>
        <details className="border-t border-slate-700 pb-3 text-sm text-slate-300"><summary className="min-h-11 cursor-pointer py-3 font-medium">How this is calculated</summary><p>Volume excludes cardio, warmups, deloads and assistance weights. Dumbbell volume and estimates use per-hand weights as logged. Estimated 1RM is a calculation, not a tested maximum. Older records without session IDs are grouped by date and routine name. These records do not measure recovery.</p></details>
      </details>
      <details className="rounded-xl border border-slate-700 px-4">
        <summary className="min-h-11 cursor-pointer py-3 font-bold">Suggestions to consider</summary>
        <section className="space-y-3 pb-4 pt-2" aria-label="Optional coaching suggestions"><p className="text-sm text-slate-300">Optional guidance based on your records. Nothing is applied automatically.</p>{review.suggestions.map((suggestion, index) => <div key={index} className="space-y-2 border-t border-slate-700 pt-3"><p className="text-sm">{suggestion.text}</p><button className="min-h-11 text-left text-sm font-bold text-emerald-300 underline focus-visible:outline-2 focus-visible:outline-emerald-400" onClick={() => { setDetailsOpen(true); requestAnimationFrame(() => { const fact = document.getElementById(`review-${suggestion.factId}`); fact?.focus({ preventScroll: true }); fact?.scrollIntoView({ block: 'nearest' }); }); }}>View supporting fact: {review.facts.find(fact => fact.id === suggestion.factId)?.label}</button></div>)}</section>
      </details>
    </div>
  </Modal>;
}
