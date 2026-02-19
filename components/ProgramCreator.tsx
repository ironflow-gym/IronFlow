import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Send, Loader2, Sparkles, Wand2, Bookmark, Trash2, Play, RefreshCw, Edit2, Plus, RefreshCcw, Bot, Zap, Target, Clock, Dumbbell, Calendar, ChevronDown, ChevronUp, Layers, CheckCircle2, Sliders, Edit3, MessageSquare, Info } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { WorkoutTemplate, HistoricalLog, ExerciseLibraryItem, MorphologyScan, UserSettings } from '../types';
import { DEFAULT_LIBRARY } from './ExerciseLibrary';
import { storage } from '../services/storageService';
import TemplateEditor from './TemplateEditor';

interface ProgramCreatorProps {
  onStart: (template: WorkoutTemplate) => void;
  onSaveTemplate: (template: WorkoutTemplate) => void;
  onSaveTemplatesBatch: (templates: WorkoutTemplate[]) => void;
  onDeleteTemplate: (id: string) => void;
  onEditTemplate: (template: WorkoutTemplate) => void;
  savedTemplates: WorkoutTemplate[];
  history: HistoricalLog[];
  aiService: GeminiService;
  customLibrary: ExerciseLibraryItem[];
  userSettings: UserSettings;
}

const AI_FEEDBACK_MESSAGES = [
  "Analyzing recovery history...",
  "Standardizing equipment matches...",
  "Optimizing for progressive overload...",
  "Calibrating muscle group fatigue...",
  "Architecting the perfect flow..."
];

interface QuickAction {
  label: string;
  prompt: string;
  icon: React.ReactNode;
  color: string;
}

interface StagedTemplate extends WorkoutTemplate {
  isCustomized?: boolean;
}

const ProgramCreator: React.FC<ProgramCreatorProps> = ({ 
  onStart, 
  onSaveTemplate,
  onSaveTemplatesBatch,
  onDeleteTemplate,
  onEditTemplate,
  savedTemplates,
  history, 
  aiService,
  customLibrary,
  userSettings
}) => {
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState<'session' | 'program'>('session');
  const [cycleLength, setCycleLength] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState(AI_FEEDBACK_MESSAGES[0]);
  const [isSyncingId, setIsSyncingId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<StagedTemplate | null>(null);
  const [suggestionBatch, setSuggestionBatch] = useState<StagedTemplate[]>([]);
  const [programNarrative, setProgramNarrative] = useState<string | null>(null);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  
  const [morphology, setMorphology] = useState<MorphologyScan[]>([]);
  const [editingStagedIdx, setEditingStagedIdx] = useState<number | null>(null);

  useEffect(() => {
    const loadMorphology = async () => {
      const stored = await storage.get<MorphologyScan[]>('ironflow_morphology');
      if (stored) setMorphology(stored);
    };
    loadMorphology();
  }, []);

  useEffect(() => {
    let interval: number;
    if (isGenerating || isRefining) {
      let idx = 0;
      interval = window.setInterval(() => {
        idx = (idx + 1) % AI_FEEDBACK_MESSAGES.length;
        setAiStatusMessage(AI_FEEDBACK_MESSAGES[idx]);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isGenerating, isRefining]);

  const libraryNames = useMemo(() => {
    const map = new Map<string, string>();
    DEFAULT_LIBRARY.forEach(item => map.set(item.name.toLowerCase(), item.name));
    customLibrary.forEach(item => map.set(item.name.toLowerCase(), item.name));
    return Array.from(map.values());
  }, [customLibrary]);

  const handleGenerate = useCallback(async (overridePrompt?: string) => {
    const activePrompt = overridePrompt || prompt;
    if (!activePrompt.trim()) return;
    
    setIsGenerating(true);
    setSuggestion(null);
    setSuggestionBatch([]);
    setProgramNarrative(null);

    try {
      if (scope === 'session') {
        const result = await aiService.generateProgramFromPrompt(activePrompt, history, libraryNames);
        setSuggestion(result);
        generateNarrative([result], activePrompt);
      } else {
        const result = await aiService.generateMultiWorkoutProgram(activePrompt, cycleLength, history, libraryNames);
        setSuggestionBatch(result);
        generateNarrative(result, activePrompt);
      }
      setPrompt('');
    } catch (e) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, history, libraryNames, aiService, scope, cycleLength]);

  const generateNarrative = async (templates: WorkoutTemplate[], goal: string) => {
    setIsGeneratingNarrative(true);
    try {
      const narrative = await aiService.generateProgramNarrative(templates, goal);
      setProgramNarrative(narrative);
    } catch (e) {
      console.warn("Narrative generation failed");
    } finally {
      setIsGeneratingNarrative(false);
    }
  };

  const handleGlobalRefinement = async () => {
    if (!refinementPrompt.trim()) return;
    setIsRefining(true);
    try {
      const currentBatch = suggestionBatch.length > 0 ? suggestionBatch : (suggestion ? [suggestion] : []);
      if (currentBatch.length === 0) return;

      const result = await aiService.refineProgramBatch(currentBatch, refinementPrompt, history, libraryNames);
      
      if (suggestionBatch.length > 0) {
        setSuggestionBatch(result.templates);
      } else {
        setSuggestion(result.templates[0]);
      }
      setProgramNarrative(result.narrative);
      setRefinementPrompt('');
    } catch (e) {
      alert("Refinement failed.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleSyncTemplate = async (template: WorkoutTemplate) => {
    if (!template.id) return;
    setIsSyncingId(template.id);
    try {
      const updated = await aiService.reoptimizeTemplate(template, history);
      onSaveTemplate(updated);
    } catch (e) {
      alert("Failed to sync template with latest progress.");
    } finally {
      setIsSyncingId(null);
    }
  };

  const handleSaveBatch = () => {
    onSaveTemplatesBatch(suggestionBatch);
    setSuggestionBatch([]);
    setProgramNarrative(null);
    alert(`Successfully committed ${suggestionBatch.length} protocols to your active roster.`);
  };

  const handleCommitEdit = async (updated: WorkoutTemplate) => {
    let newBatch: WorkoutTemplate[] = [];
    
    if (suggestionBatch.length > 0 && editingStagedIdx !== null) {
      newBatch = [...suggestionBatch];
      newBatch[editingStagedIdx] = { ...updated, isCustomized: true };
      setSuggestionBatch(newBatch);
      setEditingStagedIdx(null);
    } else if (suggestion) {
      const updatedSuggestion = { ...updated, isCustomized: true };
      setSuggestion(updatedSuggestion);
      newBatch = [updatedSuggestion];
      setEditingStagedIdx(null);
    }

    if (newBatch.length > 0) {
      generateNarrative(newBatch, "Manual Protocol Adjustment");
    }
  };

  const getQuickActions = (): QuickAction[] => {
    const actions: QuickAction[] = [];
    const categories = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'];
    const lastTrained: Record<string, number> = {};
    
    history.forEach(h => {
      if (!lastTrained[h.category] || new Date(h.date).getTime() > lastTrained[h.category]) {
        lastTrained[h.category] = new Date(h.date).getTime();
      }
    });

    const recommendedCategory = categories.sort((a, b) => (lastTrained[a] || 0) - (lastTrained[b] || 0))[0];
    actions.push({
      label: `Train: ${recommendedCategory}`,
      prompt: `Generate a high-intensity ${recommendedCategory} focused workout based on my recent recovery history.`,
      icon: <Zap size={10} />,
      color: 'border-emerald-500/30 text-emerald-400'
    });

    if (morphology.length > 0) {
      const latest = morphology[0].assessment;
      const weakest = Object.entries(latest).sort(([, a], [, b]) => (a as number) - (b as number))[0];
      if (weakest) {
        const muscleName = weakest[0].charAt(0).toUpperCase() + weakest[0].slice(1).replace(/([A-Z])/g, ' $1');
        actions.push({
          label: `Fix: ${muscleName}`,
          prompt: `Target my lagging ${muscleName} with a specialized hypertrophy protocol to fix symmetry based on my last morphology scan.`,
          icon: <Target size={10} />,
          color: 'border-amber-500/30 text-amber-400'
        });
      }
    }

    actions.push({
      label: "Dumbbells Only",
      prompt: "I am in a busy gym. Generate a full-body workout using ONLY dumbbells.",
      icon: <Dumbbell size={10} />,
      color: 'border-cyan-500/30 text-cyan-400'
    });

    actions.push({
      label: "30m Express",
      prompt: "I only have 30 minutes. Generate a high-density express workout using supersets for efficiency.",
      icon: <Clock size={10} />,
      color: 'border-slate-700 text-slate-400'
    });

    return actions;
  };

  return (
    <div className="space-y-6">
      {/* PRIMARY ARCHITECT ENGINE */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative" id="architect-prompt">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-slate-100">
            <Sparkles className="text-emerald-400" size={20} />
            Architectural Intent
          </h2>
          <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-2xl shrink-0">
             <button onClick={() => setScope('session')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${scope === 'session' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}>Session</button>
             <button onClick={() => setScope('program')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${scope === 'program' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}>Program</button>
          </div>
        </div>

        {scope === 'program' && (
          <div className="mb-6 animate-in slide-in-from-top-2 duration-300">
             <div className="flex justify-between items-center mb-3 px-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Calendar size={14} className="text-emerald-400" /> Training Sequence</span>
                <span className="text-sm font-black text-emerald-400">{cycleLength} Training Events</span>
             </div>
             <div className="flex gap-2">
                {[2, 3, 4, 5, 6, 7].map(len => (
                  <button key={len} onClick={() => setCycleLength(len)} className={`flex-1 py-3 rounded-2xl border font-black text-xs transition-all ${cycleLength === len ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}>{len}</button>
                ))}
             </div>
          </div>
        )}

        <div className="relative">
          <textarea
            value={prompt}
            id="architect-input"
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={scope === 'session' ? "e.g., Vertical pulling focus, minimal equipment..." : "e.g., Progressive overload cycle for shoulder stability and back width..."}
            className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-5 text-slate-100 placeholder-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 resize-none transition-all font-medium leading-relaxed"
          />
          <button 
            onClick={() => handleGenerate()}
            disabled={isGenerating || !prompt}
            className="absolute bottom-4 right-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 p-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-90 flex items-center gap-2"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}
          </button>
        </div>
        
        {(isGenerating || isRefining) && (
          <div className="mt-5 flex items-center gap-3 px-5 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl ai-loading-pulse shadow-inner">
            <Bot size={20} className="text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">{aiStatusMessage}</span>
          </div>
        )}

        {!(isGenerating || isRefining) && scope === 'session' && (
          <div className="mt-5 flex flex-wrap gap-2">
            {getQuickActions().map((action, i) => (
              <button 
                key={i} 
                onClick={() => handleGenerate(action.prompt)}
                className={`text-[9px] font-black uppercase tracking-[0.15em] px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-full border transition-all flex items-center gap-2 active:scale-95 ${action.color}`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* STAGED WORKFLOW PREVIEW */}
      {(suggestion || suggestionBatch.length > 0) && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* TOP-LEVEL GLOBAL GUIDANCE - APPLY BROAD REFINEMENTS TO STAGED ITEMS */}
          <div className="bg-slate-950 border border-emerald-500/30 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
             <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/10 rounded-lg"><Sliders size={18} className="text-emerald-400" /></div>
                <h4 className="text-[11px] font-black text-slate-100 uppercase tracking-widest">Global Cycle Guidance</h4>
             </div>
             <div className="relative">
                <input 
                   value={refinementPrompt}
                   onChange={(e) => setRefinementPrompt(e.target.value)}
                   placeholder="e.g., 'Add triceps to every session', 'Make intensity higher'..."
                   className="w-full bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 text-xs text-slate-100 font-bold outline-none focus:ring-1 focus:ring-emerald-500/40 pr-16 shadow-inner"
                />
                <button 
                   onClick={handleGlobalRefinement}
                   disabled={isRefining || !refinementPrompt.trim()}
                   className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition-all disabled:opacity-30 shadow-md"
                >
                   {isRefining ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                </button>
             </div>
          </div>

          {suggestion && (
            <div className="bg-slate-900 border border-emerald-500/30 rounded-[2.5rem] p-8 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter">{suggestion.name}</h3>
                  {suggestion.isCustomized && (
                     <div className="inline-flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 mt-2">
                        <Zap size={10} className="text-amber-400 fill-amber-400" />
                        <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Manually Adjusted</span>
                     </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      onSaveTemplate(suggestion);
                      setSuggestion(null);
                    }}
                    className="flex-1 sm:flex-none px-6 py-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border border-emerald-500/10 shadow-lg"
                  >
                    <Bookmark size={18} />
                    Save
                  </button>
                  <button 
                    onClick={() => onStart(suggestion)}
                    className="flex-1 sm:flex-none px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    Start
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {suggestion.exercises.map((ex, i) => (
                  <div key={i} className="flex p-5 bg-slate-950/60 border border-slate-800/80 rounded-[2rem] group min-h-[90px] shadow-sm">
                    <div className="flex-1 min-w-0 pr-5">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h4 className="font-black text-slate-100 text-base tracking-tight leading-tight">{ex.name}</h4>
                        <span className="text-[9px] px-2.5 py-1 bg-slate-900 text-slate-400 font-black uppercase tracking-[0.2em] rounded-lg border border-slate-800 shrink-0">
                          {ex.category}
                        </span>
                      </div>
                      {ex.rationale && (
                        <p className="text-[11px] text-emerald-400/80 font-bold italic leading-relaxed">
                          {ex.rationale}
                        </p>
                      )}
                    </div>
                    <div className="w-28 shrink-0 border-l border-slate-800/50 pl-5 flex flex-col justify-center items-center text-center">
                      <span className="text-2xl font-black text-emerald-400 leading-none">{ex.suggestedSets}</span>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5">Sets</span>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setEditingStagedIdx(-1)}
                className="w-full mt-6 py-4 bg-slate-800/50 hover:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-slate-800 flex items-center justify-center gap-2"
              >
                <Edit3 size={16} /> Tinker with Routine
              </button>
            </div>
          )}

          {suggestionBatch.length > 0 && (
            <div className="bg-slate-900 border border-emerald-500/40 rounded-[2.5rem] p-8 shadow-2xl space-y-8">
               <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                  <div>
                     <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter">Strategic Cycle Preview</h3>
                     <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.25em] mt-1.5 flex items-center gap-2"><Layers size={14}/> {suggestionBatch.length} Calibrated Sessions</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                     <button onClick={handleSaveBatch} className="flex-1 px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"><CheckCircle2 size={18}/> Commit Full Program</button>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 gap-4">
                  {suggestionBatch.map((template, idx) => (
                    <div key={idx} className="bg-slate-950/60 border border-slate-800 p-6 rounded-[2rem] hover:border-emerald-500/20 transition-all group relative overflow-hidden">
                       {template.isCustomized && (
                         <div className="absolute top-0 right-0 p-3 flex items-center gap-1.5 bg-amber-500/10 rounded-bl-2xl border-l border-b border-amber-500/20">
                            <Zap size={10} className="text-amber-400 fill-amber-400" />
                            <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Adjusted</span>
                         </div>
                       )}
                       <div className="flex justify-between items-center mb-5">
                          <div className="flex items-center gap-4">
                             <span className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-xs font-black text-emerald-400 border border-slate-800 shadow-inner">{idx + 1}</span>
                             <h4 className="text-base font-black text-slate-100 tracking-tight uppercase">{template.name}</h4>
                          </div>
                          <button 
                             onClick={() => setEditingStagedIdx(idx)}
                             className="p-3 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl transition-all border border-slate-700/50 flex items-center gap-2 group/tinker"
                          >
                             <Edit3 size={16} />
                             <span className="text-[9px] font-black uppercase tracking-widest">Tinker</span>
                          </button>
                       </div>
                       <div className="flex flex-wrap gap-2">
                          {template.exercises.map((ex, exIdx) => (
                            <div key={exIdx} className="px-3 py-1.5 bg-slate-900/80 border border-slate-800/60 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest">{ex.name}</div>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* EXECUTIVE PROGRAMMING RATIONALE - AT THE BOTTOM */}
          <div className="bg-slate-950/50 border border-emerald-500/10 rounded-[2.5rem] p-8 relative overflow-hidden">
             <div className="flex gap-6 items-start relative z-10">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0 border border-slate-800 shadow-xl">
                   <Bot size={24} className="text-emerald-400" />
                </div>
                <div className="space-y-2">
                   <h4 className="text-[11px] font-black text-slate-100 uppercase tracking-[0.2em] flex items-center gap-2">
                      Programming Analysis
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                   </h4>
                   {isGeneratingNarrative || isRefining ? (
                      <div className="space-y-2 py-1">
                         <div className="h-3 bg-slate-800 rounded w-3/4 animate-pulse" />
                         <div className="h-3 bg-slate-800 rounded w-1/2 animate-pulse" />
                      </div>
                   ) : (
                      <p className="text-xs text-slate-300 leading-relaxed font-medium italic opacity-90">
                         {programNarrative || "Reviewing cycle sequence for balance and fatigue metrics..."}
                      </p>
                   )}
                </div>
             </div>
          </div>

          <button 
             onClick={() => {
                setSuggestion(null);
                setSuggestionBatch([]);
                setProgramNarrative(null);
             }} 
             className="w-full py-4 text-slate-600 hover:text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] transition-all"
          >
             Discard Architectural Suggestion
          </button>
        </div>
      )}

      {/* Tinker Editor Modal */}
      {editingStagedIdx !== null && (
        <TemplateEditor 
          template={suggestionBatch.length > 0 ? (editingStagedIdx === -1 ? suggestion! : suggestionBatch[editingStagedIdx]) : suggestion!} 
          programContext={suggestionBatch.filter((_, i) => i !== editingStagedIdx)}
          onSave={handleCommitEdit} 
          onClose={() => setEditingStagedIdx(null)} 
          aiService={aiService} 
          userSettings={userSettings} 
        />
      )}

      {/* ACTIVE PROTOCOL ROSTER */}
      <div className="space-y-4">
        <h3 className="text-standard-label text-slate-300 px-2 flex items-center justify-between">
          <span>Active Registry</span>
          <span className="text-emerald-400/70">{savedTemplates.length} Loaded</span>
        </h3>
        
        <div className="grid grid-cols-1 gap-3">
          {savedTemplates.map((template) => (
            <div key={template.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-slate-700 transition-all group shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h4 className="text-lg font-black text-slate-100 uppercase tracking-tight">{template.name}</h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.15em] mt-1">
                    {template.exercises.length} Movements • 
                    Sync: {template.lastRefreshed ? new Date(template.lastRefreshed).toLocaleDateString() : 'Baseline'}
                  </p>
                </div>
                <div className="flex gap-2">
                   <button 
                    onClick={() => handleSyncTemplate(template)}
                    disabled={isSyncingId === template.id}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-2xl transition-all border border-slate-700/50 group/sync"
                    title="Neural Refresh"
                   >
                     {isSyncingId === template.id ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} className="group-hover/sync:rotate-180 transition-transform duration-500" />}
                   </button>
                   <button 
                    onClick={() => onEditTemplate(template)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-2xl transition-all border border-slate-700/50"
                    title="Manual Overhaul"
                   >
                     <Edit2 size={20} />
                   </button>
                   <button 
                    onClick={() => template.id && onDeleteTemplate(template.id)}
                    className="p-3 bg-slate-800 hover:bg-rose-500/10 text-rose-500 rounded-2xl transition-all border border-slate-700/50 lg:opacity-0 group-hover:opacity-100"
                    title="Purge"
                   >
                     <Trash2 size={20} />
                   </button>
                </div>
              </div>

              {template.critique && (
                 <div className="mb-4 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                    <p className="text-[10px] text-emerald-400/80 italic font-medium line-clamp-2">"{template.critique}"</p>
                 </div>
              )}

              <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                {template.exercises.map((ex, i) => (
                  <div key={i} className="shrink-0 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-full text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    {ex.name}
                  </div>
                ))}
              </div>

              <button 
                onClick={() => onStart(template)}
                className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-black rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-[11px] mt-2 border border-emerald-500/30 hover:border-emerald-500 shadow-lg"
              >
                <Play size={16} fill="currentColor" />
                Initialize Program
              </button>
            </div>
          ))}

          {savedTemplates.length === 0 && (
            <div className="py-24 flex flex-col items-center justify-center text-center opacity-20 border-2 border-dashed border-slate-800 rounded-[3rem]">
              <Sparkles size={56} className="mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">Archive Empty</p>
              <p className="text-xs mt-3 font-bold italic">Awaiting first protocol generation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgramCreator;