
import React, { useState, useEffect } from 'react';
import { Search, Sparkles, X, Loader2, Play, Bookmark, ChevronRight, Zap, Target, Flame, RefreshCw, Info, ExternalLink, Bot, ArrowRight } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { storage } from '../services/storageService';
import { WorkoutTemplate, HistoricalLog } from '../types';

interface WorkoutDiscoveryProps {
  onClose: () => void;
  onStart: (template: WorkoutTemplate) => void;
  onSave: (template: WorkoutTemplate) => void;
  aiService: GeminiService;
  history: HistoricalLog[];
}

interface DiscoveryItem {
  title: string;
  summary: string;
  why: string;
  sourceUrl: string;
  template: WorkoutTemplate;
}

const CACHE_KEY = 'ironflow_discovery_cache';
const CACHE_TIME_KEY = 'ironflow_discovery_timestamp';

const WorkoutDiscovery: React.FC<WorkoutDiscoveryProps> = ({ onClose, onStart, onSave, aiService, history }) => {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DiscoveryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);

  useEffect(() => {
    const loadCache = async () => {
      const cached = await storage.get<DiscoveryItem[]>(CACHE_KEY);
      const time = await storage.get<string>(CACHE_TIME_KEY);
      if (cached) {
        setItems(cached);
        if (time) setLastRefreshed(parseInt(time));
      } else {
        handleRefresh();
      }
    };
    loadCache();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    setIsRefreshing(true);
    try {
      const data = await aiService.getWorkoutInspiration(history, searchQuery);
      setItems(data);
      const now = Date.now();
      setLastRefreshed(now);
      await storage.set(CACHE_KEY, data);
      await storage.set(CACHE_TIME_KEY, now.toString());
    } catch (e) {
      console.error(e);
      alert("Failed to refresh recommendations. Check your connection.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatLastRefreshed = (time: number | null) => {
    if (!time) return "Never";
    const diff = Date.now() - time;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(time).toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl p-4 sm:p-8 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col h-[90vh] shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-100 flex items-center gap-3">
              <Sparkles className="text-emerald-400" />
              Architect Discovery
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">History-Aware Intelligence</p>
              <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
              <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">Grounded in Google Search</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Discovery Tools (Persistence Layer) */}
        {!selectedItem && (
          <div className="px-6 py-4 bg-slate-950/30 border-b border-slate-800 flex flex-col sm:flex-row gap-4 shrink-0">
            <div className="relative flex-1">
              <input 
                type="text"
                placeholder="Specific intent? (e.g. 'Hotel gym', 'HIIT', 'Low back recovery')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 pl-12 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30 placeholder:text-slate-700 transition-all"
              />
              <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-700" size={16} />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Last Scanned</p>
                <p className="text-[10px] font-bold text-slate-400">{formatLastRefreshed(lastRefreshed)}</p>
              </div>
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-6 py-3 bg-emerald-500 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-95 transition-all disabled:opacity-50"
              >
                {isRefreshing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Refresh Options
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
                <Loader2 className="animate-spin text-emerald-400 relative z-10" size={56} />
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-slate-200 uppercase tracking-tighter">Premium Architect Scan</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-2 leading-relaxed">
                  Analyzing 14 days of kinematic data against real-world sports science databases to curate your next evolution...
                </p>
              </div>
            </div>
          ) : selectedItem ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <button 
                onClick={() => setSelectedItem(null)}
                className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase text-emerald-400 tracking-widest hover:text-emerald-300 transition-colors"
              >
                <ChevronRight className="rotate-180" size={14} />
                Back to Protocol Board
              </button>

              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row justify-between gap-6">
                  <div className="flex-1">
                    <h3 className="text-4xl font-black text-slate-100 tracking-tighter mb-4">{selectedItem.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      <a 
                        href={selectedItem.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-black text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all uppercase tracking-widest"
                      >
                        <ExternalLink size={14} />
                        View Source Program
                      </a>
                    </div>
                  </div>
                  <div className="sm:w-1/3 space-y-4">
                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-3xl">
                      <h4 className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-2 flex items-center gap-2">
                        <Bot size={14} /> Personal Rationale
                      </h4>
                      <p className="text-xs text-emerald-100/70 italic leading-relaxed">"{selectedItem.why}"</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/40 p-6 rounded-3xl border border-slate-800">
                  <h4 className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Target size={14} /> Training Brief
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed mb-8">{selectedItem.summary}</p>

                  <div className="space-y-3">
                    {selectedItem.template.exercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between p-5 bg-slate-950/80 border border-slate-800 rounded-[1.5rem] group hover:border-slate-700 transition-all">
                        <div>
                          <h4 className="font-black text-slate-200">{ex.name}</h4>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{ex.category}</span>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div className="text-right">
                             <p className="text-emerald-400 font-black text-xl">{ex.suggestedSets}</p>
                             <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">Sets</p>
                          </div>
                          <ChevronRight size={14} className="text-slate-800" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              {items.length > 0 ? items.map((item, idx) => (
                <button 
                  key={idx}
                  onClick={() => setSelectedItem(item)}
                  className="text-left bg-slate-950/50 border border-slate-800 p-8 rounded-[2.5rem] hover:border-emerald-500/40 hover:bg-slate-900/50 transition-all group relative overflow-hidden flex flex-col sm:flex-row gap-6"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
                    {idx === 0 ? <Flame size={80} /> : idx === 1 ? <Target size={80} /> : <Zap size={80} />}
                  </div>
                  
                  <div className="sm:w-2/3 space-y-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800 text-emerald-400 shadow-inner group-hover:scale-110 transition-transform">
                        {idx === 0 ? <Flame size={20} /> : idx === 1 ? <Target size={20} /> : <Zap size={20} />}
                      </div>
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Protocol Suggestion</span>
                    </div>
                    
                    <h4 className="text-2xl font-black text-slate-100 tracking-tighter group-hover:text-emerald-400 transition-colors">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{item.summary}</p>
                    
                    <div className="flex items-center gap-2 pt-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80 group-hover:text-emerald-400 transition-colors">
                      Analyze Strategy <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div className="sm:w-1/3 flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-slate-800/50 pt-6 sm:pt-0 sm:pl-8 relative z-10">
                    <h5 className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Bot size={12} className="text-emerald-500" /> AI Personal Match
                    </h5>
                    <p className="text-[11px] text-slate-400 italic leading-tight">"{item.why}"</p>
                  </div>
                </button>
              )) : (
                <div className="py-32 flex flex-col items-center justify-center text-center opacity-20">
                  <Search size={48} className="mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest">Archive Empty</p>
                  <p className="text-xs mt-2 italic font-bold">Refresh to initialize a history scan.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {selectedItem && (
          <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex gap-4 shrink-0 backdrop-blur-xl">
            <button 
              onClick={() => {
                onSave(selectedItem.template);
                setSelectedItem(null);
                alert("Protocol archived to your My Templates!");
              }}
              className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
              <Bookmark size={18} />
              Save to Plans
            </button>
            <button 
              onClick={() => onStart(selectedItem.template)}
              className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] active:scale-95"
            >
              <Play size={20} fill="currentColor" />
              Initialize Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutDiscovery;
