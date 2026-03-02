import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { HistoricalLog } from '../../types';
import { calcACWR } from '../../src/utils';

interface Props { history: HistoricalLog[] }

const ACWRGauge: React.FC<Props> = ({ history }) => {
  const [showInfo, setShowInfo] = useState(false);
  const result = useMemo(() => calcACWR(history), [history]);

  if (!result) {
    return (
      <div className="flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2 shrink-0">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Workload Ratio</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-black uppercase tracking-widest text-center px-4">
          Need at least 7 days of training data
        </div>
      </div>
    );
  }

  const { acwr, acute, chronic } = result;

  // Zone classification
  type Zone = 'low' | 'optimal' | 'high' | 'danger';
  const zone: Zone = acwr < 0.8 ? 'low' : acwr <= 1.3 ? 'optimal' : acwr <= 1.5 ? 'high' : 'danger';
  const zoneConfig: Record<Zone, { label: string; color: string; bg: string; border: string; desc: string }> = {
    low:     { label: 'Under-trained',  color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/30',    desc: 'Your recent load is low relative to your baseline. Consider increasing intensity or frequency.' },
    optimal: { label: 'Optimal',        color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', desc: 'Current workload is well matched to your fitness base. Prime zone for adaptation and low injury risk.' },
    high:    { label: 'High Load',      color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  desc: 'Recent load is significantly above your rolling baseline. Monitor for fatigue and ensure recovery.' },
    danger:  { label: 'Spike Risk',     color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   desc: 'Acute load is far above chronic fitness. Research links sustained ratios above 1.5 with elevated injury risk.' },
  };
  const cfg = zoneConfig[zone];

  // Needle angle: 0.5 → -90°, 1.0 → 0°, 2.0 → +90°, capped
  const clampedACWR = Math.min(Math.max(acwr, 0.4), 1.8);
  const angle = ((clampedACWR - 1.0) / 0.8) * 90; // -90 to +90

  const fmtTonnage = (t: number) => t >= 1000 ? `${(t / 1000).toFixed(1)}t` : `${Math.round(t)}kg`;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Workload Ratio</h3>
          <div className="relative">
            <button onClick={() => setShowInfo(v => !v)} className="text-slate-600 hover:text-slate-400 transition-colors">
              <Info size={13} />
            </button>
            {showInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowInfo(false)} />
                <div className="absolute left-0 top-6 z-50 w-72 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-2">
                  <p className="text-[11px] font-black text-slate-100 uppercase tracking-widest">Acute:Chronic Workload Ratio</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Compares your last 7 days of tonnage (acute load) to your rolling 28-day average (chronic load, your "fitness base"). A ratio near 1.0 means you are training consistently with your baseline.
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { range: '< 0.80', label: 'Under-trained', color: 'text-sky-400' },
                      { range: '0.80 – 1.30', label: 'Optimal zone', color: 'text-emerald-400' },
                      { range: '1.30 – 1.50', label: 'High load', color: 'text-amber-400' },
                      { range: '> 1.50', label: 'Spike risk', color: 'text-rose-400' },
                    ].map(z => (
                      <div key={z.range} className="flex items-center gap-2">
                        <span className={`text-[10px] font-black ${z.color} w-24 shrink-0`}>{z.range}</span>
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{z.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest border-t border-slate-800 pt-2">
                    Note: ACWR is an approximation. Use alongside feel and recovery quality.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Gauge */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="relative w-40 h-20 overflow-hidden">
          {/* Semicircle zones */}
          <svg viewBox="0 0 160 80" className="w-full h-full">
            {/* Zone arcs using stroke-dasharray trick on a circle r=70, circumference≈439 */}
            {/* Full arc is 180° = half of 439 ≈ 220 units */}
            {/* low: 0–40%, optimal: 40–65%, high: 65–78%, danger: 78–100% */}
            {[
              { pct: [0, 0.40], color: '#38bdf8' },   // low
              { pct: [0.40, 0.65], color: '#10b981' }, // optimal
              { pct: [0.65, 0.78], color: '#f59e0b' }, // high
              { pct: [0.78, 1.00], color: '#ef4444' }, // danger
            ].map(({ pct, color }, i) => {
              const circ = Math.PI * 70; // half circumference
              const start = pct[0] * circ;
              const len = (pct[1] - pct[0]) * circ;
              return (
                <circle key={i} cx="80" cy="80" r="70" fill="none" stroke={color} strokeWidth="12"
                  strokeDasharray={`${len} ${circ * 2}`}
                  strokeDashoffset={-start}
                  strokeLinecap="butt"
                  transform="rotate(180, 80, 80)"
                  opacity={0.25}
                />
              );
            })}
            {/* Active zone highlight */}
            {[
              { pct: [0, 0.40], color: '#38bdf8', z: 'low' },
              { pct: [0.40, 0.65], color: '#10b981', z: 'optimal' },
              { pct: [0.65, 0.78], color: '#f59e0b', z: 'high' },
              { pct: [0.78, 1.00], color: '#ef4444', z: 'danger' },
            ].filter(s => s.z === zone).map(({ pct, color }, i) => {
              const circ = Math.PI * 70;
              const start = pct[0] * circ;
              const len = (pct[1] - pct[0]) * circ;
              return (
                <circle key={i} cx="80" cy="80" r="70" fill="none" stroke={color} strokeWidth="14"
                  strokeDasharray={`${len} ${circ * 2}`}
                  strokeDashoffset={-start}
                  strokeLinecap="butt"
                  transform="rotate(180, 80, 80)"
                  opacity={0.9}
                />
              );
            })}
            {/* Needle */}
            <line
              x1="80" y1="80"
              x2={80 + 58 * Math.cos((Math.PI * (180 + angle)) / 180)}
              y2={80 + 58 * Math.sin((Math.PI * (180 + angle)) / 180)}
              stroke="#f1f5f9" strokeWidth="2.5" strokeLinecap="round"
            />
            <circle cx="80" cy="80" r="5" fill="#f1f5f9" />
          </svg>
        </div>

        {/* Score */}
        <div className="text-center">
          <div className={`text-3xl font-black tracking-tight ${cfg.color}`}>{acwr.toFixed(2)}</div>
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">ACWR</div>
        </div>

        {/* Acute vs Chronic */}
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-sm font-black text-slate-100">{fmtTonnage(acute * 7)}</div>
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">7-day</div>
          </div>
          <div className="w-px bg-slate-800 self-stretch" />
          <div className="text-center">
            <div className="text-sm font-black text-slate-100">{fmtTonnage(chronic * 28)}</div>
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">28-day</div>
          </div>
        </div>

        <p className="text-[9px] font-black text-slate-600 text-center leading-relaxed px-2">{cfg.desc}</p>
      </div>
    </div>
  );
};

export default ACWRGauge;
