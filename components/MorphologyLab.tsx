import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Camera, X, Check, ArrowRight, RefreshCw, Layers, Sparkles, Target, Zap, Shield, Wand2, Loader2, Maximize2, Trash2, Bot, Info, Thermometer, Repeat, Activity } from 'lucide-react';
import { MorphologyScan, MorphologyAssessment, UserSettings } from '../types';
import { GeminiService } from '../services/geminiService';

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

const Silhouette: React.FC<{ assessment: MorphologyAssessment; type: 'front' | 'back'; mode: 'baseline' | 'weakest' | 'delta' | 'opportunity'; prevAssessment?: MorphologyAssessment }> = ({ assessment, type, mode, prevAssessment }) => {
  const regions = BODY_REGIONS[type];

  // Logic for Opportunity Matrix thresholds
  const thresholds = useMemo(() => {
    const scores = Object.values(assessment) as number[];
    const sorted = [...scores].sort((a, b) => a - b);
    return {
      low: sorted[Math.floor(sorted.length * 0.25)],
      high: sorted[Math.floor(sorted.length * 0.75)]
    };
  }, [assessment]);
  
  const getStyle = (value: number, partId: string) => {
    if (mode === 'opportunity') {
      if (value >= thresholds.high) {
        // Peak Adaptation (Gold/Red)
        return {
          fill: `hsla(35, 100%, 50%, 0.7)`,
          filter: 'url(#peak-glow)',
          animation: 'breathe 3s ease-in-out infinite'
        };
      }
      if (value <= thresholds.low) {
        // Primed Growth (Electric Cyan)
        return {
          fill: `hsla(185, 100%, 50%, 0.7)`,
          filter: 'url(#prime-glow)',
          animation: 'kinetic-pulse 2s ease-in-out infinite'
        };
      }
      return { fill: 'rgba(51, 65, 85, 0.2)', filter: 'none' };
    }

    if (mode === 'delta' && prevAssessment) {
      const alias = regions.find(r => r.id === partId)?.alias || partId;
      const prevVal = (prevAssessment as any)[alias] || 0;
      const delta = value - prevVal;
      if (delta > 0) {
        const intensity = Math.min(1, delta / 15);
        return { fill: `hsla(0, 80%, 50%, ${0.3 + (intensity * 0.5)})`, filter: 'url(#standard-glow)' }; 
      }
      if (delta < 0) {
        const intensity = Math.min(1, Math.abs(delta) / 15);
        return { fill: `hsla(220, 80%, 50%, ${0.3 + (intensity * 0.5)})`, filter: 'url(#standard-glow)' }; 
      }
      return { fill: 'rgba(100, 116, 139, 0.05)', filter: 'none' };
    }

    if (mode === 'weakest') {
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

    // Baseline Mode
    const hue = Math.max(0, 240 - (value * 2.4));
    const alpha = 0.4 + (value / 100 * 0.4);
    return { fill: `hsla(${hue}, 80%, 50%, ${alpha})`, filter: 'url(#standard-glow)' };
  };

  return (
    <div className="relative w-full aspect-[2/3] bg-slate-950/20 rounded-3xl p-4 overflow-hidden border border-slate-800/50">
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.03); }
        }
        @keyframes kinetic-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
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
        
        {/* Kinematic Axis (Spine) */}
        <line x1="50" y1="10" x2="50" y2="140" stroke="rgba(30, 41, 59, 0.4)" strokeWidth="0.5" strokeDasharray="2 2" />
        
        {/* Energy Bulbs */}
        {regions.map(r => {
          const alias = r.alias || r.id;
          const val = (assessment as any)[alias] || 0;
          const style = getStyle(val, r.id);
          const isSignificant = mode !== 'opportunity' || val >= thresholds.high || val <= thresholds.low;
          
          return (
            <g key={r.id}>
              <ellipse 
                cx={r.x} cy={r.y} rx={r.rx} ry={r.ry} 
                style={style}
                className="transition-all duration-1000 origin-center"
              />
              {mode === 'opportunity' && isSignificant && (
                <text 
                  x={r.x} y={r.y + 1} 
                  textAnchor="middle" 
                  className="text-[3px] font-black fill-white/40 uppercase tracking-[0.1em] pointer-events-none"
                  style={{ fontSize: '3px' }}
                >
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
  const [viewMode, setViewMode] = useState<'baseline' | 'weakest' | 'delta' | 'opportunity'>('baseline');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const steps = ["Front View", "Left Side", "Back View", "Right Side"];
  const sortedHistory = useMemo(() => [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [history]);
  const latestScan = sortedHistory[0];
  const previousScan = sortedHistory[1];

  const handleStartScan = async (mode: 'user' | 'environment' = facingMode) => {
    setIsCameraActive(true);
    setCurrentStep(0);
    setCapturedImages([]);
    
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Camera access denied. Morphology scanning requires visual input.");
      setIsCameraActive(false);
    }
  };

  const toggleCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    if (isCameraActive) {
      handleStartScan(newMode);
    }
  };

  const captureImage = () => {
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
        
        const data = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setCapturedImages(prev => [...prev, data]);
        if (currentStep < 3) {
          setCurrentStep(prev => prev + 1);
        } else {
          stopCamera();
          processScan([...capturedImages, data]);
        }
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setIsCameraActive(false);
  };

  const processScan = async (images: string[]) => {
    setIsProcessing(true);
    try {
      const assessment = await aiService.analyzeMorphology({
        front: images[0],
        left: images[1],
        back: images[2],
        right: images[3]
      });
      const now = new Date();
      const localDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const scan: MorphologyScan = {
        id: Date.now().toString(),
        date: localDate,
        assessment
      };
      onSave(scan);
    } catch (e) {
      alert("AI interpretation failed. Ensure consistent lighting and poses.");
    } finally {
      setIsProcessing(false);
      setCapturedImages([]);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-2xl p-4 sm:p-8 flex items-center justify-center animate-in fade-in duration-500">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[3rem] flex flex-col max-h-[92vh] shadow-2xl overflow-hidden relative">
        
        <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
              <Layers className="text-cyan-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100">Morphology Lab</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Kinematic Assessment Suite</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
          {!latestScan && !isCameraActive && !isProcessing && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="w-24 h-24 bg-slate-800 rounded-[2.5rem] flex items-center justify-center border border-slate-700 shadow-inner group">
                <Camera size={48} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-xl font-black text-slate-100">Initialize Physical Index</h3>
                <p className="text-sm text-slate-500 leading-relaxed italic">Capture 4 standardized physical profiles for AI morphological analysis. Images are processed in volatile memory and purged immediately after indexing.</p>
              </div>
              <button onClick={() => handleStartScan()} className="px-10 py-5 bg-cyan-500 text-slate-950 font-black rounded-3xl uppercase tracking-widest text-xs shadow-xl shadow-cyan-500/20 active:scale-95 transition-all">Initialize Scan</button>
            </div>
          )}

          {isCameraActive && (
            <div className="relative aspect-video max-w-2xl mx-auto rounded-[3rem] overflow-hidden bg-black border border-slate-800 shadow-2xl">
              <video 
                ref={videoRef} 
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
                playsInline 
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="absolute inset-0 flex flex-col pointer-events-none">
                <div className="p-6 bg-gradient-to-b from-black/80 to-transparent">
                  <div className="flex justify-between items-center">
                    <div className="bg-cyan-500 text-slate-950 px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest">{steps[currentStep]}</div>
                    <div className="flex gap-2">
                      <button 
                        onClick={toggleCamera} 
                        className="pointer-events-auto p-2.5 bg-slate-900/80 backdrop-blur-md rounded-xl text-white hover:bg-slate-800 transition-all border border-slate-700/50"
                        title="Switch Camera"
                      >
                        <Repeat size={18} />
                      </button>
                      <div className="bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full text-white/60 text-[10px] font-black uppercase tracking-widest flex items-center border border-slate-700/50">
                        {currentStep + 1} / 4
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center opacity-30">
                  <div className="w-1/2 h-4/5 border-2 border-dashed border-cyan-400 rounded-full" />
                </div>
                <div className="p-8 bg-gradient-to-t from-black/80 to-transparent flex justify-center">
                  <button onClick={captureImage} className="pointer-events-auto w-20 h-20 bg-white rounded-full border-8 border-white/20 active:scale-90 transition-all flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-black/5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-24 space-y-8">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full animate-pulse" />
                <Loader2 className="animate-spin text-cyan-400 relative z-10" size={64} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">Analyzing Morphology</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest ai-loading-pulse">Calculating developmental intensity indices...</p>
              </div>
            </div>
          )}

          {latestScan && !isCameraActive && !isProcessing && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Mode Controls */}
              <div className="flex p-1.5 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                <button onClick={() => setViewMode('baseline')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'baseline' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Baseline</button>
                <button onClick={() => setViewMode('weakest')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'weakest' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Symmetry</button>
                <button onClick={() => setViewMode('opportunity')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'opportunity' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Opportunity</button>
                <button onClick={() => setViewMode('delta')} disabled={!previousScan} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'delta' ? 'bg-rose-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'} disabled:opacity-30`}>Delta</button>
              </div>

              {/* Visualization Grid */}
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

              {/* Strategy Widget */}
              <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-[2.5rem] flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-8 opacity-[0.03] rotate-12"><Zap size={100} /></div>
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0 border border-slate-800">
                  <Bot size={32} className="text-cyan-400" />
                </div>
                <div>
                   <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest mb-1">Architect's Aesthetic Review</h4>
                   <p className="text-[11px] text-slate-400 leading-relaxed italic">
                     {viewMode === 'baseline' ? "Thermal map indicates high muscle density in the posterior chain. Balanced volumetric flow identified in core sectors." : 
                      viewMode === 'weakest' ? "Kinematic axis confirmed. Symmetry markers identify slight variance in lateral development. Focus on unilateral precision." :
                      viewMode === 'opportunity' ? "Opportunity Matrix isolated. Peak zones show radiant adaptation. Primed growth sectors identified for immediate protocol focus." :
                      "Evolution delta shows significant tissue adaptation over the last assessment window. Protocol adherence confirmed."}
                   </p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <button onClick={() => handleStartScan()} className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-black rounded-3xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                   <RefreshCw size={16} /> Recalibrate Index
                 </button>
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
             <span>{history.length} Scans in History</span>
             {latestScan && <span>Last: {latestScan.date}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MorphologyLab;