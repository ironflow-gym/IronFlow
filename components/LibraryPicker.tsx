import React, { useState, useMemo } from 'react';
import { X, Search, BookOpen, Plus, Layers, ChevronRight } from 'lucide-react';
import { ExerciseLibraryItem } from '../types';

interface LibraryPickerProps {
  onSelect: (item: ExerciseLibraryItem) => void;
  onClose: () => void;
  fullLibrary: ExerciseLibraryItem[];
  title?: string;
  isModal?: boolean;
}

const LibraryPicker: React.FC<LibraryPickerProps> = ({ onSelect, onClose, fullLibrary, title = "Knowledge Catalog", isModal = true }) => {
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('All');

  const categories = useMemo(() => ['All', ...new Set(fullLibrary.map(i => i.category))], [fullLibrary]);

  const filteredLibrary = useMemo(() => {
    return fullLibrary.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(pickerSearch.toLowerCase());
      const matchesCategory = pickerCategory === 'All' || item.category === pickerCategory;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [fullLibrary, pickerSearch, pickerCategory]);

  const content = (
    <div className={`${isModal ? 'w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[3rem] flex flex-col h-[90vh] shadow-[0_0_120px_rgba(0,0,0,0.8)] overflow-hidden relative animate-in zoom-in-95 duration-300' : 'flex flex-col h-full'}`}>
       
       {isModal && (
         <div className="px-8 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 backdrop-blur-xl">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <BookOpen className="text-emerald-400" size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">{title}</h3>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Querying {fullLibrary.length} Biometrics</p>
              </div>
           </div>
           <button onClick={onClose} className="p-3.5 bg-slate-800/50 hover:bg-slate-800 hover:text-rose-400 rounded-2xl text-slate-400 transition-all border border-slate-700/20">
             <X size={20}/>
           </button>
         </div>
       )}
       
       <div className={`p-5 bg-slate-950/40 flex flex-col gap-4 shrink-0 ${isModal ? 'border-b border-slate-800/40' : ''}`}>
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
          <div className={`grid grid-cols-1 gap-4 ${isModal ? 'sm:grid-cols-2 lg:grid-cols-3' : ''}`}>
            {filteredLibrary.map(item => (
              <button 
                key={item.name}
                onClick={() => onSelect(item)}
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
                <ChevronRight className="text-slate-900 group-hover:text-emerald-400/40 transition-colors shrink-0 self-center" size={14} />
              </button>
            ))}
          </div>
       </div>

       {isModal && (
         <div className="px-8 py-4 bg-slate-950/60 border-t border-slate-800 flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">
           <span>IronFlow Biometrics Database</span>
           <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
             <span>Ready for Import</span>
           </div>
         </div>
       )}
    </div>
  );

  if (!isModal) return content;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {content}
    </div>
  );
};

export default LibraryPicker;
