import React, { useId } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
export default function TodaySection({ title, label, summary, open, onToggle, children, attention = false, compact = false, action }: {
  title: string; label: string; summary?: string; open: boolean; onToggle: () => void; children: React.ReactNode; attention?: boolean; compact?: boolean; action?: React.ReactNode;
}) {
  const id = useId();
  return <section aria-label={label} className={`min-w-0 ${compact ? 'border-t' : 'rounded-2xl border bg-slate-900'} ${attention ? 'border-amber-500/50' : 'border-slate-700'}`}>
    <div className="flex items-center gap-1">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className={`flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl ${compact ? 'py-3' : 'p-4'} text-left focus-visible:outline-2 focus-visible:outline-emerald-400`}>
      <span className="min-w-0"><span className={`block ${compact ? 'text-sm' : 'text-lg'} font-bold ${attention ? 'text-amber-300' : ''}`}>{title}</span>{summary && <span className="mt-1 block text-sm text-slate-300">{summary}</span>}</span>
      {open ? <ChevronDown size={20} aria-hidden="true" className="shrink-0" /> : <ChevronRight size={20} aria-hidden="true" className="shrink-0" />}
    </button>
    {action && <div className="shrink-0 pr-2">{action}</div>}
    </div>
    <div id={id} hidden={!open} className={`space-y-3 ${compact ? 'pb-2' : 'px-4 pb-4'}`}>{children}</div>
  </section>;
}
