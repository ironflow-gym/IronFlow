import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Info } from 'lucide-react';
import { BiometricEntry, UserSettings } from '../../types';
import { getBodyCompositionProjection } from '../../src/utils';

interface Props {
  biometricHistory: BiometricEntry[];
  userSettings: UserSettings;
}

const BodyCompositionProjection: React.FC<Props> = ({ biometricHistory, userSettings }) => {
  const [showInfo, setShowInfo] = useState(false);
  const weightUnit = userSettings.units === 'imperial' ? 'lb' : 'kg';
  const toDisplay = (kg: number) =>
    userSettings.units === 'imperial' ? Math.round(kg * 2.20462 * 10) / 10 : kg;

  const sorted = useMemo(() =>
    [...biometricHistory]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => ({
        date: e.date,
        weight: e.unit === 'lbs' ? e.weight * 0.453592 : e.weight,
        bodyFat: e.bodyFat,
        unit: 'kgs' as const,
      })),
    [biometricHistory]
  );

  const proj = useMemo(() => getBodyCompositionProjection(sorted), [sorted]);

  const hasBodyFat = proj.history.some(h => h.lean != null);

  // ── Chart data ────────────────────────────────────────────────────────────────
  // Strategy: build a single merged array where every point can carry either
  // actual values (weight/lean/fat) or projected values (projWeight/projLean/projFat)
  // or both. The projection line needs a value at the EXACT same date as the last
  // historical point so that the dashed line visually continues from there —
  // otherwise there is a gap between the end of history and the start of projection.
  const chartData = useMemo(() => {
    // Map historical entries
    const hist = proj.history.map(h => ({
      date: h.date.slice(5), // MM-DD for display
      dateFull: h.date,
      weight:    toDisplay(h.weight),
      lean:      h.lean != null ? toDisplay(h.lean) : undefined,
      fat:       h.fat  != null ? toDisplay(h.fat)  : undefined,
      projWeight: undefined as number | undefined,
      projLean:   undefined as number | undefined,
      projFat:    undefined as number | undefined,
    }));

    // Map projection entries (future dates only)
    const projPoints = proj.projection.map(p => ({
      date:      p.date.slice(5),
      dateFull:  p.date,
      weight:    undefined as number | undefined,
      lean:      undefined as number | undefined,
      fat:       undefined as number | undefined,
      projWeight: p.weight != null ? toDisplay(p.weight) : undefined,
      projLean:   p.lean   != null ? toDisplay(p.lean)   : undefined,
      projFat:    p.fat    != null ? toDisplay(p.fat)    : undefined,
    }));

    if (hist.length === 0) return projPoints;

    // Bridge: copy the last historical point's display values into a new entry
    // that ALSO carries projWeight/projLean/projFat. This ensures the dashed
    // projection line starts at exactly the same x-position where the solid
    // history line ends, with no gap.
    const last = hist[hist.length - 1];
    const bridge = {
      ...last,
      projWeight: last.weight,
      projLean:   last.lean,
      projFat:    last.fat,
    };
    // Replace the last hist entry with the bridge version (same date, both values)
    const histWithBridge = [...hist.slice(0, -1), bridge];

    return [...histWithBridge, ...projPoints];
  }, [proj, userSettings.units]);

  if (sorted.length < 2) {
    return (
      <div className="flex flex-col gap-3 h-full">
        <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest shrink-0">Composition Projection</h3>
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-black uppercase tracking-widest text-center px-4">
          Log at least 2 biometric entries to see your trajectory
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Composition Projection</h3>
          <div className="relative">
            <button onClick={() => setShowInfo(v => !v)} className="text-slate-600 hover:text-slate-400 transition-colors">
              <Info size={13} />
            </button>
            {showInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowInfo(false)} />
                <div className="absolute left-0 top-6 z-50 w-72 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-2">
                  <p className="text-[11px] font-black text-slate-100 uppercase tracking-widest">Composition Projection</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Uses linear regression on your logged bodyweight (and body fat % if available) to project
                    where your current trend puts you in 90 days.
                  </p>
                  <p className="text-[10px] text-amber-400/80 leading-relaxed">
                    The dashed projection assumes your current trend continues unchanged. It is a planning
                    tool, not a prediction. More entries = more accurate projection.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        {!proj.hasProjection && sorted.length >= 2 && (
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Need 3+ entries to project</span>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}${weightUnit}`}
              width={40}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(val: number, name: string) => {
                const labels: Record<string, string> = {
                  weight:     `Weight (${weightUnit})`,
                  projWeight: `Projected weight (${weightUnit})`,
                  lean:       `Lean mass (${weightUnit})`,
                  projLean:   `Projected lean (${weightUnit})`,
                  fat:        `Fat mass (${weightUnit})`,
                  projFat:    `Projected fat (${weightUnit})`,
                };
                return [val, labels[name] ?? name];
              }}
            />

            {/* ── Actual (solid) lines ── */}
            <Line
              dataKey="weight"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={{ r: 2.5, fill: '#94a3b8', strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
              name="weight"
            />
            {hasBodyFat && (
              <Line
                dataKey="lean"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 2, fill: '#10b981', strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
                name="lean"
              />
            )}
            {hasBodyFat && (
              <Line
                dataKey="fat"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 2, fill: '#f97316', strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
                name="fat"
              />
            )}

            {/* ── Projected (dashed) lines ── */}
            {proj.hasProjection && (
              <Line
                dataKey="projWeight"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
                name="projWeight"
              />
            )}
            {proj.hasProjection && hasBodyFat && (
              <Line
                dataKey="projLean"
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
                name="projLean"
              />
            )}
            {proj.hasProjection && hasBodyFat && (
              <Line
                dataKey="projFat"
                stroke="#f97316"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
                name="projFat"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap shrink-0">
        <span className="text-[9px] font-black text-slate-500 flex items-center gap-1.5">
          <span className="w-4 inline-block" style={{ borderTop: '2px solid #94a3b8' }} /> Weight
        </span>
        {hasBodyFat && (
          <>
            <span className="text-[9px] font-black text-slate-500 flex items-center gap-1.5">
              <span className="w-4 inline-block" style={{ borderTop: '2px solid #10b981' }} /> Lean
            </span>
            <span className="text-[9px] font-black text-slate-500 flex items-center gap-1.5">
              <span className="w-4 inline-block" style={{ borderTop: '2px solid #f97316' }} /> Fat
            </span>
          </>
        )}
        {proj.hasProjection && (
          <span className="text-[9px] font-black text-slate-500 flex items-center gap-1.5">
            <span className="w-4 inline-block" style={{ borderTop: '2px dashed #94a3b8' }} /> 90-day projection
          </span>
        )}
      </div>
    </div>
  );
};

export default BodyCompositionProjection;
