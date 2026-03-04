import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  X, Plus, Trash2, Save, Bot, Wand2, Loader2, History,
  BookOpen, RefreshCcw, GripVertical, Layers,
  Info, Calendar,
} from 'lucide-react';
import { WorkoutTemplate, ExerciseLibraryItem, UserSettings } from '../types';
import { GeminiService, GeminiError } from '../services/geminiService';
import LibraryPicker from './LibraryPicker';
import ExerciseDetailContent from './ExerciseDetailContent';
import E1RMChart from './stats/E1RMChart';
import { getMuscleGroup } from '../src/utils';
import type { HistoricalLog } from '../types';

interface Props {
  template: WorkoutTemplate;
  programContext?: WorkoutTemplate[];
  onSave: (t: WorkoutTemplate) => void;
  onSaveAll?: (templates: WorkoutTemplate[]) => void;
  onClose: () => void;
  aiService: GeminiService;
  userSettings: UserSettings;
  fullLibrary: ExerciseLibraryItem[];
  history: HistoricalLog[];
}

// ── Draggable panel divider ───────────────────────────────────────────────────
const PanelDivider: React.FC<{ onDrag: (delta: number) => void }> = ({ onDrag }) => {
  const startX = useRef<number>(0);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    const onMove = (mv: MouseEvent) => { onDrag(mv.clientX - startX.current); startX.current = mv.clientX; };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onDrag]);
  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1.5 shrink-0 bg-slate-800 hover:bg-emerald-500/40 cursor-col-resize transition-colors rounded-full mx-0.5 select-none"
    />
  );
};

// ── Muscle coverage bars ──────────────────────────────────────────────────────
const MuscleCoverage: React.FC<{ exercises: WorkoutTemplate['exercises']; label?: string }> = ({ exercises, label }) => {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    exercises.forEach(ex => {
      const mg = getMuscleGroup(ex.category);
      if (mg !== 'Other') map[mg] = (map[mg] || 0) + (ex.suggestedSets || 3);
    });
    return map;
  }, [exercises]);
  const sorted = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;
  if (sorted.length === 0) return <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{label ? `${label}: empty` : 'No exercises'}</p>;
  return (
    <div className="space-y-1.5">
      {label && <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-2">{label}</p>}
      {sorted.map(([mg, sets]) => (
        <div key={mg} className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-500 w-20 shrink-0 truncate uppercase tracking-widest">{mg}</span>
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(sets / max) * 100}%` }} />
          </div>
          <span className="text-[9px] font-black text-slate-600 w-6 text-right">{sets}</span>
        </div>
      ))}
    </div>
  );
};

// ── Program-mode right panel ──────────────────────────────────────────────────
const ProgramOverview: React.FC<{ days: WorkoutTemplate[]; history: HistoricalLog[]; userSettings: UserSettings }> = ({ days, history, userSettings }) => {
  const totalSets = days.reduce((acc, d) => acc + d.exercises.reduce((s, ex) => s + (ex.suggestedSets || 3), 0), 0);
  const totalExercises = days.reduce((acc, d) => acc + d.exercises.length, 0);
  const allExercises = days.flatMap(d => d.exercises);
  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto p-1">
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Program Overview</p>
        <div className="grid grid-cols-3 gap-2">
          {[{ label: 'Days', value: days.length }, { label: 'Exercises', value: totalExercises }, { label: 'Total Sets', value: totalSets }].map(({ label, value }) => (
            <div key={label} className="bg-slate-800/60 rounded-2xl p-3 text-center">
              <div className="text-lg font-black text-slate-100">{value}</div>
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Day Breakdown</p>
        <div className="space-y-2">
          {days.map((d, i) => {
            const sets = d.exercises.reduce((s, ex) => s + (ex.suggestedSets || 3), 0);
            return (
              <div key={i} className="flex items-center gap-3 py-2 px-3 bg-slate-800/40 rounded-xl border border-slate-800">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-black text-emerald-400">{i + 1}</span>
                </div>
                <span className="text-xs font-black text-slate-200 flex-1 truncate">{d.name}</span>
                <span className="text-[9px] font-black text-slate-600">{d.exercises.length}ex</span>
                <span className="text-[9px] font-black text-slate-700">~{Math.round(sets * 2.5)}m</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Program Muscle Coverage</p>
        <MuscleCoverage exercises={allExercises} />
      </div>
      {totalExercises > 0 && (
        <div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">e1RM Trend</p>
          <div className="h-36"><E1RMChart history={history} userSettings={userSettings} compact /></div>
        </div>
      )}
      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center mt-auto pt-2">Click an exercise to inspect it</p>
    </div>
  );
};

// ── Single-day right panel ────────────────────────────────────────────────────
const TemplateSummary: React.FC<{ template: WorkoutTemplate; history: HistoricalLog[]; userSettings: UserSettings }> = ({ template, history, userSettings }) => {
  const totalSets = template.exercises.reduce((s, ex) => s + (ex.suggestedSets || 3), 0);
  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto p-1">
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Template Overview</p>
        <div className="grid grid-cols-3 gap-2">
          {[{ label: 'Exercises', value: template.exercises.length }, { label: 'Total Sets', value: totalSets }, { label: 'Est. Time', value: `~${Math.round(totalSets * 2.5)}m` }].map(({ label, value }) => (
            <div key={label} className="bg-slate-800/60 rounded-2xl p-3 text-center">
              <div className="text-lg font-black text-slate-100">{value}</div>
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Muscle Coverage</p>
        <MuscleCoverage exercises={template.exercises} />
      </div>
      {template.exercises.length > 0 && (
        <div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">e1RM Trend</p>
          <div className="h-40"><E1RMChart history={history} userSettings={userSettings} compact /></div>
        </div>
      )}
      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center mt-auto pt-2">Click an exercise to inspect it</p>
    </div>
  );
};

// ── Exercise card ─────────────────────────────────────────────────────────────
interface ExCardProps {
  ex: WorkoutTemplate['exercises'][number];
  idx: number; isSelected: boolean; isDragOver: boolean; weightUnit: string;
  onSelect: () => void; onUpdate: (f: string, v: any) => void;
  onRemove: () => void; onSwap: () => void;
  onDragStart: (e: React.DragEvent, i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDrop: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
}
const ExerciseCard: React.FC<ExCardProps> = ({ ex, idx, isSelected, isDragOver, weightUnit, onSelect, onUpdate, onRemove, onSwap, onDragStart, onDragOver, onDrop, onDragEnd }) => (
  <div
    className={`rounded-2xl border transition-all group ${isDragOver ? 'border-emerald-500/60 bg-emerald-500/5 scale-[1.01]' : isSelected ? 'border-emerald-500/40 bg-slate-800/60' : 'border-slate-800 bg-slate-800/30 hover:border-slate-700'}`}
    onDragOver={e => onDragOver(e, idx)} onDrop={e => onDrop(e, idx)}
  >
    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/60">
      <div draggable onDragStart={e => onDragStart(e, idx)} onDragEnd={onDragEnd} className="cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 transition-colors shrink-0 p-0.5">
        <GripVertical size={14} />
      </div>
      <span className="text-[9px] font-black text-emerald-600 w-4">{idx + 1}</span>
      <button onClick={onSelect} className="flex-1 text-left text-xs font-black text-slate-200 truncate hover:text-emerald-400 transition-colors">{ex.name || 'Unnamed'}</button>
      <button onClick={onSwap} className="p-1 text-slate-700 hover:text-amber-400 transition-colors"><RefreshCcw size={12} /></button>
      <button onClick={onRemove} className="p-1 text-slate-700 hover:text-rose-500 transition-colors"><Trash2 size={12} /></button>
    </div>
    <div className="flex items-center gap-2 px-3 py-2">
      {[{ label: 'Sets', field: 'suggestedSets' }, { label: 'Reps', field: 'suggestedReps' }, { label: weightUnit, field: 'suggestedWeight' }].map(({ label, field }) => (
        <div key={field} className="flex-1">
          <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest text-center mb-1">{label}</div>
          <input type="number" value={(ex as any)[field]} onChange={e => onUpdate(field, parseFloat(e.target.value) || 0)} onClick={e => e.stopPropagation()}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 text-center text-xs font-black text-slate-100 outline-none focus:border-emerald-500/40 transition-all" />
        </div>
      ))}
    </div>
  </div>
);

// ── Day tab strip ─────────────────────────────────────────────────────────────
const DayTabStrip: React.FC<{
  days: WorkoutTemplate[]; activeDay: number;
  onSelect: (i: number) => void; onRename: (i: number, name: string) => void;
  onDelete: (i: number) => void; onAdd: () => void;
}> = ({ days, activeDay, onSelect, onRename, onDelete, onAdd }) => {
  const [editingTab, setEditingTab] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTab(i);
    setEditValue(days[i].name);
  };
  const commitEdit = () => {
    if (editingTab !== null && editValue.trim()) onRename(editingTab, editValue.trim());
    setEditingTab(null);
  };

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800 bg-slate-900/60 overflow-x-auto shrink-0 min-h-[44px]">
      <Calendar size={12} className="text-emerald-400 shrink-0 mr-1 opacity-60" />
      {days.map((day, i) => (
        <div
          key={i}
          onClick={() => onSelect(i)}
          className={`group/tab relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer transition-all shrink-0 select-none ${
            activeDay === i
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-slate-800/50 border border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600'
          }`}
        >
          <span className={`text-[8px] font-black w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${activeDay === i ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>{i + 1}</span>
          {editingTab === i ? (
            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingTab(null); }}
              onClick={e => e.stopPropagation()}
              className="bg-transparent outline-none text-[10px] font-black w-24 text-emerald-200" />
          ) : (
            <span className="text-[10px] font-black max-w-[100px] truncate" onDoubleClick={e => startEdit(i, e)} title="Double-click to rename">{day.name}</span>
          )}
          {days.length > 1 && (
            <button onClick={e => { e.stopPropagation(); onDelete(i); }} className="opacity-0 group-hover/tab:opacity-100 ml-0.5 text-slate-600 hover:text-rose-400 transition-all">
              <X size={10} />
            </button>
          )}
        </div>
      ))}
      <button onClick={onAdd} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/50 border border-dashed border-slate-700 text-slate-600 hover:text-emerald-400 hover:border-emerald-500/30 transition-all shrink-0 text-[10px] font-black uppercase tracking-widest" title="Add training day">
        <Plus size={11} />Day
      </button>
      <span className="ml-auto text-[8px] font-black text-slate-700 uppercase tracking-widest shrink-0 pl-4">dbl-click to rename</span>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const TemplateEditorDesktop: React.FC<Props> = ({ template, programContext, onSave, onSaveAll, onClose, aiService, userSettings, fullLibrary, history }) => {

  // Initialise days from template + any programContext siblings
  const [days, setDays] = useState<WorkoutTemplate[]>(() => {
    if (programContext && programContext.length > 0) {
      return [template, ...programContext].map((t, i) => ({ ...JSON.parse(JSON.stringify(t)), name: t.name || `Day ${i + 1}` }));
    }
    return [JSON.parse(JSON.stringify(template))];
  });

  const [activeDay, setActiveDay] = useState(0);
  const isMultiDay = days.length > 1;

  // Active day accessor
  const editedTemplate = days[activeDay];
  const setEditedTemplate = (updater: WorkoutTemplate | ((prev: WorkoutTemplate) => WorkoutTemplate)) => {
    setDays(prev => { const next = [...prev]; next[activeDay] = typeof updater === 'function' ? updater(prev[activeDay]) : updater; return next; });
  };

  // Day management
  const addDay = () => {
    const newDay: WorkoutTemplate = { name: `Day ${days.length + 1}`, exercises: [], isCustomized: true };
    setDays(prev => [...prev, newDay]);
    setActiveDay(days.length);
    setSelectedIdx(null);
  };
  const deleteDay = (idx: number) => {
    if (days.length <= 1) return;
    const newLength = days.length - 1; // compute before setDays to avoid stale closure
    setDays(prev => prev.filter((_, i) => i !== idx));
    setActiveDay(prev => (idx >= newLength ? newLength - 1 : Math.min(prev, newLength - 1)));
    setSelectedIdx(null);
  };
  const renameDay = (idx: number, name: string) => setDays(prev => { const next = [...prev]; next[idx] = { ...next[idx], name }; return next; });

  // UI state
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditFeedback, setAuditFeedback] = useState<string | null>(template.critique || null);
  const [swappingIdx, setSwappingIdx] = useState<number | null>(null);
  const [swapSuggestions, setSwapSuggestions] = useState<any[]>([]);
  const [isGettingSwaps, setIsGettingSwaps] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Panel sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(28);
  const [midPct, setMidPct] = useState(46);
  const clampPanels = (l: number, m: number) => {
    const [MIN, MAX] = [15, 60];
    const nl = Math.min(MAX, Math.max(MIN, l));
    const nm = Math.min(MAX, Math.max(MIN, m));
    return 100 - nl - nm < MIN ? { l: nl, m: Math.min(nm, 100 - nl - MIN) } : { l: nl, m: nm };
  };
  const onLeftDividerDrag = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const pct = (delta / containerRef.current.offsetWidth) * 100;
    setLeftPct(prev => { const { l } = clampPanels(prev + pct, midPct); return l; });
  }, [midPct]);
  const onRightDividerDrag = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const pct = (delta / containerRef.current.offsetWidth) * 100;
    setMidPct(prev => { const { m } = clampPanels(leftPct, prev + pct); return m; });
  }, [leftPct]);
  const rightPct = Math.max(15, 100 - leftPct - midPct);
  const weightUnit = userSettings.units === 'metric' ? 'KG' : 'LB';

  // Exercise mutations
  const addExercise = (item?: ExerciseLibraryItem) => {
    const newEx = { name: item?.name || 'New Exercise', category: item?.category || 'Other', suggestedSets: 3, targetReps: '10-12', suggestedWeight: 0, suggestedReps: 10, rationale: item ? `Focused on ${item.muscles?.join(', ') || item.category}` : 'Manually added' };
    setEditedTemplate(t => { const next = { ...t, exercises: [...t.exercises, newEx] }; setSelectedIdx(next.exercises.length - 1); return next; });
  };
  const updateExercise = (idx: number, field: string, value: any) => setEditedTemplate(t => { const exs = [...t.exercises]; exs[idx] = { ...exs[idx], [field]: value }; return { ...t, exercises: exs }; });
  const removeExercise = (idx: number) => {
    setEditedTemplate(t => ({ ...t, exercises: t.exercises.filter((_, i) => i !== idx) }));
    if (selectedIdx === idx) setSelectedIdx(null);
    else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  };

  // Drag reorder
  const onCardDragStart = (e: React.DragEvent, idx: number) => { e.dataTransfer.setData('application/ironflow-reorder', String(idx)); e.dataTransfer.effectAllowed = 'move'; };
  const onCardDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const onCardDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault(); setDragOverIdx(null);
    const reorderSrc = e.dataTransfer.getData('application/ironflow-reorder');
    if (reorderSrc !== '') {
      const srcIdx = parseInt(reorderSrc);
      if (srcIdx === dropIdx) return;
      setEditedTemplate(t => { const exs = [...t.exercises]; const [moved] = exs.splice(srcIdx, 1); exs.splice(dropIdx, 0, moved); return { ...t, exercises: exs }; });
      return;
    }
    const exerciseData = e.dataTransfer.getData('application/ironflow-exercise');
    if (exerciseData) {
      try {
        const item: ExerciseLibraryItem = JSON.parse(exerciseData);
        setEditedTemplate(t => { const exs = [...t.exercises]; exs.splice(dropIdx, 0, { name: item.name, category: item.category, suggestedSets: 3, targetReps: '10-12', suggestedWeight: 0, suggestedReps: 10, rationale: `Focused on ${item.muscles?.join(', ') || item.category}` }); return { ...t, exercises: exs }; });
      } catch { /* ignore */ }
    }
  };
  const onCanvasDrop = (e: React.DragEvent) => {
    if ((e.target as HTMLElement).closest('[data-card]')) return;
    const exerciseData = e.dataTransfer.getData('application/ironflow-exercise');
    if (exerciseData) { e.preventDefault(); try { addExercise(JSON.parse(exerciseData)); } catch { /* ignore */ } }
    setDragOverIdx(null);
  };

  // AI / audit
  const handleAudit = async () => {
    setIsAuditing(true); setAuditFeedback(null);
    try {
      const otherDays = days.filter((_, i) => i !== activeDay);
      const feedback = await aiService.critiqueTemplateChanges(editedTemplate, otherDays.length ? otherDays : undefined);
      setAuditFeedback(feedback);
    } catch { setAuditFeedback('Audit unavailable.'); }
    finally { setIsAuditing(false); }
  };
  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiProcessing(true);
    try { const result = await aiService.editTemplateWithAI(editedTemplate, aiPrompt); setEditedTemplate(result); setAiPrompt(''); }
    catch (e) { alert(e instanceof GeminiError ? e.userMessage : 'AI edit failed'); }
    finally { setIsAiProcessing(false); }
  };
  const openSwap = async (idx: number) => {
    const ex = editedTemplate.exercises[idx];
    setSwappingIdx(idx); setIsGettingSwaps(true); setSwapSuggestions([]);
    try { const result = await aiService.suggestSwaps(ex.name, ex.category); setSwapSuggestions(result); }
    catch { /* ignore */ }
    finally { setIsGettingSwaps(false); }
  };
  const performSwap = (idx: number, newEx: { name: string; category: string; rationale?: string }) => {
    updateExercise(idx, 'name', newEx.name); updateExercise(idx, 'category', newEx.category); setSwappingIdx(null);
  };

  // Save
  const handleSave = () => {
    const withCritique = days.map((d, i) => ({ ...d, critique: i === activeDay ? auditFeedback || undefined : undefined }));
    if (isMultiDay && onSaveAll) onSaveAll(withCritique);
    else onSave(withCritique[0]);
  };

  const selectedExercise = selectedIdx !== null ? editedTemplate.exercises[selectedIdx] : null;
  const selectedLibraryItem = selectedExercise ? fullLibrary.find(l => l.name.toLowerCase() === selectedExercise.name.toLowerCase()) || null : null;

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-200">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <History size={16} className="text-emerald-400" />
          </div>
          <div>
            {isMultiDay ? (
              <p className="text-lg font-black text-slate-100 tracking-tight">{days.length}-Day Program</p>
            ) : (
              <input value={editedTemplate.name} onChange={e => setEditedTemplate(t => ({ ...t, name: e.target.value }))}
                className="bg-transparent text-lg font-black text-slate-100 border-none outline-none placeholder:text-slate-700 tracking-tight" placeholder="Unnamed Routine" />
            )}
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Program Architect</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleAudit} disabled={isAuditing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-black text-slate-300 transition-all">
            {isAuditing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} className="text-amber-400" />}
            {isMultiDay ? 'Audit Day' : 'Audit'}
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-xs font-black text-slate-950 transition-all">
            <Save size={14} />{isMultiDay ? 'Save Program' : 'Save'}
          </button>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-rose-400 transition-all border border-slate-700"><X size={16} /></button>
        </div>
      </div>

      {/* Audit banner */}
      {auditFeedback && (
        <div className="px-6 py-3 bg-amber-500/5 border-b border-amber-500/20 flex items-start gap-3 shrink-0">
          <Wand2 size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 font-medium leading-relaxed">{auditFeedback}</p>
          <button onClick={() => setAuditFeedback(null)} className="ml-auto text-slate-600 hover:text-slate-400 shrink-0"><X size={14} /></button>
        </div>
      )}

      {/* Three-panel body */}
      <div ref={containerRef} className="flex flex-1 min-h-0 gap-0">

        {/* Left: Library */}
        <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: `${leftPct}%` }}>
          <div className="px-4 py-3 border-b border-slate-800 shrink-0 flex items-center gap-2">
            <BookOpen size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exercise Library</span>
          </div>
          <div className="flex-1 min-h-0">
            <LibraryPicker onSelect={addExercise} onClose={() => {}} fullLibrary={fullLibrary} isModal={false} onExerciseClick={item => addExercise(item)} />
          </div>
        </div>

        <PanelDivider onDrag={onLeftDividerDrag} />

        {/* Centre: Canvas with day tabs */}
        <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: `${midPct}%` }} onDragOver={e => e.preventDefault()} onDrop={onCanvasDrop}>

          {/* Day tab strip */}
          <DayTabStrip
            days={days} activeDay={activeDay}
            onSelect={i => { setActiveDay(i); setSelectedIdx(null); setSwappingIdx(null); }}
            onRename={renameDay} onDelete={deleteDay} onAdd={addDay}
          />

          {/* Canvas sub-header */}
          <div className="px-4 py-2.5 border-b border-slate-800 shrink-0 flex items-center justify-between bg-slate-900/40">
            <div className="flex items-center gap-2">
              <Layers size={13} className="text-slate-600" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {editedTemplate.exercises.length} {editedTemplate.exercises.length === 1 ? 'exercise' : 'exercises'}
                {isMultiDay && <span className="text-slate-700"> · {editedTemplate.exercises.reduce((s, ex) => s + (ex.suggestedSets || 3), 0)} sets</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAiEdit()}
                placeholder="AI edit this day…"
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30 w-44 placeholder:text-slate-600" />
              <button onClick={handleAiEdit} disabled={isAiProcessing || !aiPrompt.trim()}
                className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40">
                {isAiProcessing ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
              </button>
            </div>
          </div>

          {/* Exercise list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {editedTemplate.exercises.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-700 border-2 border-dashed border-slate-800 rounded-2xl gap-2">
                <Layers size={28} />
                <p className="text-[10px] font-black uppercase tracking-widest text-center px-4">Drag exercises here or click in the library</p>
              </div>
            )}
            {editedTemplate.exercises.map((ex, idx) => (
              <div key={idx} data-card="true">
                <ExerciseCard
                  ex={ex} idx={idx} isSelected={selectedIdx === idx} isDragOver={dragOverIdx === idx} weightUnit={weightUnit}
                  onSelect={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                  onUpdate={(field, value) => updateExercise(idx, field, value)}
                  onRemove={() => removeExercise(idx)} onSwap={() => openSwap(idx)}
                  onDragStart={onCardDragStart} onDragOver={onCardDragOver} onDrop={onCardDrop}
                  onDragEnd={() => setDragOverIdx(null)}
                />
                {swappingIdx === idx && (
                  <div className="mt-1 mb-1 bg-slate-900 border border-amber-500/20 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">AI Swap Suggestions</span>
                      <button onClick={() => setSwappingIdx(null)} className="text-slate-600 hover:text-slate-400"><X size={12} /></button>
                    </div>
                    {isGettingSwaps && <p className="text-[9px] text-slate-500 font-black">Fetching suggestions…</p>}
                    {swapSuggestions.map((s, si) => (
                      <button key={si} onClick={() => performSwap(idx, s)}
                        className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-black text-slate-300 hover:text-emerald-400 transition-all">
                        {s.name}
                        {s.rationale && <span className="block text-[8px] font-medium text-slate-600">{s.rationale}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => addExercise()}
                className="flex-1 py-3 bg-slate-800/60 border border-slate-700 hover:border-slate-600 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                <Plus size={14} /> Custom Slot
              </button>
            </div>
          </div>
        </div>

        <PanelDivider onDrag={onRightDividerDrag} />

        {/* Right: Detail / Overview */}
        <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: `${rightPct}%` }}>
          <div className="px-4 py-3 border-b border-slate-800 shrink-0 flex items-center gap-2">
            <Info size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
              {selectedExercise ? selectedExercise.name : isMultiDay ? 'Program' : 'Overview'}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {selectedExercise && selectedLibraryItem ? (
              <div className="space-y-4">
                <ExerciseDetailContent item={selectedLibraryItem} />
                <div className="border-t border-slate-800 pt-4">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">e1RM Trend</p>
                  <div className="h-36"><E1RMChart history={history} userSettings={userSettings} compact /></div>
                </div>
              </div>
            ) : selectedExercise ? (
              <div className="space-y-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Not in library</p>
                {['name', 'category'].map(field => (
                  <div key={field}>
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{field}</label>
                    <input value={(selectedExercise as any)[field]} onChange={e => updateExercise(selectedIdx!, field, e.target.value)}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/30" />
                  </div>
                ))}
                <div className="border-t border-slate-800 pt-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">e1RM Trend</p>
                  <div className="h-36"><E1RMChart history={history} userSettings={userSettings} compact /></div>
                </div>
              </div>
            ) : isMultiDay ? (
              <ProgramOverview days={days} history={history} userSettings={userSettings} />
            ) : (
              <TemplateSummary template={editedTemplate} history={history} userSettings={userSettings} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditorDesktop;
