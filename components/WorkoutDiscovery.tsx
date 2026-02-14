import React, { useState, useEffect } from 'react';
import { Search, Sparkles, X, Loader2, Play, Bookmark, ChevronRight, Zap, Target, Flame, RefreshCw, Bot, ArrowRight } from 'lucide-react';
import { GeminiService } from '../services/GeminiService';
import { WorkoutTemplate, HistoricalLog } from '../types';

interface WorkoutDiscoveryProps {
  onClose: () => void;
  onStart: (template: WorkoutTemplate) => void;
  onSave: (template: WorkoutTemplate) => void;
  aiService: GeminiService;
  history: HistoricalLog[];
}

const WorkoutDiscovery: React.FC<WorkoutDiscoveryProps> = ({ onClose, onStart, onSave, aiService, history }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!query.trim() && results.length > 0) return;
    setIsSearching(true);
    try {
      const inspirations = await aiService.getWorkoutInspiration(history, query);
      setResults(inspirations);
    } catch (e) {
      alert("Failed to find inspirations.");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex flex-col items-center justify-center animate-in fade-in duration-500">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col h-[85vh] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400"><Search size={20} /></div>
             <div>
                <h3 className="text-xl font-black text-slate-100">Protocol Discovery</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Training Search</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 rounded-2xl text-slate-400"><X size={20} /></button>
        </div>

        <div className="p-6 border-b border-slate-800 bg-slate-950/30 flex gap-2">
           <div className="relative flex-1">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search styles... 'Powerlifting', 'Kettlebell', 'Old School Bodybuilding'..."
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 pl-12 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/30"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
           </div>
           <button 
             onClick={handleSearch}
             disabled={isSearching}
             className="px-6 bg-emerald-500 text-slate-950 font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 disabled:opacity-50"
           >
             {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
           {isSearching ? (
             <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
                <Loader2 className="animate-spin text-emerald-500" size={48} />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ai-loading-pulse">Architecting Proposals...</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {results.map((res, i) => (
                  <div key={i} className="bg-slate-950/50 border border-slate-800 rounded-[2rem] p-6 space-y-4 flex flex-col group hover:border-emerald-500/30 transition-all">
                     <div className="flex justify-between items-start">
                        <h4 className="text-lg font-black text-slate-100 uppercase tracking-tight">{res.title}</h4>
                        <Sparkles className="text-emerald-400/20 group-hover:text-emerald-400 transition-colors" size={20} />
                     </div>
                     <p className="text-xs text-slate-400 leading-relaxed italic">{res.summary}</p>
                     <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-2"><Bot size={12}/> AI Rationale</p>
                        <p className="text-[10px] text-emerald-100 italic">{res.why}</p>
                     </div>
                     <div className="mt-auto pt-4 flex gap-2">
                        <button onClick={() => onSave(res.template)} className="flex-1 py-3 bg-slate-800 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700/50">Save Protocol</button>
                        <button onClick={() => onStart(res.template)} className="flex-1 py-3 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">Initialize</button>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default WorkoutDiscovery;
