import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Activity, Weight, Droplets, Calendar, Save, TrendingUp, Sparkles, ArrowLeft, BarChart3, Ruler, Zap, Info, Wand2, Loader2, Check, Heart, Anchor, ArrowDown, ArrowUp, Shield, History, List, AlertCircle, Trash2, Plus, ArrowRight, Maximize2, Minimize2, RotateCcw, Bot } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BiometricEntry, UserSettings, HistoricalLog, FuelLog, FuelProfile } from '../types';
import { GeminiService } from '../services/geminiService';

interface BiometricsLabProps {
  history: BiometricEntry[];
  onSave: (history: BiometricEntry[]) => void;
  onClose: () => void;
  userSettings: UserSettings;
  inline?: boolean;
  workoutHistory?: HistoricalLog[];
  fuelHistory?: FuelLog[];
  fuelProfile?: FuelProfile;
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
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-1">
        <span>Developing</span>
        <span>Peak Density</span>
      </div>
      <div className="relative h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-600 via-emerald-500 via-cyan-400 via-indigo-500 to-rose-500 opacity-90"></div>
        <div 
          className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_12px_white] transition-all duration-1000 ease-out z-20" 
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
        ></div>
      </div>
    </div>
  );
};

const QuotientSpectrum: React.FC<{ value: number }> = ({ value }) => {
  const percentage = Math.min(100, Math.max(0, value));
  
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-1">
        <span>Stalled</span>
        <span>Optimized Flow</span>
      </div>
      <div className="relative h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-amber-400 via-emerald-500 to-indigo-600 opacity-90"></div>
        <div 
          className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_12px_white] transition-all duration-1000 ease-out z-20" 
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
        ></div>
      </div>
    </div>
  );
};

const WtHRSpectrum: React.FC<{ value: number }> = ({ value }) => {
  const min = 0.35;
  const max = 0.65;
  const percentage = 100 - Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-1">
        <span>Increased Risk</span>
        <span>Peak Lean</span>
      </div>
      <div className="relative h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-amber-400 via-emerald-500 via-emerald-400 to-indigo-500 opacity-90"></div>
        <div 
          className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_12px_white] transition-all duration-1000 ease-out z-20" 
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
        ></div>
      </div>
    </div>
  );
};

const WCRSpectrum: React.FC<{ value: number }> = ({ value }) => {
  const min = 0.6;
  const max = 1.1;
  const percentage = 100 - Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-1">
        <span>Foundation</span>
        <span>Aesthetic Peak</span>
      </div>
      <div className="relative h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-600 via-cyan-500 via-emerald-400 to-amber-400 opacity-90"></div>
        <div 
          className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_12px_white] transition-all duration-1000 ease-out z-20" 
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
        ></div>
      </div>
    </div>
  );
};

const BiometricsLab: React.FC<BiometricsLabProps> = ({ history, onSave, onClose, userSettings, inline = false, workoutHistory = [], fuelHistory = [], fuelProfile }) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  });
  const [inputWeight, setInputWeight] = useState<string>('');
  const [inputBodyFat, setInputBodyFat] = useState<string>('');
  const [inputHeight, setInputHeight] = useState<string>('');
  const [inputWaist, setInputWaist] = useState<string>('');
  const [inputChest, setInputChest] = useState<string>('');
  const [inputNeck, setInputNeck] = useState<string>('');
  const [inputHips, setInputHips] = useState<string>('');
  const [isEntryMode, setIsEntryMode] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [chartRange, setChartRange] = useState<'1M' | '3M' | '6M' | 'ALL'>('3M');
  const [activeDiagnostic, setActiveDiagnostic] = useState<string | null>(null);
  
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
      setInputChest(existing.chest?.toString() ?? '');
      setInputNeck(existing.neck?.toString() ?? '');
      setInputHips(existing.hips?.toString() ?? '');
    } else {
      setInputWeight('');
      setInputBodyFat(latestEntry?.bodyFat?.toString() ?? '');
      setInputHeight(latestEntry?.height?.toString() ?? '');
      setInputWaist(latestEntry?.waist?.toString() ?? '');
      setInputChest(latestEntry?.chest?.toString() ?? '');
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
      chest: inputChest ? parseFloat(inputChest) : undefined,
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
        setSelectedDate(res.date ?? selectedDate);
        setInputWeight(res.weight?.toString() ?? '');
        setInputBodyFat(res.bodyFat?.toString() ?? '');
        setInputHeight(res.height?.toString() ?? '');
        setInputWaist(res.waist?.toString() ?? '');
        setInputChest(res.chest?.toString() ?? '');
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
    const now = new Date();
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
      if (wthr < 0.43) wthrStatus = "Extremely Lean Range"; 
      else if (wthr <= 0.5) wthrStatus = "Healthy/Ideal Index"; 
      else if (wthr <= 0.53) wthrStatus = "Increased Metabolic Risk"; 
      else wthrStatus = "High Metabolic Stress Range";
    }

    let wcr = null, wcrStatus = "";
    if (latestEntry?.waist && latestEntry?.chest) {
      wcr = latestEntry.waist / latestEntry.chest;
      if (wcr > 0.95) wcrStatus = "Developing Foundation";
      else if (wcr > 0.85) wcrStatus = "Athletic Proportions";
      else if (wcr > 0.75) wcrStatus = "Advanced V-Taper";
      else wcrStatus = "Elite Aesthetic Peak";
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

    let ironFlowQuotient = null;
    let quotientLabel = "Analysis Pending";
    if (workoutHistory.length > 0 && fuelHistory.length > 0 && fuelProfile) {
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(now.getDate() - 7);
      const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(now.getDate() - 14);

      const getVol = (start: Date, end: Date) => workoutHistory.filter(h => {
        const d = new Date(h.date); return d >= start && d <= end;
      }).reduce((sum, h) => sum + (h.unit === 'lbs' ? h.weight * 0.453592 : h.weight) * h.reps, 0);
      
      const vol1 = getVol(sevenDaysAgo, now);
      const vol2 = getVol(fourteenDaysAgo, sevenDaysAgo);
      const volProg = vol2 > 0 ? (vol1 / vol2) : (vol1 > 0 ? 1.1 : 1.0);
      const volScore = Math.min(1, Math.max(0, (volProg - 0.7) / 0.5));

      const birthDate = userSettings.dateOfBirth ? new Date(userSettings.dateOfBirth) : null;
      let userAge = 30;
      if (birthDate && !isNaN(birthDate.getTime())) {
        userAge = now.getFullYear() - birthDate.getFullYear();
      }
      
      const latestKg = latestEntry.unit === 'lbs' ? latestEntry.weight * 0.453592 : latestEntry.weight;
      const bmr = (10 * latestKg) + (6.25 * (latestEntry.height || 175)) - (5 * userAge) + (userSettings.gender === 'female' ? -161 : 5);
      let multiplier = fuelProfile.goal === 'Build Muscle' ? 1.55 : (fuelProfile.goal === 'Lose Fat' ? 1.4 : 1.375);
      const tdee = bmr * multiplier * (fuelProfile.targetMultiplier || 1.0);
      
      const weeklyFuel = fuelHistory.filter(f => new Date(f.date) >= sevenDaysAgo);
      const dailyTotals: Record<string, number> = {};
      weeklyFuel.forEach(f => { dailyTotals[f.date] = (dailyTotals[f.date] || 0) + f.calories; });
      const deviations = Object.values(dailyTotals).map(val => Math.abs(val - tdee) / (tdee || 1));
      const avgDev = deviations.length > 0 ? deviations.reduce((a, b) => a + b, 0) / deviations.length : 0.5;
      const adherenceScore = Math.max(0, 1 - avgDev);

      const entry7d = sortedHistory.find(h => new Date(h.date) >= sevenDaysAgo) || sortedHistory[0];
      const fatChange = (latestEntry.bodyFat != null && entry7d.bodyFat != null) 
        ? (latestKg * (latestEntry.bodyFat / 100)) - ((entry7d.unit === 'lbs' ? entry7d.weight * 0.453592 : entry7d.weight) * (entry7d.bodyFat / 100))
        : 0;
      const responseScore = 1 / (Math.max(0, fatChange) + 1);

      ironFlowQuotient = ((volScore * 0.4) + (adherenceScore * 0.3) + (responseScore * 0.3)) * 100;
      
      if (ironFlowQuotient > 85) quotientLabel = "Peak Physiological Flow";
      else if (ironFlowQuotient > 70) quotientLabel = "Stable Adaptation";
      else if (ironFlowQuotient > 40) quotientLabel = "Inconsistent Adherence";
      else quotientLabel = "Stagnant/Regressive State";
    }

    return { leanDelta, fatDelta, wthr, wthrStatus, wcr, wcrStatus, navyBF, bfDiscrepancy, confidenceLevel, ffmi, ffmiStatus, ironFlowQuotient, quotientLabel };
  }, [sortedHistory, latestEntry, userSettings.gender, userSettings.units, workoutHistory, fuelHistory, fuelProfile, userSettings.dateOfBirth]);

  const chartData = useMemo(() => {
    const now = new Date();
    const rangeMsMap = { '1M': 30, '3M': 90, '6M': 180, 'ALL': 9999 };
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - rangeMsMap[chartRange]);

    return sortedHistory
      .filter(h => new Date(h.date) >= cutoffDate)
      .map(h => ({
        date: h.date,
        weight: h.weight,
        bodyFat: h.bodyFat || null,
        navyBF: (h.height && h.waist && h.neck) ? calculateNavyBF(userSettings.gender, h.height, h.waist, h.neck, h.hips) : null,
        leanMass: h.bodyFat != null ? parseFloat(((h.unit === 'lbs' ? h.weight : h.weight) * (1 - h.bodyFat / 100)).toFixed(1)) : null
      }));
  }, [sortedHistory, userSettings.gender, chartRange]);

  const renderChart = (isZoomedView: boolean = false) => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} strokeOpacity={0.2} />
        <XAxis 
          dataKey="date" 
          stroke="#94a3b8" 
          fontSize={isZoomedView ? 13 : 11} 
          tickFormatter={(v) => v.split('-').slice(1).join('/')} 
          axisLine={false} 
          tickLine={false} 
          fontWeight={800}
        />
        <YAxis 
          yAxisId="left" 
          stroke="#06b6d4" 
          fontSize={isZoomedView ? 11 : 9} 
          axisLine={false} 
          tickLine={false} 
          domain={[0, 'dataMax + 100']}
          fontWeight={900}
        />
        <YAxis 
          yAxisId="right" 
          stroke="#10b981" 
          fontSize={isZoomedView ? 11 : 9} 
          axisLine={false} 
          tickLine={false} 
          orientation="right" 
          domain={[0, 'dataMax + 15']}
          fontWeight={900}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#0f172a', 
            border: '1px solid #475569', 
            borderRadius: '16px', 
            fontSize: isZoomedView ? '13px' : '11px',
            fontWeight: 700
          }} 
        />
        <Legend wrapperStyle={{ fontSize: isZoomedView ? '13px' : '11px', paddingTop: '15px', fontWeight: 900, textTransform: 'uppercase' }} />
        <Line 
          yAxisId="left" 
          name={`Weight`} 
          type="monotone" 
          dataKey="weight" 
          stroke="#06b6d4" 
          strokeWidth={isZoomedView ? 5 : 3} 
          dot={{ fill: '#06b6d4', r: isZoomedView ? 6 : 4 }} 
        />
        <Line 
          yAxisId="right" 
          name="Body Fat %" 
          type="monotone" 
          dataKey="bodyFat" 
          stroke="#10b981" 
          strokeWidth={isZoomedView ? 5 : 3} 
          dot={{ fill: '#10b981', r: isZoomedView ? 6 : 4 }} 
        />
        <Line 
          yAxisId="right" 
          name="Navy BF %" 
          type="monotone" 
          dataKey="navyBF" 
          stroke="#475569" 
          strokeWidth={isZoomedView ? 3 : 2} 
          strokeDasharray="5 5"
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  const getDiagnosticContent = (id: string) => {
    if (!summaryStats) return { title: '', meaning: '', advice: '' };

    switch(id) {
      case 'quotient':
        const q = summaryStats.ironFlowQuotient || 0;
        return {
          title: "Efficiency Index",
          meaning: "The IronFlow Quotient is a composite metric (40/30/30) measuring: (1) Training Momentum - volume growth vs. previous week; (2) Metabolic Precision - adherence to TDEE targets; and (3) Biological Response - adipose mass stability over a 14-day window.",
          advice: q > 85 
            ? "Peak synergy. Your training volume is rising while nutrition remains locked to your metabolic needs. Maintain this rhythm to maximize adaptation."
            : q > 60
            ? "Moderate synergy. To improve, ensure training volume isn't stalling and tighten caloric adherence. Small nutritional deviations are dampening your score."
            : "Synergy breakdown. Prioritize consistency: ensure weekly volume is stable and match caloric intake closer to TDEE. Divergence in either sector is regressing your flow."
        };
      case 'ffmi':
        const f = summaryStats.ffmi || 0;
        return {
          title: "FFMI Analysis",
          meaning: "Fat-Free Mass Index (FFMI) is a normalized measure of muscle density relative to height. It is derived by dividing your lean mass (weight - fat mass) by your height squared, with a correction factor for stature.",
          advice: f > 22
            ? "Elite mass density identified. You are approaching high-level development. Focus on micro-loading and neural efficiency to break through plateaus."
            : f > 18
            ? "Advanced athletic build. To improve, maintain a slight caloric surplus and prioritize progressive overload in the 6-12 rep range."
            : "Foundational build. You have significant growth potential. Focus on high-tension compound movements and ensuring adequate protein intake (2g/kg)."
        };
      case 'wthr':
        const w = summaryStats.wthr || 0.5;
        return {
          title: "Metabolic Index",
          meaning: "Waist-to-Height Ratio (WtHR) is a primary indicator of visceral adipose distribution and metabolic health. It is calculated by dividing waist circumference by total height.",
          advice: w < 0.46
            ? "Peak metabolic efficiency. Your visceral fat levels are optimal. You can safely focus on mass-building protocols without metabolic restriction."
            : w < 0.51
            ? "Healthy range. To improve, implement consistent daily activity (10k+ steps) and ensure your caloric intake doesn't exceed your TDEE for extended periods."
            : "Elevated metabolic stress. Prioritize a moderate caloric deficit and increase low-intensity steady-state activity to reduce central adiposity."
        };
      case 'wcr':
        const c = summaryStats.wcr || 0.8;
        return {
          title: "Aesthetic Ratio",
          meaning: "Waist-to-Chest Ratio (WCR) measures your structural V-taper. It is derived by dividing waist circumference by chest circumference, reflecting upper-body frame development.",
          advice: c < 0.78
            ? "Superior geometric taper. To further enhance this, focus on medial deltoid peaks and latissimus width while maintaining a tight waist."
            : c < 0.88
            ? "Taper is maturing. Focus on widening the upper sector (lat pulldowns, lateral raises) to reduce the ratio and sharpen the silhouette."
            : "Foundational frame building. Prioritize heavy rowing and pulling movements to build the back width necessary for a distinctive V-taper."
        };
      default:
        return { title: '', meaning: '', advice: '' };
    }
  };

  const DiagnosticBubble = ({ id }: { id: string }) => {
    if (activeDiagnostic !== id) return null;
    const { title, meaning, advice } = getDiagnosticContent(id);
    return (
      <div className="absolute inset-0 z-[60] bg-slate-900/98 backdrop-blur-xl border-2 border-cyan-500/40 rounded-[2.5rem] p-8 flex flex-col justify-center animate-in zoom-in-95 duration-200 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h5 className="text-[12px] font-black text-cyan-400 uppercase tracking-[0.25em]">{title}</h5>
          <button onClick={(e) => { e.stopPropagation(); setActiveDiagnostic(null); }} className="p-2 text-slate-400 hover:text-slate-100 border border-slate-800 rounded-xl transition-all"><X size={16}/></button>
        </div>
        <div className="space-y-6">
          <p className="text-[13px] text-slate-100 font-bold leading-relaxed">
            <span className="text-slate-400 font-black uppercase text-[10px] block mb-1 tracking-widest">Architect's Context:</span>
            {meaning}
          </p>
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
            <p className="text-[13px] text-emerald-400 font-bold leading-relaxed italic">
              <span className="text-emerald-500/60 font-black uppercase text-[9px] block not-italic mb-1 tracking-widest">Protocol Optimization:</span>
              {advice}
            </p>
          </div>
        </div>
        <div className="mt-6 text-center">
          <button onClick={(e) => { e.stopPropagation(); setActiveDiagnostic(null); }} className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] hover:text-cyan-400 transition-colors">Tap to Close Analysis</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Evolution Visualizer Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex-1">
            <h3 className="text-xl font-black text-slate-100 flex items-center gap-3 uppercase tracking-tight">
              <TrendingUp className="text-cyan-400" size={24} />
              Evolution Visualizer
            </h3>
            <div className="flex gap-2 mt-2">
              {['1M', '3M', '6M', 'ALL'].map(r => (
                <button 
                  key={r} 
                  onClick={() => setChartRange(r as any)} 
                  className={`text-[9px] font-black px-3 py-1 rounded-md transition-all uppercase tracking-widest border ${chartRange === r ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleZoom} 
              className="p-3 bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 rounded-xl transition-all shadow-md"
              title="Full Screen View"
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>

        <div className="h-72 w-full">
          {renderChart()}
        </div>
      </div>

      {/* Zoom Overlay */}
      {isZoomed && (
        <div className="fixed inset-0 z-[210] bg-slate-950 flex flex-col pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] animate-in fade-in duration-300">
          <div className="flex justify-between items-center p-6 sm:p-10 shrink-0">
            <div>
              <h3 className="text-3xl font-black text-slate-100 tracking-tight uppercase">Biometric Evolution</h3>
              <div className="flex gap-2 mt-3">
                {['1M', '3M', '6M', 'ALL'].map(r => (
                  <button 
                    key={r} 
                    onClick={() => setChartRange(r as any)} 
                    className={`text-[10px] font-black px-4 py-1.5 rounded-md transition-all uppercase tracking-widest border ${chartRange === r ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={toggleZoom} className="p-5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-rose-400 rounded-[2rem] transition-all shadow-2xl">
              <Minimize2 size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col p-6 sm:p-10 min-h-0">
            <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-[3rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
                 <Activity size={500} />
              </div>
              {renderChart(true)}
            </div>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 px-4">
              <div className="flex gap-10">
                <div className="flex flex-col"><span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Data Points</span><span className="text-lg font-black text-slate-100">{chartData.length} Indices</span></div>
                {summaryStats?.leanDelta != null && (
                  <div className="flex flex-col"><span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Net Adaptation</span><span className={`text-lg font-black ${summaryStats.leanDelta > 0 ? 'text-emerald-400' : 'text-slate-200'}`}>{summaryStats.leanDelta > 0 ? '+' : ''}{summaryStats.leanDelta}{weightUnit} LBM</span></div>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] sm:hidden animate-pulse">
                <RotateCcw size={14} /> Rotate for precision
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Insights */}
      {summaryStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Structural Balance Card */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] space-y-6 relative overflow-hidden min-h-[440px] shadow-xl">
            <DiagnosticBubble id="quotient" />
            <DiagnosticBubble id="ffmi" />
            <DiagnosticBubble id="wthr" />
            <DiagnosticBubble id="wcr" />

            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Structural Balance</h4>
                <p className="text-xl font-black text-slate-100 tracking-tight uppercase">Dimensional Indices</p>
              </div>
              <div className="p-2.5 bg-cyan-500/20 rounded-xl text-cyan-400 border border-cyan-500/20 shadow-sm"><BarChart3 size={18} /></div>
            </div>

            {/* IronFlow Quotient Section (Efficiency Index) */}
            <div className={`space-y-3 cursor-pointer group/item transition-all p-3 -m-3 rounded-2xl ${activeDiagnostic === 'quotient' ? 'bg-indigo-500/20 border border-indigo-500/20' : 'hover:bg-slate-800/50'}`} onClick={() => setActiveDiagnostic('quotient')}>
              <div className="flex justify-between items-end">
                <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] group-hover/item:text-indigo-300 transition-colors">Protocol Efficiency</span>
                <span className="text-base font-black text-slate-100">{summaryStats.ironFlowQuotient ? Math.round(summaryStats.ironFlowQuotient) : '---'}</span>
              </div>
              <QuotientSpectrum value={summaryStats.ironFlowQuotient || 0} />
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight italic">{summaryStats.quotientLabel}</p>
            </div>

            <div className="h-px bg-slate-800"></div>

            {/* FFMI Section */}
            <div className={`space-y-3 cursor-pointer group/item transition-all p-3 -m-3 rounded-2xl ${activeDiagnostic === 'ffmi' ? 'bg-cyan-500/20 border border-cyan-500/20' : 'hover:bg-slate-800/50'}`} onClick={() => setActiveDiagnostic('ffmi')}>
              <div className="flex justify-between items-end">
                <span className="text-[11px] font-black text-slate-200 uppercase tracking-[0.2em] group-hover/item:text-cyan-400 transition-colors">FFMI (Lean Density)</span>
                <span className="text-base font-black text-slate-100">{summaryStats.ffmi ? summaryStats.ffmi.toFixed(1) : '---'}</span>
              </div>
              <FFMISpectrum value={summaryStats.ffmi || 14} />
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight italic">{summaryStats.ffmiStatus}</p>
            </div>

            <div className="h-px bg-slate-800"></div>

            {/* WtHR Section */}
            <div className={`space-y-3 cursor-pointer group/item transition-all p-3 -m-3 rounded-2xl ${activeDiagnostic === 'wthr' ? 'bg-emerald-500/20 border border-emerald-500/20' : 'hover:bg-slate-800/50'}`} onClick={() => setActiveDiagnostic('wthr')}>
              <div className="flex justify-between items-end">
                <span className="text-[11px] font-black text-slate-200 uppercase tracking-[0.2em] group-hover/item:text-emerald-400 transition-colors">Metabolic Risk (WtHR)</span>
                <span className="text-base font-black text-slate-100">{summaryStats.wthr ? summaryStats.wthr.toFixed(3) : '---'}</span>
              </div>
              <WtHRSpectrum value={summaryStats.wthr || 0.5} />
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight italic">{summaryStats.wthrStatus || "Dimensional data pending"}</p>
            </div>

            <div className="h-px bg-slate-800"></div>

            {/* WCR Section */}
            <div className={`space-y-3 cursor-pointer group/item transition-all p-3 -m-3 rounded-2xl ${activeDiagnostic === 'wcr' ? 'bg-amber-500/20 border border-amber-500/20' : 'hover:bg-slate-800/50'}`} onClick={() => setActiveDiagnostic('wcr')}>
              <div className="flex justify-between items-end">
                <span className="text-[11px] font-black text-slate-200 uppercase tracking-[0.2em] group-hover/item:text-amber-400 transition-colors">Aesthetic Ratio (WCR)</span>
                <span className="text-base font-black text-slate-100">{summaryStats.wcr ? summaryStats.wcr.toFixed(3) : '---'}</span>
              </div>
              <WCRSpectrum value={summaryStats.wcr || 0.8} />
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight italic">{summaryStats.wcrStatus || "Incomplete metrics"}</p>
            </div>
            
            <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none opacity-40">
               <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em]">Tap indices for diagnostic report</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] space-y-6 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">30-Day Evolution</h4>
                <p className="text-xl font-black text-slate-100 tracking-tight uppercase">Adaptation Metrics</p>
              </div>
              <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/20 shadow-sm"><Sparkles size={20} /></div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 p-5 bg-slate-950 border border-slate-800/50 rounded-3xl shadow-inner">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Lean Tissue</p>
                <p className={`text-2xl font-black ${summaryStats.leanDelta != null && summaryStats.leanDelta > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>{summaryStats.leanDelta != null ? `${summaryStats.leanDelta > 0 ? '+' : ''}${summaryStats.leanDelta}${weightUnit}` : '---'}</p>
              </div>
              <div className="flex-1 p-5 bg-slate-950 border border-slate-800/50 rounded-3xl shadow-inner">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Adipose Mass</p>
                <p className={`text-2xl font-black ${summaryStats.fatDelta != null && summaryStats.fatDelta < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>{summaryStats.fatDelta != null ? `${summaryStats.fatDelta > 0 ? '+' : ''}${summaryStats.fatDelta}${weightUnit}` : '---'}</p>
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
          className="w-full py-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-cyan-500/50 transition-all group shadow-xl"
        >
          <div className="p-5 bg-slate-800 border border-slate-700 rounded-full text-slate-500 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-all shadow-md">
            <Plus size={36} />
          </div>
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] group-hover:text-slate-200 transition-colors">Register New Indices</span>
        </button>
      ) : aiInputMode ? (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-100 flex items-center gap-4 uppercase tracking-tight">
                 <Wand2 className="text-cyan-400" />
                 Narrative Protocol
              </h3>
              <button onClick={() => setAiInputMode(false)} className="p-3 bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 rounded-2xl transition-all shadow-sm"><X size={20}/></button>
           </div>
           <div className="relative">
              <textarea 
                 value={aiPrompt}
                 onChange={(e) => setAiPrompt(e.target.value)}
                 placeholder="Describe readings: '82.5kg, 14.2% BF. Chest 102cm, Waist 88cm...'"
                 className="w-full h-40 bg-slate-950 border border-slate-800 rounded-[2rem] p-6 text-base text-slate-100 font-bold focus:ring-1 focus:ring-cyan-500/40 outline-none resize-none transition-all placeholder:text-slate-800 shadow-inner leading-relaxed"
              />
              <button 
                 onClick={handleAiParse}
                 disabled={isParsing || !aiPrompt.trim()}
                 className="absolute bottom-6 right-6 p-5 bg-cyan-500 text-slate-950 rounded-2xl shadow-2xl shadow-cyan-500/40 active:scale-95 transition-all disabled:opacity-50"
              >
                 {isParsing ? <Loader2 className="animate-spin" size={24} /> : <ArrowRight size={24} />}
              </button>
           </div>
        </div>
      ) : (
        <div ref={entryFormRef} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 space-y-8">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
              <div className="flex gap-3 w-full sm:w-auto">
                 <button onClick={() => setAiInputMode(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-3 bg-slate-800 text-slate-200 hover:text-cyan-400 rounded-xl transition-all border border-slate-700 text-[11px] font-black uppercase tracking-widest shadow-md"><Wand2 size={16}/> Narrative</button>
                 <button onClick={() => setIsEntryMode(false)} className="flex-1 sm:flex-none px-6 py-3 bg-slate-800 text-slate-500 hover:text-rose-400 rounded-xl transition-all border border-slate-700 text-[11px] font-black uppercase tracking-widest shadow-md">Cancel</button>
              </div>
              <button onClick={saveEntry} className="w-full sm:w-auto px-10 py-4 bg-cyan-500 text-slate-950 font-black rounded-xl text-sm uppercase tracking-[0.2em] shadow-xl shadow-cyan-500/30 active:scale-95 transition-all">Commit Indices</button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                 <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3 ml-1"><Calendar size={14} className="text-cyan-400" /> Chronology</label>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-slate-100 font-black text-lg focus:ring-1 focus:ring-emerald-500/40 outline-none shadow-inner" />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3 ml-1"><Weight size={14} className="text-cyan-400" /> Structural Mass ({weightUnit})</label>
                    <input type="number" step="0.1" value={inputWeight} onChange={(e) => setInputWeight(e.target.value)} placeholder="0.0" className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-slate-100 font-black text-2xl focus:ring-1 focus:ring-cyan-500/40 outline-none placeholder:text-slate-900 shadow-inner" />
                 </div>
                 <div className="space-y-3">
                    <div className="flex justify-between items-center ml-1">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3"><Droplets size={14} className="text-cyan-400" /> Adiposity (%)</label>
                    </div>
                    <input type="number" step="0.1" value={inputBodyFat} onChange={(e) => setInputBodyFat(e.target.value)} placeholder="0.0" className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-slate-100 font-black text-2xl focus:ring-1 focus:ring-cyan-500/40 outline-none placeholder:text-slate-900 shadow-inner transition-all" />
                 </div>
              </div>

              <div className="space-y-8">
                 <div className="p-6 bg-slate-950/50 rounded-[2rem] border border-slate-800 space-y-6 shadow-inner">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3 border-b border-slate-800 pb-4"><Ruler size={14} className="text-cyan-400" /> Anthropometry (CM)</h4>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Stature</p>
                          <input type="number" step="0.1" value={inputHeight} onChange={(e) => setInputHeight(e.target.value)} placeholder="HT" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-base font-black text-slate-100 outline-none shadow-sm focus:border-cyan-500/30" />
                       </div>
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Neck</p>
                          <input type="number" step="0.1" value={inputNeck} onChange={(e) => setInputNeck(e.target.value)} placeholder="NK" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-base font-black text-slate-100 outline-none shadow-sm focus:border-cyan-500/30" />
                       </div>
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Waist</p>
                          <input type="number" step="0.1" value={inputWaist} onChange={(e) => setInputWaist(e.target.value)} placeholder="WS" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-base font-black text-slate-100 outline-none shadow-sm focus:border-cyan-500/30" />
                       </div>
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Chest</p>
                          <input type="number" step="0.1" value={inputChest} onChange={(e) => setInputChest(e.target.value)} placeholder="CH" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-base font-black text-slate-100 outline-none shadow-sm focus:border-cyan-500/30" />
                       </div>
                    </div>
                    <div className="mt-4 pt-6 border-t border-slate-800 flex items-center justify-between">
                       <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Navy Protocol BF%</p>
                       <p className="text-2xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">{calculateNavyBF(userSettings.gender, parseFloat(inputHeight), parseFloat(inputWaist), parseFloat(inputNeck), parseFloat(inputHips)) || '---'}%</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* History Feed */}
      <div className="space-y-4">
         <h3 className="text-standard-label text-slate-300 px-2 flex items-center justify-between">
            <span>Historical Index</span>
            <span className="text-cyan-400/70">{history.length} Registers</span>
         </h3>
         <div className="space-y-3">
            {sortedHistory.length > 0 ? sortedHistory.slice().reverse().map(entry => (
               <div key={entry.date} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition-all group flex items-center justify-between shadow-xl">
                  <div className="flex items-center gap-8">
                     <div className="flex flex-col"><span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{entry.date}</span><span className="text-xl font-black text-slate-100">{entry.weight}{entry.unit === 'lbs' ? 'lb' : 'kg'}</span></div>
                     {entry.bodyFat != null && <div className="flex flex-col border-l-2 border-slate-800 pl-8"><span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Adiposity</span><span className="text-xl font-black text-emerald-400">{entry.bodyFat}%</span></div>}
                  </div>
                  <div className="flex gap-3">
                     <button 
                       onClick={() => {
                         setSelectedDate(entry.date);
                         setIsEntryMode(true);
                       }} 
                       className="p-3.5 bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-700 rounded-2xl transition-all shadow-md"
                       title="Edit Indices"
                     >
                       <History size={20} />
                     </button>
                     <button onClick={() => onSave(history.filter(h => h.date !== entry.date))} className="p-3.5 bg-slate-800 text-slate-300 hover:text-rose-500 border border-slate-700 rounded-2xl transition-all shadow-md lg:opacity-0 group-hover:opacity-100"><Trash2 size={20} /></button>
                  </div>
               </div>
            )) : (
               <div className="py-24 flex flex-col items-center justify-center text-center opacity-20 border-2 border-dashed border-slate-800 rounded-[3rem]">
                  <Activity size={56} className="mb-6" />
                  <p className="text-sm font-black uppercase tracking-widest text-slate-400">No Registered Indices</p>
                  <p className="text-xs mt-3 font-bold italic text-slate-500">Register your first biometric record above.</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default BiometricsLab;