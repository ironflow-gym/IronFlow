import React, { useMemo, useState } from 'react';
import { Settings, Flame, Trophy, Calendar, BarChart3, Activity, Coffee, ChevronDown, ChevronUp } from 'lucide-react';
import { HistoricalLog, BiometricEntry, FuelLog, FuelProfile, UserSettings, WorkoutTemplate } from '../../types';
import { calcWeeklyStreak, getMonthlyPRs } from '../../src/utils';
import { GeminiService } from '../../services/geminiService';
import E1RMChart from './E1RMChart';
import MuscleVolumeChart from './MuscleVolumeChart';
import ConsistencyHeatmap from './ConsistencyHeatmap';
import TonnageTrendChart from './TonnageTrendChart';
import ACWRGauge from './ACWRGauge';
import { TrainingDayChart, SessionDurationChart } from './TrainingPatternCharts';
import RelativeStrengthPanel from './RelativeStrengthPanel';
import BodyCompositionProjection from './BodyCompositionProjection';
import MacroRadarChart from './MacroRadarChart';
import BiometricsLab from '../BiometricsLab';
import FuelDepot from '../FuelDepot';

type Tab = 'train' | 'biometrics' | 'fuel';

interface Props {
  history: HistoricalLog[];
  biometricHistory: BiometricEntry[];
  onSaveBiometrics: (h: BiometricEntry[]) => void;
  fuelHistory: FuelLog[];
  onSaveFuel: (h: FuelLog[]) => void;
  fuelProfile: FuelProfile;
  onSaveFuelProfile: (p: FuelProfile) => void;
  userSettings: UserSettings;
  aiService: GeminiService;
  onSaveTemplate: (t: WorkoutTemplate) => void;
  trainContent: React.ReactNode;
  initialTab?: Tab;
}

const Widget: React.FC<{ children: React.ReactNode; className?: string; height?: string }> = ({
  children, className = '', height = 'h-72',
}) => (
  <div className={`bg-slate-950 border border-slate-800/60 rounded-2xl p-4 ${height} ${className}`}>
    {children}
  </div>
);

const StatsDashboard: React.FC<Props> = ({
  history,
  biometricHistory, onSaveBiometrics,
  fuelHistory, onSaveFuel,
  fuelProfile, onSaveFuelProfile,
  userSettings, aiService,
  trainContent,
  initialTab = 'train',
}) => {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [widgetPopover, setWidgetPopover] = useState(false);
  const [showAnalytics, setShowAnalytics]     = useState(true);
  const [showLoad, setShowLoad]               = useState(true);
  const [showPatterns, setShowPatterns]       = useState(true);
  const [showPerfHistory, setShowPerfHistory] = useState(true);
  const [showStrength, setShowStrength]       = useState(true);
  const [showBioLab, setShowBioLab]           = useState(true);
  const [showMacroRadar, setShowMacroRadar]   = useState(true);
  const [showFuelDepot, setShowFuelDepot]     = useState(true);

  const visibility = userSettings.desktopWidgetVisibility ?? { e1rmChart: true, muscleGroupVolume: true, consistencyHeatmap: true };
  const weeklyGoal = userSettings.weeklyWorkoutGoal ?? 3;

  const stats = useMemo(() => {
    const streak = calcWeeklyStreak(history, weeklyGoal);
    const prs = getMonthlyPRs(history);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const thisWeekDays = new Set(history.filter(h => new Date(h.date) >= weekStart).map(h => h.date)).size;
    return { streak, prs, thisWeekDays };
  }, [history, weeklyGoal]);

  const SummaryCard: React.FC<{ icon: React.ReactNode; value: string | number; label: string; sub?: string; color: string }> = ({ icon, value, label, sub, color }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center gap-4">
      <div className={`p-3 rounded-2xl shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-black text-slate-100 tracking-tight leading-none">{value}</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{label}</div>
        {sub && <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5">{sub}</div>}
      </div>
    </div>
  );

  const TabButton: React.FC<{ id: Tab; label: string; icon: React.ReactNode; activeColor: string }> = ({ id, label, icon, activeColor }) => (
    <button onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === id ? `${activeColor} shadow-lg` : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
      {icon}{label}
    </button>
  );

  const Section: React.FC<{ title: string; show: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, show, onToggle, children }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-all">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
        {show ? <ChevronUp size={15} className="text-slate-600" /> : <ChevronDown size={15} className="text-slate-600" />}
      </button>
      {show && <div className="border-t border-slate-800 p-4">{children}</div>}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 w-full pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tighter uppercase">Performance Hub</h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Training · Biometrics · Nutrition</p>
        </div>
        <div className="relative">
          <button onClick={() => setWidgetPopover(v => !v)} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 border border-slate-700 transition-all">
            <Settings size={18} />
          </button>
          {widgetPopover && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setWidgetPopover(false)} />
              <div className="absolute right-0 top-12 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-4 w-60 shadow-2xl space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analytics Widgets</p>
                {([
                  { key: 'e1rmChart' as const, label: 'e1RM Trend' },
                  { key: 'muscleGroupVolume' as const, label: 'Muscle Volume (MEV/MRV)' },
                  { key: 'consistencyHeatmap' as const, label: 'Consistency Heatmap' },
                ]).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${visibility[key] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 group-hover:border-slate-400'}`}>
                      {visibility[key] && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-none stroke-slate-950" strokeWidth="1.5" strokeLinecap="round"><path d="M1 4l3 3 5-6" /></svg>}
                    </div>
                    <span className="text-xs font-bold text-slate-300">{label}</span>
                  </label>
                ))}
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest border-t border-slate-800 pt-2">Persist visibility in Settings</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard icon={<Flame size={20} className="text-orange-400" />} value={stats.streak} label="Week Streak" sub={`Goal ${weeklyGoal}x/wk`} color="bg-orange-500/10 border border-orange-500/20" />
        <SummaryCard icon={<Trophy size={20} className="text-amber-400" />} value={stats.prs} label="PRs This Month" sub="vs last month" color="bg-amber-500/10 border border-amber-500/20" />
        <SummaryCard icon={<Calendar size={20} className="text-emerald-400" />} value={`${stats.thisWeekDays} / ${weeklyGoal}`} label="This Week" sub="sessions logged" color="bg-emerald-500/10 border border-emerald-500/20" />
      </div>

      {/* Tab rail */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        <TabButton id="train"      label="Train"      icon={<BarChart3 size={14} />} activeColor="bg-emerald-500 text-slate-950" />
        <TabButton id="biometrics" label="Biometrics" icon={<Activity size={14} />}  activeColor="bg-cyan-500 text-slate-950" />
        <TabButton id="fuel"       label="Fuel"       icon={<Coffee size={14} />}    activeColor="bg-orange-500 text-slate-950" />
      </div>

      {/* TRAIN TAB */}
      {activeTab === 'train' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-300">

          <Section title="Performance Analytics" show={showAnalytics} onToggle={() => setShowAnalytics(v => !v)}>
            <div className="grid grid-cols-2 gap-4">
              {visibility.e1rmChart && <Widget><E1RMChart history={history} userSettings={userSettings} /></Widget>}
              {visibility.muscleGroupVolume && <Widget><MuscleVolumeChart history={history} userSettings={userSettings} /></Widget>}
              {visibility.consistencyHeatmap && (
                <Widget height="h-56" className={visibility.e1rmChart && visibility.muscleGroupVolume ? 'col-span-2' : ''}>
                  <ConsistencyHeatmap history={history} />
                </Widget>
              )}
            </div>
          </Section>

          <Section title="Volume and Load Management" show={showLoad} onToggle={() => setShowLoad(v => !v)}>
            <div className="grid grid-cols-2 gap-4">
              <Widget><TonnageTrendChart history={history} /></Widget>
              <Widget><ACWRGauge history={history} /></Widget>
            </div>
          </Section>

          <Section title="Training Patterns" show={showPatterns} onToggle={() => setShowPatterns(v => !v)}>
            <div className="grid grid-cols-2 gap-4">
              <Widget><TrainingDayChart history={history} /></Widget>
              <Widget><SessionDurationChart history={history} /></Widget>
            </div>
          </Section>

          <Section title="Performance and Session History" show={showPerfHistory} onToggle={() => setShowPerfHistory(v => !v)}>
            {trainContent}
          </Section>

        </div>
      )}

      {/* BIOMETRICS TAB */}
      {activeTab === 'biometrics' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-300">

          <Section title="Relative Strength and Composition Trajectory" show={showStrength} onToggle={() => setShowStrength(v => !v)}>
            <div className="grid grid-cols-2 gap-4">
              <Widget height="h-auto min-h-64">
                <RelativeStrengthPanel history={history} biometricHistory={biometricHistory} userSettings={userSettings} />
              </Widget>
              <Widget height="h-72">
                <BodyCompositionProjection biometricHistory={biometricHistory} userSettings={userSettings} />
              </Widget>
            </div>
          </Section>

          <Section title="Biometrics Lab" show={showBioLab} onToggle={() => setShowBioLab(v => !v)}>
            <BiometricsLab
              history={biometricHistory}
              onSave={onSaveBiometrics}
              onClose={() => {}}
              userSettings={userSettings}
              inline={true}
              workoutHistory={history}
              fuelHistory={fuelHistory}
              fuelProfile={fuelProfile}
            />
          </Section>

        </div>
      )}

      {/* FUEL TAB */}
      {activeTab === 'fuel' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-300">

          <Section title="Macro Balance" show={showMacroRadar} onToggle={() => setShowMacroRadar(v => !v)}>
            <Widget height="h-80">
              <MacroRadarChart
                fuelHistory={fuelHistory}
                fuelProfile={fuelProfile}
                biometricHistory={biometricHistory}
                userSettings={userSettings}
              />
            </Widget>
          </Section>

          <Section title="Fuel Depot" show={showFuelDepot} onToggle={() => setShowFuelDepot(v => !v)}>
            <FuelDepot
              history={fuelHistory}
              profile={fuelProfile}
              onSaveFuel={onSaveFuel}
              onSaveProfile={onSaveFuelProfile}
              biometricHistory={biometricHistory}
              aiService={aiService}
              userSettings={userSettings}
            />
          </Section>

        </div>
      )}

    </div>
  );
};

export default StatsDashboard;
