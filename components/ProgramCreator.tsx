import React, { useState, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, Wand2, Bookmark, Trash2, Play, RefreshCw, Edit2, Plus, RefreshCcw, Bot, Zap, Target, Clock, Dumbbell } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { WorkoutTemplate, HistoricalLog, ExerciseLibraryItem, MorphologyScan } from '../types';
import { DEFAULT_LIBRARY } from './ExerciseLibrary';
import { storage } from '../services/storageService';

interface ProgramCreatorProps {
  onStart: (template: WorkoutTemplate) => void;
  onSaveTemplate: (template: WorkoutTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onEditTemplate: (template: WorkoutTemplate) => void;
  savedTemplates: WorkoutTemplate[];
  history: HistoricalLog[];
  aiService: GeminiService;
  customLibrary: ExerciseLibraryItem[];
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

const ProgramCreator: React.FC<ProgramCreatorProps> = ({ 
  onStart, 
  onSaveTemplate, 
  onDeleteTemplate,
  onEditTemplate,
  savedTemplates,
  history, 
  aiService,
  customLibrary
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState(AI_FEEDBACK_MESSAGES[0]);
  const [isSyncingId, setIsSyncingId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<WorkoutTemplate | null>(null);
  const [morphology, setMorphology] = useState<MorphologyScan[]>([]);

  useEffect(() => {
    const loadMorphology = async () => {
      const stored = await storage.get<MorphologyScan[]>('ironflow_morphology');
      if (stored) setMorphology(stored);
    };
    loadMorphology();
  }, []);

  useEffect(() => {
    let interval: number;
    if (isGenerating) {
      let idx = 0;
      interval = window.setInterval(() => {
        idx = (idx + 1) % AI_FEEDBACK_MESSAGES.length;
        setAiStatusMessage(AI_FEEDBACK_MESSAGES[idx]);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = useCallback(async (overridePrompt?: string) => {
    const activePrompt = overridePrompt || prompt;
    if (!activePrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const map = new Map<string, string>();
      DEFAULT_LIBRARY.forEach(item => map.set(item.name.toLowerCase(), item.name));
      customLibrary.forEach(item => map.set(item.name.toLowerCase(), item.name));
      const libraryNames = Array.from(map.values());

      const result = await aiService.generateProgramFromPrompt(activePrompt, history, libraryNames);
      setSuggestion(result);
      setPrompt('');
    } catch (e) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, history, customLibrary, aiService]);

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

  const getQuickActions = (): QuickAction[] => {
    const actions: QuickAction[] = [];

    // 1. Recovery Loop: Suggest what hasn't been trained recently
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

    // 2. Morphology Priority: Lagging muscle group
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

    // 3. Busy Gym Pivot
    actions.push({
      label: "Dumbbells Only",
      prompt: "I am in a busy gym. Generate a full-body workout using ONLY dumbbells.",
      icon: <Dumbbell size={10} />,
      color: 'border-cyan-500/30 text-cyan-400'
    });

    // 4. Express Adherence
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
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative" id="architect-prompt">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Sparkles className="text-emerald-400" size={20} />
            Program Architect
          </h2>
        </div>

        <div className="relative">
          <textarea
            value={prompt}
            id="architect-input"
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., I want a chest and triceps focused workout with 5 exercises, high volume."
            className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-100 placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none transition-all font-medium"
          />
          <button 
            onClick={() => handleGenerate()}
            disabled={isGenerating || !prompt}
            className="absolute bottom-4 right-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 p-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
          </button>
        </div>
        
        {isGenerating && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl ai-loading-pulse">
            <Bot size={16} className="text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">{aiStatusMessage}</span>
          </div>
        )}

        {!isGenerating && (
          <div className="mt-4 flex flex-wrap gap-2">
            {getQuickActions().map((action, i) => (
              <button 
                key={i} 
                onClick={() => handleGenerate(action.prompt)}
                className={`text-[10px] font-black uppercase tracking-[0.15em] px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full border transition-all flex items-center gap-2 active:scale-95 ${action.color}`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {suggestion && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter">{suggestion.name}</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  onSaveTemplate(suggestion);
                  setSuggestion(null);
                }}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-full font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border border-emerald-500/10"
              >
                <Bookmark size={16} />
                Save
              </button>
              <button 
                onClick={() => onStart(suggestion)}
                className="flex-1 sm:flex-none px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                Start Session
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {suggestion.exercises.map((ex, i) => (
              <div key={i} className="flex p-4 bg-slate-950/50 border border-slate-800 rounded-2xl group min-h-[80px]">
                {/* Information Area */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h4 className="font-black text-slate-100 tracking-tight leading-tight">{ex.name}</h4>
                    <span className="text-[8px] px-2 py-0.5 bg-slate-800 text-slate-300 font-black uppercase tracking-[0.2em] rounded-md border border-slate-700/50 shrink-0">
                      {ex.category}
                    </span>
                  </div>
                  {ex.rationale && (
                    <p className="text-[10px] text-emerald-400 font-bold italic leading-relaxed">
                      {ex.rationale}
                    </p>
                  )}
                </div>

                {/* Metrics Pillar */}
                <div className="w-24 shrink-0 border-l border-slate-800/50 pl-4 flex flex-col justify-center items-center text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-emerald-400 leading-none">{ex.suggestedSets}</span>
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Sets</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-800/50 w-full">
                    <p className="text-[10px] font-black text-slate-200 uppercase tracking-tighter whitespace-nowrap">
                      {ex.targetReps} <span className="text-slate-500 font-black">Reps</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setSuggestion(null)}
            className="w-full py-4 mt-6 text-slate-500 hover:text-slate-300 text-xs font-black uppercase tracking-[0.2em] transition-all"
          >
            Dismiss Suggestion
          </button>
        </div>
      )}

      {/* Saved Templates Section */}
      <div className="space-y-4">
        <h3 className="text-standard-label text-slate-300 px-2 flex items-center justify-between">
          <span>Active Protocols</span>
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
                    Last Sync: {template.lastRefreshed ? new Date(template.lastRefreshed).toLocaleDateString() : 'Never'}
                  </p>
                </div>
                <div className="flex gap-2">
                   <button 
                    onClick={() => handleSyncTemplate(template)}
                    disabled={isSyncingId === template.id}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-2xl transition-all border border-slate-700/50 group/sync"
                    title="Re-optimize with AI"
                   >
                     {isSyncingId === template.id ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} className="group-hover/sync:rotate-180 transition-transform duration-500" />}
                   </button>
                   <button 
                    onClick={() => onEditTemplate(template)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-2xl transition-all border border-slate-700/50"
                    title="Manual Edit"
                   >
                     <Edit2 size={20} />
                   </button>
                   <button 
                    onClick={() => template.id && onDeleteTemplate(template.id)}
                    className="p-3 bg-slate-800 hover:bg-rose-500/10 text-rose-500 rounded-2xl transition-all border border-slate-700/50 lg:opacity-0 group-hover:opacity-100"
                    title="Delete"
                   >
                     <Trash2 size={20} />
                   </button>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                {template.exercises.map((ex, i) => (
                  <div key={i} className="shrink-0 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-full text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    {ex.name}
                  </div>
                ))}
              </div>

              <button 
                onClick={() => onStart(template)}
                className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-black rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-[11px] mt-2 border border-emerald-500/30 hover:border-emerald-500 shadow-lg shadow-emerald-500/5"
              >
                <Play size={16} fill="currentColor" />
                Initialize Flow
              </button>
            </div>
          ))}

          {savedTemplates.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center opacity-20 border-2 border-dashed border-slate-800 rounded-[2.5rem]">
              <Sparkles size={48} className="mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">No Active Protocols</p>
              <p className="text-xs mt-2 font-bold italic">Use the architect to generate your first plan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgramCreator;