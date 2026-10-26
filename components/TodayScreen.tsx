import React, { useEffect, useState } from 'react';
import type { HistoricalLog, TrainingOccurrence, TrainingSchedule, WorkoutSession, WorkoutTemplate } from '../types';
import { addDays, completedSessions, dismissOccurrence, editOccurrence, localDate, missedAppointments, occurrences, todayPriority, weekStart } from '../src/scheduling';
import { getExerciseTrend } from '../src/utils';

interface Props {
  templates: WorkoutTemplate[];
  history: HistoricalLog[];
  schedule: TrainingSchedule;
  onScheduleChange: (schedule: TrainingSchedule) => void;
  activeSession: WorkoutSession | null;
  onResume: () => void;
  onPlan: () => void;
  onStart: (template: WorkoutTemplate, appointmentId?: string) => void;
  onPreview: (template: WorkoutTemplate, appointmentId?: string) => void;
  weeklyGoal: number;
}
const button = 'rounded-xl border border-slate-600 px-3 py-2 text-sm font-bold hover:bg-slate-800 disabled:opacity-40';
const primary = 'rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400';
const input = 'block w-full min-w-0 rounded-lg border border-slate-600 bg-slate-800 p-2 mt-1 text-sm';
const weekday = (date: string) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); };

export default function TodayScreen({ templates, history, schedule, onScheduleChange, activeSession, onResume, onPlan, onStart, onPreview, weeklyGoal }: Props) {
  const [today, setToday] = useState(localDate());
  const [selectedDay, setSelectedDay] = useState(today);
  const [week, setWeek] = useState(weekStart(today));
  const [editor, setEditor] = useState<{ item?: TrainingOccurrence } | null>(null);
  const [editDate, setEditDate] = useState(today);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [kind, setKind] = useState<'workout' | 'rest'>('workout');
  const [repeat, setRepeat] = useState(false);
  const [scope, setScope] = useState<'one' | 'future'>('one');
  // Re-evaluate Today after midnight, including a suspended tab regaining focus.
  useEffect(() => {
    const update = () => setToday(localDate());
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const priority = todayPriority(templates, history, schedule, today, !!activeSession);
  const template = 'template' in priority ? priority.template : undefined;
  const appointmentId = priority.kind === 'scheduled' ? priority.appointment.occurrenceId : undefined;
  const sessions = completedSessions(history, schedule);
  const thisWeek = sessions.filter(c => c.date >= weekStart(today) && c.date <= addDays(weekStart(today), 6));
  const missed = missedAppointments(schedule, today, activeSession?.appointmentId);
  const weekly = occurrences(schedule, week, addDays(week, 6));
  const lastPerformed = template ? sessions.filter(c => c.templateId ? c.templateId === template.id : c.name === template.name).sort((a, b) => b.date.localeCompare(a.date))[0]?.date : undefined;
  const workingSets = template?.exercises.reduce((total, ex) => total + (ex.suggestedSets || 3), 0) ?? 0;
  const estimatedMinutes = template ? Math.max(5, Math.round(template.exercises.reduce((total, ex) => total + (ex.suggestedSets || 3) * (45 + (ex.restSeconds || 90)) / 60 + 2, 0))) : 0;
  const trendExercise = template?.exercises.find(ex => getExerciseTrend(ex.name, history) !== null);
  const trend = trendExercise ? getExerciseTrend(trendExercise.name, history) : null;

  const openEditor = (date: string, item?: TrainingOccurrence) => {
    setEditor({ item }); setEditDate(item?.date ?? date); setTemplateId(item?.templateId ?? templates[0]?.id ?? '');
    setKind(item?.kind ?? 'workout'); setRepeat(item?.repeat === 'weekly'); setScope('one');
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editDate || (kind === 'workout' && !templates.some(t => t.id === templateId))) return;
    const patch = { date: editDate, kind, templateId: kind === 'workout' ? templateId : undefined };
    if (editor?.item) onScheduleChange(editOccurrence(schedule, editor.item, patch, scope, crypto.randomUUID()));
    else onScheduleChange({ ...schedule, appointments: [...schedule.appointments, { ...patch, id: crypto.randomUUID(), ...(repeat ? { repeat: 'weekly' as const } : {}) }] });
    setEditor(null);
  };
  const renderOccurrence = (item: TrainingOccurrence) => {
    const routine = templates.find(t => t.id === item.templateId);
    const completed = schedule.completions.find(c => c.sessionId === item.sessionId);
    const isActive = activeSession?.appointmentId === item.occurrenceId;
    return <article key={item.occurrenceId} className="rounded-xl border border-slate-700 bg-slate-900 p-3 space-y-2" data-testid={`appointment-${item.occurrenceId}`}>
      <p className="text-sm font-bold break-words">{completed?.name ?? (item.kind === 'rest' ? 'Rest day' : routine?.name ?? 'Routine unavailable')}</p>
      <p className="text-xs text-slate-400">{isActive ? 'In progress' : item.status === 'completed' ? 'Completed' : item.status === 'skipped' ? 'Skipped' : item.date < today && item.kind === 'workout' ? 'Missed — choose reschedule or skip' : item.kind === 'rest' ? 'Planned rest' : 'Planned'}{item.repeat && ' · Weekly'}</p>
      {item.status === 'planned' && <div className="flex flex-wrap gap-2">
        {isActive ? <button className={button} onClick={onResume}>Resume workout</button> : <>
          {item.kind === 'workout' && routine && <button className={button} onClick={() => activeSession ? onResume() : onStart(routine, item.occurrenceId)}>{activeSession ? 'Resume unfinished workout' : 'Start workout'}</button>}
          <button className={button} onClick={() => openEditor(item.date, item)}>{!routine && item.kind === 'workout' ? 'Replace / reschedule' : 'Edit / reschedule'}</button>
          {item.kind === 'workout' && <button className={button} onClick={() => onScheduleChange(dismissOccurrence(schedule, item, 'skipped'))}>Skip</button>}
        </>}
      </div>}
      {item.status === 'skipped' && <button className={button} onClick={() => onScheduleChange({ ...schedule, exceptions: { ...schedule.exceptions, [item.occurrenceId]: { ...schedule.exceptions[item.occurrenceId], status: undefined } } })}>Undo skip</button>}
    </article>;
  };
  return <div className="mx-auto max-w-7xl space-y-6 pb-8" data-testid="today-screen">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-black">Today</h1><p className="text-sm text-slate-400">{weekday(today)}</p></div><button className={button} onClick={onPlan}>Manage routines</button></header>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="space-y-4 min-w-0">
        <section className="rounded-2xl border border-emerald-500/30 bg-slate-900 p-5 space-y-4" aria-label="Next workout">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">{priority.kind === 'resume' ? 'Unfinished workout' : priority.kind === 'scheduled' ? 'Scheduled today' : priority.kind === 'rest' ? 'Rest day' : 'Next in rotation'}</p>
          <h2 className="text-2xl font-bold break-words">{priority.kind === 'resume' ? activeSession?.name : template?.name ?? (priority.kind === 'scheduled' ? 'Routine unavailable' : priority.kind === 'rest' ? 'Recovery is on the plan' : 'Choose your first routine')}</h2>
          {template && <><p className="text-sm text-slate-300">{template.exercises.length} exercises · {workingSets} working sets · About {estimatedMinutes} min</p><p className="text-xs text-slate-400">Duration is an estimate including rest. Last performed: {lastPerformed ?? 'Not yet'}</p><ul className="space-y-1 text-sm">{template.exercises.slice(0, 5).map((ex, i) => <li key={i}>{ex.name} · {ex.suggestedSets || 3} × {ex.targetReps}</li>)}{template.exercises.length > 5 && <li>+ {template.exercises.length - 5} more exercises in preview</li>}</ul></>}
          <div className="flex flex-wrap gap-2">
            {priority.kind === 'resume' ? <button className={primary} onClick={onResume}>Resume workout</button> : template ? <><button className={primary} onClick={() => onStart(template, appointmentId)}>Start workout</button><button className={button} onClick={() => onPreview(template, appointmentId)}>Preview workout</button></> : priority.kind === 'scheduled' ? <button className={primary} onClick={() => openEditor(today, priority.appointment)}>Replace routine</button> : <button className={primary} onClick={onPlan}>{priority.kind === 'rest' ? 'Choose an unscheduled workout' : 'Choose or create routine'}</button>}
            {template && <button className={button} onClick={onPlan}>Choose another</button>}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-700 p-4 space-y-2" aria-label="Weekly progress"><p className="font-bold">{thisWeek.length} / {weeklyGoal} sessions this week</p><p className="text-sm text-slate-400">{trendExercise ? `${trendExercise.name}: four-week estimated strength trend ${trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'steady'}.` : `${sessions.filter(c => c.date < today).length} completed sessions before today.`}</p></section>
        {missed.length > 0 && <section className="rounded-2xl border border-amber-500/40 p-4 space-y-3" aria-label="Missed sessions"><h2 className="font-bold text-amber-300">Missed planned sessions ({missed.length})</h2><p className="text-xs text-slate-400">Nothing moves automatically. Reschedule or skip each session.</p>{missed.map(item => <div key={item.occurrenceId}><p className="mb-1 text-xs text-slate-400">{weekday(item.date)}</p>{renderOccurrence(item)}</div>)}</section>}
      </div>
      <section className="min-w-0 rounded-2xl border border-slate-700 p-3 sm:p-4 space-y-4" aria-label="Training calendar">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Training calendar</h2><button className={button} onClick={() => openEditor(selectedDay)}>Schedule workout or rest</button></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><button className={button} aria-label="Previous week" onClick={() => { setWeek(addDays(week, -7)); setSelectedDay(addDays(week, -7)); }}>←</button><span className="text-xs">{weekday(week)} – {weekday(addDays(week, 6))}</span><button className={button} aria-label="Next week" onClick={() => { setWeek(addDays(week, 7)); setSelectedDay(addDays(week, 7)); }}>→</button><button className={button} onClick={() => { setWeek(weekStart(today)); setSelectedDay(today); }}>This week</button></div>
        <div className="flex overflow-x-auto gap-2 lg:hidden pb-2" aria-label="Select day">{Array.from({ length: 7 }, (_, i) => addDays(week, i)).map(date => <button aria-pressed={date === selectedDay} className={`${button} shrink-0 ${date === selectedDay ? 'bg-emerald-500/20 border-emerald-500' : ''}`} key={date} onClick={() => setSelectedDay(date)}>{weekday(date)}</button>)}</div>
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 7 }, (_, i) => addDays(week, i)).map(date => <div key={date} className={`min-w-0 space-y-2 ${date === selectedDay ? '' : 'hidden lg:block'}`} data-testid={`calendar-${date}`}>
          <button className={`text-xs font-bold py-2 ${date === today ? 'text-emerald-300' : 'text-slate-300'}`} onClick={() => openEditor(date)} aria-label={`Schedule on ${date}`}>{weekday(date)}{date === today && ' · Today'} +</button>
          {weekly.filter(item => item.date === date).map(renderOccurrence)}
          {sessions.filter(c => c.date === date && !weekly.some(o => o.sessionId === c.sessionId)).map(c => <div className="rounded-xl bg-slate-800 p-3 text-sm" key={c.sessionId}><p className="font-bold break-words">{c.name}</p><p className="text-xs text-emerald-300">Completed · {c.appointmentId ? 'Scheduled' : 'Unscheduled'}</p></div>)}
          {!weekly.some(o => o.date === date) && !sessions.some(c => c.date === date) && <p className="text-xs text-slate-500 pb-3">No appointments</p>}
        </div>)}</div>
      </section>
    </div>
    {editor && <div className="fixed inset-0 z-[100] bg-slate-950/90 p-3 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Schedule appointment"><form onSubmit={save} className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-600 p-5 space-y-4">
      <h2 className="text-xl font-bold">{editor.item ? 'Edit appointment' : 'Schedule appointment'}</h2>
      <label className="block text-sm">Date<input className={input} type="date" required value={editDate} onChange={e => setEditDate(e.target.value)} /></label>
      <label className="block text-sm">Type<select className={input} value={kind} onChange={e => setKind(e.target.value as 'workout' | 'rest')}><option value="workout">Workout</option><option value="rest">Rest day</option></select></label>
      {kind === 'workout' && <label className="block text-sm">Routine<select className={input} value={templateId} onChange={e => setTemplateId(e.target.value)} required><option value="" disabled>Choose a routine</option>{!templates.some(t => t.id === templateId) && templateId && <option value={templateId} disabled>Routine unavailable — choose replacement</option>}{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      {!editor.item && <label className="flex gap-2 text-sm"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />Repeat weekly</label>}
      {editor.item?.repeat && <label className="block text-sm">Apply changes to<select className={input} value={scope} onChange={e => setScope(e.target.value as 'one' | 'future')}><option value="one">This occurrence</option><option value="future">This and future occurrences</option></select></label>}
      <div className="flex flex-wrap gap-2"><button className={primary} type="submit" disabled={kind === 'workout' && !templates.some(t => t.id === templateId)}>Save appointment</button><button className={button} type="button" onClick={() => setEditor(null)}>Cancel</button>{editor.item && <button className={`${button} text-rose-300`} type="button" onClick={() => { onScheduleChange(dismissOccurrence(schedule, editor.item!, 'removed', scope)); setEditor(null); }}>Remove appointment</button>}</div>
    </form></div>}
  </div>;
}
