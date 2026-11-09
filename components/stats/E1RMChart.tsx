import { strengthTrend } from '../../src/strengthTrend';
import { useLocalToday } from './MobileProgressSummary';
import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { HistoricalLog, UserSettings } from '../../types';
import { calcE1RM } from '../../src/utils';
import { isCardioCategory } from '../../src/utils';

interface Props {
  history: HistoricalLog[];
  userSettings: UserSettings;
  /** If provided, renders in compact mode (right panel of template editor) */
  compact?: boolean;
}

const E1RMChart: React.FC<Props> = ({ history, userSettings, compact = false }) => {
  const today = useLocalToday();
  const unit = userSettings.units === 'imperial' ? 'lbs' : 'kg';

  // Build sorted exercise list (most recently trained first)
  const exercises = useMemo(() => {
    const resistance = history.filter(h => h.date <= today && h.tracking !== 'time' && !isCardioCategory(h.category) && !h.isWarmup);
    const lastSeen: Record<string, string> = {};
    resistance.forEach(h => {
      if (!lastSeen[h.exercise] || h.date > lastSeen[h.exercise]) lastSeen[h.exercise] = h.date;
    });
    return Object.keys(lastSeen).sort((a, b) => lastSeen[b].localeCompare(lastSeen[a]));
  }, [history, today]);

  const [selectedExercise, setSelectedExercise] = useState<string>(exercises[0] || '');

  const effectiveExercise = exercises.includes(selectedExercise) ? selectedExercise : exercises[0] ?? '';
  const chartData = useMemo(() => strengthTrend(history, effectiveExercise, userSettings.units === 'imperial', today), [history, effectiveExercise, userSettings.units, today]);

  if (exercises.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-600 text-xs font-black uppercase tracking-widest">
        No resistance training data
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${compact ? '' : 'h-full'}`}>
      {!compact && (
        <div className="flex items-center justify-between gap-4 shrink-0">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Estimated 1RM Trend · not a tested maximum</h3>
          <select
            aria-label="Strength trend exercise" value={effectiveExercise}
            onChange={e => setSelectedExercise(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30 max-w-[220px] truncate"
          >
            {exercises.map(ex => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </div>
      )}
      {compact && (
        <div className="shrink-0">
          <select
            aria-label="Strength trend exercise" value={effectiveExercise}
            onChange={e => setSelectedExercise(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 outline-none"
          >
            {exercises.map(ex => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </div>
      )}
      <div className={compact ? 'h-40' : 'flex-1 min-h-0'}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}${unit}`}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(val: number) => [`${val} ${unit}`, 'e1RM']}
            />
            <Line
              type="monotone"
              dataKey="e1rm"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#10b981' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {chartData.length > 0 && (
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">
          {chartData.length} sessions · Epley formula · {unit}
        </p>
      )}
    </div>
  );
};

export default E1RMChart;
