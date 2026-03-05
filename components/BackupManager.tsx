import React, { useState, useRef } from 'react';
import { ShieldCheck, Download, Upload, X, Loader2, CheckCircle2, AlertTriangle, FileJson, Info, Database, Sparkles, ChevronRight, BarChart3, Binary, Coffee, Bot, Layers, Utensils, Smartphone, Monitor, Tablet } from 'lucide-react';
import { storage } from '../services/storageService';
import { ironSync, MirrorFileMeta } from '../services/ironSyncService';

interface BackupManagerProps {
  onClose: () => void;
  onRestoring?: (isRestoring: boolean) => void;
}

interface BackupManifest {
  historyCount: number;
  biometricCount: number;
  templateCount: number;
  libraryCount: number;
  morphologyCount: number;
  fuelCount: number;
  summaryCount: number;
  pantryCount: number;
}

const BackupManager: React.FC<BackupManagerProps> = ({ onClose, onRestoring }) => {
  const [view, setView] = useState<'main' | 'picker' | 'restoring' | 'success'>('main');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [mirrorFiles, setMirrorFiles] = useState<MirrorFileMeta[]>([]);
  const [manifest, setManifest] = useState<BackupManifest | null>(null);
  const [stagedData, setStagedData] = useState<Record<string, any> | null>(null);
  const [stagedSource, setStagedSource] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getBackupData = async () => {
    const keys = [
      'ironflow_history', 'ironflow_biometrics', 'ironflow_templates',
      'ironflow_trash', 'ironflow_library', 'ironflow_deleted_exercises',
      'ironflow_settings', 'ironflow_morphology', 'ironflow_fuel', 'ironflow_fuel_profile',
      'ironflow_narrative_vault', 'ironflow_pantry'
    ];
    const data: Record<string, any> = {};
    await Promise.all(keys.map(async key => {
      const val = await storage.get(key);
      if (val !== null) data[key] = val;
    }));
    return data;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await getBackupData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IronFlow_Vault_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (err) { alert("Export failed."); } finally { setIsExporting(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setManifest({
          historyCount: data.ironflow_history?.length || 0,
          biometricCount: data.ironflow_biometrics?.length || 0,
          templateCount: data.ironflow_templates?.length || 0,
          libraryCount: data.ironflow_library?.length || 0,
          morphologyCount: data.ironflow_morphology?.length || 0,
          fuelCount: data.ironflow_fuel?.length || 0,
          summaryCount: Object.keys(data.ironflow_narrative_vault || {}).length,
          pantryCount: data.ironflow_pantry?.length || 0
        });
        setStagedData(data);
      } catch (err) { alert("Invalid backup file."); }
    };
    reader.readAsText(file);
  };

  // Opens the instance picker — fetches all mirror files from Drive
  const handleCloudRestore = async () => {
    setIsCloudLoading(true);
    try {
      const token = ironSync.getToken();
      const files = await ironSync.listAllMirrorFiles(token);
      if (files.length === 0) {
        alert('No cloud backups found in your Google Drive.');
        return;
      }
      setMirrorFiles(files);
      setView('picker');
    } catch (err: any) {
      if (err?.message?.includes('no_token')) {
        ironSync.startAuthRedirect();
      } else {
        alert('Failed to fetch cloud backups. Check your connection and try again.');
      }
    } finally {
      setIsCloudLoading(false);
    }
  };

  // Called when the user taps a specific instance card in the picker
  const handleSelectMirror = async (file: MirrorFileMeta) => {
    setIsCloudLoading(true);
    try {
      const cloudData = await ironSync.downloadMirrorById(file.driveFileId);
      if (!cloudData) {
        alert('Could not download that backup. Try again.');
        return;
      }
      const data = cloudData.data;
      setManifest({
        historyCount:    data.ironflow_history?.length                          || 0,
        biometricCount:  data.ironflow_biometrics?.length                       || 0,
        templateCount:   data.ironflow_templates?.length                        || 0,
        libraryCount:    data.ironflow_library?.length                          || 0,
        morphologyCount: data.ironflow_morphology?.length                       || 0,
        fuelCount:       data.ironflow_fuel?.length                             || 0,
        summaryCount:    Object.keys(data.ironflow_narrative_vault || {}).length,
        pantryCount:     data.ironflow_pantry?.length                           || 0,
      });
      setStagedData(data);
      setStagedSource(file.instanceName);
      setView('main');
    } catch (err: any) {
      if (err?.message?.includes('no_token')) {
        ironSync.startAuthRedirect();
      } else {
        alert('Failed to fetch cloud backup. Check your connection and try again.');
      }
    } finally {
      setIsCloudLoading(false);
    }
  };

  const executeRestore = async () => {
    if (!stagedData) return;
    setView('restoring');
    setIsImporting(true);
    if (onRestoring) onRestoring(true);

    try {
      setStatusText('Rebuilding Neural Core...');
      setProgress(20);

      // Preserve the current device's settings — specifically ironSyncConnected,
      // lastCloudSync, and units preference. We never want to overwrite these
      // with values from the source device, as they may differ and overwriting
      // would break sync or disconnect the vault on the current device.
      const currentSettings = await storage.get('ironflow_settings');
      const dataToRestore = { ...stagedData };
      if (currentSettings) {
        dataToRestore['ironflow_settings'] = currentSettings;
      } else {
        // No current settings — drop settings from restore entirely so the
        // app boots with defaults rather than another device's config.
        delete dataToRestore['ironflow_settings'];
      }

      // overwriteEverything clears the store and writes all keys in a single
      // atomic IndexedDB transaction — either all succeed or none do.
      await storage.overwriteEverything(dataToRestore);

      // Write a flag so App.tsx knows not to upload on the next boot —
      // we've just restored, the cloud copy is the source of truth.
      localStorage.setItem('ironflow_just_restored', 'true');

      setProgress(100);
      setStatusText('Reconstruction complete.');
    } catch (e: any) {
      console.error('Restore failed:', e?.message || e);
      alert('Restore encountered an error. The page will reload.');
      window.location.reload();
      return;
    }

    // We do NOT call onRestoring(false) here — we want to keep blocking
    // auto-saves in App.tsx until the user reloads the page.
    setView('success');
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col h-[75vh] shadow-2xl overflow-hidden relative">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".json" className="hidden" />
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><ShieldCheck className="text-emerald-400" size={24} /></div><div><h2 className="text-2xl font-black text-slate-100 tracking-tight">IronVault</h2><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Mirror & Recovery</p></div></div>
          <button onClick={onClose} className="p-3 bg-slate-800 rounded-2xl text-slate-400 transition-all"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
          {view === 'main' && (
            <div className="h-full">
              {!stagedData ? (
                <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-3xl mb-2"><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Secure Archive System</h3><p className="text-sm text-slate-500 leading-relaxed italic">Generating a complete JSON snapshot of your longitudinal progress.</p></div>
                  <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-6 p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl hover:bg-emerald-500/10 group text-left"><div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover:scale-110 transition-transform">{isExporting ? <Loader2 className="animate-spin text-emerald-400" /> : <Download className="text-emerald-400" size={28} />}</div><div><h3 className="text-lg font-black text-slate-100">Export Local Vault</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Generate .json master file</p></div><ChevronRight className="ml-auto text-slate-800" /></button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-6 p-6 bg-cyan-500/5 border border-cyan-500/10 rounded-3xl hover:bg-cyan-500/10 group text-left"><div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-cyan-500/20 group-hover:scale-110 transition-transform"><Upload className="text-cyan-400" size={28} /></div><div><h3 className="text-lg font-black text-slate-100">Restore from File</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Inject external .json state</p></div><ChevronRight className="ml-auto text-slate-800" /></button>
                  <button onClick={handleCloudRestore} disabled={isCloudLoading} className="flex items-center gap-6 p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl hover:bg-amber-500/10 group text-left"><div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-amber-500/20 group-hover:scale-110 transition-transform">{isCloudLoading ? <Loader2 className="animate-spin text-amber-400" /> : <Bot className="text-amber-400" size={28} />}</div><div><h3 className="text-lg font-black text-slate-100">Restore from Cloud</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Pull from IronVault Mirror</p></div><ChevronRight className="ml-auto text-slate-800" /></button>
                </div>
              ) : (
                <div className="space-y-6 pb-24 animate-in slide-in-from-bottom-4">
                  <div className="bg-cyan-500/10 border border-cyan-500/20 p-6 rounded-3xl flex gap-4 items-center"><FileJson className="text-cyan-400 shrink-0" size={24} /><div><h4 className="font-black text-cyan-400 uppercase text-xs">Mirror Archive Validated</h4><p className="text-xs text-slate-400 mt-1">Source: <span className="text-slate-200 font-black">{stagedSource}</span> — ready for protocol reconstruction.</p></div></div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Logs</p><p className="text-lg font-black text-slate-100">{manifest?.historyCount}</p></div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Plans</p><p className="text-lg font-black text-slate-100">{manifest?.templateCount}</p></div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Bios</p><p className="text-lg font-black text-slate-100">{manifest?.biometricCount}</p></div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Fuel</p><p className="text-lg font-black text-slate-100">{manifest?.fuelCount}</p></div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Pantry</p><p className="text-lg font-black text-slate-100">{manifest?.pantryCount}</p></div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Morph</p><p className="text-lg font-black text-slate-100">{manifest?.morphologyCount}</p></div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Library</p><p className="text-lg font-black text-slate-100">{manifest?.libraryCount}</p></div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase">Narrative</p><p className="text-lg font-black text-slate-100">{manifest?.summaryCount}</p></div>
                  </div>
                  <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl flex gap-3"><AlertTriangle className="text-rose-500 shrink-0" size={16} /><p className="text-[10px] text-rose-300 font-bold uppercase leading-relaxed">System Overwrite: This restoration will permanently replace all current device protocols.</p></div>
                </div>
              )}
            </div>
          )}
          {view === 'picker' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Vault to Restore</p>
                <button onClick={() => setView('main')} className="text-[10px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors">← Back</button>
              </div>
              {isCloudLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="animate-spin text-cyan-400" size={32} />
                  <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest ai-loading-pulse">Fetching vault data...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mirrorFiles.map((file) => {
                    const ago = (() => {
                      const diffMs  = Date.now() - file.lastUpdated;
                      const diffMin = Math.floor(diffMs / 60000);
                      if (diffMin < 60)   return `${diffMin}m ago`;
                      const diffHr = Math.floor(diffMin / 60);
                      if (diffHr  < 24)   return `${diffHr}h ago`;
                      const diffDay = Math.floor(diffHr / 24);
                      return `${diffDay}d ago`;
                    })();
                    return (
                      <button
                        key={file.driveFileId}
                        onClick={() => handleSelectMirror(file)}
                        className="w-full text-left p-5 bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 hover:bg-cyan-500/5 rounded-2xl transition-all group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[11px] font-black text-slate-100 uppercase tracking-widest truncate">{file.instanceName}</span>
                              {file.isCurrentDevice && (
                                <span className="shrink-0 text-[10px] font-black text-cyan-400 uppercase tracking-widest border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 rounded-md">This device</span>
                              )}
                            </div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{ago}</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { label: 'Logs',    val: file.historyCount },
                                { label: 'Plans',   val: file.templateCount },
                                { label: 'Bios',    val: file.biometricCount },
                                { label: 'Fuel',    val: file.fuelCount },
                                { label: 'Pantry',  val: file.pantryCount },
                                { label: 'Morph',   val: file.morphologyCount },
                                { label: 'Library', val: file.libraryCount },
                                { label: 'Notes',   val: file.summaryCount },
                              ].map(({ label, val }) => (
                                <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-center">
                                  <p className="text-[10px] font-black text-slate-400 uppercase">{label}</p>
                                  <p className="text-sm font-black text-slate-100">{val}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <ChevronRight className="text-slate-700 group-hover:text-cyan-400 transition-colors shrink-0 mt-1" size={18} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {view === 'restoring' && (<div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in"><div className="relative"><div className="absolute inset-0 bg-cyan-500/20 blur-[80px] rounded-full animate-pulse" /><Loader2 className="animate-spin text-cyan-400 relative z-10" size={64} /></div><div className="w-full max-sm space-y-4 text-center"><div className="space-y-1"><h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">Neural Reconstitution</h3><p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest ai-loading-pulse">{statusText}</p></div><div className="relative h-4 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner"><div className="h-full bg-gradient-to-r from-cyan-600 to-emerald-500 transition-all duration-300 relative shimmer-bar shadow-[0_0_15px_rgba(34,211,238,0.4)]" style={{ width: `${progress}%` }} /><span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white mix-blend-difference">{progress}% Committed</span></div></div></div>)}
          {view === 'success' && (<div className="h-full flex flex-col items-center justify-center space-y-8 text-center animate-in zoom-in-95 duration-500"><div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center border-4 border-emerald-500/40 relative"><div className="absolute inset-0 bg-emerald-500/10 blur-[60px] rounded-full" /><CheckCircle2 className="text-emerald-400 relative z-10" size={56} /></div><div className="space-y-3"><h3 className="text-3xl font-black text-slate-100 uppercase tracking-tighter">Neural Core Re-initialized</h3><p className="text-sm text-slate-500 max-w-xs mx-auto italic leading-relaxed">System refresh is required to finalize data binding.</p></div><button onClick={() => window.location.reload()} className="px-12 py-5 bg-emerald-500 text-slate-950 font-black rounded-3xl uppercase tracking-[0.2em] text-xs shadow-[0_20px_40px_rgba(16,185,129,0.3)] active:scale-95 transition-all">Re-initialize Flow</button></div>)}
        </div>
        {view === 'main' && stagedData && (<div className="p-6 border-t border-slate-800 bg-slate-900/90 backdrop-blur-xl shrink-0 flex gap-4"><button onClick={() => { setStagedData(null); setStagedSource(''); }} className="flex-1 py-4 bg-slate-800 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-[10px]">Abort Restore</button><button onClick={executeRestore} className="flex-[2] py-4 bg-cyan-500 text-slate-950 font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-cyan-500/20 active:scale-95 transition-all">Confirm Neural Sync</button></div>)}
      </div>
    </div>
  );
};

export default BackupManager;