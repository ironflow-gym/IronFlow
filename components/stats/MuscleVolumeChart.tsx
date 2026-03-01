import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, Cell,
} from 'recharts';
import { Info } from 'lucide-react';
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

// Returns a colour based on where the value sits relative to thresholds
function barColour(sets: number, mev: number, mav: number, mrv: number): string {
  if (sets === 0)       return '#1e293b';  // no data
  if (sets < mev)       return '#64748b';  // below MEV — too little
  if (sets <= mav)      return '#10b981';  // MEV–MAV — sweet spot
  if (sets <= mrv)      return '#f59e0b';  // MAV–MRV — high but recoverable
  return '#ef4444';                        // above MRV — overreaching
}

const MuscleVolumeChart: React.FC<Props> = ({ history, userSettings }) => {
  const [selectedMuscle, setSelectedMuscle] = useState<string>('Chest');
  const [showInfo, setShowInfo] = useState(false);

  const weeklyData = useMemo(() => getWeeklySetsPerMuscleGroup(history, 8), [history]);

  const thresholds = useMemo(() => ({
    ...DEFAULT_MEV_MRV,
    ...(userSettings.mevMrvThresholds || {}),
  }), [userSettings.mevMrvThresholds]);

  const thresh = thresholds[selectedMuscle];

  // Single-muscle view: one bar per week showing sets for the selected muscle
  const chartData = useMemo(() =>
    weeklyData.map(w => ({
      week: w.week,
      sets: (w[selectedMuscle] as number) || 0,
    })),
  [weeklyData, selectedMuscle]);

  // Y-axis ceiling: comfortably above MRV so the red zone is always visible
  const dataMax = chartData.reduce((max, d) => Math.max(max, d.sets), 0);
  const yMax = thresh ? Math.max(thresh.mrv + 6, dataMax + 2) : Math.max(dataMax + 2, 30);

  const hasData = chartData.some(d => d.sets > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Weekly Volume</h3>
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
          <div className="relative">
            <button
              onClick={() => setShowInfo(v => !v)}
              className="text-slate-600 hover:text-slate-400 transition-colors"
              aria-label="How to read this chart"
            >
              <Info size={13} />
            </button>
            {showInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowInfo(false)} />
                <div className="absolute left-0 top-6 z-50 w-72 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3">
                  <p className="text-[11px] font-black text-slate-100 uppercase tracking-widest">How to read this chart</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Each bar shows how many sets you did for <span className="text-slate-200 font-black">{selectedMuscle}</span> in that week.
                    The background zones show whether your volume is in the right range.
                  </p>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grey bar — below MEV</p>
                        <p className="text-[9px] text-slate-500 leading-relaxed">Not enough volume to drive adaptation. Aim to add more sets.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Green zone — MEV to MAV (sweet spot)</p>
                        <p className="text-[9px] text-slate-500 leading-relaxed">Minimum Effective Volume to Maximum Adaptive Volume. This is where most of your weeks should land for consistent progress.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Amber zone — MAV to MRV</p>
                        <p className="text-[9px] text-slate-500 leading-relaxed">Maximum Adaptive Volume to Maximum Recoverable Volume. High volume that can still be recovered from, but not sustainable every week.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Red zone — above MRV</p>
                        <p className="text-[9px] text-slate-500 leading-relaxed">More than your body can recover from. Risk of fatigue and stalled progress if sustained.</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest border-t border-slate-800 pt-2">
                    Thresholds adjustable in Settings
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        <select
          value={selectedMuscle}
          onChange={e => setSelectedMuscle(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30"
        >
          {ALL_MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Zone legend — plain English */}
      {thresh && (
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1 text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/25 border border-emerald-500/40 inline-block" />
            Sweet spot {thresh.mev}–{thresh.mav}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1 text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/40 inline-block" />
            High {thresh.mav}–{thresh.mrv}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1 text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/25 border border-rose-500/40 inline-block" />
            Over limit {thresh.mrv}+
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 24, left: -16, bottom: 0 }}>

            {/* Zone fills — drawn first so bars render on top */}
            {thresh && (
              <>
                <ReferenceArea y1={0}           y2={thresh.mev} fill="#64748b" fillOpacity={0.08} />
                <ReferenceArea y1={thresh.mev}  y2={thresh.mav} fill="#10b981" fillOpacity={0.15} />
                <ReferenceArea y1={thresh.mav}  y2={thresh.mrv} fill="#f59e0b" fillOpacity={0.12} />
                <ReferenceArea y1={thresh.mrv}  y2={yMax}       fill="#ef4444" fillOpacity={0.18} />
              </>
            )}

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
              domain={[0, yMax]}
              allowDataOverflow={false}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(val: number) => [`${val} sets`, selectedMuscle]}
            />

            {/* Threshold labels on reference lines */}
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

            {/* Bars coloured by zone */}
            <Bar dataKey="sets" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={thresh ? barColour(entry.sets, thresh.mev, thresh.mav, thresh.mrv) : MUSCLE_COLORS[selectedMuscle]}
                  fillOpacity={entry.sets === 0 ? 0.3 : 0.85}
                />
              ))}
            </Bar>

          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest shrink-0">
        Sets per week for {selectedMuscle} · trailing 8 weeks
      </p>
    </div>
  );
};

export default MuscleVolumeChart;
