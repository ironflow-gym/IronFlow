import React, { useState } from 'react';
import { X, Save, Trash2, Plus } from 'lucide-react';
import { HistoricalLog, UserSettings } from '../types';
import { GeminiService } from '../services/GeminiService';

interface HistoryEditorProps {
  date: string;
  logs: HistoricalLog[];
  onSave: (logs: HistoricalLog[]) => void;
  onClose: () => void;
  userSettings: UserSettings;
  aiService: GeminiService;
}

const HistoryEditor: React.FC<HistoryEditorProps> = ({ date, logs, onSave, onClose, userSettings, aiService }) => {
  const [localLogs, setLocalLogs] = useState<HistoricalLog[]>([...logs]);

  const handleSave = () => {
    onSave(localLogs);
  };

  const updateLog = (idx: number, updates: Partial<HistoricalLog>) => {
    setLocalLogs(prev => prev.map((l, i) => i === idx ? { ...l, ...updates } : l));
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-3xl p-4 flex items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div>
            <h3 className="text-xl font-black text-slate-100">Session Audit</h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{date}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 rounded-2xl text-slate-400"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
           {localLogs.map((log, i) => (
             <div key={i} className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                   <p className="text-sm font-black text-slate-100">{log.exercise}</p>
                   <button onClick={() => setLocalLogs(prev => prev.filter((_, idx) => idx !== i))} className="text-rose-500 p-1"><Trash2 size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Weight ({log.unit})</p>
                      <input 
                        type="number" step="0.5" 
                        value={log.weight} 
                        onChange={(e) => updateLog(i, { weight: parseFloat(e.target.value) || 0 })}
                        className="bg-transparent w-full text-sm font-black text-slate-200 outline-none"
                      />
                   </div>
                   <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Reps</p>
                      <input 
                        type="number" 
                        value={log.reps} 
                        onChange={(e) => updateLog(i, { reps: parseInt(e.target.value) || 0 })}
                        className="bg-transparent w-full text-sm font-black text-slate-200 outline-none"
                      />
                   </div>
                </div>
             </div>
           ))}
           <button onClick={() => setLocalLogs([...localLogs, { date, exercise: "New Exercise", category: "Other", weight: 0, reps: 0, unit: userSettings.units === 'metric' ? 'kgs' : 'lbs' }])} className="w-full py-4 border-2 border-dashed border-slate-800 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest">+ Inject Entry</button>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
           <button 
             onClick={handleSave}
             className="w-full py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20"
           >
             <Save size={18} /> Commit Log Audit
           </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryEditor;
