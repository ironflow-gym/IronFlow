import React, { useMemo, useState } from 'react';
import { X, HelpCircle, Monitor, Smartphone, LineChart } from 'lucide-react';

interface HelpCenterProps {
  onClose: () => void;
}

interface HelpItem {
  title: string;
  body: string;
  source: string;
}

const FEATURE_ITEMS: HelpItem[] = [
  { title: 'Plan and start workouts', body: 'Create templates, launch an active session, and log sets with weight, reps, distance, and time.', source: 'App.tsx + components/ActiveWorkout.tsx + components/TemplateEditor.tsx' },
  { title: 'Workout Discovery and AI generation', body: 'Find workouts and generate/edit plans through the Gemini-powered discovery and editor flows.', source: 'components/WorkoutDiscovery.tsx + services/geminiService.ts + components/TemplateEditor.tsx' },
  { title: 'Exercise Library and custom exercises', body: 'Browse defaults, add custom items, and manage deleted exercises through the trash flow.', source: 'components/ExerciseLibrary.tsx + components/TrashCan.tsx + services/storageService.ts' },
  { title: 'History and analytics', body: 'Review performance trends, PR progression, workload management, and session-level history insights.', source: 'components/WorkoutHistory.tsx + components/stats/*.tsx + src/utils.ts' },
  { title: 'Nutrition and body metrics', body: 'Track biometrics and food logs, then compare actual macros against goal-derived targets.', source: 'components/BiometricsLab.tsx + components/FuelDepot.tsx + components/stats/MacroRadarChart.tsx + src/utils.ts' },
  { title: 'Data control and sync', body: 'Import/export CSV, restore backups, and sync cloud mirror state via IronSync.', source: 'components/CSVManager.tsx + components/BackupManager.tsx + services/ironSyncService.ts' },
];

const METRIC_ITEMS: HelpItem[] = [
  { title: 'Estimated 1RM trend (E1RM)', body: 'Uses the Epley formula (weight × (1 + reps/30), reps capped) on non-warmup resistance logs and charts best value per session date.', source: 'components/stats/E1RMChart.tsx + src/utils.ts (calcE1RM)' },
  { title: 'Muscle volume vs thresholds (MEV/MAV/MRV)', body: 'Maps exercise categories to muscle groups, then tracks weekly set counts against volume landmarks (minimum effective, adaptive range, and recoverable maximum).', source: 'components/stats/MuscleVolumeChart.tsx + src/utils.ts (getMuscleGroup, getWeeklySetsPerMuscleGroup, DEFAULT_MEV_MRV)' },
  { title: 'Consistency heatmap', body: 'Builds daily cells over 3m/6m/1y using logged tonnage (weight × reps). Darker/greener cells indicate higher workload days.', source: 'components/stats/ConsistencyHeatmap.tsx' },
  { title: 'Tonnage trend', body: 'Shows trailing weekly tonnage (kg·reps), converting lbs to kg and excluding warmups/cardio for workload comparability.', source: 'components/stats/TonnageTrendChart.tsx + src/utils.ts (getWeeklyTonnage)' },
  { title: 'ACWR gauge', body: 'Acute:Chronic Workload Ratio = mean daily tonnage over last 7 days ÷ mean daily tonnage over last 28 days, with zones: <0.8 low, 0.8–1.3 optimal, 1.3–1.5 high, >1.5 spike risk.', source: 'components/stats/ACWRGauge.tsx + src/utils.ts (calcACWR)' },
  { title: 'Training pattern charts', body: 'Displays day-of-week session distribution and weekly average session duration from historical logs.', source: 'components/stats/TrainingPatternCharts.tsx + src/utils.ts (getTrainingDayDistribution, getWeeklySessionDuration)' },
  { title: 'Relative strength panel', body: 'Matches key lifts to standards and compares estimated 1RM relative to bodyweight, producing level bands from Developing to Elite.', source: 'components/stats/RelativeStrengthPanel.tsx + src/utils.ts (matchStrengthKey, evaluateStrengthLevel)' },
  { title: 'Body composition projection', body: 'Uses rolling bodyweight/body-fat entries to project trend lines for scale weight and estimated lean mass.', source: 'components/stats/BodyCompositionProjection.tsx' },
  { title: 'Macro radar', body: 'Compares 7-day average intake against calculated targets derived from goal/preferences and estimated energy demand.', source: 'components/stats/MacroRadarChart.tsx + src/utils.ts (deriveMacroRatios)' },
];

const DESKTOP_ONLY: HelpItem[] = [
  { title: 'Desktop sidebar navigation', body: 'Hover-expand left rail with quick access actions is shown only at >=1024px breakpoints.', source: 'components/DesktopSidebar.tsx + hooks/useMediaQuery.ts' },
  { title: 'Desktop Stats dashboard shell', body: 'Workout history switches to the sectioned desktop StatsDashboard layout when desktop media query is true.', source: 'components/WorkoutHistory.tsx + components/stats/StatsDashboard.tsx' },
  { title: 'Desktop template editor', body: 'Template editor routes to the multi-panel desktop editor variant at >=1024px.', source: 'components/TemplateEditor.tsx + components/TemplateEditorDesktop.tsx' },
  { title: 'MEV/MAV/MRV settings table', body: 'Training threshold table in Settings is hidden on mobile and available on large screens only.', source: 'components/SettingsModal.tsx' },
];

const HelpCenter: React.FC<HelpCenterProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const filterItems = (items: HelpItem[]) => {
    if (!q) return items;
    return items.filter(item => `${item.title} ${item.body} ${item.source}`.toLowerCase().includes(q));
  };

  const filteredFeatures = useMemo(() => filterItems(FEATURE_ITEMS), [q]);
  const filteredMetrics = useMemo(() => filterItems(METRIC_ITEMS), [q]);
  const filteredDesktop = useMemo(() => filterItems(DESKTOP_ONLY), [q]);

  const Card: React.FC<{ item: HelpItem }> = ({ item }) => (
    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
      <h4 className="text-sm font-black text-slate-100 tracking-tight">{item.title}</h4>
      <p className="text-xs text-slate-300 leading-relaxed">{item.body}</p>
      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Source: {item.source}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-xl p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col">
        <div className="px-6 py-5 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <HelpCircle size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">IronFlow Help Center</span>
            </div>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">Feature + Metrics Reference</h2>
            <p className="text-xs text-slate-400 mt-1">Every item is traceable to implementation files listed under each card.</p>
          </div>
          <button onClick={onClose} className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-800">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search features, metrics, or source files..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
        </div>

        <div className="overflow-y-auto p-6 space-y-8">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Smartphone size={16} className="text-cyan-400" />
              <h3 className="text-xs font-black uppercase tracking-widest">Core App Functions</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-3">{filteredFeatures.map(item => <Card key={item.title} item={item} />)}</div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-300">
              <LineChart size={16} className="text-emerald-400" />
              <h3 className="text-xs font-black uppercase tracking-widest">Graph + Metric Interpretation Guide</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-3">{filteredMetrics.map(item => <Card key={item.title} item={item} />)}</div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Monitor size={16} className="text-amber-400" />
              <h3 className="text-xs font-black uppercase tracking-widest">Desktop-only Functions</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-3">{filteredDesktop.map(item => <Card key={item.title} item={item} />)}</div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
