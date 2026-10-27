import { formatWeight } from '../src/equipment';
import { isTimedExercise, isCardioCategory, formatDuration } from '../src/utils';
import React, { useState } from 'react';
import type { WorkoutSession, ExerciseLibraryItem, Exercise } from '../types';
import SessionAdaptation, { type ExerciseAlternative } from './SessionAdaptation';
import { applySessionAdaptation } from '../src/sessionAdaptation';
import ProgressionChoices from './ProgressionChoices';
import Modal, { dialogButton, dialogPrimaryButton } from './ui/Modal';

export default function WorkoutPreview({ session, onChange, onStart, onClose, library = [], defaultRest = 90, onSuggestAlternatives }: {
  library?: ExerciseLibraryItem[];
  defaultRest?: number;
  session: WorkoutSession;
  onChange: (session: WorkoutSession) => void;
  onStart: () => void;
  onClose: () => void;
  onSuggestAlternatives?: (exercise: Exercise) => Promise<ExerciseAlternative[]>;
}) {
  const [adaptOpen, setAdaptOpen] = useState(false);
  return <>
    <Modal label="Workout preview" title={session.name} closeLabel="Close preview" onClose={onClose} suspended={adaptOpen}
      footer={<button className={`${dialogPrimaryButton} w-full sm:w-auto`} onClick={onStart}>Start this workout</button>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-300">Choices apply to this workout only.</p><button className={dialogButton} onClick={() => setAdaptOpen(true)}>Adapt this workout</button></div>
        {session.exercises.map(ex => <section key={ex.id}><h3 className="mb-2 font-bold">{ex.name} · {ex.sets.filter(set => !set.isWarmup && !set.isDeload).length} working sets</h3>{(ex.progressionMode === 'fixed' || ex.tracking === 'time') && <p className="mb-3 text-sm text-slate-300">Fixed prescription: {ex.targetReps}. {(() => { const groups = new Map<string, { count: number; label: string }>(); for (const set of ex.sets.filter(s => !s.isWarmup && !s.isDeload)) { const label = `${formatWeight(set.weight)} ${isCardioCategory(ex.category) ? 'distance / intensity' : set.unit === 'lbs' ? 'lb' : 'kg'} × ${isTimedExercise(ex) ? formatDuration(set.reps) : `${set.reps} reps`}`; const group = groups.get(label); groups.set(label, { count: (group?.count ?? 0) + 1, label }); } return [...groups.values()].map(group => `${group.count} ${group.count === 1 ? 'set' : 'sets'}: ${group.label}`).join('; '); })()}. Adjust manually during the workout.</p>}<ProgressionChoices exercise={ex} onChange={updated => onChange({ ...session, exercises: session.exercises.map(item => item.id === ex.id ? updated : item) })} /></section>)}
      </div>
    </Modal>
    {adaptOpen && <SessionAdaptation session={session} library={library} defaultRest={defaultRest} onSuggestAlternatives={onSuggestAlternatives} onClose={() => setAdaptOpen(false)} onApply={proposal => { onChange(applySessionAdaptation(session, proposal)); setAdaptOpen(false); }} />}
  </>;
}
