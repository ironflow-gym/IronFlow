import React, { useEffect, useRef } from 'react';
import type { SetLog } from '../types';

/** Tap cycles classification; hold arms the separate completion button for deletion. */
export default function SetMarker({ set, number, exerciseName, armed, onCycle, onArmDelete, onCancelDelete }: {
  set: SetLog; number: number; exerciseName: string; armed: boolean;
  onCycle: () => void; onArmDelete: () => void; onCancelDelete: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const clear = () => { clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => clear, [set.completed]);
  const kind = set.isDeload ? 'deload' : set.isWarmup ? 'warmup' : 'working';
  return <button type="button" aria-label={`Set ${number} type: ${kind} for ${exerciseName}. ${set.completed ? 'Tap to change' : 'Tap to change; hold to delete'}`}
    title="Tap: working → warmup → deload. Hold: delete. Keyboard: Enter cycles; Delete arms deletion; Escape cancels."
    onPointerDown={event => {
      if (event.button !== 0) return;
      clear(); held.current = false;
      timer.current = setTimeout(() => { held.current = true; if (!set.completed) { onArmDelete(); navigator.vibrate?.(50); } }, 600);
    }}
    onPointerUp={clear} onPointerLeave={clear} onPointerCancel={() => { clear(); held.current = false; onCancelDelete(); }}
    onContextMenu={event => { event.preventDefault(); clear(); if (!set.completed) { held.current = true; onArmDelete(); } }}
    onKeyDown={event => {
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); if (!set.completed) onArmDelete(); }
      if (event.key === 'Escape') { event.preventDefault(); onCancelDelete(); }
    }}
    onClick={() => {
      clear();
      if (held.current) { held.current = false; return; }
      if (armed) onCancelDelete(); else onCycle();
    }}
    className={`w-11 h-11 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 select-none touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${armed ? 'border-rose-400 bg-rose-500/10 text-rose-300' : set.isDeload ? 'border-cyan-500/50 text-cyan-300' : set.isWarmup ? 'border-amber-500/50 text-amber-300' : 'border-emerald-500/50 text-emerald-300'}`}>
    {set.isDeload ? 'D' : set.isWarmup ? 'W' : number}
  </button>;
}
