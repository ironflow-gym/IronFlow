import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Camera, X, RefreshCw, Layers, Sparkles, Wand2, Loader2, Bot, Info, Activity, Search, CheckCircle2, RotateCcw, ChevronRight, Gauge, ArrowUp, ArrowDown } from 'lucide-react';
import { MorphologyScan, MorphologyAssessment, UserSettings } from '../types';
import { GeminiService } from '../services/GeminiService';

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
        return { fill: `hsla(35, 100%, 50%, 0.7)`, filter: 'url(#peak-glow)', animation: 'breathe 3s ease-in-out infinite' };
      }
      if (value <= thresholds.low) {
        return { fill: `hsla(185, 100%, 50%, 0.7)`, filter: 'url(#prime-glow)', animation: 'kinetic-pulse 2s ease-in-out infinite' };
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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const steps = [
    "Upper Front", "Upper Left", "Upper Back", "Upper Right",
    "Lower Front", "Lower Left", "Lower Back", "Lower Right"
  ];
  
  const sortedHistory = useMemo(() => [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [history]);
  const latestScan = sortedHistory[0];
  const previousScan = sortedHistory[1];

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

    return { 
      score: currentKDI, 
      delta, 
      peakGroup,
      tierInfo: {
        currentTier: currentTier.name,
        topPercentage,
        pointsToNext,
        nextTier: nextTier?.name
      }
    };
  }, [latestScan, previousScan]);

  const playCaptureSound = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    } catch (e) {}
  };

  const handleStartScan = async (startingStep: number = 0) => {
    setIsCameraActive(true);
    setIsReviewing(false);
    setCurrentStep(startingStep);
    setCapturedImages([]);
    
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      alert("Camera access denied.");
      setIsCameraActive(false);
    }
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const data = canvas.toDataURL('image/jpeg', 0.85);
    playCaptureSound();
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 100);
    return data;
  };

  const runSequence = async () => {
    setIsSequenceRunning(true);
    const currentImages = [...capturedImages];
    
    for (let i = currentStep; i < steps.length; i++) {
      setCurrentStep(i);
      for (let c = 5; c > 0; c--) {
        setCountdown(c);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(null);
      const img = capture();
      if (img) {
        currentImages.push(img);
        setCapturedImages([...currentImages]);
      }
      if (i < steps.length - 1) await new Promise(r => setTimeout(r, 1500));
    }

    setIsSequenceRunning(false);
    processScan(currentImages);
  };

  const processScan = async (images: string[]) => {
    setIsProcessing(true);
    setIsCameraActive(false);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }

    try {
      const assessment = await aiService.analyzeMorphology({
        upperFront: images[0], upperLeft: images[1], upperBack: images[2], upperRight: images[3],
        lowerFront: images[4], lowerLeft: images[5], lowerBack: images[6], lowerRight: images[7]
      });
      
      const scan: MorphologyScan = {
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        assessment
      };
      
      onSave(scan);
      setIsReviewing(true);
    } catch (e) {
      alert("Morphology analysis failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] bg-slate-950 flex flex-col animate-in fade-in duration-500">
      <div className="flex justify-between items-center p-6 border-b border-slate-900 bg-slate-950/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20"><Layers size={20} /></div>
          <div><h2 className="text-xl font-black text-slate-100 tracking-tight">Morphology Lab</h2><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kinematic Density Indexing</p></div>
        </div>
        <button onClick={onClose} className="p-3 bg-slate-900 rounded-2xl text-slate-400 border border-slate-800 transition-all"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
        {!isCameraActive && !isReviewing && !isProcessing && (
          <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12"><Sparkles size={80} /></div>
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner"><Camera size={36} className="text-emerald-400" /></div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Initialize Evolution Scan</h3>
                <p className="text-slate-500 text-sm leading-relaxed italic">Capture an 8-point structural mirror to analyze muscle density, structural symmetry, and longitudinal adaptation.</p>
              </div>
              <button onClick={() => handleStartScan(0)} className="w-full py-5 bg-emerald-500 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm">Deploy Optical Array <ChevronRight size={18}/></button>
            </div>

            {latestScan && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-xl">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Structural Balance</h4>
                  <div className="flex gap-4">
                    <Silhouette assessment={latestScan.assessment} type="front" mode={viewMode} prevAssessment={previousScan?.assessment} />
                    <Silhouette assessment={latestScan.assessment} type="back" mode={viewMode} prevAssessment={previousScan?.assessment} />
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col justify-center text-center space-y-4">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kinematic Density Index</p>
                   <h3 className={`text-6xl font-black tracking-tighter ${kdiMetrics ? (kdiMetrics.score < 60 ? 'text-cyan-400' : 'text-emerald-400') : 'text-slate-100'}`}>{kdiMetrics?.score.toFixed(1)}</h3>
                   <div className="flex items-center justify-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kdiMetrics?.tierInfo.currentTier}</span>
                      {kdiMetrics?.delta !== 0 && (
                        <div className={`flex items-center gap-1 text-[10px] font-black ${kdiMetrics!.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {kdiMetrics!.delta > 0 ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
                          {Math.abs(kdiMetrics!.delta).toFixed(1)}%
                        </div>
                      )}
                   </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isCameraActive && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="relative aspect-[3/4] bg-black rounded-[3rem] overflow-hidden border-2 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {showFlash && <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-200" />}
              {countdown && <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-40"><span className="text-[120px] font-black text-white drop-shadow-2xl animate-ping">{countdown}</span></div>}
              <div className="absolute bottom-10 left-10 right-10 flex flex-col items-center gap-4 z-40">
                <div className="px-6 py-3 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 text-center"><p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Optical Calibration</p><p className="text-xl font-black text-white uppercase tracking-tight">{steps[currentStep]}</p></div>
                {!isSequenceRunning && <button onClick={runSequence} className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border-8 border-white/20"><div className="w-16 h-16 rounded-full border-4 border-black" /></button>}
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {isProcessing && (
          <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in">
             <div className="relative"><div className="absolute inset-0 bg-emerald-500/20 blur-[80px] rounded-full animate-pulse" /><Loader2 className="animate-spin text-emerald-400 relative z-10" size={64} /></div>
             <div className="text-center space-y-2"><h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter">Analyzing Kinetic Architecture</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest ai-loading-pulse">Performing Multi-Point Morphology Synthesis...</p></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MorphologyLab;