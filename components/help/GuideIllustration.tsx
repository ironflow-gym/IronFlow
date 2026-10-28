import React from 'react';

/** Small, labelled examples; no generated values or connections to personal records. */
export function GuideIllustration({ topic }: { topic: string }) {
  if (topic === 'tr-blocks') return <figure className="rounded-xl border border-slate-800 p-4">
    <figcaption className="mb-3 text-sm text-slate-400">Example: four different workouts, two rounds</figcaption>
    {[1, 2].map(round => <div key={round} className="mb-2 flex flex-wrap items-center gap-2 text-sm"><span className="w-16">Round {round}</span>{['A', 'B', 'C', 'D'].map(workout => <span key={workout} className="rounded-lg bg-slate-800 px-3 py-1 text-slate-100">{workout}</span>)}</div>)}
    <p className="mt-3 text-sm text-slate-400">Eight sessions in total. At three days a week, the workout order carries into the next week.</p>
  </figure>;
  return null;
}
