import { useEffect, useState } from 'react';
export type FoodSection = 'ai' | 'today' | 'targets' | 'history';
export const foodPreferencesKey = 'ironflow_food_view';
export function readFoodPreferences(): Record<FoodSection, boolean> {
  const result = { ai: false, today: false, targets: false, history: false };
  try {
    const saved = JSON.parse(localStorage.getItem(foodPreferencesKey) ?? 'null');
    for (const key of Object.keys(result) as FoodSection[]) if (typeof saved?.[key] === 'boolean') result[key] = saved[key];
  } catch { /* Logging remains usable when device preferences are unavailable. */ }
  return result;
}
export default function useFoodPreferences() {
  const [sections, setSections] = useState(readFoodPreferences);
  useEffect(() => { try { localStorage.setItem(foodPreferencesKey, JSON.stringify(sections)); } catch { /* Keep choices for this visit. */ } }, [sections]);
  return { sections, toggle: (key: FoodSection) => setSections(s => ({ ...s, [key]: !s[key] })) };
}
