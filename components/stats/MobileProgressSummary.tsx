import InfoButton from '../ui/InfoButton';
import React, { useMemo, useEffect, useState } from 'react';
import { localDate } from '../../src/scheduling';
import { validFoodDate } from '../../src/food';
import { ResponsiveContainer, LineChart, Line, Tooltip, YAxis, XAxis } from 'recharts';
import type { HistoricalLog, BiometricEntry, UserSettings } from '../../types';
import { recentTraining, bodyWeightSummary } from '../../src/mobileStats';
import { displayDate } from '../../src/interfacePresentation';
import { formatWeight } from '../../src/equipment';
const card = 'min-w-0 space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 [overflow-wrap:anywhere]';
const disclosure = 'min-h-11 cursor-pointer py-3 text-sm font-bold text-slate-300';
export function useLocalToday() {
  const [today, setToday] = useState(localDate());
  useEffect(() => {
    const refresh = () => setToday(localDate());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return today;
}
export function RecentTrainingSummary({ history, settings }: { history: HistoricalLog[]; settings: UserSettings }) {
  const today = useLocalToday();
  const data = useMemo(() => recentTraining(history, settings.weeklyWorkoutGoal ?? 3, today), [history, settings.weeklyWorkoutGoal, today]);
  const week = data.weeks.at(-1)!;
  const unit = settings.units === 'imperial' ? 'lb' : 'kg', weight = (kg: number) => formatWeight(kg / (unit === 'lb' ? 0.45359237 : 1));
  return <section aria-label="Recent training progress" className={card}>
    <h2 className="font-bold">Recent training</h2>
    <div className="grid grid-cols-2 gap-3"><div><p className="text-2xl font-bold">{data.count}</p><p className="text-sm text-slate-300">sessions · last 28 days</p></div><div><p className="text-2xl font-bold">{week.count} / {data.goal}</p><p className="text-sm text-slate-300">this week’s goal</p></div></div>
    {data.improvements.map(row => <p key={row.name} className="text-sm text-slate-200"><strong>{row.name}</strong>: {weight(row.first)} → {weight(row.last)} {unit}{/dumbbell|\bdb\b/i.test(row.name) ? ' per hand' : ''} × {row.reps} reps<span className="block text-xs text-slate-400">Comparable best working sets · {displayDate(row.from)} → {displayDate(row.to)}</span></p>)}
    {!data.improvements.length && <p className="text-sm text-slate-400">No comparable load improvement to show yet. Other kinds of progress remain in your detailed history.</p>}
    <details><summary className={disclosure}>Weekly consistency and calculation</summary><ul className="space-y-2 text-sm">{data.weeks.map(w => <li key={w.start}>{displayDate(w.start)}–{displayDate(w.end)}: {w.count}/{data.goal}{w.partial ? w.current ? ' · current week, still in progress' : ' · partial week in this 28-day window' : w.count >= data.goal ? ' · goal reached' : ''}</li>)}</ul><div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400"><span>Current weekly goal · recorded sessions</span><InfoButton topic="comparisons" /></div></details>
  </section>;
}
export function MobileBodyTrend({ history, settings }: { history: BiometricEntry[]; settings: UserSettings }) {
  const today = useLocalToday();
  const data = useMemo(() => bodyWeightSummary(history, today), [history, today]);
  const unit = settings.units === 'imperial' ? 'lb' : 'kg', factor = unit === 'lb' ? 1 / 0.45359237 : 1;
  const number = (kg: number) => (kg * factor).toFixed(1), change = (kg: number) => { const rounded = Math.round(kg * factor * 10) / 10; return `${rounded > 0 ? '+' : ''}${Object.is(rounded, -0) ? '0.0' : rounded.toFixed(1)} ${unit}`; };
  const points = data.points.map(p => ({ date: p.date, recorded: p.recorded === null ? null : p.recorded * factor, average: p.average === null ? null : p.average * factor }));
  return <section aria-label="Body weight trend" className={card}>
    <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Body-weight trend</h2><InfoButton topic="bodyTrend" /></div>
    {!data.latest ? <p className="text-sm text-slate-300">Add a measurement below to begin tracking your weight.</p> : <>
      <p className="text-lg font-bold">{number(data.latest.weight * (data.latest.unit === 'lbs' ? 0.45359237 : 1))} {unit}<span className="block text-xs font-normal text-slate-400">Last measured {displayDate(data.latest.date)} · {data.daysSinceLatest === 0 ? 'today' : `${data.daysSinceLatest} ${data.daysSinceLatest === 1 ? 'day' : 'days'} ago`}</span></p>
      {data.current && data.previous ? <p className="text-sm">7-day recorded average: <strong>{number(data.current.weight)} {unit}</strong> · {change(data.current.weight - data.previous.weight)} versus the previous seven days<span className="block text-xs text-slate-400">{data.current.count} measurement days this period; {data.previous.count} in the previous period.</span></p> : data.recordedChange ? <p className="text-sm">Recorded change: <strong>{change(data.recordedChange.change)}</strong><span className="block text-xs text-slate-400">{displayDate(data.recordedChange.from)} → {displayDate(data.recordedChange.to)}. Too few recent measurement days for a weekly-average comparison.</span></p> : <p className="text-sm text-slate-400">Another dated measurement is needed to show a recorded change.</p>}
      {points.some(p => p.recorded !== null) && <><div className="h-32" role="img" aria-label="Last 28 days of recorded weight, with a seven-day average only where enough measurements exist"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}><XAxis dataKey="date" hide /><YAxis hide domain={['auto', 'auto']} /><Tooltip labelFormatter={date => typeof date === 'string' && validFoodDate(date) ? displayDate(date) : ''} formatter={(value: any, name: any) => [`${Number(value).toFixed(1)} ${unit}`, name === 'average' ? '7-day average' : 'Recorded weight']} contentStyle={{ background: '#0f172a', border: '1px solid #475569', fontSize: 12 }} /><Line dataKey="recorded" name="recorded" stroke="#94a3b8" strokeWidth={1} connectNulls={false} dot={{ r: 2 }} isAnimationActive={false} /><Line dataKey="average" name="average" stroke="#22d3ee" strokeWidth={2} connectNulls={false} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div><p className="text-xs text-slate-400">Last 28 days · Grey: readings · Cyan: 7-day average</p></>}
      {data.waistChange && <p className="text-sm text-slate-300">Waist: {data.waistChange.change > 0 ? '+' : ''}{(data.waistChange.change / (unit === 'lb' ? 2.54 : 1)).toFixed(1)} {unit === 'lb' ? 'in' : 'cm'} · {displayDate(data.waistChange.from)} → {displayDate(data.waistChange.to)}</p>}

    </>}
  </section>;
}
