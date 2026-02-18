
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Camera, X, Check, ArrowRight, RefreshCw, Layers, Sparkles, Target, Zap, Shield, Wand2, Loader2, Maximize2, Trash2, Bot, Info, Thermometer, Repeat, Activity, Volume2, Search, CheckCircle2, RotateCcw, Minus, Plus, HelpCircle, ChevronRight, Gauge, ArrowUp, ArrowDown } from 'lucide-react';
import { MorphologyScan, MorphologyAssessment, UserSettings } from '../types';
import { GeminiService } from '../services/geminiService';
import { storage } from '../services/storageService';

interface MorphologyLabProps {
  history: MorphologyScan[];
  onSave: (scan: MorphologyScan) => void;
  onClose: () => void;
  userSettings: UserSettings;
  aiService: GeminiService;
}

const BODY_REGIONS = {
  front: [
    { id: 'shoulders', name: 'SHO', x: 50, y: 18, rx: 12, ry: 6 },
    { id: 'chest', name: 'PEC', x: 50, y: 28, rx: 14, ry: 8 },
    { id: 'abs', name: 'ABS', x: 50, y: 42, rx: 10, ry: 12 },
    { id: 'biceps', name: 'BIC', x: 30, y: 30, rx: 6, ry: 10 },
    { id: 'biceps_r', name: 'BIC', x: 70, y: 30, rx: 6, ry: 10, alias: 'biceps' },
    { id: 'forearms', name: 'FOR', x: 25, y: 45, rx: 4, ry: 8 },
    { id: 'forearms_r', name: 'FOR', x: 75, y: 45, rx: 4, ry: 8, alias: 'forearms' },
    { id: 'quads', name: 'QUD', x: 40, y: 68, rx: 8, ry: 15 },
    { id: 'quads_r', name: 'QUD', x: 60, y: 68, rx: 8, ry: 15, alias: 'quads' },
    { id: 'calves', name: 'CAL', x: 40, y: 88, rx: 5, ry: 8 },
    { id: 'calves_r', name: 'CAL', x: 60, y: 88, rx: 5, ry: 8, alias: 'calves' },
  ],
  back: [
    { id: 'upperBack', name: 'TRP', x: 50, y: 25, rx: 14, ry: 10 },
    { id: 'lats', name: 'LAT', x: 50, y: 35, rx: 18, ry: 12 },
    { id: 'lowerBack', name: 'LUM', x: 50, y: 48, rx: 8, ry: 6 },
    { id: 'triceps', name: 'TRI', x: 30, y: 30, rx: 6, ry: 10 },
    { id: 'triceps_r', name: 'TRI', x: 70, y: 30, rx: 6, ry: 10, alias: 'triceps' },
    { id: 'glutes', name: 'GLU', x: 50, y: 58, rx: 14, ry: 10 },
    { id: 'hamstrings', name: 'HAM', x: 40, y: 75, rx: 7, ry: 12 },
    { id: 'hamstrings_r', name: 'HAM', x: 60, y: 75, rx: 7, ry: 12, alias: 'hamstrings' },
    { id: 'calves_back', name: 'CAL', x: 40, y: 88, rx: 5, ry: 8, alias: 'calves' },
    { id: 'calves_back_r', name: 'CAL', x: 60, y: 88, rx: 5, ry: 8, alias: 'calves' },
  ]
};

const Silhouette: React.FC<{ assessment: MorphologyAssessment; type: 'front' | 'back'; mode: 'thermal' | 'symmetry' | 'evolution' | 'vectors'; prevAssessment?: MorphologyAssessment }> = ({ assessment, type, mode, prevAssessment }) => {
  const regions = BODY_REGIONS[type];

  const thresholds = useMemo(() => {
    const scores = Object.values(assessment) as number[];
    const sorted = [...scores].sort((a, b) => a - b);
    return {
      low: sorted[Math.floor(sorted.length * 0.25)],
      high: sorted[Math.floor(sorted.length * 0.75)]
    };
  }, [assessment]);
  
  const getStyle = (value: number, partId: string) => {
    if (mode === 'vectors') {
      if (value >= thresholds.high) {
        return {
          fill: `hsla(35, 100%, 50%, 0.7)`,
          filter: 'url(#peak-glow)',
          animation: 'breathe 3s ease-in-out infinite'
        };
      }
      if (value <= thresholds.low) {
        return {
          fill: `hsla(185, 100%, 50%, 0.7)`,
          filter: 'url(#prime-glow)',
          animation: 'kinetic-pulse 2s ease-in-out infinite'
        };
      }
      return { fill: 'rgba(51, 65, 85, 0.2)', filter: 'none' };
    }

    if (mode === 'evolution' && prevAssessment) {
      const alias = regions.find(r => r.id === partId)?.alias || partId;
      const prevVal = (prevAssessment as any)[alias] || 0;
      const delta = value - prevVal;
      if (delta > 0) {
        const intensity = Math.min(1, delta / 15);
        return { 
          fill: `hsla(150, 80%, 50%, ${0.3 + (intensity * 0.5)})`, 
          filter: 'url(#standard-glow)',
          animation: delta > 5 ? 'evolve-up 2s ease-in-out infinite' : 'none'
        }; 
      }
      if (delta < 0) {
        const intensity = Math.min(1, Math.abs(delta) / 15);
        return { fill: `hsla(0, 80%, 50%, ${0.3 + (intensity * 0.5)})`, filter: 'url(#standard-glow)' }; 
      }
      return { fill: 'rgba(100, 116, 139, 0.05)', filter: 'none' };
    }

    if (mode === 'symmetry') {
      const values = Object.values(assessment) as number[];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const normalized = (value - min) / (max - min || 1);
      const val100 = normalized * 100;
      return { 
        fill: `hsla(${Math.max(0, 240 - (val100 * 2.4))}, 80%, 50%, ${0.4 + (normalized * 0.4)})`, 
        filter: 'url(#standard-glow)' 
      };
    }

    // Thermal Baseline
    const hue = Math.max(0, 240 - (value * 2.4));
    const alpha = 0.4 + (value / 100 * 0.4);
    return { fill: `hsla(${hue}, 80%, 50%, ${alpha})`, filter: 'url(#standard-glow)' };
  };

  return (
    <div className="relative w-full aspect-[2/3] bg-slate-950/20 rounded-3xl p-4 overflow-hidden border border-slate-800/50 shadow-inner">
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.03); }
        }
        @keyframes kinetic-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
        @keyframes evolve-up {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.4) drop-shadow(0 0 10px rgba(16, 185, 129, 0.4)); }
        }
      `}</style>
      <svg viewBox="0 0 100 150" className="w-full h-full">
        <defs>
          <filter id="standard-glow">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="peak-glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 1  0 0 0 0 0.8  0 0 0 0 0  0 0 0 1.5 0" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="prime-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 0 0 0 1  0 0 0 0 1  0 0 0 1.2 0" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <line x1="50" y1="10" x2="50" y2="140" stroke="rgba(30, 41, 59, 0.4)" strokeWidth="0.5" strokeDasharray="2 2" />
        {regions.map(r => {
          const alias = r.alias || r.id;
          const val = (assessment as any)[alias] || 0;
          const style = getStyle(val, r.id);
          const isSignificant = mode !== 'vectors' || val >= thresholds.high || val <= thresholds.low;
          return (
            <g key={r.id}>
              <ellipse cx={r.x} cy={r.y} rx={r.rx} ry={r.ry} style={style} className="transition-all duration-1000 origin-center" />
              {mode === 'vectors' && isSignificant && (
                <text x={r.x} y={r.y + 1} textAnchor="middle" className="text-[3px] font-black fill-white/40 uppercase tracking-[0.1em] pointer-events-none" style={{ fontSize: '3px' }}>
                  {r.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const MorphologyLab: React.FC<MorphologyLabProps> = ({ history, onSave, onClose, userSettings, aiService }) => {
  const [viewMode, setViewMode] = useState<'thermal' | 'symmetry' | 'evolution' | 'vectors'>('thermal');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSequenceRunning, setIsSequenceRunning] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number } | null>(null);
  const [showKdiTooltip, setShowKdiTooltip] = useState(false);
  const [morphologyHistory, setLocalHistory] = useState<MorphologyScan[]>(history);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countdownRef = useRef<number | null>(null);
  const stepRef = useRef<number>(0);
  const imagesRef = useRef<string[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const steps = [
    "Upper Front", "Upper Left", "Upper Back", "Upper Right",
    "Lower Front", "Lower Left", "Lower Back", "Lower Right"
  ];
  
  const sortedHistory = useMemo(() => [...morphologyHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [morphologyHistory]);
  const latestScan = sortedHistory[0];
  const previousScan = sortedHistory[1];

  useEffect(() => {
    const load = async () => {
      const stored = await storage.get<MorphologyScan[]>('ironflow_morphology');
      if (stored) setLocalHistory(stored);
    };
    load();
  }, []);

  const saveMorphology = async (scan: MorphologyScan) => {
    const newHistory = [scan, ...morphologyHistory];
    setLocalHistory(newHistory);
    await storage.set('ironflow_morphology', newHistory);
    onSave(scan);
  };

  // Kinematic Density Index (KDI) Calculation
  const kdiMetrics = useMemo(() => {
    if (!latestScan) return null;
    const a = latestScan.assessment;
    const weights: Record<string, number> = {
      shoulders: 1.0, chest: 1.5, abs: 1.0, biceps: 1.0, triceps: 1.0, 
      forearms: 0.8, quads: 1.5, hamstrings: 1.2, calves: 1.0, 
      upperBack: 1.5, lowerBack: 1.2, lats: 1.2, glutes: 1.5
    };
    
    let weightedSum = 0;
    let totalWeight = 0;
    let peakGroup = { name: 'Chest', val: 0 };

    Object.entries(a).forEach(([key, val]) => {
      const v = val as number;
      const w = weights[key] || 1.0;
      weightedSum += v * w;
      totalWeight += w;
      if (v > peakGroup.val) peakGroup = { name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'), val: v };
    });

    const currentKDI = weightedSum / totalWeight;
    
    let delta = 0;
    if (previousScan) {
      let prevSum = 0;
      Object.entries(previousScan.assessment).forEach(([key, val]) => prevSum += (val as number) * (weights[key] || 1.0));
      const prevKDI = prevSum / totalWeight;
      delta = ((currentKDI - prevKDI) / (prevKDI || 1)) * 100;
    }

    // Tier Logic
    const tiers = [
      { name: "Neural Priming", min: 0, max: 30 },
      { name: "Established Architecture", min: 31, max: 60 },
      { name: "Precision Definition", min: 61, max: 85 },
      { name: "Elite Kinetic Peak", min: 86, max: 100 }
    ];

    const currentTier = tiers.find(t => currentKDI >= t.min && currentKDI <= t.max) || tiers[0];
    const nextTier = tiers.find(t => t.min > currentKDI);
    const range = currentTier.max - currentTier.min;
    const posInRange = currentKDI - currentTier.min;
    const topPercentage = 100 - Math.round((posInRange / range) * 100);
    const pointsToNext = nextTier ? (nextTier.min - currentKDI).toFixed(1) : null;

    let affirmation = "";
    if (!previousScan) {
      affirmation = `Architecture indexed. Baseline established at ${currentKDI.toFixed(1)}. Primary density peak identified in the ${peakGroup.name}. Ready for protocol scaling.`;
    } else if (delta > 0.5) {
      affirmation = `Evolution confirmed. Net density optimized by ${delta.toFixed(1)}% since last sync. Exceptional adaptation identified in ${peakGroup.name} sectors.`;
    } else {
      affirmation = `Structural integrity stabilized. Overall symmetry remains high at ${currentKDI.toFixed(1)}. Foundation is primed for a new intensive hypertrophy cycle.`;
    }

    return { 
      score: currentKDI, 
      delta, 
      affirmation, 
      peakGroup,
      tierInfo: {
        currentTier: currentTier.name,
        topPercentage,
        pointsToNext,
        nextTier: nextTier?.name
      }
    };
  }, [latestScan, previousScan]);

  const getKDIColor = (score: number) => {
    if (score < 40) return 'text-cyan-400';
    if (score < 75) return 'text-emerald-400';
    return 'text-amber-400';
  };

  const playCaptureSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.warn("Audio feedback failed", e);
    }
  };

  const applyZoom = async (level: number) => {
    if (!videoRef.current?.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const [track] = stream.getVideoTracks();
    const capabilities = track.getCapabilities() as any;
    
    if (capabilities.zoom) {
      try {
        await track.applyConstraints({
          advanced: [{ zoom: level }]
        } as any);
        setZoomLevel(level);
      } catch (e) {
        console.warn("Could not apply zoom constraints:", e);
      }
    }
  };

  const handleStartScan = async (startingStep: number = 0) => {
    setIsCameraActive(true);
    setIsReviewing(false);
    setCurrentStep(startingStep);
    stepRef.current = startingStep;
    
    if (startingStep === 0) {
      setCapturedImages([]);
      imagesRef.current = [];
    } else {
      const existing = imagesRef.current.slice(0, 4);
      setCapturedImages(existing);
      imagesRef.current = existing;
    }

    setIsSequenceRunning(false);
    setCountdown(null);
    setShowFlash(false);
    
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          aspectRatio: { ideal: 9/16 }
        } 
      });

      const [track] = stream.getVideoTracks();
      const capabilities = track.getCapabilities() as any;
      if (capabilities.zoom) {
        setZoomCapabilities({
          min: capabilities.zoom.min || 1,
          max: capabilities.zoom.max || 3,
          step: capabilities.zoom.step || 0.1
        });
        try {
          await track.applyConstraints({ advanced: [{ zoom: zoomLevel }] } as any);
        } catch (e) {}
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Camera access denied.");
      setIsCameraActive(false);
    }
  };

  const handleDiscard = () => {
    if (capturedImages.length <= 4) handleStartScan(0);
    else handleStartScan(4);
  };

  const toggleCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    if (isCameraActive) handleStartScan(stepRef.current);
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        if (facingMode === 'user') {
          ctx.translate(canvasRef.current.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        setShowFlash(true);
        playCaptureSound();
        setTimeout(() => setShowFlash(false), 150);
        return canvasRef.current.toDataURL('image/jpeg', 0.8);
      }
    }
    return null;
  };

  const startSequence = () => {
    setIsSequenceRunning(true);
    setCountdown(5);
    countdownRef.current = 5;
  };

  useEffect(() => {
    let timer: number;
    if (isSequenceRunning && countdown !== null) {
      timer = window.setInterval(() => {
        if (countdownRef.current !== null) {
          if (countdownRef.current > 1) {
            countdownRef.current -= 1;
            setCountdown(countdownRef.current);
          } else {
            const data = captureFrame();
            if (data) {
              imagesRef.current.push(data);
              setCapturedImages([...imagesRef.current]);
              if (stepRef.current === 3 || stepRef.current === 7) {
                clearInterval(timer);
                setCountdown(null);
                setIsSequenceRunning(false);
                stopCamera();
                setIsReviewing(true);
              } else {
                stepRef.current += 1;
                setCurrentStep(stepRef.current);
                countdownRef.current = 5;
                setCountdown(5);
              }
            } else {
              clearInterval(timer);
              alert("Critical failure in video stream.");
              stopCamera();
            }
          }
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSequenceRunning]);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setIsCameraActive(false);
  };

  const handleApproveScan = () => {
    setIsReviewing(false);
    if (capturedImages.length === 4) handleStartScan(4);
    else processScan([...capturedImages]);
  };

  const processScan = async (images: string[]) => {
    setIsProcessing(true);
    try {
      const assessment = await aiService.analyzeMorphology({
        upperFront: images[0], upperLeft: images[1], upperBack: images[2], upperRight: images[3],
        lowerFront: images[4], lowerLeft: images[5], lowerBack: images[6], lowerRight: images[7]
      });
      const now = new Date();
      const localDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      await saveMorphology({ id: Date.now().toString(), date: localDate, assessment });
    } catch (e) {
      alert("AI interpretation failed.");
    } finally {
      setIsProcessing(false);
      setCapturedImages([]);
      imagesRef.current = [];
    }
  };

  const Legend = () => {
    const config = {
      thermal: { label: "Intensity Heatmap", description: "Higher density tissues mapped to warmer spectral zones.", scale: [{ color: "hsla(240, 80%, 50%, 0.8)", label: "Developing" }, { color: "hsla(180, 80%, 50%, 0.8)", label: "Solid" }, { color: "hsla(30, 100%, 50%, 0.8)", label: "Peak" }] },
      symmetry: { label: "Kinematic Variance", description: "Visualizing lateral and volumetric balance.", scale: [{ color: "hsla(0, 80%, 50%, 0.8)", label: "Imbalance" }, { color: "hsla(200, 80%, 50%, 0.8)", label: "Symmetric" }] },
      vectors: { label: "Growth Vectors", description: "Highlighting prioritized growth sectors.", scale: [{ color: "hsla(185, 100%, 50%, 0.7)", label: "Lagging" }, { color: "hsla(35, 100%, 50%, 0.7)", label: "Leading" }] },
      evolution: { label: "Evolution Delta", description: "Tissue adaptation tracked since last biometric sync.", scale: [{ color: "hsla(150, 80%, 50%, 0.8)", label: "Hypertrophy" }, { color: "hsla(0, 80%, 50%, 0.8)", label: "Regression" }] }
    };
    const active = config[viewMode];
    return (
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4 animate-in fade-in duration-500">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle size={14} className="text-cyan-400" />
          <h5 className="text-[10px] font-black text-slate-100 uppercase tracking-widest">{active.label}</h5>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex gap-2 shrink-0">
            {active.scale.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: s.color }}></div>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
          <p className="text-[9px] text-slate-500 italic leading-tight flex-1">{active.description}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-2xl p-4 sm:p-8 flex items-center justify-center animate-in fade-in duration-500">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[3rem] flex flex-col h-[95vh] shadow-2xl overflow-hidden relative">
        <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20"><Layers className="text-cyan-400" size={24} /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-100">Morphology Lab</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Precision 8-Point Protocol</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
          {!latestScan && !isCameraActive && !isProcessing && !isReviewing && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
              <div className="w-24 h-24 bg-slate-800 rounded-[2.5rem] flex items-center justify-center border border-slate-700 shadow-inner group"><Camera size={48} className="text-slate-600 group-hover:text-cyan-400 transition-colors" /></div>
              <div className="max-w-md space-y-2">
                <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight">Initialize Precision Index</h3>
                <p className="text-sm text-slate-500 leading-relaxed italic">The lab will capture 8 distinct profiles (4 Upper, 4 Lower). You will review each segment for alignment before proceeding to synthesis.</p>
              </div>
              <button onClick={() => handleStartScan(0)} className="px-10 py-5 bg-cyan-500 text-slate-950 font-black rounded-3xl uppercase tracking-widest text-xs shadow-xl shadow-cyan-500/20 active:scale-95 transition-all">Start 8-Point Scan</button>
            </div>
          )}

          {isCameraActive && (
            <div className="absolute inset-0 z-50 bg-black flex flex-col overflow-hidden animate-in fade-in duration-300">
              <video ref={videoRef} className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} playsInline />
              <canvas ref={canvasRef} className="hidden" />
              {showFlash && <div className="absolute inset-0 bg-white z-[210] animate-in fade-in duration-75" />}
              <div className="absolute inset-0 flex flex-col pointer-events-none">
                <div className="p-8 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <div className="bg-cyan-50 text-slate-950 px-6 py-2.5 rounded-full font-black text-[12px] uppercase tracking-[0.25em] shadow-2xl border border-cyan-400/50">{steps[currentStep]}</div>
                      <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mt-3 ml-2">{currentStep < 4 ? 'Phase 1: Upper Body' : 'Phase 2: Lower Body'}</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      {!isSequenceRunning && (
                        <>
                          {zoomCapabilities && (
                            <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur-md rounded-[1.25rem] border border-slate-700/50 p-1 shadow-xl">
                              <button onClick={() => applyZoom(Math.max(zoomCapabilities.min, zoomLevel - zoomCapabilities.step))} className="p-3 text-white hover:text-cyan-400 transition-colors"><Minus size={18} /></button>
                              <span className="text-[10px] font-black text-cyan-400 w-8 text-center">{zoomLevel.toFixed(1)}x</span>
                              <button onClick={() => applyZoom(Math.min(zoomCapabilities.max, zoomLevel + zoomCapabilities.step))} className="p-3 text-white hover:text-cyan-400 transition-colors"><Plus size={18} /></button>
                            </div>
                          )}
                          <button onClick={toggleCamera} className="pointer-events-auto p-4 bg-slate-900/90 backdrop-blur-md rounded-[1.25rem] text-white hover:bg-slate-800 transition-all border border-slate-700/50 shadow-xl" title="Switch Camera"><Repeat size={24} /></button>
                        </>
                      )}
                      <div className="bg-slate-900/90 backdrop-blur-md px-6 py-2.5 rounded-full text-white font-black text-[12px] uppercase tracking-widest flex items-center border border-slate-700/50 shadow-xl">{currentStep + 1} / 8</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  {countdown !== null ? (
                    <div className="w-40 h-40 rounded-full bg-cyan-500/10 border-[6px] border-cyan-500 backdrop-blur-md flex items-center justify-center animate-in zoom-in duration-300 shadow-[0_0_50px_rgba(34,211,238,0.3)]">
                      <span className="text-7xl font-black text-cyan-400 drop-shadow(0 0 20px rgba(34,211,238,0.6))">{countdown}</span>
                    </div>
                  ) : (
                    <div className="w-3/4 h-3/4 border-[3px] border-dashed border-cyan-400/20 rounded-[3rem] relative">
                       <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-400/10" />
                       <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-400/10" />
                    </div>
                  )}
                </div>
                <div className="px-8 flex gap-3 overflow-x-auto pb-6 no-scrollbar">
                   {capturedImages.map((img, i) => <div key={i} className={`w-14 h-20 rounded-2xl border-2 overflow-hidden shrink-0 shadow-[0_10px_25px_rgba(0,0,0,0.5)] animate-in zoom-in duration-400 ${i === currentStep ? 'border-amber-400 scale-110' : 'border-cyan-500'}`}><img src={img} className="w-full h-full object-cover" alt={`Acquired ${i}`} /></div>)}
                   {Array.from({ length: 8 - capturedImages.length }).map((_, i) => <div key={`empty-${i}`} className="w-14 h-20 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm shrink-0 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-slate-800" /></div>)}
                </div>
                <div className="p-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex justify-center items-center">
                  {!isSequenceRunning ? (
                    <button onClick={startSequence} className="pointer-events-auto w-28 h-28 bg-white rounded-full border-[14px] border-white/20 active:scale-90 transition-all flex items-center justify-center shadow-[0_0_60px_rgba(0,0,0,0.5)]"><div className="w-16 h-16 rounded-full bg-cyan-500 flex items-center justify-center shadow-inner"><Camera size={36} className="text-slate-950" /></div></button>
                  ) : (
                    <div className="h-28 flex items-center"><div className="bg-slate-950/80 backdrop-blur-xl px-8 py-3 rounded-full border border-cyan-500/30 shadow-2xl"><p className="text-[12px] font-black uppercase tracking-[0.4em] text-cyan-400 ai-loading-pulse">Protocol Sequence Active</p></div></div>
                  )}
                </div>
              </div>
            </div>
          )}

          {isReviewing && (
            <div className="p-8 space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
              <div className="text-center space-y-2"><h3 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Review {capturedImages.length <= 4 ? 'Upper Body' : 'Lower Body'}</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Verify pixel density and skeletal alignment</p></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 content-center">
                {(capturedImages.length <= 4 ? capturedImages : capturedImages.slice(4)).map((img, i) => {
                  const stepIdx = capturedImages.length <= 4 ? i : i + 4;
                  return (
                    <div key={i} className="space-y-3">
                      <div className="aspect-[9/16] rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl"><img src={img} className="w-full h-full object-cover" alt={steps[stepIdx]} /></div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{steps[stepIdx]}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-6 pb-4">
                <button onClick={handleDiscard} className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-black rounded-3xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all"><RotateCcw size={18} /> Discard & Retake</button>
                <button onClick={handleApproveScan} className="flex-[2] py-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-3xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all"><CheckCircle2 size={18} /> {capturedImages.length <= 4 ? 'Approve & Next Phase' : 'Approve & Synthesize'}</button>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center justify-center h-full p-8 space-y-8">
              <div className="relative"><div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full animate-pulse" /><Loader2 className="animate-spin text-cyan-400 relative z-10" size={64} /></div>
              <div className="text-center space-y-2"><h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">Analyzing 8-Point Morphology</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest ai-loading-pulse">Performing cross-segment volumetric synthesis...</p></div>
            </div>
          )}

          {latestScan && !isCameraActive && !isProcessing && !isReviewing && kdiMetrics && (
            <div className="p-8 space-y-8 animate-in fade-in duration-500">
              {/* Rating Section */}
              <div className="flex flex-col items-center space-y-6">
                <div className="relative group cursor-pointer" onClick={() => setShowKdiTooltip(!showKdiTooltip)}>
                  {/* Pulse Core Ring */}
                  <div className={`absolute inset-0 blur-2xl opacity-20 rounded-full animate-pulse ${kdiMetrics.score < 40 ? 'bg-cyan-400' : kdiMetrics.score < 75 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <div className="relative w-48 h-48 rounded-full bg-slate-950 border-4 border-slate-800 flex flex-col items-center justify-center shadow-2xl transition-all duration-1000 group-hover:scale-105">
                     <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-1">KDI Index</span>
                     <h3 className={`text-6xl font-black tracking-tighter transition-colors duration-1000 ${getKDIColor(kdiMetrics.score)}`}>
                        {kdiMetrics.score.toFixed(1)}
                     </h3>
                     {kdiMetrics.delta !== 0 && (
                        <div className={`flex items-center gap-1 mt-2 text-[10px] font-black uppercase ${kdiMetrics.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                           {kdiMetrics.delta > 0 ? <ArrowUp size={10}/> : <ArrowDown size={10}/>}
                           {Math.abs(kdiMetrics.delta).toFixed(1)}%
                        </div>
                     )}

                     {/* Interactive Tooltip Overlay */}
                     {showKdiTooltip && (
                       <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-md rounded-full flex flex-col items-center justify-center p-6 text-center border-2 border-emerald-500/30 animate-in zoom-in duration-200">
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">{kdiMetrics.tierInfo.currentTier}</p>
                          <p className="text-xs text-slate-200 leading-tight">
                            You are in the top <span className="font-black text-white">{kdiMetrics.tierInfo.topPercentage}%</span> of this tier. 
                            {kdiMetrics.tierInfo.pointsToNext && (
                              <span className="block mt-1 text-[10px] text-slate-500 italic">
                                {kdiMetrics.tierInfo.pointsToNext} points until {kdiMetrics.tierInfo.nextTier}
                              </span>
                            )}
                          </p>
                          <div className="mt-3 text-[8px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse">Tap to close</div>
                       </div>
                     )}
                  </div>
                  {/* Rotating Detail ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 3" className="text-slate-800" />
                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${kdiMetrics.score * 3.01} 301`} strokeLinecap="round" className={`transition-all duration-1000 ${getKDIColor(kdiMetrics.score)} opacity-40`} />
                  </svg>
                </div>

                {/* Spectral Alignment Bar */}
                <div className="w-full max-w-lg space-y-4">
                  <div className="relative h-4 bg-slate-950/80 rounded-full border border-slate-800 overflow-hidden shadow-inner">
                    {/* Background Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/40 via-emerald-900/40 to-amber-900/40" />
                    
                    {/* Ghost Trace (History) */}
                    {previousScan && (
                      <div 
                        className="absolute top-0 bottom-0 w-1 bg-slate-500/50 z-10 transition-all duration-700"
                        style={{ left: `${(kdiMetrics.score - kdiMetrics.delta)}%` }}
                        title="Previous Index"
                      />
                    )}
                    
                    {/* Current Position Marker */}
                    <div 
                      className="absolute top-0 bottom-0 w-2.5 bg-white shadow-[0_0_15px_white] z-20 transition-all duration-1000 ease-out"
                      style={{ left: `${kdiMetrics.score}%`, transform: 'translateX(-50%)' }}
                    />
                  </div>

                  {/* Tier Labels */}
                  <div className="flex justify-between px-1">
                    {[
                      { l: "Neural Priming", v: 0 },
                      { l: "Established", v: 31 },
                      { l: "Precision", v: 61 },
                      { l: "Elite Peak", v: 86 }
                    ].map((tier, i) => (
                      <div key={i} className={`flex flex-col items-center ${kdiMetrics.score >= tier.v ? 'opacity-100' : 'opacity-20'}`}>
                        <div className="w-px h-1.5 bg-slate-700 mb-1" />
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">{tier.l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Architect's Affirmation */}
                <div className="w-full max-w-lg bg-slate-950/40 border border-slate-800 p-6 rounded-[2.5rem] relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-8 opacity-[0.03] rotate-12 transition-transform group-hover:rotate-6"><Bot size={100} /></div>
                  <div className="flex gap-5 items-start relative z-10">
                     <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0 border border-slate-800 shadow-xl group-hover:border-cyan-500/30 transition-colors">
                        <Bot size={24} className="text-cyan-400" />
                     </div>
                     <div>
                        <h4 className="text-[10px] font-black text-slate-100 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                           Architect's Synthesis Protocol
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        </h4>
                        <p className="text-[12px] text-slate-300 leading-relaxed italic">
                           "{kdiMetrics.affirmation}"
                        </p>
                     </div>
                  </div>
                </div>
              </div>

              {/* Functional Toggles & Lab Content */}
              <div className="space-y-6">
                <div className="flex p-1 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                  <button onClick={() => setViewMode('thermal')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'thermal' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Thermal</button>
                  <button onClick={() => setViewMode('symmetry')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'symmetry' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Symmetry</button>
                  <button onClick={() => setViewMode('vectors')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'vectors' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Vectors</button>
                  <button onClick={() => setViewMode('evolution')} disabled={!previousScan} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'evolution' ? 'bg-rose-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'} disabled:opacity-30`}>Evolution</button>
                </div>
                
                <Legend />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-center">Posterior Morphology</h4>
                    <Silhouette assessment={latestScan.assessment} type="back" mode={viewMode} prevAssessment={previousScan?.assessment} />
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-center">Anterior Morphology</h4>
                    <Silhouette assessment={latestScan.assessment} type="front" mode={viewMode} prevAssessment={previousScan?.assessment} />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                   <button onClick={() => handleStartScan(0)} className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-black rounded-3xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                     <RefreshCw size={16} /> Recalibrate Index
                   </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-4 bg-slate-950/60 border-t border-slate-800 flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={12} className="text-emerald-500" />
            <span>Encrypted Volatile Processing Active</span>
          </div>
          <div className="flex items-center gap-4">
             <span>{morphologyHistory.length} Scans in History</span>
             {latestScan && <span>Last Sync: {latestScan.date}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MorphologyLab;
