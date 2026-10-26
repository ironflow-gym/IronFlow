import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { Plus, History, Play, Dumbbell, Trophy, Layout, ChevronRight, Timer as TimerIcon, Bot, CheckCircle2, Menu, X, BookOpen, Settings, Search, Trash2, FileText, Download, Upload, Activity, Wifi, WifiOff, RotateCcw, Wand2, Sparkles, ShieldCheck, Database, Zap, ArrowRight, Loader2, Cloud, Utensils, HelpCircle } from 'lucide-react';
import { WorkoutSession, WorkoutTemplate, HistoricalLog, Exercise, SetLog, UserSettings, ExerciseLibraryItem, BiometricEntry, FuelLog, FuelProfile, IronSyncStatus, FoodItem, TrainingSchedule } from './types';
import { GeminiService } from './services/geminiService';
import { roundWarmupWeight, parseRepRange, backfillPrimaryMuscles, isCardioCategory } from './src/utils';
import { storage } from './services/storageService';
import { backupQueue } from './services/backupService';
import { ironSync, extractTokenFromHash } from './services/ironSyncService';
import { hasBYOKKey } from './services/geminiService';
import ApiKeyModal from './components/ApiKeyModal';
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
import HelpModal from './components/HelpModal';
import DesktopSidebar from './components/DesktopSidebar';
import { getWeightRecommendation } from './src/progression';
import { completeAppointment, emptySchedule, localDate, normalizeSchedule } from './src/scheduling';
import TodayScreen from './components/TodayScreen';
import WorkoutPreview from './components/WorkoutPreview';

const INITIAL_HISTORY_TEXT = `Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time`;

const DEFAULT_SETTINGS: UserSettings = {
  units: 'metric',
  autoPopulateCount: 200,
  includedBodyParts: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Abs'],
  defaultRestTimer: 90,
  enableWakeLock: true,
  enableAutoBackup: false,
  dateOfBirth: '',
  weeklyWorkoutGoal: 3,
  desktopWidgetVisibility: { e1rmChart: true, muscleGroupVolume: true, consistencyHeatmap: true },
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
  const [showApiKeyOnboarding, setShowApiKeyOnboarding] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  const [activeTab, setActiveTab] = useState<'today' | 'plan' | 'active' | 'history'>('today');
  const [schedule, setSchedule] = useState<TrainingSchedule>(emptySchedule);
  const [previewSession, setPreviewSession] = useState<WorkoutSession | null>(null);
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

  const backupStatus = useSyncExternalStore(backupQueue.subscribe, backupQueue.getStatus);
  const syncStatus = backupStatus.state;
  const saveStatus = useSyncExternalStore(storage.subscribe, storage.getStatus);
  const [loadError, setLoadError] = useState(false);
  const savedSnapshot = useRef<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
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
        configureAI(initialSettings);

        // ── OAuth redirect return ──────────────────────────────────────────
        // Check for a token in the URL hash — this means the app has just
        // returned from Google's OAuth consent screen.
        const redirectToken = extractTokenFromHash();
        const returningFromAuth = !!redirectToken && ironSync.hasPendingAuth();

        if (redirectToken) {
          ironSync.consumeRedirectToken(redirectToken.token, redirectToken.expiresIn);
          ironSync.clearPendingAuth();
        }

        if (returningFromAuth) {
          // ── Fresh auth redirect return ────────────────────────────────────
          // ironSyncConnected may not be persisted yet (the page navigated away
          // before the IndexedDB write completed). Set it now authoritatively,
          // then do the first upload.
          initialSettings = { ...initialSettings, ironSyncConnected: true };
          setUserSettings(initialSettings);
          // Persist connection settings before any upload can start.
          await storage.set('ironflow_settings', initialSettings);
        }
        // BackupQueue resumes durable pending uploads after hydration. It never
        // replaces local data with a remote snapshot automatically.
        localStorage.removeItem('ironflow_just_restored');

        await refreshLocalState();

        // Resolve API key — BYOK localStorage first, then build-time env var.
        // Soft gate: app loads regardless. AI features self-disable if no key.
        const keyAvailable = hasBYOKKey() || !!process.env.API_KEY;
        setHasApiKey(keyAvailable);
        if (!keyAvailable) setShowApiKeyOnboarding(true);

        // React batches the hydrated values and this flag into the same render.
        setIsHydrated(true);
      } catch (e) {
        console.error("Hydration Critical Failure:", e);
        setLoadError(true);
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
      storedActiveSession, storedPantry, storedSchedule
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
      storage.get<FoodItem[]>('ironflow_pantry'),
      storage.get<TrainingSchedule>('ironflow_schedule')
    ]);

    setSchedule(normalizeSchedule(storedSchedule));
    if (storedHistory) setHistory(storedHistory);
    if (storedBiometrics) setBiometricHistory(storedBiometrics);
    if (storedFuel) setFuelHistory(storedFuel);
    if (storedFuelProfile) setFuelProfile(storedFuelProfile);
    if (storedTemplates) setSavedTemplates(storedTemplates.map(t => ({ ...t, id: t.id || generateId() })));
    if (storedTrash) setDeletedTemplates(storedTrash);
    if (storedLibrary) setCustomLibrary(storedLibrary);
    if (storedDeletedEx) setDeletedExercises(storedDeletedEx);
    if (storedActiveSession) {
      setActiveSession(storedActiveSession);
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

    const keyAvailable = hasBYOKKey() || !!process.env.API_KEY;
    setHasApiKey(keyAvailable);
    if (!keyAvailable) setShowApiKeyOnboarding(true);
    setIsHydrated(true);
  };

  // Keep AI personality in sync with settings
  const configureAI = (s: UserSettings) => aiService.current.configure({
    aiPersonality: s.aiPersonality,
    aiPersonalityCustom: s.aiPersonalityCustom,
  });

  useEffect(() => {
    backupQueue.configure(!!userSettings.ironSyncConnected, isOnline, !isHydrated || isRestoring);
    return () => backupQueue.configure(false, false, true);
  }, [userSettings.ironSyncConnected, isOnline, isHydrated, isRestoring]);

  useEffect(() => {
    const protectUnsavedChanges = (event: BeforeUnloadEvent) => {
      if (storage.getStatus().state !== 'saved') { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', protectUnsavedChanges);
    return () => window.removeEventListener('beforeunload', protectUnsavedChanges);
  }, []);

  // Commit a complete React snapshot in one transaction. In particular, a
  // completed session's history and removal of its draft must succeed together.
  useEffect(() => {
    if (!isHydrated || isRestoring) return;
    const snapshot = {
      ironflow_history: history, ironflow_biometrics: biometricHistory,
      ironflow_fuel: fuelHistory, ironflow_fuel_profile: fuelProfile,
      ironflow_templates: savedTemplates, ironflow_trash: deletedTemplates,
      ironflow_library: customLibrary, ironflow_deleted_exercises: deletedExercises,
      ironflow_settings: userSettings, ironflow_active_session: activeSession, ironflow_schedule: schedule,
    };
    const serialized = JSON.stringify(snapshot);
    // Hydration is a read, not a change: do not rewrite restored data on boot.
    if (savedSnapshot.current === null) { savedSnapshot.current = serialized; return; }
    if (savedSnapshot.current === serialized) return;
    savedSnapshot.current = serialized;
    const { ironflow_active_session, ...records } = snapshot;
    void storage.setBulk(
      activeSession ? { ...records, ironflow_active_session } : records,
      activeSession ? [] : ['ironflow_active_session'],
    ).catch(error => console.error('Local save failed:', error));
  }, [history, biometricHistory, fuelHistory, fuelProfile, savedTemplates, deletedTemplates,
    customLibrary, deletedExercises, userSettings, activeSession, schedule, isHydrated, isRestoring]);


  // One-shot backfill: write primaryMuscle onto existing logs that lack it.
  // Runs once after hydration. Only triggers a setHistory + storage write when
  // at least one log was actually changed, so it's a no-op on subsequent loads.
  useEffect(() => {
    if (!isHydrated || isRestoring || history.length === 0) return;
    const fullLibrary = [...DEFAULT_LIBRARY, ...customLibrary];
    const { logs: enriched, changed } = backfillPrimaryMuscles(history, fullLibrary);
    if (changed) setHistory(enriched);
  }, [isHydrated]);


  const createSession = (template: WorkoutTemplate, appointmentId?: string): WorkoutSession => {
    const unitPreference = userSettings.units === 'metric' ? 'kgs' : 'lbs';
    const weightUnit = userSettings.units === 'metric' ? 'kg' : 'lbs';
    const newSession: WorkoutSession = {
      id: generateId(),
      name: template.name,
      templateId: template.id,
      appointmentId,
      startTime: Date.now(),
      status: 'active',
      exercises: template.exercises.map(ex => {
        // Look up equipment config from library first — used for both weight
        // recommendation and warmup rounding.
        const allLibrary = [...(customLibrary || [])];
        const libraryMatch = allLibrary.find(l => l.name.toLowerCase() === ex.name.toLowerCase());
        const weightIncrement = libraryMatch?.weightIncrement;
        const barWeight = libraryMatch?.barWeight;
        const isBilateral = /(barbell|squat|bench|deadlift|press|hack|row|leg press)/i.test(ex.name);

        const recommendation = getWeightRecommendation(
          userSettings.units, ex.name, ex.category, history, ex.suggestedWeight, ex.targetReps, template.lastRefreshed, template.name, ex.rationale, weightIncrement, barWeight
        );
        const { weight: workingWeight, reps: workingReps, reason, hasHistory } = recommendation;
        // suggestedSets is the number of WORKING sets prescribed by the program.
        // warmupCount is explicitly set by the AI when the program specifies a warmup protocol;
        // if absent, default to 2 warmups for compound lifts with 3+ working sets, 0 otherwise.
        const workingSets = ex.suggestedSets || 3;
        const { min: repMin } = parseRepRange(ex.targetReps);
        const warmupReps = Math.max(repMin, 5); // warmup reps track the rep target, min 5
        const warmupCount: number = ex.warmupCount !== undefined
          ? ex.warmupCount
          : workingSets >= 3 ? 2 : 0;
        // Two-step warmup: 40% → 70% of working weight.
        // roundWarmupWeight handles barWeight floor and bilateral per-side snapping
        // so warmup totals are always loadable-clean, never below the bar/sled mass.
        const warmupWeights = [
          roundWarmupWeight(workingWeight * 0.4, weightUnit, weightIncrement, barWeight, isBilateral),
          roundWarmupWeight(workingWeight * 0.7, weightUnit, weightIncrement, barWeight, isBilateral),
        ];
        const sets: SetLog[] = [];
        for (let i = 0; i < warmupCount; i++) {
          sets.push({ id: generateId(), weight: warmupWeights[i] ?? warmupWeights[0], reps: warmupReps, unit: unitPreference, timestamp: 0, completed: false, isWarmup: true });
        }
        for (let i = 0; i < workingSets; i++) {
          sets.push({ id: generateId(), weight: workingWeight, reps: workingReps, unit: unitPreference, timestamp: 0, completed: false, isWarmup: false });
        }
        const exerciseRationale = (!hasHistory && ex.rationale) ? `${reason} — ${ex.rationale}` : reason;
        const primaryMuscle = libraryMatch?.muscles?.[0];
        return { id: generateId(), name: ex.name, category: ex.category, primaryMuscle, targetReps: ex.targetReps, suggestedWeight: workingWeight, suggestedReps: workingReps, rationale: exerciseRationale, ...(!isCardioCategory(ex.category) ? { recommendation: { ...recommendation, unit: unitPreference } } : {}), sets, ...(ex.restSeconds ? { restSeconds: ex.restSeconds } : {}) };
      })
    };
    return newSession;
  };

  const launchSession = (session: WorkoutSession) => {
    if (activeSession) { setActiveTab('active'); return; }
    setActiveSession({ ...session, startTime: Date.now() });
    setPreviewSession(null);
    setActiveTab('active');
    setIsDiscoveryOpen(false);
  };

  const startSession = (template: WorkoutTemplate, appointmentId?: string) => {
    if (activeSession) { setActiveTab('active'); return; }
    launchSession(createSession(template, appointmentId));
  };

  const completeWorkout = (session: WorkoutSession) => {
    const today = localDate();
    const endTime = Date.now();
    const duration = endTime - session.startTime;
    const latestWeight = biometricHistory.sort((a,b) => b.date.localeCompare(a.date))[0]?.weight || 75;
    // Foster session load: RPE × duration in minutes
    const durationMins = duration / 60000;
    const sessionLoad = session.sessionRPE !== undefined ? Math.round(session.sessionRPE * durationMins) : undefined;
    const newLogs: HistoricalLog[] = session.exercises.flatMap(ex => ex.sets.filter(s => s.completed).map(s => ({
      date: today,
      sessionId: session.id,
      templateId: session.templateId,
      appointmentId: session.appointmentId,
      exercise: ex.name,
      category: ex.category,
      weight: s.weight,
      unit: s.unit,
      reps: s.reps,
      completedAt: s.timestamp || Date.now(),
      isWarmup: !!s.isWarmup,
      ...(s.isDeload && { isDeload: true }),
      sessionDuration: duration,
      weightAtTime: latestWeight,
      templateName: session.name,
      ...(ex.primaryMuscle !== undefined && { primaryMuscle: ex.primaryMuscle }),
      ...(session.sessionRPE !== undefined && { sessionRPE: session.sessionRPE }),
      ...(sessionLoad !== undefined && { sessionLoad }),
      // Cardio fields — only spread when present on the SetLog
      ...(s.distance !== undefined && { distance: s.distance }),
      ...(s.distanceUnit !== undefined && { distanceUnit: s.distanceUnit }),
      ...(s.duration !== undefined && { duration: s.duration }),
    })));
    setHistory(prev => [...newLogs, ...prev]);
    setSchedule(prev => completeAppointment(prev, { sessionId: session.id, date: today, name: session.name, templateId: session.templateId, appointmentId: session.appointmentId }));
    setActiveSession(null);
    setLastSessionDate(today);
    setActiveTab('history');
    setHistoryViewInitial('performance');

  };

  const updateHistoryLogs = (date: string, newLogs: HistoricalLog[]) => { setHistory(prev => { const filtered = prev.filter(h => h.date !== date); return [...newLogs, ...filtered]; });  };

  // When the user corrects a muscle tag in the exercise library, backfill all
  // existing logs for that exercise so volume tracking stays accurate.
  const retargetPrimaryMuscle = (exerciseName: string, newPrimaryMuscle: string) => {
    setHistory(prev => prev.map(h =>
      h.exercise.toLowerCase() === exerciseName.toLowerCase()
        ? { ...h, primaryMuscle: newPrimaryMuscle }
        : h
    ));

  };

  const bulkRenameExercise = (oldName: string, newName: string, dates: string[]) => {
    const dateSet = new Set(dates);
    setHistory(prev => prev.map(h =>
      h.exercise === oldName && dateSet.has(h.date)
        ? { ...h, exercise: newName }
        : h
    ));

  };

  const saveTemplate = (template: WorkoutTemplate) => {
    const newTemplate = { ...template, id: template.id || generateId() };
    setSavedTemplates(prev => {
      const existing = prev.find(t => String(t.id) === String(newTemplate.id));
      if (existing) return prev.map(t => String(t.id) === String(newTemplate.id) ? newTemplate : t);
      return [...prev, newTemplate];
    });

  };

  const saveTemplatesBatch = (templates: WorkoutTemplate[]) => {
    const freshTemplates = templates.map(t => ({ ...t, id: t.id || generateId() }));
    setSavedTemplates(prev => {
      const updateMap = new Map(freshTemplates.map(t => [String(t.id), t]));
      // Update existing entries in-place, then append any that are genuinely new
      const updated = prev.map(p => updateMap.has(String(p.id)) ? updateMap.get(String(p.id))! : p);
      const existingIds = new Set(prev.map(p => String(p.id)));
      const newEntries = freshTemplates.filter(f => !existingIds.has(String(f.id)));
      return [...updated, ...newEntries];
    });

  };

  const deleteTemplate = (id: string) => { const templateToDelete = savedTemplates.find(t => String(t.id) === String(id)); if (templateToDelete) { setSavedTemplates(prev => prev.filter(t => String(t.id) !== String(id))); setDeletedTemplates(prev => [...prev, templateToDelete]); setUndoToast({ id: String(templateToDelete.id), name: templateToDelete.name }); setTimeout(() => setUndoToast(null), 5000);  } };
  const restoreTemplate = (id: string) => { const templateToRestore = deletedTemplates.find(t => String(t.id) === String(id)); if (templateToRestore) { setDeletedTemplates(prev => prev.filter(t => String(t.id) !== String(id))); setSavedTemplates(prev => [...prev, templateToRestore]); setUndoToast(null);  } };
  const updateTemplate = (updated: WorkoutTemplate) => {
    saveTemplate(updated);
    setEditingTemplate(null);
  };

  // Called from ActiveWorkout when the user saves a rest period for an exercise.
  // Updates the matching exercise in the saved template so future sessions inherit it.
  const saveExerciseRest = (templateName: string, exerciseName: string, restSeconds: number) => {
    setSavedTemplates(prev => prev.map(t => {
      if (t.name !== templateName) return t;
      return {
        ...t,
        exercises: t.exercises.map(ex =>
          ex.name.toLowerCase() === exerciseName.toLowerCase()
            ? { ...ex, restSeconds }
            : ex
        )
      };
    }));

  };
  const handleImport = (newLogs: HistoricalLog[], mode: 'overwrite' | 'merge' | 'ignore') => { if (mode === 'overwrite') { const datesToOverwrite = new Set(newLogs.map(l => l.date)); setHistory(prev => [...newLogs, ...prev.filter(h => !datesToOverwrite.has(h.date))]); } else { setHistory(prev => [...newLogs, ...prev]); }  };

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

  if (loadError) return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div role="alert" className="max-w-md space-y-4">
        <h1 className="text-xl font-bold">Your records could not be loaded</h1>
        <p>Close other IronFlow tabs and check that browser storage is available. Your existing records have not been replaced.</p>
        <button className="rounded-xl bg-emerald-500 text-slate-950 px-5 py-3 font-bold" onClick={() => window.location.reload()}>Retry loading</button>
      </div>
    </main>
  );

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
      case 'connected': return backupStatus.lastBackupAt ? `Backed up at ${new Date(backupStatus.lastBackupAt).toLocaleTimeString()}` : 'Cloud backup enabled';
      case 'transmitting': return 'IronVault: Transmitting Backup...';
      case 'pending': return backupStatus.needsAuth ? 'Reconnect Google Drive to finish backup' : 'Backup pending';
      case 'error': return 'Backup failed — tap to retry';
      default: return 'IronVault: Backup Disabled';
    }
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-0 bg-slate-950 text-slate-100 flex flex-col items-center">
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenDiscovery={() => setIsDiscoveryOpen(true)}
        onNewTemplate={() => setEditingTemplate({ name: 'Manual Workout', exercises: [] })}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenPantry={() => setIsPantryOpen(true)}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenCSV={() => setIsCSVOpen(true)}
        onOpenTrash={() => setIsTrashOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />
      <header className="w-full max-w-2xl lg:max-w-none lg:pl-20 px-6 py-8 flex justify-between items-center relative z-[60]">
        <div className="flex items-center gap-4">
          <div><h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tighter">IronFlow</h1><p className="text-slate-300 text-sm font-bold uppercase tracking-widest text-[10px]">AI Coaching Companion</p></div>
          <div className="flex items-center gap-2">
            <button
              className={`p-1.5 rounded-full border transition-all duration-500 ${getSyncColorClass(syncStatus)} ${
                syncStatus === 'transmitting' ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'
              }`}
              title={getSyncTitle(syncStatus)}
              onClick={() => {
                if (syncStatus === 'transmitting') return;
                if (!userSettings.ironSyncConnected || backupStatus.needsAuth) ironSync.startAuthRedirect();
                else backupQueue.request();
              }}
            >
              <Cloud size={14} />
            </button>
            <div className={`p-1.5 rounded-full border transition-colors ${isOnline ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/30 text-rose-400 bg-rose-500/10'}`}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            </div>
          </div>
        </div>
        {(!activeSession || activeTab !== 'active') && (<button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300 hover:text-emerald-400 transition-all">{isMenuOpen ? <X size={20} /> : <Menu size={20} />}</button>)}
        {isMenuOpen && !activeSession && (
          <div className="lg:hidden absolute top-24 right-6 w-60 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => { setIsDiscoveryOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Search size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Find a Workout</span></button>
            <button onClick={() => { setEditingTemplate({ name: "Manual Workout", exercises: [] }); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Plus size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">New Template</span></button>
            <button onClick={() => { setIsLibraryOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><BookOpen size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Library</span></button>
            <button onClick={() => { setIsPantryOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Utensils size={18} className="text-orange-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Food Pantry</span></button>
            <button onClick={() => { setIsBackupOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><ShieldCheck size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Vault Backup</span></button>
            <button onClick={() => { setIsCSVOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><FileText size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Manage Data</span></button>
            <button onClick={() => { setIsTrashOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><Trash2 size={18} className="text-rose-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Trash Can</span></button>
            <button onClick={() => { setIsHelpOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3"><HelpCircle size={18} className="text-sky-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-200">Help & Reference</span></button>
            <button onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-slate-800 flex items-center gap-3 text-slate-200"><Settings size={18} className="text-emerald-400" /><span className="text-[12px] font-black uppercase tracking-widest text-slate-100">Settings</span></button>
          </div>
        )}
      </header>
      <div className="w-full max-w-2xl lg:max-w-none lg:pl-24 px-6 pb-4 text-xs flex flex-wrap items-center gap-x-4 gap-y-2">
        <span role="status" aria-live="polite" className={saveStatus.state === 'error' ? 'text-rose-300' : 'text-slate-400'}>
          {saveStatus.state === 'saving' ? 'Saving on this device…' : saveStatus.state === 'error' ? 'Not saved — keep this tab open' : 'Saved on this device'}
        </span>
        {saveStatus.state === 'error' && <button className="rounded-lg border border-rose-500 px-3 py-2 text-rose-200" onClick={() => { void storage.retryFailedWrites().catch(() => {}); }}>Retry save</button>}
        <button className="text-left text-slate-400 underline underline-offset-4 disabled:no-underline" disabled={!userSettings.ironSyncConnected || syncStatus === 'transmitting'} onClick={() => {
          if (backupStatus.needsAuth) ironSync.startAuthRedirect(); else backupQueue.request();
        }}>{getSyncTitle(syncStatus)}</button>
      </div>

      {undoToast && (<div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-[70] w-full max-sm px-4 animate-in slide-in-from-bottom-8 duration-300"><div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg"><Trash2 size={16}/></div><p className="text-xs font-black text-slate-100 truncate max-w-[180px]">Deleted "{undoToast.name}"</p></div><button onClick={() => restoreTemplate(undoToast.id)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all"><RotateCcw size={12}/> Undo</button></div></div>)}

      {isLibraryOpen && <ExerciseLibrary onClose={() => setIsLibraryOpen(false)} aiService={aiService.current} userSettings={userSettings} customLibrary={customLibrary} deletedExercises={deletedExercises} onUpdateCustomLibrary={setCustomLibrary} onDeleteExercise={(ex) => setDeletedExercises(p => [...p, ex])} onMuscleTagUpdate={retargetPrimaryMuscle} />}
      {isPantryOpen && <FoodPantry onClose={() => setIsPantryOpen(false)} aiService={aiService.current} fuelProfile={fuelProfile} />}
      {isDiscoveryOpen && <WorkoutDiscovery onClose={() => setIsDiscoveryOpen(false)} onStart={startSession} onSave={saveTemplate} onSaveAll={saveTemplatesBatch} aiService={aiService.current} history={history} />}
      {isTrashOpen && <TrashCan templates={deletedTemplates} exercises={deletedExercises} onClose={() => setIsTrashOpen(false)} onRestore={restoreTemplate} onPermanentlyDelete={(id) => setDeletedTemplates(p => p.filter(t => String(t.id) !== String(id)))} onRestoreExercise={(n) => setDeletedExercises(p => p.filter(e => e.name !== n))} onPermanentlyDeleteExercise={(n) => setDeletedExercises(p => p.filter(e => e.name !== n))} onEmpty={() => { setDeletedTemplates([]); setDeletedExercises([]); }} />}
      {isCSVOpen && <CSVManager history={history} onImport={handleImport} onClose={() => setIsCSVOpen(false)} aiService={aiService.current} />}
      {isBackupOpen && <BackupManager onClose={() => setIsBackupOpen(false)} onRestoring={setIsRestoring} />}
      {showApiKeyOnboarding && (
        <ApiKeyModal
          aiService={aiService.current}
          onSuccess={() => {
            setHasApiKey(true);
            setShowApiKeyOnboarding(false);
          }}
          onDismiss={() => setShowApiKeyOnboarding(false)}
        />
      )}
      {isSettingsOpen && <SettingsModal settings={userSettings} syncStatus={syncStatus} onSave={(s) => { setUserSettings(s); configureAI(s); setIsSettingsOpen(false);  }} onClose={() => setIsSettingsOpen(false)} aiService={aiService.current} onUpdateCustomLibrary={setCustomLibrary} onRefreshState={refreshLocalState} />}
      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
      {previewSession && <WorkoutPreview session={previewSession} onChange={setPreviewSession} onClose={() => setPreviewSession(null)} onStart={() => launchSession(previewSession)} />}
      {editingTemplate && <TemplateEditor template={editingTemplate} onSave={updateTemplate} onSaveAll={saveTemplatesBatch} onClose={() => setEditingTemplate(null)} aiService={aiService.current} userSettings={userSettings} history={history} />}

      <main className="w-full max-w-2xl px-4 flex-grow lg:max-w-none lg:pl-24 lg:pr-8 lg:pt-6">
        {activeTab === 'today' && <TodayScreen templates={savedTemplates} history={history} schedule={schedule} onScheduleChange={setSchedule} activeSession={activeSession} onResume={() => setActiveTab('active')} onPlan={() => setActiveTab('plan')} onStart={startSession} onPreview={(template, appointmentId) => { if (activeSession) setActiveTab('active'); else setPreviewSession(createSession(template, appointmentId)); }} weeklyGoal={userSettings.weeklyWorkoutGoal ?? 3} />}
        {activeTab === 'plan' && <ProgramCreator onStart={startSession} onSaveTemplate={saveTemplate} onSaveTemplatesBatch={saveTemplatesBatch} onDeleteTemplate={deleteTemplate} onEditTemplate={setEditingTemplate} savedTemplates={savedTemplates} history={history} aiService={aiService.current} customLibrary={customLibrary} userSettings={userSettings} />}
        {activeTab === 'active' && activeSession && <ActiveWorkout session={activeSession} onComplete={completeWorkout} onAbort={() => { setActiveSession(null); setActiveTab('plan'); }} onUpdate={setActiveSession} history={history} aiService={aiService.current} userSettings={userSettings} customLibrary={customLibrary} onUpdateCustomLibrary={setCustomLibrary} onSaveExerciseRest={saveExerciseRest} />}
        {activeTab === 'active' && !activeSession && <div className="flex flex-col items-center justify-center py-20 text-center"><div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-slate-800"><Dumbbell className="text-slate-400" size={40} /></div><h3 className="text-xl font-black mb-2 text-slate-100 uppercase tracking-tight">No Active Session</h3><p className="text-slate-300 font-bold uppercase tracking-widest text-[10px] mb-6">Start a program or an ad-hoc session.</p><button onClick={() => startSession({ name: 'Ad-hoc Session', exercises: [] })} className="px-10 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-black transition-all text-slate-950 uppercase tracking-widest text-xs">Initialize Ad-hoc</button></div>}
        {activeTab === 'history' && <WorkoutHistory history={history} biometricHistory={biometricHistory} onSaveBiometrics={setBiometricHistory} fuelHistory={fuelHistory} onSaveFuel={setFuelHistory} fuelProfile={fuelProfile} onSaveFuelProfile={setFuelProfile} aiService={aiService.current} onSaveTemplate={saveTemplate} userSettings={userSettings} lastSessionDate={lastSessionDate} onClearLastSession={() => setLastSessionDate(null)} initialView={historyViewInitial} onViewChange={setHistoryViewInitial} onResetInitialView={() => setHistoryViewInitial('performance')} onUpdateHistory={updateHistoryLogs} onBulkRename={bulkRenameExercise} savedTemplates={savedTemplates} customLibrary={customLibrary} />}
      </main>

      {(!activeSession || activeTab !== 'active') && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 nav-safe-padding px-6 pt-4 flex justify-around items-center z-50 lg:hidden">
          <button onClick={() => setActiveTab('today')} className={`flex flex-col items-center gap-1 ${activeTab === 'today' ? 'text-emerald-400' : 'text-slate-400'}`}><Activity size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Today</span></button>
          <button onClick={() => setActiveTab('plan')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'plan' ? 'text-emerald-400 scale-110' : 'text-slate-400 hover:text-slate-200'}`}><Layout size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Plan</span></button>
          <button onClick={() => setActiveTab('active')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'active' ? 'text-emerald-400 scale-110' : 'text-slate-400 hover:text-slate-200'}`}><Dumbbell size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Workout</span></button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'text-emerald-400 scale-110' : 'text-slate-400 hover:text-slate-200'}`}><History size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Stats</span></button>
        </nav>
      )}
    </div>
  );
};

export default App;
