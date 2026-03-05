import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
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
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Sessions by day of week · all time</p>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #475569',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
              }}
              labelStyle={{ color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10 }}
              itemStyle={{ color: '#f1f5f9' }}
              formatter={(v: number) => [`${v} sessions`, '']}
              separator=""
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={44}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.count === max ? '#10b981' : '#64748b'}
                  fillOpacity={1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ── Session Duration Trend ────────────────────────────────────────────────────
// Last data point is the current (partial) week — rendered with a dashed,
// translucent dot so it reads as "in progress" rather than a completed data point.

interface DurationPoint {
  week: string;
  avgMins: number;
  isCurrent: boolean;
}

// Custom dot: solid for completed weeks, open/dashed for current week
const DurationDot = (props: {
  cx?: number; cy?: number; payload?: DurationPoint;
}) => {
  const { cx = 0, cy = 0, payload } = props;
  if (!payload || payload.avgMins === 0) return null;
  if (payload.isCurrent) {
    return (
      <circle
        cx={cx} cy={cy} r={4.5}
        fill="none"
        stroke="#a78bfa"
        strokeWidth={1.5}
        strokeDasharray="3 2"
        opacity={0.55}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill="#a78bfa" strokeWidth={0} />;
};

export const SessionDurationChart: React.FC<{ history: HistoricalLog[] }> = ({ history }) => {
  const raw = useMemo(() => getWeeklySessionDuration(history, 12), [history]);

  const data: DurationPoint[] = useMemo(() =>
    raw.map((d, i) => ({ ...d, isCurrent: i === raw.length - 1 })),
  [raw]);

  const hasData = data.some(d => d.avgMins > 0);

  // Average across completed weeks only (exclude current partial week)
  const avg = useMemo(() => {
    const complete = data.filter((d, i) => d.avgMins > 0 && i < data.length - 1);
    return complete.length
      ? Math.round(complete.reduce((s, d) => s + d.avgMins, 0) / complete.length)
      : 0;
  }, [data]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Session Duration</h3>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Avg minutes per session · 12 weeks</p>
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
        <>
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
                  formatter={(v: number, _: string, props: { payload?: DurationPoint }) => {
                    const suffix = props.payload?.isCurrent ? ' (in progress)' : '';
                    return [`${v} min${suffix}`, 'Avg duration'];
                  }}
                />
                {avg > 0 && (
                  <ReferenceLine y={avg} stroke="#10b981" strokeOpacity={0.4} strokeDasharray="4 3"
                    label={{ value: 'avg', position: 'right', fontSize: 9, fill: '#10b981', opacity: 0.7 }} />
                )}
                <Line
                  dataKey="avgMins"
                  stroke="#a78bfa"
                  strokeWidth={2.5}
                  // The line segment into the current-week point is dimmed via a
                  // custom stroke on the point itself — Recharts doesn't support
                  // per-segment stroke, so we accept the full-opacity line and
                  // rely on the open dot to signal "provisional".
                  dot={<DurationDot />}
                  activeDot={{ r: 5, fill: '#a78bfa' }}
                  connectNulls={false}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">
            Open dot = current week in progress · avg excludes current week
          </p>
        </>
      )}
    </div>
  );
};
