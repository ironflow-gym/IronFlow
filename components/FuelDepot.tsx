import React, { useState, useMemo, useEffect } from 'react';
import { Coffee, Flame, Zap, Shield, Send, Loader2, Sparkles, Wand2, Plus, X, ChevronRight, ArrowRight, Bot, Target, Heart, Info, History, Trash2, Sliders, ChevronDown, ChevronUp, Save, Edit3, Calendar } from 'lucide-react';
import { FuelLog, FuelProfile, BiometricEntry, UserSettings } from '../types';
import { GeminiService } from '../services/geminiService';
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
    const cached = localStorage.getItem(`ironflow_pantry_${prompt.toLowerCase().trim()}`);
    if (cached) {
      try {
        const cachedLogs = JSON.parse(cached).map((l: any) => ({ ...l, id: Math.random().toString(36).substr(2, 9), date: todayStr }));
        onSaveFuel([...history, ...cachedLogs]);
        setPrompt('');
        return;
      } catch (e) {}
    }
    setIsSynthesizing(true);
    try {
      const result = await aiService.parseFuelPrompt(prompt, profile);
      onSaveFuel([...history, ...result.logs]);
      if (result.updatedProfile) onSaveProfile({ ...profile, ...result.updatedProfile });
      localStorage.setItem(`ironflow_pantry_${prompt.toLowerCase().trim()}`, JSON.stringify(result.logs));
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
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider px-1">
        <span className="text-slate-500 truncate mr-2">{label}</span>
        <span className="text-slate-300 shrink-0">{current.toFixed(1)}{unit} / {target.toFixed(1)}{unit}</span>
      </div>
      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
        <div 
          className="h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(251,146,60,0.1)]" 
          style={{ width: `${Math.min(100, (current / target) * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Target Insights Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-xl relative overflow-hidden">
         <div className="absolute -right-4 -top-4 opacity-5 rotate-12"><Zap size={120} /></div>
         <div className="flex flex-col sm:flex-row items-center gap-8 relative z-10">
            <div className="relative w-40 h-40 shrink-0">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={ringData} cx="50%" cy="50%" innerRadius={55} outerRadius={70} paddingAngle={0} dataKey="value" startAngle={90} endAngle={-270}>
                        {ringData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                     </Pie>
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Left</p>
                  <h3 className="text-3xl font-black text-slate-100">{(Math.max(0, estimatedTDEE - totals.calories)).toFixed(1)}</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kcal</p>
               </div>
            </div>
            <div className="flex-1 w-full space-y-5">
               <div>
                  <h4 className="text-sm font-black text-slate-100 uppercase tracking-[0.2em] mb-1">Metabolic Balance</h4>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Today's Synthesis Snapshot</p>
               </div>
               <div className="space-y-4">
                  <MacroBar label="Tissue Repair (P)" current={totals.protein} target={targetProtein} color="#fb923c" />
                  <MacroBar label="Kinematic Fuel (C)" current={totals.carbs} target={targetCarbs} color="#f97316" />
                  <MacroBar label="Hormonal Anchor (F)" current={totals.fats} target={targetFats} color="#ea580c" />
               </div>
            </div>
         </div>
      </div>

      {/* Profile Manifesto */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg">
         <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-full flex items-center justify-between group">
            <div className="flex items-center gap-4">
               <div className="p-2.5 bg-[#fb923c]/10 rounded-xl text-[#fb923c]"><Bot size={20} /></div>
               <div className="text-left">
                  <h4 className="text-[11px] font-black text-slate-100 uppercase tracking-widest">Dietary Manifesto</h4>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
                    {profile.goal} • {profile.region ? `${profile.region} • ` : ''}{profile.preferences.length > 0 ? profile.preferences.join(', ') : 'No special restrictions'}
                  </p>
               </div>
            </div>
            {isProfileOpen ? <ChevronUp size={18} className="text-slate-600" /> : <ChevronDown size={18} className="text-slate-600" />}
         </button>
         {isProfileOpen && (
           <div className="mt-6 pt-6 border-t border-slate-800 space-y-5 animate-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Protein Load</p>
                    <p className="text-sm font-black text-slate-200">{profile.targetProteinRatio.toFixed(1)}g / kg</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Target Multiplier</p>
                    <p className={`text-sm font-black ${multiplier !== 1 ? 'text-[#fb923c]' : 'text-slate-200'}`}>
                      {multiplier.toFixed(2)}x {multiplier !== 1 ? `(${multiplier > 1 ? '+' : ''}${Math.round((multiplier - 1) * 100)}%)` : ''}
                    </p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Body Weight</p>
                    <p className="text-sm font-black text-slate-200">{latestWeight.toFixed(1)}kg (Ref: Biometrics)</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Calculated Age</p>
                    <p className="text-sm font-black text-slate-200">{userAge} Years</p>
                 </div>
              </div>
              <p className="text-xs text-slate-500 italic leading-relaxed">Update by typing into the Fuel Depot below. E.g., "Decrease target by 5%", "My goal is to Build Muscle", or "I'm currently in Australia".</p>
           </div>
         )}
      </div>

      {/* Synthesis Input */}
      <div className="bg-slate-950 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl relative">
         <h4 className="text-xs font-black text-slate-100 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-[#fb923c]" /> Narrative Synthesis
         </h4>
         <div className="relative">
            <textarea 
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               placeholder="Describe your meal naturally or adjust targets... 'Large oat milk latte' or 'Decrease daily target by 5%'"
               className="w-full h-56 bg-slate-900 border border-slate-800 rounded-[2rem] p-6 text-sm text-slate-100 placeholder:text-slate-700 focus:ring-1 focus:ring-[#fb923c]/30 outline-none resize-none transition-all leading-relaxed"
            />
            <button 
               onClick={handleSynthesize}
               disabled={isSynthesizing || !prompt.trim()}
               className="absolute bottom-6 right-6 p-5 bg-[#fb923c] text-slate-950 rounded-2xl shadow-xl shadow-[#fb923c]/20 active:scale-95 transition-all disabled:opacity-50"
            >
               {isSynthesizing ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}
            </button>
         </div>
         {isSynthesizing && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-[#fb923c]/5 border border-[#fb923c]/10 rounded-xl ai-loading-pulse">
               <Bot size={14} className="text-[#fb923c]" />
               <span className="text-[10px] font-black uppercase tracking-widest text-[#fb923c]/80">Calculating Volumetric Macros...</span>
            </div>
         )}
      </div>

      {/* Intake Timeline */}
      <div className="space-y-4">
         <h3 className="text-standard-label text-slate-500 px-2 flex items-center justify-between">
            <span>Daily Narrative</span>
            <span className="text-[#fb923c]/50">{todayLogs.length} Events</span>
         </h3>
         <div className="space-y-3">
            {todayLogs.length > 0 ? todayLogs.map((log) => (
               <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition-all group shadow-md">
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex-1">
                        <h5 className="text-lg font-black text-slate-100 tracking-tight">{log.name}</h5>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">{log.calories.toFixed(1)} kcal • Confidence {Math.round(log.confidence * 100)}%</p>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => setCalibratingId(calibratingId === log.id ? null : log.id)} className="p-2.5 bg-slate-800 text-slate-500 hover:text-[#fb923c] rounded-xl transition-all">
                           <Sliders size={18} />
                        </button>
                        <button onClick={() => removeLog(log.id)} className="p-2.5 bg-slate-800 text-slate-500 hover:text-rose-500 rounded-xl transition-all lg:opacity-0 group-hover:opacity-100">
                           <Trash2 size={18} />
                        </button>
                     </div>
                  </div>
                  <div className="flex gap-6">
                     <div className="flex flex-col"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Protein</span><span className="text-base font-black text-slate-300">{log.protein.toFixed(1)}g</span></div>
                     <div className="flex flex-col"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Carbs</span><span className="text-base font-black text-slate-300">{log.carbs.toFixed(1)}g</span></div>
                     <div className="flex flex-col"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Fats</span><span className="text-base font-black text-slate-300">{log.fats.toFixed(1)}g</span></div>
                  </div>
                  {calibratingId === log.id && (
                     <div className="mt-5 pt-5 border-t border-slate-800 space-y-6 animate-in slide-in-from-top-2">
                        <div className="space-y-3">
                           <p className="text-[10px] font-black text-[#fb923c] uppercase tracking-[0.2em] flex items-center gap-2">
                             <Edit3 size={12} /> Precision Macro Correction
                           </p>
                           <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                 <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Protein</p>
                                 <div className="relative">
                                    <input type="number" step="0.1" value={log.protein} onChange={(e) => updateLogMacrosAbsolute(log.id, 'protein', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-8 text-xs font-black text-slate-100 focus:border-[#fb923c]/50 outline-none transition-all" />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-700 pointer-events-none">G</span>
                                 </div>
                              </div>
                              <div className="space-y-1.5">
                                 <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Carbs</p>
                                 <div className="relative">
                                    <input type="number" step="0.1" value={log.carbs} onChange={(e) => updateLogMacrosAbsolute(log.id, 'carbs', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-8 text-xs font-black text-slate-100 focus:border-[#fb923c]/50 outline-none transition-all" />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-700 pointer-events-none">G</span>
                                 </div>
                              </div>
                              <div className="space-y-1.5">
                                 <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Fats</p>
                                 <div className="relative">
                                    <input type="number" step="0.1" value={log.fats} onChange={(e) => updateLogMacrosAbsolute(log.id, 'fats', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-8 text-xs font-black text-slate-100 focus:border-[#fb923c]/50 outline-none transition-all" />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-700 pointer-events-none">G</span>
                                 </div>
                              </div>
                           </div>
                           <p className="text-[9px] text-slate-600 italic px-1">Total calories ({log.calories.toFixed(1)}) auto-calibrated from gram inputs.</p>
                        </div>
                        <div className="space-y-3 pt-2 border-t border-slate-800/50">
                           <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Quick Scale Factor</p>
                           <div className="flex gap-2">
                              {[0.5, 0.75, 1.25, 1.5, 2.0].map(factor => (
                                 <button key={factor} onClick={() => { updateLogMacros(log.id, factor); setCalibratingId(null); }} className="flex-1 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-black text-slate-400 hover:bg-[#fb923c] hover:text-slate-950 transition-all">x{factor}</button>
                              ))}
                           </div>
                        </div>
                        <button onClick={() => setCalibratingId(null)} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"><X size={14} /> Dismiss Calibration</button>
                     </div>
                  )}
               </div>
            )) : (
               <div className="py-20 flex flex-col items-center justify-center text-center opacity-20 border-2 border-dashed border-slate-800 rounded-[2.5rem]">
                  <Coffee size={48} className="mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest">No Intake Detected</p>
                  <p className="text-xs mt-2 font-bold italic">Synthesize your first meal above.</p>
               </div>
            )}
         </div>
      </div>

      {/* Historical Archives */}
      {historicalDays.length > 0 && (
        <div className="space-y-4 pt-4">
           <h3 className="text-standard-label text-slate-500 px-2 flex items-center gap-2">
              <Calendar size={14} className="text-[#fb923c]/40" />
              <span>Historical Archives</span>
           </h3>
           <div className="space-y-3">
              {historicalDays.map((day) => (
                <div key={day.date} className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden transition-all shadow-md">
                   <button onClick={() => setExpandedDate(expandedDate === day.date ? null : day.date)} className="w-full text-left p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                      <div className="flex items-center gap-4">
                         <div className="p-2.5 bg-slate-800 rounded-xl text-slate-500 group-hover:text-[#fb923c] transition-colors"><History size={18} /></div>
                         <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Chronology</p><p className="text-sm font-black text-slate-200">{day.date}</p></div>
                      </div>
                      <div className="flex gap-4 sm:gap-6 flex-wrap">
                         <div className="flex flex-col"><span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">P</span><span className="text-xs font-black text-slate-400">{day.totals.protein}g</span></div>
                         <div className="flex flex-col"><span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">C</span><span className="text-xs font-black text-slate-400">{day.totals.carbs}g</span></div>
                         <div className="flex flex-col"><span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">F</span><span className="text-xs font-black text-slate-400">{day.totals.fats}g</span></div>
                         <div className="flex flex-col border-l border-slate-800 pl-4 sm:pl-6"><span className="text-[8px] font-black text-[#fb923c]/60 uppercase tracking-[0.2em]">Kcal</span><span className="text-xs font-black text-[#fb923c]">{day.totals.calories}</span></div>
                         <div className="flex items-center ml-2">{expandedDate === day.date ? <ChevronUp size={16} className="text-slate-600" /> : <ChevronDown size={16} className="text-slate-600" />}</div>
                      </div>
                   </button>
                   {expandedDate === day.date && (
                     <div className="px-5 pb-5 space-y-2 animate-in slide-in-from-top-2 duration-300">
                        <div className="h-px bg-slate-800 mb-4" />
                        {day.logs.map((log) => (
                           <div key={log.id} className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60 flex justify-between items-center">
                              <div className="min-w-0"><p className="text-sm font-black text-slate-300 truncate">{log.name}</p><p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">{log.calories.toFixed(0)} kcal</p></div>
                              <div className="flex gap-3 shrink-0 ml-4">
                                 <span className="text-[9px] font-black text-slate-500 uppercase">{log.protein.toFixed(0)}p</span>
                                 <span className="text-[9px] font-black text-slate-500 uppercase">{log.carbs.toFixed(0)}c</span>
                                 <span className="text-[9px] font-black text-slate-500 uppercase">{log.fats.toFixed(0)}f</span>
                              </div>
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