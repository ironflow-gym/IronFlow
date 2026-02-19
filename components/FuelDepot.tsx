import React, { useState, useMemo, useEffect } from 'react';
import { Coffee, Flame, Zap, Shield, Send, Loader2, Sparkles, Wand2, Plus, X, ChevronRight, ArrowRight, Bot, Target, Heart, Info, History, Trash2, Sliders, ChevronDown, ChevronUp, Save, Edit3, Calendar, Utensils, CheckCircle2, ShieldCheck, Search, Database } from 'lucide-react';
import { FuelLog, FuelProfile, BiometricEntry, UserSettings, FoodItem } from '../types';
import { GeminiService } from '../services/geminiService';
import { storage } from '../services/storageService';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface FuelDepotProps {
  history: FuelLog[];
  profile: FuelProfile;
  onSaveFuel: (history: FuelLog[]) => void;
  onSaveProfile: (profile: FuelProfile) => void;
  biometricHistory: BiometricEntry[];
  aiService: GeminiService;
  userSettings: UserSettings;
}

const FuelDepot: React.FC<FuelDepotProps> = ({ history, profile, onSaveFuel, onSaveProfile, biometricHistory, aiService, userSettings }) => {
  const [prompt, setPrompt] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [pantryItems, setPantryItems] = useState<FoodItem[]>([]);
  const [stagedToPantry, setStagedToPantry] = useState<FuelLog | null>(null);
  const [ambiguousMatch, setAmbiguousMatch] = useState<{ log: FuelLog, choices: FoodItem[] } | null>(null);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const loadPantry = async () => {
      const stored = await storage.get<FoodItem[]>('ironflow_pantry');
      if (stored) setPantryItems(stored);
    };
    loadPantry();
  }, [history]);

  // Auto-reset delete confirmation after 3 seconds
  useEffect(() => {
    let timeout: number;
    if (confirmingDeleteId) {
      timeout = window.setTimeout(() => setConfirmingDeleteId(null), 3000);
    }
    return () => clearTimeout(timeout);
  }, [confirmingDeleteId]);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  }, []);
  
  const todayLogs = useMemo(() => history.filter(l => l.date === todayStr), [history, todayStr]);

  const totals = useMemo(() => {
    const raw = todayLogs.reduce((acc, curr) => ({ calories: acc.calories + curr.calories, protein: acc.protein + curr.protein, carbs: acc.carbs + curr.carbs, fats: acc.fats + curr.fats }), { calories: 0, protein: 0, carbs: 0, fats: 0 });
    return { calories: Number(raw.calories.toFixed(1)), protein: Number(raw.protein.toFixed(1)), carbs: Number(raw.carbs.toFixed(1)), fats: Number(raw.fats.toFixed(1)) };
  }, [todayLogs]);

  const latestWeight = useMemo(() => {
    const val = [...biometricHistory].sort((a,b) => b.date.localeCompare(a.date))[0]?.weight || 75;
    return userSettings.units === 'imperial' ? val * 0.453592 : val;
  }, [biometricHistory, userSettings.units]);

  const userAge = useMemo(() => {
    if (!userSettings.dateOfBirth) return 30;
    const birthDate = new Date(userSettings.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age--;
    return Math.max(1, age);
  }, [userSettings.dateOfBirth]);

  const estimatedTDEE = useMemo(() => {
    const bmr = (10 * latestWeight) + (6.25 * (biometricHistory[0]?.height || 175)) - (5 * userAge) + (userSettings.gender === 'female' ? -161 : 5);
    let mult = 1.375;
    if (profile.goal === 'Build Muscle') mult = 1.55;
    if (profile.goal === 'Lose Fat') mult = 1.4;
    const base = bmr * mult;
    const adjusted = profile.goal === 'Build Muscle' ? base + 300 : (profile.goal === 'Lose Fat' ? base - 500 : base);
    return Number((adjusted * (profile.targetMultiplier || 1.0)).toFixed(1));
  }, [latestWeight, biometricHistory, userSettings.gender, profile.goal, userAge, profile.targetMultiplier]);

  const multiplier = profile.targetMultiplier || 1.0;
  const targetProtein = Number((latestWeight * profile.targetProteinRatio * multiplier).toFixed(1));
  const targetCarbs = Number(((estimatedTDEE * 0.45) / 4).toFixed(1));
  const targetFats = Number(((estimatedTDEE * 0.25) / 9).toFixed(1));

  const handleSynthesize = async () => {
    if (!prompt.trim()) return;
    setIsSynthesizing(true);
    try {
      const context = pantryItems.slice(0, 100);
      const result = await aiService.parseFuelPrompt(prompt, profile, context);
      
      let finalLogs = [...history];
      
      for (const log of result.logs) {
        if (!log.pantryItemId) {
          const searchName = log.name.toLowerCase();
          const matches = pantryItems.filter(p => 
            p.name.toLowerCase().includes(searchName) || 
            searchName.includes(p.name.toLowerCase())
          );
          
          if (matches.length > 0) {
            setAmbiguousMatch({ log, choices: matches });
            setIsSynthesizing(false);
            return; 
          }
        }
        finalLogs.push(log);
      }

      onSaveFuel(finalLogs);
      if (result.updatedProfile) onSaveProfile({ ...profile, ...result.updatedProfile });

      const newPotentialItem = result.logs.find(l => !l.pantryItemId && l.confidence > 0.85);
      if (newPotentialItem) setStagedToPantry(newPotentialItem);
      
      setPrompt('');
    } catch (e) { alert("Synthesis failed."); } finally { setIsSynthesizing(false); }
  };

  const resolveAmbiguous = (choice: FoodItem | 'new') => {
    if (!ambiguousMatch) return;
    const { log } = ambiguousMatch;
    let resolvedLog: FuelLog;
    
    if (choice === 'new') {
      resolvedLog = log;
      setStagedToPantry(log);
    } else {
      resolvedLog = {
        ...log,
        name: choice.name,
        calories: choice.calories,
        protein: choice.protein,
        carbs: choice.carbs,
        fats: choice.fats,
        pantryItemId: choice.id
      };
    }
    
    onSaveFuel([...history, resolvedLog]);
    setAmbiguousMatch(null);
    setPrompt('');
  };

  const commitToPantry = async () => {
    if (!stagedToPantry) return;
    const newItem: FoodItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: stagedToPantry.name,
      servingSize: '1 serving',
      protein: stagedToPantry.protein,
      carbs: stagedToPantry.carbs,
      fats: stagedToPantry.fats,
      calories: stagedToPantry.calories,
      lastUsed: Date.now()
    };
    const newPantry = [...pantryItems, newItem];
    setPantryItems(newPantry);
    await storage.set('ironflow_pantry', newPantry);
    setStagedToPantry(null);
  };

  const handleSaveEdit = () => {
    if (!editingLog) return;
    onSaveFuel(history.map(l => l.id === editingLog.id ? editingLog : l));
    setEditingLog(null);
  };

  const handleDelete = (logId: string) => {
    if (confirmingDeleteId === logId) {
      onSaveFuel(history.filter(l => l.id !== logId));
      setConfirmingDeleteId(null);
    } else {
      setConfirmingDeleteId(logId);
    }
  };

  const MacroBar = ({ label, current, target, color, unit = 'g' }: { label: string, current: number, target: number, color: string, unit?: string }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest px-1">
        <span className="text-slate-300 truncate mr-2">{label}</span>
        <span className="text-slate-100 shrink-0">{current.toFixed(1)}{unit} / {target.toFixed(1)}{unit}</span>
      </div>
      <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 shadow-inner">
        <div className="h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(251,146,60,0.2)]" style={{ width: `${Math.min(100, (current / target) * 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Target Insights */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
         <div className="absolute -right-4 -top-4 opacity-5 rotate-12"><Zap size={140} /></div>
         <div className="flex flex-col sm:flex-row items-center gap-10 relative z-10">
            <div className="relative w-44 h-44 shrink-0">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={[{ name: 'C', value: Math.min(totals.calories, estimatedTDEE), color: '#fb923c' }, { name: 'R', value: Math.max(0, estimatedTDEE - totals.calories), color: '#1e293b' }]} cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" paddingAngle={0} dataKey="value" startAngle={90} endAngle={-270}>{[{color:'#fb923c'},{color:'#1e293b'}].map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}</Pie></PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{totals.calories > estimatedTDEE ? 'Over' : 'Left'}</p>
                  <h3 className={`text-4xl font-black tracking-tighter ${totals.calories > estimatedTDEE ? 'text-rose-400' : 'text-slate-100'}`}>{Math.abs(estimatedTDEE - totals.calories).toFixed(1)}</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Kcal</p>
               </div>
            </div>
            <div className="flex-1 w-full space-y-6">
               <div><h4 className="text-base font-black text-slate-100 uppercase tracking-[0.2em] mb-1.5">Metabolic Balance</h4><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Synthesis Evolution Snapshot</p></div>
               <div className="space-y-5">
                  <MacroBar label="Tissue Repair (P)" current={totals.protein} target={targetProtein} color="#22d3ee" />
                  <MacroBar label="Kinematic Fuel (C)" current={totals.carbs} target={targetCarbs} color="#34d399" />
                  <MacroBar label="Hormonal Anchor (F)" current={totals.fats} target={targetFats} color="#fb923c" />
               </div>
            </div>
         </div>
      </div>

      {/* Pantry Resolution Modal */}
      {ambiguousMatch && (
        <div className="fixed inset-0 z-[170] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="w-full max-w-lg bg-slate-900 border border-orange-500/30 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
              <div className="flex items-center gap-4 mb-2">
                 <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20"><Search className="text-orange-400" size={24} /></div>
                 <div>
                    <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight">Match Resolution</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Multiple Pantry Items Detected</p>
                 </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed italic">Which database entry corresponds to "<span className="text-orange-400 font-black">{ambiguousMatch.log.name}</span>"?</p>
              <div className="space-y-2">
                 {ambiguousMatch.choices.map(choice => (
                    <button key={choice.id} onClick={() => resolveAmbiguous(choice)} className="w-full text-left p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-orange-500/40 transition-all flex items-center justify-between group">
                       <div>
                          <p className="text-xs font-black text-slate-100">{choice.name}</p>
                          <p className="text-[9px] text-slate-600 font-bold uppercase">{choice.brand} • {choice.calories} kcal</p>
                       </div>
                       <ChevronRight size={14} className="text-slate-800 group-hover:text-orange-400" />
                    </button>
                 ))}
                 <button onClick={() => resolveAmbiguous('new')} className="w-full text-left p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl hover:bg-orange-500/10 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                       <Plus size={16} className="text-orange-400" />
                       <span className="text-xs font-black text-orange-400 uppercase tracking-widest">None of these (Synthesize New)</span>
                    </div>
                    <ChevronRight size={14} className="text-orange-400" />
                 </button>
              </div>
              <button onClick={() => setAmbiguousMatch(null)} className="w-full py-4 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:text-slate-400 transition-colors">Discard Entry</button>
           </div>
        </div>
      )}

      {/* Instance Editor Modal */}
      {editingLog && (
        <div className="fixed inset-0 z-[170] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
           <div className="w-full max-w-lg bg-slate-900 border border-orange-500/30 rounded-[2.5rem] p-8 shadow-2xl space-y-8">
              <div className="flex justify-between items-center">
                 <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Recalibrate Intake</h3>
                 <button onClick={() => setEditingLog(null)} className="p-2 text-slate-500 hover:text-slate-300 transition-colors"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Meal / Food Item Name</label>
                    <input value={editingLog.name} onChange={(e) => setEditingLog({...editingLog, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-bold focus:ring-1 focus:ring-orange-500/40 outline-none" />
                 </div>
                 <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-cyan-500 uppercase text-center block">Protein</label>
                       <input type="number" value={editingLog.protein} onChange={(e) => setEditingLog({...editingLog, protein: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-black text-slate-100 outline-none" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-emerald-500 uppercase text-center block">Carbs</label>
                       <input type="number" value={editingLog.carbs} onChange={(e) => setEditingLog({...editingLog, carbs: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-black text-slate-100 outline-none" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-orange-500 uppercase text-center block">Fats</label>
                       <input type="number" value={editingLog.fats} onChange={(e) => setEditingLog({...editingLog, fats: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-black text-slate-100 outline-none" />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 text-center block">Total Calories (Kcal)</label>
                    <input type="number" value={editingLog.calories} onChange={(e) => setEditingLog({...editingLog, calories: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-center text-3xl font-black text-orange-400 outline-none focus:ring-1 focus:ring-orange-500/40" />
                 </div>
              </div>
              <button onClick={handleSaveEdit} className="w-full py-5 bg-orange-500 text-slate-950 font-black rounded-3xl uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20 active:scale-95 transition-all"><Save size={20}/> Update Instance</button>
           </div>
        </div>
      )}

      {/* Commit to Pantry Toast */}
      {stagedToPantry && !ambiguousMatch && (
        <div className="bg-orange-500/10 border border-orange-500/20 p-5 rounded-[2rem] flex items-center justify-between animate-in slide-in-from-top-4 shadow-xl">
           <div className="flex items-center gap-4">
              <Database className="text-orange-400" size={20} />
              <div>
                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Registry Potential</p>
                <p className="text-xs text-white font-bold">Save "{stagedToPantry.name}" to Truth Source?</p>
              </div>
           </div>
           <div className="flex gap-2">
              <button onClick={() => setStagedToPantry(null)} className="px-4 py-2 text-slate-500 font-black uppercase text-[9px] tracking-widest">Dismiss</button>
              <button onClick={commitToPantry} className="px-5 py-2 bg-orange-500 text-slate-950 font-black rounded-xl uppercase text-[9px] tracking-widest flex items-center gap-2 active:scale-95 transition-all"><CheckCircle2 size={12}/> Confirm</button>
           </div>
        </div>
      )}

      {/* Synthesis Input */}
      <div className="bg-slate-950 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity rotate-12"><Wand2 size={120}/></div>
         <h4 className="text-xs font-black text-slate-100 uppercase tracking-[0.25em] mb-5 flex items-center gap-3 relative z-10"><Sparkles size={18} className="text-[#fb923c]" /> Narrative Synthesis</h4>
         <div className="relative z-10">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe meals: '200g Lean Beef' or 'Oat milk latte'..." className="w-full h-48 bg-slate-900 border border-slate-800 rounded-[2rem] p-8 text-base text-slate-100 font-bold placeholder:text-slate-800 focus:ring-1 focus:ring-[#fb923c]/40 outline-none resize-none transition-all shadow-inner" />
            <button onClick={handleSynthesize} disabled={isSynthesizing || !prompt.trim()} className="absolute bottom-8 right-8 p-6 bg-[#fb923c] text-slate-950 rounded-2xl shadow-2xl shadow-[#fb923c]/30 active:scale-95 transition-all disabled:opacity-50">{isSynthesizing ? <Loader2 className="animate-spin" size={28} /> : <Wand2 size={28} />}</button>
         </div>
      </div>

      {/* Intake Stream */}
      <div className="space-y-3">
         <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 mb-2 flex items-center justify-between">
            <span>Intake Registry</span>
            <span className="text-orange-400/50">{todayLogs.length} Events</span>
         </h3>
         {todayLogs.map(log => (
            <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-[#fb923c]/30 transition-all flex justify-between items-center group shadow-md">
               <div>
                  <h5 className="text-lg font-black text-slate-100 uppercase tracking-tight flex items-center gap-2">{log.name} {log.pantryItemId && <ShieldCheck size={14} className="text-emerald-500" />}</h5>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{log.calories} kcal • <span className="text-cyan-400">{log.protein}g P</span> / <span className="text-emerald-400">{log.carbs}g C</span> / <span className="text-orange-400">{log.fats}g F</span></p>
               </div>
               <div className="flex gap-1 items-center">
                  <button onClick={() => setEditingLog(log)} className="p-3 text-slate-700 hover:text-orange-400 opacity-0 group-hover:opacity-100 transition-all active:scale-90"><Edit3 size={20}/></button>
                  <button 
                    onClick={() => handleDelete(log.id)} 
                    className={`p-3 transition-all active:scale-90 rounded-xl ${
                      confirmingDeleteId === log.id 
                        ? 'text-rose-500 bg-rose-500/10 scale-110 opacity-100 animate-pulse' 
                        : 'text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100'
                    }`}
                    title={confirmingDeleteId === log.id ? "Tap again to confirm delete" : "Delete Entry"}
                  >
                    <Trash2 size={20}/>
                  </button>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
};

export default FuelDepot;