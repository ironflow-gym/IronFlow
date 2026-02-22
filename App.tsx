import React, { useState, useEffect, useRef } from 'react';
import { Plus, History, Play, Dumbbell, Trophy, Layout, ChevronRight, Timer as TimerIcon, Bot, CheckCircle2, Menu, X, BookOpen, Settings, Search, Trash2, FileText, Download, Upload, Activity, Wifi, WifiOff, RotateCcw, Wand2, Sparkles, ShieldCheck, Database, Zap, ArrowRight, Loader2, Cloud, Utensils } from 'lucide-react';
import { WorkoutSession, WorkoutTemplate, HistoricalLog, Exercise, SetLog, UserSettings, ExerciseLibraryItem, BiometricEntry, FuelLog, FuelProfile, IronSyncStatus, FoodItem } from './types';
import { GeminiService } from './services/geminiService';
import { storage } from './services/storageService';
import { ironSync } from './services/ironSyncService';
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
import FoodPantry from './components/FoodPantry';

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

// High-entropy ID generation
const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

const App: React.FC = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hydrationText, setHydrationText] = useState('Hydrating Neural Core...');
  const [showBridge, setShowBridge] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'plan' | 'active' | 'history'>('plan');
  const [history, setHistory] = useState<HistoricalLog[]>([]);
  const [biometricHistory, setBiometricHistory] = useState<BiometricEntry[]>([]);
  const [fuelHistory, setFuelHistory] = useState<FuelLog[]>([]);
  const [fuelProfile, setFuelProfile] = useState<FuelProfile>(DEFAULT_FUEL_PROFILE);
  const [sessionSummaries, setSessionSummaries] = useState<Record<string, string>>({});
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
  
  const [syncStatus, setSyncStatus] = useState<IronSyncStatus>('disconnected');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isCSVOpen, setIsCSVOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isPantryOpen, setIsPantryOpen] = useState(false);
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

  // Neural Core Hydration & IronSync Handshake
  useEffect(() => {
    const hydrate = async () => {
      try {
        await storage.init();
        const keysInIDB = await storage.getAllKeys();
        const hasLegacyData = localStorage.getItem('ironflow_history') || localStorage.getItem('ironflow_settings');
        if (keysInIDB.length === 0 && hasLegacyData) { setShowBridge(true); return; }

        const storedSettings = await storage.get<UserSettings>('ironflow_settings');
        let initialSettings = mergedSettingsWithDefault(storedSettings);
        setUserSettings(initialSettings);

        if (initialSettings.ironSyncConnected && navigator.onLine) {
          setSyncStatus('transmitting');
          // Non-blocking background check to prevent boot hang
          ironSync.authorize(false)
            .then(() => setSyncStatus('connected'))
            .catch(() => {
              console.debug('Silent IronSync check bypassed (no active session).');
              setSyncStatus('pending');
            });
        } else if (initialSettings.ironSyncConnected) {
          setSyncStatus('pending');
        }

        await refreshLocalState();

        // Check for API Key if platform key is missing
        if (!process.env.API_KEY) {
          const hasSelected = window.aistudio ? await window.aistudio.hasSelectedApiKey() : false;
          if (!hasSelected) {
            setNeedsApiKey(true);
            return;
          }
        }

        // Small delay to ensure React has flushed state updates from refreshLocalState
        // before we enable the auto-save effects.
        setTimeout(() => setIsHydrated(true), 200);
      } catch (e) {
        console.error("Hydration Critical Failure:", e);
        await refreshLocalState().catch(() => {});
        setTimeout(() => setIsHydrated(true), 200);
      }
    };
    hydrate();
  }, []);

  const mergedSettingsWithDefault = (stored: any): UserSettings => {
    return { ...DEFAULT_SETTINGS, ...stored };
  };

  const refreshLocalState = async () => {
    const [
      storedHistory, storedBiometrics, storedFuel, storedFuelProfile,
      storedTemplates, storedTrash, storedLibrary, storedDeletedEx,
      storedActiveSession, storedSummaries, storedPantry
    ] = await Promise.all([
      storage.get<HistoricalLog[]>('ironflow_history'),
      storage.get<BiometricEntry[]>('ironflow_biometrics'),
      storage.get<FuelLog[]>('ironflow_fuel'),
      storage.get<FuelProfile>('ironflow_fuel_profile'),
      storage.get<WorkoutTemplate[]>('ironflow_templates'),
      storage.get<WorkoutTemplate[]>('ironflow_trash'),
      storage.get<ExerciseLibraryItem[]>('ironflow_library'),
      storage.get<ExerciseLibraryItem[]>('ironflow_deleted_exercises'),
      storage.get<WorkoutSession>('ironflow_active_session'),
      storage.get<Record<string, string>>('ironflow_narrative_vault'),
      storage.get<FoodItem[]>('ironflow_pantry')
    ]);

    if (storedHistory) setHistory(storedHistory);
    if (storedBiometrics) setBiometricHistory(storedBiometrics);
    if (storedFuel) setFuelHistory(storedFuel);
    if (storedFuelProfile) setFuelProfile(storedFuelProfile);
    if (storedSummaries) setSessionSummaries(storedSummaries);
    if (storedTemplates) setSavedTemplates(storedTemplates);
    if (storedTrash) setDeletedTemplates(storedTrash);
    if (storedLibrary) setCustomLibrary(storedLibrary);
    if (storedDeletedEx) setDeletedExercises(storedDeletedEx);
    if (storedActiveSession) {
      setActiveSession(storedActiveSession);
      setActiveTab('active');
    }
  };

  const handleBridgeMigration = async () => {
    setIsBridging(true);
    try {
      const keysToMigrate = [
        'ironflow_history', 'ironflow_biometrics', 'ironflow_templates', 
        'ironflow_trash', 'ironflow_library', 'ironflow_deleted_exercises', 
        'ironflow_settings', 'ironflow_morphology', 'ironflow_fuel', 'ironflow_fuel_profile',
        'ironflow_narrative_vault', 'ironflow_pantry'
      ];
      const payload: Record<string, any> = {};
      keysToMigrate.forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw) { try { payload[key] = JSON.parse(raw); } catch(e) { payload[key] = raw; } }
      });
      await storage.setBulk(payload);
      await storage.set('migration_v2_complete', true);
      setShowBridge(false);
      window.location.reload();
    } catch (e) { alert("Neural Bridge failed."); } finally { setIsBridging(false); }
  };

  const handleStartFresh = async () => {
    await storage.set('migration_v2_complete', true);
    setShowBridge(false);
    
    // Check for API Key after bridge decision
    if (!process.env.GEMINI_API_KEY) {
      const hasSelected = await window.aistudio.hasSelectedApiKey();
      if (!hasSelected) {
        setNeedsApiKey(true);
        return;
      }
    }
    
    setIsHydrated(true);
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setNeedsApiKey(false);
      setIsHydrated(true);
    } else {
      alert("API Key selection is only available within the AI Studio environment. For external deployments, please provide a GEMINI_API_KEY environment variable during build.");
    }
  };

  const triggerSync = async (overrideSettings?: UserSettings) => {
    const settings = overrideSettings || userSettings;
    if (!settings.ironSyncConnected) {
      setSyncStatus('disconnected');
      return;
    }
    if (!isOnline || !ironSync.hasValidToken()) {
      setSyncStatus('pending');
      return;
    }
    setSyncStatus('transmitting');
    try {
      const lastSync = await ironSync.uploadMirror();
      setUserSettings(prev => ({ ...prev, lastCloudSync: lastSync }));
      setSyncStatus('connected');
    } catch (e) {
      console.warn("Background IronSync failed:", e);
      setSyncStatus('error');
    }
  };

  useEffect(() => { if (isHydrated && !isRestoring) storage.set('ironflow_history', history); }, [history, isHydrated, isRestoring]);
  useEffect(() => { if (isHydrated && !isRestoring) storage.set('ironflow_biometrics', biometricHistory); }, [biometricHistory, isHydrated, isRestoring]);
  useEffect(() => { if (isHydrated && !isRestoring) storage.set('ironflow_fuel', fuelHistory); }, [fuelHistory, isHydrated, isRestoring]);
  useEffect(() => { if (isHydrated && !isRestoring) storage.set('ironflow_fuel_profile', fuelProfile); }, [fuelProfile, isHydrated, isRestoring]);
  useEffect(() => { if (isHydrated && !isRestoring) storage.set('ironflow_narrative_vault', sessionSummaries); }, [sessionSummaries, isHydrated, isRestoring]);
  useEffect(() => { if (isHydrated && !isRestoring) storage.set('ironflow_templates', savedTemplates); }, [savedTemplates, isHydrated, isRestoring]);
  useEffect(() => { if (isHydrated && !isRestoring) storage.set('ironflow_trash', deletedTemplates); }, [deletedTemplates, isHydrated, isRestoring]);
  useEffect(() => { if (isHydrated && !isRestoring) storage.set('ironflow_library', customLibrary); }, [customLibrary, isHydrated, isRestoring]);
  useEffect(() => { if (isHydrated && !isRestoring) storage.set('ironflow_deleted_exercises', deletedExercises); }, [deletedExercises, isHydrated, isRestoring]);
  useEffect(() => { if (isHydrated && !isRestoring) storage.set('ironflow_settings', userSettings); }, [userSettings, isHydrated, isRestoring]);
  useEffect(() => { if (isHydrated && !isRestoring) { if (activeSession) storage.set('ironflow_active_session', activeSession); else storage.remove('ironflow_active_session'); } }, [activeSession, isHydrated, isRestoring]);

  const getWeightRecommendation = (exName: string, category: string, history: HistoricalLog[], templateWeight: number, lastRefreshed?: number) => {
    const unit = userSettings.units === 'metric' ? 'kg' : 'lb';
    const isMetric = userSettings.units === 'metric';
    const bilateralRegex = /(barbell|squat|bench|deadlift|press|hack|row|leg press)/i;
    const isBilateral = bilateralRegex.test(exName);
    const resolution = isMetric ? (isBilateral ? 2.5 : 1.25) : (isBilateral ? 5.0 : 2.5);
    const snap = (w: number) => Math.round(w / resolution) * resolution;
    const isFresh = lastRefreshed && (Date.now() - lastRefreshed < 24 * 60 * 60 * 1000);
    if (isFresh && templateWeight > 0) { const rounded = snap(templateWeight); return { weight: rounded, reason: `Using AI-optimized target of ${rounded}${unit} (Refreshed < 24h).` }; }
    const exactHistory = history.filter(h => h.exercise.toLowerCase() === exName.toLowerCase() && !h.isWarmup).sort((a, b) => (b.completedAt || new Date(b.date).getTime()) - (a.completedAt || new Date(a.date).getTime()));
    if (exactHistory.length > 0) { const rounded = snap(exactHistory[0].weight); return { weight: rounded, reason: `Using ${rounded}${unit} based on your last session for this exercise.` }; }
    if (templateWeight > 0) { const rounded = snap(templateWeight); return { weight: rounded, reason: `Using suggested target of ${rounded}${unit} (AI optimized).` }; }
    const similarHistory = history.filter(h => h.category.toLowerCase() === category.toLowerCase() && !h.isWarmup).sort((a, b) => (b.completedAt || new Date(b.date).getTime()) - (a.completedAt || new Date(a.date).getTime()));
    if (similarHistory.length > 0) { const rounded = snap(similarHistory[0].weight); return { weight: rounded, reason: `Based on your similar ${category} performance (${similarHistory[0].exercise}: ${rounded}${unit}).` }; }
    const safeWeight = snap(5); return { weight: safeWeight, reason: `Suggested starting weight of ${safeWeight}${unit} (no history found for this category).` };
  };

  const startSession = (template: WorkoutTemplate) => {
    const unitPreference = userSettings.units === 'metric' ? 'kgs' : 'lbs';
    const newSession: WorkoutSession = {
      id: generateId(),
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
        for (let i = 0; i < warmupCount; i++) { sets.push({ id: generateId(), weight: workingWeight * 0.5, reps: 12, unit: unitPreference, timestamp: 0, completed: false, isWarmup: true }); }
        for (let i = 0; i < finalWorkSetsCount; i++) { sets.push({ id: generateId(), weight: workingWeight, reps: resolvedReps, unit: unitPreference, timestamp: 0, completed: false, isWarmup: false }); }
        return { id: generateId(), name: ex.name, category: ex.category, targetReps: ex.targetReps, suggestedWeight: workingWeight, suggestedReps: resolvedReps, rationale: `${reason} ${ex.rationale || ''}`.trim(), sets };
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
    const latestWeight = biometricHistory.sort((a,b) => b.date.localeCompare(a.date))[0]?.weight || 75;
    const newLogs: HistoricalLog[] = session.exercises.flatMap(ex => ex.sets.filter(s => s.completed).map(s => ({ date: today, exercise: ex.name, category: ex.category, weight: s.weight, unit: s.unit, reps: s.reps, completedAt: s.timestamp || Date.now(), isWarmup: !!s.isWarmup, sessionDuration: duration, weightAtTime: latestWeight })));
    setHistory(prev => [...newLogs, ...prev]);
    const generateBackgroundSummary = async () => { try { const summary = await aiService.current.getWorkoutMotivation(newLogs, history); setSessionSummaries(prev => ({ ...prev, [today]: summary })); } catch (e) { } };
    generateBackgroundSummary();
    setActiveSession(null);
    setLastSessionDate(today); 
    setActiveTab('history');
    setHistoryViewInitial('performance');
    triggerSync();
  };

  const updateHistoryLogs = (date: string, newLogs: HistoricalLog[]) => { setHistory(prev => { const filtered = prev.filter(h => h.date !== date); return [...newLogs, ...filtered]; }); triggerSync(); };
  
  const saveTemplate = (template: WorkoutTemplate) => { 
    const newTemplate = { ...template, id: template.id || generateId() }; 
    setSavedTemplates(prev => { 
      const existing = prev.find(t => String(t.id) === String(newTemplate.id)); 
      if (existing) return prev.map(t => String(t.id) === String(newTemplate.id) ? newTemplate : t); 
      return [...prev, newTemplate]; 
    }); 
    triggerSync(); 
  };

  const saveTemplatesBatch = (templates: WorkoutTemplate[]) => {
    const freshTemplates = templates.map(t => ({ ...t, id: t.id || generateId() }));
    setSavedTemplates(prev => {
      // Avoid duplicates if user is re-committing or tinkering
      const existingIds = new Set(prev.map(p => String(p.id)));
      const filteredStaged = freshTemplates.filter(f => !existingIds.has(String(f.id)));
      return [...prev, ...filteredStaged];
    });
    triggerSync();
  };

  const deleteTemplate = (id: string) => { const templateToDelete = savedTemplates.find(t => String(t.id) === String(id)); if (templateToDelete) { setSavedTemplates(prev => prev.filter(t => String(t.id) !== String(id))); setDeletedTemplates(prev => [...prev, templateToDelete]); setUndoToast({ id: String(templateToDelete.id), name: templateToDelete.name }); setTimeout(() => setUndoToast(null), 5000); triggerSync(); } };
  const restoreTemplate = (id: string) => { const templateToRestore = deletedTemplates.find(t => String(t.id) === String(id)); if (templateToRestore) { setDeletedTemplates(prev => prev.filter(t => String(t.id) !== String(id))); setSavedTemplates(prev => [...prev, templateToRestore]); setUndoToast(null); triggerSync(); } };
  const updateTemplate = (updated: WorkoutTemplate) => { 
    saveTemplate(updated);
    setEditingTemplate(null); 
  };
  const handleImport = (newLogs: HistoricalLog[], mode: 'overwrite' | 'merge' | 'ignore') => { if (mode === 'overwrite') { const datesToOverwrite = new Set(newLogs.map(l => l.date)); setHistory(prev => [...newLogs, ...prev.filter(h => !datesToOverwrite.has(h.date))]); } else { setHistory(prev => [...newLogs, ...prev]); } triggerSync(); };

  if (showBridge) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl space-y-8 animate-in zoom-in-95 duration-500">
           <div className="relative inline-block"><div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" /><div className="relative w-24 h-24 bg-slate-950 border-4 border-slate-800 rounded-full flex items-center justify-center mx-auto shadow-2xl"><Database className="text-emerald-400" size={40} /></div></div>
           <div className="space-y-3"><h2 className="text-3xl font-black text-slate-100 uppercase tracking-tighter">Neural Core v2.0</h2><p className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em]">High-Resolution Storage Upgrade</p></div>
           <p className="text-sm text-slate-300 leading-relaxed italic">IronFlow is upgrading its cognitive architecture. We've detected legacy data in your browser. Would you like to bridge this to the new high-performance Neural Core?</p>
           <div className="space-y-4">
              <button onClick={handleBridgeMigration} disabled={isBridging} className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-3xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-[12px] active:scale-95">{isBridging ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} fill="currentColor" />}Bridge Legacy Records</button>
              <button onClick={handleStartFresh} className="w-full py-4 text-slate-500 hover:text-slate-300 font-black uppercase tracking-widest text-[10px] transition-all">Start Fresh Protocol</button>
           </div>
           <div className="pt-4 flex items-center gap-3 justify-center text-[10px] font-black text-slate-600 uppercase tracking-widest"><ShieldCheck size={14} className="text-slate-700" />Local-First Encryption Active</div>
        </div>
      </div>
    );
  }

  if (needsApiKey) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl space-y-8 animate-in zoom-in-95 duration-500">
           <div className="relative inline-block">
             <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
             <div className="relative w-24 h-24 bg-slate-950 border-4 border-slate-800 rounded-full flex items-center justify-center mx-auto shadow-2xl">
               <ShieldCheck className="text-amber-400" size={40} />
             </div>
           </div>
           <div className="space-y-3">
             <h2 className="text-3xl font-black text-slate-100 uppercase tracking-tighter">API Key Required</h2>
             <p className="text-xs font-bold text-amber-400 uppercase tracking-[0.2em]">Neural Connection Pending</p>
           </div>
           <p className="text-sm text-slate-300 leading-relaxed italic">
             To activate the AI coaching architecture, you must select a valid Gemini API key from a paid Google Cloud project.
           </p>
           <div className="space-y-4">
              <button onClick={handleSelectKey} className="w-full py-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-3xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-[12px] active:scale-95">
                <Zap size={20} fill="currentColor" />
                Select API Key
              </button>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors">
                Learn about Billing & Keys
              </a>
           </div>
        </div>
      </div>
    );
  }

  if (!isHydrated) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center"><div className="w-16 h-16 border-4 border-slate-800 border-t-emerald-400 rounded-full animate-spin" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-8 ai-loading-pulse">{hydrationText}</p></div>
    );
  }

  const getSyncColorClass = (status: IronSyncStatus) => {
    switch (status) {
      case 'connected': return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
      case 'transmitting': return 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10 sync-active-pulse';
      case 'pending': return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
      case 'error': return 'border-rose-500/30 text-rose-400 bg-rose-500/10';
      default: return 'border-slate-800 text-slate-600 bg-slate-900/50 border-dashed';
    }
  };

  const getSyncTitle = (status: IronSyncStatus) => {
    switch (status) {
      case 'connected': return 'IronVault: Cloud Backup Active';
      case 'transmitting': return 'IronVault: Transmitting Backup...';
      case 'pending': return 'IronVault: Backup Pending Connection';
      case 'error': return 'IronVault: Backup Error';
      default: return 'IronVault: Backup Disabled';
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-slate-950 text-slate-100 flex flex-col items-center">
      <header className="w-full max-w-2xl px-6 py-8 flex justify-between items-center relative z-[60]">
        <div className="flex items-center gap-4">
          <div><h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tighter">IronFlow</h1><p className="text-slate-300 text-sm font-bold uppercase tracking-widest text-[10px]">AI Coaching Companion</p></div>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full border transition-all duration-500 ${getSyncColorClass(syncStatus)}`} title={getSyncTitle(syncStatus)}>
              <Cloud size={14} />
            </div>
            <div className={`p-1.5 rounded-full border transition-colors ${isOnline ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/30 text-rose-400 bg-rose-500/10'}`}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            </div>
          </div>
        </div>
        {!activeSession && (<button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300 hover:text-emerald-400 transition-all">{isMenuOpen ? <X size={20} /> : <Menu size={20} />}</button>)}
        {isMenuOpen && !activeSession && (
          <div className="absolute top-24 right-6 w-60 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => { setIsDiscoveryOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Search size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Find a Workout</span></button>
            <button onClick={() => { setEditingTemplate({ name: "Manual Workout", exercises: [] }); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Plus size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">New Template</span></button>
            <button onClick={() => { setIsLibraryOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><BookOpen size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Library</span></button>
            <button onClick={() => { setIsPantryOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Utensils size={18} className="text-orange-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Food Pantry</span></button>
            <button onClick={() => { setIsBackupOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><ShieldCheck size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Vault Backup</span></button>
            <button onClick={() => { setIsCSVOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><FileText size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Manage Data</span></button>
            <button onClick={() => { setIsTrashOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Trash2 size={18} className="text-rose-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Trash Can</span></button>
            <button onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3 text-slate-200"><Settings size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-100">Settings</span></button>
          </div>
        )}
      </header>
      
      {undoToast && (<div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-[70] w-full max-sm px-4 animate-in slide-in-from-bottom-8 duration-300"><div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg"><Trash2 size={16}/></div><p className="text-xs font-black text-slate-100 truncate max-w-[180px]">Deleted "{undoToast.name}"</p></div><button onClick={() => restoreTemplate(undoToast.id)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all"><RotateCcw size={12}/> Undo</button></div></div>)}

      {isLibraryOpen && <ExerciseLibrary onClose={() => setIsLibraryOpen(false)} aiService={aiService.current} userSettings={userSettings} customLibrary={customLibrary} deletedExercises={deletedExercises} onUpdateCustomLibrary={setCustomLibrary} onDeleteExercise={(ex) => setDeletedExercises(p => [...p, ex])} />}
      {isPantryOpen && <FoodPantry onClose={() => setIsPantryOpen(false)} aiService={aiService.current} />}
      {isDiscoveryOpen && <WorkoutDiscovery onClose={() => setIsDiscoveryOpen(false)} onStart={startSession} onSave={saveTemplate} aiService={aiService.current} history={history} />}
      {isTrashOpen && <TrashCan templates={deletedTemplates} exercises={deletedExercises} onClose={() => setIsTrashOpen(false)} onRestore={restoreTemplate} onPermanentlyDelete={(id) => setDeletedTemplates(p => p.filter(t => String(t.id) !== String(id)))} onRestoreExercise={(n) => setDeletedExercises(p => p.filter(e => e.name !== n))} onPermanentlyDeleteExercise={(n) => setDeletedExercises(p => p.filter(e => e.name !== n))} onEmpty={() => { setDeletedTemplates([]); setDeletedExercises([]); }} />}
      {isCSVOpen && <CSVManager history={history} onImport={handleImport} onClose={() => setIsCSVOpen(false)} aiService={aiService.current} />}
      {isBackupOpen && <BackupManager onClose={() => setIsBackupOpen(false)} onRestoring={setIsRestoring} />}
      {isSettingsOpen && <SettingsModal settings={userSettings} syncStatus={syncStatus} onSave={(s) => { setUserSettings(s); setIsSettingsOpen(false); triggerSync(s); }} onClose={() => setIsSettingsOpen(false)} aiService={aiService.current} onUpdateCustomLibrary={setCustomLibrary} onRefreshState={refreshLocalState} />}
      {editingTemplate && <TemplateEditor template={editingTemplate} onSave={updateTemplate} onClose={() => setEditingTemplate(null)} aiService={aiService.current} userSettings={userSettings} />}
      
      <main className="w-full max-w-2xl px-4 flex-grow">
        {activeTab === 'plan' && <ProgramCreator onStart={startSession} onSaveTemplate={saveTemplate} onSaveTemplatesBatch={saveTemplatesBatch} onDeleteTemplate={deleteTemplate} onEditTemplate={setEditingTemplate} savedTemplates={savedTemplates} history={history} aiService={aiService.current} customLibrary={customLibrary} userSettings={userSettings} />}
        {activeTab === 'active' && activeSession && <ActiveWorkout session={activeSession} onComplete={completeWorkout} onAbort={() => { setActiveSession(null); setActiveTab('plan'); }} onUpdate={setActiveSession} history={history} aiService={aiService.current} userSettings={userSettings} customLibrary={customLibrary} onUpdateCustomLibrary={setCustomLibrary} />}
        {activeTab === 'active' && !activeSession && <div className="flex flex-col items-center justify-center py-20 text-center"><div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-slate-800"><Dumbbell className="text-slate-400" size={40} /></div><h3 className="text-xl font-black mb-2 text-slate-100 uppercase tracking-tight">No Active Session</h3><p className="text-slate-300 font-bold uppercase tracking-widest text-[10px] mb-6">Start a program or an ad-hoc session.</p><button onClick={() => startSession({ name: 'Ad-hoc Session', exercises: [] })} className="px-10 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-black transition-all text-slate-950 uppercase tracking-widest text-xs">Initialize Ad-hoc</button></div>}
        {activeTab === 'history' && <WorkoutHistory history={history} biometricHistory={biometricHistory} onSaveBiometrics={setBiometricHistory} fuelHistory={fuelHistory} onSaveFuel={setFuelHistory} fuelProfile={fuelProfile} onSaveFuelProfile={setFuelProfile} aiService={aiService.current} onSaveTemplate={saveTemplate} userSettings={userSettings} lastSessionDate={lastSessionDate} onClearLastSession={() => setLastSessionDate(null)} initialView={historyViewInitial} onViewChange={setHistoryViewInitial} onResetInitialView={() => setHistoryViewInitial('performance')} onUpdateHistory={updateHistoryLogs} sessionSummaries={sessionSummaries} onSaveSummary={(date, summary) => setSessionSummaries(prev => ({ ...prev, [date]: summary }))} />}
      </main>

      {!activeSession && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 nav-safe-padding px-6 pt-4 flex justify-around items-center z-50">
          <button onClick={() => setActiveTab('plan')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'plan' ? 'text-emerald-400 scale-110' : 'text-slate-400 hover:text-slate-200'}`}><Layout size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Plan</span></button>
          <button onClick={() => setActiveTab('active')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'active' ? 'text-emerald-400 scale-110' : 'text-slate-400 hover:text-slate-200'}`}><Dumbbell size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Workout</span></button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'text-emerald-400 scale-110' : 'text-slate-400 hover:text-slate-200'}`}><History size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Stats</span></button>
        </nav>
      )}
    </div>
  );
};

export default App;
