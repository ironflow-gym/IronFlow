import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  X, Plus, Trash2, Save, Bot, Wand2, Loader2, History,
  BookOpen, RefreshCcw, GripVertical, ChevronRight, Layers,
  Target, Weight, Repeat, Info,
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
  onClose: () => void;
  aiService: GeminiService;
  userSettings: UserSettings;
  fullLibrary: ExerciseLibraryItem[];
  history: HistoricalLog[];
}

// ── Draggable divider ─────────────────────────────────────────────────────────
interface DividerProps {
  onDrag: (delta: number) => void;
}
const PanelDivider: React.FC<DividerProps> = ({ onDrag }) => {
  const startX = useRef<number>(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    const onMove = (mv: MouseEvent) => {
      onDrag(mv.clientX - startX.current);
      startX.current = mv.clientX;
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onDrag]);

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1.5 shrink-0 bg-slate-800 hover:bg-emerald-500/40 cursor-col-resize transition-colors rounded-full mx-0.5 select-none"
      title="Drag to resize"
    />
  );
};

// ── Muscle coverage mini-bars ─────────────────────────────────────────────────
const MuscleCoverage: React.FC<{ exercises: WorkoutTemplate['exercises'] }> = ({ exercises }) => {
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

  if (sorted.length === 0) return (
    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">No exercises yet</p>
  );

  return (
    <div className="space-y-1.5">
      {sorted.map(([mg, sets]) => (
        <div key={mg} className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-500 w-20 shrink-0 truncate uppercase tracking-widest">{mg}</span>
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(sets / max) * 100}%` }}
            />
          </div>
          <span className="text-[9px] font-black text-slate-600 w-6 text-right">{sets}</span>
        </div>
      ))}
    </div>
  );
};

// ── Template summary panel (no exercise selected) ────────────────────────────
const TemplateSummary: React.FC<{ template: WorkoutTemplate; history: HistoricalLog[]; userSettings: UserSettings }> =
  ({ template, history, userSettings }) => {
  const totalSets = template.exercises.reduce((s, ex) => s + (ex.suggestedSets || 3), 0);
  const estimatedMins = Math.round(totalSets * 2.5); // ~2.5 min per set including rest

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto p-1">
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Template Overview</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Exercises', value: template.exercises.length },
            { label: 'Total Sets', value: totalSets },
            { label: 'Est. Time', value: `~${estimatedMins}m` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-800/60 rounded-2xl p-3 text-center">
              <div className="text-lg font-black text-slate-100">{value}</div>
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Muscle Coverage (sets)</p>
        <MuscleCoverage exercises={template.exercises} />
      </div>
      {template.exercises.length > 0 && (
        <div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">e1RM Trend</p>
          <div className="h-40">
            <E1RMChart history={history} userSettings={userSettings} compact />
          </div>
        </div>
      )}
      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center mt-auto pt-2">
        Click an exercise to inspect it
      </p>
    </div>
  );
};

// ── Exercise card (canvas) ────────────────────────────────────────────────────
interface ExCardProps {
  ex: WorkoutTemplate['exercises'][number];
  idx: number;
  isSelected: boolean;
  isDragOver: boolean;
  weightUnit: string;
  onSelect: () => void;
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
  onSwap: () => void;
  onDragStart: (e: React.DragEvent, idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
}

const ExerciseCard: React.FC<ExCardProps> = ({
  ex, idx, isSelected, isDragOver, weightUnit,
  onSelect, onUpdate, onRemove, onSwap,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) => (
  <div
    className={`rounded-2xl border transition-all group
      ${isDragOver ? 'border-emerald-500/60 bg-emerald-500/5 scale-[1.01]' : isSelected ? 'border-emerald-500/40 bg-slate-800/60' : 'border-slate-800 bg-slate-800/30 hover:border-slate-700'}
    `}
    onDragOver={e => onDragOver(e, idx)}
    onDrop={e => onDrop(e, idx)}
  >
    {/* Card header */}
    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/60">
      {/* Drag handle */}
      <div
        draggable
        onDragStart={e => onDragStart(e, idx)}
        onDragEnd={onDragEnd}
        className="cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 transition-colors shrink-0 p-0.5"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </div>
      <span className="text-[9px] font-black text-emerald-600 w-4">{idx + 1}</span>
      <button
        onClick={onSelect}
        className="flex-1 text-left text-xs font-black text-slate-200 truncate hover:text-emerald-400 transition-colors"
      >
        {ex.name || 'Unnamed'}
      </button>
      <button onClick={onSwap} className="p-1 text-slate-700 hover:text-amber-400 transition-colors" title="Swap exercise">
        <RefreshCcw size={12} />
      </button>
      <button onClick={onRemove} className="p-1 text-slate-700 hover:text-rose-500 transition-colors" title="Remove">
        <Trash2 size={12} />
      </button>
    </div>
    {/* Inline set/rep/weight fields */}
    <div className="flex items-center gap-2 px-3 py-2">
      {[
        { label: 'Sets', field: 'suggestedSets', type: 'number' },
        { label: 'Reps', field: 'suggestedReps', type: 'number' },
        { label: weightUnit, field: 'suggestedWeight', type: 'number' },
      ].map(({ label, field, type }) => (
        <div key={field} className="flex-1">
          <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest text-center mb-1">{label}</div>
          <input
            type={type}
            value={(ex as any)[field]}
            onChange={e => onUpdate(field, parseFloat(e.target.value) || 0)}
            onClick={e => e.stopPropagation()}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 text-center text-xs font-black text-slate-100 outline-none focus:border-emerald-500/40 transition-all"
          />
        </div>
      ))}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const TemplateEditorDesktop: React.FC<Props> = ({
  template, programContext, onSave, onClose,
  aiService, userSettings, fullLibrary, history,
}) => {
  const [editedTemplate, setEditedTemplate] = useState<WorkoutTemplate>(JSON.parse(JSON.stringify(template)));
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditFeedback, setAuditFeedback] = useState<string | null>(template.critique || null);
  const [swappingIdx, setSwappingIdx] = useState<number | null>(null);
  const [swapSuggestions, setSwapSuggestions] = useState<any[]>([]);
  const [isGettingSwaps, setIsGettingSwaps] = useState(false);
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Panel widths as percentages
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(30);
  const [midPct, setMidPct] = useState(45);
  // rightPct = 100 - leftPct - midPct (derived)

  const clampPanels = (l: number, m: number) => {
    const MIN = 15, MAX = 60;
    const nl = Math.min(MAX, Math.max(MIN, l));
    const nm = Math.min(MAX, Math.max(MIN, m));
    // ensure right panel also respects min
    if (100 - nl - nm < MIN) return { l: nl, m: Math.min(nm, 100 - nl - MIN) };
    return { l: nl, m: nm };
  };

  const onLeftDividerDrag = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const totalPx = containerRef.current.offsetWidth;
    const deltaPct = (delta / totalPx) * 100;
    setLeftPct(prev => {
      const { l, m } = clampPanels(prev + deltaPct, midPct);
      setMidPct(m);
      return l;
    });
  }, [midPct]);

  const onRightDividerDrag = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const totalPx = containerRef.current.offsetWidth;
    const deltaPct = (delta / totalPx) * 100;
    setMidPct(prev => {
      const rightPct = 100 - leftPct - prev;
      const { l, m } = clampPanels(leftPct, prev + deltaPct);
      void rightPct;
      return m;
    });
  }, [leftPct]);

  const rightPct = Math.max(15, 100 - leftPct - midPct);
  const weightUnit = userSettings.units === 'metric' ? 'KG' : 'LB';

  // ── Exercise mutations ────────────────────────────────────────────────────
  const addExercise = (item?: ExerciseLibraryItem) => {
    const newEx = {
      name: item?.name || 'New Exercise',
      category: item?.category || 'Other',
      suggestedSets: 3,
      targetReps: '10-12',
      suggestedWeight: 0,
      suggestedReps: 10,
      rationale: item ? `Focused on ${item.muscles?.join(', ') || item.category}` : 'Manually added',
    };
    setEditedTemplate(t => ({ ...t, exercises: [...t.exercises, newEx] }));
    setSelectedIdx(editedTemplate.exercises.length); // select the new one
  };

  const updateExercise = (idx: number, field: string, value: any) => {
    setEditedTemplate(t => {
      const exs = [...t.exercises];
      exs[idx] = { ...exs[idx], [field]: value };
      return { ...t, exercises: exs };
    });
  };

  const removeExercise = (idx: number) => {
    setEditedTemplate(t => ({ ...t, exercises: t.exercises.filter((_, i) => i !== idx) }));
    if (selectedIdx === idx) setSelectedIdx(null);
    else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  };

  // ── Drag-reorder ─────────────────────────────────────────────────────────
  const onCardDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('application/ironflow-reorder', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    setDragSrcIdx(idx);
  };

  const onCardDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/ironflow-reorder')) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverIdx(idx);
    } else if (e.dataTransfer.types.includes('application/ironflow-exercise')) {
      e.dataTransfer.dropEffect = 'copy';
      setDragOverIdx(idx);
    }
  };

  const onCardDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    setDragSrcIdx(null);

    // Reorder drag from canvas
    const reorderSrc = e.dataTransfer.getData('application/ironflow-reorder');
    if (reorderSrc !== '') {
      const srcIdx = parseInt(reorderSrc);
      if (srcIdx === dropIdx) return;
      setEditedTemplate(t => {
        const exs = [...t.exercises];
        const [moved] = exs.splice(srcIdx, 1);
        exs.splice(dropIdx, 0, moved);
        return { ...t, exercises: exs };
      });
      return;
    }

    // Library drag — insert at position
    const exerciseData = e.dataTransfer.getData('application/ironflow-exercise');
    if (exerciseData) {
      try {
        const item: ExerciseLibraryItem = JSON.parse(exerciseData);
        const newEx = {
          name: item.name,
          category: item.category,
          suggestedSets: 3,
          targetReps: '10-12',
          suggestedWeight: 0,
          suggestedReps: 10,
          rationale: `Focused on ${item.muscles?.join(', ') || item.category}`,
        };
        setEditedTemplate(t => {
          const exs = [...t.exercises];
          exs.splice(dropIdx, 0, newEx);
          return { ...t, exercises: exs };
        });
      } catch { /* ignore */ }
    }
  };

  // Drop on canvas background (append to end)
  const onCanvasDrop = (e: React.DragEvent) => {
    // Only handle if not dropped on a card
    if ((e.target as HTMLElement).closest('[data-card]')) return;
    const exerciseData = e.dataTransfer.getData('application/ironflow-exercise');
    if (exerciseData) {
      e.preventDefault();
      try {
        const item: ExerciseLibraryItem = JSON.parse(exerciseData);
        addExercise(item);
      } catch { /* ignore */ }
    }
    setDragOverIdx(null);
  };

  // ── AI / audit ───────────────────────────────────────────────────────────
  const handleAudit = async () => {
    setIsAuditing(true);
    setAuditFeedback(null);
    try {
      const feedback = await aiService.critiqueTemplateChanges(editedTemplate, programContext);
      setAuditFeedback(feedback);
    } catch { setAuditFeedback('Audit unavailable.'); }
    finally { setIsAuditing(false); }
  };

  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiProcessing(true);
    try {
      const result = await aiService.editTemplateWithAI(editedTemplate, aiPrompt);
      setEditedTemplate(result);
      setAiPrompt('');
    } catch (e) {
      alert(e instanceof GeminiError ? e.userMessage : 'AI edit failed');
    } finally { setIsAiProcessing(false); }
  };

  const openSwap = async (idx: number) => {
    const ex = editedTemplate.exercises[idx];
    setSwappingIdx(idx);
    setIsGettingSwaps(true);
    setSwapSuggestions([]);
    try {
      const result = await aiService.suggestSwaps(ex.name, ex.category);
      setSwapSuggestions(result);
    } catch { /* ignore */ }
    finally { setIsGettingSwaps(false); }
  };

  const performSwap = (idx: number, newEx: { name: string; category: string; rationale?: string }) => {
    updateExercise(idx, 'name', newEx.name);
    updateExercise(idx, 'category', newEx.category);
    setSwappingIdx(null);
  };

  const selectedExercise = selectedIdx !== null ? editedTemplate.exercises[selectedIdx] : null;
  const selectedLibraryItem = selectedExercise
    ? fullLibrary.find(l => l.name.toLowerCase() === selectedExercise.name.toLowerCase()) || null
    : null;

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <History size={16} className="text-emerald-400" />
          </div>
          <div>
            <input
              value={editedTemplate.name}
              onChange={e => setEditedTemplate(t => ({ ...t, name: e.target.value }))}
              className="bg-transparent text-lg font-black text-slate-100 border-none outline-none placeholder:text-slate-700 tracking-tight"
              placeholder="Unnamed Routine"
            />
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Program Architect</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAudit}
            disabled={isAuditing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-black text-slate-300 transition-all"
          >
            {isAuditing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} className="text-amber-400" />}
            Audit
          </button>
          <button
            onClick={() => onSave({ ...editedTemplate, critique: auditFeedback || undefined })}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-xs font-black text-slate-950 transition-all"
          >
            <Save size={14} />
            Save
          </button>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-rose-400 transition-all border border-slate-700">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Audit feedback banner */}
      {auditFeedback && (
        <div className="px-6 py-3 bg-amber-500/5 border-b border-amber-500/20 flex items-start gap-3 shrink-0">
          <Wand2 size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 font-medium leading-relaxed">{auditFeedback}</p>
          <button onClick={() => setAuditFeedback(null)} className="ml-auto text-slate-600 hover:text-slate-400 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Three-panel body */}
      <div ref={containerRef} className="flex flex-1 min-h-0 gap-0">

        {/* ── Left panel: Library ── */}
        <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: `${leftPct}%` }}>
          <div className="px-4 py-3 border-b border-slate-800 shrink-0 flex items-center gap-2">
            <BookOpen size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exercise Library</span>
          </div>
          <div className="flex-1 min-h-0">
            <LibraryPicker
              onSelect={addExercise}
              onClose={() => {}}
              fullLibrary={fullLibrary}
              isModal={false}
              onExerciseClick={item => addExercise(item)}
            />
          </div>
        </div>

        <PanelDivider onDrag={onLeftDividerDrag} />

        {/* ── Centre panel: Canvas ── */}
        <div
          className="flex flex-col min-h-0 overflow-hidden"
          style={{ width: `${midPct}%` }}
          onDragOver={e => e.preventDefault()}
          onDrop={onCanvasDrop}
        >
          <div className="px-4 py-3 border-b border-slate-800 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-emerald-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Canvas · {editedTemplate.exercises.length} exercises
              </span>
            </div>
            {/* AI quick-edit */}
            <div className="flex items-center gap-2">
              <input
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiEdit()}
                placeholder="AI edit…"
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30 w-44 placeholder:text-slate-600"
              />
              <button
                onClick={handleAiEdit}
                disabled={isAiProcessing || !aiPrompt.trim()}
                className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
              >
                {isAiProcessing ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {editedTemplate.exercises.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-700 border-2 border-dashed border-slate-800 rounded-2xl gap-2">
                <Layers size={28} />
                <p className="text-[10px] font-black uppercase tracking-widest">Drag exercises here or click in the library</p>
              </div>
            )}

            {editedTemplate.exercises.map((ex, idx) => (
              <div key={idx} data-card="true">
                <ExerciseCard
                  ex={ex}
                  idx={idx}
                  isSelected={selectedIdx === idx}
                  isDragOver={dragOverIdx === idx}
                  weightUnit={weightUnit}
                  onSelect={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                  onUpdate={(field, value) => updateExercise(idx, field, value)}
                  onRemove={() => removeExercise(idx)}
                  onSwap={() => openSwap(idx)}
                  onDragStart={onCardDragStart}
                  onDragOver={onCardDragOver}
                  onDrop={onCardDrop}
                  onDragEnd={() => { setDragSrcIdx(null); setDragOverIdx(null); }}
                />

                {/* Swap panel */}
                {swappingIdx === idx && (
                  <div className="mt-1 mb-1 bg-slate-900 border border-amber-500/20 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">AI Swap Suggestions</span>
                      <button onClick={() => setSwappingIdx(null)} className="text-slate-600 hover:text-slate-400"><X size={12} /></button>
                    </div>
                    {isGettingSwaps && <p className="text-[9px] text-slate-500 font-black">Fetching suggestions…</p>}
                    {swapSuggestions.map((s, si) => (
                      <button
                        key={si}
                        onClick={() => performSwap(idx, s)}
                        className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-black text-slate-300 hover:text-emerald-400 transition-all"
                      >
                        {s.name}
                        {s.rationale && <span className="block text-[8px] font-medium text-slate-600">{s.rationale}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Add exercise buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => addExercise()}
                className="flex-1 py-3 bg-slate-800/60 border border-slate-700 hover:border-slate-600 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
              >
                <Plus size={14} /> Custom Slot
              </button>
            </div>
          </div>
        </div>

        <PanelDivider onDrag={onRightDividerDrag} />

        {/* ── Right panel: Detail / Summary ── */}
        <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: `${rightPct}%` }}>
          <div className="px-4 py-3 border-b border-slate-800 shrink-0 flex items-center gap-2">
            <Info size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {selectedExercise ? selectedExercise.name : 'Overview'}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {selectedExercise && selectedLibraryItem ? (
              <div className="space-y-4">
                <ExerciseDetailContent item={selectedLibraryItem} />
                <div className="border-t border-slate-800 pt-4">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">e1RM Trend</p>
                  <div className="h-36">
                    <E1RMChart history={history} userSettings={userSettings} compact />
                  </div>
                </div>
              </div>
            ) : selectedExercise ? (
              // Exercise exists but not in library — show editable fields
              <div className="space-y-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Exercise not in library</p>
                {['name', 'category'].map(field => (
                  <div key={field}>
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{field}</label>
                    <input
                      value={(selectedExercise as any)[field]}
                      onChange={e => updateExercise(selectedIdx!, field, e.target.value)}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/30"
                    />
                  </div>
                ))}
                <div className="border-t border-slate-800 pt-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">e1RM Trend</p>
                  <div className="h-36">
                    <E1RMChart history={history} userSettings={userSettings} compact />
                  </div>
                </div>
              </div>
            ) : (
              <TemplateSummary
                template={editedTemplate}
                history={history}
                userSettings={userSettings}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditorDesktop;
