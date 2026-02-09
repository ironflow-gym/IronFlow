
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { LineChart, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend } from 'recharts';
import { Trophy, TrendingUp, Calendar, ArrowLeft, ChevronLeft, ChevronRight, X, Bookmark, Activity, Target, Timer as TimeIcon, Clock, ListFilter, Flame, Zap, Weight, Droplets, Ruler, Wand2, Sparkles, Check, Loader2, Save, BarChart3, Info, RefreshCw, Maximize2, Minimize2, Bot, ChevronDown, ChevronUp, Heart, Shield, Anchor, ArrowDown, ArrowUp, Layers, Camera, ArrowRight, Gauge, ClipboardList, ListOrdered, Timer, Link, Edit2, Coffee, RotateCcw } from 'lucide-react';
import { HistoricalLog, WorkoutTemplate, UserSettings, BiometricEntry, MorphologyScan, FuelLog, FuelProfile } from '../types';
import { GeminiService } from '../services/geminiService';
import MorphologyLab from './MorphologyLab';
import BiometricsLab from './BiometricsLab';
import HistoryEditor from './HistoryEditor';
import FuelDepot from './FuelDepot';

interface WorkoutHistoryProps {
  history: HistoricalLog[];
  biometricHistory: BiometricEntry[];
  onSaveBiometrics: (history: BiometricEntry[]) => void;
  fuelHistory: FuelLog[];
  onSaveFuel: (history: FuelLog[]) => void;
  fuelProfile: FuelProfile;
  onSaveFuelProfile: (profile: FuelProfile) => void;
  aiService: GeminiService;
  onSaveTemplate: (template: WorkoutTemplate) => void;
  userSettings: UserSettings;
  lastSessionDate?: string | null;
  onClearLastSession?: () => void;
  initialView?: 'performance' | 'fuel' | 'biometrics';
  onViewChange?: (view: 'performance' | 'fuel' | 'biometrics') => void;
  onResetInitialView?: () => void;
  onUpdateHistory: (date: string, newLogs: HistoricalLog[]) => void;
}

const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({ 
  history, 
  biometricHistory, 
  onSaveBiometrics, 
  fuelHistory,
  onSaveFuel,
  fuelProfile,
  onSaveFuelProfile,
  aiService, 
  onSaveTemplate, 
  userSettings, 
  lastSessionDate, 
  onClearLastSession,
  initialView = 'performance',
  onViewChange,
  onResetInitialView,
  onUpdateHistory
}) => {
  const [activeView, setActiveView] = useState<'performance' | 'fuel' | 'biometrics'>(initialView);
  
  const handleViewChange = (view: 'performance' | 'fuel' | 'biometrics') => {
    setActiveView(view);
    if (onViewChange) onViewChange(view);
  };

  useEffect(() => {
    if (initialView !== activeView) {
      setActiveView(initialView);
      if (onResetInitialView) onResetInitialView();
    }
  }, [initialView, onResetInitialView]);

  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [drillDownDate, setDrillDownDate] = useState<string | null>(null);
  const [drillDownSort, setDrillDownSort] = useState<'protocol' | 'timeline'>('protocol');
  const [showWarmups, setShowWarmups] = useState(false);
  const [chartRange, setChartRange] = useState<'1M' | '3M' | '6M' | 'ALL'>('3M');
  const [visibleMetrics, setVisibleMetrics] = useState({ volume: true, intensity: true, relative: false });
  const [isArchitectReviewOpen, setIsArchitectReviewOpen] = useState(false);
  const [progressReview, setProgressReview] = useState<string | null>(null);
  const [isFetchingReview, setIsFetchingReview] = useState(false);
  const [isHistoryEditorOpen, setIsHistoryEditorOpen] = useState(false);
  const [isPerformanceZoomed, setIsPerformanceZoomed] = useState(false);
  
  // AI Session Summary state
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);

  const [morphologyHistory, setMorphologyHistory] = useState<MorphologyScan[]>([]);
  const [isOfMorphologyOpen, setIsMorphologyOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => setIsPerformanceZoomed(false);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const togglePerformanceZoom = () => {
    if (!isPerformanceZoomed) {
      window.history.pushState({ zoomed: true }, '');
      setIsPerformanceZoomed(true);
    } else {
      window.history.back();
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('ironflow_morphology');
    if (stored) {
      try { setMorphologyHistory(JSON.parse(stored)); } catch (e) {}
    }
  }, []);

  const saveMorphology = (scan: MorphologyScan) => {
    const newHistory = [scan, ...morphologyHistory];
    setMorphologyHistory(newHistory);
    localStorage.setItem('ironflow_morphology', JSON.stringify(newHistory));
  };

  const drillDownRef = useRef<HTMLDivElement>(null);

  const historyByDate = useMemo<Record<string, HistoricalLog[]>>(() => {
    const grouped: Record<string, HistoricalLog[]> = {};
    history.forEach(log => {
      if (!grouped[log.date]) grouped[log.date] = [];
      grouped[log.date].push(log);
    });
    return grouped;
  }, [history]);

  // AI Session Summary Effect
  useEffect(() => {
    if (drillDownDate && historyByDate[drillDownDate]) {
      setSessionSummary(null);
      const fetchSummary = async () => {
        setIsFetchingSummary(true);
        try {
          const summary = await aiService.getWorkoutMotivation(historyByDate[drillDownDate], history);
          setSessionSummary(summary);
        } catch (e) {
          console.error("Failed to fetch session summary", e);
        } finally {
          setIsFetchingSummary(false);
        }
      };
      fetchSummary();
    }
  }, [drillDownDate, historyByDate, history, aiService]);

  const getWeightAtDate = (dateStr: string) => {
    const targetTime = new Date(dateStr).getTime();
    const sortedBios = [...biometricHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let closest = sortedBios[0];
    for (const b of sortedBios) {
      if (new Date(b.date).getTime() <= targetTime) closest = b;
      else break;
    }
    return closest?.weight || null;
  };

  const calculateE1RM = (weight: number, reps: number) => {
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
  };

  const rollingAverages = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentHistory = history.filter(h => new Date(h.date) >= thirtyDaysAgo);
    
    const dailyTotals: Record<string, { volume: number, kj: number }> = {};
    recentHistory.forEach(h => {
        if (!dailyTotals[h.date]) dailyTotals[h.date] = { volume: 0, kj: 0 };
        const w = h.unit === 'lbs' ? h.weight * 0.453592 : h.weight;
        if (!h.isWarmup) {
            dailyTotals[h.date].volume += w * h.reps;
            const c = h.category.toLowerCase();
            let d = 0.4;
            if (c.includes('leg')) d = 0.6;
            else if (c.includes('chest')) d = 0.4;
            else if (c.includes('back')) d = 0.45;
            else if (c.includes('shoulder')) d = 0.5;
            else if (c.includes('arm')) d = 0.3;
            else if (c.includes('abs') || c.includes('core')) d = 0.2;
            dailyTotals[h.date].kj += (w * 9.81 * d * h.reps * 4) / 1000;
        }
    });

    const days = Object.keys(dailyTotals).length;
    if (days === 0) return { volume: 0, kj: 0 };

    const sumVol = Object.values(dailyTotals).reduce((a, b) => a + b.volume, 0);
    const sumKj = Object.values(dailyTotals).reduce((a, b) => a + b.kj, 0);

    return {
        volume: sumVol / days,
        kj: sumKj / days
    };
  }, [history]);

  const sessionStats = useMemo(() => {
    if (!drillDownDate || !historyByDate[drillDownDate]) return null;
    const sessionLogs = historyByDate[drillDownDate];
    
    let totalVolume = 0;
    let peakE1RM = 0;
    let totalKJ = 0;
    let prCount = 0;

    const getDisplacement = (cat: string) => {
      const c = cat.toLowerCase();
      if (c.includes('leg')) return 0.6;
      if (c.includes('chest')) return 0.4;
      if (c.includes('back')) return 0.45;
      if (c.includes('shoulder')) return 0.5;
      if (c.includes('arm')) return 0.3;
      if (c.includes('abs') || c.includes('core')) return 0.2;
      return 0.4;
    };

    sessionLogs.forEach(log => {
      if (log.isWarmup) return;
      
      const weightKg = log.unit === 'lbs' ? log.weight * 0.453592 : log.weight;
      const vol = weightKg * log.reps;
      totalVolume += vol;
      
      const e1rm = calculateE1RM(weightKg, log.reps);
      if (e1rm > peakE1RM) peakE1RM = e1rm;

      const displacement = getDisplacement(log.category);
      const kj = (weightKg * 9.81 * displacement * log.reps * 4) / 1000;
      totalKJ += kj;

      const historyBefore = history.filter(h => 
        h.exercise === log.exercise && 
        new Date(h.date).getTime() < new Date(log.date).getTime() &&
        !h.isWarmup
      );
      const prevMaxE1RM = historyBefore.reduce((max, h) => {
          const hw = h.unit === 'lbs' ? h.weight * 0.453592 : h.weight;
          const he = calculateE1RM(hw, h.reps);
          return he > max ? he : max;
      }, 0);

      if (e1rm > prevMaxE1RM && prevMaxE1RM > 0) {
        prCount++;
      }
    });

    const isImperial = userSettings.units === 'imperial';
    return {
      volume: Math.round(isImperial ? totalVolume * 2.20462 : totalVolume),
      peakE1RM: Math.round(isImperial ? peakE1RM * 2.20462 : peakE1RM),
      kj: Math.round(totalKJ),
      prs: prCount
    };
  }, [drillDownDate, historyByDate, history, userSettings.units]);

  useEffect(() => {
    if (lastSessionDate && historyByDate[lastSessionDate]) {
      setDrillDownDate(lastSessionDate);
      handleViewChange('performance');
      if (onClearLastSession) onClearLastSession();
    }
  }, [lastSessionDate, historyByDate, onClearLastSession]);

  const uniqueExercisesInPeriod = useMemo<string[]>(() => {
    let source: HistoricalLog[] = history;
    if (drillDownDate && historyByDate[drillDownDate]) {
      source = historyByDate[drillDownDate] as HistoricalLog[];
    }
    return Array.from(new Set(source.map((h: HistoricalLog) => h.exercise))).sort();
  }, [history, drillDownDate, historyByDate]);

  useEffect(() => {
    if (uniqueExercisesInPeriod.length > 0 && !uniqueExercisesInPeriod.includes(selectedExercise)) {
      setSelectedExercise(uniqueExercisesInPeriod[0]);
    }
  }, [uniqueExercisesInPeriod, selectedExercise]);

  const performanceData = useMemo<any[]>(() => {
    if (!selectedExercise) return [];
    const exerciseHistory = history.filter(h => h.exercise === selectedExercise);
    const now = new Date();
    const rangeMsMap = { '1M': 30, '3M': 90, '6M': 180, 'ALL': 9999 };
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - rangeMsMap[chartRange]);
    const sessionAggregates: Record<string, { volume: number, e1rm: number, relative: number }> = {};
    let runningMaxE1RM = 0;

    exerciseHistory.forEach(h => {
      const hDate = new Date(h.date);
      if (hDate < cutoffDate) return;
      if (!sessionAggregates[h.date]) sessionAggregates[h.date] = { volume: 0, e1rm: 0, relative: 0 };
      if (showWarmups || !h.isWarmup) sessionAggregates[h.date].volume += h.weight * h.reps;
      if (!h.isWarmup) {
        const currentSetE1RM = calculateE1RM(h.weight, h.reps);
        if (currentSetE1RM > sessionAggregates[h.date].e1rm) {
          sessionAggregates[h.date].e1rm = currentSetE1RM;
          const bodyWeight = getWeightAtDate(h.date);
          if (bodyWeight) sessionAggregates[h.date].relative = parseFloat((currentSetE1RM / bodyWeight).toFixed(2));
        }
      }
    });

    return Object.entries(sessionAggregates)
      .map(([date, data]) => {
        let isPB = false;
        if (data.e1rm > runningMaxE1RM) { isPB = true; runningMaxE1RM = data.e1rm; }
        return { date, volume: Math.round(data.volume), intensity: parseFloat(data.e1rm.toFixed(1)), relative: data.relative, isPB };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history, selectedExercise, showWarmups, chartRange, biometricHistory]);

  const handleFetchReview = async () => {
    setIsFetchingReview(true);
    setIsArchitectReviewOpen(true);
    try {
      const review = await aiService.getProgressReview(history, biometricHistory);
      setProgressReview(review);
    } catch (e) { console.error(e); } finally { setIsFetchingReview(false); }
  };

  const handleSaveAsProtocol = () => {
    if (!drillDownDate || !historyByDate[drillDownDate]) return;
    const sessionLogs = historyByDate[drillDownDate];
    
    // Group logs by exercise to create template exercises
    const exerciseMap = new Map<string, { name: string, category: string, sets: number, weight: number, reps: number }>();
    
    sessionLogs.forEach(log => {
      if (log.isWarmup) return;
      const existing = exerciseMap.get(log.exercise);
      if (!existing || log.weight > existing.weight) {
        exerciseMap.set(log.exercise, {
          name: log.exercise,
          category: log.category,
          sets: sessionLogs.filter(l => l.exercise === log.exercise && !l.isWarmup).length,
          weight: log.weight,
          reps: log.reps
        });
      }
    });

    const template: WorkoutTemplate = {
      id: Date.now().toString(),
      name: `Protocol: ${drillDownDate}`,
      exercises: Array.from(exerciseMap.values()).map(ex => ({
        name: ex.name,
        category: ex.category,
        suggestedSets: ex.sets,
        targetReps: `${ex.reps}`,
        suggestedWeight: ex.weight,
        suggestedReps: ex.reps,
        rationale: `Cloned from session on ${drillDownDate}`
      }))
    };

    onSaveTemplate(template);
    alert("Protocol archived successfully!");
  };

  const changeMonth = (offset: number) => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  
  const calendarDays = useMemo<(null | { day: number; dateStr: string })[]>(() => {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const days: (null | { day: number; dateStr: string })[] = [];
    const total = new Date(y, m + 1, 0).getDate(), start = new Date(y, m, 1).getDay();
    for (let i = 0; i < start; i++) days.push(null);
    for (let i = 1; i <= total; i++) days.push({ day: i, dateStr: `${y}-${(m + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}` });
    return days;
  }, [viewDate]);

  const weightUnit = userSettings.units === 'metric' ? 'kg' : 'lb';

  const formatGapTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Sort and process drill down logs based on preference
  const processedDrillDownData = useMemo(() => {
    if (!drillDownDate || !historyByDate[drillDownDate]) return null;
    const logs = [...historyByDate[drillDownDate]].sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
    
    if (drillDownSort === 'timeline') {
      const blocks: any[] = [];
      if (logs.length === 0) return { type: 'timeline' as const, blocks: [] };

      let currentBlock: any = {
        type: 'standard',
        exerciseName: logs[0].exercise,
        category: logs[0].category,
        logs: [logs[0]]
      };

      for (let i = 1; i < logs.length; i++) {
        const prev = logs[i - 1];
        const current = logs[i];
        const gap = ((current.completedAt || 0) - (prev.completedAt || 0)) / 1000;

        // Threshold for a "Session Break" / Intermission
        if (gap > 600) { // 10 minutes
          blocks.push({ ...currentBlock, transitionAfter: gap });
          blocks.push({ type: 'intermission', gap });
          currentBlock = { type: 'standard', exerciseName: current.exercise, category: current.category, logs: [current] };
          continue;
        }

        if (current.exercise === prev.exercise) {
          // Standard rest window
          if (gap < 240) { // 4 minutes
            currentBlock.logs.push(current);
          } else {
            blocks.push({ ...currentBlock, transitionAfter: gap });
            currentBlock = { type: 'standard', exerciseName: current.exercise, category: current.category, logs: [current] };
          }
        } else {
          // Detect Superset / Circuit (Short transition window)
          if (gap < 90) { // 90 seconds
            currentBlock.type = 'complex';
            currentBlock.exerciseName = undefined; // Names displayed inline for complex
            currentBlock.logs.push(current);
          } else {
            blocks.push({ ...currentBlock, transitionAfter: gap });
            currentBlock = { type: 'standard', exerciseName: current.exercise, category: current.category, logs: [current] };
          }
        }
      }
      blocks.push(currentBlock);
      return { type: 'timeline' as const, blocks };
    } else {
      // Group by exercise while maintaining sequence of first appearance
      const orderedExercises: string[] = [];
      logs.forEach(l => {
        if (!orderedExercises.includes(l.exercise)) orderedExercises.push(l.exercise);
      });
      const groups = orderedExercises.map(exName => ({
        name: exName,
        logs: logs.filter(l => l.exercise === exName)
      }));
      return { type: 'protocol' as const, groups };
    }
  }, [drillDownDate, historyByDate, drillDownSort]);

  const renderPerformanceChartContent = (isZoomed: boolean = false) => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={performanceData}>
        <defs>
          <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
          <linearGradient id="colorIntensity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2}/><stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="date" stroke="#475569" fontSize={isZoomed ? 12 : 10} tickFormatter={(v) => v.split('-').slice(1).join('/')} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" stroke="#10b981" fontSize={isZoomed ? 10 : 8} axisLine={false} tickLine={false} />
        <YAxis yAxisId="right" stroke="#22d3ee" fontSize={isZoomed ? 10 : 8} axisLine={false} tickLine={false} orientation="right" />
        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', fontSize: isZoomed ? '12px' : '10px' }} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
        <Legend wrapperStyle={{ fontSize: isZoomed ? '12px' : '10px', paddingTop: '10px' }} />
        {visibleMetrics.volume && <Area yAxisId="left" name="Total Volume" type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={isZoomed ? 3 : 2} fillOpacity={1} fill="url(#colorVolume)" />}
        {visibleMetrics.intensity && <Line yAxisId="right" name="E1RM Intensity" type="monotone" dataKey="intensity" stroke="#22d3ee" strokeWidth={isZoomed ? 4 : 3} dot={{ fill: '#22d3ee', r: isZoomed ? 5 : 3 }} />}
        {visibleMetrics.relative && <Line yAxisId="right" name="Relative Strength" type="monotone" dataKey="relative" stroke="#6366f1" strokeWidth={isZoomed ? 3 : 2} dot={{ fill: '#6366f1', r: isZoomed ? 4 : 2 }} />}
        {performanceData.map((entry, idx) => entry.isPB && <ReferenceDot key={idx} yAxisId="right" x={entry.date} y={entry.intensity} r={isZoomed ? 8 : 6} fill="#fbbf24" stroke="#0f172a" />)}
      </ComposedChart>
    </ResponsiveContainer>
  );

  return (
    <div className="space-y-6">
      <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-4">
        <button onClick={() => handleViewChange('performance')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'performance' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><BarChart3 size={14} /> Train</button>
        <button onClick={() => handleViewChange('fuel')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'fuel' ? 'bg-[#fb923c] text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Coffee size={14} /> Fuel</button>
        <button onClick={() => handleViewChange('biometrics')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'biometrics' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Activity size={14} /> Bios</button>
      </div>

      {activeView === 'performance' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-xl">
             <button onClick={progressReview ? () => setIsArchitectReviewOpen(!isArchitectReviewOpen) : handleFetchReview} className="w-full px-6 py-4 flex items-center justify-between group hover:bg-slate-800/50 transition-all">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-emerald-500/10 rounded-xl"><Bot size={18} className="text-emerald-400" /></div>
                   <div className="text-left">
                      <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest">Architect's Evolution Review</h4>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Kinematic Trend Analysis</p>
                   </div>
                </div>
                {isFetchingReview ? <Loader2 className="animate-spin text-emerald-400" size={16} /> : isArchitectReviewOpen ? <ChevronUp size={18} className="text-slate-600" /> : <ChevronDown size={18} className="text-slate-600" />}
             </button>
             {isArchitectReviewOpen && (
                <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
                   <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-5 rotate-12"><Sparkles size={40}/></div>
                      {isFetchingReview ? (
                         <div className="py-4 flex flex-col items-center justify-center gap-3"><Loader2 className="animate-spin text-emerald-500" /><p className="text-[10px] font-black text-slate-600 uppercase tracking-widest ai-loading-pulse">Synthesizing Longitudinal Progress...</p></div>
                      ) : (
                         <div className="relative z-10"><p className="text-xs text-slate-300 leading-relaxed italic">{progressReview || "Analysis ready. Refresh to update insights based on your latest sessions."}</p><button onClick={handleFetchReview} className="mt-4 flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest hover:text-emerald-300 transition-all"><RefreshCw size={12} /> Force Recalibration</button></div>
                      )}
                   </div>
                </div>
             )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Workouts</p><h4 className="text-2xl font-black text-slate-100">{Object.keys(historyByDate).length}</h4></div>
            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Record Sets</p><h4 className="text-2xl font-black text-slate-100">{history.length}</h4></div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl space-y-6 overflow-hidden relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-100 flex items-center gap-2"><TrendingUp className="text-emerald-400" size={20} /> Performance Analytics</h3>
                <div className="flex gap-2 mt-1">
                  {['1M', '3M', '6M', 'ALL'].map(r => (
                    <button key={r} onClick={() => setChartRange(r as any)} className={`text-[8px] font-black px-2 py-0.5 rounded-md transition-all uppercase tracking-widest ${chartRange === r ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={togglePerformanceZoom} className="p-2 bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-xl transition-all" title="Full Screen"><Maximize2 size={18} /></button>
                <select value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-slate-200 focus:ring-1 focus:ring-emerald-500/30 outline-none w-full sm:min-w-[160px] truncate">{uniqueExercisesInPeriod.map(ex => <option key={ex} value={ex}>{ex}</option>)}</select>
                <button onClick={() => setShowWarmups(!showWarmups)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${showWarmups ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-slate-800 text-slate-500'}`}>Warmups</button>
              </div>
            </div>

            <div className="flex gap-4 px-2">
               <button onClick={() => setVisibleMetrics(v => ({...v, volume: !v.volume}))} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${visibleMetrics.volume ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>Volume</button>
               <button onClick={() => setVisibleMetrics(v => ({...v, intensity: !v.intensity}))} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${visibleMetrics.intensity ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>Intensity</button>
               <button onClick={() => setVisibleMetrics(v => ({...v, relative: !v.relative}))} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${visibleMetrics.relative ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>Relative</button>
            </div>

            <div className="h-64 w-full mt-4">
              {renderPerformanceChartContent()}
            </div>
          </div>

          {isPerformanceZoomed && (
            <div className="fixed inset-0 z-[210] bg-slate-950 flex flex-col pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] animate-in fade-in duration-300">
               <div className="flex justify-between items-center p-6 sm:p-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-100 tracking-tight">{selectedExercise}</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Full-Scale Performance Timeline</p>
                  </div>
                  <button onClick={togglePerformanceZoom} className="p-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 rounded-[1.5rem] transition-all">
                    <Minimize2 size={24} />
                  </button>
               </div>
               <div className="flex-1 flex flex-col p-4 sm:p-8 min-h-0">
                  <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-[3rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none flex items-center justify-center">
                       <TrendingUp size={400} />
                    </div>
                    {renderPerformanceChartContent(true)}
                  </div>
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-4">
                     <div className="flex gap-4">
                        <div className="flex flex-col"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Protocol</span><span className="text-sm font-black text-slate-300">{chartRange} Data Window</span></div>
                        <div className="flex flex-col"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Sets</span><span className="text-sm font-black text-slate-300">{performanceData.length} Session Datapoints</span></div>
                     </div>
                     <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest sm:hidden animate-pulse">
                        <RotateCcw size={12} /> Rotate for detail
                     </div>
                  </div>
               </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center px-2"><div><h3 className="text-xl font-black text-slate-100 tracking-tight">{viewDate.toLocaleString('default', { month: 'long' })} {viewDate.getFullYear()}</h3><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Training Frequency Map</p></div><div className="flex gap-2"><button onClick={() => changeMonth(-1)} className="p-2 bg-slate-800 rounded-xl"><ChevronLeft size={18}/></button><button onClick={() => changeMonth(1)} className="p-2 bg-slate-800 rounded-xl"><ChevronRight size={18}/></button></div></div>
            <div className="grid grid-cols-7 gap-1">{['S','M','T','W','T','F','S'].map((d, idx) => <div key={idx} className="text-center text-[10px] font-black text-slate-600 py-2">{d}</div>)}{calendarDays.map((d, i) => d ? <button key={d.dateStr} onClick={() => setDrillDownDate(d.dateStr)} className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all ${drillDownDate === d.dateStr ? 'bg-cyan-500 text-slate-950 shadow-lg' : historyByDate[d.dateStr] ? 'bg-slate-800 text-slate-200' : 'text-slate-600'}`}><span className="text-xs font-black">{d.day}</span>{historyByDate[d.dateStr] && drillDownDate !== d.dateStr && <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-emerald-400"></div>}</button> : <div key={i} className="aspect-square"></div>)}</div>
          </div>

          {drillDownDate && historyByDate[drillDownDate] && sessionStats && (
            <div ref={drillDownRef} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl space-y-6 animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1">Session Drill-down</h4>
                  <h3 className="text-2xl font-black text-slate-100">{new Date(drillDownDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsHistoryEditorOpen(true)} className="p-3 bg-slate-800 hover:bg-indigo-500/10 text-indigo-400 rounded-2xl transition-all" title="Edit Session Data"><Edit2 size={20} /></button>
                  <button onClick={handleSaveAsProtocol} className="p-3 bg-slate-800 hover:bg-emerald-500/10 text-emerald-400 rounded-2xl transition-all" title="Archive as Protocol"><ClipboardList size={20} /></button>
                  <button onClick={() => setDrillDownDate(null)} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"><X size={20} /></button>
                </div>
              </div>

              {/* View Type Toggle */}
              <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-2xl w-full sm:w-auto self-start">
                <button 
                  onClick={() => setDrillDownSort('protocol')} 
                  className={`flex-1 sm:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${drillDownSort === 'protocol' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <ListOrdered size={14} /> Protocol
                </button>
                <button 
                  onClick={() => setDrillDownSort('timeline')} 
                  className={`flex-1 sm:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${drillDownSort === 'timeline' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Timer size={14} /> Timeline
                </button>
              </div>

              {/* Summary Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                 <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-3xl flex flex-col items-center justify-center text-center group">
                    <Weight size={14} className="text-emerald-500 mb-2" />
                    <h5 className="text-lg font-black text-slate-100">{sessionStats.volume.toLocaleString()}</h5>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{weightUnit} Volume</p>
                    {rollingAverages.volume > 0 && (
                      <div className="mt-2 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-1000" 
                          style={{ width: `${Math.min(100, (sessionStats.volume / (userSettings.units === 'imperial' ? rollingAverages.volume * 2.20462 : rollingAverages.volume)) * 100)}%` }}
                        />
                      </div>
                    )}
                 </div>
                 <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-3xl flex flex-col items-center justify-center text-center">
                    <Gauge size={14} className="text-cyan-400 mb-2" />
                    <h5 className="text-lg font-black text-slate-100">{sessionStats.peakE1RM}</h5>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Peak {weightUnit}</p>
                 </div>
                 <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-3xl flex flex-col items-center justify-center text-center group relative cursor-help">
                    <Flame size={14} className="text-amber-500 mb-2" />
                    <h5 className="text-lg font-black text-slate-100">{sessionStats.kj}</h5>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">kJ Burned</p>
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-[8px] font-bold text-slate-200 px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-2xl border border-slate-700">
                       ~{Math.round(sessionStats.kj / 100)}x Espresso Energy
                    </div>
                 </div>
                 <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-3xl flex flex-col items-center justify-center text-center">
                    <Trophy size={14} className="text-indigo-400 mb-2" />
                    <h5 className="text-lg font-black text-slate-100">{sessionStats.prs}</h5>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">PRs Achieved</p>
                 </div>
              </div>

              {/* AI Session Summary Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <Bot size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-slate-100 uppercase tracking-widest">Architect's Session Wrap</h4>
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">Post-Performance Analysis</p>
                  </div>
                </div>
                
                {isFetchingSummary ? (
                  <div className="py-4 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-emerald-500" size={16} />
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest ai-loading-pulse">Calculating Volumetric METs...</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    {sessionSummary || "Analyzing session metrics against longitudinal history..."}
                  </p>
                )}
                
                <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12">
                  <Sparkles size={40} />
                </div>
              </div>

              <div className="space-y-4">
                {processedDrillDownData?.type === 'protocol' ? (
                  processedDrillDownData.groups.map((group, groupIdx) => (
                    <div key={groupIdx} className="bg-slate-950 border border-slate-800/50 rounded-3xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center">
                        <h5 className="text-sm font-black text-slate-100">{group.name}</h5>
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{group.logs[0].category}</span>
                      </div>
                      <div className="p-4 space-y-2">
                        {group.logs.map((log, i) => (
                          <div key={i} className="flex justify-between items-center px-2 py-1.5">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 rounded bg-slate-900 flex items-center justify-center text-[9px] font-black text-slate-600 border border-slate-800">{i + 1}</span>
                              <span className={`text-sm font-black ${log.isWarmup ? 'text-amber-500/60' : 'text-slate-300'}`}>
                                {log.weight}{log.unit} × {log.reps}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {log.isWarmup && <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Warmup</span>}
                              {log.completedAt && (
                                <span className="text-[8px] font-black text-slate-700 uppercase tracking-tighter">
                                  {new Date(log.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="space-y-6">
                    {processedDrillDownData?.blocks.map((block: any, blockIdx: number) => {
                      if (block.type === 'intermission') {
                        return (
                          <div key={blockIdx} className="flex flex-col items-center py-4 relative">
                            <div className="w-full h-px bg-slate-800 absolute top-1/2 -translate-y-1/2" />
                            <div className="bg-slate-900 border border-slate-800 px-6 py-2 rounded-full relative z-10 flex items-center gap-2">
                              <Clock size={12} className="text-slate-500" />
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Long Break • {formatGapTime(block.gap)}</span>
                            </div>
                          </div>
                        );
                      }

                      const isComplex = block.type === 'complex';
                      
                      return (
                        <React.Fragment key={blockIdx}>
                          <div 
                            className={`bg-slate-950 border rounded-3xl overflow-hidden relative transition-all ${
                              isComplex 
                                ? 'border-emerald-500/40 ring-1 ring-emerald-500/10 bg-gradient-to-br from-slate-950 to-emerald-950/20' 
                                : 'border-slate-800'
                            }`}
                          >
                            <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                {isComplex ? (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 bg-emerald-500/20 rounded text-emerald-400">
                                      <Layers size={12} />
                                    </div>
                                    <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Complex Protocol (Superset)</h5>
                                  </div>
                                ) : (
                                  <>
                                    <h5 className="text-sm font-black text-slate-100">{block.exerciseName}</h5>
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-2">{block.category}</span>
                                  </>
                                )}
                              </div>
                              <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">
                                {new Date(block.logs[0].completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="p-4 space-y-3 relative">
                              {isComplex && (
                                <div className="absolute left-[26px] top-6 bottom-6 w-px border-l border-dashed border-emerald-500/30" />
                              )}
                              
                              {block.logs.map((log: any, i: number) => (
                                <div key={i} className="flex justify-between items-center px-2 py-1.5 relative z-10">
                                  <div className="flex items-center gap-3">
                                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black border transition-all ${
                                      isComplex 
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                        : 'bg-slate-900 border-slate-800 text-slate-600'
                                    }`}>
                                      {i + 1}
                                    </span>
                                    <div className="flex flex-col">
                                      {isComplex && (
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight mb-0.5">{log.exercise}</span>
                                      )}
                                      <span className={`text-sm font-black ${log.isWarmup ? 'text-amber-500/60' : 'text-slate-300'}`}>
                                        {log.weight}{log.unit} × {log.reps}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {log.isWarmup && <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Warmup</span>}
                                    <span className="text-[8px] font-black text-slate-700 uppercase tracking-tighter">
                                      {new Date(log.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Block Transition Indicator */}
                          {block.transitionAfter && block.transitionAfter <= 600 && (
                            <div className="flex items-center gap-3 pl-12 py-1">
                              <div className="w-[1px] h-4 bg-slate-800" />
                              <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">+ {formatGapTime(block.transitionAfter)} Transition</span>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'fuel' && (
        <FuelDepot 
          history={fuelHistory}
          profile={fuelProfile}
          onSaveFuel={onSaveFuel}
          onSaveProfile={onSaveFuelProfile}
          biometricHistory={biometricHistory}
          aiService={aiService}
          userSettings={userSettings}
        />
      )}

      {activeView === 'biometrics' && (
        <BiometricsLab 
          history={biometricHistory} 
          onSave={onSaveBiometrics} 
          onClose={() => handleViewChange('performance')} 
          userSettings={userSettings} 
          inline={true}
        />
      )}

      {isOfMorphologyOpen && (
        <MorphologyLab 
          history={morphologyHistory} 
          onSave={saveMorphology} 
          onClose={() => setIsMorphologyOpen(false)} 
          userSettings={userSettings} 
          aiService={aiService} 
        />
      )}
      
      {activeView === 'biometrics' && (
        <div className="fixed bottom-24 right-6 sm:bottom-28 z-40">
           <button onClick={() => setIsMorphologyOpen(true)} className="p-4 bg-cyan-500 text-slate-950 rounded-full hover:bg-cyan-400 transition-all shadow-xl shadow-cyan-500/30">
              <Camera size={24} />
           </button>
        </div>
      )}

      {isHistoryEditorOpen && drillDownDate && historyByDate[drillDownDate] && (
        <HistoryEditor 
          date={drillDownDate}
          logs={historyByDate[drillDownDate]}
          onClose={() => setIsHistoryEditorOpen(false)}
          onSave={(newLogs) => {
            onUpdateHistory(drillDownDate, newLogs);
            setIsHistoryEditorOpen(false);
          }}
          userSettings={userSettings}
          aiService={aiService}
        />
      )}
    </div>
  );
};

export default WorkoutHistory;
