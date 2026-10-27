import InfoButton from '../ui/InfoButton';
import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { HistoricalLog } from '../../types';
import { getWeeklyTonnage } from '../../src/utils';

interface Props { history: HistoricalLog[] }

const TonnageTrendChart: React.FC<Props> = ({ history }) => {
  const [weeks, setWeeks] = useState<8 | 12 | 24>(12);

  const rawData = useMemo(() => getWeeklyTonnage(history, weeks), [history, weeks]);

  // Tag the last entry as current (potentially partial) week
  const data = useMemo(() =>
    rawData.map((d, i) => ({ ...d, isCurrent: i === rawData.length - 1 })),
  [rawData]);

  // Average excludes the current partial week
  const avgTonnage = useMemo(() => {
    const complete = data.filter((d, i) => d.tonnage > 0 && i !== data.length - 1);
    if (!complete.length) return 0;
    return Math.round(complete.reduce((s, d) => s + d.tonnage, 0) / complete.length);
  }, [data]);

  const hasData = data.some(d => d.tonnage > 0);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Weekly Tonnage</h3>
          <InfoButton topic="tonnage" />
        </div>
        <div className="flex gap-1">
          {([8, 12, 24] as const).map(w => (
            <button key={w} onClick={() => setWeeks(w)}
              className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border transition-all
                ${weeks === w ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-slate-700 text-slate-600 hover:text-slate-400'}`}>
              {w}W
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-black uppercase tracking-widest">
          No resistance training data
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}t` : String(v)} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(val: number, name: string, props: { payload?: { isCurrent?: boolean } }) => {
                  const partial = props.payload?.isCurrent ? ' (in progress)' : '';
                  return [
                    name === 'tonnage'
                      ? `${val.toLocaleString()} kg${partial}`
                      : `${val} sessions${partial}`,
                    name === 'tonnage' ? 'Tonnage' : 'Sessions',
                  ];
                }}
              />
              {avgTonnage > 0 && (
                <ReferenceLine y={avgTonnage} stroke="#10b981" strokeOpacity={0.4} strokeDasharray="4 3"
                  label={{ value: 'avg', position: 'right', fontSize: 9, fill: '#10b981', opacity: 0.7 }} />
              )}
              <Bar dataKey="tonnage" radius={[3, 3, 0, 0]} maxBarSize={36}>
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill="#10b981"
                    fillOpacity={entry.isCurrent ? 0.25 : 0.7}
                    stroke={entry.isCurrent ? '#10b981' : 'none'}
                    strokeWidth={entry.isCurrent ? 1.5 : 0}
                    strokeDasharray={entry.isCurrent ? '3 2' : undefined}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">
        Total kg·reps per week · trailing {weeks} weeks · dimmed bar = current week
      </p>
    </div>
  );
};

export default TonnageTrendChart;
