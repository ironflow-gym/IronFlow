import React, { useState, useRef } from 'react';
import { ShieldCheck, Download, Upload, X, Loader2, CheckCircle2, AlertTriangle, FileJson, Info, Database, Sparkles, ChevronRight, BarChart3, Binary, Coffee, Bot, Layers, Utensils } from 'lucide-react';
import { storage } from '../services/storageService';

interface BackupManagerProps {
  onClose: () => void;
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

const BackupManager: React.FC<BackupManagerProps> = ({ onClose }) => {
  const [view, setView] = useState<'main' | 'restoring' | 'success'>('main');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [manifest, setManifest] = useState<BackupManifest | null>(null);
  const [stagedData, setStagedData] = useState<Record<string, any> | null>(null);
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

  const executeRestore = async () => {
    if (!stagedData) return;
    setView('restoring');
    setIsImporting(true);
    const keys = Object.keys(stagedData);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      setStatusText(`Reconstructing ${key.replace('ironflow_', '').replace('_', ' ')}...`);
      await storage.set(key, stagedData[key]);
      setProgress(Math.round(((i + 1) / keys.length) * 100));
      await new Promise(r => setTimeout(r, 150));
    }
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
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-6 p-6 bg-cyan-500/5 border border-cyan-500/10 rounded-3xl hover:bg-cyan-500/10 group text-left"><div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-cyan-500/20 group-hover:scale-110 transition-transform"><Upload className="text-cyan-400" size={28} /></div><div><h3 className="text-lg font-black text-slate-100">Restore from Vault</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Inject external .json state</p></div><ChevronRight className="ml-auto text-slate-800" /></button>
                </div>
              ) : (
                <div className="space-y-6 pb-24 animate-in slide-in-from-bottom-4">
                  <div className="bg-cyan-500/10 border border-cyan-500/20 p-6 rounded-3xl flex gap-4 items-center"><FileJson className="text-cyan-400 shrink-0" size={24} /><div><h4 className="font-black text-cyan-400 uppercase text-xs">Mirror Archive Validated</h4><p className="text-xs text-slate-400 mt-1">Ready for protocol reconstruction.</p></div></div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[8px] font-black text-slate-500 uppercase">Logs</p><p className="text-lg font-black text-slate-100">{manifest?.historyCount}</p></div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[8px] font-black text-slate-500 uppercase">Plans</p><p className="text-lg font-black text-slate-100">{manifest?.templateCount}</p></div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[8px] font-black text-slate-500 uppercase">Fuel</p><p className="text-lg font-black text-slate-100">{manifest?.fuelCount}</p></div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl"><p className="text-[8px] font-black text-slate-500 uppercase">Pantry</p><p className="text-lg font-black text-slate-100">{manifest?.pantryCount}</p></div>
                  </div>
                  <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl flex gap-3"><AlertTriangle className="text-rose-500 shrink-0" size={16} /><p className="text-[10px] text-rose-300 font-bold uppercase leading-relaxed">System Overwrite: This restoration will permanently replace all current device protocols.</p></div>
                </div>
              )}
            </div>
          )}
          {view === 'restoring' && (<div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in"><div className="relative"><div className="absolute inset-0 bg-cyan-500/20 blur-[80px] rounded-full animate-pulse" /><Loader2 className="animate-spin text-cyan-400 relative z-10" size={64} /></div><div className="w-full max-sm space-y-4 text-center"><div className="space-y-1"><h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">Neural Reconstitution</h3><p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest ai-loading-pulse">{statusText}</p></div><div className="relative h-4 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner"><div className="h-full bg-gradient-to-r from-cyan-600 to-emerald-500 transition-all duration-300 relative shimmer-bar shadow-[0_0_15px_rgba(34,211,238,0.4)]" style={{ width: `${progress}%` }} /><span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white mix-blend-difference">{progress}% Committed</span></div></div></div>)}
          {view === 'success' && (<div className="h-full flex flex-col items-center justify-center space-y-8 text-center animate-in zoom-in-95 duration-500"><div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center border-4 border-emerald-500/40 relative"><div className="absolute inset-0 bg-emerald-500/10 blur-[60px] rounded-full" /><CheckCircle2 className="text-emerald-400 relative z-10" size={56} /></div><div className="space-y-3"><h3 className="text-3xl font-black text-slate-100 uppercase tracking-tighter">Neural Core Re-initialized</h3><p className="text-sm text-slate-500 max-w-xs mx-auto italic leading-relaxed">System refresh is required to finalize data binding.</p></div><button onClick={() => window.location.reload()} className="px-12 py-5 bg-emerald-500 text-slate-950 font-black rounded-3xl uppercase tracking-[0.2em] text-xs shadow-[0_20px_40px_rgba(16,185,129,0.3)] active:scale-95 transition-all">Re-initialize Flow</button></div>)}
        </div>
        {view === 'main' && stagedData && (<div className="p-6 border-t border-slate-800 bg-slate-900/90 backdrop-blur-xl shrink-0 flex gap-4"><button onClick={() => setStagedData(null)} className="flex-1 py-4 bg-slate-800 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-[10px]">Abort Restore</button><button onClick={executeRestore} className="flex-[2] py-4 bg-cyan-500 text-slate-950 font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-cyan-500/20 active:scale-95 transition-all">Confirm Neural Sync</button></div>)}
      </div>
    </div>
  );
};

export default BackupManager;