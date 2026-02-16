
import React, { useState, useEffect, useRef } from 'react';
import { Plus, History, Play, Dumbbell, Trophy, Layout, ChevronRight, Timer as TimerIcon, Bot, CheckCircle2, Menu, X, BookOpen, Settings, Search, Trash2, FileText, Download, Upload, Activity, Wifi, WifiOff, RotateCcw, Wand2, Sparkles, ShieldCheck, Database, Zap, ArrowRight, Loader2 } from 'lucide-react';
import { WorkoutSession, WorkoutTemplate, HistoricalLog, Exercise, SetLog, UserSettings, ExerciseLibraryItem, BiometricEntry, FuelLog, FuelProfile } from './types';
import { GeminiService } from './services/geminiService';
import { storage } from './services/storageService';
import ActiveWorkout from './components/ActiveWorkout';
import ProgramCreator from './components/ProgramCreator';
import WorkoutHistory from './components/WorkoutHistory';
import ExerciseLibrary, { DEFAULT_LIBRARY } from './components/ExerciseLibrary';
import TemplateEditor from './components/TemplateEditor';
import WorkoutDiscovery from './components/WorkoutDiscovery';
import TrashCan from './components/TrashCan';
import CSVManager from './components/CSVManager';
import SettingsModal from './components/SettingsModal';
import BackupManager from './components/BackupManager';

const INITIAL_HISTORY_TEXT = `Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time`;

const DEFAULT_SETTINGS: UserSettings = {
  units: 'metric',
  autoPopulateCount: 200,
  includedBodyParts: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Abs'],
  defaultRestTimer: 90,
  enableWakeLock: true,
  enableAutoBackup: false,
  dateOfBirth: ''
};

const DEFAULT_FUEL_PROFILE: FuelProfile = {
  goal: 'Maintenance',
  preferences: [],
  targetProteinRatio: 1.2
};

const parseNumericReps = (repsString: string | number | undefined): number => {
  if (typeof repsString === 'number') return repsString;
  if (!repsString) return 0;
  const match = repsString.toString().match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

const App: React.FC = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [showBridge, setShowBridge] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'plan' | 'active' | 'history'>('plan');
  const [history, setHistory] = useState<HistoricalLog[]>([]);
  const [biometricHistory, setBiometricHistory] = useState<BiometricEntry[]>([]);
  const [fuelHistory, setFuelHistory] = useState<FuelLog[]>([]);
  const [fuelProfile, setFuelProfile] = useState<FuelProfile>(DEFAULT_FUEL_PROFILE);
  const [savedTemplates, setSavedTemplates] = useState<WorkoutTemplate[]>([]);
  const [deletedTemplates, setDeletedTemplates] = useState<WorkoutTemplate[]>([]);
  const [customLibrary, setCustomLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [deletedExercises, setDeletedExercises] = useState<ExerciseLibraryItem[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [historyViewInitial, setHistoryViewInitial] = useState<'performance' | 'fuel' | 'biometrics'>('performance');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [undoToast, setUndoToast] = useState<{ id: string; name: string } | null>(null);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isCSVOpen, setIsCSVOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const aiService = useRef(new GeminiService());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Neural Core Hydration Sequence
  useEffect(() => {
    const hydrate = async () => {
      try {
        await storage.init();
        
        // 1. Check for legacy data if Neural Core is empty
        const keysInIDB = await storage.getAllKeys();
        const hasLegacyData = localStorage.getItem('ironflow_history') || localStorage.getItem('ironflow_settings');
        
        if (keysInIDB.length === 0 && hasLegacyData) {
          setShowBridge(true);
          return; // Wait for user choice
        }

        // 2. Fetch all modules from Neural Core
        const [
          storedHistory, 
          storedBiometrics, 
          storedFuel, 
          storedFuelProfile,
          storedTemplates,
          storedTrash,
          storedLibrary,
          storedDeletedEx,
          storedSettings
        ] = await Promise.all([
          storage.get<HistoricalLog[]>('ironflow_history'),
          storage.get<BiometricEntry[]>('ironflow_biometrics'),
          storage.get<FuelLog[]>('ironflow_fuel'),
          storage.get<FuelProfile>('ironflow_fuel_profile'),
          storage.get<WorkoutTemplate[]>('ironflow_templates'),
          storage.get<WorkoutTemplate[]>('ironflow_trash'),
          storage.get<ExerciseLibraryItem[]>('ironflow_library'),
          storage.get<ExerciseLibraryItem[]>('ironflow_deleted_exercises'),
          storage.get<UserSettings>('ironflow_settings')
        ]);

        if (storedHistory) setHistory(storedHistory);
        else {
          const lines = INITIAL_HISTORY_TEXT.split('\n').slice(1);
          setHistory(lines.map(line => {
            const parts = line.split(',');
            return {
              date: parts[0], exercise: parts[1], category: parts[2],
              weight: parseFloat(parts[3]) || 0, unit: parts[4], reps: parseInt(parts[5]) || 0,
              isWarmup: false
            };
          }).filter(p => p.exercise));
        }

        if (storedBiometrics) setBiometricHistory(storedBiometrics);
        if (storedFuel) setFuelHistory(storedFuel);
        if (storedFuelProfile) setFuelProfile(storedFuelProfile);
        if (storedTemplates) setSavedTemplates(storedTemplates);
        if (storedTrash) setDeletedTemplates(storedTrash);
        if (storedLibrary) setCustomLibrary(storedLibrary);
        if (storedDeletedEx) setDeletedExercises(storedDeletedEx);
        if (storedSettings) setUserSettings({ ...DEFAULT_SETTINGS, ...storedSettings });

        setIsHydrated(true);
      } catch (e) {
        console.error("Hydration Critical Failure:", e);
        // Fallback or watchdog UI handles this via recovery-mask in index.html
      }
    };
    hydrate();
  }, []);

  // Neural Bridge Migration Trigger
  const handleBridgeMigration = async () => {
    setIsBridging(true);
    try {
      const keysToMigrate = [
        'ironflow_history', 'ironflow_biometrics', 'ironflow_templates', 
        'ironflow_trash', 'ironflow_library', 'ironflow_deleted_exercises', 
        'ironflow_settings', 'ironflow_morphology', 'ironflow_fuel', 'ironflow_fuel_profile'
      ];
      
      const payload: Record<string, any> = {};
      keysToMigrate.forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw) {
          try { payload[key] = JSON.parse(raw); } catch(e) { payload[key] = raw; }
        }
      });

      await storage.setBulk(payload);
      await storage.set('migration_v2_complete', true);
      
      setShowBridge(false);
      window.location.reload(); // Hard reload to fresh hydrate
    } catch (e) {
      alert("Neural Bridge failed. Please ensure your browser supports IndexedDB.");
    } finally {
      setIsBridging(false);
    }
  };

  const handleStartFresh = async () => {
    await storage.set('migration_v2_complete', true);
    setShowBridge(false);
    setIsHydrated(true);
  };

  // Synchronized Neural Persistence
  useEffect(() => { if (isHydrated) storage.set('ironflow_history', history); }, [history, isHydrated]);
  useEffect(() => { if (isHydrated) storage.set('ironflow_biometrics', biometricHistory); }, [biometricHistory, isHydrated]);
  useEffect(() => { if (isHydrated) storage.set('ironflow_fuel', fuelHistory); }, [fuelHistory, isHydrated]);
  useEffect(() => { if (isHydrated) storage.set('ironflow_fuel_profile', fuelProfile); }, [fuelProfile, isHydrated]);
  useEffect(() => { if (isHydrated) storage.set('ironflow_templates', savedTemplates); }, [savedTemplates, isHydrated]);
  useEffect(() => { if (isHydrated) storage.set('ironflow_trash', deletedTemplates); }, [deletedTemplates, isHydrated]);
  useEffect(() => { if (isHydrated) storage.set('ironflow_library', customLibrary); }, [customLibrary, isHydrated]);
  useEffect(() => { if (isHydrated) storage.set('ironflow_deleted_exercises', deletedExercises); }, [deletedExercises, isHydrated]);
  useEffect(() => { if (isHydrated) storage.set('ironflow_settings', userSettings); }, [userSettings, isHydrated]);

  // Automatic Neural Core Checkpoint
  useEffect(() => {
    if (isHydrated && userSettings.enableAutoBackup) {
      const checkCheckpoint = async () => {
        const lastCheckpoint = await storage.get<string>('ironflow_last_checkpoint_time');
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (!lastCheckpoint || now - parseInt(lastCheckpoint) > twentyFourHours) {
          const snapshot = {
            history, biometricHistory, fuelHistory, fuelProfile,
            savedTemplates, customLibrary, userSettings
          };
          await storage.set('ironflow_auto_checkpoint', snapshot);
          await storage.set('ironflow_last_checkpoint_time', now.toString());
          console.debug('Neural Core automatic checkpoint committed.');
        }
      };
      checkCheckpoint();
    }
  }, [isHydrated, userSettings.enableAutoBackup]);

  const getWeightRecommendation = (exName: string, category: string, history: HistoricalLog[], templateWeight: number, lastRefreshed?: number) => {
    const unit = userSettings.units === 'metric' ? 'kg' : 'lb';
    const isFresh = lastRefreshed && (Date.now() - lastRefreshed < 24 * 60 * 60 * 1000);

    if (isFresh && templateWeight > 0) {
      return { weight: templateWeight, reason: `Using AI-optimized target of ${templateWeight}${unit} (Refreshed < 24h).` };
    }

    const exactHistory = history
      .filter(h => h.exercise.toLowerCase() === exName.toLowerCase() && !h.isWarmup)
      .sort((a, b) => (b.completedAt || new Date(b.date).getTime()) - (a.completedAt || new Date(a.date).getTime()));
    
    if (exactHistory.length > 0) {
      const hWeight = exactHistory[0].weight;
      return { weight: hWeight, reason: `Using ${hWeight}${unit} based on your last session for this exercise.` };
    }

    if (templateWeight > 0) {
      return { weight: templateWeight, reason: `Using suggested target of ${templateWeight}${unit} (AI optimized).` };
    }

    const similarHistory = history
      .filter(h => h.category.toLowerCase() === category.toLowerCase() && !h.isWarmup)
      .sort((a, b) => (b.completedAt || new Date(b.date).getTime()) - (a.completedAt || new Date(a.date).getTime()));

    if (similarHistory.length > 0) {
      const hWeight = similarHistory[0].weight;
      return { weight: hWeight, reason: `Based on your similar ${category} performance (${similarHistory[0].exercise}: ${hWeight}${unit}).` };
    }

    const safeWeight = 5;
    return { weight: safeWeight, reason: `Suggested starting weight of ${safeWeight}${unit} (no history found for this category).` };
  };

  const startSession = (template: WorkoutTemplate) => {
    const unitPreference = userSettings.units === 'metric' ? 'kgs' : 'lbs';
    const newSession: WorkoutSession = {
      id: Date.now().toString(),
      name: template.name,
      startTime: Date.now(),
      status: 'active',
      exercises: template.exercises.map(ex => {
        const { weight: workingWeight, reason } = getWeightRecommendation(ex.name, ex.category, history, ex.suggestedWeight, template.lastRefreshed);
        const totalSets = ex.suggestedSets || 3;
        const sets: SetLog[] = [];
        const resolvedReps = ex.suggestedReps || parseNumericReps(ex.targetReps);

        let warmupCount = totalSets >= 3 ? 2 : 0;
        let finalWorkSetsCount = totalSets - warmupCount;

        for (let i = 0; i < warmupCount; i++) {
          sets.push({ id: Math.random().toString(36).substr(2, 9), weight: workingWeight * 0.5, reps: 12, unit: unitPreference, timestamp: 0, completed: false, isWarmup: true });
        }
        for (let i = 0; i < finalWorkSetsCount; i++) {
          sets.push({ id: Math.random().toString(36).substr(2, 9), weight: workingWeight, reps: resolvedReps, unit: unitPreference, timestamp: 0, completed: false, isWarmup: false });
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          name: ex.name,
          category: ex.category,
          targetReps: ex.targetReps,
          suggestedWeight: workingWeight,
          suggestedReps: resolvedReps,
          rationale: `${reason} ${ex.rationale || ''}`.trim(),
          sets
        };
      })
    };
    setActiveSession(newSession);
    setActiveTab('active');
    setIsDiscoveryOpen(false);
  };

  const completeWorkout = (session: WorkoutSession) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const endTime = Date.now();
    const duration = endTime - session.startTime;
    
    const sortedBiometrics = [...biometricHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latestWeight = sortedBiometrics[0]?.weight || 75;
    
    const newLogs: HistoricalLog[] = session.exercises.flatMap(ex => 
      ex.sets.filter(s => s.completed).map(s => ({
        date: today,
        exercise: ex.name,
        category: ex.category,
        weight: s.weight,
        unit: s.unit,
        reps: s.reps,
        completedAt: s.timestamp || Date.now(),
        isWarmup: !!s.isWarmup,
        sessionDuration: duration,
        weightAtTime: latestWeight
      }))
    );
    setHistory(prev => [...newLogs, ...prev]);
    setActiveSession(null);
    setLastSessionDate(today); 
    setActiveTab('history');
    setHistoryViewInitial('performance');
  };

  const updateHistoryLogs = (date: string, newLogs: HistoricalLog[]) => {
    setHistory(prev => {
      const filtered = prev.filter(h => h.date !== date);
      return [...newLogs, ...filtered];
    });
  };

  const saveTemplate = (template: WorkoutTemplate) => {
    const newTemplate = { ...template, id: template.id || Date.now().toString() };
    setSavedTemplates(prev => {
      const existing = prev.find(t => t.id === newTemplate.id);
      if (existing) return prev.map(t => t.id === newTemplate.id ? newTemplate : t);
      return [...prev, newTemplate];
    });
  };

  const deleteTemplate = (id: string) => {
    const templateToDelete = savedTemplates.find(t => String(t.id) === String(id));
    if (templateToDelete) {
      setSavedTemplates(prev => prev.filter(t => String(t.id) !== String(id)));
      setDeletedTemplates(prev => [...prev, templateToDelete]);
      setUndoToast({ id: String(templateToDelete.id), name: templateToDelete.name });
      setTimeout(() => setUndoToast(null), 5000);
    }
  };

  const restoreTemplate = (id: string) => {
    const templateToRestore = deletedTemplates.find(t => String(t.id) === String(id));
    if (templateToRestore) {
      setDeletedTemplates(prev => prev.filter(t => String(t.id) !== String(id)));
      setSavedTemplates(prev => [...prev, templateToRestore]);
      setUndoToast(null);
    }
  };

  const updateTemplate = (updated: WorkoutTemplate) => {
    setSavedTemplates(prev => prev.map(t => String(t.id) === String(updated.id) ? updated : t));
    setEditingTemplate(null);
  };

  const handleImport = (newLogs: HistoricalLog[], mode: 'overwrite' | 'merge' | 'ignore') => {
    if (mode === 'overwrite') {
      const datesToOverwrite = new Set(newLogs.map(l => l.date));
      setHistory(prev => [...newLogs, ...prev.filter(h => !datesToOverwrite.has(h.date))]);
    } else {
      setHistory(prev => [...newLogs, ...prev]);
    }
  };

  // Neural Bridge Migration UI Component
  if (showBridge) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl space-y-8 animate-in zoom-in-95 duration-500">
           <div className="relative inline-block">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
              <div className="relative w-24 h-24 bg-slate-950 border-4 border-slate-800 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                 <Database className="text-emerald-400" size={40} />
              </div>
           </div>
           
           <div className="space-y-3">
              <h2 className="text-3xl font-black text-slate-100 uppercase tracking-tighter">Neural Core v2.0</h2>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em]">High-Resolution Storage Upgrade</p>
           </div>

           <p className="text-sm text-slate-400 leading-relaxed italic">
             IronFlow is upgrading its cognitive architecture. We've detected legacy data in your browser. Would you like to bridge this to the new high-performance Neural Core?
           </p>

           <div className="space-y-4">
              <button 
                onClick={handleBridgeMigration}
                disabled={isBridging}
                className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-3xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-[12px] active:scale-95"
              >
                {isBridging ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} fill="currentColor" />}
                Bridge Legacy Records
              </button>
              <button 
                onClick={handleStartFresh}
                className="w-full py-4 text-slate-600 hover:text-slate-400 font-black uppercase tracking-widest text-[10px] transition-all"
              >
                Start Fresh Protocol
              </button>
           </div>

           <div className="pt-4 flex items-center gap-3 justify-center text-[10px] font-black text-slate-700 uppercase tracking-widest">
              <ShieldCheck size={14} className="text-slate-800" />
              Local-First Encryption Active
           </div>
        </div>
      </div>
    );
  }

  // Loading / Hydration Watchdog
  if (!isHydrated) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center">
         <div className="w-16 h-16 border-4 border-slate-800 border-t-emerald-400 rounded-full animate-spin" />
         <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mt-8 ai-loading-pulse">Hydrating Neural Core...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-slate-950 text-slate-100 flex flex-col items-center">
      <header className="w-full max-w-2xl px-6 py-8 flex justify-between items-center relative z-[60]">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">IronFlow</h1>
            <p className="text-slate-400 text-sm font-medium">AI Coaching Companion</p>
          </div>
          <div className={`p-1.5 rounded-full border transition-colors ${isOnline ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' : 'border-rose-500/20 text-rose-500 bg-rose-500/5'}`}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          </div>
        </div>
        {!activeSession && (
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-emerald-400 transition-all">
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}
        {isMenuOpen && !activeSession && (
          <div className="absolute top-24 right-6 w-56 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => { setIsDiscoveryOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Search size={18} className="text-emerald-400" /><span className="text-sm font-bold">Find a Workout</span></button>
            <button onClick={() => { setEditingTemplate({ name: "Manual Workout", exercises: [] }); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Plus size={18} className="text-emerald-400" /><span className="text-sm font-bold">New Manual Template</span></button>
            <button onClick={() => { setIsLibraryOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><BookOpen size={18} className="text-emerald-400" /><span className="text-sm font-bold">Exercise Library</span></button>
            <button onClick={() => { setIsBackupOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><ShieldCheck size={18} className="text-emerald-400" /><span className="text-sm font-bold">IronVault Backup</span></button>
            <button onClick={() => { setIsCSVOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><FileText size={18} className="text-emerald-400" /><span className="text-sm font-bold">Manage Data (CSV)</span></button>
            <button onClick={() => { setIsTrashOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Trash2 size={18} className="text-rose-400" /><span className="text-sm font-bold">Trash Can</span></button>
            <button onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-800 flex items-center gap-3 text-slate-200"><Settings size={18} className="text-emerald-400" /><span className="text-sm font-bold">Settings</span></button>
          </div>
        )}
      </header>
      
      {/* Undo Toast */}
      {undoToast && (
        <div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-[70] w-full max-sm px-4 animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg"><Trash2 size={16}/></div>
              <p className="text-xs font-bold text-slate-200 truncate max-w-[180px]">Deleted "{undoToast.name}"</p>
            </div>
            <button onClick={() => restoreTemplate(undoToast.id)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all">
              <RotateCcw size={12}/> Undo
            </button>
          </div>
        </div>
      )}

      {isLibraryOpen && <ExerciseLibrary onClose={() => setIsLibraryOpen(false)} aiService={aiService.current} userSettings={userSettings} customLibrary={customLibrary} deletedExercises={deletedExercises} onUpdateCustomLibrary={setCustomLibrary} onDeleteExercise={(ex) => setDeletedExercises(p => [...p, ex])} />}
      {isDiscoveryOpen && <WorkoutDiscovery onClose={() => setIsDiscoveryOpen(false)} onStart={startSession} onSave={saveTemplate} aiService={aiService.current} history={history} />}
      {isTrashOpen && <TrashCan templates={deletedTemplates} exercises={deletedExercises} onClose={() => setIsTrashOpen(false)} onRestore={restoreTemplate} onPermanentlyDelete={(id) => setDeletedTemplates(p => p.filter(t => String(t.id) !== String(id)))} onRestoreExercise={(n) => setDeletedExercises(p => p.filter(e => e.name !== n))} onPermanentlyDeleteExercise={(n) => setDeletedExercises(p => p.filter(e => e.name !== n))} onEmpty={() => { setDeletedTemplates([]); setDeletedExercises([]); }} />}
      {isCSVOpen && <CSVManager history={history} onImport={handleImport} onClose={() => setIsCSVOpen(false)} aiService={aiService.current} />}
      {isBackupOpen && <BackupManager onClose={() => setIsBackupOpen(false)} />}
      {isSettingsOpen && <SettingsModal settings={userSettings} onSave={(s) => { setUserSettings(s); setIsSettingsOpen(false); }} onClose={() => setIsSettingsOpen(false)} aiService={aiService.current} onUpdateCustomLibrary={setCustomLibrary} />}
      {editingTemplate && <TemplateEditor template={editingTemplate} onSave={updateTemplate} onClose={() => setEditingTemplate(null)} aiService={aiService.current} userSettings={userSettings} />}
      
      <main className="w-full max-w-2xl px-4 flex-grow">
        {activeTab === 'plan' && (
          <ProgramCreator 
            onStart={startSession} 
            onSaveTemplate={saveTemplate} 
            onDeleteTemplate={deleteTemplate} 
            onEditTemplate={setEditingTemplate} 
            savedTemplates={savedTemplates} 
            history={history} 
            aiService={aiService.current}
            customLibrary={customLibrary}
          />
        )}
        {activeTab === 'active' && activeSession && (
          <ActiveWorkout 
            session={activeSession} 
            onComplete={completeWorkout} 
            onAbort={() => { setActiveSession(null); setActiveTab('plan'); }} 
            history={history} 
            aiService={aiService.current} 
            userSettings={userSettings} 
            customLibrary={customLibrary} 
            onUpdateCustomLibrary={setCustomLibrary}
          />
        )}
        {activeTab === 'active' && !activeSession && <div className="flex flex-col items-center justify-center py-20 text-center"><div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-slate-800"><Dumbbell className="text-slate-600" size={40} /></div><h3 className="text-xl font-bold mb-2 text-slate-100">No Active Session</h3><p className="text-slate-400 mb-6">Start a program or an ad-hoc session.</p><button onClick={() => startSession({ name: 'Ad-hoc Session', exercises: [] })} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold transition-all text-slate-950">Ad-hoc Session</button></div>}
        {activeTab === 'history' && (
          <WorkoutHistory 
            history={history} 
            biometricHistory={biometricHistory} 
            onSaveBiometrics={setBiometricHistory} 
            fuelHistory={fuelHistory}
            onSaveFuel={setFuelHistory}
            fuelProfile={fuelProfile}
            onSaveFuelProfile={setFuelProfile}
            aiService={aiService.current} 
            onSaveTemplate={saveTemplate} 
            userSettings={userSettings} 
            lastSessionDate={lastSessionDate} 
            onClearLastSession={() => setLastSessionDate(null)} 
            initialView={historyViewInitial} 
            onViewChange={setHistoryViewInitial}
            onResetInitialView={() => setHistoryViewInitial('performance')} 
            onUpdateHistory={updateHistoryLogs} 
          />
        )}
      </main>

      {!activeSession && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 nav-safe-padding px-6 pt-4 flex justify-around items-center z-50">
          <button onClick={() => setActiveTab('plan')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'plan' ? 'text-emerald-400 scale-110' : 'text-slate-500 hover:text-slate-400'}`}><Layout size={24} /><span className="text-[10px] font-bold uppercase tracking-widest">Plan</span></button>
          <button onClick={() => setActiveTab('active')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'active' ? 'text-emerald-400 scale-110' : 'text-slate-500 hover:text-slate-400'}`}><Dumbbell size={24} /><span className="text-[10px] font-bold uppercase tracking-widest">Workout</span></button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'text-emerald-400 scale-110' : 'text-slate-500 hover:text-slate-400'}`}><History size={24} /><span className="text-[10px] font-bold uppercase tracking-widest">Stats</span></button>
        </nav>
      )}
    </div>
  );
};

export default App;
