import React, { useState, useMemo } from 'react';
import { X, Bot, Sparkles, Plus, Trash2, Save, Wand2, Loader2, History, Search, BookOpen, Filter, Hash, ChevronRight, Layers, Target, Weight, Repeat, RefreshCcw, ArrowRight } from 'lucide-react';
import { WorkoutTemplate, ExerciseLibraryItem } from '../types';
import { GeminiService } from '../services/geminiService';
import { DEFAULT_LIBRARY } from './ExerciseLibrary';

interface TemplateEditorProps {
  template: WorkoutTemplate;
  onSave: (updatedTemplate: WorkoutTemplate) => void;
  onClose: () => void;
  aiService: GeminiService;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSave, onClose, aiService }) => {
  const [editedTemplate, setEditedTemplate] = useState<WorkoutTemplate>(JSON.parse(JSON.stringify(template)));
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [editMode, setEditMode] = useState<'manual' | 'ai'>('manual');
  
  // Picker state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('All');

  // Swap state for manual builder
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [isGettingSwaps, setIsGettingSwaps] = useState(false);
  const [aiSwapSuggestions, setAiSwapSuggestions] = useState<any[]>([]);
  const [swapSearch, setSwapSearch] = useState('');

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

  const handleManualUpdate = (index: number, field: string, value: any) => {
    const newExercises = [...editedTemplate.exercises];
    newExercises[index] = { ...newExercises[index], [field]: value };
    setEditedTemplate({ ...editedTemplate, exercises: newExercises });
  };

  const removeExercise = (index: number) => {
    const newExercises = editedTemplate.exercises.filter((_, i) => i !== index);
    setEditedTemplate({ ...editedTemplate, exercises: newExercises });
  };

  const addExercise = (item?: ExerciseLibraryItem) => {
    setEditedTemplate({
      ...editedTemplate,
      exercises: [
        ...editedTemplate.exercises,
        {
          name: item?.name || 'New Exercise',
          category: item?.category || 'Other',
          suggestedSets: 3,
          targetReps: '10-12',
          suggestedWeight: 0,
          suggestedReps: 10,
          rationale: item ? `Focused on ${item.muscles.join(', ')}` : 'Manually added'
        }
      ]
    });
    setIsPickerOpen(false);
  };

  const openSwapForIndex = async (index: number) => {
    const ex = editedTemplate.exercises[index];
    setSwappingIndex(index);
    setIsGettingSwaps(true);
    setAiSwapSuggestions([]);
    try {
      const result = await aiService.suggestSwaps(ex.name, ex.category);
      setAiSwapSuggestions(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGettingSwaps(false);
    }
  };

  const performSwap = (index: number, newEx: { name: string, category: string, rationale?: string }) => {
    const newExercises = [...editedTemplate.exercises];
    newExercises[index] = {
      ...newExercises[index],
      name: newEx.name,
      category: newEx.category,
      rationale: newEx.rationale || `Swapped from ${newExercises[index].name}`
    };
    setEditedTemplate({ ...editedTemplate, exercises: newExercises });
    setSwappingIndex(null);
  };

  const libraryForSwap = useMemo(() => {
    if (swappingIndex === null) return [];
    const targetEx = editedTemplate.exercises[swappingIndex];
    return fullLibrary.filter(item => 
      item.category === targetEx.category && 
      item.name.toLowerCase().includes(swapSearch.toLowerCase()) &&
      item.name !== targetEx.name
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [swappingIndex, swapSearch, editedTemplate.exercises, fullLibrary]);

  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiProcessing(true);
    try {
      const result = await aiService.editTemplateWithAI(editedTemplate, aiPrompt);
      setEditedTemplate(result);
      setAiPrompt('');
      setEditMode('manual');
    } catch (e) {
      alert(e instanceof Error ? e.message : "AI Edit failed");
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-2xl p-4 sm:p-6 flex items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[92vh] shadow-[0_0_80px_rgba(0,0,0,0.6)] overflow-hidden relative">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
          <div className="flex-1 mr-6">
            <div className="flex items-center gap-2 mb-1.5 text-emerald-400">
              <History size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Program Architect</span>
            </div>
            <input 
              value={editedTemplate.name}
              onChange={(e) => setEditedTemplate({...editedTemplate, name: e.target.value})}
              className="bg-transparent text-2xl font-black text-slate-100 border-none p-0 focus:ring-0 w-full placeholder:text-slate-800 tracking-tight"
              placeholder="Unnamed Routine"
            />
          </div>
          <button onClick={onClose} className="p-3.5 bg-slate-800/50 hover:bg-slate-800 hover:text-rose-400 rounded-2xl text-slate-400 transition-all border border-slate-700/30">
            <X size={20} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex p-1.5 bg-slate-950/60 mx-8 mt-6 rounded-[1.25rem] border border-slate-800/80 shrink-0">
          <button 
            onClick={() => setEditMode('manual')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editMode === 'manual' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Manual Builder
          </button>
          <button 
            onClick={() => setEditMode('ai')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${editMode === 'ai' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Bot size={14} />
            AI Tuning
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 pt-6 min-h-0 custom-scrollbar">
          {editMode === 'manual' ? (
            <div className="space-y-4">
              {editedTemplate.exercises.map((ex, idx) => (
                <div key={idx} className="bg-slate-950/40 border border-slate-800/60 rounded-[2rem] overflow-hidden group hover:border-slate-700/80 transition-all">
                  
                  {/* Exercise Card Header */}
                  <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-900/30 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-[9px] font-black text-emerald-500 border border-slate-700/50">{idx + 1}</span>
                      <span className="text-[9px] font-black uppercase text-slate-600 tracking-[0.2em]">Protocol Entry</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => openSwapForIndex(idx)}
                        className="p-1.5 text-slate-700 hover:text-amber-400 transition-colors"
                        title="Swap Movement"
                      >
                        <RefreshCcw size={14} />
                      </button>
                      <button 
                        onClick={() => removeExercise(idx)}
                        className="p-1.5 text-slate-700 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Primary Identification */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                          Exercise
                        </label>
                        <input 
                          value={ex.name}
                          onChange={(e) => handleManualUpdate(idx, 'name', e.target.value)}
                          className="w-full bg-slate-900/40 border border-slate-800/80 rounded-2xl px-4 py-3.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:bg-slate-900 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                          Target Zone
                        </label>
                        <input 
                          value={ex.category}
                          onChange={(e) => handleManualUpdate(idx, 'category', e.target.value)}
                          className="w-full bg-slate-900/40 border border-slate-800/80 rounded-2xl px-4 py-3.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:bg-slate-900 transition-all outline-none"
                        />
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center block">Sets</label>
                        <div className="relative">
                          <input 
                            type="number"
                            value={ex.suggestedSets}
                            onChange={(e) => handleManualUpdate(idx, 'suggestedSets', parseInt(e.target.value) || 0)}
                            className="w-full bg-slate-900/40 border border-slate-800/80 rounded-2xl py-3.5 text-center text-sm font-black text-slate-100 outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center block">Weight</label>
                        <div className="relative flex items-center">
                          <input 
                            type="number"
                            value={ex.suggestedWeight}
                            onChange={(e) => handleManualUpdate(idx, 'suggestedWeight', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900/40 border border-slate-800/80 rounded-2xl py-3.5 pl-6 pr-10 text-center text-sm font-black text-slate-100 outline-none focus:border-emerald-500/50 transition-all"
                          />
                          <span className="absolute right-3 text-[8px] font-black text-slate-600 uppercase tracking-tighter pointer-events-none">KG</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center block">Reps</label>
                        <input 
                          type="number"
                          value={ex.suggestedReps}
                          onChange={(e) => handleManualUpdate(idx, 'suggestedReps', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-900/40 border border-slate-800/80 rounded-2xl py-3.5 text-center text-sm font-black text-slate-100 outline-none focus:border-emerald-500/50 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={() => setIsPickerOpen(true)}
                  className="py-4.5 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 rounded-3xl transition-all flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] active:scale-[0.98]"
                >
                  <BookOpen size={18} />
                  Library Picker
                </button>
                <button 
                  onClick={() => addExercise()}
                  className="py-4.5 bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-200 hover:border-slate-700 rounded-3xl transition-all flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] active:scale-[0.98]"
                >
                  <Plus size={18} />
                  Custom Slot
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* AI Editor Panel */}
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] p-8 flex flex-col gap-5 shadow-inner relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 opacity-[0.03] rotate-12 transition-transform group-hover:rotate-6 duration-700 pointer-events-none">
                  <Bot size={120} />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative z-10">
                  {["Increase volume focus", "Strict mechanical intensity", "Stability oriented shift", "Full metabolic overhaul"].map(suggestion => (
                    <button 
                      key={suggestion}
                      onClick={() => setAiPrompt(suggestion)}
                      className="text-left px-4 py-3 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 border border-slate-800/80 transition-all hover:border-emerald-500/30"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex-1 flex flex-col min-h-[220px]">
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Analyze and modify: 'Add two sets of heavy rows at the end'"
                  className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-[2rem] p-8 text-slate-100 placeholder:text-slate-800 focus:ring-1 focus:ring-emerald-500/30 outline-none resize-none shadow-2xl transition-all"
                />
                <button 
                  onClick={handleAiEdit}
                  disabled={isAiProcessing || !aiPrompt.trim()}
                  className="absolute bottom-6 right-6 p-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-[1.5rem] shadow-2xl shadow-emerald-500/30 disabled:opacity-50 transition-all active:scale-90 flex items-center gap-3"
                >
                  {isAiProcessing ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Actions */}
        <div className="p-8 border-t border-slate-800 bg-slate-900/80 flex gap-4 shrink-0 backdrop-blur-xl">
          <button 
            onClick={onClose}
            className="flex-1 py-4.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black rounded-2xl transition-all uppercase tracking-[0.2em] text-[10px]"
          >
            Abandon
          </button>
          <button 
            onClick={() => onSave(editedTemplate)}
            className="flex-[2] py-4.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition-all shadow-2xl shadow-emerald-500/20 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-[10px]"
          >
            <Save size={18} />
            Commit Program
          </button>
        </div>

        {/* Swap Choice Modal (Shared logic with ActiveWorkout) */}
        {swappingIndex !== null && (
          <div className="fixed inset-0 z-[140] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                <div className="flex items-center gap-3">
                  <RefreshCcw className="text-amber-400" />
                  <div>
                    <h3 className="text-xl font-black text-slate-100 tracking-tight leading-none truncate max-w-[200px]">Architectural Swap</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Replace "{editedTemplate.exercises[swappingIndex].name}"</p>
                  </div>
                </div>
                <button onClick={() => setSwappingIndex(null)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                <section>
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles size={14} /> AI Recommendations
                  </h4>
                  {isGettingSwaps ? (
                    <div className="py-8 flex flex-col items-center justify-center space-y-3 opacity-50">
                      <Loader2 className="animate-spin text-emerald-500" size={24} />
                      <p className="text-[10px] font-black uppercase tracking-widest">Optimizing Substitution...</p>
                    </div>
                  ) : aiSwapSuggestions.length > 0 ? (
                    <div className="space-y-3">
                      {aiSwapSuggestions.map((alt, i) => (
                        <button 
                          key={i}
                          onClick={() => performSwap(swappingIndex, alt)}
                          className="w-full text-left p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all group"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <h5 className="font-black text-emerald-400 text-sm">{alt.name}</h5>
                            <ArrowRight size={14} className="text-emerald-500/30 group-hover:translate-x-1 transition-transform" />
                          </div>
                          <p className="text-[10px] text-slate-400 italic leading-tight">"{alt.rationale}"</p>
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-center py-4 text-xs text-slate-600 font-bold italic">No recommendations found.</p>}
                </section>

                <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <BookOpen size={14} className="text-cyan-400" /> Manual Library Filter
                  </h4>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Search relevant exercises..."
                      value={swapSearch}
                      onChange={(e) => setSwapSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 pl-11 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-slate-800"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
                  </div>
                  <div className="space-y-2">
                    {libraryForSwap.map(item => (
                      <button 
                        key={item.name}
                        onClick={() => performSwap(swappingIndex, item)}
                        className="w-full text-left p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-slate-700 hover:bg-slate-900 transition-all flex items-center justify-between group"
                      >
                        <span className="text-sm font-black text-slate-200">{item.name}</span>
                        <Plus size={16} className="text-slate-700 group-hover:text-emerald-400" />
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-6 border-t border-slate-800 bg-slate-900/80 shrink-0">
                <button 
                  onClick={() => setSwappingIndex(null)}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl transition-all uppercase tracking-widest text-[10px]"
                >
                  Keep Existing Strategy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Library Picker Modal */}
        {isPickerOpen && (
          <div className="fixed inset-0 z-[130] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[3rem] flex flex-col h-[90vh] shadow-[0_0_120px_rgba(0,0,0,0.8)] overflow-hidden relative animate-in zoom-in-95 duration-300">
               
               <div className="px-8 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 backdrop-blur-xl">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <BookOpen className="text-emerald-400" size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">Knowledge Catalog</h3>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Querying {fullLibrary.length} Biometrics</p>
                    </div>
                 </div>
                 <button onClick={() => setIsPickerOpen(false)} className="p-3.5 bg-slate-800/50 hover:bg-slate-800 hover:text-rose-400 rounded-2xl text-slate-400 transition-all border border-slate-700/20">
                   <X size={20}/>
                 </button>
               </div>
               
               <div className="p-5 bg-slate-950/40 flex flex-col gap-4 shrink-0 border-b border-slate-800/40">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <input 
                        type="text"
                        placeholder="Filter by name..."
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-5 py-3.5 pl-12 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-slate-700"
                      />
                      <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
                    </div>
                    
                    <div className="flex gap-1.5 p-1.5 bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-x-auto no-scrollbar max-w-full sm:max-w-[450px]">
                      {categories.map(cat => (
                        <button 
                          key={cat}
                          onClick={() => setPickerCategory(cat)}
                          className={`shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${pickerCategory === cat ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md' : 'bg-transparent border-transparent text-slate-600 hover:text-slate-300'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLibrary.map(item => (
                      <button 
                        key={item.name}
                        onClick={() => addExercise(item)}
                        className="w-full text-left p-4 bg-slate-900/30 border border-slate-800/60 rounded-[1.75rem] hover:border-emerald-500/40 hover:bg-slate-800/20 transition-all group flex items-start gap-4 shadow-sm relative overflow-hidden"
                      >
                        <div className="absolute -right-2 -bottom-2 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                          <Layers size={48} />
                        </div>
                        <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-800 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all shrink-0">
                          <Plus size={18} />
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <h4 className="text-[13px] font-black text-slate-200 tracking-tight truncate group-hover:text-emerald-400 transition-colors leading-tight mb-1">{item.name}</h4>
                          <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest truncate">
                            {item.category} • {item.muscles[0]}
                          </p>
                        </div>
                        <ChevronRight className="text-slate-900 group-hover:text-emerald-500/40 transition-colors shrink-0 self-center" size={14} />
                      </button>
                    ))}
                  </div>
               </div>

               <div className="px-8 py-4 bg-slate-950/60 border-t border-slate-800 flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">
                 <span>IronFlow Biometrics Database</span>
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                   <span>Ready for Import</span>
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateEditor;