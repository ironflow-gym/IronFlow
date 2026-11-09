import React from 'react';
import Section from '../ui/TodaySection';
import useStatsSections from '../../hooks/useStatsSections';
export default function StatsSection({ name, title, summary, defaultOpen = false, children }: { name: string; title: string; summary?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const { isOpen, toggle } = useStatsSections();
  const open = isOpen(name, defaultOpen);
  return <Section label={title} title={title} summary={summary} open={open} onToggle={() => toggle(name, defaultOpen)}>{children}</Section>;
}
export const statsAction = 'min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2';
