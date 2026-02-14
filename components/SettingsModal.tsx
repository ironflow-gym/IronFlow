import React, { useState } from 'react';
import { X, Settings, Ruler, Timer, Database, Check, RefreshCw, Loader2, User } from 'lucide-react';
import { UserSettings, ExerciseLibraryItem } from '../types';
import { GeminiService } from '../services/GeminiService';

interface SettingsModalProps {
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
  onClose: () => void;
  aiService: GeminiService;
  onUpdateCustomLibrary: (lib: ExerciseLibraryItem[]) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose, aiService, onUpdateCustomLibrary }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>({ ...settings });
  const [isPopulating, setIsPopulating] = useState(false);

  const handleSave = () => {
    onSave(localSettings);
  };

  const handleAutopopulate = async () => {
    setIsPopulating(true);
    try {
      const result = await aiService.autopopulateExerciseLibrary(20, localSettings.includedBodyParts, []);
      onUpdateCustomLibrary(result);
      alert("Library successfully synchronized with 20 new movements.");
    } catch (e) {
      alert("Autopopulate failed.");
    } finally {
      setIsPopulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex items-center justify-center animate-in fade-in duration-500">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400"><Settings size={20} /></div>
             <div>
                <h3 className="text-xl font-black text-slate-100">System Preferences</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Interface Calibration</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 rounded-2xl text-slate-400"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
           <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Ruler size={14}/> Biological Units</h4>
              <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-2xl">
                 <button onClick={() => setLocalSettings({...localSettings, units: 'metric'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${localSettings.units === 'metric' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500'}`}>Metric (KG/CM)</button>
                 <button onClick={() => setLocalSettings({...localSettings, units: 'imperial'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${localSettings.units === 'imperial' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500'}`}>Imperial (LB/IN)</button>
              </div>
           </section>

           <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Timer size={14}/> Chronometric Constants</h4>
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                 <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-slate-300">Default Rest Interval</p>
                    <span className="text-lg font-black text-emerald-400">{localSettings.defaultRestTimer}s</span>
                 </div>
                 <input 
                   type="range" min="30" max="300" step="15" 
                   value={localSettings.defaultRestTimer} 
                   onChange={(e) => setLocalSettings({...localSettings, defaultRestTimer: parseInt(e.target.value)})}
                   className="w-full accent-emerald-500"
                 />
              </div>
           </section>

           <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Database size={14}/> AI Laboratory Data</h4>
              <button 
                onClick={handleAutopopulate}
                disabled={isPopulating}
                className="w-full py-4 bg-slate-950 border border-emerald-500/20 rounded-2xl text-emerald-400 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/5 transition-all"
              >
                {isPopulating ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Synchronize Movement Directory
              </button>
           </section>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
           <button 
             onClick={handleSave}
             className="w-full py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20"
           >
             <Check size={18} /> Deploy Configuration
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
