import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Timer as TimerIcon, Trophy, CheckCircle, Bot, X, History, Loader2, Search, Plus, Globe, Calendar, Sparkles, Wand2, BookOpen, Layers, ChevronRight, RefreshCcw, ArrowRight, Info, ChevronDown, ChevronUp, Minus, Check, Trash2, Settings2, Dumbbell as BarbellIcon, AlertCircle, Maximize2, Timer } from 'lucide-react';
import { WorkoutSession, HistoricalLog, Exercise, SetLog, UserSettings, ExerciseLibraryItem } from '../types';
import { GeminiService } from '../services/geminiService';
import { storage } from '../services/storageService';
import { DEFAULT_LIBRARY } from './ExerciseLibrary';
import ExerciseDetailContent from './ExerciseDetailContent';
import LibraryPicker from './LibraryPicker';
import { isCardioCategory, formatDuration } from '../src/utils';

interface ActiveWorkoutProps {
  session: WorkoutSession;
  onComplete: (session: WorkoutSession) => void;
  onAbort: () => void;
  onUpdate?: (session: WorkoutSession) => void;
  history: HistoricalLog[];
  aiService: GeminiService;
  userSettings: UserSettings;
  customLibrary: ExerciseLibraryItem[];
  onUpdateCustomLibrary: (lib: ExerciseLibraryItem[]) => void;
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

  const startAdjusting = (delta: number) => {
    onAdjust(delta);
    timerRef.current = window.setInterval(() => {
      onAdjust(delta);
    }, 150);
  };

  const stopAdjusting = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className={`flex-1 flex items-stretch h-12 rounded-xl border overflow-hidden transition-all ${isWarmup ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-950'}`}>
      <button 
        onPointerDown={() => startAdjusting(-step)}
        onPointerUp={stopAdjusting}
        onPointerLeave={stopAdjusting}
        className="w-10 flex items-center justify-center text-slate-500 hover:text-rose-400 active:bg-rose-500/10 transition-colors border-r border-slate-800/50"
      >
        <Minus size={16} />
      </button>
      
      <button 
        onClick={onOpenPad}
        className="flex-1 flex flex-col items-center justify-center px-1 active:bg-slate-900 transition-colors"
      >
        <span className="text-sm font-black text-slate-100 leading-none">{displayValue || value || 0}</span>
        <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter mt-0.5">{label}</span>
      </button>

      <button 
        onPointerDown={() => startAdjusting(step)}
        onPointerUp={stopAdjusting}
        onPointerLeave={stopAdjusting}
        className="w-10 flex items-center justify-center text-slate-500 hover:text-emerald-400 active:bg-emerald-500/10 transition-colors border-l border-slate-800/50"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

const ActiveWorkout: React.FC<ActiveWorkoutProps> = ({ session, onComplete, onAbort, onUpdate, history, aiService, userSettings, customLibrary, onUpdateCustomLibrary }) => {
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [workTimer, setWorkTimer] = useState<number | null>(null);
  const [restLabel, setRestLabel] = useState<string>(session.restLabel || "Rest");
  const [localSession, setLocalSession] = useState<WorkoutSession>(session);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<string | null>(null);
  const [viewingDetailsFor, setViewingDetailsFor] = useState<ExerciseLibraryItem | null>(null);
  const [expandedRationales, setExpandedRationales] = useState<Record<string, boolean>>({});
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);
  
  // Plate Solver State
  const [exerciseOffsets, setExerciseOffsets] = useState<Record<string, number>>({});
  const [isConfiguringOffset, setIsConfiguringOffset] = useState(false);
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
  const lastRemainingRef = useRef<number>(0);
  const longPressTimerRef = useRef<number | null>(null);

  const exerciseRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const addMovementRef = useRef<HTMLDivElement>(null);

  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [addMode, setAddMode] = useState<'ai' | 'manual'>('ai');
  const [addPrompt, setAddPrompt] = useState('');
  const [isAiAdding, setIsAiAdding] = useState(false);

  const [swappingExerciseId, setSwappingExerciseId] = useState<string | null>(null);
  const [isGettingSwaps, setIsGettingSwaps] = useState(false);
  const [aiSwapSuggestions, setAiSwapSuggestions] = useState<any[]>([]);

  // Hydrate Equipment Offsets
  useEffect(() => {
    const hydrate = async () => {
      const stored = await storage.get<Record<string, number>>('ironflow_equipment_offsets');
      if (stored) setExerciseOffsets(stored);
    };
    hydrate();
  }, []);

  // Sync offsets
  useEffect(() => {
    if (Object.keys(exerciseOffsets).length > 0) {
      storage.set('ironflow_equipment_offsets', exerciseOffsets);
    }
  }, [exerciseOffsets]);

  // Initial mount: always scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleRationale = (id: string) => {
    setExpandedRationales(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
      
      if (localSession.workStartTime) {
        setWorkTimer(Math.floor((now - localSession.workStartTime) / 1000));
      } else {
        setWorkTimer(null);
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateSmartRest = (ex: Exercise, set: SetLog) => {
    const baseRest = userSettings.defaultRestTimer;
    let multiplier = 1.0;
    let label = "Rest";
    if (set.isWarmup) {
      multiplier = 0.5;
      label = "Warmup Rest";
    } else {
      if (set.reps <= 5) {
        multiplier = 1.5;
        label = "Intensity Recovery";
      } else {
        let lowerBound = 0;
        const rangeMatch = ex.targetReps?.match(/(\d+)\s*-\s*(\d+)/);
        if (rangeMatch) lowerBound = parseInt(rangeMatch[1], 10);
        else lowerBound = Math.max(0, (ex.suggestedReps || 0) - 2);
        if (set.reps < lowerBound && lowerBound > 0) {
          multiplier = 1.5;
          label = "Intensity Recovery";
        }
      }
    }
    const setIndex = ex.sets.findIndex(s => s.id === set.id);
    const isLastSet = setIndex === ex.sets.length - 1;
    const isLastExercise = localSession.exercises.findIndex(e => e.id === ex.id) === localSession.exercises.length - 1;
    if (isLastSet && !isLastExercise) {
      multiplier = 2.0;
      label = "Transition Rest";
    }
    return { seconds: Math.round(baseRest * multiplier), label };
  };

  const updateSet = (exerciseId: string, setId: string, updates: Partial<SetLog>) => {
    if (updates.completed === true && navigator.vibrate) {
      navigator.vibrate(50);
    }
    setLocalSession(prev => {
      let isCurrentExFinished = false;
      let newWorkStartTime = prev.workStartTime;

      const updatedExercises = prev.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const isCardio = isCardioCategory(ex.category);

        const newSets = ex.sets.map(set => {
          if (set.id !== setId) return set;
          const updated = { ...set, ...updates };
          
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
            setRestTimer(seconds);
            setRestLabel(label);
          } else if (updates.completed === false) {
            // If uncompleting a cardio set, maybe restart timer? 
            // For now just clear it
          }
          return updated;
        });
        isCurrentExFinished = newSets.every(s => s.completed);
        return { ...ex, sets: newSets };
      });

      // If starting a new set for a cardio exercise, start the work timer
      if (!updates.completed && updates.completed !== undefined) {
        // This part is tricky, we need to know if a set was just "activated"
      }

      const newSession = { ...prev, exercises: updatedExercises, workStartTime: newWorkStartTime };
      if (updates.completed === true && isCurrentExFinished) {
        const firstIncomplete = updatedExercises.find(e => e.sets.some(s => !s.completed));
        setTimeout(() => {
          if (firstIncomplete) {
            exerciseRefs.current.get(firstIncomplete.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            addMovementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 600);
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

  const handleSetNumberPointerDown = (setId: string, completed: boolean) => {
    if (completed) return; 
    longPressTimerRef.current = window.setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      setDeletingSetId(setId);
      longPressTimerRef.current = null;
    }, 600);
  };

  const handleSetNumberPointerUp = (exerciseId: string, set: SetLog) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      if (deletingSetId === set.id) {
        setDeletingSetId(null);
      } else {
        updateSet(exerciseId, set.id, { isWarmup: !set.isWarmup });
      }
    }
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

  const openSwapForExercise = async (ex: Exercise) => {
    setSwappingExerciseId(ex.id);
    setIsGettingSwaps(true);
    try { setAiSwapSuggestions(await aiService.suggestSwaps(ex.name, ex.category)); } catch (e) {} finally { setIsGettingSwaps(false); }
  };

  const performSwap = (id: string, newEx: { name: string, category: string, rationale?: string }) => {
    setLocalSession(prev => {
      const updated = {
        ...prev,
        exercises: prev.exercises.map(e => e.id === id ? { 
          ...e, 
          name: newEx.name, 
          category: newEx.category, 
          rationale: newEx.rationale || `Swapped from ${e.name}` 
        } : e)
      };
      return updated;
    });
    setSwappingExerciseId(null);
  };

  const addNewExercise = (item: ExerciseLibraryItem) => {
    const unitPreference = userSettings.units === 'metric' ? 'kgs' : 'lbs';
    const newEx: Exercise = {
      id: Math.random().toString(36).substr(2, 9),
      name: item.name,
      category: item.category,
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
        const newEx: Exercise = {
          id: Math.random().toString(36).substr(2, 9),
          name: item.name,
          category: item.category,
          targetReps: item.targetReps,
          suggestedWeight: item.suggestedWeight,
          suggestedReps: item.suggestedReps,
          rationale: item.rationale,
          sets: Array.from({ length: item.suggestedSets || 3 }).map(() => ({
            id: Math.random().toString(36).substr(2, 9),
            weight: item.suggestedWeight,
            reps: item.suggestedReps,
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
      alert("AI Addition failed");
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
    const isCardio = ex ? isCardioCategory(ex.category) : false;

    if (isConfiguringOffset) {
      const exName = ex?.name || '';
      setExerciseOffsets(prev => ({ ...prev, [exName]: finalValue }));
      setIsConfiguringOffset(false);
      setActivePad({ ...activePad, value: '0', isFirstPress: true });
      return;
    }

    if (isCardio && activePad.field === 'reps') {
      // Handle MMSS format for cardio duration
      const num = parseInt(activePad.value, 10) || 0;
      const mm = Math.floor(num / 100);
      const ss = num % 100;
      finalValue = (mm * 60) + ss;
    }

    updateSet(activePad.exerciseId, activePad.setId, { [activePad.field]: finalValue });
    setActivePad(null);
    setIsConfiguringOffset(false);
    setIsPlateZoomActive(false);
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
  };

  const applyPlate = (delta: number) => {
    if (!activePad) return;
    const current = parseFloat(activePad.value) || 0;
    setActivePad({ ...activePad, value: (current + delta).toString(), isFirstPress: false });
    if (navigator.vibrate) navigator.vibrate(5);
  };

  const plateResult = useMemo(() => {
    if (!activePad || activePad.field !== 'weight') return null;
    const currentTotal = parseFloat(activePad.value) || 0;
    const exName = localSession.exercises.find(e => e.id === activePad.exerciseId)?.name || '';
    const offset = exerciseOffsets[exName] || 0;
    if (currentTotal <= offset) return { plates: [], remainder: 0 };
    let targetPerSide = (currentTotal - offset) / 2;
    const denoms = userSettings.units === 'metric' ? METRIC_PLATES : IMPERIAL_PLATES;
    const result: number[] = [];
    for (const d of denoms) {
      while (targetPerSide >= d - 0.01) {
        result.push(d);
        targetPerSide -= d;
      }
    }
    return { plates: result, remainder: Math.round(targetPerSide * 100) / 100 };
  }, [activePad, exerciseOffsets, userSettings.units, localSession.exercises]);

  return (
    <div className="space-y-6 pb-12">
      {/* Neural Pad Overlay */}
      {activePad && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => { setActivePad(null); setIsPlateZoomActive(false); }} />
          <div className="relative bg-slate-900 border-t border-slate-800 rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] p-6 space-y-6 animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-start px-2">
              <div>
                <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] ${isConfiguringOffset ? 'text-amber-500' : 'text-emerald-400'}`}>
                  {isConfiguringOffset ? 'Adjust Offset' : isCardioCategory(localSession.exercises.find(e => e.id === activePad.exerciseId)?.category || '') && activePad.field === 'reps' ? 'Adjust Time (MMSS)' : `Adjust ${activePad.field}`}
                </h4>
                <p className="text-3xl font-black text-slate-100 tracking-tight">
                  {isCardioCategory(localSession.exercises.find(e => e.id === activePad.exerciseId)?.category || '') && activePad.field === 'reps' 
                    ? (activePad.value.length > 2 ? `${activePad.value.slice(0, -2)}:${activePad.value.slice(-2).padStart(2, '0')}` : activePad.value || '0')
                    : activePad.value || '0'
                  }
                  <span className="text-slate-500 ml-1">
                    {activePad.field === 'weight' 
                      ? (isCardioCategory(localSession.exercises.find(e => e.id === activePad.exerciseId)?.category || '') ? 'Dist/Int' : (userSettings.units === 'metric' ? 'kg' : 'lb')) 
                      : (isCardioCategory(localSession.exercises.find(e => e.id === activePad.exerciseId)?.category || '') ? '' : 'reps')}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                {activePad.field === 'weight' && (
                  <button 
                    onClick={() => {
                      const exName = localSession.exercises.find(e => e.id === activePad.exerciseId)?.name || '';
                      if (!isConfiguringOffset) {
                        setActivePad({ ...activePad, value: (exerciseOffsets[exName] || 0).toString(), isFirstPress: true });
                        setIsConfiguringOffset(true);
                      } else {
                        const val = parseFloat(activePad.value) || 0;
                        setExerciseOffsets(prev => ({ ...prev, [exName]: val }));
                        setIsConfiguringOffset(false);
                        setActivePad({ ...activePad, value: '0', isFirstPress: true });
                      }
                    }}
                    className={`p-3 rounded-2xl border transition-all ${isConfiguringOffset ? 'bg-amber-500/20 border-amber-500/50 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-400'}`}
                    title={isConfiguringOffset ? "Save Offset" : "Configure Equipment Offset"}
                  >
                    <BarbellIcon size={20} />
                  </button>
                )}
                <button onClick={() => { setActivePad(null); setIsPlateZoomActive(false); }} className="p-3 bg-slate-800 text-slate-400 rounded-2xl"><X size={20} /></button>
              </div>
            </div>

            {/* Context-Switching Main Panel */}
            <div className="space-y-6 animate-in fade-in duration-300">
              {isConfiguringOffset && activePad.field === 'weight' ? (
                <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl text-center space-y-2">
                  <BarbellIcon className="text-amber-500 mx-auto" size={32} />
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Equipment Calibration Mode</p>
                  <p className="text-xs text-slate-400 italic">Type the starting mass of the machine (sled, bar, etc.)</p>
                </div>
              ) : (
                <>
                  {activePad.field === 'weight' && (
                    <button 
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
                            <span>LOAD PER SIDE</span>
                            <span className="text-slate-700">|</span>
                            <span className="text-emerald-500/80">{plateResult.remainder > 0 ? `+${plateResult.remainder} UNRESOLVED` : 'EXACT SYNC'}</span>
                            <div className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 size={10} className="text-cyan-400" /></div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <BarbellIcon className="text-slate-600" size={24} />
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Internal Weight Only</p>
                        </div>
                      )}
                    </button>
                  )}

                  {activePad.field === 'weight' && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {[1.25, 2.5, 5, 10, 20].map(p => (
                        <button key={p} onClick={() => applyPlate(p)} className="shrink-0 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest active:bg-emerald-500 active:text-slate-950 transition-colors">+{p}</button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'BACK'].map(k => (
                  <button key={k} onClick={() => handlePadPress(k.toString())} className={`h-16 rounded-2xl flex items-center justify-center text-xl font-black transition-all active:scale-95 ${k === 'BACK' ? 'bg-slate-800 text-rose-400' : 'bg-slate-800/50 text-slate-100 hover:bg-slate-800'}`}>
                    {k === 'BACK' ? <RefreshCcw size={20} className="rotate-[-90deg]" /> : k}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={commitPad}
              className={`w-full py-5 font-black rounded-2xl uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all ${isConfiguringOffset ? 'bg-amber-500 text-slate-950 shadow-amber-500/20' : 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'}`}
            >
              {isConfiguringOffset ? 'Save Offset' : 'Committed'}
            </button>
          </div>
        </div>
      )}

      {/* IronFlow Neural Zoom Overlay */}
      {isPlateZoomActive && activePad && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300 cursor-pointer" onClick={() => setIsPlateZoomActive(false)}>
          <div className="absolute top-12 flex flex-col items-center text-center space-y-2">
            <h4 className="text-[12px] font-black text-cyan-400 uppercase tracking-[0.4em]">Neural Zoom Enabled</h4>
            <p className="text-4xl font-black text-slate-100 tracking-tighter">{activePad.value}<span className="text-slate-500 ml-1">{userSettings.units === 'metric' ? 'kg' : 'lb'}</span></p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
            {plateResult && (
              <div className="flex flex-col items-center w-full h-[60vh] relative">
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-full border border-slate-600/50 shadow-2xl" />
                <div className="flex flex-col-reverse items-center justify-start flex-1 w-full pb-20 pt-10">
                  <div className="relative mb-8 w-full flex justify-center">
                    <div className="bg-slate-900 border border-slate-700 px-6 py-3 rounded-2xl shadow-xl flex flex-col items-center">
                       <BarbellIcon size={24} className="text-slate-500 mb-1" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Starting Mass</p>
                       <p className="text-2xl font-black text-slate-100 mt-1">{exerciseOffsets[localSession.exercises.find(e => e.id === activePad.exerciseId)?.name || ''] || 0}<span className="text-xs text-slate-500 ml-1">{userSettings.units === 'metric' ? 'kg' : 'lb'}</span></p>
                    </div>
                  </div>
                  {plateResult.plates.map((p, i) => (
                    <div key={i} className={`w-56 h-16 ${PLATE_STYLES[p]?.color || 'bg-slate-500'} rounded-2xl shadow-2xl ${PLATE_STYLES[p]?.glow} border border-white/20 flex items-center justify-center mb-3 animate-in slide-in-from-bottom duration-500`} style={{ transitionDelay: `${i * 100}ms` }}>
                      <span className="text-3xl font-black text-white drop-shadow-md">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mt-8 w-full max-w-sm space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 text-center space-y-4">
              <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Load Manifest (Per Side)</h5>
              <div className="flex flex-wrap justify-center gap-3">
                {plateResult?.plates.map((p, i) => (
                  <div key={i} className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 shadow-sm flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${PLATE_STYLES[p]?.color || 'bg-slate-500'}`} />
                    <span className="text-sm font-black text-slate-200">{p}</span>
                  </div>
                ))}
              </div>
              {plateResult?.remainder! > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
                  <AlertCircle className="text-rose-500" size={24} />
                  <div className="text-left">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Inexact Sync</p>
                    <p className="text-sm font-bold text-slate-100">+{plateResult?.remainder} REMAINDER</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-center text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] animate-pulse">Tap anywhere to close</p>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-40 flex flex-col gap-2">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <TimerIcon className="text-emerald-400" size={24} />
            <div>
              <p className="text-standard-label text-slate-400">Duration</p>
              <p className="text-xl font-mono font-black text-slate-100">{formatTime(workoutTimer)}</p>
            </div>
          </div>
          {workTimer !== null && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse">
              <div className="text-right">
                <p className="text-standard-label font-black uppercase">Active Set</p>
                <p className="text-xl font-mono font-black">{formatTime(workTimer)}</p>
              </div>
              <button onClick={() => setLocalSession(prev => ({ ...prev, workStartTime: null }))} className="p-1"><X size={18}/></button>
            </div>
          )}
          {restTimer !== null && (
            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${restTimer > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'}`}>
              <div className="text-right">
                <p className="text-standard-label font-black">{restLabel}</p>
                <p className="text-xl font-mono font-black">{formatTime(restTimer)}</p>
              </div>
              <button onClick={() => { restEndTimeRef.current = null; setRestTimer(null); setLocalSession({...localSession}); }} className="p-1"><X size={18}/></button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {localSession.exercises.map(exercise => {
          const isInteracting = activePad?.exerciseId === exercise.id || (deletingSetId && exercise.sets.some(s => s.id === deletingSetId));
          const hasStarted = exercise.sets.some(s => s.completed);
          const isFinished = exercise.sets.every(s => s.completed);
          const isActive = isInteracting || (hasStarted && !isFinished);
          const nextPrescribedId = localSession.exercises.find(ex => !ex.sets.some(s => s.completed))?.id;
          const isNext = !isActive && !isFinished && nextPrescribedId === exercise.id;
          const borderClass = isActive ? 'border-cyan-500/50 ring-2 ring-cyan-500/10' : (isNext ? 'border-emerald-500/40 border-dashed' : 'border-slate-800');
          const opacityClass = isActive ? 'opacity-100 scale-[1.01]' : (isNext ? 'opacity-80' : (isFinished ? 'opacity-30' : 'opacity-60'));
          const isCardio = isCardioCategory(exercise.category);

          return (
            <div key={exercise.id} ref={el => { if (el) exerciseRefs.current.set(exercise.id, el); else exerciseRefs.current.delete(exercise.id); }} className={`bg-slate-900 border rounded-3xl overflow-hidden shadow-2xl scroll-mt-[120px] transition-all duration-500 ${borderClass} ${opacityClass}`}>
              <div className="border-b border-slate-800 bg-slate-900/50">
                <div className="py-4 px-5 flex justify-between items-center">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-baseline gap-x-2 flex-wrap">
                      <h3 className="text-lg font-black text-slate-100 leading-tight uppercase tracking-tight">{exercise.name}</h3>
                      <span className="text-standard-label text-slate-400 mb-0.5">{exercise.category}</span>
                      {isCardio && !isFinished && (
                        <button 
                          onClick={() => setLocalSession(prev => ({ ...prev, workStartTime: prev.workStartTime ? null : Date.now() }))}
                          className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border transition-all flex items-center gap-1 ml-2 ${localSession.workStartTime ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'}`}
                        >
                          {localSession.workStartTime ? <><X size={10} /> Stop</> : <><Timer size={10} /> Start</>}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openSwapForExercise(exercise)} className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl transition-all border border-slate-700/50"><RefreshCcw size={18} /></button>
                    <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700/50">
                      <button onClick={() => handleGetAdvice(exercise.id, exercise.name)} className={`p-2 rounded-lg transition-all ${fetchingAdvice[exercise.id] ? 'text-emerald-500 animate-spin' : 'text-emerald-400 hover:bg-slate-700'}`} disabled={fetchingAdvice[exercise.id]}><Bot size={16} /></button>
                      <button onClick={() => setViewingHistoryFor(exercise.name)} className="p-2 text-cyan-400 hover:bg-slate-700 rounded-lg transition-all"><History size={16} /></button>
                      <button onClick={() => setViewingDetailsFor(fullLibrary.find(i => i.name === exercise.name) || null)} className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-all"><BookOpen size={16} /></button>
                    </div>
                  </div>
                </div>
                {exercise.rationale && (
                  <div className="px-5 pb-3">
                    <div onClick={() => toggleRationale(exercise.id)} className="flex items-start gap-2 cursor-pointer group w-full">
                      <p className={`text-[12px] text-emerald-400 font-bold italic leading-tight transition-all ${expandedRationales[exercise.id] ? '' : 'truncate'}`}>{exercise.rationale}</p>
                      {expandedRationales[exercise.id] ? <ChevronUp size={12} className="text-emerald-400/50 mt-0.5" /> : <ChevronDown size={12} className="text-emerald-400/50 mt-0.5" />}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-5 space-y-4">
                {exercise.sets.map((set, i) => (
                  <div key={set.id} className={`flex items-center gap-2 sm:gap-3 transition-all ${set.completed ? 'opacity-30 grayscale-[0.5]' : ''}`}>
                    <button onPointerDown={() => handleSetNumberPointerDown(set.id, set.completed)} onPointerUp={() => handleSetNumberPointerUp(exercise.id, set)} onPointerLeave={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }} className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center font-black text-xs sm:text-sm transition-all shrink-0 select-none ${deletingSetId === set.id ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse' : set.isWarmup ? 'bg-amber-500/20 border-amber-500/50 text-amber-500' : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'}`}>
                      {deletingSetId === set.id ? <X size={14} /> : set.isWarmup ? 'W' : (i + 1)}
                    </button>
                    <div className="flex-1 flex gap-1.5 sm:gap-2 min-w-0">
                      <KineticInput 
                        value={set.weight} 
                        label={isCardio ? 'Dist/Int' : (userSettings.units === 'metric' ? 'kg' : 'lb')} 
                        step={isCardio ? 0.1 : (userSettings.units === 'metric' ? 1.25 : 2.5)} 
                        isWarmup={set.isWarmup} 
                        onAdjust={(d) => updateSet(exercise.id, set.id, { weight: Math.max(0, set.weight + d) })} 
                        onOpenPad={() => setActivePad({ exerciseId: exercise.id, setId: set.id, field: 'weight', value: set.weight.toString(), isFirstPress: true })} 
                      />
                      <KineticInput 
                        value={set.reps} 
                        label={isCardio ? 'Time' : 'reps'} 
                        step={isCardio ? 5 : 1} 
                        isWarmup={set.isWarmup} 
                        displayValue={isCardio ? formatDuration(set.reps) : undefined}
                        onAdjust={(d) => updateSet(exercise.id, set.id, { reps: Math.max(0, set.reps + d) })} 
                        onOpenPad={() => setActivePad({ exerciseId: exercise.id, setId: set.id, field: 'reps', value: set.reps.toString(), isFirstPress: true })} 
                      />
                    </div>
                    <button onClick={() => deletingSetId === set.id ? removeSet(exercise.id, set.id) : updateSet(exercise.id, set.id, { completed: !set.completed })} className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border transition-all shrink-0 ${deletingSetId === set.id ? 'bg-rose-500 border-rose-400 text-slate-950 shadow-lg' : set.completed ? 'bg-emerald-500 border-emerald-400 text-slate-950 scale-90' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                      {deletingSetId === set.id ? <Trash2 size={24} /> : set.completed ? <Check size={24} /> : <CheckCircle size={24} className="opacity-20" />}
                    </button>
                  </div>
                ))}
                <button onClick={() => addSet(exercise.id)} className="w-full py-4 bg-slate-800/50 border border-slate-800 border-dashed text-slate-300 hover:text-slate-100 rounded-2xl text-standard-label">+ Add Extra Set</button>
              </div>
            </div>
          );
        })}
        <div ref={addMovementRef} className="scroll-mt-[120px]">
          <button onClick={() => setIsAddingExercise(true)} className="w-full py-10 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 transition-all bg-slate-900/30 group shadow-lg">
            <Plus size={36} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
            <span className="text-standard-label text-slate-400 group-hover:text-slate-200">Inject Movement</span>
          </button>
        </div>
      </div>

      <div className="p-4 mt-8 mb-12">
        <button 
          onClick={isAnySetCompleted ? () => onComplete(localSession) : onAbort} 
          className={`w-full py-6 font-black text-lg uppercase tracking-[0.2em] rounded-3xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${
            isAnySetCompleted 
              ? `bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-emerald-500/30 ${isAllSetsCompleted ? 'animate-pulse shadow-[0_0_35px_rgba(16,185,129,0.7)] ring-2 ring-emerald-400/50' : ''}` 
              : 'bg-slate-900 border border-rose-500/40 text-rose-500 shadow-xl'
          }`}
        >
          {isAnySetCompleted ? <><span className="flex items-center gap-2">Complete Flow <ArrowRight size={20} /></span></> : <><span className="flex items-center gap-2">Abort Protocol <X size={20} /></span></>}
        </button>
      </div>

      {/* Modals */}
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
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{log.date}</p><p className="text-sm font-black text-slate-100">{log.weight}{log.unit} x {log.reps}</p></div>
                    {log.isWarmup && <span className="text-[9px] font-black text-amber-500 border border-amber-500/40 px-3 py-1 rounded-full uppercase tracking-widest">Warmup</span>}
                  </div>
                ))
              ) : <p className="text-center py-10 text-slate-500 italic font-bold uppercase tracking-widest text-[10px]">No historical data mapped.</p>}
            </div>
          </div>
        </div>
      )}

      {swappingExerciseId && (
        <div className="fixed inset-0 z-[160] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-3"><RefreshCcw className="text-amber-400" /><div><h3 className="text-xl font-black text-slate-100 tracking-tight leading-none uppercase">Architectural Swap</h3><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1.5">Replacing Movement</p></div></div>
              <button onClick={() => setSwappingExerciseId(null)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 transition-all border border-slate-700"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              <section>
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Sparkles size={14} /> AI Substitution Engine</h4>
                {isGettingSwaps ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-3 opacity-70"><Loader2 className="animate-spin text-emerald-500" size={24} /><p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Optimizing Strategy...</p></div>
                ) : aiSwapSuggestions.length > 0 ? (
                  <div className="space-y-3">
                    {aiSwapSuggestions.map((alt, i) => (
                      <button key={i} onClick={() => performSwap(swappingExerciseId, alt)} className="w-full text-left p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl hover:border-emerald-500/50 transition-all group"><div className="flex justify-between items-center mb-1"><h5 className="font-black text-emerald-400 text-sm uppercase tracking-tight">{alt.name}</h5><ArrowRight size={16} className="text-emerald-500/50 group-hover:translate-x-1 transition-transform" /></div><p className="text-[10px] text-slate-200 font-bold italic leading-relaxed">"{alt.rationale}"</p></button>
                    ))}
                  </div>
                ) : <p className="text-center py-4 text-[10px] text-slate-500 font-black uppercase tracking-widest italic">No AI suggestions optimized.</p>}
              </section>
              <section className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><BookOpen size={14} className="text-cyan-400" /> Manual Library Access</h4>
                <div className="bg-slate-950/30 border border-slate-800/50 rounded-[2rem] overflow-hidden h-[400px]">
                  <LibraryPicker 
                    isModal={false}
                    fullLibrary={fullLibrary}
                    onSelect={(item) => performSwap(swappingExerciseId, item)}
                    onClose={() => {}}
                  />
                </div>
              </section>
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
                    <button onClick={handleAiAdd} disabled={isAiAdding || !addPrompt.trim()} className="absolute bottom-6 right-6 p-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl shadow-2xl shadow-emerald-500/40 transition-all active:scale-90">{isAiAdding ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}</button>
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
          <div className="w-full max-w-4xl mx-auto"><div className="flex justify-end mb-4"><button onClick={() => setViewingDetailsFor(null)} className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-slate-300"><X size={20}/></button></div><ExerciseDetailContent item={viewingDetailsFor} /></div>
        </div>
      )}
    </div>
  );
};

export default ActiveWorkout;