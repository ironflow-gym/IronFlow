import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { FoodItem, FuelLog, FuelProfile, SavedMeal, BiometricEntry, UserSettings } from '../types';
import { GeminiService } from '../services/geminiService';
import { localDate } from '../src/scheduling';
import { nutrients } from '../src/food';
import { clampTargetMultiplier, nutritionTargets } from '../src/nutritionTargets';
import Modal, { dialogButton, dialogField, dialogPrimaryButton } from './ui/Modal';
import BarcodeScanner from './BarcodeScanner';
import FoodBatchReview from './FoodBatchReview';
import FoodDefinitionEditor from './FoodDefinitionEditor';
import FoodEntryEditor from './FoodEntryEditor';
import BarcodeFoodLog from './BarcodeFoodLog';
import RepeatMealDialog from './RepeatMealDialog';
import SavedMeals from './SavedMeals';
import { lookupBarcode } from '../services/openFoodFactsService';

interface FuelDepotProps {
  pantryItems: FoodItem[]; onSavePantry: (items: FoodItem[]) => void;
  isVisible?: boolean; savedMeals: SavedMeal[]; onSaveMeals: (meals: SavedMeal[]) => void;
  history: FuelLog[]; profile: FuelProfile; onSaveFuel: (history: FuelLog[]) => void;
  onAddFuel: (logs: FuelLog[]) => void; onSaveProfile: (profile: FuelProfile) => void;
  biometricHistory: BiometricEntry[]; aiService: GeminiService; userSettings: UserSettings;
}
const round = (value: number) => Math.round(value * 10) / 10;
export default function FuelDepot({ pantryItems, onSavePantry, isVisible = true, savedMeals, onSaveMeals, history, profile, onSaveFuel, onAddFuel, onSaveProfile, biometricHistory, aiService, userSettings }: FuelDepotProps) {
  const [prompt, setPrompt] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [batch, setBatch] = useState<{ logs: FuelLog[]; updatedProfile?: FuelProfile } | null>(null);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [deletingLog, setDeletingLog] = useState<FuelLog | null>(null);
  const [repeatingLog, setRepeatingLog] = useState<FuelLog | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [mealNotice, setMealNotice] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [definition, setDefinition] = useState<FoodItem | null>(null);
  const [quantityFood, setQuantityFood] = useState<FoodItem | null>(null);
  const [multiplier, setMultiplier] = useState(() => clampTargetMultiplier(profile.targetMultiplier));
  const lookupGeneration = useRef(0);
  const alive = useRef(true);
  const todayStr = useMemo(() => localDate(), [isVisible]);
  const todayLogs = useMemo(() => history.filter(log => log.date === todayStr), [history, todayStr]);
  const totals = useMemo(() => Object.fromEntries(nutrients.map(key => [key, round(todayLogs.reduce((sum, log) => sum + log[key], 0))])) as Pick<FuelLog, typeof nutrients[number]>, [todayLogs]);
  const proposedTargets = nutritionTargets({ ...profile, targetMultiplier: multiplier }, biometricHistory, userSettings);
  const targets = useMemo(() => nutritionTargets(profile, biometricHistory, userSettings), [profile, biometricHistory, userSettings]);
  useEffect(() => { setMultiplier(clampTargetMultiplier(profile.targetMultiplier)); }, [profile.targetMultiplier]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; lookupGeneration.current++; }; }, []);
  const dailySummaries = useMemo(() => {
    const dates = [...new Set(history.map(log => log.date))].sort().reverse();
    return dates.map(date => { const logs = history.filter(log => log.date === date); return { date, logs, totals: Object.fromEntries(nutrients.map(key => [key, round(logs.reduce((sum, log) => sum + log[key], 0))])) as Pick<FuelLog, typeof nutrients[number]> }; });
  }, [history]);
  const startBarcode = async (barcode: string) => {
    setScannerOpen(false); setMealNotice('');
    const match = pantryItems.find(food => food.barcode === barcode);
    if (match) { if (!match.nutritionBasis || match.missingNutrients?.length) setDefinition(match); else setQuantityFood(match); return; }
    const generation = ++lookupGeneration.current; setLookupBusy(true);
    try {
      const result = await lookupBarcode(barcode);
      if (!alive.current || generation !== lookupGeneration.current) return;
      if (result.found) setDefinition({ ...result.item, id: crypto.randomUUID() });
      else setMealNotice('No product found for this barcode. You can log food manually using its label.');
    } catch (e) { if (alive.current && generation === lookupGeneration.current) setMealNotice(`Barcode lookup failed. Check your connection and try again. ${(e as Error).message}`); }
    finally { if (alive.current && generation === lookupGeneration.current) setLookupBusy(false); }
  };
  const prepareAI = async () => {
    if (!prompt.trim()) return;
    setIsSynthesizing(true); setMealNotice('');
    try { const result = await aiService.parseFuelPrompt(prompt, profile, pantryItems.slice(0, 100)); if (alive.current) setBatch(result); }
    catch (e) { if (alive.current) setMealNotice((e as Error).message || 'Could not interpret food. Your description has been kept.'); }
    finally { if (alive.current) setIsSynthesizing(false); }
  };
  const add = (entries: FuelLog[]) => { onAddFuel(entries); setMealNotice(`Added ${entries.length} food ${entries.length === 1 ? 'entry' : 'entries'} to ${entries[0]?.date}.`); };
  return (<div className="space-y-5 pb-20">
    <section aria-label="Today’s food totals" className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><h2 className="font-bold">Today’s totals</h2><p className="mt-1 text-sm text-slate-300">{totals.calories} kcal · {totals.protein}g protein · {totals.carbs}g carbs · {totals.fats}g fat</p></section>
    <div className="flex flex-wrap gap-3"><button className={dialogPrimaryButton} onClick={() => setManualEntryOpen(true)}>Log food manually</button><button className={dialogButton} disabled={lookupBusy} onClick={() => setScannerOpen(true)}>Scan barcode</button></div>
    {lookupBusy && <p role="status" className="text-sm text-slate-300">Looking up barcode…</p>}
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4" aria-label="Describe food with AI">
      <label className="block font-bold">Describe food (AI)<textarea disabled={isSynthesizing} className={`${dialogField} h-28 resize-y font-normal`} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe meals: '200g Lean Beef' or 'Oat milk latte'..." /></label>
      <p className="mt-2 text-sm text-slate-300">AI estimates are reviewed before logging. Manual entry and saved meals work without an AI key.</p>
      <button className={`${dialogButton} mt-3`} disabled={isSynthesizing || !prompt.trim()} onClick={() => void prepareAI()}>{isSynthesizing ? 'Preparing review…' : 'Review food entries'}</button>
    </section>
    {mealNotice && <p role="status" className="text-sm text-emerald-200">{mealNotice}</p>}
    <SavedMeals meals={savedMeals} history={history} onSave={onSaveMeals} onLog={add} />
    <details className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><summary className="min-h-11 cursor-pointer py-3 font-bold">Today’s totals and targets</summary><div className="space-y-4 pt-3">
      <p className="text-sm text-slate-300">{profile.goal} · targets are estimates{targets.estimated ? '; some profile measurements use defaults' : ''}.</p>
      <dl className="grid grid-cols-2 gap-3">{nutrients.map(key => <div key={key}><dt className="text-sm text-slate-300">{key[0].toUpperCase()}{key.slice(1)}</dt><dd className="font-bold">{targets[key]} {key === 'calories' ? 'kcal' : 'g'}</dd></div>)}</dl>
      <label className="block text-sm">Calorie adjustment<input type="range" min="0.7" max="1.3" step="0.01" className="mt-3 block min-h-11 w-full" value={multiplier} onChange={e => setMultiplier(Number(e.target.value))} /></label>
      <p className="text-sm text-slate-300">Current target: {targets.calories} kcal → proposed: {proposedTargets.calories} kcal ({round(multiplier * 100)}%). Protein is unchanged.</p>
      <button className={dialogButton} onClick={() => onSaveProfile({ ...profile, targetMultiplier: multiplier })}>Apply target adjustment</button>
      <p className="text-sm text-slate-300">Preferences: {profile.preferences.join(', ') || 'None set'} · Region: {profile.region || 'Not set'}. Describe changes with AI and confirm the proposed profile update in its review.</p>
    </div></details>
    <section className="space-y-3" aria-label="Today’s food"><h2 className="text-lg font-bold">Today’s food · {todayLogs.length} entries</h2>
      {!todayLogs.length && <p className="text-sm text-slate-300">No food logged today.</p>}
      {todayLogs.map(log => <article key={log.id} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4"><div><h3 className="break-words text-lg font-bold">{log.name}</h3><p className="mt-1 text-sm text-slate-300">{log.calories} kcal · {log.protein}g protein · {log.carbs}g carbs · {log.fats}g fat</p>{log.servingDescription && <p className="mt-1 text-sm text-slate-300">Recorded amount: {log.servingDescription}</p>}<p className="mt-1 text-sm text-slate-300">{log.nutritionSource === 'ai' || log.confidence < 0.8 ? 'Estimated nutrition' : log.nutritionSource === 'barcode' ? 'Barcode product data' : log.nutritionSource === 'database' ? 'Food database' : log.nutritionSource === 'label' ? 'Label data' : 'Recorded nutrition'}</p></div>
        <div className="flex flex-wrap gap-2"><button className={dialogButton} aria-label={`Edit ${log.name}`} onClick={() => setEditingLog(log)}>Edit</button><button className={dialogButton} aria-label={`Repeat ${log.name}`} onClick={() => setRepeatingLog(log)}>Repeat</button><button className={dialogButton} aria-label={`Delete ${log.name}`} onClick={() => setDeletingLog(log)}>Delete</button></div>
      </article>)}
    </section>
    {isVisible && <>
      {(editingLog || manualEntryOpen) && <FoodEntryEditor entry={editingLog ?? undefined} onClose={() => { setEditingLog(null); setManualEntryOpen(false); }} onSave={entry => { if (editingLog) onSaveFuel(history.map(log => log.id === entry.id ? entry : log)); else add([entry]); }} />}
      {repeatingLog && <RepeatMealDialog name={repeatingLog.name} foods={[repeatingLog]} onClose={() => setRepeatingLog(null)} onAdd={add} />}
      {deletingLog && <Modal label="Delete food entry" title="Delete food entry?" closeLabel="Cancel deleting food" onClose={() => setDeletingLog(null)} footer={<><button className={dialogButton} onClick={() => setDeletingLog(null)}>Cancel</button><button className={`${dialogPrimaryButton} bg-rose-500 hover:bg-rose-400`} onClick={() => { onSaveFuel(history.filter(log => log.id !== deletingLog.id)); setMealNotice(`Deleted ${deletingLog.name}.`); setDeletingLog(null); }}>Delete entry</button></>}><p>Delete “{deletingLog.name}” from {deletingLog.date}? This removes it from your food totals.</p></Modal>}
      {scannerOpen && <BarcodeScanner onClose={() => setScannerOpen(false)} onDetected={code => void startBarcode(code)} />}
      {definition && <FoodDefinitionEditor purpose={pantryItems.some(item => item.id === definition.id) ? 'pantry' : 'barcode'} item={definition} onClose={() => setDefinition(null)} onSave={food => {
        // Confirming basis edits only the definition, never historical food logs.
        if (pantryItems.some(item => item.id === food.id)) onSavePantry(pantryItems.map(item => item.id === food.id ? food : item));
        setQuantityFood(food);
      }} />}
      {quantityFood && <BarcodeFoodLog item={quantityFood} isInPantry={pantryItems.some(item => item.id === quantityFood.id)} onClose={() => setQuantityFood(null)} onLog={entry => add([entry])} onSavePantry={food => onSavePantry([...pantryItems, food])} />}
      {batch && !manualEntryOpen && !editingLog && !deletingLog && !repeatingLog && !scannerOpen && !definition && !quantityFood && <FoodBatchReview logs={batch.logs} update={batch.updatedProfile} profile={profile} pantry={pantryItems} onSavePantry={onSavePantry} onClose={() => setBatch(null)} onConfirm={(logs, updatedProfile) => { if (logs.length) add(logs); if (updatedProfile) onSaveProfile(updatedProfile); setPrompt(''); }} />}
    </>}
      {/* Historical Archive — grouped by month */}
      {(() => {
        const pastSummaries = dailySummaries.filter(s => s.date !== todayStr);
        if (pastSummaries.length === 0) return null;

        // Group by YYYY-MM
        const monthMap: Record<string, typeof pastSummaries> = {};
        pastSummaries.forEach(s => {
          const key = s.date.slice(0, 7);
          if (!monthMap[key]) monthMap[key] = [];
          monthMap[key].push(s);
        });
        const months = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));
        const latestMonth = months[0];

        return (
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-100 px-2 mb-2 flex items-center gap-2">
              <History size={14} className="text-orange-400" /> Food history
            </h3>
            {months.map(monthKey => {
              const [year, month] = monthKey.split('-');
              const monthLabel = new Date(Number(year), Number(month) - 1, 1)
                .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
              const summaries = monthMap[monthKey];
              const isOpen = expandedDate?.startsWith('month:') ? expandedDate === `month:${monthKey}` : monthKey === latestMonth;
              const monthlyKcal = Math.round(summaries.reduce((s, d) => s + d.totals.calories, 0) / summaries.length);

              return (
                <div key={monthKey} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                  {/* Month header */}
                  <button
                    aria-expanded={isOpen}
                    onClick={() => setExpandedDate(expandedDate === `month:${monthKey}` ? null : `month:${monthKey}`)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="text-left">
                      <h4 className="text-base font-bold text-slate-100">{monthLabel}</h4>
                      <p className="mt-1 text-sm text-slate-300">
                        {summaries.length} days logged · avg {monthlyKcal} kcal/day
                      </p>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-slate-600 shrink-0" /> : <ChevronDown size={16} className="text-slate-600 shrink-0" />}
                  </button>

                  {/* Day entries */}
                  {isOpen && (
                    <div className="border-t border-slate-800/60 divide-y divide-slate-800/40">
                      {summaries.map(summary => (
                        <div key={summary.date} className="overflow-hidden">
                          <button
                            aria-expanded={expandedDate === summary.date}
                            onClick={() => setExpandedDate(expandedDate === summary.date ? `month:${monthKey}` : summary.date)}
                            className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-800/30 transition-colors"
                          >
                            <div className="text-left">
                              <h5 className="text-sm font-bold text-slate-100">
                                {new Date(summary.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </h5>
                              <p className="mt-1 text-sm text-slate-300">
                                {summary.totals.calories} kcal ·
                                <span className="text-cyan-400"> {summary.totals.protein}g P</span> /
                                <span className="text-emerald-400"> {summary.totals.carbs}g C</span> /
                                <span className="text-orange-400"> {summary.totals.fats}g F</span>
                              </p>
                            </div>
                            {expandedDate === summary.date
                              ? <ChevronUp size={14} className="text-slate-600 shrink-0" />
                              : <ChevronDown size={14} className="text-slate-600 shrink-0" />}
                          </button>

                          {expandedDate === summary.date && (
                            <div className="px-6 pb-4 space-y-2 animate-in slide-in-from-top-1 duration-150">
                              {summary.logs.map(log => (
                                <div key={log.id} className="flex flex-wrap justify-between items-center gap-3 py-2 border-b border-slate-800/30 last:border-0">
                                  <div className="min-w-0 flex-1 basis-48">
                                    <p className="break-words text-base font-bold text-slate-100">{log.name}</p>
                                    <p className="text-sm text-slate-300">
                                      {log.calories} kcal · {log.protein}g protein · {log.carbs}g carbs · {log.fats}g fat
                                    </p>
                                    {(log.nutritionSource === 'ai' || log.confidence < 0.8) && <p className="mt-1 text-sm text-slate-300">Estimated nutrition</p>}
                                  </div>
                                  <div className="flex flex-wrap gap-2"><button className={dialogButton} aria-label={`Repeat ${log.name}`} onClick={() => setRepeatingLog(log)}>Repeat</button><button className={dialogButton} aria-label={`Edit ${log.name}`} onClick={() => setEditingLog(log)}>Edit</button><button className={dialogButton} aria-label={`Delete ${log.name}`} onClick={() => setDeletingLog(log)}>Delete</button></div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};
