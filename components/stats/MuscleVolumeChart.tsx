import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts';
import { HistoricalLog, UserSettings } from '../../types';
import { getWeeklySetsPerMuscleGroup, DEFAULT_MEV_MRV } from '../../src/utils';

interface Props {
  history: HistoricalLog[];
  userSettings: UserSettings;
}

const MUSCLE_COLORS: Record<string, string> = {
  'Chest':       '#10b981',
  'Front Delts': '#06b6d4',
  'Side Delts':  '#0ea5e9',
  'Rear Delts':  '#6366f1',
  'Biceps':      '#f59e0b',
  'Triceps':     '#f97316',
  'Upper Back':  '#8b5cf6',
  'Lats':        '#a855f7',
  'Traps':       '#ec4899',
  'Quads':       '#14b8a6',
  'Hamstrings':  '#84cc16',
  'Glutes':      '#ef4444',
  'Calves':      '#64748b',
  'Core':        '#94a3b8',
};

const ALL_MUSCLES = Object.keys(MUSCLE_COLORS);

const MuscleVolumeChart: React.FC<Props> = ({ history, userSettings }) => {
  const [selectedMuscle, setSelectedMuscle] = useState<string>('Chest');

  const weeklyData = useMemo(() => getWeeklySetsPerMuscleGroup(history, 8), [history]);

  const thresholds = useMemo(() => {
    const custom = userSettings.mevMrvThresholds || {};
    return { ...DEFAULT_MEV_MRV, ...custom };
  }, [userSettings.mevMrvThresholds]);

  const thresh = thresholds[selectedMuscle];

  // Which muscles actually appear in the data
  const activeMuscles = useMemo(() => {
    const found = new Set<string>();
    weeklyData.forEach(w => ALL_MUSCLES.forEach(m => { if ((w[m] as number) > 0) found.add(m); }));
    return ALL_MUSCLES.filter(m => found.has(m));
  }, [weeklyData]);

  if (weeklyData.every(w => activeMuscles.every(m => !w[m]))) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-600 text-xs font-black uppercase tracking-widest">
        No training data for last 8 weeks
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Weekly Volume (sets)</h3>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Thresholds:</span>
          <select
            value={selectedMuscle}
            onChange={e => setSelectedMuscle(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30"
          >
            {ALL_MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Threshold legend */}
      {thresh && (
        <div className="flex gap-4 shrink-0">
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded bg-emerald-500/60 inline-block" />
            MEV {thresh.mev}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded bg-amber-500/60 inline-block" />
            MAV {thresh.mav}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded bg-rose-500/60 inline-block" />
            MRV {thresh.mrv}
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            {activeMuscles.map(m => (
              <Bar key={m} dataKey={m} stackId="a" fill={MUSCLE_COLORS[m]} radius={m === activeMuscles[activeMuscles.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
            ))}
            {thresh && (
              <>
                <ReferenceLine y={thresh.mev} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1.5} />
                <ReferenceLine y={thresh.mav} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} />
                <ReferenceLine y={thresh.mrv} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest shrink-0">
        Trailing 8 weeks · stacked by muscle group · reference lines for {selectedMuscle}
      </p>
    </div>
  );
};

export default MuscleVolumeChart;
