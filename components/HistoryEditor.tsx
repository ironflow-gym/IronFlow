
import React, { useState, useMemo, useRef } from 'react';
import { X, Save, Trash2, Plus, RefreshCcw, Search, BookOpen, ChevronRight, Activity, ShieldAlert, Binary } from 'lucide-react';
import { HistoricalLog, UserSettings, ExerciseLibraryItem } from '../types';
import { GeminiService } from '../services/geminiService';
import { DEFAULT_LIBRARY } from './ExerciseLibrary';

interface HistoryEditorProps {
  date: string;
  logs: HistoricalLog[];
  onSave: (logs: HistoricalLog[]) => void;
  onClose: () => void;
  userSettings: UserSettings;
  aiService: GeminiService;
}

const HistoryEditor: React.FC<HistoryEditorProps> = ({ date, logs, onSave, onClose, userSettings, aiService }) => {
  const [editedLogs, setEditedLogs] = useState<HistoricalLog[]>([...logs]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('All');
  const [swappingExerciseName, setSwappingExerciseName] = useState<string | null>(null);

  const fullLibrary = useMemo(() => {
    const custom = JSON.parse(localStorage.getItem('ironflow_library') || '[]');
    const map = new Map<string, ExerciseLibraryItem>();
    DEFAULT_LIBRARY.forEach(item => map.set(item.name.toLowerCase(), item));
    custom.forEach((item: ExerciseLibraryItem) => map.set(item.name.toLowerCase(), item));
    return Array.from(map.values());
  }, []);

  const categories = useMemo(() => ['All', ...new Set(fullLibrary.map(i => i.category))], [fullLibrary]);

  const filteredLibrary = useMemo(() => {
    return fullLibrary.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(pickerSearch.toLowerCase());
      const matchesCategory = pickerCategory === 'All' || item.category === pickerCategory;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [fullLibrary, pickerSearch, pickerCategory]);

  // Grouping logs for display by exercise
  const exerciseGroups = useMemo(() => {
    const ordered: string[] = [];
    editedLogs.forEach(l => {
      if (!ordered.includes(l.exercise)) ordered.push(l.exercise);
    });
    return ordered.map(name => ({
      name,
      category: editedLogs.find(l => l.exercise === name)?.category || 'Other',
      logs: editedLogs.filter(l => l.exercise === name)
    }));
  }, [editedLogs]);

  const updateSet = (logIndex: number, updates: Partial<HistoricalLog>) => {
    const newLogs = [...editedLogs];
    // Find actual index in flat array
    const exerciseName = editedLogs[logIndex].exercise;
    const sameExLogs = editedLogs.filter(l => l.exercise === exerciseName);
    const setIndex = sameExLogs.indexOf(editedLogs[logIndex]);
    
    newLogs[logIndex] = { ...newLogs[logIndex], ...updates };
    setEditedLogs(newLogs);
  };

  const removeSet = (logIndex: number) => {
    setEditedLogs(prev => prev.filter((_, i) => i !== logIndex));
  };

  const addSetToExercise = (exerciseName: string) => {
    const baseLog = editedLogs.find(l => l.exercise === exerciseName);
    if (!baseLog) return;
    
    const newLog: HistoricalLog = {
      ...baseLog,
      weight: baseLog.weight,
      reps: baseLog.reps,
      completedAt: (baseLog.completedAt || Date.now()) + 60000, // +1 min
      isWarmup: false
    };
    
    setEditedLogs(prev => [...prev, newLog]);
  };

  const reMapExercise = (oldName: string, newItem: ExerciseLibraryItem) => {
    setEditedLogs(prev => prev.map(l => l.exercise === oldName ? {
      ...l,
      exercise: newItem.name,
      category: newItem.category
    } : l));
    setIsPickerOpen(false);
    setSwappingExerciseName(null);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col h-[85vh] shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-3 tracking-tight">
              <Activity className="text-indigo-400" size={24} />
              Session Surgery
            </h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Editing {date}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
          {exerciseGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="bg-slate-950/40 border border-indigo-500/20 rounded-3xl overflow-hidden">
              <div className="px-5 py-4 border-b border-indigo-500/10 bg-indigo-500/5 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-black text-slate-100">{group.name}</h4>
                  <p className="text-[9px] font-black text-indigo-400/60 uppercase tracking-widest">{group.category}</p>
                </div>
                <button 
                  onClick={() => {
                    setSwappingExerciseName(group.name);
                    setIsPickerOpen(true);
                  }}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl transition-all border border-slate-700/50"
                  title="Re-map Exercise"
                >
                  <RefreshCcw size={16} />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {group.logs.map((log) => {
                  const flatIdx = editedLogs.indexOf(log);
                  return (
                    <div key={flatIdx} className="flex items-center gap-3 group/set">
                      <button 
                        onClick={() => updateSet(flatIdx, { isWarmup: !log.isWarmup })}
                        className={`w-8 h-8 rounded-lg border text-[10px] font-black transition-all shrink-0 ${log.isWarmup ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                      >
                        {log.isWarmup ? 'W' : (group.logs.indexOf(log) + 1)}
                      </button>
                      
                      <div className="flex-1 grid grid-cols-2 gap-2 bg-slate-900/50 p-2 rounded-xl border border-slate-800/50 focus-within:border-indigo-500/30 transition-all">
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            step="0.5" 
                            value={log.weight} 
                            onChange={(e) => updateSet(flatIdx, { weight: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-transparent text-xs font-black text-slate-200 outline-none p-1"
                          />
                          <span className="text-[8px] font-black text-slate-600 uppercase pr-1">{log.unit === 'lbs' ? 'lb' : 'kg'}</span>
                        </div>
                        <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                          <input 
                            type="number" 
                            value={log.reps} 
                            onChange={(e) => updateSet(flatIdx, { reps: parseInt(e.target.value) || 0 })}
                            className="w-full bg-transparent text-xs font-black text-slate-200 outline-none p-1"
                          />
                          <span className="text-[8px] font-black text-slate-600 uppercase pr-1">rep</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => removeSet(flatIdx)}
                        className="p-2 text-slate-700 hover:text-rose-500 opacity-0 group-hover/set:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
                <button 
                  onClick={() => addSetToExercise(group.name)}
                  className="w-full py-2.5 bg-slate-900/40 border border-slate-800 border-dashed rounded-xl text-[9px] font-black text-slate-600 uppercase tracking-widest hover:text-indigo-400 hover:border-indigo-500/30 transition-all mt-2"
                >
                  + Add Historical Set
                </button>
              </div>
            </div>
          ))}

          {editedLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-700">
               <ShieldAlert size={48} className="mb-4 opacity-20" />
               <p className="text-xs font-black uppercase tracking-widest">No Logs Remaining</p>
               <p className="text-[10px] font-bold italic mt-2">Saving will purge this session entirely.</p>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/80 backdrop-blur-xl shrink-0 flex gap-4">
           <button 
             onClick={onClose}
             className="flex-1 py-4.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black rounded-2xl transition-all uppercase tracking-widest text-[10px]"
           >
             Discard
           </button>
           <button 
             onClick={() => onSave(editedLogs)}
             className="flex-[2] py-4.5 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black rounded-2xl transition-all shadow-xl shadow-indigo-500/20 uppercase tracking-widest text-[10px] active:scale-95"
           >
             Commit History Edits
           </button>
        </div>

        {/* Exercise Re-map Picker */}
        {isPickerOpen && (
          <div className="fixed inset-0 z-[210] bg-slate-950/50 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col h-[75vh] shadow-2xl overflow-hidden relative">
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 backdrop-blur-xl">
                 <div className="flex items-center gap-3">
                   <BookOpen className="text-indigo-400" size={20} />
                   <div>
                     <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight">Re-map Movement</h3>
                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Select replacement for {swappingExerciseName}</p>
                   </div>
                 </div>
                 <button onClick={() => { setIsPickerOpen(false); setSwappingExerciseName(null); }} className="p-2.5 bg-slate-800 rounded-xl"><X size={18}/></button>
               </div>

               <div className="p-4 bg-slate-950/40 space-y-3 shrink-0 border-b border-slate-800/40">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Filter library..." 
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 pl-11 text-xs text-slate-100 outline-none"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700" size={14} />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {categories.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setPickerCategory(cat)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${pickerCategory === cat ? 'bg-indigo-500 text-slate-950 border-indigo-500' : 'bg-slate-900 border-slate-800 text-slate-600'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                  {filteredLibrary.map(item => (
                    <button 
                      key={item.name}
                      onClick={() => swappingExerciseName && reMapExercise(swappingExerciseName, item)}
                      className="w-full text-left p-4 bg-slate-950/40 border border-slate-800 rounded-2xl hover:border-indigo-500/40 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-200">{item.name}</p>
                        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{item.category}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-800 group-hover:text-indigo-400" />
                    </button>
                  ))}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryEditor;
