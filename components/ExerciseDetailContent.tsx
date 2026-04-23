import React from 'react';
import { BookOpen, Activity, CheckCircle, ShieldAlert, ExternalLink, Sparkles, Loader2, Wind, Clock, Target, Settings2, Save } from 'lucide-react';
import { ExerciseLibraryItem } from '../types';

interface ExerciseDetailContentProps {
  item: ExerciseLibraryItem;
  onEnhance?: (name: string) => Promise<void>;
  onSaveEquipment?: (name: string, weightIncrement: number | undefined, barWeight: number | undefined) => void;
}

const ExerciseDetailContent: React.FC<ExerciseDetailContentProps> = ({ item, onEnhance, onSaveEquipment }) => {
  const [isEnhancing, setIsEnhancing] = React.useState(false);
  const [equipmentOpen, setEquipmentOpen] = React.useState(false);
  const [incrementInput, setIncrementInput] = React.useState(
    item.weightIncrement !== undefined ? String(item.weightIncrement) : ''
  );
  const [barWeightInput, setBarWeightInput] = React.useState(
    item.barWeight !== undefined ? String(item.barWeight) : ''
  );

  // Sync local state if item changes (switching exercises).
  // Auto-open the panel when onSaveEquipment is available and neither value has been set yet,
  // so the user is immediately prompted to configure without having to tap Edit first.
  React.useEffect(() => {
    setIncrementInput(item.weightIncrement !== undefined ? String(item.weightIncrement) : '');
    setBarWeightInput(item.barWeight !== undefined ? String(item.barWeight) : '');
    const unconfigured = item.weightIncrement === undefined && item.barWeight === undefined;
    setEquipmentOpen(!!onSaveEquipment && unconfigured);
  }, [item.name]);

  const handleSaveEquipment = () => {
    if (!onSaveEquipment) return;
    const increment = incrementInput.trim() !== '' ? parseFloat(incrementInput) : undefined;
    const bar = barWeightInput.trim() !== '' ? parseFloat(barWeightInput) : undefined;
    onSaveEquipment(
      item.name,
      increment !== undefined && !isNaN(increment) && increment > 0 ? increment : undefined,
      bar !== undefined && !isNaN(bar) && bar >= 0 ? bar : undefined
    );
    setEquipmentOpen(false);
  };

  const handleEnhance = async () => {
    if (!onEnhance) return;
    setIsEnhancing(true);
    try {
      await onEnhance(item.name);
    } catch (e) {
      alert("Enhancement failed. Please try again later.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const renderMethodologyList = (title: string, items: string[], icon: React.ReactNode) => (
    <div className="space-y-4">
      <h6 className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
        {icon} {title}
      </h6>
      <div className="space-y-2">
        {items.map((step, i) => (
          <div key={i} className="flex gap-4 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/40 hover:border-slate-700/50 transition-all group">
            <span className="w-6 h-6 rounded-lg bg-slate-800/80 flex items-center justify-center text-[10px] font-black text-emerald-400 shrink-0 border border-slate-700/50 group-hover:scale-110 transition-transform">{i+1}</span>
            <p className="text-slate-300 text-sm leading-relaxed">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 sm:p-8 bg-slate-950/80 border-b border-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-6 backdrop-blur-md shrink-0">
        <div>
          <h3 className="text-2xl sm:text-4xl font-black text-slate-100 tracking-tighter leading-none">{item.name}</h3>
          <div className="flex gap-3 mt-3">
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/10">{item.category}</span>
            {item.muscles?.slice(0, 2).map(m => (
              <span key={m} className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] bg-slate-900 px-3 py-1 rounded-full border border-slate-800">{m}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20">
          <BookOpen size={16} /> Protocol Guide
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12 scroll-smooth custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-12">

          {/* ── Equipment Configuration ─────────────────────────────────────────
               Shown first so it's the first thing seen when opening the screen.
               Auto-opens when not yet configured (handled in useEffect above).  */}
          {onSaveEquipment && (
            <div className={`rounded-3xl overflow-hidden border transition-colors ${
              equipmentOpen && item.weightIncrement === undefined && item.barWeight === undefined
                ? 'bg-cyan-500/5 border-cyan-500/30'
                : 'bg-slate-900/50 border-slate-800'
            }`}>
              <button
                onClick={() => setEquipmentOpen(o => !o)}
                className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-800/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Settings2 size={16} className="text-cyan-400" />
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-100 uppercase tracking-widest">Equipment Config</p>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-0.5 ${
                      item.weightIncrement === undefined && item.barWeight === undefined
                        ? 'text-cyan-500/70'
                        : 'text-slate-500'
                    }`}>
                      {item.weightIncrement !== undefined || item.barWeight !== undefined
                        ? `${item.weightIncrement !== undefined ? `Step: ${item.weightIncrement}kg` : ''}${item.weightIncrement !== undefined && item.barWeight !== undefined ? ' · ' : ''}${item.barWeight !== undefined ? `Bar: ${item.barWeight}kg` : ''}`.trim()
                        : 'Not configured — tap to set'}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${equipmentOpen ? 'text-cyan-400' : 'text-slate-600'}`}>
                  {equipmentOpen ? 'Cancel' : 'Edit'}
                </span>
              </button>

              {equipmentOpen && (
                <div className="px-6 pb-6 space-y-5 border-t border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pt-5">
                    Set for this specific machine or bar. Weight suggestions and plate calculations will use these values.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Weight Increment
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={incrementInput}
                          onChange={e => setIncrementInput(e.target.value)}
                          placeholder="e.g. 5"
                          className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-slate-100 text-sm font-bold focus:outline-none focus:border-cyan-500/50 pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase pointer-events-none">kg</span>
                      </div>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Smallest step available</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Starting Weight
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={barWeightInput}
                          onChange={e => setBarWeightInput(e.target.value)}
                          placeholder="e.g. 20"
                          className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-slate-100 text-sm font-bold focus:outline-none focus:border-cyan-500/50 pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase pointer-events-none">kg</span>
                      </div>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Bar / sled / carriage (0 = BW)</p>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveEquipment}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-cyan-500 text-slate-950 font-black text-[10px] uppercase tracking-widest rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-cyan-500/20"
                  >
                    <Save size={14} /> Save Equipment Config
                  </button>
                </div>
              )}
            </div>
          )}

          <section className="space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h5 className="flex items-center gap-3 text-emerald-400 font-black uppercase tracking-[0.3em] text-[11px]">
                <div className="w-8 h-[1px] bg-emerald-500/30"></div>
                Training Methodology
              </h5>
              {!item.sourceUrl && onEnhance && (
                <button 
                  onClick={handleEnhance} 
                  disabled={isEnhancing}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-black text-emerald-400 hover:bg-emerald-500/20 transition-all uppercase tracking-widest disabled:opacity-50 group"
                >
                  {isEnhancing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="group-hover:scale-125 transition-transform" />}
                  Enhance with AI
                </button>
              )}
            </div>

            {item.methodology ? (
              <div className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {renderMethodologyList("Initial Setup", item.methodology.setup, <Target size={14} className="text-cyan-400" />)}
                  {renderMethodologyList("Execution Path", item.methodology.execution, <Activity size={14} className="text-emerald-400" />)}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-900/30 border border-slate-800/40 rounded-3xl flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400"><Clock size={20} /></div>
                    <div>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Prescribed Tempo</p>
                      <p className="text-slate-200 text-sm font-bold mt-0.5">{item.methodology.tempo}</p>
                    </div>
                  </div>
                  <div className="p-6 bg-slate-900/30 border border-slate-800/40 rounded-3xl flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400"><Wind size={20} /></div>
                    <div>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Breathing Pattern</p>
                      <p className="text-slate-200 text-sm font-bold mt-0.5">{item.methodology.breathing}</p>
                    </div>
                  </div>
                </div>

                {renderMethodologyList("Coaching Cues", item.methodology.cues, <Sparkles size={14} className="text-amber-400" />)}
              </div>
            ) : (
              <div className="grid gap-4">
                {item.instructions.map((step, i) => (
                  <div key={i} className="flex gap-6 p-6 bg-slate-900/30 rounded-[2rem] border border-slate-800/40 hover:border-slate-700 transition-all group">
                    <span className="w-10 h-10 rounded-2xl bg-slate-800/80 flex items-center justify-center text-[12px] font-black text-emerald-400 shrink-0 border border-slate-700/50 shadow-inner group-hover:scale-110 transition-transform">{i+1}</span>
                    <p className="text-slate-300 text-sm leading-relaxed pt-2">{step}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
          
          {item.sourceUrl && (
            <div className="flex justify-center pt-2">
              <a 
                href={item.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/50 border border-slate-800 rounded-2xl text-[10px] font-black text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all uppercase tracking-widest group"
              >
                <ExternalLink size={14} className="group-hover:scale-110 transition-transform" />
                Verified Methodological Source
              </a>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-8 rounded-[2.5rem] group hover:bg-emerald-500/10 transition-all">
              <h5 className="flex items-center gap-3 text-emerald-400 font-black uppercase tracking-widest text-[10px] mb-4">
                <CheckCircle size={18} className="group-hover:scale-110 transition-transform" /> Physiological Benefits
              </h5>
              <p className="text-slate-400 text-sm leading-relaxed italic opacity-80">{item.benefits}</p>
            </div>
            <div className="bg-rose-500/5 border border-rose-500/10 p-8 rounded-[2.5rem] group hover:bg-rose-500/10 transition-all">
              <h5 className="flex items-center gap-3 text-rose-400 font-black uppercase tracking-widest text-[10px] mb-4">
                <ShieldAlert size={18} className="group-hover:scale-110 transition-transform" /> Kinematic Risks
              </h5>
              <p className="text-slate-400 text-sm leading-relaxed italic opacity-80">{item.risks}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ExerciseDetailContent;