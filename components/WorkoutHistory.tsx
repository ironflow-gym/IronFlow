import React, { useMemo, useState, useEffect, useRef } from 'react';
import { LineChart, ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend, ReferenceLine, Cell } from 'recharts';
import { Trophy, TrendingUp, TrendingDown, Minus, Calendar, ArrowLeft, ChevronLeft, ChevronRight, X, Bookmark, Activity, Target, Timer as TimeIcon, Clock, ListFilter, Flame, Zap, Weight, Droplets, Ruler, Wand2, Sparkles, Check, Loader2, Save, BarChart3, Info, RefreshCw, Maximize2, Minimize2, Bot, ChevronDown, ChevronUp, Heart, Shield, Anchor, ArrowDown, ArrowUp, Layers, Camera, ArrowRight, Gauge, ClipboardList, ListOrdered, Timer, Link, Edit2, Coffee, RotateCcw, Tag } from 'lucide-react';
import { HistoricalLog, WorkoutTemplate, UserSettings, BiometricEntry, MorphologyScan, MorphologyPendingScan, FuelLog, FuelProfile } from '../types';
import { GeminiService, GeminiError } from '../services/geminiService';
import { storage } from '../services/storageService';
import { isCardioCategory, formatDuration, isAssisted, getExerciseTrend, getStrengthDelta, getBestStrengthDelta, StrengthDelta, getRelativeStrength, isPR, PRResult, calcWeeklyStreak, getDeloadNudge, getVolumeLandmarkSnapshot, VolumeLandmarkEntry, getAnniversaryData, AnniversaryData, getPRPredictions, PRPrediction, getDeloadRecommendation, DeloadRecommendation } from '../src/utils';
import MorphologyLab from './MorphologyLab';
import BiometricsLab from './BiometricsLab';
import HistoryEditor from './HistoryEditor';
import FuelDepot from './FuelDepot';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ACWRGauge from './stats/ACWRGauge';
import StatsDashboard from './stats/StatsDashboard';

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
  onBulkRename: (oldName: string, newName: string, dates: string[]) => void;
  sessionSummaries: Record<string, string>;
  onSaveSummary: (date: string, summary: string) => void;
  /** Internal flag: forces mobile render even on desktop (used by StatsDashboard children slot) */
  _forceNonDesktop?: boolean;
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
  onUpdateHistory,
  onBulkRename,
  sessionSummaries,
  onSaveSummary,
  _forceNonDesktop = false,
}) => {
  const _isDesktopMQ = useMediaQuery('(min-width: 1024px)');
  const isDesktop = _isDesktopMQ && !_forceNonDesktop;
  const [activeView, setActiveView] = useState<'performance' | 'fuel' | 'biometrics'>(initialView);
  const [showVolumeInfo, setShowVolumeInfo] = useState(false);
  
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
  const [reviewError, setReviewError] = useState(false);
  const [isHistoryEditorOpen, setIsHistoryEditorOpen] = useState(false);
  const [isRenameToolOpen, setIsRenameToolOpen] = useState(false);
  const [renameNewName, setRenameNewName] = useState('');
  const [renameSelectedDates, setRenameSelectedDates] = useState<Set<string>>(new Set());
  const [isPerformanceZoomed, setIsPerformanceZoomed] = useState(false);
  
  // AI Session Summary state
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);

  const [morphologyHistory, setMorphologyHistory] = useState<MorphologyScan[]>([]);
  const [morphologyToast, setMorphologyToast] = useState<string | null>(null);
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
    const loadMorphology = async () => {
      const stored = await storage.get<MorphologyScan[]>('ironflow_morphology');
      if (stored) setMorphologyHistory(stored);
      // Background retry for pending morphology scan
      const pending = await storage.get<MorphologyPendingScan>('ironflow_morphology_pending');
      if (pending) {
        (async () => {
          try {
            const analyzeInput = pending.photoMode === '8'
              ? { mode: '8' as const, images: { upperFront: pending.images[0], upperLeft: pending.images[1], upperBack: pending.images[2], upperRight: pending.images[3], lowerFront: pending.images[4], lowerLeft: pending.images[5], lowerBack: pending.images[6], lowerRight: pending.images[7] } }
              : { mode: '4' as const, images: { front: pending.images[0], left: pending.images[1], back: pending.images[2], right: pending.images[3] } };
            const assessment = await aiService.analyzeMorphology(analyzeInput);
            const newScan: MorphologyScan = { id: Date.now().toString(), date: pending.date, assessment, photoMode: pending.photoMode };
            const currentHistory = stored || [];
            const newHistory = [newScan, ...currentHistory];
            setMorphologyHistory(newHistory);
            await storage.set('ironflow_morphology', newHistory);
            await storage.remove('ironflow_morphology_pending');
            setMorphologyToast('Morphology analysis complete — your scan results are ready.');
            setTimeout(() => setMorphologyToast(null), 6000);
          } catch {
            // Leave pending in storage — will retry next load
          }
        })();
      }
    };
    loadMorphology();
  }, []);

  const saveMorphology = async (scan: MorphologyScan) => {
    const newHistory = [scan, ...morphologyHistory];
    setMorphologyHistory(newHistory);
    await storage.set('ironflow_morphology', newHistory);
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

  // AI Session Summary Effect with Narrative Vault Caching
  useEffect(() => {
    if (drillDownDate && historyByDate[drillDownDate]) {
      // 1. Narrative Vault Check (Cache Hit)
      if (sessionSummaries && sessionSummaries[drillDownDate]) {
        setSessionSummary(sessionSummaries[drillDownDate]);
        setIsFetchingSummary(false);
        return;
      }

      setSessionSummary(null);
      const fetchSummary = async () => {
        setIsFetchingSummary(true);
        try {
          const summary = await aiService.getWorkoutMotivation(historyByDate[drillDownDate], history);
          setSessionSummary(summary);
          // 2. Lazy Backfill: Persistent Save to Vault
          onSaveSummary(drillDownDate, summary);
        } catch (e) {
          console.error("Failed to fetch session summary", e);
        } finally {
          setIsFetchingSummary(false);
        }
      };
      fetchSummary();
    }
  }, [drillDownDate, historyByDate, history, aiService, sessionSummaries, onSaveSummary]);

  const handleRedoSummary = async () => {
    if (!drillDownDate || !historyByDate[drillDownDate] || isFetchingSummary) return;
    setIsFetchingSummary(true);
    try {
      const summary = await aiService.getWorkoutMotivation(historyByDate[drillDownDate], history);
      setSessionSummary(summary);
      onSaveSummary(drillDownDate, summary);
    } catch (e) {
      console.error("Failed to redo session summary", e);
    } finally {
      setIsFetchingSummary(false);
    }
  };

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
    
    // Group by Date + Exercise to identify peaks for 60% rule
    const peaks: Record<string, number> = {};
    recentHistory.forEach(h => {
        const key = `${h.date}_${h.exercise}`;
        if (!peaks[key] || h.weight > peaks[key]) peaks[key] = h.weight;
    });

    const dailyTotals: Record<string, { volume: number, kj: number }> = {};
    recentHistory.forEach(h => {
        if (!dailyTotals[h.date]) dailyTotals[h.date] = { volume: 0, kj: 0 };
        
        const peakWeight = peaks[`${h.date}_${h.exercise}`] || 0;
        const isStatisticalWarmup = peakWeight > 0 && h.weight <= (peakWeight * 0.6);
        const effectiveIsWarmup = h.isWarmup || isStatisticalWarmup;

        if (!effectiveIsWarmup && !isCardioCategory(h.category)) {
            const w = h.unit === 'lbs' ? h.weight * 0.453592 : h.weight;
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
    
    // Find peaks for the session.
    // For assisted exercises lower weight = harder, so 'peak' is the minimum.
    const peaks: Record<string, number> = {};
    sessionLogs.forEach(log => {
      const assisted = isAssisted(log.exercise);
      if (!peaks[log.exercise] ||
          (assisted ? log.weight < peaks[log.exercise] : log.weight > peaks[log.exercise])) {
        peaks[log.exercise] = log.weight;
      }
    });

    let totalVolume = 0;
    let peakE1RM = 0;
    let totalKJ = 0;
    let prCount = 0;
    const prDetails: Record<string, PRResult> = {};

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
      // Cardio logs use weight=distance, reps=duration — exclude from
      // resistance metrics (volume, e1rm, kj, PRs) to prevent corruption.
      if (isCardioCategory(log.category)) return;

      const peakWeight = peaks[log.exercise] || 0;
      const isStatisticalWarmup = peakWeight > 0 && log.weight <= (peakWeight * 0.6);
      const effectiveIsWarmup = log.isWarmup || isStatisticalWarmup;

      if (effectiveIsWarmup) return;
      
      const weightKg = log.unit === 'lbs' ? log.weight * 0.453592 : log.weight;
      const vol = weightKg * log.reps;
      totalVolume += vol;
      
      const e1rm = calculateE1RM(weightKg, log.reps);
      if (e1rm > peakE1RM) peakE1RM = e1rm;

      const displacement = getDisplacement(log.category);
      const kj = (weightKg * 9.81 * displacement * log.reps * 4) / 1000;
      totalKJ += kj;

      // PR detection — uses canonical isPR (90-day window, ≥2 prior sessions)
      const prResult = isPR(log.exercise, weightKg, log.reps, history, log.date);
      if (prResult) {
        prCount++;
        // Only record the best PR per exercise (highest delta)
        if (!prDetails[log.exercise] || prResult.delta > prDetails[log.exercise].delta) {
          prDetails[log.exercise] = prResult;
        }
      }
    });

    const isImperial = userSettings.units === 'imperial';
    // Convert PR e1RM/delta to display units
    const prList = Object.entries(prDetails).map(([exercise, result]) => ({
      exercise,
      e1rm: isImperial ? Math.round(result.e1rm * 2.20462 * 10) / 10 : result.e1rm,
      delta: isImperial ? Math.round(result.delta * 2.20462 * 10) / 10 : result.delta,
    }));
    return {
      volume: Math.round(isImperial ? totalVolume * 2.20462 : totalVolume),
      peakE1RM: Math.round(isImperial ? peakE1RM * 2.20462 : peakE1RM),
      kj: Math.round(totalKJ),
      prs: prCount,
      prList,
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

  // True when the selected exercise is a cardio category — drives chart mode.
  const selectedExerciseIsCardio = useMemo(
    () => {
      if (!selectedExercise) return false;
      const sample = history.find(h => h.exercise === selectedExercise);
      return sample ? isCardioCategory(sample.category) : false;
    },
    [selectedExercise, history]
  );

  const selectedExerciseIsAssisted = useMemo(
    () => (selectedExercise ? isAssisted(selectedExercise) : false),
    [selectedExercise]
  );

  const performanceData = useMemo<any[]>(() => {
    if (!selectedExercise) return [];
    const exerciseHistory = history.filter(h => h.exercise === selectedExercise);
    const now = new Date();
    const rangeMsMap = { '1M': 30, '3M': 90, '6M': 180, 'ALL': 9999 };
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - rangeMsMap[chartRange]);

    // ── Cardio chart: distance over time, pace as second metric ──────────
    if (selectedExerciseIsCardio) {
      // weight = distance, reps = duration in seconds
      // Aggregate to best distance per session date (longest effort)
      const sessionAgg: Record<string, { distance: number, duration: number }> = {};
      exerciseHistory.forEach(h => {
        if (new Date(h.date) < cutoffDate) return;
        const hDist = h.distance ?? h.weight;
        const hDur = h.duration ?? h.reps;
        if (!sessionAgg[h.date] || hDist > sessionAgg[h.date].distance) {
          sessionAgg[h.date] = { distance: hDist, duration: hDur };
        }
      });
      return Object.entries(sessionAgg)
        .map(([date, d]) => {
          // Pace: minutes per km (or mi). Guard against zero duration.
          const paceMinPerUnit = d.duration > 0 ? parseFloat(((d.duration / 60) / d.distance).toFixed(2)) : 0;
          return { date, distance: parseFloat(d.distance.toFixed(2)), pace: paceMinPerUnit };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // ── Resistance chart: volume / e1rm / relative ────────────────────────
    // For assisted exercises lower weight = harder (less assistance).
    const exerciseIsAssisted = isAssisted(selectedExercise);

    // Identify daily peaks: highest weight for normal, lowest for assisted.
    const dailyPeaks: Record<string, number> = {};
    exerciseHistory.forEach(h => {
      if (!dailyPeaks[h.date] ||
          (exerciseIsAssisted ? h.weight < dailyPeaks[h.date] : h.weight > dailyPeaks[h.date])) {
        dailyPeaks[h.date] = h.weight;
      }
    });

    const sessionAggregates: Record<string, { volume: number, e1rm: number, relative: number }> = {};
    // For assisted, a PB is a lower e1rm (less assistance needed).
    let runningBestE1RM = exerciseIsAssisted ? Infinity : 0;

    exerciseHistory.forEach(h => {
      const hDate = new Date(h.date);
      if (hDate < cutoffDate) return;
      if (!sessionAggregates[h.date]) sessionAggregates[h.date] = { volume: 0, e1rm: 0, relative: 0 };
      
      const peakWeight = dailyPeaks[h.date] || 0;
      // Statistical warmup: for normal = low weight sets; for assisted = high weight
      // sets (high assistance = easy). Skip stat-warmup for assisted to keep it simple.
      const isStatisticalWarmup = !exerciseIsAssisted && peakWeight > 0 && h.weight <= (peakWeight * 0.6);
      const effectiveIsWarmup = h.isWarmup || isStatisticalWarmup;

      if (showWarmups || !effectiveIsWarmup) {
        sessionAggregates[h.date].volume += h.weight * h.reps;
      }

      if (!effectiveIsWarmup) {
        const currentSetE1RM = calculateE1RM(h.weight, h.reps);
        // For assisted: track the session's lowest e1rm (least assistance = best effort).
        const isBetter = exerciseIsAssisted
          ? (sessionAggregates[h.date].e1rm === 0 || currentSetE1RM < sessionAggregates[h.date].e1rm)
          : currentSetE1RM > sessionAggregates[h.date].e1rm;
        if (isBetter) {
          sessionAggregates[h.date].e1rm = currentSetE1RM;
          const bodyWeight = getWeightAtDate(h.date);
          if (bodyWeight) sessionAggregates[h.date].relative = parseFloat((currentSetE1RM / bodyWeight).toFixed(2));
        }
      }
    });

    return Object.entries(sessionAggregates)
      .map(([date, data]) => {
        let isPB = false;
        if (exerciseIsAssisted
          ? data.e1rm > 0 && data.e1rm < runningBestE1RM
          : data.e1rm > runningBestE1RM) {
          isPB = true;
          runningBestE1RM = data.e1rm;
        }
        return { date, volume: Math.round(data.volume), intensity: parseFloat(data.e1rm.toFixed(1)), relative: data.relative, isPB };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history, selectedExercise, selectedExerciseIsCardio, showWarmups, chartRange, biometricHistory]);

  const handleFetchReview = async () => {
    setIsFetchingReview(true);
    setIsArchitectReviewOpen(true);
    setReviewError(false);
    try {
      const review = await aiService.getProgressReview(history, biometricHistory);
      setProgressReview(review);
    } catch (e: unknown) {
      console.error(e);
      setProgressReview(e instanceof GeminiError ? e.userMessage : "Analysis failed — check your API connection.");
      setReviewError(true);
    } finally {
      setIsFetchingReview(false);
    }
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
    
    // Identify peaks for the current drill down session to mark statistical warmups visually
    const peaks: Record<string, number> = {};
    logs.forEach(log => {
      if (!peaks[log.exercise] || log.weight > peaks[log.exercise]) peaks[log.exercise] = log.weight;
    });

    const enrichedLogs = logs.map(l => ({
      ...l,
      isStatisticalWarmup: (peaks[l.exercise] || 0) > 0 && l.weight <= ((peaks[l.exercise] || 0) * 0.6)
    }));

    if (drillDownSort === 'timeline') {
      const blocks: any[] = [];
      if (enrichedLogs.length === 0) return { type: 'timeline' as const, blocks: [] };

      let currentBlock: any = {
        type: 'standard',
        exerciseName: enrichedLogs[0].exercise,
        category: enrichedLogs[0].category,
        logs: [enrichedLogs[0]]
      };

      for (let i = 1; i < enrichedLogs.length; i++) {
        const prev = enrichedLogs[i - 1];
        const current = enrichedLogs[i];
        const gap = ((current.completedAt || 0) - (prev.completedAt || 0)) / 1000;

        if (gap > 600) { 
          blocks.push({ ...currentBlock, transitionAfter: gap });
          blocks.push({ type: 'intermission', gap });
          currentBlock = { type: 'standard', exerciseName: current.exercise, category: current.category, logs: [current] };
          continue;
        }

        if (current.exercise === prev.exercise) {
          if (gap < 240) {
            currentBlock.logs.push(current);
          } else {
            blocks.push({ ...currentBlock, transitionAfter: gap });
            currentBlock = { type: 'standard', exerciseName: current.exercise, category: current.category, logs: [current] };
          }
        } else {
          if (gap < 90) { 
            currentBlock.type = 'complex';
            currentBlock.exerciseName = undefined; 
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
      const orderedExercises: string[] = [];
      enrichedLogs.forEach(l => {
        if (!orderedExercises.includes(l.exercise)) orderedExercises.push(l.exercise);
      });
      const groups = orderedExercises.map(exName => ({
        name: exName,
        logs: enrichedLogs.filter(l => l.exercise === exName)
      }));
      return { type: 'protocol' as const, groups };
    }
  }, [drillDownDate, historyByDate, drillDownSort]);

  const renderPerformanceChartContent = (isZoomed: boolean = false) => {
    // ── Cardio chart ──────────────────────────────────────────────────────
    if (selectedExerciseIsCardio) {
      const _sample = history.find(h => h.exercise === selectedExercise);
      const distUnit = _sample?.distanceUnit ?? (_sample?.unit === 'lbs' ? 'mi' : 'km');
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={performanceData}>
            <defs>
              <linearGradient id="colorDistance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fb923c" stopOpacity={0.4}/><stop offset="95%" stopColor="#fb923c" stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} strokeOpacity={0.2} />
            <XAxis dataKey="date" stroke="#94a3b8" fontSize={isZoomed ? 13 : 11} tickFormatter={(v) => v.split('-').slice(1).join('/')} axisLine={false} tickLine={false} fontWeight={800} />
            <YAxis yAxisId="left" stroke="#fb923c" fontSize={isZoomed ? 11 : 9} axisLine={false} tickLine={false} fontWeight={900} tickFormatter={(v) => `${v}${distUnit}`} />
            <YAxis yAxisId="right" stroke="#a78bfa" fontSize={isZoomed ? 11 : 9} axisLine={false} tickLine={false} orientation="right" fontWeight={900} tickFormatter={(v) => `${v}'/u`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '16px', fontSize: isZoomed ? '13px' : '11px', fontWeight: 700 }}
              cursor={{ stroke: '#475569', strokeWidth: 1 }}
              formatter={(value: any, name: string) =>
                name === 'Distance' ? [`${value}${distUnit}`, 'Distance'] :
                name === 'Pace' ? [`${value} min/${distUnit}`, 'Pace'] : [value, name]
              }
            />
            <Legend wrapperStyle={{ fontSize: isZoomed ? '13px' : '11px', paddingTop: '15px', fontWeight: 900, textTransform: 'uppercase' }} />
            <Area yAxisId="left" name="Distance" type="monotone" dataKey="distance" stroke="#fb923c" strokeWidth={isZoomed ? 4 : 3} fillOpacity={1} fill="url(#colorDistance)" dot={{ fill: '#fb923c', r: isZoomed ? 5 : 3 }} />
            <Line yAxisId="right" name="Pace" type="monotone" dataKey="pace" stroke="#a78bfa" strokeWidth={isZoomed ? 4 : 3} dot={{ fill: '#a78bfa', r: isZoomed ? 5 : 3 }} strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // ── Resistance chart ──────────────────────────────────────────────────
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={performanceData}>
          <defs>
            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
            <linearGradient id="colorIntensity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/><stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} strokeOpacity={0.2} />
          <XAxis dataKey="date" stroke="#94a3b8" fontSize={isZoomed ? 13 : 11} tickFormatter={(v) => v.split('-').slice(1).join('/')} axisLine={false} tickLine={false} fontWeight={800} />
          <YAxis yAxisId="left" stroke="#10b981" fontSize={isZoomed ? 11 : 9} axisLine={false} tickLine={false} fontWeight={900} />
          <YAxis yAxisId="right" stroke="#22d3ee" fontSize={isZoomed ? 11 : 9} axisLine={false} tickLine={false} orientation="right" fontWeight={900} reversed={selectedExerciseIsAssisted} />
          <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '16px', fontSize: isZoomed ? '13px' : '11px', fontWeight: 700 }} cursor={{ stroke: '#475569', strokeWidth: 1 }} />
          <Legend wrapperStyle={{ fontSize: isZoomed ? '13px' : '11px', paddingTop: '15px', fontWeight: 900, textTransform: 'uppercase' }} />
          {visibleMetrics.volume && <Area yAxisId="left" name="Volume" type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={isZoomed ? 4 : 3} fillOpacity={1} fill="url(#colorVolume)" />}
          {visibleMetrics.intensity && <Line yAxisId="right" name="Intensity" type="monotone" dataKey="intensity" stroke="#22d3ee" strokeWidth={isZoomed ? 5 : 4} dot={{ fill: '#22d3ee', r: isZoomed ? 6 : 4 }} />}
          {visibleMetrics.relative && <Line yAxisId="right" name="Relative" type="monotone" dataKey="relative" stroke="#6366f1" strokeWidth={isZoomed ? 4 : 3} dot={{ fill: '#6366f1', r: isZoomed ? 5 : 3 }} />}
          {performanceData.map((entry, idx) => entry.isPB && <ReferenceDot key={idx} yAxisId="right" x={entry.date} y={entry.intensity} r={isZoomed ? 10 : 8} fill="#fbbf24" stroke="#0f172a" />)}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  // ── Desktop branch — StatsDashboard wraps collapsible mobile log ────
  // mobileJSX is the existing mobile render, passed as children to StatsDashboard
  // isDesktop is false when rendered inside StatsDashboard's children slot
  // because this component re-renders in that context at narrow width.
  // We disable the isDesktop branch for the children render by passing a flag.
  if (isDesktop) {
    const trainContent = (
      <WorkoutHistory
        history={history}
        biometricHistory={biometricHistory}
        onSaveBiometrics={onSaveBiometrics}
        fuelHistory={fuelHistory}
        onSaveFuel={onSaveFuel}
        fuelProfile={fuelProfile}
        onSaveFuelProfile={onSaveFuelProfile}
        aiService={aiService}
        onSaveTemplate={onSaveTemplate}
        userSettings={userSettings}
        lastSessionDate={lastSessionDate}
        onClearLastSession={onClearLastSession}
        initialView="performance"
        onViewChange={onViewChange}
        onResetInitialView={onResetInitialView}
        onUpdateHistory={onUpdateHistory}
        onBulkRename={onBulkRename}
        sessionSummaries={sessionSummaries}
        onSaveSummary={onSaveSummary}
        _forceNonDesktop
      />
    );

    const tabMap: Record<string, 'train' | 'biometrics' | 'fuel'> = {
      performance: 'train',
      fuel: 'fuel',
      biometrics: 'biometrics',
    };

    return (
      <StatsDashboard
        history={history}
        biometricHistory={biometricHistory}
        onSaveBiometrics={onSaveBiometrics}
        fuelHistory={fuelHistory}
        onSaveFuel={onSaveFuel}
        fuelProfile={fuelProfile}
        onSaveFuelProfile={onSaveFuelProfile}
        userSettings={userSettings}
        aiService={aiService}
        onSaveTemplate={onSaveTemplate}
        trainContent={trainContent}
        initialTab={tabMap[initialView ?? 'performance'] ?? 'train'}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab switcher — hidden when rendered inside the desktop StatsDashboard train panel */}
      {!_forceNonDesktop && (
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-4">
          <button onClick={() => handleViewChange('performance')} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'performance' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}><BarChart3 size={14} /> Train</button>
          <button onClick={() => handleViewChange('fuel')} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'fuel' ? 'bg-[#fb923c] text-slate-950 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}><Coffee size={14} /> Fuel</button>
          <button onClick={() => handleViewChange('biometrics')} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeView === 'biometrics' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}><Activity size={14} /> Bios</button>
        </div>
      )}

      {activeView === 'performance' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-xl">
             <button onClick={progressReview ? () => setIsArchitectReviewOpen(!isArchitectReviewOpen) : handleFetchReview} className="w-full px-6 py-5 flex items-center justify-between group hover:bg-slate-800/50 transition-all">
                <div className="flex items-center gap-4">
                   <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-500/20"><Bot size={20} className="text-emerald-400" /></div>
                   <div className="text-left">
                      <h4 className="text-[12px] font-black text-slate-100 uppercase tracking-widest">Architect's Evolution Review</h4>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">Kinematic Trend Analysis</p>
                   </div>
                </div>
                {isFetchingReview ? <Loader2 className="animate-spin text-emerald-400" size={18} /> : isArchitectReviewOpen ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
             </button>
             {isArchitectReviewOpen && (
                <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
                   <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-inner">
                      <div className="absolute top-0 right-0 p-3 opacity-5 rotate-12"><Sparkles size={40}/></div>
                      {isFetchingReview ? (
                         <div className="py-4 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-emerald-500" /><p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ai-loading-pulse text-center">Synthesizing Longitudinal Progress...</p></div>
                      ) : (
                         <div className="relative z-10"><p className={`text-sm leading-relaxed italic font-medium ${reviewError ? 'text-rose-400' : 'text-slate-100'}`}>{reviewError ? "Analysis failed — check your API connection and try again." : progressReview || "Analysis ready. Refresh to update insights based on your latest sessions."}</p><button onClick={handleFetchReview} className="mt-5 flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] hover:text-emerald-300 transition-all border border-emerald-500/20 px-4 py-2 rounded-lg bg-emerald-500/5"><RefreshCw size={12} /> {reviewError ? "Retry" : "Force Recalibration"}</button></div>
                      )}
                   </div>
                </div>
             )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-lg"><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Workouts</p><h4 className="text-3xl font-black text-slate-100">{Object.keys(historyByDate).length}</h4></div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-lg"><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Record Sets</p><h4 className="text-3xl font-black text-slate-100">{history.length}</h4></div>
          </div>

          {/* Anniversary hero card */}
          {(() => {
            const ann = getAnniversaryData(history, biometricHistory, userSettings.weeklyWorkoutGoal ?? 3);
            if (!ann) return null;
            const yearLabels: Record<number, string> = { 1: 'One Year', 2: 'Two Years', 3: 'Three Years', 4: 'Four Years', 5: 'Five Years' };
            const headline = `${yearLabels[ann.yearNumber] ?? `${ann.yearNumber} Years`} of Iron`;
            return (
              <div className="relative bg-slate-900 border border-amber-400/30 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/8 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 p-4 opacity-[0.05] -rotate-12 pointer-events-none">
                  <Trophy size={90} />
                </div>
                <div className="relative z-10 space-y-5">
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <div className="shrink-0 w-14 h-14 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
                      <Trophy className="text-amber-400" size={26} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-0.5">Anniversary</p>
                      <p className="text-xl font-black text-slate-100 leading-tight">{headline}</p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800/60">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Workouts</p>
                      <p className="text-2xl font-black text-amber-400">{ann.workoutsThisYear}</p>
                    </div>
                    <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800/60">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sets Logged</p>
                      <p className="text-2xl font-black text-amber-400">{ann.setsThisYear.toLocaleString()}</p>
                    </div>
                    {ann.bestDelta && (
                      <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800/60">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Best Gain</p>
                        <p className="text-2xl font-black text-emerald-400">+{ann.bestDelta.pct}%</p>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 truncate">{ann.bestDelta.exerciseName}</p>
                      </div>
                    )}
                    {ann.weeklyStreak > 0 && (
                      <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800/60">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Best Streak</p>
                        <p className="text-2xl font-black text-amber-400">{ann.weeklyStreak}<span className="text-sm ml-1">wk</span></p>
                      </div>
                    )}
                  </div>

                  {/* Biometric line — only when body fat has improved */}
                  {ann.bodyFatChangedPct !== undefined && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <TrendingDown size={12} className="text-emerald-400" />
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{Math.abs(ann.bodyFatChangedPct)}% body fat lost</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Weekly consistency streak */}
          {(() => {
            const streak = calcWeeklyStreak(history, userSettings.weeklyWorkoutGoal ?? 3);
            if (streak === 0) return null;
            const label = streak === 1 ? 'week' : 'weeks';
            const isLongStreak = streak >= 8;
            return (
              <div className="relative bg-slate-900 border border-amber-500/25 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 p-4 opacity-[0.06] -rotate-12 pointer-events-none">
                  <Flame size={80} />
                </div>
                <div className="relative z-10 flex items-center gap-5">
                  <div className="shrink-0 w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <Flame className="text-amber-400" size={26} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-1">Consistency Streak</p>
                    <p className="text-xl font-black text-slate-100 leading-tight">
                      <span className="text-amber-400">{streak} {label}</span> without missing a week
                    </p>
                    {isLongStreak && (
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">That's a serious habit</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Deload Scheduler card — shows block position, RPE trend, and recommendation */}
          {(() => {
            const rec = getDeloadRecommendation(history);

            // Only render for approaching/due/overdue — no card when status is none
            if (!rec || rec.status === 'none') {
              // Fall back to the legacy muscle-specific nudge when scheduler has nothing to say
              const nudgeMuscle = getDeloadNudge(history);
              if (!nudgeMuscle) return null;
              return (
                <p className="text-[11px] font-bold text-slate-300 italic px-1">
                  Your <span className="text-amber-400 not-italic">{nudgeMuscle.toLowerCase()}</span> has had a heavy week — a rest day or lighter session could pay dividends.
                </p>
              );
            }

            const statusConfig = {
              approaching: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', label: 'Deload Approaching' },
              due:         { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/25', label: 'Deload Due' },
              overdue:     { color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   label: 'Deload Overdue' },
            }[rec.status] ?? { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', label: 'Deload' };

            const rpeIcon = rec.rpeTrend === 'rising' ? '↑' : rec.rpeTrend === 'falling' ? '↓' : '→';
            const rpeColor = rec.rpeTrend === 'rising' ? 'text-rose-400' : rec.rpeTrend === 'falling' ? 'text-emerald-400' : 'text-slate-400';

            return (
              <div className={`${statusConfig.bg} border ${statusConfig.border} rounded-3xl p-5 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Coffee size={15} className={statusConfig.color} />
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${statusConfig.color}`}>{statusConfig.label}</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Block week {rec.blockWeek}</span>
                </div>

                {/* Block progress bar */}
                <div className="space-y-1">
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${rec.status === 'overdue' ? 'bg-rose-500' : rec.status === 'due' ? 'bg-orange-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, (rec.blockWeek / rec.targetBlockLength) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Week 1</span>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Week {rec.targetBlockLength}</span>
                  </div>
                </div>

                {/* Stat chips */}
                <div className="flex gap-2 flex-wrap">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-800/60 rounded-lg border border-slate-700/40">
                    Volume: {rec.volumeZone.replace('_', ' ')}
                  </span>
                  {rec.rpeConfidence && (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-slate-800/60 rounded-lg border border-slate-700/40 ${rpeColor}`}>
                      RPE {rpeIcon} {rec.rpeTrend}
                    </span>
                  )}
                  {rec.weeksUntilDue < 0 && (
                    <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest px-2 py-1 bg-rose-500/10 rounded-lg border border-rose-500/20">
                      {Math.abs(rec.weeksUntilDue)}wk overdue
                    </span>
                  )}
                </div>

                <p className="text-[10px] font-bold text-slate-400 leading-relaxed">{rec.reasoning}</p>
              </div>
            );
          })()}

          {/* Imminent milestone nudge — mobile only, fires when a lift is within 2 weeks of a round number */}
          {(() => {
            const imminent = getPRPredictions(history, 2, 1);
            if (imminent.length === 0) return null;
            const pred = imminent[0];
            const weeksLabel = pred.weeksAway < 1 ? 'this week' : pred.weeksAway <= 1.5 ? 'next week' : 'within 2 weeks';
            return (
              <div className="flex items-center gap-3 px-1">
                <Target size={14} className="text-amber-400 shrink-0" />
                <p className="text-[11px] font-bold text-slate-300">
                  <span className="text-amber-400">{pred.targetMilestone}kg</span> on {pred.exerciseName} could be yours <span className="text-amber-400">{weeksLabel}</span> — keep the momentum.
                </p>
              </div>
            );
          })()}

          {/* Volume landmark dot grid — 7-day rolling snapshot, muscles active in last 30 days */}
          {(() => {
            const snapshot = getVolumeLandmarkSnapshot(history);
            if (snapshot.length === 0) return null;
            const dotColor = (status: VolumeLandmarkEntry['status']) => {
              if (status === 'excess')     return 'bg-rose-500';
              if (status === 'heavy')      return 'bg-amber-400';
              if (status === 'productive') return 'bg-emerald-400';
              return 'bg-slate-600';
            };
            const labelColor = (status: VolumeLandmarkEntry['status']) => {
              if (status === 'excess')     return 'text-rose-400';
              if (status === 'heavy')      return 'text-amber-400';
              if (status === 'productive') return 'text-slate-300';
              return 'text-slate-500';
            };

            // Plain language summary counts
            const counts = { excess: 0, heavy: 0, productive: 0, below: 0 };
            snapshot.forEach(({ status }) => counts[status]++);
            const parts: string[] = [];
            if (counts.productive > 0) parts.push(`${counts.productive} muscle${counts.productive > 1 ? 's' : ''} in the productive zone`);
            if (counts.heavy > 0)      parts.push(`${counts.heavy} approaching MRV`);
            if (counts.excess > 0)     parts.push(`${counts.excess} above MRV`);
            if (counts.below > 0)      parts.push(`${counts.below} below MEV`);

            const overallVerdict = counts.excess > 0
              ? 'Some muscles are being pushed beyond their maximum recoverable volume — consider reducing sets.'
              : counts.heavy > 0 && counts.productive === 0
              ? 'Most muscles are at or near their limit this week. A lighter session would serve you well.'
              : counts.below > snapshot.length * 0.5
              ? 'Most muscles are below their minimum effective volume — you could benefit from more total sets.'
              : 'Your weekly volume distribution looks well balanced.';

            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-0.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">7-day volume</p>
                  <div className="relative">
                    <button
                      onClick={() => setShowVolumeInfo(v => !v)}
                      className="text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      <Info size={13} />
                    </button>
                    {showVolumeInfo && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowVolumeInfo(false)} />
                        <div className="absolute left-0 top-6 z-50 w-72 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-4">

                          {/* Concept explanation */}
                          <div className="space-y-2">
                            <p className="text-[11px] font-black text-slate-100 uppercase tracking-widest">What this shows</p>
                            <p className="text-[10px] text-slate-300 leading-relaxed">
                              Each dot shows how many sets you've done for that muscle group in the last 7 days, compared to three evidence-based thresholds.
                            </p>
                            <div className="space-y-1.5 pt-1">
                              {[
                                { dot: 'bg-slate-600',  label: 'Below MEV',       desc: 'Too few sets to drive meaningful growth' },
                                { dot: 'bg-emerald-400', label: 'Productive zone', desc: 'Between minimum and maximum effective volume — the sweet spot' },
                                { dot: 'bg-amber-400',  label: 'Approaching MRV', desc: 'Near your maximum recoverable volume — monitor fatigue' },
                                { dot: 'bg-rose-500',   label: 'Above MRV',       desc: 'More sets than you can recover from — reduce volume' },
                              ].map(({ dot, label, desc }) => (
                                <div key={label} className="flex items-start gap-2.5">
                                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${dot}`} />
                                  <div>
                                    <span className="text-[10px] font-black text-slate-200">{label} </span>
                                    <span className="text-[10px] text-slate-500">{desc}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-slate-800" />

                          {/* Personalised summary */}
                          <div className="space-y-2">
                            <p className="text-[11px] font-black text-slate-100 uppercase tracking-widest">Your picture this week</p>
                            <p className="text-[10px] text-slate-300 leading-relaxed">
                              {parts.join(', ').replace(/,([^,]*)$/, ' and$1')}.
                            </p>
                            <p className="text-[10px] text-slate-400 leading-relaxed italic">{overallVerdict}</p>
                          </div>

                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {snapshot.map(({ muscle, status }) => (
                    <div key={muscle} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor(status)}`} />
                      <span className={`text-[11px] font-bold ${labelColor(status)}`}>{muscle}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ACWR gauge — mobile overview card. ACWRGauge handles its own empty state. */}
          {history.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl">
              <ACWRGauge history={history} />
            </div>
          )}

          {/* Strength delta hero card — only renders when there is a meaningful improvement to celebrate */}
          {(() => {
            const delta = getBestStrengthDelta(history);
            if (!delta) return null;
            return (
              <div className="relative bg-slate-900 border border-emerald-500/25 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 p-4 opacity-[0.06] -rotate-12 pointer-events-none">
                  <TrendingUp size={80} />
                </div>
                <div className="relative z-10 flex items-center gap-5">
                  <div className="shrink-0 w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <TrendingUp className="text-emerald-400" size={26} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-1">Personal Achievement</p>
                    <p className="text-xl font-black text-slate-100 leading-tight">
                      You are <span className="text-emerald-400">{delta.pct}% stronger</span> than {delta.label}
                    </p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{delta.exerciseName}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl space-y-6 overflow-hidden relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-2">
              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-100 flex items-center gap-3 uppercase tracking-tight"><TrendingUp className="text-emerald-400" size={24} /> Performance Analytics</h3>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {['1M', '3M', '6M', 'ALL'].map(r => (
                    <button key={r} onClick={() => setChartRange(r as any)} className={`text-[9px] font-black px-3 py-1 rounded-md transition-all uppercase tracking-widest border ${chartRange === r ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>{r}</button>
                  ))}
                  <button onClick={() => setShowWarmups(!showWarmups)} className={`text-[9px] font-black px-3 py-1 rounded-md transition-all uppercase tracking-widest border ${showWarmups ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>Warmups</button>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={togglePerformanceZoom} className="p-3 bg-slate-800 border border-slate-700 text-slate-300 hover:text-emerald-400 rounded-xl transition-all shadow-md" title="Full Screen"><Maximize2 size={20} /></button>
                <select value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-xl px-5 py-3 text-sm font-black text-slate-100 focus:ring-2 focus:ring-emerald-500/30 outline-none w-full sm:min-w-[180px] shadow-inner uppercase tracking-tight">{uniqueExercisesInPeriod.map(ex => <option key={ex} value={ex}>{ex}</option>)}</select>
                {selectedExercise && (
                  <button
                    onClick={() => {
                      setRenameNewName(selectedExercise);
                      setRenameSelectedDates(new Set());
                      setIsRenameToolOpen(true);
                    }}
                    className="p-3 bg-slate-800 border border-slate-700 text-slate-400 hover:text-violet-400 hover:border-violet-500/40 rounded-xl transition-all shadow-md shrink-0"
                    title="Rename exercise across sessions"
                  ><Tag size={18} /></button>
                )}
              </div>
            </div>

            <div className="flex gap-4 px-2">
              {selectedExerciseIsCardio ? (
                <>
                  <span className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-sm">Distance</span>
                  <span className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border bg-violet-500/20 border-violet-500/50 text-violet-400 shadow-sm">Pace</span>
                </>
              ) : (
                <>
                  <button onClick={() => setVisibleMetrics(v => ({...v, volume: !v.volume}))} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border transition-all ${visibleMetrics.volume ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>Volume</button>
                  <button onClick={() => setVisibleMetrics(v => ({...v, intensity: !v.intensity}))} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border transition-all ${visibleMetrics.intensity ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>Intensity</button>
                  <button onClick={() => setVisibleMetrics(v => ({...v, relative: !v.relative}))} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border transition-all ${visibleMetrics.relative ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400 shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>Relative</button>
                </>
              )}
            </div>

            {/* 4-week trend indicator — shown when exercise has enough data */}
            {!selectedExerciseIsCardio && selectedExercise && (() => {
              const trend = getExerciseTrend(selectedExercise, history);
              if (!trend) return null;
              const cfg = {
                up:   { icon: <TrendingUp size={13} />,   label: 'Progressing',  sub: 'e1RM trending up over the last 4 weeks',   cls: 'border-emerald-500/30 bg-emerald-500/8  text-emerald-400' },
                flat: { icon: <Minus size={13} />,         label: 'Plateaued',    sub: 'e1RM stable over the last 4 weeks',         cls: 'border-slate-600     bg-slate-800/60      text-slate-300'  },
                down: { icon: <TrendingDown size={13} />,  label: 'Regressing',   sub: 'e1RM trending down over the last 4 weeks',  cls: 'border-rose-500/30   bg-rose-500/8        text-rose-400'   },
              }[trend];
              return (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${cfg.cls}`}>
                  {cfg.icon}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none">{cfg.label}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{cfg.sub}</p>
                  </div>
                </div>
              );
            })()}

            {/* Personal achievement delta — silent when no meaningful improvement */}
            {!selectedExerciseIsCardio && selectedExercise && (() => {
              const delta = getStrengthDelta(selectedExercise, history);
              if (!delta) return null;
              return (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5">
                  <TrendingUp size={13} className="text-emerald-400 shrink-0" />
                  <p className="text-[10px] font-black text-slate-100 uppercase tracking-widest">
                    You are <span className="text-emerald-400">{delta.pct}% stronger</span>
                    <span className="text-slate-400"> than {delta.label}</span>
                  </p>
                </div>
              );
            })()}

            <div className="h-72 w-full mt-4">
              {renderPerformanceChartContent()}
            </div>
          </div>

          {isPerformanceZoomed && (
            <div className="fixed inset-0 z-[210] bg-slate-950 flex flex-col pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] animate-in fade-in duration-300">
               <div className="flex justify-between items-center p-6 sm:p-10 shrink-0">
                  <div>
                    <h3 className="text-3xl font-black text-slate-100 tracking-tight uppercase">{selectedExercise}</h3>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Full-Scale Performance Timeline</p>
                  </div>
                  <button onClick={togglePerformanceZoom} className="p-5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-rose-400 rounded-[2rem] transition-all shadow-2xl">
                    <Minimize2 size={28} />
                  </button>
               </div>
               <div className="flex-1 flex flex-col p-6 sm:p-10 min-h-0">
                  <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-[3rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
                       <TrendingUp size={500} />
                    </div>
                    {renderPerformanceChartContent(true)}
                  </div>
                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 px-4">
                     <div className="flex gap-10">
                        <div className="flex flex-col"><span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Data Window</span><span className="text-lg font-black text-slate-100">{chartRange} Strategy</span></div>
                        <div className="flex flex-col"><span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Registers</span><span className="text-lg font-black text-slate-100">{performanceData.length} Session Events</span></div>
                     </div>
                     <div className="flex items-center gap-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] sm:hidden animate-pulse">
                        <RotateCcw size={14} /> Rotate for precision
                     </div>
                  </div>
               </div>
            </div>
          )}

          <div className={isDesktop ? 'flex gap-6 items-start' : 'space-y-6'}>

            {/* Left column — calendar (fixed width on desktop, full width on mobile) */}
            <div className={isDesktop ? 'w-80 shrink-0 space-y-4' : 'space-y-6'}>
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl space-y-6">
                <div className="flex justify-between items-center px-2"><div><h3 className="text-xl font-black text-slate-100 tracking-tight uppercase">{viewDate.toLocaleString('default', { month: 'long' })} {viewDate.getFullYear()}</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">Training Frequency Map</p></div><div className="flex gap-2"><button onClick={() => changeMonth(-1)} className="p-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl shadow-sm"><ChevronLeft size={20}/></button><button onClick={() => changeMonth(1)} className="p-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl shadow-sm"><ChevronRight size={20}/></button></div></div>
                <div className="grid grid-cols-7 gap-2">{['S','M','T','W','T','F','S'].map((d, idx) => <div key={idx} className="text-center text-[11px] font-black text-slate-500 uppercase tracking-widest py-2">{d}</div>)}{calendarDays.map((d, i) => d ? <button key={d.dateStr} onClick={() => setDrillDownDate(d.dateStr)} className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all border ${drillDownDate === d.dateStr ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30' : historyByDate[d.dateStr] ? 'bg-slate-800 border-slate-700 text-slate-100 shadow-sm' : 'border-transparent text-slate-600 hover:text-slate-400'}`}><span className="text-sm font-black">{d.day}</span>{historyByDate[d.dateStr] && drillDownDate !== d.dateStr && <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}</button> : <div key={i} className="aspect-square"></div>)}</div>
              </div>

              {/* Desktop empty state when no date selected */}
              {isDesktop && !drillDownDate && (
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 flex flex-col items-center justify-center gap-3 text-center">
                  <Calendar size={28} className="text-slate-700" />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select a session to drill down</p>
                </div>
              )}
            </div>

            {/* Right column — drill-down detail */}
            <div className={isDesktop ? 'flex-1 min-w-0' : ''}>
              {drillDownDate && historyByDate[drillDownDate] && sessionStats && (
                <div ref={drillDownRef} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl space-y-8 animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-2 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-lg" /> Session Drill-down</h4>
                  <h3 className="text-3xl font-black text-slate-100 tracking-tight">{new Date(drillDownDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsHistoryEditorOpen(true)} className="p-3.5 bg-slate-800 border border-slate-700 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl transition-all shadow-md" title="Edit Session Data"><Edit2 size={20} /></button>
                  <button onClick={handleSaveAsProtocol} className="p-3.5 bg-slate-800 border border-slate-700 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl transition-all shadow-md" title="Archive as Protocol"><ClipboardList size={20} /></button>
                  <button onClick={() => setDrillDownDate(null)} className="p-3.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all shadow-md"><X size={20} /></button>
                </div>
              </div>

              {/* View Type Toggle */}
              <div className="flex p-1.5 bg-slate-950 border border-slate-800 rounded-2xl w-full sm:w-auto self-start shadow-inner">
                <button 
                  onClick={() => setDrillDownSort('protocol')} 
                  className={`flex-1 sm:px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${drillDownSort === 'protocol' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <ListOrdered size={14} /> Protocol
                </button>
                <button 
                  onClick={() => setDrillDownSort('timeline')} 
                  className={`flex-1 sm:px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${drillDownSort === 'timeline' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Timer size={14} /> Timeline
                </button>
              </div>

              {/* Summary Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                 <div className="bg-slate-950 border border-slate-800/80 p-5 rounded-3xl flex flex-col items-center justify-center text-center group shadow-inner">
                    <Weight size={18} className="text-emerald-500 mb-2" />
                    <h5 className="text-2xl font-black text-slate-100 tracking-tighter">{sessionStats.volume.toLocaleString()}</h5>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{weightUnit} Volume</p>
                    {rollingAverages.volume > 0 && (
                      <div className="mt-3 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                          style={{ width: `${Math.min(100, (sessionStats.volume / (userSettings.units === 'imperial' ? rollingAverages.volume * 2.20462 : rollingAverages.volume)) * 100)}%` }}
                        />
                      </div>
                    )}
                 </div>
                 <div className="bg-slate-950 border border-slate-800/80 p-5 rounded-3xl flex flex-col items-center justify-center text-center shadow-inner">
                    <Gauge size={18} className="text-cyan-400 mb-2" />
                    <h5 className="text-2xl font-black text-slate-100 tracking-tighter">{sessionStats.peakE1RM}</h5>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peak {weightUnit}</p>
                 </div>
                 <div className="bg-slate-950 border border-slate-800/80 p-5 rounded-3xl flex flex-col items-center justify-center text-center group relative cursor-help shadow-inner">
                    <Flame size={18} className="text-amber-500 mb-2" />
                    <h5 className="text-2xl font-black text-slate-100 tracking-tighter">{sessionStats.kj}</h5>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">kJ Burned</p>
                 </div>
                 <div className="bg-slate-950 border border-slate-800/80 p-5 rounded-3xl flex flex-col items-center justify-center text-center shadow-inner">
                    <Trophy size={18} className="text-indigo-400 mb-2" />
                    <h5 className="text-2xl font-black text-slate-100 tracking-tighter">{sessionStats.prs}</h5>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PR Count</p>
                 </div>
              </div>

              {/* PR breakdown card — only renders when this session produced at least one PR */}
              {sessionStats.prList && sessionStats.prList.length > 0 && (
                <div className="bg-slate-950 border border-amber-500/25 rounded-3xl p-5 shadow-inner">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Trophy size={15} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest">Personal Records</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">90-day rolling best</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {sessionStats.prList.map(({ exercise, e1rm, delta }) => (
                      <div key={exercise} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl bg-amber-500/5 border border-amber-500/15">
                        <span className="text-[10px] font-black text-slate-200 uppercase tracking-wide truncate">{exercise}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{e1rm}{userSettings.units === 'imperial' ? 'lb' : 'kg'} e1RM</span>
                          <span className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest">+{delta}{userSettings.units === 'imperial' ? 'lb' : 'kg'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Session Summary Card with Caching */}
              <div className="bg-slate-950 border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-all shadow-inner">
                <div className="flex items-center gap-4 mb-4">
                  <button 
                    onClick={handleRedoSummary}
                    disabled={isFetchingSummary}
                    className={`p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-500/20 transition-all hover:bg-emerald-500/30 active:scale-95 disabled:opacity-50 ${isFetchingSummary ? 'animate-spin' : ''}`}
                    title="Redo Analysis"
                  >
                    <Bot size={22} className="text-emerald-400" />
                  </button>
                  <div>
                    <h4 className="text-[12px] font-black text-slate-100 uppercase tracking-widest">Architect's Session Wrap</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">Kinematic Post-Performance Analysis</p>
                  </div>
                </div>
                
                {isFetchingSummary ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin text-emerald-500" size={20} />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ai-loading-pulse">Calculating Volumetric METs...</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-100 leading-relaxed italic font-medium">
                    {sessionSummary || "Analyzing session metrics against longitudinal history..."}
                  </p>
                )}
                
                <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-[0.12] transition-opacity rotate-12">
                  <Sparkles size={50} />
                </div>
              </div>

              <div className="space-y-5">
                {processedDrillDownData?.type === 'protocol' ? (
                  processedDrillDownData.groups.map((group, groupIdx) => (
                    <div key={groupIdx} className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
                        <h5 className="text-[13px] font-black text-slate-100 uppercase tracking-tight">{group.name}</h5>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{group.logs[0].category}</span>
                      </div>
                      <div className="p-5 space-y-3">
                        {group.logs.map((log: any, i) => (
                          <div key={i} className="flex justify-between items-center px-3 py-2 bg-slate-900/20 rounded-xl border border-transparent hover:border-slate-800 transition-colors">
                            <div className="flex items-center gap-4">
                              <span className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-800 shadow-inner">{i + 1}</span>
                              <span className={`text-[15px] font-black tracking-tight ${log.isWarmup || log.isStatisticalWarmup ? 'text-amber-500' : 'text-slate-100'}`}>
                                {isCardioCategory(log.category)
                                  ? `${log.distance ?? log.weight}${log.distanceUnit ?? (log.unit === 'lbs' ? 'mi' : 'km')} @ ${formatDuration(log.duration ?? log.reps)}`
                                  : isAssisted(log.exercise)
                                  ? `↓ ${log.weight}${log.unit} × ${log.reps}`
                                  : `${log.weight}${log.unit} × ${log.reps}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              {(log.isWarmup || log.isStatisticalWarmup) && <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] border border-amber-500/20 px-2 py-0.5 rounded-full bg-amber-500/5">{log.isWarmup ? 'Warmup' : 'Stat-Warmup'}</span>}
                              {isAssisted(log.exercise) && <span className="text-[9px] font-black text-violet-400 uppercase tracking-[0.2em] border border-violet-500/20 px-2 py-0.5 rounded-full bg-violet-500/5">Assisted</span>}
                              {log.completedAt && (
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
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
                  <div className="space-y-8">
                    {processedDrillDownData?.blocks.map((block: any, blockIdx: number) => {
                      if (block.type === 'intermission') {
                        return (
                          <div key={blockIdx} className="flex flex-col items-center py-6 relative">
                            <div className="w-full h-px bg-slate-800 absolute top-1/2 -translate-y-1/2" />
                            <div className="bg-slate-900 border-2 border-slate-800 px-8 py-2.5 rounded-full relative z-10 flex items-center gap-3 shadow-xl">
                              <Clock size={16} className="text-slate-400" />
                              <span className="text-[11px] font-black text-slate-200 uppercase tracking-[0.3em]">Intermission • {formatGapTime(block.gap)}</span>
                            </div>
                          </div>
                        );
                      }

                      const isComplex = block.type === 'complex';
                      
                      return (
                        <React.Fragment key={blockIdx}>
                          <div 
                            className={`bg-slate-950 border rounded-[2rem] overflow-hidden relative transition-all shadow-md ${
                              isComplex 
                                ? 'border-emerald-500/50 ring-2 ring-emerald-500/10 bg-gradient-to-br from-slate-950 to-emerald-950/20' 
                                : 'border-slate-800'
                            }`}
                          >
                            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                {isComplex ? (
                                  <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 border border-emerald-500/20">
                                      <Layers size={14} />
                                    </div>
                                    <h5 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.25em]">Complex Protocol (Superset)</h5>
                                  </div>
                                ) : (
                                  <>
                                    <h5 className="text-[14px] font-black text-slate-100 uppercase tracking-tight">{block.exerciseName}</h5>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">{block.category}</span>
                                  </>
                                )}
                              </div>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {new Date(block.logs[0].completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="p-6 space-y-4 relative">
                              {isComplex && (
                                <div className="absolute left-[33px] top-8 bottom-8 w-px border-l-2 border-dashed border-emerald-500/30" />
                              )}
                              
                              {block.logs.map((log: any, i: number) => (
                                <div key={i} className="flex justify-between items-center px-3 py-2 relative z-10 bg-slate-900/10 rounded-xl border border-transparent hover:border-slate-800/50 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black border transition-all shadow-inner ${
                                      isComplex 
                                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                                        : 'bg-slate-900 border-slate-800 text-slate-400'
                                    }`}>
                                      {i + 1}
                                    </span>
                                    <div className="flex flex-col">
                                      {isComplex && (
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight mb-1">{log.exercise}</span>
                                      )}
                                      <span className={`text-base font-black tracking-tight ${log.isWarmup || log.isStatisticalWarmup ? 'text-amber-500' : 'text-slate-100'}`}>
                                        {isCardioCategory(log.category)
                                          ? `${log.distance ?? log.weight}${log.distanceUnit ?? (log.unit === 'lbs' ? 'mi' : 'km')} @ ${formatDuration(log.duration ?? log.reps)}`
                                          : isAssisted(log.exercise)
                                          ? `↓ ${log.weight}${log.unit} × ${log.reps}`
                                          : `${log.weight}${log.unit} × ${log.reps}`}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    {(log.isWarmup || log.isStatisticalWarmup) && <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] border border-amber-500/20 px-2 py-0.5 rounded-full bg-amber-500/5">{log.isWarmup ? 'Warmup' : 'Stat-Warmup'}</span>}
                                    {isAssisted(log.exercise) && <span className="text-[9px] font-black text-violet-400 uppercase tracking-[0.2em] border border-violet-500/20 px-2 py-0.5 rounded-full bg-violet-500/5">Assisted</span>}
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                      {new Date(log.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Block Transition Indicator */}
                          {block.transitionAfter && block.transitionAfter <= 600 && (
                            <div className="flex items-center gap-4 pl-14 py-2">
                              <div className="w-[2px] h-6 bg-slate-800 rounded-full" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-mono">+ {formatGapTime(block.transitionAfter)} TRANSITION</span>
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
            </div>{/* end right column */}
          </div>{/* end two-column wrapper */}
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
          workoutHistory={history}
          fuelHistory={fuelHistory}
          fuelProfile={fuelProfile}
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
      {morphologyToast && (
        <div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-[70] w-full max-w-sm px-4 animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-slate-900 border border-cyan-500/30 p-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl shrink-0"><Layers size={16} /></div>
            <p className="text-xs font-black text-slate-100">{morphologyToast}</p>
            <button onClick={() => setMorphologyToast(null)} className="ml-auto text-slate-500 hover:text-slate-300 shrink-0"><X size={14} /></button>
          </div>
        </div>
      )}
      
      {activeView === 'biometrics' && (
        <div className="fixed bottom-24 right-6 sm:bottom-28 z-40">
           <button onClick={() => setIsMorphologyOpen(true)} className="p-5 bg-cyan-500 text-slate-950 rounded-full hover:bg-cyan-400 transition-all shadow-2xl shadow-cyan-500/40 active:scale-95 border-4 border-slate-950">
              <Camera size={28} />
           </button>
        </div>
      )}

      {/* ── Exercise Rename Tool ─────────────────────────────────────── */}
      {isRenameToolOpen && selectedExercise && (() => {
        const sessionMap: Record<string, HistoricalLog[]> = {};
        history
          .filter(h => h.exercise === selectedExercise)
          .forEach(h => {
            if (!sessionMap[h.date]) sessionMap[h.date] = [];
            sessionMap[h.date].push(h);
          });
        const sessions: [string, HistoricalLog[]][] = Object.entries(sessionMap)
          .sort(([a], [b]) => b.localeCompare(a));

        const allDates = sessions.map(([d]) => d);
        const allSelected = allDates.length > 0 && allDates.every(d => renameSelectedDates.has(d));

        const toggleDate = (date: string) => {
          setRenameSelectedDates(prev => {
            const next = new Set(prev);
            next.has(date) ? next.delete(date) : next.add(date);
            return next;
          });
        };

        const handleConfirm = () => {
          const trimmed = renameNewName.trim();
          if (!trimmed || trimmed === selectedExercise || renameSelectedDates.size === 0) return;
          onBulkRename(selectedExercise, trimmed, Array.from(renameSelectedDates));
          setSelectedExercise(trimmed);
          setIsRenameToolOpen(false);
        };

        return (
          <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-violet-500/20 rounded-xl border border-violet-500/20"><Tag className="text-violet-400" size={18} /></div>
                  <div>
                    <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight">Relabel Exercise</h3>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-0.5">{sessions.length} sessions · {history.filter(h => h.exercise === selectedExercise).length} sets total</p>
                  </div>
                </div>
                <button onClick={() => setIsRenameToolOpen(false)} className="p-3 bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-200"><X size={18} /></button>
              </div>

              {/* New name input */}
              <div className="px-6 pt-5 pb-4 border-b border-slate-800 shrink-0 space-y-2">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">New name for selected sessions</p>
                <input
                  type="text"
                  value={renameNewName}
                  onChange={e => setRenameNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-black text-slate-100 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 outline-none"
                  placeholder={selectedExercise}
                  autoFocus
                />
                {renameNewName.trim() === selectedExercise && (
                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Name unchanged — edit to create a new label</p>
                )}
              </div>

              {/* Select all / count */}
              <div className="shrink-0 px-6 py-3 border-b border-slate-800 flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{renameSelectedDates.size} of {sessions.length} selected</p>
                <button
                  onClick={() => setRenameSelectedDates(allSelected ? new Set() : new Set(allDates))}
                  className="text-[9px] font-black text-violet-400 uppercase tracking-widest hover:text-violet-300 transition-colors"
                >{allSelected ? 'Deselect All' : 'Select All'}</button>
              </div>

              {/* Session list */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {sessions.map(([date, logs]) => {
                  const isSelected = renameSelectedDates.has(date);
                  const workLogs = logs.filter(l => !l.isWarmup);
                  const peakWeight = workLogs.length > 0 ? Math.max(...workLogs.map(l => l.weight)) : 0;
                  return (
                    <button
                      key={date}
                      onClick={() => toggleDate(date)}
                      className={`w-full flex items-center gap-4 px-6 py-4 border-b border-slate-800/60 transition-all ${isSelected ? 'bg-violet-500/10' : 'hover:bg-slate-800/30'}`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-violet-500 border-violet-400' : 'border-slate-600'}`}>
                        {isSelected && <Check size={12} className="text-slate-950" />}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-black text-slate-100">
                          {new Date(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                          {workLogs.length} work {workLogs.length === 1 ? 'set' : 'sets'}
                          {peakWeight > 0 && !isCardioCategory(logs[0].category) ? ` · ${peakWeight}${logs[0].unit} peak` : ''}
                        </p>
                      </div>
                      <div className={`text-[9px] font-black uppercase tracking-widest transition-colors ${isSelected ? 'text-violet-400' : 'text-slate-700'}`}>
                        {isSelected ? 'Rename' : 'Keep'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-800 bg-slate-950/60 shrink-0 flex gap-3">
                <button
                  onClick={() => setIsRenameToolOpen(false)}
                  className="flex-1 py-4 bg-slate-800 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all"
                >Cancel</button>
                <button
                  onClick={handleConfirm}
                  disabled={!renameNewName.trim() || renameNewName.trim() === selectedExercise || renameSelectedDates.size === 0}
                  className="flex-[2] py-4 bg-violet-500 text-slate-950 font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-violet-500/20 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Relabel {renameSelectedDates.size} {renameSelectedDates.size === 1 ? 'Session' : 'Sessions'}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {isHistoryEditorOpen && drillDownDate && historyByDate[drillDownDate] && (
        <HistoryEditor 
          date={drillDownDate}
          logs={historyByDate[drillDownDate]}
          onClose={() => setIsHistoryEditorOpen(false)}
          onSave={(newLogs: HistoricalLog[]) => {
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