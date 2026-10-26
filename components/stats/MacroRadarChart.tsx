import React, { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { FuelLog, FuelProfile, BiometricEntry, UserSettings } from '../../types';
import { nutritionTargets } from '../../src/nutritionTargets';
import { loggedDayAverage } from '../../src/food';
import { localDate } from '../../src/scheduling';

interface Props {
  fuelHistory: FuelLog[];
  fuelProfile: FuelProfile;
  biometricHistory: BiometricEntry[];
  userSettings: UserSettings;
}

const MacroRadarChart: React.FC<Props> = ({ fuelHistory, fuelProfile, biometricHistory, userSettings }) => {
  const today = localDate();
  const average = useMemo(() => loggedDayAverage(fuelHistory, today), [fuelHistory, today]);

  const targets = useMemo(() => nutritionTargets(fuelProfile, biometricHistory, userSettings), [biometricHistory, fuelProfile, userSettings]);

  const actuals = average.days ? average.totals : null;

  if (!actuals) {
    return (
      <div className="flex flex-col gap-3 h-full">
        <h3 className="text-base font-bold text-slate-100 shrink-0">Macro Balance</h3>
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-black uppercase tracking-widest text-center px-4">
          Log meals this week to see macro balance
        </div>
      </div>
    );
  }

  // Express actuals as % of target (capped at 150%)
  const pct = (actual: number, target: number) => Math.min(Math.round((actual / target) * 100), 150);

  const radarData = [
    { macro: 'Calories', actual: pct(actuals.calories, targets.calories), target: 100, actualVal: actuals.calories, targetVal: targets.calories, unit: 'kcal' },
    { macro: 'Protein',  actual: pct(actuals.protein, targets.protein),   target: 100, actualVal: actuals.protein,  targetVal: targets.protein,  unit: 'g' },
    { macro: 'Carbs',    actual: pct(actuals.carbs, targets.carbs),       target: 100, actualVal: actuals.carbs,    targetVal: targets.carbs,    unit: 'g' },
    { macro: 'Fats',     actual: pct(actuals.fats, targets.fats),         target: 100, actualVal: actuals.fats,     targetVal: targets.fats,     unit: 'g' },
  ];

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <h3 className="text-base font-bold text-slate-100">Macro Balance</h3>
        <span className="text-sm text-slate-300">Average across {average.days} logged {average.days === 1 ? 'day' : 'days'}</span>
      </div>

      <p className="text-sm text-slate-300">Last 7 calendar days, including today. {average.days} of 7 days have entries; partially logged days may be incomplete.</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
            <PolarGrid stroke="#1e293b" />
            <PolarAngleAxis dataKey="macro" tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 700 }} />
            <Radar name="Target" dataKey="target" stroke="#94a3b8" fill="#64748b" fillOpacity={0.2} strokeWidth={1.5} strokeDasharray="4 3" />
            <Radar name="Actual" dataKey="actual" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
              formatter={(val: number, name: string, props: any) => {
                if (name === 'Actual') {
                  const d = props.payload;
                  return [`${d.actualVal}${d.unit} (${Math.round(d.actualVal / d.targetVal * 100)}% of target)`, 'Actual'];
                }
                if (name === 'Target') {
                  const d = props.payload;
                  return [`${d.targetVal}${d.unit}`, 'Target'];
                }
                return [val, name];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-sm text-slate-300">Solid: logged average · Dashed: target</p>
      {/* Macro breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 shrink-0">
        {radarData.map(({ macro, actualVal, targetVal, unit, actual }) => (
          <div key={macro} className="bg-slate-800/60 rounded-xl p-2 text-center">
            <div className={`text-base font-bold ${actual >= 90 && actual <= 115 ? 'text-emerald-400' : actual < 75 ? 'text-sky-400' : 'text-amber-400'}`}>
              {actualVal}{unit}
            </div>
            <div className="text-xs font-bold text-slate-300">{macro}</div>
            <div className="text-sm text-slate-300">goal {targetVal}{unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MacroRadarChart;
