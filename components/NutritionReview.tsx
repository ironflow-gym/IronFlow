import InfoButton from './ui/InfoButton';
import React, { useMemo, useState } from 'react';
import { FuelLog, FuelProfile, BiometricEntry, UserSettings } from '../types';
import MacroRadarChart from './stats/MacroRadarChart';
import { displayDate } from '../src/interfacePresentation';
import { dialogButton } from './ui/Modal';
import StatsSection, { statsAction } from './stats/StatsSection';
import { loggedDayAverage } from '../src/food';
import { nutritionTargets } from '../src/nutritionTargets';
import { nutritionReviewDays } from '../src/nutritionReview';
import { useLocalToday } from './stats/MobileProgressSummary';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function NutritionReview({ history, profile, biometricHistory, userSettings, onOpenFood }: {
  history: FuelLog[]; profile: FuelProfile; biometricHistory: BiometricEntry[]; userSettings: UserSettings; onOpenFood: () => void;
}) {
  const today = useLocalToday();
  const [limit, setLimit] = useState(14);
  const average = useMemo(() => loggedDayAverage(history, today), [history, today]);
  const targets = useMemo(() => nutritionTargets(profile, biometricHistory, userSettings), [profile, biometricHistory, userSettings]);
  const week = useMemo(() => nutritionReviewDays(history, today), [history, today]);
  const days = useMemo(() => {
    const grouped = new Map<string, { calories: number; protein: number; carbs: number; fats: number; count: number }>();
    for (const log of history) {
      const total = grouped.get(log.date) ?? { calories: 0, protein: 0, carbs: 0, fats: 0, count: 0 };
      for (const key of ['calories', 'protein', 'carbs', 'fats'] as const) total[key] += log[key];
      total.count++; grouped.set(log.date, total);
    }
    return [...grouped].sort(([a], [b]) => b.localeCompare(a));
  }, [history]);
  const format = (value: number) => Math.round(value * 10) / 10;
  return <section aria-label="Nutrition review" className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1"><h2 className="text-lg font-bold">Nutrition review</h2><InfoButton topic="nutrition" /></div><button className={`${statsAction} border-amber-400 text-amber-300 focus-visible:outline-amber-300`} onClick={onOpenFood}>Open food log</button></header>
    <section aria-label="Nutrition coverage" className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><p className="text-sm text-slate-300">Last 7 calendar days, including today</p><p className="mt-1 text-xl font-bold">{average.days} of 7 days logged</p><p className="mt-1 text-sm text-slate-300">Partially logged days may be incomplete. Missing days are not zero intake.</p></section>
    <StatsSection name="nutrition-averages" title="Average vs current targets" defaultOpen summary={`Average across ${average.days} logged ${average.days === 1 ? 'day' : 'days'}`}>
      {!average.days ? <p className="text-sm text-slate-300">Log food to compare recorded averages with your targets.</p> : (['calories','protein','carbs','fats'] as const).map(key => {
        const actual = average.totals[key], target = targets[key], unit = key === 'calories' ? 'kcal' : 'g', label = key === 'fats' ? 'Fat' : key[0].toUpperCase() + key.slice(1);
        const fill = target > 0 ? Math.max(0, Math.min(100, actual / target * 100)) : 0;
        const color = { calories:'bg-emerald-400', protein:'bg-cyan-400', carbs:'bg-blue-400', fats:'bg-amber-400' }[key];
        return <div key={key}><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-bold">{label}</span><span>{format(actual)} / {target} {unit}</span></div><div role="progressbar" aria-label={`${label} average`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill} aria-valuetext={`${format(actual)} of ${target} ${unit}, average across ${average.days} logged days`} className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700"><div className={`h-full ${color}`} style={{width:`${fill}%`}} /></div></div>;
      })}
    </StatsSection>
    <StatsSection name="nutrition-daily" title="Daily intake" defaultOpen summary="Recorded kcal · Gaps mean no entries">
      {average.days ? <><div className="h-48" role="img" aria-label="Daily recorded calories for the last seven days; missing days are gaps"><ResponsiveContainer width="100%" height="100%"><BarChart data={week}><XAxis dataKey="date" tickFormatter={date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short'})} tick={{fill:'#cbd5e1',fontSize:11}} /><YAxis domain={[0,'auto']} tick={{fill:'#cbd5e1',fontSize:11}} width={45} /><Tooltip labelFormatter={date => displayDate(String(date))} contentStyle={{background:'#0f172a',border:'1px solid #475569'}} /><Bar dataKey="calories" name="Recorded kcal" fill="#fbbf24" /></BarChart></ResponsiveContainer></div><ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300">{week.map(day => <li key={day.date}>{displayDate(day.date)}: {day.calories === null ? 'No entries' : `${format(day.calories)} kcal`}</li>)}</ul></> : <p className="text-sm text-slate-300">No entries in this seven-day window.</p>}
    </StatsSection>
    <StatsSection name="nutrition-totals" title="Daily totals" summary={`${days.length} logged dates · Review recorded amounts`}>
      <section aria-label="Daily nutrition totals"><p className="text-sm text-slate-300">Recorded food only; missing entries can make a day incomplete.</p>{!days.length && <p>No food logged yet.</p>}{days.slice(0,limit).map(([date,total])=><article key={date} className="border-t border-slate-700 py-3"><h3 className="font-bold">{displayDate(date)}</h3><p className="text-sm text-slate-300">{format(total.calories)} kcal · {format(total.protein)}g protein · {format(total.carbs)}g carbs · {format(total.fats)}g fat</p></article>)}{days.length > limit && <button className={dialogButton} onClick={()=>setLimit(value=>value+14)}>Show more days</button>}</section>
    </StatsSection>
    <StatsSection name="nutrition-macro" title="Macro detail" summary="Optional radar and target breakdown"><div className="h-[30rem]"><MacroRadarChart fuelHistory={history} fuelProfile={profile} biometricHistory={biometricHistory} userSettings={userSettings} /></div></StatsSection>
    <StatsSection name="nutrition-targets" title="Targets used in this review" summary="Compared with your current Food settings"><p className="text-sm text-slate-300">{profile.goal} · {targets.calories} kcal · {targets.protein}g protein · {targets.carbs}g carbs · {targets.fats}g fat. {targets.estimated ? 'Profile defaults were used where measurements are missing.' : 'Estimated targets.'} These are current targets, not historical prescriptions. Change settings in Food.</p></StatsSection>
  </section>;
}
