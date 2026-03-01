import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
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

const MuscleVolumeChart: React.FC<Props> = ({ history, userSettings }) => {
  const [selectedMuscle, setSelectedMuscle] = useState<string>('Chest');
  const [showInfo, setShowInfo] = useState(false);

  const weeklyData = useMemo(() => getWeeklySetsPerMuscleGroup(history, 8), [history]);

  const thresholds = useMemo(() => {
    const custom = userSettings.mevMrvThresholds || {};
    return { ...DEFAULT_MEV_MRV, ...custom };
  }, [userSettings.mevMrvThresholds]);

  const thresh = thresholds[selectedMuscle];

  const activeMuscles = useMemo(() => {
    const found = new Set<string>();
    weeklyData.forEach(w => ALL_MUSCLES.forEach(m => { if ((w[m] as number) > 0) found.add(m); }));
    return ALL_MUSCLES.filter(m => found.has(m));
  }, [weeklyData]);

  // Y-axis ceiling: max of MRV + 4 or highest data value, so zones always render fully
  const yMax = useMemo(() => {
    let dataMax = 0;
    weeklyData.forEach(w => {
      const total = activeMuscles.reduce((sum, m) => sum + ((w[m] as number) || 0), 0);
      if (total > dataMax) dataMax = total;
    });
    return thresh ? Math.max(thresh.mrv + 4, dataMax + 2) : dataMax + 2;
  }, [weeklyData, activeMuscles, thresh]);

  if (weeklyData.every(w => activeMuscles.every(m => !w[m]))) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-600 text-xs font-black uppercase tracking-widest">
        No training data for last 8 weeks
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Weekly Volume</h3>
          {/* Info tooltip trigger */}
          <div className="relative">
            <button
              onClick={() => setShowInfo(v => !v)}
              className="text-slate-600 hover:text-slate-400 transition-colors"
              aria-label="Volume zone explanation"
            >
              <Info size={13} />
            </button>
            {showInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowInfo(false)} />
                <div className="absolute left-0 top-6 z-50 w-72 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3">
                  <p className="text-[11px] font-black text-slate-100 uppercase tracking-widest">Reading the Volume Zones</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    This chart shows how many sets per week you trained each muscle group over the last 8 weeks.
                    The coloured background zones help you see whether your volume is in the right range for your goals.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <span className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/50 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Green — Minimum Effective Volume (MEV)</p>
                        <p className="text-[9px] text-slate-500 leading-relaxed">The least amount of weekly sets needed to make progress. Below this line, you are likely doing too little to stimulate growth.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/40 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Amber — Maximum Adaptive Volume (MAV)</p>
                        <p className="text-[9px] text-slate-500 leading-relaxed">The sweet spot. Volume between MEV and MAV produces the best gains for most people. Aim to train here consistently.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-3 h-3 rounded-sm bg-rose-500/20 border border-rose-500/40 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Red — Maximum Recoverable Volume (MRV)</p>
                        <p className="text-[9px] text-slate-500 leading-relaxed">Above this line, you are doing more than your body can recover from. This can lead to fatigue, stalled progress, or injury over time.</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest border-t border-slate-800 pt-2">
                    Thresholds shown for: {selectedMuscle} · Adjust in Settings
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Zones for:</span>
          <select
            value={selectedMuscle}
            onChange={e => setSelectedMuscle(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30"
          >
            {ALL_MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Zone legend — compact, always visible */}
      {thresh && (
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 text-slate-500">
            <span className="w-3 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500/50 inline-block" />
            Under MEV ({thresh.mev})
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 text-slate-500">
            <span className="w-3 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/40 inline-block" />
            Sweet spot ({thresh.mev}–{thresh.mav})
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 text-slate-500">
            <span className="w-3 h-2.5 rounded-sm bg-rose-500/20 border border-rose-500/40 inline-block" />
            Over MRV ({thresh.mrv}+)
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
              domain={[0, yMax]}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
              labelStyle={{ color: '#94a3b8' }}
            />

            {/* Zone fills — rendered before bars so bars sit on top */}
            {thresh && (
              <>
                {/* Below MEV — too little volume */}
                <ReferenceArea y1={0} y2={thresh.mev} fill="#10b981" fillOpacity={0.07} ifOverflow="extendDomain" />
                {/* MEV → MAV — sweet spot */}
                <ReferenceArea y1={thresh.mev} y2={thresh.mav} fill="#f59e0b" fillOpacity={0.10} ifOverflow="extendDomain" />
                {/* MAV → MRV — approaching limit */}
                <ReferenceArea y1={thresh.mav} y2={thresh.mrv} fill="#ef4444" fillOpacity={0.10} ifOverflow="extendDomain" />
                {/* Above MRV — overreaching */}
                <ReferenceArea y1={thresh.mrv} y2={yMax} fill="#ef4444" fillOpacity={0.18} ifOverflow="extendDomain" />

                {/* Boundary lines — subtle, labelled */}
                <ReferenceLine y={thresh.mev} stroke="#10b981" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 3"
                  label={{ value: 'MEV', position: 'insideTopRight', fontSize: 9, fontWeight: 700, fill: '#10b981', opacity: 0.8 }} />
                <ReferenceLine y={thresh.mav} stroke="#f59e0b" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 3"
                  label={{ value: 'MAV', position: 'insideTopRight', fontSize: 9, fontWeight: 700, fill: '#f59e0b', opacity: 0.8 }} />
                <ReferenceLine y={thresh.mrv} stroke="#ef4444" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 3"
                  label={{ value: 'MRV', position: 'insideTopRight', fontSize: 9, fontWeight: 700, fill: '#ef4444', opacity: 0.8 }} />
              </>
            )}

            {/* Bars rendered on top of zones */}
            {activeMuscles.map(m => (
              <Bar
                key={m}
                dataKey={m}
                stackId="a"
                fill={MUSCLE_COLORS[m]}
                radius={m === activeMuscles[activeMuscles.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest shrink-0">
        Trailing 8 weeks · stacked by muscle group · zones for {selectedMuscle}
      </p>
    </div>
  );
};

export default MuscleVolumeChart;
