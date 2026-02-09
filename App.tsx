import React, { useState, useEffect, useRef } from 'react';
import { Plus, History, Play, Dumbbell, Trophy, Layout, ChevronRight, Timer as TimerIcon, Bot, CheckCircle2, Menu, X, BookOpen, Settings, Search, Trash2, FileText, Download, Upload, Activity, Wifi, WifiOff, RotateCcw, Wand2, Sparkles, ShieldCheck } from 'lucide-react';
import { WorkoutSession, WorkoutTemplate, HistoricalLog, Exercise, SetLog, UserSettings, ExerciseLibraryItem, BiometricEntry, FuelLog, FuelProfile } from './types';
import { GeminiService } from './services/geminiService';
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

  useEffect(() => {
    const storedHistory = localStorage.getItem('ironflow_history');
    if (storedHistory) {
      try { setHistory(JSON.parse(storedHistory)); } catch (e) { setHistory([]); }
    } else {
      const lines = INITIAL_HISTORY_TEXT.split('\n').slice(1);
      const initialParsed: HistoricalLog[] = lines.map(line => {
        const parts = line.split(',');
        return {
          date: parts[0],
          exercise: parts[1],
          category: parts[2],
          weight: parseFloat(parts[3]) || 0,
          unit: parts[4],
          reps: parseInt(parts[5]) || 0,
          isWarmup: false
        };
      }).filter(p => p.exercise);
      setHistory(initialParsed);
    }

    const storedBiometrics = localStorage.getItem('ironflow_biometrics');
    if (storedBiometrics) {
      try { setBiometricHistory(JSON.parse(storedBiometrics)); } catch (e) {}
    }

    const storedFuel = localStorage.getItem('ironflow_fuel');
    if (storedFuel) {
      try { setFuelHistory(JSON.parse(storedFuel)); } catch (e) {}
    }

    const storedFuelProfile = localStorage.getItem('ironflow_fuel_profile');
    if (storedFuelProfile) {
      try { setFuelProfile(JSON.parse(storedFuelProfile)); } catch (e) {}
    }

    const storedTemplates = localStorage.getItem('ironflow_templates');
    if (storedTemplates) {
      try { setSavedTemplates(JSON.parse(storedTemplates)); } catch (e) {}
    }

    const storedTrash = localStorage.getItem('ironflow_trash');
    if (storedTrash) {
      try { setDeletedTemplates(JSON.parse(storedTrash)); } catch (e) {}
    }

    const storedLibrary = localStorage.getItem('ironflow_library');
    if (storedLibrary) {
      try { setCustomLibrary(JSON.parse(storedLibrary)); } catch (e) {}
    }

    const storedDeletedEx = localStorage.getItem('ironflow_deleted_exercises');
    if (storedDeletedEx) {
      try { setDeletedExercises(JSON.parse(storedDeletedEx)); } catch (e) {}
    }

    const storedSettings = localStorage.getItem('ironflow_settings');
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        setUserSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {}
    }
  }, []);

  useEffect(() => { localStorage.setItem('ironflow_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('ironflow_biometrics', JSON.stringify(biometricHistory)); }, [biometricHistory]);
  useEffect(() => { localStorage.setItem('ironflow_fuel', JSON.stringify(fuelHistory)); }, [fuelHistory]);
  useEffect(() => { localStorage.setItem('ironflow_fuel_profile', JSON.stringify(fuelProfile)); }, [fuelProfile]);
  useEffect(() => { localStorage.setItem('ironflow_templates', JSON.stringify(savedTemplates)); }, [savedTemplates]);
  useEffect(() => { localStorage.setItem('ironflow_trash', JSON.stringify(deletedTemplates)); }, [deletedTemplates]);
  useEffect(() => { localStorage.setItem('ironflow_library', JSON.stringify(customLibrary)); }, [customLibrary]);
  useEffect(() => { localStorage.setItem('ironflow_deleted_exercises', JSON.stringify(deletedExercises)); }, [deletedExercises]);
  useEffect(() => { localStorage.setItem('ironflow_settings', JSON.stringify(userSettings)); }, [userSettings]);

  // Automatic Local Checkpoint Logic
  useEffect(() => {
    if (userSettings.enableAutoBackup) {
      const lastCheckpoint = localStorage.getItem('ironflow_last_checkpoint_time');
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (!lastCheckpoint || now - parseInt(lastCheckpoint) > twentyFourHours) {
        const keysToBackup = [
          'ironflow_history', 'ironflow_biometrics', 'ironflow_templates', 
          'ironflow_trash', 'ironflow_library', 'ironflow_deleted_exercises', 
          'ironflow_settings', 'ironflow_morphology', 'ironflow_fuel', 'ironflow_fuel_profile'
        ];
        const checkpoint: Record<string, any> = {};
        keysToBackup.forEach(key => {
          const val = localStorage.getItem(key);
          if (val) {
            try { checkpoint[key] = JSON.parse(val); } catch(e) {}
          }
        });
        
        if (Object.keys(checkpoint).length > 0) {
          localStorage.setItem('ironflow_auto_checkpoint', JSON.stringify(checkpoint));
          localStorage.setItem('ironflow_last_checkpoint_time', now.toString());
          console.debug('Automatic local checkpoint created.');
        }
      }
    }
  }, [userSettings.enableAutoBackup]);

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