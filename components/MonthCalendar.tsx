import React from 'react';
import type { TrainingCompletion, TrainingSchedule } from '../types';
import { calendarDayStatus } from '../src/calendarDay';
import { calendarDateLabel, monthCalendarDates, monthStart, shiftMonth } from '../src/monthCalendar';
import { addDays, occurrences } from '../src/scheduling';
import { dialogButton } from './ui/Modal';

export default function MonthCalendar({ selected, onSelect, today, schedule, sessions, activeAppointmentId }: {
  selected: string; onSelect: (date: string) => void; today: string; schedule: TrainingSchedule; sessions: TrainingCompletion[]; activeAppointmentId?: string;
}) {
  const month = monthStart(selected);
  const dates = monthCalendarDates(month);
  const appointments = occurrences(schedule, dates[0], dates[41]);
  const choose = onSelect;
  const moveMonth = (offset: number) => choose(shiftMonth(month, offset));
  const monthLabel = new Date(`${month}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return (
    <div className="space-y-4" aria-label="Month calendar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className={dialogButton} aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
        <h3 aria-live="polite" className="min-w-0 text-lg font-bold">{monthLabel}</h3>
        <button className={dialogButton} aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
        <button className={dialogButton} onClick={() => choose(today)}>Today</button>
      </div>
      <div aria-label="Month dates">
        <div aria-hidden="true" className="grid grid-cols-7 text-center text-xs font-semibold text-slate-300">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day} className="py-2">{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-0.5">
          {dates.map(date => {
            const status = calendarDayStatus(date, today, appointments, sessions, activeAppointmentId);
            return <button key={date} data-date={date} aria-label={`${calendarDateLabel(date)}${date === today ? ', Today' : ''}, ${status.label}`} aria-current={date === today ? 'date' : undefined} aria-pressed={date === selected}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border px-0.5 py-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-300 ${date === selected ? 'border-emerald-400 bg-emerald-500/25 text-white' : 'border-slate-700 bg-slate-900'} ${date.slice(0,7) !== month.slice(0,7) ? 'text-slate-500' : 'text-slate-100'} ${date === today ? 'ring-1 ring-inset ring-emerald-400' : ''}`}
              onClick={() => choose(date)} onKeyDown={event => {
                const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
                if (offset === undefined) return;
                event.preventDefault(); const next = addDays(date, offset); choose(next);
                requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus());
              }}>
              <span className="text-sm font-bold tabular-nums">{Number(date.slice(-2))}</span>
              <span aria-hidden="true" className="flex min-h-4 flex-wrap items-center justify-center gap-0.5 text-[10px] font-bold leading-none">
                {Array.from({ length: Math.min(2, status.scheduled) }, (_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-cyan-400" />)}{status.scheduled > 2 && <span className="text-cyan-300">+</span>}
                {status.completed > 0 && <span className="text-emerald-400">✓</span>}{status.missed > 0 && <span className="text-amber-300">!</span>}{status.rest && <span className="text-slate-300">–</span>}
              </span>
            </button>;
          })}
        </div>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-300"><span><span className="text-cyan-400">●</span> Planned</span><span><span className="text-emerald-400">✓</span> Completed</span><span><span className="text-amber-300">!</span> Missed</span><span>– Rest</span></p>
    </div>
  );
}
