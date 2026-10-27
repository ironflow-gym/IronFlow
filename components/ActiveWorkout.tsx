import { useScrollClearance } from '../src/useScrollClearance';
import Modal, { dialogButton, dialogPrimaryButton } from './ui/Modal';
import SetMarker from './SetMarker';
import IncreaseWeightDialog from './IncreaseWeightDialog';
import SessionAdaptation from './SessionAdaptation';
import { applySessionAdaptation } from '../src/sessionAdaptation';
import { equipmentFor, equipmentStep, equipmentToUnit, adjustEquipmentWeight, formatWeight } from '../src/equipment';
import { constrainRecommendation, getWeightRecommendation } from '../src/progression';
import ProgressionChoices from './ProgressionChoices';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Timer as TimerIcon, Trophy, CheckCircle, Bot, X, History, Loader2, Search, Plus, Globe, Calendar, Sparkles, Wand2, BookOpen, Layers, ChevronRight, RefreshCcw, ArrowRight, Info, ChevronDown, ChevronUp, Minus, Check, Trash2, Settings2, Dumbbell as BarbellIcon, AlertCircle, Maximize2, Timer, TrendingUp, Zap, BookMarked } from 'lucide-react';
import { WorkoutSession, HistoricalLog, Exercise, SetLog, UserSettings, ExerciseLibraryItem } from '../types';
import { GeminiService, GeminiError } from '../services/geminiService';

import { previousSessionSet, repeatPreviousSet } from '../src/workoutLogging';
import { DEFAULT_LIBRARY } from './ExerciseLibrary';
import ExerciseDetailContent from './ExerciseDetailContent';
import LibraryPicker from './LibraryPicker';
import { isCardioCategory, formatDuration, isPR, isAssisted, isTimedExercise } from '../src/utils';

interface ActiveWorkoutProps {
  session: WorkoutSession;
  blockLabel?: string;
  onComplete: (session: WorkoutSession) => void;
  onAbort: () => void;
  onUpdate?: (session: WorkoutSession) => void;
  history: HistoricalLog[];
  aiService: GeminiService;
  userSettings: UserSettings;
  customLibrary: ExerciseLibraryItem[];
  onUpdateCustomLibrary: (lib: ExerciseLibraryItem[]) => void;
  onSaveExerciseRest?: (templateName: string, exerciseName: string, restSeconds: number) => void;
}

/**
 * Plate Solver Constants & Logic
 */
const METRIC_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const IMPERIAL_PLATES = [45, 35, 25, 10, 5, 2.5];

const PLATE_STYLES: Record<number, { color: string, height: string, glow: string }> = {
  // Metric
  25: { color: 'bg-rose-500', height: 'h-16', glow: 'shadow-rose-500/40' },
  20: { color: 'bg-blue-500', height: 'h-14', glow: 'shadow-blue-500/40' },
  15: { color: 'bg-yellow-500', height: 'h-12', glow: 'shadow-yellow-500/40' },
  10: { color: 'bg-emerald-500', height: 'h-10', glow: 'shadow-emerald-500/40' },
  5: { color: 'bg-slate-100', height: 'h-8', glow: 'shadow-slate-100/40' },
  2.5: { color: 'bg-slate-400', height: 'h-6', glow: 'shadow-slate-400/40' },
  1.25: { color: 'bg-slate-500', height: 'h-4', glow: 'shadow-slate-500/40' },
  // Imperial
  45: { color: 'bg-rose-500', height: 'h-16', glow: 'shadow-rose-500/40' },
  35: { color: 'bg-blue-500', height: 'h-14', glow: 'shadow-blue-500/40' },
};

/**
 * KineticInput Component
 */
const KineticInput: React.FC<{
  value: number;
  label: string;
  step: number;
  onOpenPad: () => void;
  onAdjust: (delta: number) => void;
  isWarmup?: boolean;
  displayValue?: string;
}> = ({ value, label, step, onOpenPad, onAdjust, isWarmup, displayValue }) => {
  const timerRef = useRef<number | null>(null);
  const adjustRef = useRef(onAdjust);
  adjustRef.current = onAdjust;
  useEffect(() => () => { if (timerRef.current !== null) clearInterval(timerRef.current); }, []);

  const startAdjusting = (delta: number) => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    adjustRef.current(delta);
    timerRef.current = window.setInterval(() => {
      adjustRef.current(delta);
    }, 150);
  };

  const stopAdjusting = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const adjustButton = (direction: -1 | 1) => (
    <button
      type="button"
      aria-label={`${direction < 0 ? 'Decrease' : 'Increase'} ${label}`}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        startAdjusting(direction * step);
      }}
      onPointerUp={stopAdjusting}
      onPointerCancel={stopAdjusting}
      onLostPointerCapture={stopAdjusting}
      onBlur={stopAdjusting}
      onClick={event => { if (event.detail === 0) adjustRef.current(direction * step); }}
      className={`h-11 sm:h-auto sm:w-11 shrink-0 flex items-center justify-center touch-none border-t sm:border-t-0 border-slate-800/50 text-slate-300 active:bg-slate-800 ${direction < 0 ? 'sm:border-r' : 'border-l'}`}
    >{direction < 0 ? <Minus size={18} /> : <Plus size={18} />}</button>
  );

  return (
    <div className={`flex-1 min-w-0 grid grid-cols-2 sm:flex sm:items-stretch sm:h-14 rounded-xl border overflow-hidden transition-all ${isWarmup ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-950'}`}>
      <div className="hidden sm:contents">{adjustButton(-1)}</div>
      <button type="button" aria-label={`Edit ${label}`} onClick={onOpenPad}
        className="col-span-2 h-11 sm:h-auto sm:flex-1 min-w-0 flex flex-col items-center justify-center px-1 active:bg-slate-900 transition-colors">
        <span className="text-base font-black text-slate-100 leading-none">{displayValue || value || 0}</span>
        <span className="text-[9px] font-black text-slate-400 uppercase mt-1">{label}</span>
      </button>
      <div className="contents sm:hidden">{adjustButton(-1)}</div>
      {adjustButton(1)}
    </div>
  );
};

const ActiveWorkout: React.FC<ActiveWorkoutProps> = ({ session, blockLabel, onComplete, onAbort, onUpdate, history, aiService, userSettings, customLibrary, onUpdateCustomLibrary, onSaveExerciseRest }) => {
  const finishActionRef = useRef<HTMLButtonElement>(null);
  const workoutControlsRef = useRef<HTMLDivElement>(null);
  useScrollClearance(workoutControlsRef, '--workout-header-clearance');
  const [expandedToolsId, setExpandedToolsId] = useState<string>();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [increaseExerciseId, setIncreaseExerciseId] = useState<string | undefined>();
  const [changeExerciseId, setChangeExerciseId] = useState<string | undefined>();
  const [adaptOpen, setAdaptOpen] = useState(false);
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restingExerciseId, setRestingExerciseId] = useState<string | null>(null);
  const [workTimer, setWorkTimer] = useState<number | null>(null);
  const [restLabel, setRestLabel] = useState<string>(session.restLabel || "Rest");
  const [localSession, setLocalSession] = useState<WorkoutSession>(session);
  // Older drafts and manually added exercises have no saved recommendation.
  // Explain a fresh suggestion without altering any existing set values.
  const recommendations = useMemo(() => new Map(localSession.exercises.map(exercise => {
    if (isTimedExercise(exercise) || exercise.progressionMode === 'fixed') return [exercise.id, undefined] as const;
    const unit = exercise.recommendation?.unit ?? exercise.sets.find(set => !set.isWarmup)?.unit ?? (userSettings.units === 'metric' ? 'kgs' : 'lbs');
    const equipment = equipmentFor(exercise.name, customLibrary, unit);
    if (exercise.recommendation?.version === 2) return [exercise.id, constrainRecommendation(exercise.recommendation, exercise.name, unit === 'lbs' ? 'imperial' : 'metric', equipment.weightIncrement, equipment.barWeight, equipment.loadingMode)] as const;
    const recommendation = getWeightRecommendation(unit === 'lbs' ? 'imperial' : 'metric', exercise.name, exercise.category, history, exercise.suggestedWeight ?? exercise.sets.find(set => !set.isWarmup && !set.isDeload)?.weight ?? 0, exercise.targetReps, undefined, localSession.name, exercise.rationale, equipment.weightIncrement, equipment.barWeight, equipment.loadingMode, { templateId: localSession.templateId, workingSets: exercise.sets.filter(s => !s.isWarmup && !s.isDeload).length });
    return [exercise.id, { ...recommendation, unit }] as const;
  })), [localSession.exercises, localSession.name, localSession.templateId, history, customLibrary, userSettings.units]);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<string | null>(null);
  const [viewingDetailsFor, setViewingDetailsFor] = useState<ExerciseLibraryItem | null>(null);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);
  
  useEffect(() => {
    if (!deletingSetId) return;
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') setDeletingSetId(null); };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [deletingSetId]);

  // Plate Solver State
  const exerciseOffsets = useMemo(() => Object.fromEntries(localSession.exercises.flatMap(exercise => {
    const base = equipmentFor(exercise.name, customLibrary, exercise.sets[0]?.unit ?? 'kgs').barWeight;
    return base === undefined ? [] : [[exercise.name, base]];
  })), [localSession.exercises, customLibrary]);
  const [isPlateZoomActive, setIsPlateZoomActive] = useState(false);

  // Neural Pad State
  const [activePad, setActivePad] = useState<{
    exerciseId: string;
    setId: string;
    field: 'weight' | 'reps';
    value: string;
    isFirstPress: boolean;
  } | null>(null);

  // AI Coach state
  const [fetchingAdvice, setFetchingAdvice] = useState<Record<string, boolean>>({});
  
  const workoutStartTimeRef = useRef<number>(session.startTime || Date.now());
  const restEndTimeRef = useRef<number | null>(session.restEndTime || null);
  const restTotalSecsRef = useRef<number>(0); // Original duration when rest started — drives arc progress
  const workStartTimeRef = useRef<number | null>(session.workStartTime || null);
  const lastRemainingRef = useRef<number>(0);
  // Interval countdown: ref to the active exercise id so the tick can read it
  const intervalExerciseIdRef = useRef<string | null>(null);
  // Tracks whether work countdown already fired this interval (prevents double-fire)
  const intervalFiredRef = useRef<boolean>(false);

  const exerciseRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const addMovementRef = useRef<HTMLDivElement>(null);

  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [showRPEModal, setShowRPEModal] = useState(false);
  const [selectedRPE, setSelectedRPE] = useState<number | null>(null);
  const [addMode, setAddMode] = useState<'ai' | 'manual'>('ai');
  const [addPrompt, setAddPrompt] = useState('');
  const [isAiAdding, setIsAiAdding] = useState(false);

  // Interval timer: which exercise has the config panel open
  const [intervalConfigOpen, setIntervalConfigOpen] = useState<string | null>(null);

  // PR tracking — set IDs that beat the 90-day rolling best (≥2 prior sessions)
  const [prSetIds, setPrSetIds] = useState<Set<string>>(new Set());
  const [prResults, setPrResults] = useState<Record<string, { e1rm: number; delta: number }>>({}); 
  const sessionDateStr = useMemo(() => { const d = new Date(session.startTime); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, [session.startTime]);
  const prJustEarnedRef = useRef(false);

  // Keep workStartTimeRef in sync so the timer interval always reads the latest value
  useEffect(() => {
    workStartTimeRef.current = localSession.workStartTime ?? null;
  }, [localSession.workStartTime]);

  // Initial mount: always scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Sync to parent whenever localSession or rest state changes
  useEffect(() => {
    if (onUpdate) {
      onUpdate({
        ...localSession,
        restEndTime: restEndTimeRef.current,
        restLabel: restLabel
      });
    }
  }, [localSession, restLabel, onUpdate]);

  const handleGetAdvice = async (exId: string, exName: string) => {
    if (fetchingAdvice[exId]) return;
    setFetchingAdvice(prev => ({ ...prev, [exId]: true }));
    try {
      const ex = localSession.exercises.find(e => e.id === exId);
      if (!ex) return;
      const completedSets = ex.sets.filter(s => s.completed);
      const advice = await aiService.getExerciseAdvice(exName, completedSets, history);
      alert(advice);
    } catch (e) {
      console.error("Coach failed:", e);
    } finally {
      setFetchingAdvice(prev => ({ ...prev, [exId]: false }));
    }
  };

  const playIntervalEndSound = () => {
    // Double beep — lower frequency, more urgent, signals 'go' or 'stop'
    try {
      if (navigator.vibrate) navigator.vibrate([100, 80, 100]);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (startTime: number, freq: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startTime);
        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
        g.gain.linearRampToValueAtTime(0, startTime + duration);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playTone(now, 660, 0.12);
      playTone(now + 0.18, 880, 0.2);
    } catch (e) {
      console.warn('Interval audio failed', e);
    }
  };

  const playTimerEndSound = () => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playChirp = (startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(880, startTime);
        osc.frequency.exponentialRampToValueAtTime(1760, startTime + duration);
        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(0.6, startTime + 0.02);
        g.gain.linearRampToValueAtTime(0, startTime + duration);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playChirp(now, 0.15);
      playChirp(now + 0.25, 0.15);
      playChirp(now + 0.5, 0.4);
    } catch (e) {
      console.warn("Audio feedback failed", e);
    }
  };

  useEffect(() => {
    let wakeLock: any = null;
    let isActive = true;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && userSettings.enableWakeLock && document.visibilityState === 'visible') {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          if (isActive) { wakeLock = lock; } else { lock.release(); }
        } catch (err) {}
      }
    };
    requestWakeLock();
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isActive = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock !== null) { try { wakeLock.release(); } catch(e) {} }
    };
  }, [userSettings.enableWakeLock]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setWorkoutTimer(Math.floor((now - workoutStartTimeRef.current) / 1000));
      
      if (workStartTimeRef.current) {
        const elapsed = Math.floor((now - workStartTimeRef.current) / 1000);
        setWorkTimer(elapsed);

        // ── Interval countdown: auto-complete set when work phase expires ─
        if (intervalExerciseIdRef.current) {
          setLocalSession(prev => {
            const ex = prev.exercises.find(e => e.id === intervalExerciseIdRef.current);
            const workSecs = ex?.intervalWorkSecs;
            if (workSecs && workSecs > 0 && elapsed >= workSecs && !intervalFiredRef.current) {
              intervalFiredRef.current = true;
              playIntervalEndSound();
              if (navigator.vibrate) navigator.vibrate(50);

              // Find the first incomplete set on this exercise and complete it
              const incompleteSet = ex?.sets.find(s => !s.completed);
              const updatedExercises = prev.exercises.map(e => {
                if (e.id !== intervalExerciseIdRef.current) return e;
                return {
                  ...e,
                  sets: e.sets.map(s => {
                    if (s.id !== incompleteSet?.id) return s;
                    return {
                      ...s,
                      completed: true,
                      timestamp: Date.now(),
                      // Store elapsed work duration in reps field (cardio encoding)
                      reps: workSecs,
                      duration: workSecs,
                    };
                  })
                };
              });

              // Auto-start rest countdown — set ref synchronously here so the
              // next tick picks it up. State setters called outside the updater
              // (below) to avoid calling setState inside a setState updater.
              const restSecs = ex?.intervalRestSecs ?? 0;
              if (restSecs > 0) {
                restEndTimeRef.current = Date.now() + restSecs * 1000;
              }

              // Clear work timer so next interval starts clean on next Start tap
              workStartTimeRef.current = null;

              return { ...prev, exercises: updatedExercises, workStartTime: null };
            }
            return prev;
          });
          // Apply rest state outside the updater (safe to call here — same tick)
          const firedEx = localSession.exercises.find(e => e.id === intervalExerciseIdRef.current);
          const firedRestSecs = firedEx?.intervalRestSecs ?? 0;
          if (intervalFiredRef.current && firedRestSecs > 0) {
            restTotalSecsRef.current = firedRestSecs;
            setRestTimer(firedRestSecs);
            setRestLabel('Interval Rest');
            setRestingExerciseId(null); // interval rest — not a between-sets rest, no save action
          }
        }
      } else {
        setWorkTimer(null);
        intervalExerciseIdRef.current = null;
        intervalFiredRef.current = false;
      }

      if (restEndTimeRef.current !== null) {
        const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - now) / 1000));
        if (remaining === 0 && lastRemainingRef.current > 0) playTimerEndSound();
        lastRemainingRef.current = remaining;
        setRestTimer(remaining);
        if (remaining === 0) restEndTimeRef.current = null;
      } else { lastRemainingRef.current = 0; }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const isAnySetCompleted = useMemo(() => localSession.exercises.some(ex => ex.sets.some(s => s.completed)), [localSession]);

  const isAllSetsCompleted = useMemo(() => {
    if (localSession.exercises.length === 0) return false;
    return localSession.exercises.every(ex => ex.sets.length > 0 && ex.sets.every(s => s.completed));
  }, [localSession]);

  const fullLibrary = useMemo(() => {
    const map = new Map<string, ExerciseLibraryItem>();
    DEFAULT_LIBRARY.forEach(item => map.set(item.name.toLowerCase(), item));
    customLibrary.forEach(item => map.set(item.name.toLowerCase(), item));
    return Array.from(map.values());
  }, [customLibrary]);

  // The badge and explanation share the same complete-exercise calculation.
  const progressionState = useMemo(() => Object.fromEntries([...recommendations.entries()].map(([id, recommendation]) =>
    [id, recommendation?.action === 'reps' ? 'rep' : recommendation?.action === 'starting' ? undefined : recommendation?.action]
  )), [recommendations]);

  const adjustRestTimer = (deltaSecs: number) => {
    if (restTimer === null) return;
    const newSeconds = Math.max(0, restTimer + deltaSecs);
    if (restEndTimeRef.current !== null) {
      // Shift the absolute end-time by the same delta — keeps the countdown consistent
      restEndTimeRef.current = restEndTimeRef.current + deltaSecs * 1000;
    } else if (newSeconds > 0) {
      // Timer had already expired and ref was cleared — create a fresh end-time
      restEndTimeRef.current = Date.now() + newSeconds * 1000;
    }
    setRestTimer(newSeconds);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateSmartRest = (ex: Exercise, set: SetLog) => {
    // Priority: exercise.restSeconds (from template/saved) > global default
    const baseRest = (ex.restSeconds && ex.restSeconds > 0) ? ex.restSeconds : userSettings.defaultRestTimer;
    let multiplier = 1.0;
    let label = "Rest";
    const prescribed = !!(ex.restSeconds && ex.restSeconds > 0);

    const setIndex = ex.sets.findIndex(s => s.id === set.id);
    const nextSet = setIndex >= 0 ? ex.sets[setIndex + 1] : undefined;

    if (set.isWarmup) {
      if (nextSet && !nextSet.isWarmup) {
        multiplier = 1.0;
        label = "Pre-Set Rest";
      } else {
        multiplier = 0.5;
        label = "Warmup Rest";
      }
    } else {
      let lowerBound = 0;
      const rangeMatch = ex.targetReps?.match(/(\d+)\s*-\s*(\d+)/);
      if (rangeMatch) lowerBound = parseInt(rangeMatch[1], 10);
      else lowerBound = Math.max(0, (ex.suggestedReps || 0) - 2);
      // Only extend rest if reps are strictly below the target lower bound.
      // Hitting a 5-rep target exactly does not trigger extended rest.
      if (lowerBound > 0 && set.reps < lowerBound) {
        multiplier = prescribed ? 1.0 : 1.5;
        label = "Intensity Recovery";
      }
    }

    const isLastSet = setIndex === ex.sets.length - 1;
    const isLastExercise = localSession.exercises.findIndex(e => e.id === ex.id) === localSession.exercises.length - 1;
    if (isLastSet && !isLastExercise) {
      multiplier = prescribed ? 1.0 : 2.0; // prescribed rest governs transitions too
      label = "Transition Rest";
    }
    return { seconds: Math.round(baseRest * multiplier), label, prescribed };
  };

  const updateSet = (exerciseId: string, setId: string, updates: Partial<SetLog>) => {
    if (updates.completed === true && navigator.vibrate) {
      navigator.vibrate(50);
    }

    // PR check — runs before state update so we can read current set values cleanly
    if (updates.completed === true) {
      const ex = localSession.exercises.find(e => e.id === exerciseId);
      const set = ex?.sets.find(s => s.id === setId);
      if (ex && set && !set.isWarmup && !set.isDeload && !isTimedExercise(ex) && set.weight > 0 && set.reps > 0) {
        const weightKg = set.unit === 'lbs' ? set.weight * 0.453592 : set.weight;
        const result = isPR(ex.name, weightKg, set.reps, history, sessionDateStr);
        if (result) {
          prJustEarnedRef.current = true;
          setPrSetIds(prev => new Set(prev).add(setId));
          setPrResults(prev => ({ ...prev, [setId]: { e1rm: result.e1rm, delta: result.delta } }));
          if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
        }
      }
    }

    setLocalSession(prev => {
      let isCurrentExFinished = false;
      let newWorkStartTime = prev.workStartTime;

      const updatedExercises = prev.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const isCardio = isTimedExercise(ex);

        const newSets = ex.sets.map(set => {
          if (set.id !== setId) return set;
          const updated = { ...set, ...updates };
          if (isCardio && updates.reps !== undefined && updates.duration === undefined) updated.duration = updates.reps;
          
          if (updates.completed === true) {
            updated.timestamp = Date.now();
            
            // Capture work duration for cardio if timing was active
            if (isCardio && prev.workStartTime) {
              const elapsed = Math.floor((Date.now() - prev.workStartTime) / 1000);
              updated.reps = elapsed; // Store duration in reps field for simplicity or use duration field
              updated.duration = elapsed;
              newWorkStartTime = null;
            }

            const { seconds, label } = calculateSmartRest(ex, updated);
            restEndTimeRef.current = Date.now() + (seconds * 1000);
            restTotalSecsRef.current = seconds;
            setRestTimer(seconds);
            setRestLabel(label);
            setRestingExerciseId(ex.id);
          } else if (updates.completed === false) {
            // If uncompleting a cardio set, maybe restart timer? 
            // For now just clear it
          }
          return updated;
        });
        isCurrentExFinished = newSets.every(s => s.completed);
        const changedSet = ex.sets.find(set => set.id === setId);
        const manualValues = !isCardio && changedSet && !changedSet.isWarmup && !changedSet.isDeload && (updates.weight !== undefined || updates.reps !== undefined);
        const recommendation = ex.recommendation?.version === 2 ? ex.recommendation : recommendations.get(ex.id);
        return { ...ex, sets: newSets, ...(manualValues && recommendation ? { recommendation: { ...recommendation, choice: 'manual' as const, needsStartingLoad: false } } : {}) };
      });

      // If starting a new set for a cardio exercise, start the work timer
      if (!updates.completed && updates.completed !== undefined) {
        // This part is tricky, we need to know if a set was just "activated"
      }

      const newSession = { ...prev, exercises: updatedExercises, workStartTime: newWorkStartTime };
      if (updates.completed === true && isCurrentExFinished) {
        const firstIncomplete = updatedExercises.find(e => e.sets.some(s => !s.completed));
        const scrollDelay = prJustEarnedRef.current ? 2200 : 600;
        prJustEarnedRef.current = false;
        setTimeout(() => {
          if (firstIncomplete) {
            exerciseRefs.current.get(firstIncomplete.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            finishActionRef.current?.focus({ preventScroll: true });
          }
        }, scrollDelay);
      }
      return newSession;
    });
  };

  const removeSet = (exerciseId: string, setId: string) => {
    if (navigator.vibrate) navigator.vibrate([10, 50]);
    setLocalSession(prev => {
      const updated = {
        ...prev,
        exercises: prev.exercises.map(ex => {
          if (ex.id !== exerciseId) return ex;
          return { ...ex, sets: ex.sets.filter(s => s.id !== setId) };
        })
      };
      return updated;
    });
    setDeletingSetId(null);
  };

  const addSet = (exerciseId: string) => {
    setLocalSession(prev => {
      const lastSet = prev.exercises.find(e => e.id === exerciseId)?.sets.slice(-1)[0];
      const ex = prev.exercises.find(e => e.id === exerciseId);
      const newSet: SetLog = {
        id: Math.random().toString(36).substr(2, 9),
        weight: lastSet?.weight || ex?.suggestedWeight || 0,
        reps: lastSet?.reps || ex?.suggestedReps || 10,
        unit: userSettings.units === 'metric' ? 'kgs' : 'lbs',
        timestamp: 0,
        completed: false,
        isWarmup: false
      };
      const updated = {
        ...prev,
        exercises: prev.exercises.map(e => {
          if (e.id !== exerciseId) return e;
          return { ...e, sets: [...e.sets, newSet] };
        })
      };
      return updated;
    });
  };

  const addNewExercise = (item: ExerciseLibraryItem) => {
    const unitPreference = userSettings.units === 'metric' ? 'kgs' : 'lbs';
    const newEx: Exercise = {
      id: Math.random().toString(36).substr(2, 9),
      name: item.name,
      category: item.category,
      primaryMuscle: item.muscles?.[0],
      progressionMode: localSession.progressionMode,
      targetReps: '10-12',
      suggestedWeight: 0,
      suggestedReps: 10,
      rationale: 'Manually added to flow',
      sets: [
        { id: Math.random().toString(36).substr(2, 9), weight: 0, reps: 10, unit: unitPreference, timestamp: 0, completed: false, isWarmup: false }
      ]
    };
    setLocalSession(prev => {
      const updated = { ...prev, exercises: [...prev.exercises, newEx] };
      return updated;
    });
    setIsAddingExercise(false);
  };

  const handleAiAdd = async () => {
    if (!addPrompt.trim()) return;
    setIsAiAdding(true);
    try {
      const libraryNames = fullLibrary.map(l => l.name);
      const result = await aiService.generateProgramFromPrompt(`Add ONE exercise based on: ${addPrompt}. Strictly provide one exercise only.`, history, libraryNames);
      if (result.exercises.length > 0) {
        const item = result.exercises[0];
        const unit = userSettings.units === 'metric' ? 'kgs' : 'lbs';
        const equipment = equipmentFor(item.name, customLibrary, unit);
        const recommendation = isCardioCategory(item.category) || localSession.progressionMode === 'fixed' || item.tracking === 'time' ? { weight: item.suggestedWeight, reps: item.suggestedReps, reason: item.rationale, source: 'routine' as const, hasHistory: false } : getWeightRecommendation(userSettings.units, item.name, item.category, history, item.suggestedWeight, item.targetReps, Date.now(), localSession.name, item.rationale, equipment.weightIncrement, equipment.barWeight, equipment.loadingMode, { templateId: localSession.templateId, workingSets: item.suggestedSets || 3 });
        const newEx: Exercise = {
          id: Math.random().toString(36).substr(2, 9),
          name: item.name,
          category: item.category,
          progressionMode: localSession.progressionMode, tracking: item.tracking,
          targetReps: item.targetReps,
          suggestedWeight: recommendation.weight,
          suggestedReps: recommendation.reps,
          rationale: recommendation.reason,
          ...(!isCardioCategory(item.category) && localSession.progressionMode !== 'fixed' && item.tracking !== 'time' ? { recommendation: { ...recommendation, unit } } : {}),
          sets: Array.from({ length: item.suggestedSets || 3 }).map((_, index) => ({
            id: Math.random().toString(36).substr(2, 9),
            weight: ('sets' in recommendation ? recommendation.sets?.[index]?.weight : undefined) ?? recommendation.weight,
            reps: ('sets' in recommendation ? recommendation.sets?.[index]?.reps : undefined) ?? recommendation.reps,
            unit: userSettings.units === 'metric' ? 'kgs' : 'lbs',
            timestamp: 0,
            completed: false
          }))
        };
        setLocalSession(prev => {
          const updated = { ...prev, exercises: [...prev.exercises, newEx] };
          return updated;
        });
      }
      setIsAddingExercise(false);
      setAddPrompt('');
    } catch (e) {
      alert(e instanceof GeminiError ? e.userMessage : "AI Addition failed");
    } finally {
      setIsAiAdding(false);
    }
  };

  const handlePadPress = (key: string) => {
    if (!activePad) return;
    if (navigator.vibrate) navigator.vibrate(5);
    let newVal = activePad.value;
    let isFirst = activePad.isFirstPress;
    if (key === 'BACK') {
      newVal = newVal.slice(0, -1);
      isFirst = false;
    } else if (key === '.') {
      if (isFirst) newVal = '0.';
      else if (!newVal.includes('.')) newVal += '.';
      isFirst = false;
    } else {
      if (isFirst) newVal = key;
      else {
        if (newVal === '0') newVal = key;
        else newVal += key;
      }
      isFirst = false;
    }
    setActivePad({ ...activePad, value: newVal, isFirstPress: isFirst });
  };

  const commitPad = () => {
    if (!activePad) return;
    let finalValue = parseFloat(activePad.value) || 0;
    
    const ex = localSession.exercises.find(e => e.id === activePad.exerciseId);
    const isCardio = isTimedExercise(ex);

    if (isCardio && activePad.field === 'reps') {
      // Handle MMSS format for cardio duration
      const num = parseInt(activePad.value, 10) || 0;
      const mm = Math.floor(num / 100);
      const ss = num % 100;
      finalValue = (mm * 60) + ss;
    }

    updateSet(activePad.exerciseId, activePad.setId, { [activePad.field]: finalValue });
    setActivePad(null);
    setIsPlateZoomActive(false);
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
  };

  const applyPlate = (delta: number) => {
    if (!activePad) return;
    const current = parseFloat(activePad.value) || 0;
    setActivePad({ ...activePad, value: (current + delta).toString(), isFirstPress: false });
    if (navigator.vibrate) navigator.vibrate(5);
  };

  const activePadUnit = localSession.exercises.find(e => e.id === activePad?.exerciseId)?.sets.find(s => s.id === activePad?.setId)?.unit ?? (userSettings.units === 'metric' ? 'kgs' : 'lbs');
  const plateResult = useMemo(() => {
    if (!activePad || activePad.field !== 'weight') return null;
    const currentTotal = parseFloat(activePad.value) || 0;
    const exName = localSession.exercises.find(e => e.id === activePad.exerciseId)?.name || '';
    const exercise = localSession.exercises.find(e => e.id === activePad.exerciseId);
    const unit = exercise?.sets.find(s => s.id === activePad.setId)?.unit ?? 'kgs';
    const equipment = equipmentFor(exName, customLibrary, unit);
    const paired = equipment.loadingMode === 'paired';
    const offset = equipment.barWeight ?? 0;
    if (currentTotal <= offset) return { plates: [], remainder: 0, paired };
    let targetPerSide = (currentTotal - offset) / (paired ? 2 : 1);
    const configured = equipment.weightIncrement !== undefined || equipment.barWeight !== undefined;
    const rawDenoms = configured ? METRIC_PLATES.map(kg => equipmentToUnit(kg, unit)!) : unit === 'kgs' ? METRIC_PLATES : IMPERIAL_PLATES;
    const step = equipment.weightIncrement;
    const denoms = step ? [...new Set([...rawDenoms.filter(d => Math.abs(d / step - Math.round(d / step)) < 1e-6), step])].sort((a, b) => b - a) : rawDenoms;
    const result: number[] = [];
    for (const d of denoms) {
      while (targetPerSide >= d - 0.01) {
        result.push(d);
        targetPerSide -= d;
      }
    }
    return { plates: result, remainder: Math.round(targetPerSide * 100) / 100, paired };
  }, [activePad, exerciseOffsets, userSettings.units, localSession.exercises, customLibrary]);

  return (
    <div className="workout-session space-y-3 pb-8">
      {localSession.exercises.some(e => e.sets.some(s => s.unit !== (userSettings.units === 'metric' ? 'kgs' : 'lbs'))) && <p className="mb-3 text-xs text-slate-400">This workout keeps its recorded units; your unit preference applies to new workouts.</p>}
      {!!localSession.adaptations?.length && <details className="mb-4 rounded-xl border border-emerald-500/30 p-3 text-sm"><summary className="cursor-pointer text-emerald-300 font-bold">Changes made ({localSession.adaptations.length})</summary><p className="my-2 text-xs text-slate-400">Current workout only; routine defaults unchanged.</p><ul className="space-y-1">{localSession.adaptations.flatMap(a => a.changes).map((change, i) => <li key={i}>{change}</li>)}</ul></details>}
      {adaptOpen && <SessionAdaptation initialExerciseId={changeExerciseId} onSuggestAlternatives={exercise => aiService.suggestSwaps(exercise.name, exercise.category)} session={localSession} library={fullLibrary} defaultRest={userSettings.defaultRestTimer} onClose={() => setAdaptOpen(false)} onApply={proposal => {
        const adapted = applySessionAdaptation(localSession, proposal);
        setLocalSession(adapted);
        setAdaptOpen(false);
      }} />}
      {activePad && <Modal label={isTimedExercise(localSession.exercises.find(e => e.id === activePad.exerciseId)) && activePad.field === 'reps' ? 'Adjust Time (MMSS)' : `Adjust ${activePad.field}`} title={isTimedExercise(localSession.exercises.find(e => e.id === activePad.exerciseId)) && activePad.field === 'reps' ? 'Adjust Time (MMSS)' : `Adjust ${activePad.field}`} closeLabel="Close value editor" suspended={isPlateZoomActive} onClose={() => { setActivePad(null); setIsPlateZoomActive(false); }} footer={<><button className={dialogButton} onClick={() => setActivePad(null)}>Cancel</button><button className={dialogPrimaryButton} onClick={commitPad}>Apply value</button></>}>
        <p className="mb-4 text-3xl font-bold">{isTimedExercise(localSession.exercises.find(e => e.id === activePad.exerciseId)) && activePad.field === 'reps' ? (activePad.value.length > 2 ? `${activePad.value.slice(0, -2)}:${activePad.value.slice(-2).padStart(2, '0')}` : activePad.value || '0') : activePad.value || '0'} <span className="text-base text-slate-400">{activePad.field === 'weight' ? (isCardioCategory(localSession.exercises.find(e => e.id === activePad.exerciseId)?.category ?? '') ? 'Dist/Int' : activePadUnit === 'kgs' ? 'kg' : 'lb') : isTimedExercise(localSession.exercises.find(e => e.id === activePad.exerciseId)) ? '' : 'reps'}</span></p>
            {/* Context Panel */}
            <div className="space-y-6 animate-in fade-in duration-300">
              <>
                  {activePad.field === 'weight' && (
                    <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-slate-300">Plate loading</summary><button aria-label="View plate loading details"
                      onClick={() => setIsPlateZoomActive(true)}
                      className="relative w-full h-24 bg-slate-950 border border-slate-800 rounded-3xl flex items-center justify-center overflow-hidden shadow-inner px-8 active:scale-[0.98] transition-all group"
                    >
                      {plateResult && plateResult.plates.length > 0 ? (
                        <div className="flex flex-col items-center w-full">
                          <div className="flex items-center gap-1.5 relative">
                            <div className="absolute left-[-15px] right-[-15px] h-1.5 bg-slate-800 rounded-full top-1/2 -translate-y-1/2 -z-10" />
                            {plateResult.plates.map((p, i) => (
                              <div key={i} className={`w-3 ${PLATE_STYLES[p]?.color || 'bg-slate-500'} ${PLATE_STYLES[p]?.height || 'h-10'} rounded-md shadow-lg flex items-center justify-center transition-all animate-in zoom-in-50 duration-300`}>
                                <span className="text-[6px] font-black text-slate-950/60 rotate-90">{p}</span>
                              </div>
                            ))}
                            {plateResult.remainder > 0 && (
                              <div className="ml-2 p-1.5 bg-rose-500/10 rounded-lg"><AlertCircle size={14} className="text-rose-500" /></div>
                            )}
                          </div>
                          <div className="mt-4 flex gap-4 text-[9px] font-black text-slate-500 uppercase tracking-widest items-center">
                            <span>{plateResult.paired ? 'LOAD PER SIDE' : 'TOTAL ADDED LOAD'}</span>
                            <span className="text-slate-700">|</span>
                            <span className="text-emerald-500/80">{plateResult.remainder > 0 ? `+${plateResult.remainder} UNRESOLVED` : 'EXACT LOAD'}</span>
                            <div className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 size={10} className="text-cyan-400" /></div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <BarbellIcon className="text-slate-600" size={24} />
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Starting weight only</p>
                        </div>
                      )}
                    </button></details>
                  )}

                  {activePad.field === 'weight' && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {[1.25, 2.5, 5, 10, 20].map(p => (
                        <button key={p} onClick={() => applyPlate(p)} className="shrink-0 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest active:bg-emerald-500 active:text-slate-950 transition-colors">+{p}</button>
                      ))}
                    </div>
                  )}
                  {/* Duration presets for cardio time field */}
                  {activePad.field === 'reps' && isTimedExercise(localSession.exercises.find(e => e.id === activePad.exerciseId)) && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {[
                        { label: '10m', secs: 600 },
                        { label: '15m', secs: 900 },
                        { label: '20m', secs: 1200 },
                        { label: '30m', secs: 1800 },
                        { label: '45m', secs: 2700 },
                        { label: '60m', secs: 3600 },
                        { label: '90m', secs: 5400 },
                      ].map(({ label, secs }) => (
                        <button
                          key={label}
                          onClick={() => {
                            // Store as raw seconds — commitPad will NOT apply MMSS
                            // conversion since we're setting the value directly.
                            // Use a sentinel prefix 'P:' to distinguish preset from typed.
                            // Simpler: just call updateSet directly and close pad.
                            updateSet(activePad.exerciseId, activePad.setId, { reps: secs });
                            setActivePad(null);
                            if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
                          }}
                          className="shrink-0 px-4 py-3 bg-violet-500/20 border border-violet-500/30 rounded-xl text-[10px] font-black text-violet-300 uppercase tracking-widest active:bg-violet-500 active:text-slate-950 transition-colors"
                        >{label}</button>
                      ))}
                    </div>
                  )}
              </>

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'BACK'].map(k => (
                  <button key={k} aria-label={k === 'BACK' ? 'Backspace' : undefined} onClick={() => handlePadPress(k.toString())} className={`h-12 rounded-xl flex items-center justify-center text-xl font-black transition-all active:scale-95 ${k === 'BACK' ? 'bg-slate-800 text-rose-400' : 'bg-slate-800/50 text-slate-100 hover:bg-slate-800'}`}>
                    {k === 'BACK' ? <RefreshCcw size={20} className="rotate-[-90deg]" /> : k}
                  </button>
                ))}
              </div>
            </div>

      </Modal>}

      {isPlateZoomActive && activePad && <Modal label="Plate loading" title="Plate loading" closeLabel="Close plate loading" onClose={() => setIsPlateZoomActive(false)} footer={<button className={dialogButton} onClick={() => setIsPlateZoomActive(false)}>Done</button>}>
        <p className="mb-3 text-xl font-bold">{activePad.value} {activePadUnit === 'kgs' ? 'kg' : 'lb'} total</p>
        <p className="mb-3 text-sm text-slate-300">{plateResult?.paired ? 'Plates per side' : 'Total added plates'}</p>
        <div className="flex flex-wrap gap-2">{plateResult?.plates.map((plate, index) => <span key={index} className={`rounded-xl border border-white/20 px-4 py-3 font-bold text-white ${PLATE_STYLES[plate]?.color ?? 'bg-slate-600'}`}>{plate}</span>)}</div>
        <p className="mt-4 text-sm text-slate-300">Starting weight: {exerciseOffsets[localSession.exercises.find(e => e.id === activePad.exerciseId)?.name || ''] ?? 0} {activePadUnit === 'kgs' ? 'kg' : 'lb'}.</p>
        {!!plateResult?.remainder && <p className="mt-3 text-sm text-amber-200">Unallocated load: {plateResult.remainder} {activePadUnit === 'kgs' ? 'kg' : 'lb'}. Check the equipment settings.</p>}
      </Modal>}

      <div ref={workoutControlsRef} className="sticky top-0 z-40 space-y-1 bg-slate-950 py-1" data-testid="workout-controls">
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-2 py-1">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold" title={localSession.name}>{localSession.name}</p>{blockLabel && <p className="truncate text-xs text-emerald-300" title={blockLabel}>{blockLabel}</p>}</div>
          <span aria-label="Workout duration" className="shrink-0 text-xs font-mono text-slate-300">{formatTime(workoutTimer)}</span>
          <button type="button" aria-label="Adapt this workout" title="Adapt this workout" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-600 text-emerald-300" onClick={() => { setChangeExerciseId(undefined); setAdaptOpen(true); }}><Wand2 size={18} /></button>
          <button ref={finishActionRef} aria-description={isAllSetsCompleted ? 'All sets complete' : undefined} aria-label={isAnySetCompleted ? 'Finish workout' : 'Discard workout'} onClick={isAnySetCompleted ? () => { setSelectedRPE(null); setShowRPEModal(true); } : () => setDiscardOpen(true)} className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold ${isAnySetCompleted ? 'bg-emerald-500 text-slate-950' : 'border border-slate-600 text-slate-300'}`}>{isAnySetCompleted ? 'Finish' : 'Discard'}</button>
        </div>
          {workTimer !== null && (() => {
            const activeEx = intervalExerciseIdRef.current
              ? localSession.exercises.find(e => e.id === intervalExerciseIdRef.current)
              : null;
            const workSecs = activeEx?.intervalWorkSecs ?? 0;
            const isCountdown = workSecs > 0;
            // displayTime counts down in interval mode, up in plain cardio mode.
            // isExpired is unreachable in auto-complete mode (workStartTime clears
            // when the set completes), but kept for safety.
            const displayTime = isCountdown ? Math.max(0, workSecs - workTimer) : workTimer;
            return (
              <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${
                isCountdown
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/30 animate-pulse'
                  : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse'
              }`}>
                <div className="text-right">
                  <p className="text-standard-label font-black uppercase">
                    {isCountdown ? 'Work' : 'Active Set'}
                  </p>
                  <p className="text-xl font-mono font-black">{formatTime(displayTime)}</p>
                </div>
                <button
                  onClick={() => {
                    intervalExerciseIdRef.current = null;
                    intervalFiredRef.current = false;
                    setLocalSession(prev => ({ ...prev, workStartTime: null }));
                  }}
                  className="p-1"
                ><X size={18}/></button>
              </div>
            );
          })()}
        {restTimer !== null && <div data-testid="rest-timer" className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${restTimer === 0 ? 'border-rose-500/50 bg-rose-950 text-rose-200' : 'border-emerald-500/40 bg-slate-900 text-emerald-300'}`}>
          <div className="min-w-0 flex-1" title={`${restLabel} · ${localSession.exercises.find(e => e.id === restingExerciseId)?.name ?? ''}`}><p className="truncate text-[11px] font-bold">{restLabel}</p><p className="font-mono text-lg leading-tight" role="timer">{formatTime(restTimer)}</p></div>
          <button type="button" className="h-11 w-11 shrink-0 rounded-lg border border-slate-600 text-xs font-bold" aria-label="Remove 15 seconds" onClick={() => adjustRestTimer(-15)}>−15</button>
          <button type="button" className="h-11 w-11 shrink-0 rounded-lg border border-slate-600 text-xs font-bold" aria-label="Add 15 seconds" onClick={() => adjustRestTimer(15)}>+15</button>
          {onSaveExerciseRest && restingExerciseId && <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-600" aria-label="Save rest to protocol" onClick={() => { const exercise = localSession.exercises.find(e => e.id === restingExerciseId); if (exercise) onSaveExerciseRest(localSession.name, exercise.name, exercise.restSeconds || restTotalSecsRef.current); }}><BookMarked size={17} /></button>}
          <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-600" aria-label="Dismiss rest timer" onClick={() => { restEndTimeRef.current = null; setRestTimer(null); setRestingExerciseId(null); }}><X size={18} /></button>
        </div>}
      </div>

      <div className="workout-exercises space-y-3">
        {localSession.exercises.map(exercise => {
          const isInteracting = activePad?.exerciseId === exercise.id || (deletingSetId && exercise.sets.some(s => s.id === deletingSetId));
          const hasStarted = exercise.sets.some(s => s.completed);
          const isFinished = exercise.sets.every(s => s.completed);
          const isActive = isInteracting || (hasStarted && !isFinished);
          const nextPrescribedId = localSession.exercises.find(ex => !ex.sets.some(s => s.completed))?.id;
          const isNext = !isActive && !isFinished && nextPrescribedId === exercise.id;
          const borderClass = isActive ? 'border-cyan-500/50 ring-2 ring-cyan-500/10' : (isFinished ? 'border-emerald-500/40' : (isNext ? 'border-emerald-500/40 border-dashed' : 'border-slate-800'));
          const opacityClass = 'opacity-100';
          const isCardio = isTimedExercise(exercise);
          const comparisons = isCardio ? [] : exercise.sets.map((set, index) => previousSessionSet(history, exercise, index, set.unit, sessionDateStr));
          const previousDate = comparisons.find((entry, index) => entry && !exercise.sets[index].isWarmup && !exercise.sets[index].isDeload)?.date ?? comparisons.find(Boolean)?.date;

          return (
            <div key={exercise.id} data-workout-exercise ref={el => { if (el) exerciseRefs.current.set(exercise.id, el); else exerciseRefs.current.delete(exercise.id); }} className={`bg-slate-900 border rounded-3xl overflow-hidden shadow-2xl scroll-mt-3 transition-all duration-500 ${borderClass} ${opacityClass}`}>
              <div className="border-b border-slate-800 bg-slate-900/50">
                <div className="py-2 px-3 flex flex-wrap justify-between items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-x-2 flex-wrap">
                      <h3 className="break-words text-sm font-bold text-slate-100 leading-snug">{exercise.name}</h3>
                      <span className="hidden sm:inline text-standard-label text-slate-400 mb-0.5">{exercise.category}</span>
                      {exercise.targetReps && !isCardio && (
                        <span className="text-[9px] font-black text-emerald-400/70 uppercase tracking-widest border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded-md mb-0.5">{exercise.targetReps} reps</span>
                      )}
                      {!isCardio && progressionState[exercise.id] === 'increase' && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-0.5 border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                          <TrendingUp size={9} />{isAssisted(exercise.name) ? 'less assistance' : 'weight up'}
                        </span>
                      )}
                      {!isCardio && progressionState[exercise.id] === 'rep' && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-0.5 border border-cyan-500/30 bg-cyan-500/8 text-cyan-400 flex items-center gap-1">
                          <TrendingUp size={9} />+1 rep
                        </span>
                      )}
                      {!isCardio && progressionState[exercise.id] === 'hold' && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-0.5 border border-amber-500/30 bg-amber-500/8 text-amber-400">
                          hold
                        </span>
                      )}
                      {isCardio && !isFinished && (
                        <>
                          <button
                            onClick={() => {
                              const starting = !localSession.workStartTime;
                              if (starting) {
                                intervalExerciseIdRef.current = exercise.id;
                                intervalFiredRef.current = false;
                              } else {
                                intervalExerciseIdRef.current = null;
                                intervalFiredRef.current = false;
                              }
                              setLocalSession(prev => ({ ...prev, workStartTime: starting ? Date.now() : null }));
                            }}
                            className={`min-h-11 text-xs font-bold px-2 rounded-md border transition-all flex items-center gap-1 ml-2 ${localSession.workStartTime && intervalExerciseIdRef.current === exercise.id ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'}`}
                          >
                            {localSession.workStartTime && intervalExerciseIdRef.current === exercise.id
                              ? <><X size={10} /> Stop</>
                              : <><Timer size={10} /> Start</>}
                          </button>
                          <button
                            onClick={() => setIntervalConfigOpen(intervalConfigOpen === exercise.id ? null : exercise.id)}
                            className={`min-h-11 text-xs font-bold px-2 rounded-md border transition-all flex items-center gap-1 ml-1 ${
                              (exercise.intervalWorkSecs ?? 0) > 0
                                ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                                : intervalConfigOpen === exercise.id
                                ? 'bg-slate-700 border-slate-600 text-slate-300'
                                : 'border-slate-700 text-slate-600 hover:text-slate-400'
                            }`}
                            title="Configure interval timer"
                          >
                            <Settings2 size={10} />
                            {(exercise.intervalWorkSecs ?? 0) > 0
                              ? `${exercise.intervalWorkSecs}s/${exercise.intervalRestSecs ?? 0}s`
                              : 'Interval'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button aria-label={`Change exercise for ${exercise.name}`} title={hasStarted ? 'Completed sets keep their exercise' : 'Change exercise'} disabled={hasStarted} onClick={() => { setChangeExerciseId(exercise.id); setAdaptOpen(true); }} className="flex h-11 w-11 items-center justify-center bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-emerald-400"><RefreshCcw size={18} /></button>
                    {!isCardioCategory(exercise.category) && <button type="button" aria-label={`${isAssisted(exercise.name) ? 'Reduce assistance' : 'Increase weight'} for ${exercise.name}`} title={isAssisted(exercise.name) ? 'Reduce assistance' : 'Increase weight'}
                      disabled={!exercise.sets.some(set => !set.completed && !set.isWarmup && !set.isDeload)} onClick={() => setIncreaseExerciseId(exercise.id)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-emerald-400">
                      <span className="relative h-7 w-7" aria-hidden="true"><BarbellIcon size={23} className="absolute left-0.5 top-0.5" /><svg viewBox="0 0 28 28" className="absolute inset-0 h-7 w-7 fill-none stroke-red-400" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 23 11 15 17 17 25 6M19 6h6v6" /></svg></span>
                    </button>}
                    <button type="button" aria-label={`More options for ${exercise.name}`} aria-expanded={expandedToolsId === exercise.id} onClick={() => setExpandedToolsId(previous => previous === exercise.id ? undefined : exercise.id)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 text-lg">•••</button>
                  </div>
                </div>
                {expandedToolsId === exercise.id && <div className="flex flex-wrap items-center gap-1 border-t border-slate-800 px-3 py-1"><button aria-label={`Get coaching advice for ${exercise.name}`} title="Coaching advice" onClick={() => handleGetAdvice(exercise.id, exercise.name)} className={`h-11 w-11 flex items-center justify-center rounded-lg transition-all ${fetchingAdvice[exercise.id] ? 'text-emerald-500 animate-spin' : 'text-emerald-400 hover:bg-slate-700'}`} disabled={fetchingAdvice[exercise.id]}><Bot size={16} /></button>
                      <button aria-label={`View history for ${exercise.name}`} title="Exercise history" onClick={() => setViewingHistoryFor(exercise.name)} className="h-11 w-11 flex items-center justify-center text-cyan-400 hover:bg-slate-700 rounded-lg transition-all"><History size={16} /></button>
                      <button aria-label={`View instructions for ${exercise.name}`} title="Instructions and equipment" onClick={() => setViewingDetailsFor(fullLibrary.find(i => i.name === exercise.name) || null)} className="h-11 w-11 flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-all"><BookOpen size={16} /></button>
                    </div>}
                <ProgressionChoices exercise={{ ...exercise, rationale: exercise.recommendation && exercise.recommendation.version !== 2 ? undefined : exercise.rationale, recommendation: recommendations.get(exercise.id) }} onChange={updated => setLocalSession(prev => ({ ...prev, exercises: prev.exercises.map(e => e.id === exercise.id ? updated : e) }))} />
                {exercise.progressionMode === 'fixed' && <p className="mx-4 mb-3 text-xs text-slate-300">Fixed target · {exercise.targetReps}</p>}
                {!recommendations.get(exercise.id) && exercise.rationale && <details className="mx-4 mb-4 rounded-xl border border-slate-700 px-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold">Exercise notes</summary><p className="pb-3 text-sm text-slate-300">{exercise.rationale}</p></details>}
              </div>
              {/* Equipment config nudge — shown for non-cardio exercises where barWeight
                  has not yet been set. Tapping opens the detail screen directly. Only
                  shown before the first set is completed to avoid mid-set interruption. */}
              {!isCardio && !hasStarted && exerciseOffsets[exercise.name] === undefined && (
                <button
                  onClick={() => setViewingDetailsFor(fullLibrary.find(i => i.name === exercise.name) || null)}
                  title="Configure starting weight and increments" className="min-h-11 w-full flex items-center gap-2 px-4 py-2 border-t border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 transition-colors text-left"
                >
                  <Settings2 size={12} className="text-cyan-500/70 shrink-0" />
                  <p className="text-xs font-semibold text-slate-300">Set equipment weights</p>
                </button>
              )}
              {/* Interval config panel */}
              {isCardio && intervalConfigOpen === exercise.id && (
                <div className="px-5 pb-4 pt-3 border-t border-slate-800 bg-slate-900/60 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-[9px] font-black text-violet-400 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                    <Timer size={10} /> Interval Protocol
                  </p>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Work (sec)</p>
                      <div className="flex items-stretch h-10 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden focus-within:border-violet-500/40 transition-colors">
                        <button
                          onPointerDown={() => {
                            const cur = exercise.intervalWorkSecs ?? 20;
                            setLocalSession(prev => ({ ...prev, exercises: prev.exercises.map(e => e.id === exercise.id ? { ...e, intervalWorkSecs: Math.max(5, cur - 5) } : e) }));
                          }}
                          className="w-9 flex items-center justify-center text-slate-500 hover:text-rose-400 border-r border-slate-800 transition-colors shrink-0"
                        ><Minus size={14} /></button>
                        <input
                          type="number"
                          min={5}
                          max={300}
                          value={exercise.intervalWorkSecs ?? 20}
                          onChange={(e) => {
                            const val = Math.min(300, Math.max(5, parseInt(e.target.value) || 5));
                            setLocalSession(prev => ({ ...prev, exercises: prev.exercises.map(ex => ex.id === exercise.id ? { ...ex, intervalWorkSecs: val } : ex) }));
                          }}
                          className="flex-1 min-w-0 bg-transparent text-sm font-black text-slate-100 text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onPointerDown={() => {
                            const cur = exercise.intervalWorkSecs ?? 20;
                            setLocalSession(prev => ({ ...prev, exercises: prev.exercises.map(e => e.id === exercise.id ? { ...e, intervalWorkSecs: Math.min(300, cur + 5) } : e) }));
                          }}
                          className="w-9 flex items-center justify-center text-slate-500 hover:text-emerald-400 border-l border-slate-800 transition-colors shrink-0"
                        ><Plus size={14} /></button>
                      </div>
                    </div>
                    <div className="text-slate-700 font-black text-lg pt-4">/</div>
                    <div className="flex-1">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Rest (sec)</p>
                      <div className="flex items-stretch h-10 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden focus-within:border-violet-500/40 transition-colors">
                        <button
                          onPointerDown={() => {
                            const cur = exercise.intervalRestSecs ?? 10;
                            setLocalSession(prev => ({ ...prev, exercises: prev.exercises.map(e => e.id === exercise.id ? { ...e, intervalRestSecs: Math.max(0, cur - 5) } : e) }));
                          }}
                          className="w-9 flex items-center justify-center text-slate-500 hover:text-rose-400 border-r border-slate-800 transition-colors shrink-0"
                        ><Minus size={14} /></button>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={exercise.intervalRestSecs ?? 10}
                          onChange={(e) => {
                            const val = Math.min(300, Math.max(0, parseInt(e.target.value) || 0));
                            setLocalSession(prev => ({ ...prev, exercises: prev.exercises.map(ex => ex.id === exercise.id ? { ...ex, intervalRestSecs: val } : ex) }));
                          }}
                          className="flex-1 min-w-0 bg-transparent text-sm font-black text-slate-100 text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onPointerDown={() => {
                            const cur = exercise.intervalRestSecs ?? 10;
                            setLocalSession(prev => ({ ...prev, exercises: prev.exercises.map(e => e.id === exercise.id ? { ...e, intervalRestSecs: Math.min(300, cur + 5) } : e) }));
                          }}
                          className="w-9 flex items-center justify-center text-slate-500 hover:text-emerald-400 border-l border-slate-800 transition-colors shrink-0"
                        ><Plus size={14} /></button>
                      </div>
                    </div>
                    <div className="pt-4">
                      <button
                        onClick={() => setLocalSession(prev => ({ ...prev, exercises: prev.exercises.map(e => e.id === exercise.id ? { ...e, intervalWorkSecs: undefined, intervalRestSecs: undefined } : e) }))}
                        className="h-10 px-3 rounded-xl border border-slate-800 text-slate-600 hover:text-rose-400 hover:border-rose-500/30 transition-all text-[9px] font-black uppercase tracking-widest"
                        title="Clear interval config"
                      ><X size={12} /></button>
                    </div>
                  </div>
                  <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mt-2">
                    Set auto-logs at {exercise.intervalWorkSecs ?? 20}s · rest starts automatically
                  </p>
                </div>
              )}

              <div className="p-3 max-[340px]:p-1 space-y-2">
                {!isCardio && previousDate && <p className="text-xs text-slate-400">Previous session: {previousDate}</p>}
                {exercise.sets.map((set, i) => (
                  <div key={set.id} data-testid={`set-${set.id}`}>
                    <div className={`flex items-center gap-2 max-[340px]:gap-1 sm:gap-3 transition-all ${set.completed ? 'rounded-xl bg-emerald-500/5' : ''}`}>
                      <SetMarker set={set} number={i + 1} exerciseName={exercise.name} armed={deletingSetId === set.id}
                        onArmDelete={() => setDeletingSetId(set.id)} onCancelDelete={() => setDeletingSetId(null)}
                        onCycle={() => { setDeletingSetId(null); updateSet(exercise.id, set.id, { isWarmup: !set.isWarmup && !set.isDeload, isDeload: !!set.isWarmup }); }} />
                      <div className="flex-1 flex gap-1.5 max-[340px]:gap-0 sm:gap-2 min-w-0">
                        <KineticInput 
                          value={set.weight} 
                          label={isCardioCategory(exercise.category) ? 'Dist/Int' : (set.unit === 'kgs' ? 'kg' : 'lb')}
                          step={isCardioCategory(exercise.category) ? 0.1 : equipmentStep(equipmentFor(exercise.name, customLibrary, set.unit).weightIncrement, equipmentFor(exercise.name, customLibrary, set.unit).loadingMode === 'paired', set.unit === 'kgs' ? 1.25 : 2.5)}
                          displayValue={!isCardioCategory(exercise.category) ? formatWeight(set.weight) : undefined}
                          isWarmup={set.isWarmup || set.isDeload} 
                          onAdjust={(d) => updateSet(exercise.id, set.id, { weight: isCardioCategory(exercise.category) ? Math.max(0, set.weight + d) : adjustEquipmentWeight(set.weight, d, exercise.name, customLibrary, set.unit) })}
                          onOpenPad={() => setActivePad({ exerciseId: exercise.id, setId: set.id, field: 'weight', value: set.weight.toString(), isFirstPress: true })}
                        />
                        <KineticInput 
                          value={set.reps} 
                          label={isCardio ? 'Time' : 'reps'} 
                          step={isCardio ? 5 : 1} 
                          isWarmup={set.isWarmup || set.isDeload} 
                          displayValue={isCardio ? formatDuration(set.reps) : undefined}
                          onAdjust={(d) => updateSet(exercise.id, set.id, { reps: Math.max(0, set.reps + d) })} 
                          onOpenPad={() => setActivePad({ exerciseId: exercise.id, setId: set.id, field: 'reps', value: isCardio ? String(Math.floor(set.reps / 60) * 100 + set.reps % 60) : set.reps.toString(), isFirstPress: true })}
                        />
                      </div>
                      <button aria-label={`${deletingSetId === set.id ? 'Delete' : set.completed ? 'Uncomplete' : 'Complete'} set ${i + 1} for ${exercise.name}`} onClick={() => { if (deletingSetId === set.id && !set.completed) removeSet(exercise.id, set.id); else { setDeletingSetId(null); updateSet(exercise.id, set.id, { completed: !set.completed }); } }} className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border transition-all shrink-0 ${deletingSetId === set.id ? 'bg-rose-500 border-rose-400 text-slate-950' : set.completed ? 'bg-emerald-500 border-emerald-400 text-slate-950 scale-90' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                        {deletingSetId === set.id ? <Trash2 size={24} /> : set.completed ? <Check size={24} /> : <CheckCircle size={24} className="opacity-20" />}
                      </button>
                    </div>
                    {!isCardio && ((i > 0 && !set.completed) || !!comparisons[i]) && (
                      <div className="ml-12 flex min-h-11 items-center justify-between gap-2 text-xs">
                        <span className="text-slate-400">
                          {(() => {
                            const previous = comparisons[i];
                            return previous ? `Previous${previous.date !== previousDate ? ` (${previous.date})` : ''}: ${previous.displayWeight} ${set.unit === 'lbs' ? 'lb' : 'kg'} × ${previous.reps}` : '';
                          })()}
                        </span>
                        {i > 0 && !set.completed && <button type="button" className="min-h-11 rounded-xl border border-slate-700 px-3 text-slate-200 hover:border-emerald-500"
                          aria-label={`Copy ${exercise.sets[i - 1]?.isWarmup ? 'warmup' : exercise.sets[i - 1]?.isDeload ? 'deload' : 'working set'} ${i} to set ${i + 1} of ${exercise.name}`}
                          onClick={() => { const values = repeatPreviousSet(exercise, i); if (values) updateSet(exercise.id, set.id, values); }}>
                          Copy {exercise.sets[i - 1]?.isWarmup ? 'warmup' : exercise.sets[i - 1]?.isDeload ? 'deload' : 'set'} {i}
                        </button>}
                      </div>
                    )}
                    {!set.isWarmup && !set.isDeload && prSetIds.has(set.id) && prResults[set.id] && (() => {
                      const isImperial = userSettings.units === 'imperial';
                      const displayE1RM = isImperial ? Math.round(prResults[set.id].e1rm * 2.20462 * 10) / 10 : prResults[set.id].e1rm;
                      const displayDelta = isImperial ? Math.round(prResults[set.id].delta * 2.20462 * 10) / 10 : prResults[set.id].delta;
                      const unit = isImperial ? 'lb' : 'kg';
                      return (
                        <div className="ml-12 mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 w-fit">
                          <Trophy size={11} className="text-amber-400 shrink-0" />
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">PR · {displayE1RM}{unit} e1RM</span>
                          <span className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest">+{displayDelta}{unit}</span>
                        </div>
                      );
                    })()}
                  </div>
                ))}
                <button onClick={() => addSet(exercise.id)} className="min-h-11 w-full py-2 bg-slate-800/50 border border-slate-800 border-dashed text-slate-300 hover:text-slate-100 rounded-2xl text-standard-label">+ Add Extra Set</button>
              </div>
            </div>
          );
        })}
        <div ref={addMovementRef} className="scroll-mt-3">
          <button onClick={() => setIsAddingExercise(true)} className="min-h-11 w-full py-3 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl flex items-center justify-center gap-2 transition-all bg-slate-900/30 group">
            <Plus size={20} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
            <span className="text-standard-label text-slate-400 group-hover:text-slate-200">Add exercise</span>
          </button>
        </div>
      </div>

      {discardOpen && <Modal label="Discard workout?" title="Discard workout?" closeLabel="Close discard confirmation" onClose={() => setDiscardOpen(false)} footer={<><button className={dialogButton} onClick={() => setDiscardOpen(false)}>Keep workout</button><button className={`${dialogButton} border-rose-500 text-rose-200`} onClick={onAbort}>Discard workout</button></>}><p>This removes the unfinished workout and its adjustments from this device.</p></Modal>}


      {/* Modals */}

      {increaseExerciseId && localSession.exercises.find(ex => ex.id === increaseExerciseId) && <IncreaseWeightDialog
        exercise={{ ...localSession.exercises.find(ex => ex.id === increaseExerciseId)!, recommendation: recommendations.get(increaseExerciseId) }} library={customLibrary}
        onClose={() => setIncreaseExerciseId(undefined)} onApply={updated => {
          setLocalSession(previous => ({ ...previous, exercises: previous.exercises.map(ex => ex.id === updated.id ? updated : ex) }));
          setIncreaseExerciseId(undefined);
        }} />}

      {/* RPE rating modal — shown before session completes */}
      {showRPEModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex items-end justify-center animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-[2.5rem] p-8 space-y-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <Zap className="text-emerald-400" size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Session Rating</p>
                  <p className="text-lg font-black text-slate-100">How did that feel?</p>
                </div>
              </div>
              <button
                onClick={() => { setShowRPEModal(false); onComplete({ ...localSession, sessionRPE: undefined }); }}
                className="min-h-11 px-3 text-sm font-bold text-slate-300 hover:text-white"
              >
                Skip
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {[1,2,3,4,5,6,7,8,9,10].map(n => {
                  const color = n <= 3 ? 'border-sky-500/40 text-sky-400 bg-sky-500/5 hover:bg-sky-500/15'
                    : n <= 6 ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15'
                    : n <= 8 ? 'border-amber-500/40 text-amber-400 bg-amber-500/5 hover:bg-amber-500/15'
                    : 'border-rose-500/40 text-rose-400 bg-rose-500/5 hover:bg-rose-500/15';
                  const selectedColor = n <= 3 ? 'bg-sky-500 text-slate-950 border-sky-500'
                    : n <= 6 ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                    : n <= 8 ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-rose-500 text-slate-950 border-rose-500';
                  return (
                    <button
                      key={n}
                      onClick={() => setSelectedRPE(n)}
                      className={`py-4 rounded-2xl border font-black text-xl transition-all active:scale-95 ${selectedRPE === n ? selectedColor : color}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between px-1">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Easy</span>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Maximum</span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowRPEModal(false);
                onComplete({ ...localSession, sessionRPE: selectedRPE ?? undefined });
              }}
              disabled={selectedRPE === null}
              className="w-full py-5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black text-lg uppercase tracking-[0.2em] rounded-3xl shadow-2xl shadow-emerald-500/30 disabled:opacity-40 active:scale-95 transition-all"
            >
              Save workout
            </button>
          </div>
        </div>
      )}
      {viewingHistoryFor && (
        <div className="fixed inset-0 z-[160] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3"><History className="text-cyan-400" /><h3 className="text-xl font-black text-slate-100 uppercase tracking-tight">{viewingHistoryFor}</h3></div>
              <button onClick={() => setViewingHistoryFor(null)} className="p-3 bg-slate-800 rounded-2xl border border-slate-700 text-slate-300"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {history.filter(h => h.exercise.toLowerCase() === viewingHistoryFor.toLowerCase()).length > 0 ? (
                history.filter(h => h.exercise.toLowerCase() === viewingHistoryFor.toLowerCase()).slice(0, 10).map((log, i) => (
                  <div key={i} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{log.date}</p>
                      <p className="text-sm font-black text-slate-100">
                        {(log.tracking === 'time' || isCardioCategory(log.category))
                          ? `${log.distance ?? log.weight}${log.distanceUnit ?? (log.unit === 'lbs' ? 'mi' : 'km')} @ ${formatDuration(log.duration ?? log.reps)}`
                          : `${log.weight}${log.unit} × ${log.reps}`}
                      </p>
                    </div>
                    {log.isWarmup && <span className="text-[9px] font-black text-amber-500 border border-amber-500/40 px-3 py-1 rounded-full uppercase tracking-widest">Warmup</span>}
                    {(log as any).isDeload && <span className="text-[9px] font-black text-cyan-400 border border-cyan-500/40 px-3 py-1 rounded-full uppercase tracking-widest">Deload</span>}
                  </div>
                ))
              ) : <p className="text-center py-10 text-slate-500 italic font-bold uppercase tracking-widest text-[10px]">No historical data mapped.</p>}
            </div>
          </div>
        </div>
      )}

      {isAddingExercise && (
        <div className="fixed inset-0 z-[160] bg-slate-950/98 backdrop-blur-3xl p-4 sm:p-8 flex items-center justify-center animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-3"><div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30"><Plus size={20} /></div><div><h3 className="text-xl font-black text-slate-100 tracking-tight uppercase">Inject Movement</h3><p className="text-standard-label text-slate-400">Laboratory Data Stream</p></div></div>
              <button onClick={() => setIsAddingExercise(false)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 border border-slate-700"><X size={20} /></button>
            </div>
            <div className="flex p-1.5 bg-slate-950 mx-6 mt-6 rounded-[1.25rem] border border-slate-800 shrink-0">
              <button onClick={() => setAddMode('ai')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${addMode === 'ai' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>AI Assistant</button>
              <button onClick={() => setAddMode('manual')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${addMode === 'manual' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>Manual Library</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {addMode === 'ai' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <textarea value={addPrompt} onChange={(e) => setAddPrompt(e.target.value)} placeholder="e.g., 'Add a heavy back finisher'..." className="w-full h-36 bg-slate-950 border border-slate-800 rounded-[2rem] p-6 text-slate-100 font-bold placeholder:text-slate-800 focus:ring-1 focus:ring-emerald-500/30 outline-none resize-none shadow-inner" />
                    <button aria-label="Generate exercise" onClick={handleAiAdd} disabled={isAiAdding || !addPrompt.trim()} className="absolute bottom-6 right-6 p-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl shadow-2xl shadow-emerald-500/40 transition-all active:scale-90">{isAiAdding ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}</button>
                  </div>
                </div>
              ) : (
                <LibraryPicker 
                  fullLibrary={fullLibrary}
                  onSelect={(item) => {
                    addNewExercise(item);
                    setIsAddingExercise(false);
                  }}
                  onClose={() => setAddMode('ai')}
                  title="Inject Movement"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {viewingDetailsFor && (
        <div className="fixed inset-0 z-[150] bg-slate-950/98 backdrop-blur-xl flex flex-col p-4 overflow-y-auto">
          <div className="w-full max-w-4xl mx-auto"><div className="flex justify-end mb-4"><button onClick={() => setViewingDetailsFor(null)} className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-slate-300"><X size={20}/></button></div><ExerciseDetailContent item={viewingDetailsFor} onSaveEquipment={(name, weightIncrement, barWeight, loadingMode) => {
                const existingCustom = customLibrary.find(i => i.name.toLowerCase() === name.toLowerCase());
                const existingDefault = (DEFAULT_LIBRARY as ExerciseLibraryItem[]).find(i => i.name.toLowerCase() === name.toLowerCase());
                const base = existingCustom ?? existingDefault ?? viewingDetailsFor!;
                const updated: ExerciseLibraryItem = { ...base, weightIncrement, barWeight, loadingMode };
                if (existingCustom) {
                  onUpdateCustomLibrary(customLibrary.map(i => i.name.toLowerCase() === name.toLowerCase() ? updated : i));
                } else {
                  onUpdateCustomLibrary([...customLibrary, updated]);
                }
                setLocalSession(prev => ({ ...prev, exercises: prev.exercises.map(e => e.name.toLowerCase() === name.toLowerCase() ? { ...e, recommendation: undefined } : e) }));
                setViewingDetailsFor(updated);
              }} /></div>
        </div>
      )}
    </div>
  );
};

export default ActiveWorkout;
