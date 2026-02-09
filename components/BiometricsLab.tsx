import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Activity, Weight, Droplets, Calendar, Save, TrendingUp, Sparkles, ArrowLeft, BarChart3, Ruler, Zap, Info, Wand2, Loader2, Check, Heart, Anchor, ArrowDown, ArrowUp, Shield, History, List, AlertCircle, Trash2, Plus, ArrowRight, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BiometricEntry, UserSettings } from '../types';
import { GeminiService } from '../services/geminiService';

interface BiometricsLabProps {
  history: BiometricEntry[];
  onSave: (history: BiometricEntry[]) => void;
  onClose: () => void;
  userSettings: UserSettings;
  inline?: boolean;
}

const calculateNavyBF = (
  gender: 'male' | 'female' | undefined,
  height: number, // cm
  waist: number,  // cm
  neck: number,   // cm
  hips?: number   // cm
) => {
  if (!height || !waist || !neck) return null;
  if (gender === 'female') {
    if (!hips) return null;
    const result = 495 / (1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.22100 * Math.log10(height)) - 450;
    return parseFloat(result.toFixed(1));
  } else {
    const result = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
    return parseFloat(result.toFixed(1));
  }
};

const FFMISpectrum: React.FC<{ value: number }> = ({ value }) => {
  const min = 14;
  const max = 28;
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">
        <span>Developing</span>
        <span>Peak Architecture</span>
      </div>
      <div className="relative h-3 w-full bg-slate-800 rounded-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-600 via-emerald-500 via-cyan-400 via-indigo-500 to-rose-500 opacity-80"></div>
        <div 
          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white] transition-all duration-1000 ease-out" 
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
        ></div>
      </div>
    </div>
  );
};

const BiometricsLab: React.FC<BiometricsLabProps> = ({ history, onSave, onClose, userSettings, inline = false }) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  });
  const [inputWeight, setInputWeight] = useState<string>('');
  const [inputBodyFat, setInputBodyFat] = useState<string>('');
  const [inputHeight, setInputHeight] = useState<string>('');
  const [inputWaist, setInputWaist] = useState<string>('');
  const [inputNeck, setInputNeck] = useState<string>('');
  const [inputHips, setInputHips] = useState<string>('');
  const [isEntryMode, setIsEntryMode] = useState(false);
  const [bfSource, setBfSource] = useState<'manual' | 'navy'>('navy');
  const [isZoomed, setIsZoomed] = useState(false);
  
  const [aiInputMode, setAiInputMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const aiService = useRef(new GeminiService());
  const entryFormRef = useRef<HTMLDivElement>(null);

  const weightUnit = userSettings.units === 'metric' ? 'kg' : 'lb';

  useEffect(() => {
    const handlePopState = () => setIsZoomed(false);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isEntryMode && entryFormRef.current) {
      const timeout = setTimeout(() => {
        entryFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [isEntryMode]);

  const toggleZoom = () => {
    if (!isZoomed) {
      window.history.pushState({ zoomed: true }, '');
      setIsZoomed(true);
    } else {
      window.history.back();
    }
  };

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  const latestEntry = sortedHistory[sortedHistory.length - 1];

  const historyByDate = useMemo(() => {
    return history.reduce((acc, curr) => {
      acc[curr.date] = curr;
      return acc;
    }, {} as Record<string, BiometricEntry>);
  }, [history]);

  useEffect(() => {
    const existing = historyByDate[selectedDate];
    if (existing) {
      setInputWeight(existing.weight?.toString() ?? '');
      setInputBodyFat(existing.bodyFat?.toString() ?? '');
      setInputHeight(existing.height?.toString() ?? '');
      setInputWaist(existing.waist?.toString() ?? '');
      setInputNeck(existing.neck?.toString() ?? '');
      setInputHips(existing.hips?.toString() ?? '');
    } else {
      setInputWeight('');
      setInputBodyFat(latestEntry?.bodyFat?.toString() ?? '');
      setInputHeight(latestEntry?.height?.toString() ?? '');
      setInputWaist(latestEntry?.waist?.toString() ?? '');
      setInputNeck(latestEntry?.neck?.toString() ?? '');
      setInputHips(latestEntry?.hips?.toString() ?? '');
    }
  }, [selectedDate, historyByDate, latestEntry]);

  const saveEntry = () => {
    const weight = parseFloat(inputWeight);
    if (isNaN(weight)) return;

    const newEntry: BiometricEntry = {
      date: selectedDate,
      weight: weight,
      bodyFat: inputBodyFat ? parseFloat(inputBodyFat) : undefined,
      height: inputHeight ? parseFloat(inputHeight) : undefined,
      waist: inputWaist ? parseFloat(inputWaist) : undefined,
      neck: inputNeck ? parseFloat(inputNeck) : undefined,
      hips: inputHips ? parseFloat(inputHips) : undefined,
      unit: userSettings.units === 'metric' ? 'kgs' : 'lbs'
    };

    onSave([...history.filter(h => h.date !== selectedDate), newEntry]);
    setIsEntryMode(false);
    setAiInputMode(false);
    setAiPrompt('');
  };

  const handleAiParse = async () => {
    if (!aiPrompt.trim()) return;
    setIsParsing(true);
    try {
      const results = await aiService.current.parseBiometricsPrompt(aiPrompt, userSettings.units === 'metric' ? 'kgs' : 'lbs');
      if (results.length > 0) {
        const res = results[0];
        setSelectedDate(res.date);
        setInputWeight(res.weight?.toString() ?? '');
        setInputBodyFat(res.bodyFat?.toString() ?? '');
        setInputHeight(res.height?.toString() ?? '');
        setInputWaist(res.waist?.toString() ?? '');
        setInputNeck(res.neck?.toString() ?? '');
        setInputHips(res.hips?.toString() ?? '');
        setAiInputMode(false);
        setIsEntryMode(true);
      }
    } catch (e) {
      alert("AI interpretation failed. Try being more direct with values.");
    } finally {
      setIsParsing(false);
    }
  };

  const summaryStats = useMemo(() => {
    if (sortedHistory.length === 0) return null;
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startEntry = sortedHistory.find(h => new Date(h.date) >= thirtyDaysAgo) || sortedHistory[0];
    
    let leanDelta = null, fatDelta = null;
    if (startEntry?.bodyFat != null && latestEntry?.bodyFat != null) {
      const getLean = (e: BiometricEntry) => (e.unit === 'lbs' ? e.weight * 0.453592 : e.weight) * (1 - (e.bodyFat! / 100));
      const getFat = (e: BiometricEntry) => (e.unit === 'lbs' ? e.weight * 0.453592 : e.weight) * (e.bodyFat! / 100);
      leanDelta = parseFloat((getLean(latestEntry) - getLean(startEntry)).toFixed(2));
      fatDelta = parseFloat((getFat(latestEntry) - getFat(startEntry)).toFixed(2));
      if (userSettings.units === 'imperial') { leanDelta = parseFloat((leanDelta * 2.20462).toFixed(2)); fatDelta = parseFloat((fatDelta * 2.20462).toFixed(2)); }
    }

    let wthr = null, wthrStatus = "";
    if (latestEntry?.waist && latestEntry?.height) {
      wthr = latestEntry.waist / latestEntry.height;
      if (wthr < 0.4) wthrStatus = "Underweight Range"; else if (wthr <= 0.5) wthrStatus = "Healthy Range"; else if (wthr <= 0.6) wthrStatus = "Increased Risk"; else wthrStatus = "High Risk";
    }

    let navyBF = null, bfDiscrepancy = null, confidenceLevel = "Standard";
    if (latestEntry?.height && latestEntry?.waist && latestEntry?.neck) {
      navyBF = calculateNavyBF(userSettings.gender, latestEntry.height, latestEntry.waist, latestEntry.neck, latestEntry.hips);
      if (navyBF !== null && latestEntry.bodyFat != null) {
        bfDiscrepancy = Math.abs(navyBF - latestEntry.bodyFat);
        if (bfDiscrepancy < 2) confidenceLevel = "High";
        else if (bfDiscrepancy > 5) confidenceLevel = "Low - Divergent Data";
      }
    }

    let ffmi = null, ffmiStatus = "";
    if (latestEntry?.weight && latestEntry?.height && latestEntry?.bodyFat != null) {
      const weightKg = latestEntry.unit === 'lbs' ? latestEntry.weight * 0.453592 : latestEntry.weight;
      const heightM = latestEntry.height / 100;
      const leanMassKg = weightKg * (1 - (latestEntry.bodyFat / 100));
      ffmi = leanMassKg / (heightM * heightM);
      ffmi = ffmi + 6.1 * (1.8 - heightM);
      
      if (ffmi < 18) ffmiStatus = "Slight Build";
      else if (ffmi < 20) ffmiStatus = "Average Athletic";
      else if (ffmi < 22) ffmiStatus = "Highly Developed";
      else if (ffmi < 25) ffmiStatus = "Near Genetic Limit";
      else ffmiStatus = "Enhanced Baseline / Elite";
    }

    return { leanDelta, fatDelta, wthr, wthrStatus, navyBF, bfDiscrepancy, confidenceLevel, ffmi, ffmiStatus };
  }, [sortedHistory, latestEntry, userSettings.gender, userSettings.units]);

  const chartData = useMemo(() => {
    return sortedHistory.map(h => ({
      date: h.date,
      weight: h.weight,
      bodyFat: h.bodyFat || null,
      leanMass: h.bodyFat != null ? parseFloat(((h.unit === 'lbs' ? h.weight : h.weight) * (1 - h.bodyFat / 100)).toFixed(1)) : null
    }));
  }, [sortedHistory]);

  const renderChart = (isZoomedView: boolean = false) => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis 
          dataKey="date" 
          stroke="#475569" 
          fontSize={isZoomedView ? 12 : 10} 
          tickFormatter={(v) => v.split('-').slice(1).join('/')} 
          axisLine={false} 
          tickLine={false} 
        />
        <YAxis 
          yAxisId="left" 
          stroke="#06b6d4" 
          fontSize={isZoomedView ? 10 : 8} 
          axisLine={false} 
          tickLine={false} 
        />
        <YAxis 
          yAxisId="right" 
          stroke="#10b981" 
          fontSize={isZoomedView ? 10 : 8} 
          axisLine={false} 
          tickLine={false} 
          orientation="right" 
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#0f172a', 
            border: '1px solid #334155', 
            borderRadius: '16px', 
            fontSize: isZoomedView ? '12px' : '10px' 
          }} 
        />
        <Legend wrapperStyle={{ fontSize: isZoomedView ? '12px' : '10px', paddingTop: '10px' }} />
        <Line 
          yAxisId="left" 
          name={`Weight (${weightUnit})`} 
          type="monotone" 
          dataKey="weight" 
          stroke="#06b6d4" 
          strokeWidth={isZoomedView ? 4 : 2} 
          dot={{ fill: '#06b6d4', r: isZoomedView ? 5 : 3 }} 
        />
        <Line 
          yAxisId="right" 
          name="Body Fat %" 
          type="monotone" 
          dataKey="bodyFat" 
          stroke="#10b981" 
          strokeWidth={isZoomedView ? 4 : 2} 
          dot={{ fill: '#10b981', r: isZoomedView ? 5 : 3 }} 
        />
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Evolution Visualizer Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <TrendingUp className="text-cyan-400" size={20} />
              Evolution Visualizer
            </h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Longitudinal Indexing</p>
          </div>
          <button 
            onClick={toggleZoom} 
            className="p-3 bg-slate-800 text-slate-400 hover:text-cyan-400 rounded-xl transition-all border border-slate-700/50"
            title="Full Screen View"
          >
            <Maximize2 size={18} />
          </button>
        </div>

        <div className="h-64 w-full">
          {renderChart()}
        </div>
      </div>

      {/* Zoom Overlay */}
      {isZoomed && (
        <div className="fixed inset-0 z-[210] bg-slate-950 flex flex-col pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] animate-in fade-in duration-300">
          <div className="flex justify-between items-center p-6 sm:p-8 shrink-0">
            <div>
              <h3 className="text-2xl font-black text-slate-100 tracking-tight">Biometric Evolution</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Full-Scale Longitudinal Index</p>
            </div>
            <button onClick={toggleZoom} className="p-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 rounded-[1.5rem] transition-all">
              <Minimize2 size={24} />
            </button>
          </div>
          <div className="flex-1 flex flex-col p-4 sm:p-8 min-h-0">
            <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-[3rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.02] pointer-events-none flex items-center justify-center">
                 <Activity size={400} />
              </div>
              {renderChart(true)}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-4">
              <div className="flex gap-6">
                <div className="flex flex-col"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Data Points</span><span className="text-sm font-black text-slate-300">{sortedHistory.length} Registered Indices</span></div>
                {summaryStats?.leanDelta != null && (
                  <div className="flex flex-col"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Net Adaption</span><span className={`text-sm font-black ${summaryStats.leanDelta > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{summaryStats.leanDelta > 0 ? '+' : ''}{summaryStats.leanDelta}{weightUnit} LBM</span></div>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest sm:hidden animate-pulse">
                <RotateCcw size={12} /> Rotate for detail
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Insights */}
      {summaryStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Structural Balance</h4>
                <p className="text-lg font-black text-slate-100">{summaryStats.ffmi ? summaryStats.ffmi.toFixed(1) : '---'} FFMI</p>
              </div>
              <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400"><BarChart3 size={18} /></div>
            </div>
            <FFMISpectrum value={summaryStats.ffmi || 14} />
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight italic">{summaryStats.ffmiStatus}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">30-Day Tissue Delta</h4>
                <p className="text-lg font-black text-slate-100">Adaptation Metrics</p>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400"><Sparkles size={18} /></div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 p-3 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Lean Mass</p>
                <p className={`text-sm font-black ${summaryStats.leanDelta != null && summaryStats.leanDelta > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{summaryStats.leanDelta != null ? `${summaryStats.leanDelta > 0 ? '+' : ''}${summaryStats.leanDelta}${weightUnit}` : '---'}</p>
              </div>
              <div className="flex-1 p-3 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Fat Mass</p>
                <p className={`text-sm font-black ${summaryStats.fatDelta != null && summaryStats.fatDelta < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{summaryStats.fatDelta != null ? `${summaryStats.fatDelta > 0 ? '+' : ''}${summaryStats.fatDelta}${weightUnit}` : '---'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entry Toggle */}
      {!isEntryMode && !aiInputMode ? (
        <button 
          onClick={() => {
            const now = new Date();
            const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
            setSelectedDate(today);
            setIsEntryMode(true);
          }}
          className="w-full py-6 bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 hover:border-cyan-500/40 transition-all group shadow-xl"
        >
          <div className="p-4 bg-slate-800 rounded-full text-slate-600 group-hover:text-cyan-400 transition-colors">
            <Plus size={32} />
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Register New Indices</span>
        </button>
      ) : aiInputMode ? (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-100 flex items-center gap-3">
                 <Wand2 className="text-cyan-400" />
                 Narrative Entry
              </h3>
              <button onClick={() => setAiInputMode(false)} className="p-2 text-slate-500 hover:text-slate-300 transition-all"><X size={20}/></button>
           </div>
           <div className="relative">
              <textarea 
                 value={aiPrompt}
                 onChange={(e) => setAiPrompt(e.target.value)}
                 placeholder="Describe your readings... 'Weighed 82.5kg today with 14.2% body fat. Waist 88cm, Neck 41cm.'"
                 className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500/30 outline-none resize-none transition-all placeholder:text-slate-800"
              />
              <button 
                 onClick={handleAiParse}
                 disabled={isParsing || !aiPrompt.trim()}
                 className="absolute bottom-4 right-4 p-4 bg-cyan-500 text-slate-950 rounded-2xl shadow-xl shadow-cyan-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                 {isParsing ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
              </button>
           </div>
        </div>
      ) : (
        <div ref={entryFormRef} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 space-y-8">
           <div className="flex justify-between items-center">
              <div className="flex gap-2">
                 <button onClick={() => setAiInputMode(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-400 hover:text-cyan-400 rounded-xl transition-all border border-slate-700/50 text-[10px] font-black uppercase tracking-widest"><Wand2 size={14}/> Narrative</button>
                 <button onClick={() => setIsEntryMode(false)} className="px-4 py-2 bg-slate-800 text-slate-500 hover:text-rose-400 rounded-xl transition-all border border-slate-700/50 text-[10px] font-black uppercase tracking-widest">Cancel</button>
              </div>
              <button onClick={saveEntry} className="px-6 py-3 bg-cyan-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-95 transition-all">Save Indices</button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 ml-1"><Calendar size={12}/> Chronology</label>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-100 font-bold focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 ml-1"><Weight size={12}/> Structural Mass ({weightUnit})</label>
                    <input type="number" step="0.1" value={inputWeight} onChange={(e) => setInputWeight(e.target.value)} placeholder="0.0" className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-100 font-black text-xl focus:ring-1 focus:ring-cyan-500/30 outline-none placeholder:text-slate-900" />
                 </div>
                 <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                       <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Droplets size={12}/> Adiposity (%)</label>
                       <div className="flex p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                          <button onClick={() => setBfSource('manual')} className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-md transition-all ${bfSource === 'manual' ? 'bg-slate-800 text-cyan-400' : 'text-slate-600'}`}>Manual</button>
                          <button onClick={() => setBfSource('navy')} className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-md transition-all ${bfSource === 'navy' ? 'bg-slate-800 text-cyan-400' : 'text-slate-600'}`}>Navy</button>
                       </div>
                    </div>
                    <input type="number" step="0.1" value={inputBodyFat} onChange={(e) => setInputBodyFat(e.target.value)} placeholder="0.0" disabled={bfSource === 'navy'} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-100 font-black text-xl focus:ring-1 focus:ring-cyan-500/30 outline-none placeholder:text-slate-900 disabled:opacity-30 transition-all" />
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Ruler size={12}/> Anthropometry (CM)</h4>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <p className="text-[9px] font-black text-slate-700 uppercase px-1">Stature</p>
                          <input type="number" step="0.1" value={inputHeight} onChange={(e) => setInputHeight(e.target.value)} placeholder="Height" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-300 outline-none" />
                       </div>
                       <div className="space-y-1.5">
                          <p className="text-[9px] font-black text-slate-700 uppercase px-1">Neck</p>
                          <input type="number" step="0.1" value={inputNeck} onChange={(e) => setInputNeck(e.target.value)} placeholder="Neck" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-300 outline-none" />
                       </div>
                       <div className="space-y-1.5">
                          <p className="text-[9px] font-black text-slate-700 uppercase px-1">Waist</p>
                          <input type="number" step="0.1" value={inputWaist} onChange={(e) => setInputWaist(e.target.value)} placeholder="Waist" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-300 outline-none" />
                       </div>
                       {userSettings.gender === 'female' && (
                          <div className="space-y-1.5">
                             <p className="text-[9px] font-black text-slate-700 uppercase px-1">Hips</p>
                             <input type="number" step="0.1" value={inputHips} onChange={(e) => setInputHips(e.target.value)} placeholder="Hips" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-300 outline-none" />
                          </div>
                       )}
                    </div>
                    {bfSource === 'navy' && (
                       <div className="mt-4 pt-4 border-t border-slate-800/50 flex items-center justify-between">
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Calculated Navy BF%</p>
                          <p className="text-xl font-black text-cyan-400">{calculateNavyBF(userSettings.gender, parseFloat(inputHeight), parseFloat(inputWaist), parseFloat(inputNeck), parseFloat(inputHips)) || '---'}%</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* History Feed */}
      <div className="space-y-4">
         <h3 className="text-standard-label text-slate-500 px-2 flex items-center justify-between">
            <span>Historical Index</span>
            <span className="text-cyan-500/50">{history.length} Registers</span>
         </h3>
         <div className="space-y-3">
            {sortedHistory.length > 0 ? sortedHistory.slice().reverse().map(entry => (
               <div key={entry.date} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-slate-700 transition-all group flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-6">
                     <div className="flex flex-col"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{entry.date}</span><span className="text-lg font-black text-slate-100">{entry.weight}{entry.unit === 'lbs' ? 'lb' : 'kg'}</span></div>
                     {entry.bodyFat != null && <div className="flex flex-col border-l border-slate-800 pl-6"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Adiposity</span><span className="text-lg font-black text-emerald-400">{entry.bodyFat}%</span></div>}
                  </div>
                  <div className="flex gap-2">
                     <button 
                       onClick={() => {
                         setSelectedDate(entry.date);
                         setIsEntryMode(true);
                       }} 
                       className="p-3 bg-slate-800 text-slate-400 hover:text-cyan-400 rounded-xl transition-all"
                       title="Edit Indices"
                     >
                       <History size={18} />
                     </button>
                     <button onClick={() => onSave(history.filter(h => h.date !== entry.date))} className="p-3 bg-slate-800 text-slate-400 hover:text-rose-500 rounded-xl transition-all lg:opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                  </div>
               </div>
            )) : (
               <div className="py-20 flex flex-col items-center justify-center text-center opacity-20 border-2 border-dashed border-slate-800 rounded-[2.5rem]">
                  <Activity size={48} className="mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest">No Registered Indices</p>
                  <p className="text-xs mt-2 font-bold italic">Register your first biometric record above.</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default BiometricsLab;