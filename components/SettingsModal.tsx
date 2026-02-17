
import React, { useState, useEffect } from 'react';
import { X, Settings, Ruler, Timer, Database, Check, RefreshCw, Loader2, Monitor, User, Trash2, AlertTriangle, Calendar } from 'lucide-react';
import { UserSettings, ExerciseLibraryItem } from '../types';
import { GeminiService } from '../services/geminiService';
import { storage } from '../services/storageService';
import { DEFAULT_LIBRARY } from './ExerciseLibrary';

interface SettingsModalProps {
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
  onClose: () => void;
  aiService: GeminiService;
  onUpdateCustomLibrary: (lib: ExerciseLibraryItem[]) => void;
}

const BODY_PARTS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Abs'];

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose, aiService, onUpdateCustomLibrary }) => {
  const [localSettings, setLocalSettings] = React.useState<UserSettings>({ ...settings });
  const [isPopulating, setIsPopulating] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  // Auto-reset the confirmation state after 3 seconds
  useEffect(() => {
    let timeout: number;
    if (resetConfirm) {
      timeout = window.setTimeout(() => setResetConfirm(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [resetConfirm]);

  const toggleBodyPart = (part: string) => {
    setLocalSettings(prev => ({
      ...prev,
      includedBodyParts: prev.includedBodyParts.includes(part)
        ? prev.includedBodyParts.filter(p => p !== part)
        : [...prev.includedBodyParts, part]
    }));
  };

  const handleMasterReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }

    // Purge everything
    localStorage.clear();
    await storage.clearAll();
    
    // Hard reload to reset all application state
    window.location.reload();
  };

  const handleAutopopulate = async () => {
    const customLibrary: ExerciseLibraryItem[] = await storage.get<ExerciseLibraryItem[]>('ironflow_library') || [];
    const totalCount = DEFAULT_LIBRARY.length + customLibrary.length;
    const target = localSettings.autoPopulateCount;

    if (totalCount > target) {
      const confirmProceed = window.confirm(
        `Your target count (${target}) is lower than the current database size (${totalCount}). This will remove the oldest ${totalCount - target} custom exercises from your library. Do you wish to proceed?`
      );
      if (!confirmProceed) return;

      const diff = totalCount - target;
      const newCustomLibrary = customLibrary.slice(diff);
      await storage.set('ironflow_library', newCustomLibrary);
      onUpdateCustomLibrary(newCustomLibrary);
      onSave(localSettings);
      alert("Database trimmed successfully.");
      return;
    }

    if (totalCount < target) {
      setIsPopulating(true);
      try {
        const needed = target - totalCount;
        const totalToFetch = Math.min(needed, 60); 
        const existingNames = [...DEFAULT_LIBRARY, ...customLibrary].map(i => i.name);
        const result = await aiService.autopopulateExerciseLibrary(
          totalToFetch, 
          localSettings.includedBodyParts, 
          existingNames
        );
        
        const filteredResult = result.filter(newItem => 
          !existingNames.some(existing => existing.toLowerCase() === newItem.name.toLowerCase())
        );

        const finalCustomLibrary = [...customLibrary, ...filteredResult];
        await storage.set('ironflow_library', finalCustomLibrary);
        onUpdateCustomLibrary(finalCustomLibrary);
        onSave(localSettings);
        alert(`Successfully populated ${filteredResult.length} new exercises to your database.`);
      } catch (err) {
        console.error(err);
        alert("Failed to populate database. Please try again later.");
      } finally {
        setIsPopulating(false);
      }
    } else {
      alert("Database already meets the target count.");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden relative">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-100 flex items-center gap-3">
              <Settings className="text-emerald-400" />
              Settings
            </h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Application Preferences</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Biological Profile */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <User size={14} className="text-emerald-400" />
              Biological Profile
            </h3>
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950/50 border border-slate-800 rounded-2xl">
              <button 
                onClick={() => setLocalSettings({...localSettings, gender: 'male'})}
                className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${localSettings.gender === 'male' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Male
              </button>
              <button 
                onClick={() => setLocalSettings({...localSettings, gender: 'female'})}
                className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${localSettings.gender === 'female' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Female
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Calendar size={12}/> Date of Birth
              </label>
              <input 
                type="date" 
                value={localSettings.dateOfBirth || ''}
                onChange={(e) => setLocalSettings({...localSettings, dateOfBirth: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-100 font-bold focus:ring-1 focus:ring-emerald-500/30 outline-none"
              />
            </div>
          </section>

          {/* Units */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Ruler size={14} className="text-emerald-400" />
              Measurement System
            </h3>
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950/50 border border-slate-800 rounded-2xl">
              <button 
                onClick={() => setLocalSettings({...localSettings, units: 'metric'})}
                className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${localSettings.units === 'metric' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Metric (KG)
              </button>
              <button 
                onClick={() => setLocalSettings({...localSettings, units: 'imperial'})}
                className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${localSettings.units === 'imperial' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Imperial (LB)
              </button>
            </div>
          </section>

          {/* Rest Timer */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Timer size={14} className="text-emerald-400" />
              Default Rest Period
            </h3>
            <div className="relative">
              <input 
                type="number" 
                value={localSettings.defaultRestTimer}
                onChange={(e) => setLocalSettings({...localSettings, defaultRestTimer: parseInt(e.target.value) || 0})}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-100 font-black focus:ring-1 focus:ring-emerald-500/30 outline-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">Seconds</span>
            </div>
          </section>

          {/* Wake Lock */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Monitor size={14} className="text-emerald-400" />
              Display Control
            </h3>
            <button 
              onClick={() => setLocalSettings({...localSettings, enableWakeLock: !localSettings.enableWakeLock})}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${localSettings.enableWakeLock ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
            >
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest">Keep Screen Awake</p>
                <p className="text-[9px] opacity-60">Prevents screen sleep during workout</p>
              </div>
              {localSettings.enableWakeLock ? <Check size={18} /> : <div className="w-5 h-5 rounded border border-slate-800" />}
            </button>
          </section>

          {/* Exercise DB */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Database size={14} className="text-emerald-400" />
              Exercise Database
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Auto-populate Target Count</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={localSettings.autoPopulateCount}
                    onChange={(e) => setLocalSettings({...localSettings, autoPopulateCount: parseInt(e.target.value) || 0})}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-100 font-black focus:ring-1 focus:ring-emerald-500/30 outline-none"
                  />
                  <button 
                    onClick={handleAutopopulate}
                    disabled={isPopulating}
                    className="px-6 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-black rounded-2xl border border-slate-700/50 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isPopulating ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                    <span className="text-[10px] uppercase tracking-widest hidden sm:inline">Sync</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Included Body Parts</label>
                <div className="grid grid-cols-2 gap-2">
                  {BODY_PARTS.map(part => (
                    <button 
                      key={part} 
                      onClick={() => toggleBodyPart(part)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${localSettings.includedBodyParts.includes(part) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-slate-400'}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest">{part}</span>
                      {localSettings.includedBodyParts.includes(part) && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="space-y-4 pt-4 border-t border-slate-800/50">
            <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <AlertTriangle size={14} />
              Danger Zone
            </h3>
            <button 
              onClick={handleMasterReset}
              className={`w-full flex items-center justify-between p-5 rounded-3xl border transition-all ${resetConfirm ? 'bg-rose-600 border-rose-600 text-white animate-pulse' : 'bg-rose-500/5 border-rose-500/20 text-rose-500 hover:bg-rose-500/10'}`}
            >
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest">{resetConfirm ? 'Confirm Wipe?' : 'Master Reset'}</p>
                <p className={`text-[9px] font-bold ${resetConfirm ? 'text-white/80' : 'text-slate-500 opacity-60'}`}>Purge all workouts, biometrics, and plans</p>
              </div>
              <Trash2 size={20} className={resetConfirm ? 'text-white' : 'text-rose-500'} />
            </button>
          </section>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/80 shrink-0">
          <button 
            onClick={() => onSave(localSettings)}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] uppercase tracking-[0.2em] text-xs"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
