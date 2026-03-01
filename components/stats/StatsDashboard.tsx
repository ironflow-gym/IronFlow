import React, { useMemo, useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Flame, Trophy, Calendar, Target } from 'lucide-react';
import { HistoricalLog, BiometricEntry, FuelLog, FuelProfile, UserSettings } from '../../types';
import { calcWeeklyStreak, getMonthlyPRs } from '../../src/utils';
import E1RMChart from './E1RMChart';
import MuscleVolumeChart from './MuscleVolumeChart';
import ConsistencyHeatmap from './ConsistencyHeatmap';

interface Props {
  history: HistoricalLog[];
  biometricHistory: BiometricEntry[];
  fuelHistory: FuelLog[];
  fuelProfile: FuelProfile;
  userSettings: UserSettings;
  // Pass-through props for the collapsible workout log
  children: React.ReactNode;
}

const StatsDashboard: React.FC<Props> = ({
  history, userSettings, children,
}) => {
  const [widgetPopover, setWidgetPopover] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);

  const visibility = userSettings.desktopWidgetVisibility ?? { e1rmChart: true, muscleGroupVolume: true, consistencyHeatmap: true };
  const weeklyGoal = userSettings.weeklyWorkoutGoal ?? 3;

  const stats = useMemo(() => {
    const streak = calcWeeklyStreak(history, weeklyGoal);
    const prs = getMonthlyPRs(history);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const thisWeekDays = new Set(
      history.filter(h => new Date(h.date) >= weekStart).map(h => h.date)
    ).size;

    return { streak, prs, thisWeekDays };
  }, [history, weeklyGoal]);

  const SummaryCard: React.FC<{ icon: React.ReactNode; value: string | number; label: string; sub?: string; color: string }> =
    ({ icon, value, label, sub, color }) => (
      <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center gap-4`}>
        <div className={`p-3 rounded-2xl ${color}`}>{icon}</div>
        <div>
          <div className="text-2xl font-black text-slate-100 tracking-tight">{value}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
          {sub && <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5">{sub}</div>}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-6 w-full pb-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tighter uppercase">Performance Dashboard</h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Training Analytics</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setWidgetPopover(v => !v)}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 border border-slate-700 transition-all"
            title="Widget visibility"
          >
            <Settings size={18} />
          </button>
          {widgetPopover && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setWidgetPopover(false)} />
              <div className="absolute right-0 top-12 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-4 w-56 shadow-2xl space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visible Widgets</p>
                {([
                  { key: 'e1rmChart', label: 'e1RM Trend Chart' },
                  { key: 'muscleGroupVolume', label: 'Muscle Volume' },
                  { key: 'consistencyHeatmap', label: 'Consistency Heatmap' },
                ] as { key: keyof typeof visibility; label: string }[]).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                      ${visibility[key] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 group-hover:border-slate-400'}`}>
                      {visibility[key] && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-slate-950"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                    </div>
                    <span className="text-xs font-bold text-slate-300">{label}</span>
                  </label>
                ))}
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Save in Settings to persist</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={<Flame size={20} className="text-orange-400" />}
          value={stats.streak}
          label="Week Streak"
          sub={`Goal: ${weeklyGoal}x/week`}
          color="bg-orange-500/10 border border-orange-500/20"
        />
        <SummaryCard
          icon={<Trophy size={20} className="text-amber-400" />}
          value={stats.prs}
          label="PRs This Month"
          sub="vs last month"
          color="bg-amber-500/10 border border-amber-500/20"
        />
        <SummaryCard
          icon={<Calendar size={20} className="text-emerald-400" />}
          value={`${stats.thisWeekDays} / ${weeklyGoal}`}
          label="This Week"
          sub="sessions logged"
          color="bg-emerald-500/10 border border-emerald-500/20"
        />
      </div>

      {/* Widgets grid */}
      <div className="grid grid-cols-2 gap-4">
        {visibility.e1rmChart && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-72">
            <E1RMChart history={history} userSettings={userSettings} />
          </div>
        )}
        {visibility.muscleGroupVolume && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-72">
            <MuscleVolumeChart history={history} userSettings={userSettings} />
          </div>
        )}
        {visibility.consistencyHeatmap && (
          <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-6 ${
            visibility.e1rmChart && visibility.muscleGroupVolume ? 'col-span-2' : ''
          }`}>
            <ConsistencyHeatmap history={history} />
          </div>
        )}
      </div>

      {/* Collapsible workout log */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <button
          onClick={() => setLogExpanded(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <Target size={18} className="text-emerald-400" />
            <span className="text-sm font-black text-slate-100 uppercase tracking-widest">Workout Log</span>
          </div>
          {logExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        {logExpanded && (
          <div className="border-t border-slate-800">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsDashboard;
