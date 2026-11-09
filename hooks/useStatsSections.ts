import { useState } from 'react';
export const statsSectionsKey = 'ironflow_stats_sections';
export function readStatsSections(): Record<string, boolean> {
  try { const saved = JSON.parse(localStorage.getItem(statsSectionsKey) ?? '{}'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === 'boolean')) as Record<string, boolean> : {}; } catch { return {}; }
}
export default function useStatsSections() {
  const [sections, setSections] = useState(readStatsSections);
  return { isOpen: (key: string, defaultOpen = false) => sections[key] ?? defaultOpen, toggle: (key: string, defaultOpen = false) => {
    const value = !(sections[key] ?? defaultOpen);
    setSections(previous => ({ ...previous, [key]: value }));
    try { localStorage.setItem(statsSectionsKey, JSON.stringify({ ...readStatsSections(), [key]: value })); } catch { /* Preferences never block analysis. */ }
  } };
}
