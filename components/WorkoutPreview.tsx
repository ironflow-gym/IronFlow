import React from 'react';
import type { WorkoutSession } from '../types';
import ProgressionChoices from './ProgressionChoices';
export default function WorkoutPreview({ session, onChange, onStart, onClose }: { session: WorkoutSession; onChange: (session: WorkoutSession) => void; onStart: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Workout preview">
    <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{session.name}</h2><button onClick={onClose} className="p-2">Close preview</button></div>
      <p className="text-sm text-slate-400">Preview your workout. Choices here apply to this session.</p>
      {session.exercises.map(ex => <section key={ex.id}><h3 className="mb-2 font-bold">{ex.name} · {ex.sets.filter(s => !s.isWarmup).length} working sets</h3><ProgressionChoices exercise={ex} onChange={updated => onChange({ ...session, exercises: session.exercises.map(e => e.id === ex.id ? updated : e) })} /></section>)}
      <button className="w-full rounded-xl bg-emerald-500 p-3 font-bold text-slate-950" onClick={onStart}>Start this workout</button>
    </div>
  </div>;
}
