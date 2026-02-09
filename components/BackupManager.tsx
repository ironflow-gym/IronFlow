
import React, { useState, useRef } from 'react';
import { ShieldCheck, Download, Upload, X, Loader2, CheckCircle2, AlertTriangle, FileJson, Info, Database, Sparkles, ChevronRight, BarChart3, Binary, Coffee } from 'lucide-react';

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

  const getBackupData = () => {
    const keys = [
      'ironflow_history', 'ironflow_biometrics', 'ironflow_templates',
      'ironflow_trash', 'ironflow_library', 'ironflow_deleted_exercises',
      'ironflow_settings', 'ironflow_morphology', 'ironflow_fuel', 'ironflow_fuel_profile'
    ];
    const data: Record<string, any> = {};
    keys.forEach(key => {
      const val = localStorage.getItem(key);
      if (val) {
        try { 
          let parsed = JSON.parse(val);
          
          // Apply robust 14-day filter to fuel history specifically
          if (key === 'ironflow_fuel' && Array.isArray(parsed)) {
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            twoWeeksAgo.setHours(0, 0, 0, 0); // Ensure start of day comparison
            parsed = parsed.filter((log: any) => new Date(log.date).getTime() >= twoWeeksAgo.getTime());
          }
          
          data[key] = parsed;
        } catch (e) { 
          data[key] = val; 
        }
      }
    });
    return data;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = getBackupData();
      const jsonString = JSON.stringify(data, null, 2);
      const now = new Date();
      const localDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const fileName = `IronFlow_Vault_${localDate}.json`;

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to generate backup.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        // Basic Validation
        if (!data.ironflow_settings && !data.ironflow_history) {
          throw new Error("Invalid IronFlow Vault file.");
        }

        const m: BackupManifest = {
          historyCount: data.ironflow_history?.length || 0,
          biometricCount: data.ironflow_biometrics?.length || 0,
          templateCount: data.ironflow_templates?.length || 0,
          libraryCount: data.ironflow_library?.length || 0,
          morphologyCount: data.ironflow_morphology?.length || 0,
          fuelCount: data.ironflow_fuel?.length || 0,
        };

        setManifest(m);
        setStagedData(data);
      } catch (err) {
        alert("Failed to parse file. Ensure it is a valid IronFlow backup.");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const executeRestore = async () => {
    if (!stagedData) return;
    setView('restoring');
    setIsImporting(true);

    const keys = Object.keys(stagedData);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = stagedData[key];
      
      let displayName = key.replace('ironflow_', '').replace('_', ' ');
      
      // Context-aware status text
      if (key === 'ironflow_fuel') setStatusText("Injecting metabolic history...");
      else if (key === 'ironflow_fuel_profile') setStatusText("Binding dietary manifesto...");
      else setStatusText(`Reconstructing ${displayName}...`);
      
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      
      const p = Math.round(((i + 1) / keys.length) * 100);
      setProgress(p);
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setStatusText("Finalizing system state...");
    await new Promise(resolve => setTimeout(resolve, 800));
    setView('success');
    setIsImporting(false);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <style>{`
        @keyframes pulse-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .shimmer-bar::after {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: pulse-shimmer 1.5s infinite;
        }
      `}</style>

      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col h-[75vh] shadow-2xl overflow-hidden relative">
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          accept=".json" 
          className="hidden" 
        />

        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <ShieldCheck className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100 tracking-tight">IronVault</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Mirror & Recovery</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
          {view === 'main' && (
            <div className="h-full">
              {!stagedData ? (
                <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-3xl mb-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Secure Archive System</h3>
                    <p className="text-sm text-slate-500 leading-relaxed italic">IronVault generates a single JSON mirror containing your entire athletic identity. Use this to transfer state between devices or secure your longitudinal progress.</p>
                  </div>

                  <button 
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center gap-6 p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group text-left"
                  >
                    <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                      {isExporting ? <Loader2 className="animate-spin text-emerald-400" /> : <Download className="text-emerald-400" size={28} />}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-100 leading-none">Export Local Vault</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Generate .json master file</p>
                    </div>
                    <ChevronRight className="ml-auto text-slate-800 group-hover:text-emerald-500/40 transition-colors" />
                  </button>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-6 p-6 bg-cyan-500/5 border border-cyan-500/10 rounded-3xl hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all group text-left"
                  >
                    <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                      <Upload className="text-cyan-400" size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-100 leading-none">Restore from Vault</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Inject external .json state</p>
                    </div>
                    <ChevronRight className="ml-auto text-slate-800 group-hover:text-cyan-500/40 transition-colors" />
                  </button>
                </div>
              ) : (
                <div className="space-y-6 pb-24 animate-in slide-in-from-bottom-4 duration-400">
                  <div className="bg-cyan-500/10 border border-cyan-500/20 p-6 rounded-3xl flex gap-4 items-center">
                    <FileJson className="text-cyan-400 shrink-0" size={24} />
                    <div>
                      <h4 className="font-black text-cyan-400 uppercase text-xs">Mirror Archive Validated</h4>
                      <p className="text-xs text-slate-400 mt-1">Ready for protocol reconstruction.</p>
                    </div>
                  </div>

                  {/* Compact Manifest Pills */}
                  <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-inner">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <Binary size={12} /> Staged Data Manifest
                    </h5>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-900 border border-slate-800/50 p-4 rounded-2xl flex items-center gap-4">
                         <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><Database size={14}/></div>
                         <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Logs</p>
                            <p className="text-lg font-black text-slate-100 leading-none">{manifest?.historyCount}</p>
                         </div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800/50 p-4 rounded-2xl flex items-center gap-4">
                         <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-500"><BarChart3 size={14}/></div>
                         <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Bios</p>
                            <p className="text-lg font-black text-slate-100 leading-none">{manifest?.biometricCount}</p>
                         </div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800/50 p-4 rounded-2xl flex items-center gap-4">
                         <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500"><ShieldCheck size={14}/></div>
                         <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Plans</p>
                            <p className="text-lg font-black text-slate-100 leading-none">{manifest?.templateCount}</p>
                         </div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800/50 p-4 rounded-2xl flex items-center gap-4">
                         <div className="p-2 bg-orange-500/10 rounded-lg text-[#fb923c]"><Coffee size={14}/></div>
                         <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Fuel</p>
                            <p className="text-lg font-black text-slate-100 leading-none">{manifest?.fuelCount}</p>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl flex gap-3">
                    <AlertTriangle className="text-rose-500 shrink-0" size={16} />
                    <p className="text-[10px] text-rose-300 font-bold uppercase leading-relaxed">System Overwrite: This restoration will permanently replace all current device protocols with the mirrored state.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'restoring' && (
            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 blur-[80px] rounded-full animate-pulse" />
                <Loader2 className="animate-spin text-cyan-400 relative z-10" size={64} />
              </div>
              <div className="w-full max-w-sm space-y-4 text-center">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">System Reconstruction</h3>
                  <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest ai-loading-pulse">{statusText}</p>
                </div>
                <div className="relative h-4 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-600 to-emerald-500 transition-all duration-300 relative shimmer-bar shadow-[0_0_15px_rgba(34,211,238,0.4)]" 
                    style={{ width: `${progress}%` }} 
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white mix-blend-difference">{progress}% Committed</span>
                </div>
              </div>
            </div>
          )}

          {view === 'success' && (
            <div className="h-full flex flex-col items-center justify-center space-y-8 text-center animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center border-4 border-emerald-500/40 relative">
                <div className="absolute inset-0 bg-emerald-500/10 blur-[60px] rounded-full" />
                <CheckCircle2 className="text-emerald-400 relative z-10" size={56} />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black text-slate-100 uppercase tracking-tighter">Vault Re-Initialized</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto italic leading-relaxed">Longitudinal state has been successfully recovered. A system refresh is required to finalize data binding.</p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="px-12 py-5 bg-emerald-500 text-slate-950 font-black rounded-3xl uppercase tracking-[0.2em] text-xs shadow-[0_20px_40px_rgba(16,185,129,0.3)] active:scale-95 transition-all"
              >
                Re-initialize Core
              </button>
            </div>
          )}
        </div>

        {/* Sticky Action Footer for Staged Data */}
        {view === 'main' && stagedData && (
          <div className="p-6 border-t border-slate-800 bg-slate-900/90 backdrop-blur-xl shrink-0 flex gap-4">
            <button 
              onClick={() => setStagedData(null)} 
              className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-[10px] transition-all"
            >
              Abort Restore
            </button>
            <button 
              onClick={executeRestore} 
              className="flex-[2] py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
            >
              Confirm System Overwrite
            </button>
          </div>
        )}

        {/* Informational Footer */}
        {view === 'main' && !stagedData && (
          <div className="p-8 bg-slate-950/40 border-t border-slate-800 shrink-0">
             <div className="flex gap-4 items-center">
                <div className="p-2.5 bg-slate-800 rounded-xl text-slate-500 border border-slate-700/50"><Info size={18} /></div>
                <p className="text-[10px] text-slate-600 font-bold uppercase leading-relaxed italic">
                  Note: The IronVault mirror is an encrypted snapshot. It now includes 14 days of metabolic history and your latest dietary profile.
                </p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupManager;
