import InfoButton from './ui/InfoButton';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Exercise, ExerciseLibraryItem, WorkoutSession } from '../types';
import { estimateRemainingMinutes, proposeSessionAdaptation, sessionFingerprint, type SessionAdaptation as Proposal } from '../src/sessionAdaptation';
import { summarizeAdaptation } from '../src/interfacePresentation';
import { isCardioCategory } from '../src/utils';
import Modal, { dialogButton, dialogField, dialogPrimaryButton } from './ui/Modal';

export interface ExerciseAlternative { name: string; category: string; rationale: string; }
interface Props {
  session: WorkoutSession;
  library: ExerciseLibraryItem[];
  defaultRest?: number;
  initialExerciseId?: string;
  onSuggestAlternatives?: (exercise: Exercise) => Promise<ExerciseAlternative[]>;
  onApply: (proposal: Proposal) => void;
  onClose: () => void;
}

export default function SessionAdaptation({ session, library, defaultRest = 90, initialExerciseId, onSuggestAlternatives, onApply, onClose }: Props) {
  const [minutes, setMinutes] = useState('');
  const [readiness, setReadiness] = useState<'normal' | 'low-energy'>('normal');
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState(initialExerciseId ?? session.exercises.find(ex => !ex.sets.some(set => set.completed))?.id ?? session.exercises[0]?.id ?? '');
  const [aiCatalog, setAiCatalog] = useState<ExerciseLibraryItem[]>([]);
  const [alternatives, setAlternatives] = useState<ExerciseAlternative[]>([]);
  const [aiMessage, setAiMessage] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState('');
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const minutesInput = useRef<HTMLInputElement>(null);
  const replacementSelect = useRef<HTMLSelectElement>(null);
  const request = useRef(0);
  const formId = useId();
  const options = useMemo(() => [...new Map([...aiCatalog, ...library].map(item => [item.name.toLowerCase(), item])).values()].sort((a, b) => a.name.localeCompare(b.name)), [library, aiCatalog]);
  const selectedExercise = session.exercises.find(ex => ex.id === selectedId);
  const started = selectedExercise?.sets.some(set => set.completed) ?? false;
  const stale = !!proposal && sessionFingerprint(session) !== proposal.fingerprint;
  const summary = useMemo(() => proposal ? summarizeAdaptation(session, proposal.session) : [], [session, proposal]);

  useEffect(() => { if (proposal) previewHeading.current?.focus(); }, [proposal]);
  useEffect(() => { if (initialExerciseId) replacementSelect.current?.focus(); }, [initialExerciseId]);
  useEffect(() => () => { request.current++; }, []);

  const setReplacement = (name: string) => {
    setReplacements(prev => ({ ...prev, [selectedId]: name }));
    setProposal(null);
    setAlternatives([]);
    setAiMessage('');
  };
  const suggest = async () => {
    if (!selectedExercise || !onSuggestAlternatives || started) return;
    if (!navigator.onLine) { setAiMessage('AI suggestions need a connection. You can still choose from the library.'); return; }
    const current = ++request.current;
    setSuggesting(true); setAiMessage(''); setAlternatives([]);
    try {
      const result = (await onSuggestAlternatives(selectedExercise)).filter(item => item.name.toLowerCase() !== selectedExercise.name.toLowerCase() && isCardioCategory(item.category) === isCardioCategory(selectedExercise.category));
      if (current !== request.current) return;
      const unique = [...new Map(result.map(item => [item.name.toLowerCase(), item])).values()];
      setAlternatives(unique);
      setAiCatalog(prev => [...prev, ...unique.map(item => ({ name: item.name, category: item.category, muscles: [], instructions: [], benefits: '', risks: '' }))]);
      if (!unique.length) setAiMessage('AI suggestions are unavailable. You can still choose from the library.');
    } catch { if (current === request.current) setAiMessage('AI suggestions are unavailable. You can still choose from the library.'); }
    finally { if (current === request.current) setSuggesting(false); }
  };
  const edit = () => { setProposal(null); setError(''); requestAnimationFrame(() => minutesInput.current?.focus()); };
  const footer = proposal ? <>
    <button key="edit" type="button" className={dialogButton} onClick={event => { event.preventDefault(); edit(); }}>Edit options</button>
    <button key="apply" type="button" className={dialogPrimaryButton} disabled={stale || !proposal.changes.length} onClick={() => { try { onApply(proposal); } catch (e) { setError((e as Error).message); } }}>Apply changes</button>
  </> : <button key="preview" type="submit" form={formId} className={`${dialogPrimaryButton} w-full sm:w-auto`}>Preview adaptation</button>;

  return <Modal label="Adapt this workout" title="Adapt this workout" closeLabel="Cancel adaptation" onClose={onClose} footer={footer}>
    {proposal ? <section aria-label="Proposed adaptation" className="space-y-4">
      <h3 ref={previewHeading} tabIndex={-1} className="text-lg font-bold outline-none">Review changes · about {proposal.remainingMinutes} min remaining</h3>
      <p role="status" className="sr-only">Preview ready. {summary.length} exercises changed. Review before applying.</p>
      {summary.map(item => <article key={item.id} className="rounded-xl border border-emerald-500/30 p-4 space-y-2">
        <h4 className="font-bold">{item.previousName ? `${item.previousName} → ${item.name}` : item.name}</h4>
        {item.loads.map((load, index) => <p key={index} className="text-sm text-emerald-300">{load.count} {load.count === 1 ? 'set' : 'sets'}: {load.text}</p>)}
        {!!item.removed && <p className="text-sm">{item.removed} unfinished working {item.removed === 1 ? 'set removed' : 'sets removed'}.</p>}
        {item.previousName && <p className="text-sm text-slate-300">Replacement load starts at its configured base, or 0. Check its weight and reps before starting.</p>}
      </article>)}
      {proposal.notes.map((note, index) => <p key={index} className="text-sm text-slate-300">{note}</p>)}
      <details className="rounded-xl border border-slate-700 px-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-slate-300">Individual changes ({proposal.changes.length})</summary><ul className="space-y-2 pb-3 text-sm text-slate-300">{proposal.changes.map((change, index) => <li key={index}>{change}</li>)}</ul></details>
      <p className="text-sm text-slate-300">Completed sets and routine defaults stay unchanged.</p>
      {stale && <p role="alert" className="text-sm text-amber-300">The workout changed. Edit your options and preview again.</p>}
    </section> : <form id={formId} className="space-y-5" onSubmit={event => { event.preventDefault(); try { setError(''); setProposal(proposeSessionAdaptation(session, { minutes: minutes ? Number(minutes) : undefined, readiness, replacements }, options, defaultRest)); } catch (e) { setError((e as Error).message); } }}>
      <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-300">About {estimateRemainingMinutes(session, defaultRest)} min left · current workout only.</p><InfoButton topic="adaptation" /></div>
      <label className="block text-sm font-medium">Time available (minutes)<input ref={minutesInput} className={dialogField} type="number" min="5" max="180" step="1" placeholder="Keep current duration" value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
      <label className="block text-sm font-medium">How do you feel?<select className={dialogField} value={readiness} onChange={e => setReadiness(e.target.value as typeof readiness)}><option value="normal">Normal</option><option value="low-energy">Low energy</option></select></label>
      {readiness === 'low-energy' && <p className="text-sm text-slate-300">Suggest roughly 10% lighter working sets, adjusted to your equipment. Completed sets, warmups, assistance and cardio stay unchanged.</p>}
      <details open={initialExerciseId ? true : undefined} className="rounded-xl border border-slate-700 p-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold">Change exercise</summary>
        <div className="mt-3 space-y-4">
          <label className="block text-sm">Exercise to change<select aria-label="Exercise to change" className={dialogField} value={selectedId} onChange={e => { setSelectedId(e.target.value); setAlternatives([]); setAiMessage(''); setSuggesting(false); request.current++; }}>
            {session.exercises.map(ex => <option key={ex.id} value={ex.id} disabled={ex.sets.some(set => set.completed)}>{ex.name}{ex.sets.some(set => set.completed) ? ' — already started' : ''}</option>)}
          </select></label>
          {selectedExercise && <label className="block text-sm">Replace with<select ref={replacementSelect} aria-label={`Replace with (${selectedExercise.name})`} className={dialogField} disabled={started} value={replacements[selectedId] ?? ''} onChange={e => setReplacement(e.target.value)}>
            <option value="">Keep {selectedExercise.name}</option>
            {options.filter(item => item.name.toLowerCase() !== selectedExercise.name.toLowerCase() && isCardioCategory(item.category) === isCardioCategory(selectedExercise.category)).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select></label>}
          {started ? <p className="text-sm text-slate-300">This exercise has completed sets and cannot be replaced.</p> : <p className="text-sm text-slate-300">Choose an exercise you can perform. Check its starting load in the preview.</p>}
          {onSuggestAlternatives && <button type="button" className={dialogButton} disabled={suggesting || started || !selectedExercise} onClick={() => { void suggest(); }}>{suggesting ? 'Finding suggestions…' : 'Suggest with AI'}</button>}
          {aiMessage && <p role="status" className="text-sm text-slate-300">{aiMessage}</p>}
          {!!alternatives.length && <div className="space-y-2" aria-label="AI exercise suggestions">{alternatives.map(item => <button type="button" key={item.name} className={`${dialogButton} block w-full text-left`} onClick={() => setReplacement(options.find(option => option.name.toLowerCase() === item.name.toLowerCase())?.name ?? item.name)}><span className="block font-bold">Use {item.name}</span><span className="block pt-1 font-normal text-slate-300">{item.rationale}</span></button>)}</div>}
          {Object.entries(replacements).filter(([, name]) => name).map(([id, name]) => <p key={id} className="text-sm text-emerald-300">{session.exercises.find(ex => ex.id === id)?.name} → {name}</p>)}
        </div>
      </details>
    </form>}
    {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
  </Modal>;
}
