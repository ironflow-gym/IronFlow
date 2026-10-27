import React from 'react';
import type { BiometricEntry, FuelProfile, UserSettings } from '../types';
import { nutritionTargets } from '../src/nutritionTargets';
export default function BlockNutritionComparison({ current, proposed, biometrics, settings }: { current: FuelProfile; proposed: FuelProfile; biometrics: BiometricEntry[]; settings: UserSettings }) {
  const before = nutritionTargets(current, biometrics, settings), after = nutritionTargets(proposed, biometrics, settings);
  return <div className="space-y-3 text-sm"><table className="w-full text-left"><caption className="sr-only">Current and proposed Food settings</caption><thead><tr><th className="py-2">Setting</th><th>Current</th><th>Proposed</th></tr></thead><tbody>
    {[
      ['Goal', current.goal, proposed.goal], ['Calories (kcal/day)', Math.round(before.calories), Math.round(after.calories)],
      ['Protein (g/day)', before.protein, after.protein], ['Carbs (g/day)', before.carbs, after.carbs], ['Fats (g/day)', before.fats, after.fats],
      ['Protein (g/kg)', current.targetProteinRatio, proposed.targetProteinRatio], ['Calorie adjustment', `${Math.round(((current.targetMultiplier ?? 1) - 1) * 100)}%`, `${Math.round(((proposed.targetMultiplier ?? 1) - 1) * 100)}%`],
    ].map(([name, from, to]) => <tr key={name} className="border-t border-slate-700"><th className="py-2 pr-2 font-normal">{name}</th><td className="pr-2">{from}</td><td>{to}</td></tr>)}
  </tbody></table>
  <details><summary className="min-h-11 cursor-pointer py-3 font-bold">Other Food preferences</summary><p>Current: {current.preferences.join(', ') || 'None'}; region: {current.region || 'not set'}.</p><p>Proposed: {proposed.preferences.join(', ') || 'None'}; region: {proposed.region || 'not set'}.</p></details>
  {(before.estimated || after.estimated) && <p className="text-amber-200">Targets include estimated personal values. Check measurements and personal settings before relying on these totals.</p>}
  <p className="text-slate-300">These are calculated targets, not changes to your food history. Existing manual calorie and protein settings are shown above.</p>
  </div>;
}
