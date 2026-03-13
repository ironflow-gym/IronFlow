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

  const { acwr, acute, chronic, rpeWeighted } = result;

  type Zone = 'low' | 'optimal' | 'high' | 'danger';
  const zone: Zone = acwr < 0.8 ? 'low' : acwr <= 1.3 ? 'optimal' : acwr <= 1.5 ? 'high' : 'danger';
  const zoneConfig: Record<Zone, { label: string; color: string; bg: string; border: string; desc: string }> = {
    low:     { label: 'Under-trained',  color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/30',    desc: 'Your recent load is low relative to your baseline. Consider increasing intensity or frequency.' },
    optimal: { label: 'Optimal',        color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', desc: 'Current workload is well matched to your fitness base. Prime zone for adaptation and low injury risk.' },
    high:    { label: 'High Load',      color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  desc: 'Recent load is significantly above your rolling baseline. Monitor for fatigue and ensure recovery.' },
    danger:  { label: 'Spike Risk',     color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   desc: 'Acute load is far above chronic fitness. Research links sustained ratios above 1.5 with elevated injury risk.' },
  };
  const cfg = zoneConfig[zone];

  // ── Needle geometry ───────────────────────────────────────────────────────────
  const MIN_ACWR = 0.4;
  const MAX_ACWR = 1.8;
  const clamped  = Math.min(Math.max(acwr, MIN_ACWR), MAX_ACWR);
  const fraction = (clamped - MIN_ACWR) / (MAX_ACWR - MIN_ACWR);
  const needleDeg = 180 - fraction * 180;
  const needleRad = (needleDeg * Math.PI) / 180;
  const NEEDLE_LEN = 56;
  const cx = 80, cy = 82;
  const nx = cx + NEEDLE_LEN * Math.cos(needleRad);
  const ny = cy - NEEDLE_LEN * Math.sin(needleRad);

  // ── Arc segments ──────────────────────────────────────────────────────────────
  const arcR     = 68;
  const halfCirc = Math.PI * arcR;
  const zoneBands: { start: number; end: number; color: string; zone: Zone }[] = [
    { start: 0.4, end: 0.8, color: '#38bdf8', zone: 'low'     },
    { start: 0.8, end: 1.3, color: '#10b981', zone: 'optimal' },
    { start: 1.3, end: 1.5, color: '#f59e0b', zone: 'high'    },
    { start: 1.5, end: 1.8, color: '#ef4444', zone: 'danger'  },
  ];

  const fmtLoad = (v: number) => rpeWeighted ? `${Math.round(v)} AU` : v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)}kg`;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Workload Ratio</h3>
          {rpeWeighted && (
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">RPE</span>
          )}
          <div className="relative">
            <button onClick={() => setShowInfo(v => !v)} className="text-slate-600 hover:text-slate-400 transition-colors">
              <Info size={13} />
            </button>
            {showInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowInfo(false)} />
                <div className="absolute left-0 top-6 z-50 w-72 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-2">
                  <p className="text-[11px] font-black text-slate-100 uppercase tracking-widest">Acute:Chronic Workload Ratio</p>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    {rpeWeighted
                      ? 'Calculated using Foster session load (RPE × duration in minutes), giving a more accurate picture of training stress than volume alone.'
                      : 'Compares your last 7 days of tonnage (acute load) to your rolling 28-day average (chronic load). Rate sessions with RPE after completing them for a more accurate calculation.'}
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { range: '< 0.80',      label: 'Under-trained', color: 'text-sky-400'     },
                      { range: '0.80 – 1.30', label: 'Optimal zone',  color: 'text-emerald-400' },
                      { range: '1.30 – 1.50', label: 'High load',     color: 'text-amber-400'   },
                      { range: '> 1.50',      label: 'Spike risk',    color: 'text-rose-400'    },
                    ].map(z => (
                      <div key={z.range} className="flex items-center gap-2">
                        <span className={`text-[10px] font-black ${z.color} w-24 shrink-0`}>{z.range}</span>
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{z.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest border-t border-slate-800 pt-2">
                    ACWR is directional, not precise. Use alongside feel and recovery quality.
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

      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        {/* Gauge SVG */}
        <div className="w-44 h-24">
          <svg viewBox="0 0 160 90" className="w-full h-full overflow-visible">
            {/* Zone arcs */}
            {zoneBands.map(({ start, end, color, zone: z }) => {
              const sf  = (start - MIN_ACWR) / (MAX_ACWR - MIN_ACWR);
              const ef  = (end   - MIN_ACWR) / (MAX_ACWR - MIN_ACWR);
              const len = (ef - sf) * halfCirc;
              const off = sf * halfCirc;
              const isActive = z === zone;
              return (
                <circle
                  key={z}
                  cx={cx} cy={cy} r={arcR}
                  fill="none"
                  stroke={color}
                  strokeWidth={isActive ? 15 : 10}
                  strokeDasharray={`${len} ${halfCirc * 2}`}
                  strokeDashoffset={-off}
                  strokeLinecap="butt"
                  transform={`rotate(180, ${cx}, ${cy})`}
                  opacity={isActive ? 0.9 : 0.2}
                />
              );
            })}

            {/* Tick marks at zone boundaries */}
            {[0.8, 1.0, 1.3, 1.5].map(val => {
              const f   = (val - MIN_ACWR) / (MAX_ACWR - MIN_ACWR);
              const deg = 180 - f * 180;
              const rad = (deg * Math.PI) / 180;
              return (
                <line
                  key={val}
                  x1={cx + (arcR - 9) * Math.cos(rad)}
                  y1={cy - (arcR - 9) * Math.sin(rad)}
                  x2={cx + (arcR + 5) * Math.cos(rad)}
                  y2={cy - (arcR + 5) * Math.sin(rad)}
                  stroke="#0f172a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Needle */}
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#f1f5f9" strokeWidth="2.5" strokeLinecap="round" />
            {/* Hub */}
            <circle cx={cx} cy={cy} r="5"   fill="#f1f5f9" />
            <circle cx={cx} cy={cy} r="2.5" fill="#0f172a" />
          </svg>
        </div>

        {/* Score */}
        <div className="text-center">
          <div className={`text-3xl font-black tracking-tight ${cfg.color}`}>{acwr.toFixed(2)}</div>
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ACWR</div>
        </div>

        {/* Loads */}
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-sm font-black text-slate-100">{fmtLoad(acute * 7)}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">7-day</div>
          </div>
          <div className="w-px bg-slate-800 self-stretch" />
          <div className="text-center">
            <div className="text-sm font-black text-slate-100">{fmtLoad(chronic * 28)}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">28-day</div>
          </div>
        </div>

        <p className="text-[9px] font-black text-slate-400 text-center leading-relaxed px-2">{cfg.desc}</p>
      </div>
    </div>
  );
};

export default ACWRGauge;
