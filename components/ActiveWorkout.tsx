import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Timer as TimerIcon, Trophy, CheckCircle, Bot, X, History, Loader2, Search, Plus, Globe, Calendar, Sparkles, Wand2, BookOpen, Layers, ChevronRight, RefreshCcw, ArrowRight, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { WorkoutSession, HistoricalLog, Exercise, SetLog, UserSettings, ExerciseLibraryItem } from '../types';
import { GeminiService } from '../services/geminiService';
import { DEFAULT_LIBRARY } from './ExerciseLibrary';
import ExerciseDetailContent from './ExerciseDetailContent';

interface ActiveWorkoutProps {
  session: WorkoutSession;
  onComplete: (session: WorkoutSession) => void;
  onAbort: () => void;
  history: HistoricalLog[];
  aiService: GeminiService;
  userSettings: UserSettings;
  customLibrary: ExerciseLibraryItem[];
  onUpdateCustomLibrary: (lib: ExerciseLibraryItem[]) => void;
}

const ActiveWorkout: React.FC<ActiveWorkoutProps> = ({ session, onComplete, onAbort, history, aiService, userSettings, customLibrary, onUpdateCustomLibrary }) => {
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restLabel, setRestLabel] = useState<string>("Rest");
  const [localSession, setLocalSession] = useState<WorkoutSession>(session);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<string | null>(null);
  const [viewingDetailsFor, setViewingDetailsFor] = useState<ExerciseLibraryItem | null>(null);
  const [expandedRationales, setExpandedRationales] = useState<Record<string, boolean>>({});
  
  // AI Coach state
  const [exerciseAdvice, setExerciseAdvice] = useState<Record<string, string>>({});
  const [fetchingAdvice, setFetchingAdvice] = useState<Record<string, boolean>>({});
  
  const workoutStartTimeRef = useRef<number>(Date.now());
  const restEndTimeRef = useRef<number | null>(null);
  const lastRemainingRef = useRef<number>(0);

  // Auto-scroll refs
  const exerciseRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const addMovementRef = useRef<HTMLDivElement>(null);

  // Add Exercise state
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [addMode, setAddMode] = useState<'ai' | 'manual'>('ai');
  const [addPrompt, setAddPrompt] = useState('');
  const [isAiAdding, setIsAiAdding] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addCategory, setAddCategory] = useState('All');

  // Swap State
  const [swappingExerciseId, setSwappingExerciseId] = useState<string | null>(null);
  const [isGettingSwaps, setIsGettingSwaps] = useState(false);
  const [aiSwapSuggestions, setAiSwapSuggestions] = useState<any[]>([]);
  const [swapSearch, setSwapSearch] = useState('');

  const toggleRationale = (id: string) => {
    setExpandedRationales(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGetAdvice = async (exId: string, exName: string) => {
    if (fetchingAdvice[exId]) return;
    
    setFetchingAdvice(prev => ({ ...prev, [exId]: true }));
    try {
      const ex = localSession.exercises.find(e => e.id === exId);
      if (!ex) return;
      
      const completedSets = ex.sets.filter(s => s.completed);
      const advice = await aiService.getExerciseAdvice(exName, completedSets, history);
      setExerciseAdvice(prev => ({ ...prev, [exId]: advice }));
    } catch (e) {
      console.error("Coach failed:", e);
    } finally {
      setFetchingAdvice(prev => ({ ...prev, [exId]: false }));
    }
  };

  const playTimerEndSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (freq: number, startTime: number) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(freq, startTime);
        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(0.5, startTime + 0.02); 
        g.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.2);
      };
      const now = audioCtx.currentTime;
      playBeep(880, now); playBeep(440, now + 0.2); playBeep(880, now + 0.4);
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

  const fullLibrary = useMemo(() => {
    const map = new Map<string, ExerciseLibraryItem>();
    DEFAULT_LIBRARY.forEach(item => map.set(item.name.toLowerCase(), item));
    customLibrary.forEach(item => map.set(item.name.toLowerCase(), item));
    return Array.from(map.values());
  }, [customLibrary]);

  const libraryForSwap = useMemo(() => {
    if (swappingExerciseId === null) return [];
    const targetEx = localSession.exercises.find(e => e.id === swappingExerciseId);
    if (!targetEx) return [];
    return fullLibrary.filter(item => 
      item.category === targetEx.category && 
      item.name.toLowerCase().includes(swapSearch.toLowerCase()) &&
      item.name !== targetEx.name
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [swappingExerciseId, swapSearch, localSession.exercises, fullLibrary]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateSmartRest = (ex: Exercise, set: SetLog) => {
    const baseRest = userSettings.defaultRestTimer;
    let multiplier = 1.0;
    let label = "Rest";

    // 1. Warm-up Priority
    if (set.isWarmup) {
      multiplier = 0.5;
      label = "Warmup Rest";
    } else {
      // 2. Absolute Intensity Check
      if (set.reps <= 5) {
        multiplier = 1.5;
        label = "Intensity Recovery";
      } else {
        // 3. Dynamic Range Validation
        let lowerBound = 0;
        
        // Parse range from targetReps string (e.g., "8-12")
        const rangeMatch = ex.targetReps?.match(/(\d+)\s*-\s*(\d+)/);
        if (rangeMatch) {
          lowerBound = parseInt(rangeMatch[1], 10);
        } else {
          // Single Target case (e.g., "10") or rely on suggestedReps
          const target = ex.suggestedReps || 0;
          lowerBound = Math.max(0, target - 2);
        }

        if (set.reps < lowerBound && lowerBound > 0) {
          multiplier = 1.5;
          label = "Intensity Recovery";
        }
      }
    }

    // 4. Transition Logic
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
      const updatedExercises = prev.exercises.map((ex, exIdx) => {
        if (ex.id !== exerciseId) return ex;
        const newSets = ex.sets.map(set => {
          if (set.id !== setId) return set;
          const updated = { ...set, ...updates };
          if (updates.completed === true) {
            updated.timestamp = Date.now();
            const { seconds, label } = calculateSmartRest(ex, updated);
            restEndTimeRef.current = Date.now() + (seconds * 1000);
            setRestTimer(seconds);
            setRestLabel(label);
            const allSetsFinished = ex.sets.every(s => s.id === setId ? true : s.completed);
            if (allSetsFinished) {
              const isLastEx = exIdx === prev.exercises.length - 1;
              setTimeout(() => {
                if (isLastEx) addMovementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                else exerciseRefs.current.get(prev.exercises[exIdx + 1].id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 600);
            }
          }
          return updated;
        });
        return { ...ex, sets: newSets };
      });
      return { ...prev, exercises: updatedExercises };
    });
  };

  const addSet = (exerciseId: string) => {
    setLocalSession(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet: SetLog = {
          id: Math.random().toString(36).substr(2, 9),
          weight: lastSet?.weight || ex.suggestedWeight || 0,
          reps: lastSet?.reps || ex.suggestedReps || 10,
          unit: userSettings.units === 'metric' ? 'kgs' : 'lbs',
          timestamp: 0,
          completed: false,
          isWarmup: false
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      })
    }));
  };

  const openSwapForExercise = async (ex: Exercise) => {
    setSwappingExerciseId(ex.id);
    setIsGettingSwaps(true);
    setSwapSearch('');
    try { setAiSwapSuggestions(await aiService.suggestSwaps(ex.name, ex.category)); } catch (e) {} finally { setIsGettingSwaps(false); }
  };

  const performSwap = (id: string, newEx: { name: string, category: string, rationale?: string }) => {
    setLocalSession(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => e.id === id ? { 
        ...e, 
        name: newEx.name, 
        category: newEx.category, 
        rationale: newEx.rationale || `Swapped from ${e.name}` 
      } : e)
    }));
    setSwappingExerciseId(null);
    setSwapSearch('');
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
    setLocalSession(prev => ({ ...prev, exercises: [...prev.exercises, newEx] }));
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
        setLocalSession(prev => ({ ...prev, exercises: [...prev.exercises, newEx] }));
      }
      setIsAddingExercise(false);
      setAddPrompt('');
    } catch (e) {
      alert("AI Addition failed");
    } finally {
      setIsAiAdding(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="sticky top-0 z-40 flex flex-col gap-2">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <TimerIcon className="text-emerald-400" size={24} />
            <div>
              <p className="text-standard-label text-slate-500">Duration</p>
              <p className="text-xl font-mono font-black">{formatTime(workoutTimer)}</p>
            </div>
          </div>
          {restTimer !== null && (
            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${restTimer > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400 animate-pulse'}`}>
              <div className="text-right">
                <p className="text-standard-label font-bold">{restLabel}</p>
                <p className="text-xl font-mono font-black">{formatTime(restTimer)}</p>
              </div>
              <button onClick={() => setRestTimer(null)}><X size={18}/></button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {localSession.exercises.map(exercise => {
          const isFocused = localSession.exercises.find(ex => ex.sets.some(s => !s.completed))?.id === exercise.id;
          
          return (
            <div 
              key={exercise.id} 
              ref={el => { if (el) exerciseRefs.current.set(exercise.id, el); else exerciseRefs.current.delete(exercise.id); }}
              className={`bg-slate-900 border rounded-3xl overflow-hidden shadow-2xl scroll-mt-[120px] transition-all duration-500 ${isFocused ? 'border-cyan-500/40 ring-2 ring-cyan-500/10 scale-[1.01] opacity-100' : 'border-slate-800 opacity-60'}`}
            >
              <div className="border-b border-slate-800 bg-slate-900/50">
                <div className="py-4 px-5 flex justify-between items-center">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-baseline gap-x-2 flex-wrap">
                      <h3 className="text-lg font-black text-slate-100 leading-tight">{exercise.name}</h3>
                      <span className="text-standard-label text-slate-500 mb-0.5">{exercise.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openSwapForExercise(exercise)} className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl transition-all" title="Swap Exercise"><RefreshCcw size={18} /></button>
                    <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700/50">
                      <button 
                        onClick={() => handleGetAdvice(exercise.id, exercise.name)} 
                        className={`p-2 rounded-lg transition-all ${fetchingAdvice[exercise.id] ? 'text-emerald-500 animate-spin' : 'text-emerald-400 hover:bg-slate-700'}`}
                        disabled={fetchingAdvice[exercise.id]}
                        title="AI Coach Advice"
                      >
                        <Bot size={16} />
                      </button>
                      <button onClick={() => setViewingHistoryFor(exercise.name)} className="p-2 text-cyan-400 hover:bg-slate-700 rounded-lg transition-all" title="History"><History size={16} /></button>
                      <button onClick={() => setViewingDetailsFor(fullLibrary.find(i => i.name === exercise.name) || null)} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-all" title="Guide"><BookOpen size={16} /></button>
                    </div>
                  </div>
                </div>
                {exercise.rationale && (
                  <div className="px-5 pb-3">
                    <div onClick={() => toggleRationale(exercise.id)} className="flex items-start gap-2 cursor-pointer group w-full">
                      <p className={`text-[12px] text-emerald-400/80 italic leading-tight group-hover:opacity-100 transition-all ${expandedRationales[exercise.id] ? '' : 'truncate'}`}>{exercise.rationale}</p>
                      {expandedRationales[exercise.id] ? <ChevronUp size={12} className="text-emerald-400/40" /> : <ChevronDown size={12} className="text-emerald-400/40" />}
                    </div>
                  </div>
                )}
                {exerciseAdvice[exercise.id] && (
                  <div className="px-5 pb-3 animate-in fade-in slide-in-from-top-1">
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex gap-3">
                      <Bot size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-emerald-100 italic leading-relaxed">
                        {exerciseAdvice[exercise.id]}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                {exercise.sets.map((set, i) => (
                  <div key={set.id} className={`flex items-center gap-3 transition-all ${set.completed ? 'opacity-30 grayscale-[0.5]' : ''}`}>
                    <button onClick={() => updateSet(exercise.id, set.id, { isWarmup: !set.isWarmup })} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black transition-all ${set.isWarmup ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'}`}>
                      {set.isWarmup ? 'W' : (i + 1)}
                    </button>
                    <div className={`flex-1 flex gap-2 p-3 rounded-2xl border transition-all ${set.isWarmup ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-950 border-slate-800'}`}>
                      <div className="flex-1 flex items-center">
                        <input type="number" step="0.5" value={set.weight || ''} onChange={(e) => updateSet(exercise.id, set.id, { weight: parseFloat(e.target.value) || 0 })} onFocus={(e) => e.currentTarget.select()} className="w-full bg-transparent text-sm font-black text-slate-100 outline-none" placeholder="0.0" />
                        <span className="text-standard-label text-slate-600 ml-1">{userSettings.units === 'metric' ? 'kg' : 'lb'}</span>
                      </div>
                      <div className="flex-1 flex items-center border-l border-slate-800 pl-2">
                        <input type="number" value={set.reps || ''} onChange={(e) => updateSet(exercise.id, set.id, { reps: parseInt(e.target.value) || 0 })} onFocus={(e) => e.currentTarget.select()} className="w-full bg-transparent text-sm font-black text-slate-100 outline-none" placeholder="0" />
                        <span className="text-standard-label text-slate-600 ml-1">reps</span>
                      </div>
                    </div>
                    <button onClick={() => updateSet(exercise.id, set.id, { completed: !set.completed })} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${set.completed ? 'bg-emerald-500 text-slate-950 scale-90 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800 text-slate-500 hover:bg-emerald-500/20'}`}>
                      <CheckCircle size={24} />
                    </button>
                  </div>
                ))}
                <button onClick={() => addSet(exercise.id)} className="w-full py-4 bg-slate-800/30 border border-slate-800 border-dashed text-slate-500 hover:text-slate-300 rounded-2xl text-standard-label">+ Add Extra Set</button>
              </div>
            </div>
          );
        })}
        <div ref={addMovementRef} className="scroll-mt-[120px]">
          <button onClick={() => setIsAddingExercise(true)} className="w-full py-10 border-2 border-dashed border-slate-800 hover:border-emerald-500/40 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 transition-all bg-slate-900/20 group">
            <Plus size={32} className="text-slate-700 group-hover:text-emerald-500 transition-colors" />
            <span className="text-standard-label text-slate-600">Add Exercise</span>
          </button>
        </div>
      </div>

      <div className="p-4 mt-8 mb-12">
        <button 
          onClick={isAnySetCompleted ? () => onComplete(localSession) : onAbort} 
          className={`w-full py-6 font-black text-lg rounded-3xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${
            isAnySetCompleted 
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-emerald-500/20' 
              : 'bg-slate-900 border border-rose-500/30 text-rose-500/80 hover:text-rose-500 hover:border-rose-500/50 shadow-xl'
          }`}
        >
          {isAnySetCompleted ? (
            <>Complete Workout Flow <ArrowRight size={20} /></>
          ) : (
            <>Abort Protocol <X size={20} /></>
          )}
        </button>
      </div>

      {/* History Modal */}
      {viewingHistoryFor && (
        <div className="fixed inset-0 z-[160] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                <History className="text-cyan-400" />
                <h3 className="text-xl font-black text-slate-100 tracking-tight">{viewingHistoryFor}</h3>
              </div>
              <button onClick={() => setViewingHistoryFor(null)} className="p-3 bg-slate-800 rounded-2xl"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {history.filter(h => h.exercise.toLowerCase() === viewingHistoryFor.toLowerCase()).length > 0 ? (
                history.filter(h => h.exercise.toLowerCase() === viewingHistoryFor.toLowerCase()).slice(0, 10).map((log, i) => (
                  <div key={i} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{log.date}</p>
                      <p className="text-sm font-black text-slate-200">{log.weight}{log.unit} x {log.reps}</p>
                    </div>
                    {log.isWarmup && <span className="text-[8px] font-black text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase">Warmup</span>}
                  </div>
                ))
              ) : <p className="text-center py-10 text-slate-600 italic">No historical data available.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Swap Modal */}
      {swappingExerciseId && (
        <div className="fixed inset-0 z-[160] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-3">
                <RefreshCcw className="text-amber-400" />
                <div>
                  <h3 className="text-xl font-black text-slate-100 tracking-tight leading-none truncate max-w-[200px]">Architectural Swap</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Replace "{localSession.exercises.find(e => e.id === swappingExerciseId)?.name}"</p>
                </div>
              </div>
              <button onClick={() => setSwappingExerciseId(null)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              <section>
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Sparkles size={14} /> AI Recommendations</h4>
                {isGettingSwaps ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-3 opacity-50">
                    <Loader2 className="animate-spin text-emerald-500" size={24} /><p className="text-[10px] font-black uppercase tracking-widest">Optimizing Substitution...</p>
                  </div>
                ) : aiSwapSuggestions.length > 0 ? (
                  <div className="space-y-3">
                    {aiSwapSuggestions.map((alt, i) => (
                      <button key={i} onClick={() => performSwap(swappingExerciseId, alt)} className="w-full text-left p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all group">
                        <div className="flex justify-between items-center mb-1">
                          <h5 className="font-black text-emerald-400 text-sm">{alt.name}</h5>
                          <ArrowRight size={14} className="text-emerald-500/30 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <p className="text-[10px] text-slate-400 italic">"{alt.rationale}"</p>
                      </button>
                    ))}
                  </div>
                ) : <p className="text-center py-4 text-xs text-slate-600 font-bold italic">No recommendations found.</p>}
              </section>

              <section className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <BookOpen size={14} className="text-cyan-400" /> Manual Library Filter
                </h4>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Search relevant exercises..."
                    value={swapSearch}
                    onChange={(e) => setSwapSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 pl-11 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-slate-800"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
                </div>
                <div className="space-y-2">
                  {libraryForSwap.map(item => (
                    <button 
                      key={item.name}
                      onClick={() => performSwap(swappingExerciseId, item)}
                      className="w-full text-left p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-slate-700 hover:bg-slate-900 transition-all flex items-center justify-between group"
                    >
                      <span className="text-sm font-black text-slate-200">{item.name}</span>
                      <Plus size={16} className="text-slate-700 group-hover:text-emerald-400" />
                    </button>
                  ))}
                  {libraryForSwap.length === 0 && swapSearch && (
                    <p className="text-center py-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest">No matching movements found</p>
                  )}
                </div>
              </section>
            </div>
            <div className="p-6 border-t border-slate-800 bg-slate-900/80 shrink-0">
              <button 
                onClick={() => setSwappingExerciseId(null)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl transition-all uppercase tracking-widest text-[10px]"
              >
                Keep Existing Strategy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Exercise Modal */}
      {isAddingExercise && (
        <div className="fixed inset-0 z-[160] bg-slate-950/95 backdrop-blur-2xl p-4 sm:p-8 flex items-center justify-center animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400"><Plus size={20} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-100 tracking-tight">Add Exercise</h3>
                  <p className="text-standard-label text-slate-500">Inject Movement into Flow</p>
                </div>
              </div>
              <button onClick={() => setIsAddingExercise(false)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all"><X size={20} /></button>
            </div>

            <div className="flex p-1 bg-slate-950/60 mx-6 mt-6 rounded-2xl border border-slate-800/80 shrink-0">
              <button onClick={() => setAddMode('ai')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${addMode === 'ai' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>AI Assistant</button>
              <button onClick={() => setAddMode('manual')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${addMode === 'manual' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Manual Library</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {addMode === 'ai' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <textarea value={addPrompt} onChange={(e) => setAddPrompt(e.target.value)} placeholder="e.g., 'Add a heavy back finisher' or 'Something for side delts'..." className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-100 placeholder:text-slate-800 focus:ring-1 focus:ring-emerald-500/30 outline-none resize-none" />
                    <button onClick={handleAiAdd} disabled={isAiAdding || !addPrompt.trim()} className="absolute bottom-4 right-4 p-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl shadow-xl shadow-emerald-500/20 disabled:opacity-50 transition-all">
                      {isAiAdding ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <input type="text" placeholder="Search movements..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 pl-11 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-slate-800" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'].map(cat => (
                      <button key={cat} onClick={() => setAddCategory(cat)} className={`shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${addCategory === cat ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}>{cat}</button>
                    ))}
                  </div>
                  <div className="grid gap-2">
                    {fullLibrary.filter(item => (addCategory === 'All' || item.category === addCategory) && item.name.toLowerCase().includes(addSearch.toLowerCase())).map(item => (
                      <button key={item.name} onClick={() => addNewExercise(item)} className="w-full text-left p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-emerald-500/30 transition-all flex items-center justify-between group">
                        <div>
                          <p className="text-sm font-black text-slate-200">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{item.category}</p>
                        </div>
                        <Plus size={18} className="text-slate-700 group-hover:text-emerald-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingDetailsFor && (
        <div className="fixed inset-0 z-[150] bg-slate-950/95 backdrop-blur-xl flex flex-col p-4 overflow-y-auto">
          <div className="w-full max-w-4xl mx-auto">
            <div className="flex justify-end mb-4"><button onClick={() => setViewingDetailsFor(null)} className="p-3 bg-slate-900 rounded-2xl"><X size={20}/></button></div>
            <ExerciseDetailContent item={viewingDetailsFor} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveWorkout;