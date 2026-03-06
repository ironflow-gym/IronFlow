import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { HistoricalLog, BiometricEntry, UserSettings } from '../../types';
import { getRelativeStrength, STRENGTH_STANDARDS } from '../../src/utils';

interface Props {
  history: HistoricalLog[];
  biometricHistory: BiometricEntry[];
  userSettings: UserSettings;
}

// Index -1 = Building (below first threshold), 0–4 = Foundations → Elite
const LEVEL_COLORS = [
  'bg-slate-800 text-slate-500',     // Building (-1, accessed as [0] with offset)
  'bg-slate-700 text-slate-400',     // Foundations
  'bg-sky-500/20 text-sky-400',      // Developing
  'bg-emerald-500/20 text-emerald-400', // Established
  'bg-amber-500/20 text-amber-400',  // Forged
  'bg-rose-500/20 text-rose-400',    // Elite
];
const LEVEL_COLOR = (idx: number) => LEVEL_COLORS[idx + 1] ?? LEVEL_COLORS[0];

const LEVEL_BAR_COLORS_ARR = ['#334155', '#475569', '#38bdf8', '#10b981', '#f59e0b', '#ef4444'];
const LEVEL_BAR_COLOR = (idx: number) => LEVEL_BAR_COLORS_ARR[idx + 1] ?? LEVEL_BAR_COLORS_ARR[0];

const RelativeStrengthPanel: React.FC<Props> = ({ history, biometricHistory, userSettings }) => {
  const [showInfo, setShowInfo] = useState(false);

  const gender = userSettings.gender ?? 'male';
  const weightUnit = userSettings.units === 'metric' ? 'kg' : 'lb';

  const entries = useMemo(() => getRelativeStrength(history, biometricHistory, gender), [history, biometricHistory, gender]);

  const latestBW = useMemo(() => {
    if (!biometricHistory.length) return null;
    const sorted = [...biometricHistory].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const kg = latest.unit === 'lbs' ? latest.weight * 0.453592 : latest.weight;
    return userSettings.units === 'imperial' ? Math.round(kg * 2.20462 * 10) / 10 : Math.round(kg * 10) / 10;
  }, [biometricHistory, userSettings.units]);

  const levelLabels = ['Foundations', 'Developing', 'Established', 'Forged', 'Elite'];
  const allLevelLabels = ['Building', ...levelLabels];

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Relative Strength</h3>
          <div className="relative">
            <button onClick={() => setShowInfo(v => !v)} className="text-slate-600 hover:text-slate-400 transition-colors">
              <Info size={13} />
            </button>
            {showInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowInfo(false)} />
                <div className="absolute left-0 top-6 z-50 w-72 max-h-80 overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-2">
                  <p className="text-[11px] font-black text-slate-100 uppercase tracking-widest">Relative Strength</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Your estimated 1-rep max (e1RM) for key lifts divided by your bodyweight. This lets you compare your strength fairly across different body weights over time.
                  </p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Only lifts performed in the last 90 days are included — one full training block. Lifts you no longer do are excluded rather than carrying stale all-time records.
                  </p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Only biomechanically valid surrogates are accepted per lift. Hack squats, front squats, incline bench, Romanian deadlifts and push press are excluded as they do not share the same strength standard as their primary lift.
                  </p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Levels are based on published strength standards for your gender. Requires bodyweight logged in Biometrics.
                  </p>
                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {levelLabels.map((l, i) => (
                      <div key={l} className={`text-center text-[8px] font-black px-1 py-1 rounded-lg uppercase tracking-widest ${LEVEL_COLORS[i + 1]}`}>{l}</div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {latestBW && (
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            BW: <span className="text-slate-300">{latestBW}{weightUnit}</span>
          </span>
        )}
      </div>

      {!biometricHistory.length ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-black uppercase tracking-widest text-center px-4">
          Log bodyweight in Biometrics to see relative strength
        </div>
      ) : !entries.length ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-black uppercase tracking-widest text-center px-4">
          No bench, squat, deadlift, OHP or row logged in the last 90 days
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {entries.map(entry => {
            const std = Object.values(STRENGTH_STANDARDS).find(s => s.label === entry.label);
            const thresholds = std ? (gender === 'female' ? std.female : std.male) : [0.5, 0.75, 1.0, 1.5, 2.0];
            const maxThreshold = thresholds[thresholds.length - 1];
            const fillPct = Math.min((entry.ratio / maxThreshold) * 100, 100);

            return (
              <div key={entry.lift} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-200">{entry.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                      {entry.daysAgo === 0 ? 'today' : `${entry.daysAgo}d ago`}
                    </span>
                    <span className="text-[10px] font-black text-slate-400">{entry.ratio.toFixed(2)}× BW</span>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest ${LEVEL_COLOR(entry.levelIndex)}`}>
                      {entry.levelLabel}
                    </span>
                  </div>
                </div>
                <div className="relative h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${fillPct}%`, backgroundColor: LEVEL_BAR_COLOR(entry.levelIndex) }}
                  />
                  {/* Threshold tick marks */}
                  {thresholds.slice(0, -1).map((t, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px bg-slate-600"
                      style={{ left: `${(t / maxThreshold) * 100}%` }}
                    />
                  ))}
                </div>
                {/* Zone name labels: centred in each zone so bar end lands in matching label.
                     Building = [0, thresholds[0]), zones 0–4 = [thresholds[i], thresholds[i+1]).
                     Active zone highlighted to match badge. */}
                <div className="relative h-4">
                  {/* Building zone: [0, thresholds[0]) */}
                  <span
                    className={`absolute text-[8px] font-black leading-4 whitespace-nowrap ${entry.levelIndex < 0 ? 'text-slate-400' : 'text-slate-700'}`}
                    style={{ left: `${(thresholds[0] / maxThreshold / 2) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    Building
                  </span>
                  {/* Standard zones: zone i spans [thresholds[i], thresholds[i+1]) */}
                  {thresholds.map((t, i) => {
                    const zoneStart = t;
                    const zoneEnd = i + 1 < thresholds.length
                      ? thresholds[i + 1]
                      : t + (t - (thresholds[i - 1] ?? 0));
                    const centrePct = ((zoneStart + zoneEnd) / 2 / maxThreshold) * 100;
                    const isActive = entry.levelIndex === i;
                    return (
                      <span
                        key={i}
                        className={`absolute text-[8px] font-black leading-4 whitespace-nowrap ${isActive ? 'text-slate-300' : 'text-slate-700'}`}
                        style={{ left: `${Math.min(centrePct, 92)}%`, transform: 'translateX(-50%)' }}
                      >
                        {levelLabels[i]}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest shrink-0">
        e1RM ÷ bodyweight · {gender} standards · 90-day window
      </p>
    </div>
  );
};

export default RelativeStrengthPanel;
