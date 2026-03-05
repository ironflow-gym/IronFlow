import React, { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { FuelLog, FuelProfile, BiometricEntry, UserSettings } from '../../types';
import { deriveMacroRatios } from '../../src/utils';

interface Props {
  fuelHistory: FuelLog[];
  fuelProfile: FuelProfile;
  biometricHistory: BiometricEntry[];
  userSettings: UserSettings;
}

const MacroRadarChart: React.FC<Props> = ({ fuelHistory, fuelProfile, biometricHistory, userSettings }) => {
  const last7Days = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return fuelHistory.filter(l => new Date(l.date) >= cutoff);
  }, [fuelHistory]);

  const targets = useMemo(() => {
    const latestBio = biometricHistory.length
      ? [...biometricHistory].sort((a, b) => a.date.localeCompare(b.date)).pop()
      : null;
    const bwKg = latestBio
      ? (latestBio.unit === 'lbs' ? latestBio.weight * 0.453592 : latestBio.weight)
      : 75;
    const { proteinRatio, carbCalorieFraction, fatCalorieFraction } = deriveMacroRatios(fuelProfile.goal, fuelProfile.preferences);
    const mult = fuelProfile.targetMultiplier ?? 1;
    const tdee = bwKg * 30 * mult; // rough estimate
    return {
      calories: Math.round(tdee),
      protein: Math.round(bwKg * proteinRatio),
      carbs: Math.round((tdee * carbCalorieFraction) / 4),
      fats: Math.round((tdee * fatCalorieFraction) / 9),
    };
  }, [biometricHistory, fuelProfile]);

  const actuals = useMemo(() => {
    if (!last7Days.length) return null;
    const days = new Set(last7Days.map(l => l.date)).size || 1;
    return {
      calories: Math.round(last7Days.reduce((s, l) => s + l.calories, 0) / days),
      protein: Math.round(last7Days.reduce((s, l) => s + l.protein, 0) / days),
      carbs: Math.round(last7Days.reduce((s, l) => s + l.carbs, 0) / days),
      fats: Math.round(last7Days.reduce((s, l) => s + l.fats, 0) / days),
    };
  }, [last7Days]);

  if (!actuals) {
    return (
      <div className="flex flex-col gap-3 h-full">
        <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest shrink-0">Macro Balance</h3>
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
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Macro Balance</h3>
        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">7-day avg vs target</span>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
            <PolarGrid stroke="#1e293b" />
            <PolarAngleAxis dataKey="macro" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
            <Radar name="Target" dataKey="target" stroke="#334155" fill="#334155" fillOpacity={0.2} strokeWidth={1.5} strokeDasharray="4 3" />
            <Radar name="Actual" dataKey="actual" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
              formatter={(val: number, name: string, props: any) => {
                if (name === 'Actual') {
                  const d = props.payload;
                  return [`${d.actualVal}${d.unit} (${val}% of target)`, 'Actual'];
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

      {/* Macro breakdown */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {radarData.map(({ macro, actualVal, targetVal, unit, actual }) => (
          <div key={macro} className="bg-slate-800/60 rounded-xl p-2 text-center">
            <div className={`text-xs font-black ${actual >= 90 && actual <= 115 ? 'text-emerald-400' : actual < 75 ? 'text-sky-400' : 'text-amber-400'}`}>
              {actualVal}{unit}
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{macro}</div>
            <div className="text-[9px] font-black text-slate-500">goal {targetVal}{unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MacroRadarChart;
