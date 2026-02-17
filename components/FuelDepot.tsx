import React, { useState, useMemo, useEffect } from 'react';
import { Coffee, Flame, Zap, Shield, Send, Loader2, Sparkles, Wand2, Plus, X, ChevronRight, ArrowRight, Bot, Target, Heart, Info, History, Trash2, Sliders, ChevronDown, ChevronUp, Save, Edit3, Calendar } from 'lucide-react';
import { FuelLog, FuelProfile, BiometricEntry, UserSettings } from '../types';
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
  const [calibratingId, setCalibratingId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  }, []);
  
  const todayLogs = useMemo(() => history.filter(l => l.date === todayStr), [history, todayStr]);

  const historicalDays = useMemo(() => {
    const grouped: Record<string, { logs: FuelLog[], totals: { protein: number, carbs: number, fats: number, calories: number } }> = {};
    
    history.forEach(log => {
      if (log.date === todayStr) return;
      if (!grouped[log.date]) {
        grouped[log.date] = { 
          logs: [], 
          totals: { protein: 0, carbs: 0, fats: 0, calories: 0 } 
        };
      }
      grouped[log.date].logs.push(log);
      grouped[log.date].totals.protein += log.protein;
      grouped[log.date].totals.carbs += log.carbs;
      grouped[log.date].totals.fats += log.fats;
      grouped[log.date].totals.calories += log.calories;
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => ({
        date,
        logs: data.logs,
        totals: {
          protein: Number(data.totals.protein.toFixed(1)),
          carbs: Number(data.totals.carbs.toFixed(1)),
          fats: Number(data.totals.fats.toFixed(1)),
          calories: Number(data.totals.calories.toFixed(1))
        }
      }));
  }, [history, todayStr]);

  const latestWeight = useMemo(() => {
    const sorted = [...biometricHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const val = sorted[0]?.weight || 75;
    return userSettings.units === 'imperial' ? val * 0.453592 : val;
  }, [biometricHistory, userSettings.units]);

  const totals = useMemo(() => {
    const raw = todayLogs.reduce((acc, curr) => ({
      calories: acc.calories + curr.calories,
      protein: acc.protein + curr.protein,
      carbs: acc.carbs + curr.carbs,
      fats: acc.fats + curr.fats
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 });
    
    return {
      calories: Number(raw.calories.toFixed(1)),
      protein: Number(raw.protein.toFixed(1)),
      carbs: Number(raw.carbs.toFixed(1)),
      fats: Number(raw.fats.toFixed(1))
    };
  }, [todayLogs]);

  const userAge = useMemo(() => {
    if (!userSettings.dateOfBirth) return 30; // Fallback age
    const birthDate = new Date(userSettings.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return Math.max(1, age);
  }, [userSettings.dateOfBirth]);

  const estimatedTDEE = useMemo(() => {
    const weightKg = latestWeight;
    const heightCm = biometricHistory[0]?.height || 175;
    const age = userAge;
    const genderConstant = userSettings.gender === 'female' ? -161 : 5;
    const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + genderConstant;
    
    let multiplier = 1.375; // Moderate
    if (profile.goal === 'Build Muscle') multiplier = 1.55;
    if (profile.goal === 'Lose Fat') multiplier = 1.4;

    const targetTDEE = bmr * multiplier;
    const adjustedTDEE = profile.goal === 'Build Muscle' ? targetTDEE + 300 : (profile.goal === 'Lose Fat' ? targetTDEE - 500 : targetTDEE);
    
    // Apply metabolic multiplier (User Calibration)
    const finalTDEE = adjustedTDEE * (profile.targetMultiplier || 1.0);
    return Number(finalTDEE.toFixed(1));
  }, [latestWeight, biometricHistory, userSettings.gender, profile.goal, userAge, profile.targetMultiplier]);

  const multiplier = profile.targetMultiplier || 1.0;
  const targetProtein = Number((latestWeight * profile.targetProteinRatio * multiplier).toFixed(1));
  const targetCarbs = Number(((estimatedTDEE * 0.45) / 4).toFixed(1));
  const targetFats = Number(((estimatedTDEE * 0.25) / 9).toFixed(1));

  const handleSynthesize = async () => {
    if (!prompt.trim()) return;
    
    const cacheKey = `ironflow_pantry_${prompt.toLowerCase().trim()}`;
    const cached = await storage.get<any[]>(cacheKey);
    
    if (cached) {
      const cachedLogs = cached.map((l: any) => ({ ...l, id: Math.random().toString(36).substr(2, 9), date: todayStr }));
      onSaveFuel([...history, ...cachedLogs]);
      setPrompt('');
      return;
    }

    setIsSynthesizing(true);
    try {
      const result = await aiService.parseFuelPrompt(prompt, profile);
      onSaveFuel([...history, ...result.logs]);
      if (result.updatedProfile) onSaveProfile({ ...profile, ...result.updatedProfile });
      
      // Persist to Neural Pantry
      await storage.set(cacheKey, result.logs);
      
      setPrompt('');
    } catch (e) {
      alert("Metabolic synthesis failed. Check connection.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const removeLog = (id: string) => onSaveFuel(history.filter(l => l.id !== id));

  const updateLogMacrosAbsolute = (id: string, field: 'protein' | 'carbs' | 'fats', value: number) => {
    onSaveFuel(history.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      updated.calories = Number((updated.protein * 4 + updated.carbs * 4 + updated.fats * 9).toFixed(1));
      return updated;
    }));
  };

  const updateLogMacros = (id: string, factor: number) => {
    onSaveFuel(history.map(l => l.id === id ? {
      ...l,
      calories: Number((l.calories * factor).toFixed(1)),
      protein: Number((l.protein * factor).toFixed(1)),
      carbs: Number((l.carbs * factor).toFixed(1)),
      fats: Number((l.fats * factor).toFixed(1))
    } : l));
  };

  const ringData = [
    { name: 'Consumed', value: Math.min(totals.calories, estimatedTDEE), color: '#fb923c' },
    { name: 'Remaining', value: Math.max(0, estimatedTDEE - totals.calories), color: '#1e293b' }
  ];

  const MacroBar = ({ label, current, target, color, unit = 'g' }: { label: string, current: number, target: number, color: string, unit?: string }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest px-1">
        <span className="text-slate-300 truncate mr-2">{label}</span>
        <span className="text-slate-100 shrink-0">{current.toFixed(1)}{unit} / {target.toFixed(1)}{unit}</span>
      </div>
      <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 shadow-inner">
        <div 
          className="h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(251,146,60,0.2)]" 
          style={{ width: `${Math.min(100, (current / target) * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Target Insights Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
         <div className="absolute -right-4 -top-4 opacity-5 rotate-12"><Zap size={140} /></div>
         <div className="flex flex-col sm:flex-row items-center gap-10 relative z-10">
            <div className="relative w-44 h-44 shrink-0">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                     <Pie data={ringData} cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" paddingAngle={0} dataKey="value" startAngle={90} endAngle={-270}>
                        {ringData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                     </Pie>
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Left</p>
                  <h3 className="text-4xl font-black text-slate-100 tracking-tighter">{(Math.max(0, estimatedTDEE - totals.calories)).toFixed(1)}</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Kcal</p>
               </div>
            </div>
            <div className="flex-1 w-full space-y-6">
               <div>
                  <h4 className="text-base font-black text-slate-100 uppercase tracking-[0.2em] mb-1.5">Metabolic Balance</h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Today's Synthesis Snapshot</p>
               </div>
               <div className="space-y-5">
                  <MacroBar label="Tissue Repair (P)" current={totals.protein} target={targetProtein} color="#fb923c" />
                  <MacroBar label="Kinematic Fuel (C)" current={totals.carbs} target={targetCarbs} color="#f97316" />
                  <MacroBar label="Hormonal Anchor (F)" current={totals.fats} target={targetFats} color="#ea580c" />
               </div>
            </div>
         </div>
      </div>

      {/* Profile Manifesto */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
         <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-full flex items-center justify-between group">
            <div className="flex items-center gap-4">
               <div className="p-2.5 bg-[#fb923c]/20 rounded-xl text-[#fb923c] border border-[#fb923c]/20 shadow-sm"><Bot size={22} /></div>
               <div className="text-left">
                  <h4 className="text-[12px] font-black text-slate-100 uppercase tracking-widest">Dietary Manifesto</h4>
                  <p className="text-[11px] text-slate-400 font-black uppercase tracking-tight">
                    {profile.goal} • {profile.region ? `${profile.region} • ` : ''}{profile.preferences.length > 0 ? profile.preferences.join(', ') : 'No Protocol Restrictions'}
                  </p>
               </div>
            </div>
            {isProfileOpen ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
         </button>
         {isProfileOpen && (
           <div className="mt-8 pt-8 border-t border-slate-800 space-y-6 animate-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Protein Load</p>
                    <p className="text-base font-black text-slate-100">{profile.targetProteinRatio.toFixed(1)}g / kg</p>
                 </div>
                 <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Target Flux</p>
                    <p className={`text-base font-black ${multiplier !== 1 ? 'text-[#fb923c]' : 'text-slate-100'}`}>
                      {multiplier.toFixed(2)}x {multiplier !== 1 ? `(${multiplier > 1 ? '+' : ''}${Math.round((multiplier - 1) * 100)}%)` : ''}
                    </p>
                 </div>
                 <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Structural Mass</p>
                    <p className="text-base font-black text-slate-100">{latestWeight.toFixed(1)}kg (Ref: Bios)</p>
                 </div>
                 <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Calculated Age</p>
                    <p className="text-base font-black text-slate-100">{userAge} Years</p>
                 </div>
              </div>
              <p className="text-[11px] text-slate-400 font-bold italic leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800">Note: Update manifesto by typing in Fuel Depot below. E.g., "Decrease target by 5%" or "Change goal to Build Muscle".</p>
           </div>
         )}
      </div>

      {/* Synthesis Input */}
      <div className="bg-slate-950 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl relative">
         <h4 className="text-xs font-black text-slate-100 uppercase tracking-[0.25em] mb-5 flex items-center gap-3">
            <Sparkles size={18} className="text-[#fb923c]" /> Narrative Synthesis
         </h4>
         <div className="relative">
            <textarea 
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               placeholder="Describe mealNaturally: 'Large oat milk latte' or 'Decrease daily target by 5%'"
               className="w-full h-64 bg-slate-900 border border-slate-800 rounded-[2rem] p-8 text-base text-slate-100 font-bold placeholder:text-slate-800 focus:ring-1 focus:ring-[#fb923c]/40 outline-none resize-none transition-all leading-relaxed shadow-inner"
            />
            <button 
               onClick={handleSynthesize}
               disabled={isSynthesizing || !prompt.trim()}
               className="absolute bottom-8 right-8 p-6 bg-[#fb923c] text-slate-950 rounded-2xl shadow-2xl shadow-[#fb923c]/30 active:scale-95 transition-all disabled:opacity-50"
            >
               {isSynthesizing ? <Loader2 className="animate-spin" size={28} /> : <Wand2 size={28} />}
            </button>
         </div>
         {isSynthesizing && (
            <div className="mt-5 flex items-center gap-3 px-5 py-4 bg-[#fb923c]/10 border border-[#fb923c]/20 rounded-xl ai-loading-pulse shadow-sm">
               <Bot size={16} className="text-[#fb923c]" />
               <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[#fb923c]">Calculating Volumetric Macros...</span>
            </div>
         )}
      </div>

      {/* Intake Timeline */}
      <div className="space-y-4">
         <h3 className="text-standard-label text-slate-300 px-2 flex items-center justify-between">
            <span>Daily Intake Stream</span>
            <span className="text-[#fb923c]/70">{todayLogs.length} Events Logged</span>
         </h3>
         <div className="space-y-3">
            {todayLogs.length > 0 ? todayLogs.map((log) => (
               <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-[#fb923c]/30 transition-all group shadow-xl">
                  <div className="flex justify-between items-start mb-5">
                     <div className="flex-1">
                        <h5 className="text-xl font-black text-slate-100 tracking-tight uppercase">{log.name}</h5>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">{log.calories.toFixed(1)} kcal • Confidence {Math.round(log.confidence * 100)}%</p>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => setCalibratingId(calibratingId === log.id ? null : log.id)} className="p-3 bg-slate-800 border border-slate-700 text-slate-300 hover:text-[#fb923c] rounded-2xl transition-all shadow-md">
                           <Sliders size={20} />
                        </button>
                        <button onClick={() => removeLog(log.id)} className="p-3 bg-slate-800 border border-slate-700 text-slate-300 hover:text-rose-500 rounded-2xl transition-all shadow-md lg:opacity-0 group-hover:opacity-100">
                           <Trash2 size={20} />
                        </button>
                     </div>
                  </div>
                  <div className="flex gap-8">
                     <div className="flex flex-col"><span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Protein</span><span className="text-lg font-black text-slate-100">{log.protein.toFixed(1)}g</span></div>
                     <div className="flex flex-col"><span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Carbs</span><span className="text-lg font-black text-slate-100">{log.carbs.toFixed(1)}g</span></div>
                     <div className="flex flex-col"><span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Fats</span><span className="text-lg font-black text-slate-100">{log.fats.toFixed(1)}g</span></div>
                  </div>
                  {calibratingId === log.id && (
                     <div className="mt-6 pt-6 border-t border-slate-800 space-y-8 animate-in slide-in-from-top-2">
                        <div className="space-y-4">
                           <p className="text-[11px] font-black text-[#fb923c] uppercase tracking-[0.25em] flex items-center gap-2">
                             <Edit3 size={14} /> Precision Macro Correction
                           </p>
                           <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Protein</p>
                                 <div className="relative">
                                    <input type="number" step="0.1" value={log.protein} onChange={(e) => updateLogMacrosAbsolute(log.id, 'protein', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 pr-10 text-sm font-black text-slate-100 focus:border-[#fb923c]/60 outline-none transition-all shadow-inner" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 pointer-events-none">G</span>
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Carbs</p>
                                 <div className="relative">
                                    <input type="number" step="0.1" value={log.carbs} onChange={(e) => updateLogMacrosAbsolute(log.id, 'carbs', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 pr-10 text-sm font-black text-slate-100 focus:border-[#fb923c]/60 outline-none transition-all shadow-inner" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 pointer-events-none">G</span>
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fats</p>
                                 <div className="relative">
                                    <input type="number" step="0.1" value={log.fats} onChange={(e) => updateLogMacrosAbsolute(log.id, 'fats', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 pr-10 text-sm font-black text-slate-100 focus:border-[#fb923c]/60 outline-none transition-all shadow-inner" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 pointer-events-none">G</span>
                                 </div>
                              </div>
                           </div>
                           <p className="text-[10px] text-slate-400 font-bold italic px-1">Total synthesis ({log.calories.toFixed(1)} kcal) auto-calibrated from gram vectors.</p>
                        </div>
                        <div className="space-y-4 pt-2 border-t border-slate-800/50">
                           <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Volumetric Scale Factor</p>
                           <div className="flex gap-3">
                              {[0.5, 0.75, 1.25, 1.5, 2.0].map(factor => (
                                 <button key={factor} onClick={() => { updateLogMacros(log.id, factor); setCalibratingId(null); }} className="flex-1 py-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-black text-slate-300 hover:bg-[#fb923c] hover:text-slate-950 transition-all shadow-sm">x{factor}</button>
                              ))}
                           </div>
                        </div>
                        <button onClick={() => setCalibratingId(null)} className="w-full py-5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-black rounded-[1.5rem] transition-all uppercase tracking-[0.3em] text-[10px] flex items-center justify-center gap-3 border border-slate-700"><X size={16} /> Close Calibration</button>
                     </div>
                  )}
               </div>
            )) : (
               <div className="py-24 flex flex-col items-center justify-center text-center opacity-20 border-2 border-dashed border-slate-800 rounded-[3rem]">
                  <Coffee size={56} className="mb-6" />
                  <p className="text-sm font-black uppercase tracking-widest text-slate-400">Metabolic Stream Empty</p>
                  <p className="text-xs mt-3 font-bold italic text-slate-500">Synthesize your first meal protocol above.</p>
               </div>
            )}
         </div>
      </div>

      {/* Historical Archives */}
      {historicalDays.length > 0 && (
        <div className="space-y-4 pt-6">
           <h3 className="text-standard-label text-slate-300 px-2 flex items-center gap-3">
              <Calendar size={18} className="text-[#fb923c]/60" />
              <span>Historical Archives</span>
           </h3>
           <div className="space-y-4">
              {historicalDays.map((day) => (
                <div key={day.date} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden transition-all shadow-xl">
                   <button onClick={() => setExpandedDate(expandedDate === day.date ? null : day.date)} className="w-full text-left p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 group">
                      <div className="flex items-center gap-5">
                         <div className="p-3 bg-slate-800 border border-slate-700 rounded-2xl text-slate-400 group-hover:text-[#fb923c] group-hover:border-[#fb923c]/30 transition-all shadow-md"><Calendar size={22} /></div>
                         <div>
                            <h5 className="text-lg font-black text-slate-100 tracking-tight">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</h5>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">{day.totals.calories} kcal • {day.logs.length} events logged</p>
                         </div>
                      </div>
                      <div className="flex gap-6 items-center">
                         <div className="flex gap-5 border-l border-slate-800 pl-6">
                            <div className="flex flex-col items-center"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">P</span><span className="text-sm font-black text-slate-200">{day.totals.protein}g</span></div>
                            <div className="flex flex-col items-center"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">C</span><span className="text-sm font-black text-slate-200">{day.totals.carbs}g</span></div>
                            <div className="flex flex-col items-center"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">F</span><span className="text-sm font-black text-slate-200">{day.totals.fats}g</span></div>
                         </div>
                         {expandedDate === day.date ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
                      </div>
                   </button>
                   {expandedDate === day.date && (
                     <div className="px-6 pb-6 space-y-3 animate-in slide-in-from-top-2">
                        {day.logs.map(log => (
                           <div key={log.id} className="flex justify-between items-center p-4 bg-slate-950 border border-slate-800 rounded-2xl shadow-inner">
                              <span className="text-sm font-black text-slate-100 uppercase tracking-tight">{log.name}</span>
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{log.calories} kcal</span>
                           </div>
                        ))}
                     </div>
                   )}
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default FuelDepot;