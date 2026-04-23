import React, { useState, useEffect } from 'react';
import { X, Settings, Ruler, Timer, Database, Check, RefreshCw, Loader2, Monitor, User, Trash2, AlertTriangle, Calendar, Cloud, CloudOff, Link, Unlink, Bot, Pencil, Key, CheckCircle2, AlertCircle, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { getBYOKKey, removeBYOKKey, getBYOKPaidKey, setBYOKPaidKey, removeBYOKPaidKey } from '../services/geminiService';
import ApiKeyModal from './ApiKeyModal';
import { UserSettings, ExerciseLibraryItem, IronSyncStatus } from '../types';
import { GeminiService } from '../services/geminiService';
import { storage } from '../services/storageService';
import { ironSync, getInstanceName, setInstanceName } from '../services/ironSyncService';
import { DEFAULT_LIBRARY } from './ExerciseLibrary';
import { DEFAULT_MEV_MRV } from '../src/utils';

interface SettingsModalProps {
  settings: UserSettings;
  syncStatus: IronSyncStatus;
  onSave: (settings: UserSettings) => void;
  onClose: () => void;
  aiService: GeminiService;
  onUpdateCustomLibrary: (lib: ExerciseLibraryItem[]) => void;
  onRefreshState?: () => Promise<void>;
}

const BODY_PARTS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Abs'];

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, syncStatus, onSave, onClose, aiService, onUpdateCustomLibrary, onRefreshState }) => {
  const [localSettings, setLocalSettings] = React.useState<UserSettings>({ ...settings });
  const [isPopulating, setIsPopulating] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showKeyEntry, setShowKeyEntry] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(getBYOKKey);
  const [confirmRemoveKey, setConfirmRemoveKey] = useState(false);
  const [paidKey, setPaidKey] = useState<string | null>(getBYOKPaidKey);
  const [showPaidKeyEntry, setShowPaidKeyEntry] = useState(false);
  const [paidKeyInput, setPaidKeyInput] = useState('');
  const [paidKeyValidating, setPaidKeyValidating] = useState(false);
  const [paidKeyError, setPaidKeyError] = useState<string | null>(null);
  const [confirmRemovePaidKey, setConfirmRemovePaidKey] = useState(false);
  const [instanceName, setInstanceNameState] = useState<string>(getInstanceName());

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

  const handleConnectSync = () => {
    // Just redirect — do not call onSave() here. The IndexedDB write from
    // onSave is async and may not commit before the page navigates away.
    // App.tsx detects hasPendingAuth() on return and sets ironSyncConnected=true
    // itself, after the token is confirmed valid.
    ironSync.startAuthRedirect();
    // Execution does not continue — the page navigates away.
  };

  const handleDisconnectSync = async () => {
    if (confirm("Sever neural link to Google Drive? Local records will persist.")) {
      await ironSync.disconnect();
      const { lastCloudSync, ...rest } = localSettings;
      const updated: UserSettings = { ...rest, ironSyncConnected: false };
      setLocalSettings(updated);
      onSave(updated);
    }
  };

  const handleManualSync = async () => {
    // Token should be valid (persisted from last auth). If expired,
    // the upload will throw and the user will be prompted to re-auth.
    try {
      const lastSync = await ironSync.uploadMirror();
      const updated = { ...localSettings, lastCloudSync: lastSync };
      setLocalSettings(updated);
      onSave(updated);
    } catch (e: any) {
      if (e?.message?.includes('no_token')) {
        // Token expired — redirect to re-auth
        ironSync.startAuthRedirect();
      } else {
        alert('Backup failed. Check your connection and try again.');
      }
    }
  };

  const handleMasterReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    localStorage.clear();
    await storage.clearAll();
    window.location.reload();
  };

  const handleAutopopulate = async () => {
    const customLibrary: ExerciseLibraryItem[] = await storage.get<ExerciseLibraryItem[]>('ironflow_library') || [];
    const totalCount = DEFAULT_LIBRARY.length + customLibrary.length;
    const target = localSettings.autoPopulateCount;

    if (totalCount > target) {
      const confirmProceed = window.confirm(`Your target count (${target}) is lower than the current database size (${totalCount}). This will remove the oldest ${totalCount - target} custom exercises from your library. Do you wish to proceed?`);
      if (!confirmProceed) return;
      const diff = totalCount - target;
      const newCustomLibrary = customLibrary.slice(diff);
      await storage.set('ironflow_library', newCustomLibrary);
      onUpdateCustomLibrary(newCustomLibrary);
      onSave(localSettings);
      return;
    }

    if (totalCount < target) {
      setIsPopulating(true);
      try {
        const needed = target - totalCount;
        const totalToFetch = Math.min(needed, 60); 
        const existingNames = [...DEFAULT_LIBRARY, ...customLibrary].map(i => i.name);
        const result = await aiService.autopopulateExerciseLibrary(totalToFetch, localSettings.includedBodyParts, existingNames);
        const filteredResult = result.filter(newItem => !existingNames.some(existing => existing.toLowerCase() === newItem.name.toLowerCase()));
        const finalCustomLibrary = [...customLibrary, ...filteredResult];
        await storage.set('ironflow_library', finalCustomLibrary);
        onUpdateCustomLibrary(finalCustomLibrary);
        onSave(localSettings);
      } catch (err) {
        alert("Failed to populate database.");
      } finally {
        setIsPopulating(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden relative">
        
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
          {/* AI Engine — BYOK */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Key size={14} className="text-emerald-400" />
              AI Engine
            </h3>
            {showKeyEntry ? (
              <ApiKeyModal
                aiService={aiService}
                inline
                onSuccess={() => {
                  setCurrentKey(getBYOKKey());
                  setShowKeyEntry(false);
                }}
                onDismiss={() => setShowKeyEntry(false)}
              />
            ) : currentKey ? (
              <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">API Key Active</p>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5 font-mono">{'••••••••••••' + currentKey.slice(-4)}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowKeyEntry(true)}
                    className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-700"
                  ><Key size={13} /> Update Key</button>
                  <button
                    onClick={() => {
                      if (!confirmRemoveKey) { setConfirmRemoveKey(true); setTimeout(() => setConfirmRemoveKey(false), 3000); return; }
                      removeBYOKKey();
                      aiService.resetKey();
                      setCurrentKey(null);
                      setConfirmRemoveKey(false);
                    }}
                    className={`py-3 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                      confirmRemoveKey
                        ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                    }`}
                  ><AlertCircle size={13} /> {confirmRemoveKey ? 'Confirm?' : 'Remove Key'}</button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 border border-slate-700 rounded-xl">
                    <Key size={16} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No API Key</p>
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5">AI features are disabled</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKeyEntry(true)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
                ><Key size={14} /> Add API Key</button>
              </div>
            )}

            {/* Paid Key (fallback) */}
            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Paid Tier Key (fallback)</p>
              {showPaidKeyEntry ? (
                <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-5 space-y-3">
                  <p className="text-[10px] text-slate-400 leading-relaxed">Enter your paid-tier Gemini API key. IronFlow will use your free key first and only switch to this when the free daily limit is reached.</p>
                  <input
                    type="password"
                    value={paidKeyInput}
                    onChange={e => { setPaidKeyInput(e.target.value); setPaidKeyError(null); }}
                    placeholder="AIza..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-slate-100 placeholder-slate-700 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 outline-none"
                    autoFocus
                  />
                  {paidKeyError && <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">{paidKeyError}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setShowPaidKeyEntry(false); setPaidKeyInput(''); setPaidKeyError(null); }} className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all">Cancel</button>
                    <button
                      onClick={async () => {
                        if (!paidKeyInput.trim()) return;
                        setPaidKeyValidating(true);
                        setPaidKeyError(null);
                        const err = await aiService.validateKey(paidKeyInput.trim());
                        setPaidKeyValidating(false);
                        if (err) { setPaidKeyError(err); return; }
                        setBYOKPaidKey(paidKeyInput.trim());
                        setPaidKey(paidKeyInput.trim());
                        aiService.resetKey();
                        setShowPaidKeyEntry(false);
                        setPaidKeyInput('');
                      }}
                      disabled={paidKeyValidating || !paidKeyInput.trim()}
                      className="py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95"
                    >{paidKeyValidating ? <Loader2 className="animate-spin" size={13} /> : <Key size={13} />} Save Key</button>
                  </div>
                </div>
              ) : paidKey ? (
                <div className="bg-slate-950/50 border border-amber-500/20 rounded-3xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/20 border border-amber-500/30 rounded-xl">
                        <CheckCircle2 size={16} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Paid Key Active</p>
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5 font-mono">{'••••••••••••' + paidKey.slice(-4)}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">Used automatically when the free key's daily limit is reached</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setPaidKeyInput(''); setShowPaidKeyEntry(true); }} className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-700"><Key size={13} /> Update</button>
                    <button
                      onClick={() => {
                        if (!confirmRemovePaidKey) { setConfirmRemovePaidKey(true); setTimeout(() => setConfirmRemovePaidKey(false), 3000); return; }
                        removeBYOKPaidKey();
                        aiService.resetKey();
                        setPaidKey(null);
                        setConfirmRemovePaidKey(false);
                      }}
                      className={`py-3 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${confirmRemovePaidKey ? 'bg-rose-600 border-rose-500 text-white animate-pulse' : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'}`}
                    ><AlertCircle size={13} /> {confirmRemovePaidKey ? 'Confirm?' : 'Remove'}</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setPaidKeyInput(''); setShowPaidKeyEntry(true); }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-amber-400 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                ><Key size={13} /> Add Paid Fallback Key</button>
              )}
            </div>

          </section>

          {/* IronVault: Cloud Backup */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Cloud size={14} className="text-emerald-400" />
              IronVault: Cloud Backup
            </h3>
            <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-5 space-y-5">
              {!localSettings.ironSyncConnected ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed italic">Securely backup your workouts, biometrics, and architecture to an encrypted Google Drive vault.</p>
                  <button 
                    onClick={handleConnectSync}
                    disabled={isConnecting}
                    className="w-full py-4 bg-white hover:bg-slate-100 text-slate-900 font-black rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] active:scale-95 shadow-lg shadow-white/5"
                  >
                    {isConnecting ? <Loader2 className="animate-spin" size={16} /> : <Link size={16} />}
                    Initialize Cloud Vault
                  </button>
                  <p className="text-[9px] text-slate-600 font-bold uppercase text-center tracking-tighter">Requires Google Account Access</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Vault Active</p>
                      <p className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">Last Backup: {localSettings.lastCloudSync ? new Date(localSettings.lastCloudSync).toLocaleString() : 'Pending...'}</p>
                    </div>
                    <div className={`p-2 rounded-lg border ${syncStatus === 'transmitting' ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'}`}>
                      <Cloud size={18} className={syncStatus === 'transmitting' ? 'animate-pulse' : ''} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Device Name</label>
                    <input
                      type="text"
                      value={instanceName}
                      maxLength={32}
                      onChange={e => setInstanceNameState(e.target.value)}
                      onBlur={e => {
                        const trimmed = e.target.value.trim();
                        if (trimmed) setInstanceName(trimmed);
                        setInstanceNameState(getInstanceName());
                      }}
                      placeholder="e.g. iPhone, Desktop..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-[10px] font-black text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Identifies this device in multi-vault restore</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleManualSync} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-700">
                      <RefreshCw size={14} /> Backup Now
                    </button>
                    <button onClick={handleDisconnectSync} className="flex-1 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-rose-500/20 active:scale-95">
                      <Unlink size={14} /> Sever Link
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[9px] text-slate-600 italic leading-relaxed px-1">IronVault uses a hidden 'appDataFolder' on your Drive. IronFlow cannot see your personal files.</p>
          </section>

          {/* Biological Profile */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <User size={14} className="text-emerald-400" />
              Biological Profile
            </h3>
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950/50 border border-slate-800 rounded-2xl">
              <button onClick={() => setLocalSettings({...localSettings, gender: 'male'})} className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${localSettings.gender === 'male' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Male</button>
              <button onClick={() => setLocalSettings({...localSettings, gender: 'female'})} className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${localSettings.gender === 'female' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Female</button>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 flex items-center gap-2"><Calendar size={12}/> Date of Birth</label>
              <input type="date" value={localSettings.dateOfBirth || ''} onChange={(e) => setLocalSettings({...localSettings, dateOfBirth: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-slate-100 font-bold focus:ring-1 focus:ring-emerald-500/30 outline-none" />
            </div>
          </section>

          {/* Units */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Ruler size={14} className="text-emerald-400" />
              Measurement System
            </h3>
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950/50 border border-slate-800 rounded-2xl">
              <button onClick={() => setLocalSettings({...localSettings, units: 'metric'})} className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${localSettings.units === 'metric' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Metric (KG)</button>
              <button onClick={() => setLocalSettings({...localSettings, units: 'imperial'})} className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${localSettings.units === 'imperial' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Imperial (LB)</button>
            </div>
          </section>

          {/* Rest Timer */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Timer size={14} className="text-emerald-400" />
              Default Rest Period
            </h3>
            <div className="relative">
              <input type="number" value={localSettings.defaultRestTimer} onChange={(e) => setLocalSettings({...localSettings, defaultRestTimer: parseInt(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-slate-100 font-black focus:ring-1 focus:ring-emerald-500/30 outline-none" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">Seconds</span>
            </div>
          </section>

          {/* Wake Lock */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Monitor size={14} className="text-emerald-400" />
              Display Control
            </h3>
            <button onClick={() => setLocalSettings({...localSettings, enableWakeLock: !localSettings.enableWakeLock})} className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${localSettings.enableWakeLock ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>
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
                  <input type="number" value={localSettings.autoPopulateCount} onChange={(e) => setLocalSettings({...localSettings, autoPopulateCount: parseInt(e.target.value) || 0})} className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-5 text-slate-100 font-black focus:ring-1 focus:ring-emerald-500/30 outline-none" />
                  <button onClick={handleAutopopulate} disabled={isPopulating} className="px-6 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-black rounded-2xl border border-slate-700/50 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50">
                    {isPopulating ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                    <span className="text-[10px] uppercase tracking-widest hidden sm:inline">Sync</span>
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Included Body Parts</label>
                <div className="grid grid-cols-2 gap-2">
                  {BODY_PARTS.map(part => (
                    <button key={part} onClick={() => toggleBodyPart(part)} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${localSettings.includedBodyParts.includes(part) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-slate-400'}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest">{part}</span>
                      {localSettings.includedBodyParts.includes(part) && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* AI Personality */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Bot size={14} className="text-emerald-400" />
              AI Coach Personality
            </h3>
            <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(['neutral', 'elite', 'gymbro'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setLocalSettings({ ...localSettings, aiPersonality: p })}
                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                      localSettings.aiPersonality === p || (!localSettings.aiPersonality && p === 'neutral')
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p === 'neutral' ? 'Neutral' : p === 'elite' ? 'Elite Coach' : 'Gym Bro'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setLocalSettings({ ...localSettings, aiPersonality: 'custom' })}
                className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  localSettings.aiPersonality === 'custom'
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Pencil size={13} /> Custom Style
              </button>
              {localSettings.aiPersonality === 'custom' && (
                <div className="space-y-2">
                  <textarea
                    value={localSettings.aiPersonalityCustom || ''}
                    onChange={e => setLocalSettings({ ...localSettings, aiPersonalityCustom: e.target.value.slice(0, 200) })}
                    placeholder="e.g. Stoic and minimal. Never use exclamation marks. Reference historical athletes."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-100 font-bold outline-none focus:ring-1 focus:ring-violet-500/30 resize-none placeholder:text-slate-700"
                  />
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">{(localSettings.aiPersonalityCustom || '').length}/200</p>
                </div>
              )}
              <p className="text-[9px] text-slate-600 italic leading-relaxed">
                {(!localSettings.aiPersonality || localSettings.aiPersonality === 'neutral') && 'Clinical, precise, no filler. Current default.'}
                {localSettings.aiPersonality === 'elite' && 'Performance-focused. Direct and data-driven. No hollow encouragement.'}
                {localSettings.aiPersonality === 'gymbro' && 'Hyped and casual. Gym slang welcome. Numbers stay accurate.'}
                {localSettings.aiPersonality === 'custom' && 'Your style directive is prepended to AI coaching responses.'}
              </p>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="space-y-4 pt-4 border-t border-slate-800/50">
            <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <AlertTriangle size={14} />
              Danger Zone
            </h3>
            <button onClick={handleMasterReset} className={`w-full flex items-center justify-between p-5 rounded-3xl border transition-all ${resetConfirm ? 'bg-rose-600 border-rose-600 text-white animate-pulse' : 'bg-rose-500/5 border-rose-500/20 text-rose-500 hover:bg-rose-500/10'}`}>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest">{resetConfirm ? 'Confirm Wipe?' : 'Master Reset'}</p>
                <p className={`text-[9px] font-bold ${resetConfirm ? 'text-white/80' : 'text-slate-500 opacity-60'}`}>Purge all workouts, biometrics, and plans</p>
              </div>
              <Trash2 size={20} className={resetConfirm ? 'text-white' : 'text-rose-500'} />
            </button>
          </section>
          {/* Training Goals */}
          <TrainingGoalsSection localSettings={localSettings} setLocalSettings={setLocalSettings} />
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/80 shrink-0">
          <button onClick={() => onSave(localSettings)} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] uppercase tracking-[0.2em] text-xs">Save Preferences</button>
        </div>
      </div>
    </div>
  );
};

// ── Training Goals + MEV/MRV sub-component ────────────────────────────────
const MUSCLE_GROUPS = Object.keys(DEFAULT_MEV_MRV);

interface TrainingGoalsSectionProps {
  localSettings: UserSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
}

const TrainingGoalsSection: React.FC<TrainingGoalsSectionProps> = ({ localSettings, setLocalSettings }) => {
  const [mevExpanded, setMevExpanded] = useState(false);
  const thresholds = { ...DEFAULT_MEV_MRV, ...(localSettings.mevMrvThresholds || {}) };

  const updateThreshold = (muscle: string, field: 'mev' | 'mav' | 'mrv', val: number) => {
    setLocalSettings(prev => ({
      ...prev,
      mevMrvThresholds: {
        ...DEFAULT_MEV_MRV,
        ...(prev.mevMrvThresholds || {}),
        [muscle]: { ...thresholds[muscle], [field]: val },
      },
    }));
  };

  return (
    <div className="space-y-4">
      {/* Weekly goal */}
      <div>
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-3">
          <Target size={14} className="text-emerald-400" />
          Training Goals
        </h3>
        <div className="relative">
          <input
            type="number"
            min={1} max={7}
            value={localSettings.weeklyWorkoutGoal ?? 3}
            onChange={e => setLocalSettings(prev => ({ ...prev, weeklyWorkoutGoal: Math.min(7, Math.max(1, parseInt(e.target.value) || 3)) }))}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-slate-100 font-black focus:ring-1 focus:ring-emerald-500/30 outline-none"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">Sessions / week</span>
        </div>
      </div>

      {/* MEV/MAV/MRV table — hidden on mobile (desktop-only feature) */}
      <div className="hidden lg:block">
        <button
          onClick={() => setMevExpanded(v => !v)}
          className="w-full flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2"
        >
          <span className="flex items-center gap-2">
            <Target size={14} className="text-emerald-400" />
            Muscle Volume Thresholds (MEV / MAV / MRV)
          </span>
          {mevExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {mevExpanded && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 px-4 py-2 border-b border-slate-800">
              {['Muscle Group', 'MEV', 'MAV', 'MRV'].map(h => (
                <span key={h} className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{h}</span>
              ))}
            </div>
            {MUSCLE_GROUPS.map(mg => (
              <div key={mg} className="grid grid-cols-4 px-4 py-2 border-b border-slate-800/50 items-center">
                <span className="text-[10px] font-black text-slate-300 truncate pr-2">{mg}</span>
                {(['mev', 'mav', 'mrv'] as const).map(field => (
                  <input
                    key={field}
                    type="number"
                    min={0} max={60}
                    value={thresholds[mg]?.[field] ?? DEFAULT_MEV_MRV[mg][field]}
                    onChange={e => updateThreshold(mg, field, parseInt(e.target.value) || 0)}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-black text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/30"
                  />
                ))}
              </div>
            ))}
            <p className="px-4 py-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
              Sets per week · changes save with preferences
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;