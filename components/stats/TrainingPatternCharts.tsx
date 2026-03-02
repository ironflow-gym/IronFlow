import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts';
import { HistoricalLog } from '../../types';
import { getTrainingDayDistribution, getWeeklySessionDuration } from '../../src/utils';

// ── Training Day Distribution ─────────────────────────────────────────────────
export const TrainingDayChart: React.FC<{ history: HistoricalLog[] }> = ({ history }) => {
  const data = useMemo(() => getTrainingDayDistribution(history), [history]);
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="shrink-0">
        <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Training Days</h3>
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5">Sessions by day of week · all time</p>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(v: number) => [`${v} sessions`, 'Count']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={44}>
              {data.map((entry, i) => (
                <rect key={i} fill={entry.count === max ? '#10b981' : '#334155'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ── Session Duration Trend ────────────────────────────────────────────────────
export const SessionDurationChart: React.FC<{ history: HistoricalLog[] }> = ({ history }) => {
  const data = useMemo(() => getWeeklySessionDuration(history, 12), [history]);
  const hasData = data.some(d => d.avgMins > 0);
  const avg = useMemo(() => {
    const nonZero = data.filter(d => d.avgMins > 0);
    return nonZero.length ? Math.round(nonZero.reduce((s, d) => s + d.avgMins, 0) / nonZero.length) : 0;
  }, [data]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Session Duration</h3>
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5">Avg minutes per session · 12 weeks</p>
        </div>
        {avg > 0 && (
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            avg <span className="text-emerald-400">{avg}m</span>
          </span>
        )}
      </div>
      {!hasData ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-black uppercase tracking-widest text-center px-4">
          Duration data captured from next workout
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v}m`} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number) => [`${v} min`, 'Avg duration']}
              />
              {avg > 0 && (
                <ReferenceLine y={avg} stroke="#10b981" strokeOpacity={0.4} strokeDasharray="4 3"
                  label={{ value: 'avg', position: 'right', fontSize: 9, fill: '#10b981', opacity: 0.7 }} />
              )}
              <Line dataKey="avgMins" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }}
                connectNulls={false} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
