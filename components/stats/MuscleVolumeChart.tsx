import InfoButton from '../ui/InfoButton';
import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, Cell,
} from 'recharts';
import { HistoricalLog, UserSettings, ExerciseLibraryItem } from '../../types';
import { getWeeklySetsPerMuscleGroup, DEFAULT_MEV_MRV } from '../../src/utils';
import { DEFAULT_LIBRARY } from '../ExerciseLibrary';

interface Props {
  history: HistoricalLog[];
  userSettings: UserSettings;
  customLibrary?: ExerciseLibraryItem[];
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

function barColour(sets: number, mev: number, mav: number, mrv: number): string {
  if (sets === 0)  return '#1e293b';
  if (sets < mev)  return '#64748b';
  if (sets <= mav) return '#10b981';
  if (sets <= mrv) return '#f59e0b';
  return '#ef4444';
}

const MuscleVolumeChart: React.FC<Props> = ({ history, userSettings, customLibrary = [] }) => {
  const [selectedMuscle, setSelectedMuscle] = useState<string>('Chest');

  const weeklyData = useMemo(
    () => getWeeklySetsPerMuscleGroup(history, 8, [...DEFAULT_LIBRARY, ...customLibrary]),
    [history, customLibrary]
  );

  const thresholds = useMemo(() => ({
    ...DEFAULT_MEV_MRV,
    ...(userSettings.mevMrvThresholds || {}),
  }), [userSettings.mevMrvThresholds]);

  const thresh = thresholds[selectedMuscle];

  // Tag last entry as current (partial) week
  const chartData = useMemo(() =>
    weeklyData.map((w, i) => ({
      week: w.week,
      sets: (w[selectedMuscle] as number) || 0,
      isCurrent: i === weeklyData.length - 1,
    })),
  [weeklyData, selectedMuscle]);

  const dataMax = chartData.reduce((max, d) => Math.max(max, d.sets), 0);
  const yMax = thresh ? Math.max(thresh.mrv + 6, dataMax + 2) : Math.max(dataMax + 2, 30);

  const hasData = chartData.some(d => d.sets > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Weekly Volume</h3><InfoButton topic="volume" />
          <select
            value={selectedMuscle}
            onChange={e => setSelectedMuscle(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 outline-none"
          >
            {ALL_MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-center flex-1 text-slate-600 text-xs font-black uppercase tracking-widest">
          No {selectedMuscle} data in last 8 weeks
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Weekly Volume</h3>
          <InfoButton topic="volume" />
        </div>
        <select
          value={selectedMuscle}
          onChange={e => setSelectedMuscle(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30"
        >
          {ALL_MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Zone legend */}
      {thresh && (
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/25 border border-emerald-500/40 inline-block" />
            Sweet spot {thresh.mev}–{thresh.mav}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/40 inline-block" />
            High {thresh.mav}–{thresh.mrv}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/25 border border-rose-500/40 inline-block" />
            Over {thresh.mrv}+
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 24, left: -16, bottom: 0 }}>

            {thresh && (
              <>
                <ReferenceArea y1={0}          y2={thresh.mev} fill="#64748b" fillOpacity={0.08} />
                <ReferenceArea y1={thresh.mev} y2={thresh.mav} fill="#10b981" fillOpacity={0.15} />
                <ReferenceArea y1={thresh.mav} y2={thresh.mrv} fill="#f59e0b" fillOpacity={0.12} />
                <ReferenceArea y1={thresh.mrv} y2={yMax}       fill="#ef4444" fillOpacity={0.18} />
              </>
            )}

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false}
              domain={[0, yMax]} allowDataOverflow={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(val: number, _: string, props: { payload?: { isCurrent?: boolean } }) => {
                const suffix = props.payload?.isCurrent ? ' (in progress)' : '';
                return [`${val} sets${suffix}`, selectedMuscle];
              }}
            />

            {thresh && (
              <>
                <ReferenceLine y={thresh.mev} stroke="#10b981" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 3"
                  label={{ value: `MEV ${thresh.mev}`, position: 'right', fontSize: 9, fontWeight: 700, fill: '#10b981' }} />
                <ReferenceLine y={thresh.mav} stroke="#f59e0b" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 3"
                  label={{ value: `MAV ${thresh.mav}`, position: 'right', fontSize: 9, fontWeight: 700, fill: '#f59e0b' }} />
                <ReferenceLine y={thresh.mrv} stroke="#ef4444" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 3"
                  label={{ value: `MRV ${thresh.mrv}`, position: 'right', fontSize: 9, fontWeight: 700, fill: '#ef4444' }} />
              </>
            )}

            <Bar dataKey="sets" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={thresh ? barColour(entry.sets, thresh.mev, thresh.mav, thresh.mrv) : MUSCLE_COLORS[selectedMuscle]}
                  fillOpacity={entry.isCurrent ? 0.25 : (entry.sets === 0 ? 0.3 : 0.85)}
                  stroke={entry.isCurrent && entry.sets > 0 ? (thresh ? barColour(entry.sets, thresh.mev, thresh.mav, thresh.mrv) : MUSCLE_COLORS[selectedMuscle]) : 'none'}
                  strokeWidth={entry.isCurrent ? 1.5 : 0}
                  strokeDasharray={entry.isCurrent ? '3 2' : undefined}
                />
              ))}
            </Bar>

          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest shrink-0">
        Sets per week for {selectedMuscle} · trailing 8 weeks · dimmed bar = current week
      </p>
    </div>
  );
};

export default MuscleVolumeChart;
