import { useEffect, useState } from 'react';
export const todayPreferencesKey = 'ironflow_today_view';
export type TodaySection = 'workout' | 'attention' | 'calendar' | 'block' | 'weekly' | 'day';
export interface TodayPreferences { view: 'week' | 'month'; sections: Record<TodaySection, boolean>; }
export const defaultTodayPreferences: TodayPreferences = { view: 'week', sections: { workout: false, attention: false, calendar: true, block: false, weekly: false, day: false } };
export function readTodayPreferences(): TodayPreferences {
  const value = { ...defaultTodayPreferences, sections: { ...defaultTodayPreferences.sections } };
  try {
    const saved = JSON.parse(localStorage.getItem(todayPreferencesKey) ?? 'null');
    if (saved?.view === 'week' || saved?.view === 'month') value.view = saved.view;
    for (const key of Object.keys(value.sections) as TodaySection[]) if (typeof saved?.sections?.[key] === 'boolean') value.sections[key] = saved.sections[key];
  } catch { /* Device preferences must never prevent training. */ }
  return value;
}
export default function useTodayPreferences() {
  const [preferences, setPreferences] = useState(readTodayPreferences);
  useEffect(() => { try { localStorage.setItem(todayPreferencesKey, JSON.stringify(preferences)); } catch { /* Still usable for this visit. */ } }, [preferences]);
  return { preferences, setView: (view: TodayPreferences['view']) => setPreferences(p => ({ ...p, view })), toggle: (key: TodaySection) => setPreferences(p => ({ ...p, sections: { ...p.sections, [key]: !p.sections[key] } })) };
}
