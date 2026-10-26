import React, { useMemo, useState } from 'react';
import { FuelLog, FuelProfile, BiometricEntry, UserSettings } from '../types';
import MacroRadarChart from './stats/MacroRadarChart';
import { displayDate } from '../src/interfacePresentation';
import { dialogButton, dialogPrimaryButton } from './ui/Modal';

export default function NutritionReview({ history, profile, biometricHistory, userSettings, onOpenFood }: {
  history: FuelLog[]; profile: FuelProfile; biometricHistory: BiometricEntry[]; userSettings: UserSettings; onOpenFood: () => void;
}) {
  const [limit, setLimit] = useState(14);
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
  return <section aria-label="Nutrition review" className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-bold">Nutrition</h2><p className="mt-1 text-sm text-slate-300">Review logged nutrition. Add, repeat, or correct entries in Food.</p></div>
      <button className={dialogPrimaryButton} onClick={onOpenFood}>Open food log</button>
    </header>
    <div className="h-80 rounded-2xl border border-slate-700 bg-slate-900 p-4"><MacroRadarChart fuelHistory={history} fuelProfile={profile} biometricHistory={biometricHistory} userSettings={userSettings} /></div>
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-6" aria-label="Daily nutrition totals">
      <h3 className="text-lg font-bold">Daily totals</h3><p className="mt-1 text-sm text-slate-300">Recorded food only; missing entries can make a day incomplete.</p>
      {!days.length && <p className="mt-4 text-slate-300">No food logged yet.</p>}
      <div className="mt-4 space-y-3">{days.slice(0, limit).map(([date, total]) => <article key={date} className="border-t border-slate-700 pt-3">
        <h4 className="font-bold">{displayDate(date)}</h4><p className="mt-1 text-sm text-slate-300">{format(total.calories)} kcal · {format(total.protein)}g protein · {format(total.carbs)}g carbs · {format(total.fats)}g fat</p>
      </article>)}</div>
      {days.length > limit && <button className={`${dialogButton} mt-4`} onClick={() => setLimit(value => value + 14)}>Show more days</button>}
    </section>
  </section>;
}
