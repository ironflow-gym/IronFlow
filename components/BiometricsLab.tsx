import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Activity, Weight, Droplets, Calendar, Save, TrendingUp, Sparkles, ArrowLeft, BarChart3, Ruler, Zap, Info, Wand2, Loader2, Check, Heart, Anchor, ArrowDown, ArrowUp, Shield, History, List, AlertCircle, Trash2, Plus, ArrowRight, Maximize2, Minimize2, RotateCcw, Bot, ChevronUp, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BiometricEntry, UserSettings, HistoricalLog, FuelLog, FuelProfile } from '../types';
import { GeminiService, GeminiError } from '../services/geminiService';

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

// Each ratio has its own threshold range — normalise against those so both bars
// represent "where am I within my own scale" and are directly comparable visually.
// SWR thresholds: 1.25 | 1.43 | 1.61   (4 zones across the full bar width)
// CWR thresholds: 1.05 | 1.18 | 1.33
// We map: zone-start of Developing → 0%, zone-end of Elite → 100%
// giving each zone an equal 25% band regardless of the raw value range.
const SWR_ZONES = [1.25, 1.43, 1.61]; // boundaries between the 4 zones
const CWR_ZONES = [1.05, 1.18, 1.33];

function zoneNormalisePct(value: number, zoneBoundaries: number[]): number {
  // zoneBoundaries = [z1, z2, z3] dividing the scale into 4 equal bands (0–25–50–75–100%)
  const [z1, z2, z3] = zoneBoundaries;
  const floor = z1 - (z2 - z1); // one zone-width below z1 = 0%
  const ceil  = z3 + (z3 - z2); // one zone-width above z3 = 100%
  return Math.min(100, Math.max(0, ((value - floor) / (ceil - floor)) * 100));
}

const AestheticSpectrum: React.FC<{ cwr: number | null; swr: number | null; isFemale: boolean }> = ({ cwr, swr, isFemale }) => {
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-1">
        <span>Foundation</span>
        <span>Aesthetic Peak</span>
      </div>
      {/* Shoulder / Waist */}
      {swr !== null && (
        <div className="space-y-0.5">
          <p className="text-[8px] font-black text-violet-400/70 uppercase tracking-widest px-1">Shoulder / Waist</p>
          <div className="relative h-2.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-600 via-violet-500 via-cyan-400 to-amber-400 opacity-80" />
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-all duration-1000 ease-out z-20"
              style={{ left: `${zoneNormalisePct(swr, SWR_ZONES)}%`, transform: 'translateX(-50%)' }}
            />
          </div>
        </div>
      )}
      {/* Chest / Waist */}
      {cwr !== null && (
        <div className="space-y-0.5">
          <p className="text-[8px] font-black text-amber-400/70 uppercase tracking-widest px-1">Chest / Waist</p>
          <div className="relative h-2.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-600 via-cyan-500 via-emerald-400 to-amber-400 opacity-80" />
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-all duration-1000 ease-out z-20"
              style={{ left: `${zoneNormalisePct(cwr, CWR_ZONES)}%`, transform: 'translateX(-50%)' }}
            />
          </div>
        </div>
      )}
      {cwr === null && swr === null && (
        <div className="relative h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-600 via-cyan-500 to-amber-400 opacity-50" />
        </div>
      )}
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
  const [inputShoulders, setInputShoulders] = useState<string>('');
  const [isEntryMode, setIsEntryMode] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [chartRange, setChartRange] = useState<'1M' | '3M' | '6M' | 'ALL'>('3M');
  const [activeDiagnostic, setActiveDiagnostic] = useState<string | null>(null);
  // null = default (latest month open), '__none__' = all collapsed, else specific month key
  const [bioExpandedMonth, setBioExpandedMonth] = useState<string | null>(null);
  
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
      setInputShoulders(existing.shoulders?.toString() ?? '');
      setInputNeck(existing.neck?.toString() ?? '');
      setInputHips(existing.hips?.toString() ?? '');
    } else {
      setInputWeight('');
      setInputBodyFat(latestEntry?.bodyFat?.toString() ?? '');
      setInputHeight(latestEntry?.height?.toString() ?? '');
      setInputWaist(latestEntry?.waist?.toString() ?? '');
      setInputChest(latestEntry?.chest?.toString() ?? '');
      setInputShoulders(latestEntry?.shoulders?.toString() ?? '');
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
      shoulders: inputShoulders ? parseFloat(inputShoulders) : undefined,
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
        setInputShoulders(res.shoulders?.toString() ?? '');
        setInputNeck(res.neck?.toString() ?? '');
        setInputHips(res.hips?.toString() ?? '');
        setAiInputMode(false);
        setIsEntryMode(true);
      }
    } catch (e) {
      alert(e instanceof GeminiError ? e.userMessage : "AI interpretation failed. Try being more direct with values.");
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

    const isFemale = userSettings.gender === 'female';
    // CWR: chest / waist (males only — not meaningful for females)
    let cwr = null, cwrStatus = "";
    if (!isFemale && latestEntry?.waist && latestEntry?.chest) {
      cwr = latestEntry.chest / latestEntry.waist;
      if (cwr < 1.05) cwrStatus = "Developing Foundation";
      else if (cwr < 1.18) cwrStatus = "Athletic Proportions";
      else if (cwr < 1.33) cwrStatus = "Advanced V-Taper";
      else cwrStatus = "Elite Aesthetic Peak";
    }
    // SWR: shoulders / waist
    let swr = null, swrStatus = "";
    if (latestEntry?.waist && latestEntry?.shoulders) {
      swr = latestEntry.shoulders / latestEntry.waist;
      if (swr < 1.25) swrStatus = "Developing Foundation";
      else if (swr < 1.43) swrStatus = "Athletic Proportions";
      else if (swr < 1.61) swrStatus = "Advanced V-Taper";
      else swrStatus = "Elite Aesthetic Peak";
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

    // =========================================================================
    // IronFlow Quotient v2 — three components, graceful degradation
    // =========================================================================
    let ironFlowQuotient: number | null = null;
    let quotientLabel = "Analysis Pending";
    let quotientMode: 'full' | 'partial-no-fuel' | 'partial-no-biometric' | 'minimal' | 'calibrating' = 'minimal';
    let windowConfidence = 0;
    // Component scores hoisted so they can be returned and used in diagnostic advice
    let consistencyScore = 0;
    let precisionScore = 0.5;
    let adaptationScore = 0.5;
    let hasFuelData = false;
    let hasBiometricTrend = false;

    if (workoutHistory.length > 0) {
      const toKg = (e: BiometricEntry) => e.unit === 'lbs' ? e.weight * 0.453592 : e.weight;

      // -----------------------------------------------------------------------
      // Component 1 — Training Consistency Score (35%)
      // Frequency over last 28 days vs personal 12-week baseline.
      // Resilient to deloads: a lighter week still logs sessions.
      // Confidence-aware: sparse windows produce provisional/calibrating scores
      // rather than misleadingly low scores for new or returning users.
      // -----------------------------------------------------------------------
      const CONSISTENCY_WINDOW = 28;
      const BASELINE_WINDOW = 84; // 12 weeks
      const consistencyStart = new Date(); consistencyStart.setDate(now.getDate() - CONSISTENCY_WINDOW);
      const baselineStart = new Date(); baselineStart.setDate(now.getDate() - BASELINE_WINDOW);

      const recentDays = new Set(
        workoutHistory
          .filter(h => new Date(h.date) >= consistencyStart)
          .map(h => h.date)
      ).size;

      const baselineDays = new Set(
        workoutHistory
          .filter(h => new Date(h.date) >= baselineStart && new Date(h.date) < consistencyStart)
          .map(h => h.date)
      ).size;

      const recentFreq = recentDays / (CONSISTENCY_WINDOW / 7);   // sessions/week
      const baselineFreq = baselineDays / ((BASELINE_WINDOW - CONSISTENCY_WINDOW) / 7);

      // Confidence: how much signal is in the recent window relative to expectations?
      // - With baseline: ratio of actual sessions to predicted sessions this window.
      //   A returning user after a break has a baseline but low recent data → low confidence.
      //   A genuinely lazy established user has adequate recent data → confidence holds,
      //   score is low because they earned it.
      // - Without baseline (new user): ramp confidence up as sessions accumulate.
      //   6 sessions = full confidence, <3 = calibrating.
      const expectedRecentSessions = baselineFreq > 0 ? baselineFreq * (CONSISTENCY_WINDOW / 7) : 12;
      windowConfidence = baselineFreq > 0
        ? Math.min(1, recentDays / Math.max(1, expectedRecentSessions * 0.5))
        : Math.min(1, recentDays / 6);

      // If no baseline yet, target 3 sessions/week as a sensible absolute floor
      consistencyScore = baselineFreq > 0
        ? Math.min(1, recentFreq / baselineFreq)
        : Math.min(1, recentFreq / 3);

      // -----------------------------------------------------------------------
      // Component 2 — Metabolic Precision Score (30%)
      // Adherence to a goal-adjusted caloric target, not always TDEE.
      // A user correctly executing a deficit should not be penalised.
      // Only computable when fuel data is present.
      // -----------------------------------------------------------------------
      precisionScore = 0.5; // neutral default

      if (fuelHistory.length > 0 && fuelProfile && latestEntry) {
        hasFuelData = true;

        const birthDate = userSettings.dateOfBirth ? new Date(userSettings.dateOfBirth) : null;
        let userAge = 30;
        if (birthDate && !isNaN(birthDate.getTime())) {
          userAge = now.getFullYear() - birthDate.getFullYear();
        }

        const latestKg = toKg(latestEntry);

        // Height: search all history descending for most recent entry with a
        // recorded value — mirrors FuelDepot's latestHeight useMemo.
        const heightCm = [...history]
          .sort((a, b) => b.date.localeCompare(a.date))
          .find(e => e.height != null)?.height ?? 175;

        const bmr = (10 * latestKg) + (6.25 * heightCm) - (5 * userAge) + (userSettings.gender === 'female' ? -161 : 5);
        // targetMultiplier is a calorie fine-tune applied after goal adjustment —
        // identical to FuelDepot so IQ precision score uses the same caloric target.
        const activityMultiplier = fuelProfile.goal === 'Build Muscle' ? 1.55 : (fuelProfile.goal === 'Lose Fat' ? 1.4 : 1.375);
        const baseTdee = bmr * activityMultiplier;

        // Goal-adjusted caloric target — identical formula to FuelDepot:
        // +300 kcal lean-bulk surplus, -500 kcal deficit, then user fine-tune multiplier.
        const caloricTarget = (fuelProfile.goal === 'Build Muscle'
          ? baseTdee + 300
          : fuelProfile.goal === 'Lose Fat'
          ? baseTdee - 500
          : baseTdee) * (fuelProfile.targetMultiplier || 1.0);



        const precisionWindowStart = new Date(); precisionWindowStart.setDate(now.getDate() - 7);
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        // Exclude today — a partial day's entries are not a meaningful caloric data point
        // and would drag the precision score down for any user who hasn't finished logging.
        const weeklyFuel = fuelHistory.filter(f => new Date(f.date) >= precisionWindowStart && f.date < todayStr);
        const dailyTotals: Record<string, number> = {};
        weeklyFuel.forEach(f => { dailyTotals[f.date] = (dailyTotals[f.date] || 0) + f.calories; });

        const CALORIC_TOLERANCE = 0.10; // 10% band — real food isn't exact
        const deviations = Object.values(dailyTotals).map(val =>
          Math.abs(val - caloricTarget) / (caloricTarget || 1)
        );
        const avgDev = deviations.length > 0
          ? deviations.reduce((a, b) => a + b, 0) / deviations.length
          : 0.5;
        precisionScore = Math.max(0, 1 - Math.max(0, avgDev - CALORIC_TOLERANCE) / 0.4);
      }

      // -----------------------------------------------------------------------
      // Component 3 — Adaptation Alignment Score (35%)
      // Goal-aware, symmetric. Rewards fat + lean movement in the right
      // direction for the goal over 28 days (less noise than 7 days).
      // -----------------------------------------------------------------------
      adaptationScore = 0.5; // neutral default

      const ADAPTATION_WINDOW = 28;
      const adaptationCutoff = new Date(); adaptationCutoff.setDate(now.getDate() - ADAPTATION_WINDOW);
      const olderEntry = [...sortedHistory].reverse().find(h => new Date(h.date) <= adaptationCutoff);

      if (latestEntry && olderEntry && latestEntry.date !== olderEntry.date) {
        hasBiometricTrend = true;

        const recentKg = toKg(latestEntry);
        const olderKg = toKg(olderEntry);

        if (latestEntry.bodyFat != null && olderEntry.bodyFat != null) {
          // Full calculation with body fat data
          const recentLean = recentKg * (1 - latestEntry.bodyFat / 100);
          const olderLean = olderKg * (1 - olderEntry.bodyFat / 100);
          const recentFat = recentKg * (latestEntry.bodyFat / 100);
          const olderFat = olderKg * (olderEntry.bodyFat / 100);

          const fatDeltaKg = recentFat - olderFat;    // negative = fat lost
          const leanDeltaKg = recentLean - olderLean; // positive = muscle gained

          if (fuelProfile?.goal === 'Build Muscle') {
            // Reward lean mass gain, mildly penalise excessive fat gain (>1.5kg/month)
            const leanScore = Math.min(1, Math.max(0, (leanDeltaKg + 0.5) / 1.5));
            const fatPenalty = fatDeltaKg > 1.5 ? Math.min(0.3, (fatDeltaKg - 1.5) * 0.1) : 0;
            adaptationScore = Math.max(0, leanScore - fatPenalty);
          } else if (fuelProfile?.goal === 'Lose Fat') {
            // Reward fat loss, penalise lean mass loss (muscle wasting)
            const fatScore = Math.min(1, Math.max(0, (-fatDeltaKg + 0.2) / 1.5));
            const leanPenalty = leanDeltaKg < -0.5 ? Math.min(0.4, Math.abs(leanDeltaKg + 0.5) * 0.2) : 0;
            adaptationScore = Math.max(0, fatScore - leanPenalty);
          } else {
            // Maintenance: penalise drift in either direction
            const totalDrift = Math.abs(fatDeltaKg) + Math.abs(Math.min(0, leanDeltaKg));
            adaptationScore = Math.max(0, 1 - totalDrift / 2);
          }
        } else {
          // Fallback: weight-only delta aligned to goal
          const weightDeltaKg = recentKg - olderKg;
          if (fuelProfile?.goal === 'Build Muscle') {
            // Slight gain is good, stasis is neutral, loss is bad
            adaptationScore = Math.min(1, Math.max(0, (weightDeltaKg + 0.5) / 1.5));
          } else if (fuelProfile?.goal === 'Lose Fat') {
            // Loss is good, gain is bad
            adaptationScore = Math.min(1, Math.max(0, (-weightDeltaKg + 0.5) / 2));
          } else {
            // Maintenance: penalise any drift
            adaptationScore = Math.max(0, 1 - Math.abs(weightDeltaKg) / 1.5);
          }
        }
      }

      // -----------------------------------------------------------------------
      // Composite — weights adjust based on what data is available.
      // Confidence gate: if the recent window is too sparse to be meaningful,
      // suppress the number entirely and show 'Calibrating' instead of a
      // misleadingly low score. Threshold is 0.4 — below this the window
      // has less than half the expected signal.
      // -----------------------------------------------------------------------
      if (windowConfidence < 0.4) {
        // Not enough data in the recent window to produce a meaningful score.
        // ironFlowQuotient stays null — UI shows '---' and 'Calibrating'.
        quotientMode = 'calibrating';
        quotientLabel = 'Calibrating';
      } else {
        if (hasFuelData && hasBiometricTrend) {
          ironFlowQuotient = ((consistencyScore * 0.35) + (precisionScore * 0.30) + (adaptationScore * 0.35)) * 100;
          quotientMode = 'full';
        } else if (!hasFuelData && hasBiometricTrend) {
          ironFlowQuotient = ((consistencyScore * 0.50) + (adaptationScore * 0.50)) * 100;
          quotientMode = 'partial-no-fuel';
        } else if (hasFuelData && !hasBiometricTrend) {
          ironFlowQuotient = ((consistencyScore * 0.55) + (precisionScore * 0.45)) * 100;
          quotientMode = 'partial-no-biometric';
        } else {
          // Minimal mode: consistency only. Apply a floor of 35 so a user
          // with windowConfidence 0.4–0.7 (provisional range) doesn't get
          // labelled 'Stagnant' purely from a sparse window.
          const rawMinimal = consistencyScore * 100;
          ironFlowQuotient = windowConfidence < 0.7 ? Math.max(35, rawMinimal) : rawMinimal;
          quotientMode = 'minimal';
        }

        if (ironFlowQuotient !== null) {
          if (ironFlowQuotient >= 90) quotientLabel = "Peak Flow";
          else if (ironFlowQuotient >= 75) quotientLabel = "Strong Adaptation";
          else if (ironFlowQuotient >= 55) quotientLabel = "Developing Consistency";
          else if (ironFlowQuotient >= 35) quotientLabel = "Misaligned Inputs";
          else quotientLabel = "Stagnant";
          // Provisional badge: enough data to score but window is not fully populated
          if (windowConfidence < 0.7 && quotientMode === 'minimal') quotientLabel += " (Provisional)";
        }
      }
    }

    return { leanDelta, fatDelta, wthr, wthrStatus, cwr, cwrStatus, swr, swrStatus, isFemale, navyBF, bfDiscrepancy, confidenceLevel, ffmi, ffmiStatus, ironFlowQuotient, quotientLabel, quotientMode, windowConfidence, consistencyScore, precisionScore, adaptationScore, hasFuelData, hasBiometricTrend };
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
        const qMode = summaryStats.quotientMode;
        const cs = summaryStats.consistencyScore;
        const ps = summaryStats.precisionScore;
        const as_ = summaryStats.adaptationScore;
        const modeNote = qMode === 'calibrating'
          ? " Not enough recent session data to produce a reliable score. Keep training — the IQ will activate once your recent window has sufficient signal. This prevents a sparse window from generating a misleadingly low result."
          : qMode === 'partial-no-fuel'
          ? " Score computed from training consistency and biometric response — enable fuel tracking for full precision."
          : qMode === 'partial-no-biometric'
          ? " Score computed from training consistency and nutrition adherence — log more biometric entries for full precision."
          : qMode === 'minimal'
          ? " Score computed from training consistency only — log biometrics and fuel for full precision."
          : "";

        // Build component-specific advice lines based on actual sub-scores
        const buildAdvice = () => {
          if (qMode === 'calibrating') {
            return "Keep training consistently. The IFQ will activate and reflect your real performance once the recent window has enough signal.";
          }

          const pct = (v: number) => `${Math.round(v * 100)}%`;
          const lines: string[] = [];

          // Identify the weakest components to lead with
          const components: { name: string; score: number; available: boolean }[] = [
            { name: 'consistency', score: cs, available: true },
            { name: 'precision',   score: ps, available: summaryStats.hasFuelData },
            { name: 'adaptation',  score: as_, available: summaryStats.hasBiometricTrend },
          ].filter(c => c.available);

          const sorted = [...components].sort((a, b) => a.score - b.score);
          const weakest = sorted[0];
          const strongest = sorted[sorted.length - 1];

          // Overall framing
          if (q >= 90) {
            lines.push(`All active components are locked in — consistency ${pct(cs)}${summaryStats.hasFuelData ? `, precision ${pct(ps)}` : ''}${summaryStats.hasBiometricTrend ? `, adaptation ${pct(as_)}` : ''}. The main risk now is complacency — ensure progressive overload is still being applied.`);
            return lines.join(' ');
          }

          // Score each component
          if (summaryStats.hasFuelData || summaryStats.hasBiometricTrend) {
            lines.push(`Component breakdown — consistency: ${pct(cs)}${summaryStats.hasFuelData ? `, precision: ${pct(ps)}` : ''}${summaryStats.hasBiometricTrend ? `, adaptation: ${pct(as_)}` : ''}.`);
          }

          // Specific advice for the weakest component
          if (weakest.name === 'consistency') {
            if (cs < 0.5) {
              lines.push(`Training frequency is the primary drag on your score (${pct(cs)}). You are logging sessions well below your established baseline. Prioritise getting back to your normal weekly cadence — even shorter sessions count.`);
            } else if (cs < 0.75) {
              lines.push(`Training consistency is below your baseline (${pct(cs)}). A few missed sessions are pulling this down. Aim to add one more session this week to close the gap.`);
            } else {
              lines.push(`Consistency is reasonable (${pct(cs)}) but has room to improve. Small gaps in your weekly schedule are accumulating — protect your training days.`);
            }
          } else if (weakest.name === 'precision') {
            if (ps < 0.4) {
              lines.push(`Metabolic precision is the weakest component (${pct(ps)}). Your logged calories are averaging more than 20% away from your caloric target across the past week. This level of deviation will slow goal progress regardless of training quality. Review your portion tracking or reassess your target.`);
            } else if (ps < 0.65) {
              lines.push(`Nutrition adherence is inconsistent (${pct(ps)}). Daily caloric totals are swinging more than 10% either side of your target. Anchor one reliable meal per day to pull the average closer.`);
            } else {
              lines.push(`Metabolic precision is slightly off target (${pct(ps)}). Minor daily caloric variance — tightening one meal per day should close this.`);
            }
          } else if (weakest.name === 'adaptation') {
            if (as_ < 0.4) {
              lines.push(`Body composition is moving in the wrong direction for your goal (${pct(as_)}). Over the past 28 days the trend is misaligned — check whether your caloric target reflects your current bodyweight and that training stimulus is sufficient.`);
            } else if (as_ < 0.65) {
              lines.push(`Adaptation alignment is developing (${pct(as_)}). Body composition is moving but slowly relative to your goal. Verify your caloric target is set correctly for your current weight and confirm progressive overload is being applied.`);
            } else {
              lines.push(`Body composition response is on track (${pct(as_)}) but has room to improve. Ensure your biometric entries are recent — an outdated reading can understate real progress.`);
            }
          }

          // If there's a second weak component worth flagging
          if (components.length > 1 && sorted.length > 1 && sorted[1].score < 0.7 && sorted[1].name !== weakest.name) {
            const second = sorted[1];
            if (second.name === 'consistency' && cs < 0.7) {
              lines.push(`Consistency also needs attention (${pct(cs)}) — address frequency alongside the above.`);
            } else if (second.name === 'precision' && ps < 0.7) {
              lines.push(`Nutrition precision is also below target (${pct(ps)}) — tightening daily calories will compound with improvements elsewhere.`);
            } else if (second.name === 'adaptation' && as_ < 0.7) {
              lines.push(`Adaptation is also lagging (${pct(as_)}) — verify biometric entries are up to date and your goal settings reflect current intent.`);
            }
          }

          // Highlight a strong component for context
          if (q < 90 && strongest.score >= 0.85 && components.length > 1) {
            const label = strongest.name === 'consistency' ? 'Training consistency' : strongest.name === 'precision' ? 'Nutrition precision' : 'Body composition adaptation';
            lines.push(`${label} is a clear strength (${pct(strongest.score)}) — build on this.`);
          }

          return lines.join(' ');
        };

        return {
          title: "IronFlow Quotient v2",
          meaning: `A composite index measuring how well your inputs and body response are aligned with your goal. Three components: Training Consistency (35%) — session frequency vs your 12-week baseline over the past 28 days; Metabolic Precision (30%) — adherence to your goal-adjusted caloric target over completed days in the past week; Adaptation Alignment (35%) — whether lean mass and fat mass are moving in the right direction over the past 28 days.${modeNote}`,
          advice: buildAdvice()
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
      case 'cwr': {
        const cVal = summaryStats.cwr;
        const sVal = summaryStats.swr;
        const female = summaryStats.isFemale;

        // Meaning — correct descriptions, each ratio gets its own sentence
        const swrMeaning = sVal !== null
          ? 'Shoulder-to-Waist Ratio (SWR) measures the X-frame — shoulder width relative to waist. A higher ratio means broader shoulders and a more pronounced taper. Available for both males and females.'
          : '';
        const cwrMeaning = (!female && cVal !== null)
          ? 'Chest-to-Waist Ratio (CWR) measures chest development relative to waist, capturing V-taper from the front. Males only — anatomical interpretation differs for females.'
          : '';
        const meaning = [swrMeaning, cwrMeaning].filter(Boolean).join(' ') ||
          'Record shoulder and chest measurements to unlock aesthetic ratio analysis.';

        // Per-ratio advice lines
        const swrAdvice = sVal !== null
          ? sVal >= 1.61
            ? 'SWR is elite — shoulder dominance is pronounced. Focus on medial deltoid detail and maintaining waist tightness.'
            : sVal >= 1.43
            ? 'SWR is advancing. Lateral raises and wide-grip rows will push shoulder circumference further above waist.'
            : 'SWR is developing. Prioritise heavy overhead pressing and lateral raises to build shoulder width relative to waist.'
          : null;
        const cwrAdvice = (!female && cVal !== null)
          ? cVal >= 1.33
            ? 'CWR is elite — strong chest-to-waist differential. Maintain chest development while keeping the waist lean.'
            : cVal >= 1.18
            ? 'CWR is advancing. Incline pressing and flyes will help push chest circumference further above waist.'
            : 'CWR is developing. Focus on upper-chest compound work (incline press) to build the chest-to-waist differential.'
          : null;

        const adviceParts = [swrAdvice, cwrAdvice].filter(Boolean);
        const advice = adviceParts.length > 0
          ? adviceParts.join(' ')
          : 'Log shoulder and chest measurements to receive targeted aesthetic ratio advice.';

        return {
          title: 'Aesthetic Ratios',
          meaning,
          advice
        };
      }
      default:
        return { title: '', meaning: '', advice: '' };
    }
  };

  const DiagnosticBubble = ({ id }: { id: string }) => {
    if (activeDiagnostic !== id) return null;
    const { title, meaning, advice } = getDiagnosticContent(id);
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveDiagnostic(null)}
        />
        {/* Modal panel — centred, max height with scroll */}
        <div className="fixed inset-x-4 top-[10%] z-[80] max-w-lg mx-auto bg-slate-900 border-2 border-cyan-500/40 rounded-[2.5rem] flex flex-col max-h-[80vh] shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center p-8 pb-4 shrink-0 border-b border-slate-800">
            <h5 className="text-[12px] font-black text-cyan-400 uppercase tracking-[0.25em]">{title}</h5>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveDiagnostic(null); }}
              className="p-2 text-slate-400 hover:text-slate-100 border border-slate-800 rounded-xl transition-all"
            >
              <X size={16}/>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
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
          <div className="p-6 pt-2 text-center shrink-0 border-t border-slate-800">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveDiagnostic(null); }}
              className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] hover:text-cyan-400 transition-colors"
            >
              Tap to Close Analysis
            </button>
          </div>
        </div>
      </>
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
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] space-y-6 relative min-h-[440px] shadow-xl">
            <DiagnosticBubble id="quotient" />
            <DiagnosticBubble id="ffmi" />
            <DiagnosticBubble id="wthr" />
            <DiagnosticBubble id="cwr" />

            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Structural Balance</h4>
                <p className="text-xl font-black text-slate-100 tracking-tight uppercase">Dimensional Indices</p>
              </div>
              <div className="p-2.5 bg-cyan-500/20 rounded-xl text-cyan-400 border border-cyan-500/20 shadow-sm"><BarChart3 size={18} /></div>
            </div>

            {/* IronFlow Quotient Section */}
            <div className={`space-y-3 cursor-pointer group/item transition-all p-3 -m-3 rounded-2xl ${activeDiagnostic === 'quotient' ? 'bg-indigo-500/20 border border-indigo-500/20' : 'hover:bg-slate-800/50'}`} onClick={() => setActiveDiagnostic('quotient')}>
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] group-hover/item:text-indigo-300 transition-colors">Protocol Efficiency</span>
                  {summaryStats.quotientMode === 'calibrating' && (
                    <span className="text-[8px] font-black text-amber-500/70 uppercase tracking-widest border border-amber-500/30 px-1.5 py-0.5 rounded-md">Calibrating</span>
                  )}
                  {summaryStats.quotientMode !== 'full' && summaryStats.quotientMode !== 'calibrating' && (
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest border border-slate-700 px-1.5 py-0.5 rounded-md">Partial</span>
                  )}
                </div>
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

            {/* Aesthetic Ratio Section */}
            <div className={`space-y-3 cursor-pointer group/item transition-all p-3 -m-3 rounded-2xl ${activeDiagnostic === 'cwr' ? 'bg-amber-500/20 border border-amber-500/20' : 'hover:bg-slate-800/50'}`} onClick={() => setActiveDiagnostic('cwr')}>
              <div className="flex justify-between items-end">
                <span className="text-[11px] font-black text-slate-200 uppercase tracking-[0.2em] group-hover/item:text-amber-400 transition-colors">Aesthetic Ratios</span>
                <div className="flex flex-col items-end gap-0.5">
                  {summaryStats.swr && <span className="text-[10px] font-black text-violet-300">SWR {summaryStats.swr.toFixed(3)}</span>}
                  {!summaryStats.isFemale && summaryStats.cwr && <span className="text-[10px] font-black text-amber-300">CWR {summaryStats.cwr.toFixed(3)}</span>}
                  {!summaryStats.cwr && !summaryStats.swr && <span className="text-base font-black text-slate-100">---</span>}
                </div>
              </div>
              <AestheticSpectrum cwr={summaryStats.cwr} swr={summaryStats.swr} isFemale={summaryStats.isFemale ?? false} />
              <div className="space-y-0.5">
                {summaryStats.swr != null && summaryStats.swrStatus && (
                  <p className="text-[10px] font-black uppercase tracking-tight italic">
                    <span className="text-violet-400/70">SWR </span>
                    <span className="text-slate-400">{summaryStats.swrStatus}</span>
                  </p>
                )}
                {!summaryStats.isFemale && summaryStats.cwr != null && summaryStats.cwrStatus && (
                  <p className="text-[10px] font-black uppercase tracking-tight italic">
                    <span className="text-amber-400/70">CWR </span>
                    <span className="text-slate-400">{summaryStats.cwrStatus}</span>
                  </p>
                )}
                {summaryStats.swr == null && summaryStats.cwr == null && (
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-tight italic">Incomplete metrics</p>
                )}
              </div>
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
            {summaryStats.leanDelta == null && (
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center pt-1">
                Body fat % required on both the most recent and 30-day reference entries to calculate composition delta
              </p>
            )}
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{userSettings.gender === 'female' ? 'Hips' : 'Chest'}</p>
                          {userSettings.gender === 'female' ? (
                            <input type="number" step="0.1" value={inputHips} onChange={(e) => setInputHips(e.target.value)} placeholder="HP" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-base font-black text-slate-100 outline-none shadow-sm focus:border-cyan-500/30" />
                          ) : (
                            <input type="number" step="0.1" value={inputChest} onChange={(e) => setInputChest(e.target.value)} placeholder="CH" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-base font-black text-slate-100 outline-none shadow-sm focus:border-cyan-500/30" />
                          )}
                       </div>
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Shoulders</p>
                          <input type="number" step="0.1" value={inputShoulders} onChange={(e) => setInputShoulders(e.target.value)} placeholder="SH" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-base font-black text-slate-100 outline-none shadow-sm focus:border-violet-500/30" />
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

      {/* History Feed — grouped by month */}
      <div className="space-y-4">
        <h3 className="text-standard-label text-slate-300 px-2 flex items-center justify-between">
          <span>Historical Index</span>
          <span className="text-cyan-400/70">{history.length} Registers</span>
        </h3>

        {sortedHistory.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center opacity-20 border-2 border-dashed border-slate-800 rounded-[3rem]">
            <Activity size={56} className="mb-6" />
            <p className="text-sm font-black uppercase tracking-widest text-slate-400">No Registered Indices</p>
            <p className="text-xs mt-3 font-bold italic text-slate-500">Register your first biometric record above.</p>
          </div>
        ) : (() => {
          // Group by YYYY-MM, newest first
          const monthMap: Record<string, typeof sortedHistory> = {};
          [...sortedHistory].reverse().forEach(entry => {
            const key = entry.date.slice(0, 7);
            if (!monthMap[key]) monthMap[key] = [];
            monthMap[key].push(entry);
          });
          const months = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));
          const latestMonth = months[0];

          return (
            <div className="space-y-3">
              {months.map(monthKey => {
                const [year, month] = monthKey.split('-');
                const monthLabel = new Date(Number(year), Number(month) - 1, 1)
                  .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                const entries = monthMap[monthKey];
                const isOpen = bioExpandedMonth === monthKey || (bioExpandedMonth === null && monthKey === latestMonth);
                const latestInMonth = entries[0];
                const weightUnit = latestInMonth.unit === 'lbs' ? 'lb' : 'kg';

                return (
                  <div key={monthKey} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                    {/* Month header */}
                    <button
                      onClick={() => setBioExpandedMonth(isOpen ? '__none__' : monthKey)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="text-left">
                        <h4 className="text-sm font-black text-slate-100 uppercase tracking-tight">{monthLabel}</h4>
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5">
                          {entries.length} {entries.length === 1 ? 'entry' : 'entries'} ·
                          {' '}{latestInMonth.weight}{weightUnit}
                          {latestInMonth.bodyFat != null ? ` · ${latestInMonth.bodyFat}% bf` : ''}
                        </p>
                      </div>
                      {isOpen
                        ? <ChevronUp size={16} className="text-slate-600 shrink-0" />
                        : <ChevronDown size={16} className="text-slate-600 shrink-0" />}
                    </button>

                    {/* Entries */}
                    {isOpen && (
                      <div className="border-t border-slate-800/60 divide-y divide-slate-800/40">
                        {entries.map(entry => (
                          <div key={entry.date} className="px-6 py-4 flex items-start justify-between group hover:bg-slate-800/20 transition-colors">
                            <div className="flex flex-col gap-3 min-w-0">
                              {/* Date + primary metrics */}
                              <div className="flex items-end gap-6">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    {new Date(entry.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="text-lg font-black text-slate-100">{entry.weight}{entry.unit === 'lbs' ? 'lb' : 'kg'}</span>
                                </div>
                                {entry.bodyFat != null && (
                                  <div className="flex flex-col border-l-2 border-slate-800 pl-6">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Body Fat</span>
                                    <span className="text-lg font-black text-emerald-400">{entry.bodyFat}%</span>
                                  </div>
                                )}
                                {entry.height != null && (
                                  <div className="flex flex-col border-l-2 border-slate-800 pl-6">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Height</span>
                                    <span className="text-lg font-black text-sky-300">{entry.height}{entry.unit === 'lbs' ? '"' : 'cm'}</span>
                                  </div>
                                )}
                              </div>
                              {/* Circumference metrics row — only rendered if at least one is present */}
                              {(entry.waist != null || entry.chest != null || entry.shoulders != null || entry.neck != null || entry.hips != null) && (
                                <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-slate-800/60 pt-2.5">
                                  {([
                                    { key: 'shoulders' as const, label: 'Shoulders', color: 'text-violet-300' },
                                    { key: 'chest'     as const, label: 'Chest',     color: 'text-amber-300'  },
                                    { key: 'waist'     as const, label: 'Waist',     color: 'text-slate-300'  },
                                    { key: 'hips'      as const, label: 'Hips',      color: 'text-pink-300'   },
                                    { key: 'neck'      as const, label: 'Neck',      color: 'text-cyan-300'   },
                                  ]).filter(m => entry[m.key] != null).map(m => (
                                    <div key={m.key} className="flex flex-col">
                                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{m.label}</span>
                                      <span className={`text-sm font-black ${m.color}`}>
                                        {entry[m.key]}{entry.unit === 'lbs' ? '"' : 'cm'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setSelectedDate(entry.date); setIsEntryMode(true); }}
                                className="p-3 bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-700 rounded-2xl transition-all"
                                title="Edit entry"
                              >
                                <History size={16} />
                              </button>
                              <button
                                onClick={() => onSave(history.filter(h => h.date !== entry.date))}
                                className="p-3 bg-slate-800 text-slate-300 hover:text-rose-500 border border-slate-700 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                                title="Delete entry"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
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
    </div>
  );
};

export default BiometricsLab;