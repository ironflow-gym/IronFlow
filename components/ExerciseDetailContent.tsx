import Modal, { dialogField, dialogPrimaryButton } from './ui/Modal';
import { defaultLoadingMode, type LoadingMode } from '../src/equipment';
import React from 'react';
import { BookOpen, Activity, CheckCircle, ShieldAlert, ExternalLink, Sparkles, Loader2, Wind, Clock, Target, Settings2, Save } from 'lucide-react';
import { ExerciseLibraryItem } from '../types';

interface ExerciseDetailContentProps {
  item: ExerciseLibraryItem;
  onEnhance?: (name: string) => Promise<void>;
  onSaveEquipment?: (name: string, weightIncrement: number | undefined, barWeight: number | undefined, loadingMode: LoadingMode) => void;
}

const ExerciseDetailContent: React.FC<ExerciseDetailContentProps> = ({ item, onEnhance, onSaveEquipment }) => {
  const equipmentId = React.useId();
  const [equipmentError, setEquipmentError] = React.useState('');
  const [isEnhancing, setIsEnhancing] = React.useState(false);
  const [loadingMode, setLoadingMode] = React.useState<LoadingMode>(item.loadingMode ?? defaultLoadingMode(item.name));
  const [equipmentOpen, setEquipmentOpen] = React.useState(false);
  const [incrementInput, setIncrementInput] = React.useState(
    item.weightIncrement !== undefined ? String(item.weightIncrement) : ''
  );
  const [barWeightInput, setBarWeightInput] = React.useState(
    item.barWeight !== undefined ? String(item.barWeight) : ''
  );

  // Browsing an exercise never opens the editor automatically.
  React.useEffect(() => {
    setLoadingMode(item.loadingMode ?? defaultLoadingMode(item.name));
    setIncrementInput(item.weightIncrement !== undefined ? String(item.weightIncrement) : '');
    setBarWeightInput(item.barWeight !== undefined ? String(item.barWeight) : '');
    setEquipmentError('');
    setEquipmentOpen(false);
  }, [item.name]);

  const openEquipment = () => {
    setLoadingMode(item.loadingMode ?? defaultLoadingMode(item.name));
    setIncrementInput(item.weightIncrement !== undefined ? String(item.weightIncrement) : '');
    setBarWeightInput(item.barWeight !== undefined ? String(item.barWeight) : '');
    setEquipmentError('');
    setEquipmentOpen(true);
  };

  const handleSaveEquipment = () => {
    if (!onSaveEquipment) return;
    const increment = incrementInput.trim() !== '' ? parseFloat(incrementInput) : undefined;
    const bar = barWeightInput.trim() !== '' ? parseFloat(barWeightInput) : undefined;
    if ((increment !== undefined && (!Number.isFinite(increment) || increment < 0.001 || increment > 1000)) || (bar !== undefined && (!Number.isFinite(bar) || bar < 0 || bar > 10000))) { setEquipmentError('Enter an increment between 0.001 and 1000 kg and a starting weight between 0 and 10000 kg.'); return; }
    setEquipmentError('');
    onSaveEquipment(
      item.name,
      increment !== undefined && !isNaN(increment) && increment > 0 ? increment : undefined,
      bar !== undefined && !isNaN(bar) && bar >= 0 ? bar : undefined,
      loadingMode
    );
    setEquipmentOpen(false);
  };

  const exampleBase = barWeightInput.trim() ? Number(barWeightInput) : NaN;
  const exampleStep = incrementInput.trim() ? Number(incrementInput) : NaN;
  const showExample = Number.isFinite(exampleBase) && exampleBase >= 0 && exampleBase <= 10000 && Number.isFinite(exampleStep) && exampleStep >= 0.001 && exampleStep <= 1000;
  const exampleAdded = exampleStep * 3 * (loadingMode === 'paired' ? 2 : 1);
  const number = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value);

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

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-12 scroll-smooth custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-12">

          {onSaveEquipment && <section className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4 space-y-3 sm:p-6" aria-label="Equipment settings">
            <div className="flex items-center gap-3"><Settings2 size={20} className="shrink-0 text-cyan-300" /><h4 className="text-base font-bold">Equipment settings</h4></div>
            <p className="text-sm text-slate-300">{item.weightIncrement !== undefined || item.barWeight !== undefined ? `${item.barWeight !== undefined ? `Base ${number(item.barWeight)} kg` : ''}${item.barWeight !== undefined && item.weightIncrement !== undefined ? ' · ' : ''}${item.weightIncrement !== undefined ? `Step ${number(item.weightIncrement)} kg` : ''}` : 'Set the starting weight and available increment'}</p>
            <button type="button" onClick={openEquipment} className="min-h-11 rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-cyan-300 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-400">Edit equipment</button>
          </section>}
          {equipmentOpen && <Modal label="Equipment settings" title="Equipment settings" closeLabel="Cancel equipment changes" onClose={() => setEquipmentOpen(false)} footer={<button type="submit" form={`${equipmentId}-form`} className={`${dialogPrimaryButton} flex w-full items-center justify-center gap-2 sm:w-auto`}><Save size={18} />Save equipment</button>}>
            <form id={`${equipmentId}-form`} className="space-y-5" onSubmit={event => { event.preventDefault(); handleSaveEquipment(); }}>
              <p className="font-medium text-slate-300">{item.name}</p>
              <label htmlFor={`${equipmentId}-loading`} className="block text-sm font-medium">How is weight added?
                <select id={`${equipmentId}-loading`} value={loadingMode} onChange={event => setLoadingMode(event.target.value as LoadingMode)} className={dialogField}>
                  <option value="single">Single load</option><option value="paired">Both sides</option>
                </select>
              </label>
              {loadingMode === 'single' && <p className="text-sm text-slate-300">One stack or carriage; dumbbell weights are per hand.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor={`${equipmentId}-base`} className="text-sm font-medium">Starting weight (kg)</label><input id={`${equipmentId}-base`} type="number" min="0" max="10000" step="any" value={barWeightInput} onChange={event => setBarWeightInput(event.target.value)} placeholder="e.g. 22.56" className={dialogField} /><p className="mt-2 text-sm text-slate-300">Unloaded bar, sled or machine.</p></div>
                <div><label htmlFor={`${equipmentId}-step`} className="text-sm font-medium">{loadingMode === 'paired' ? 'Smallest plate per side (kg)' : 'Smallest plate or stack increment (kg)'}</label><input id={`${equipmentId}-step`} type="number" min="0.001" max="1000" step="any" value={incrementInput} onChange={event => setIncrementInput(event.target.value)} placeholder="e.g. 2.5" className={dialogField} /><p className="mt-2 text-sm text-slate-300">{loadingMode === 'paired' ? 'Added on each side.' : 'Added once to the total.'}</p></div>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3" aria-live="polite" aria-atomic="true">
                <p className="text-sm font-bold text-cyan-200">Loading example</p>
                {showExample ? <><p className="mt-2 font-bold">{number(exampleBase)} kg + {number(exampleAdded)} kg = {number(exampleBase + exampleAdded)} kg</p><p className="mt-1 text-sm text-slate-300">{loadingMode === 'paired' ? `Three ${number(exampleStep)} kg plates on each side.` : `Three increments of ${number(exampleStep)} kg.`}</p></> : <p className="mt-2 text-sm text-slate-300">Enter both values to see an example.</p>}
              </div>
              <details className="text-sm text-slate-300"><summary className="min-h-11 cursor-pointer py-3 font-medium">How these settings work</summary><p>Enter values in kilograms; suggestions convert to your workout units. For dumbbells, use the weight per hand. A starting weight with no increment uses a 1.25 kg plate by default. Plate quantities are not tracked.</p></details>
              {equipmentError && <p role="alert" className="text-sm text-rose-300">{equipmentError}</p>}
            </form>
          </Modal>}

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