/**
 * BarcodeScanner.tsx
 *
 * Full-screen camera overlay that detects EAN-13 / UPC-A / UPC-E barcodes.
 *
 * Strategy:
 *   1. Try the native BarcodeDetector API (Chrome, Edge, Safari 17+).
 *   2. If unavailable, dynamically load @zxing/browser as a CDN ESM fallback.
 *   3. If camera permission is denied, show a manual entry field.
 *
 * Props:
 *   onDetected(barcode: string) — called once when a barcode is confirmed.
 *   onClose() — called when the user dismisses without scanning.
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

const FOOD_FORMATS = ['ean_13', 'upc_a', 'upc_e', 'ean_8'];

function isValidFoodBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code.trim());
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onDetected, onClose }) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);
  // Ref-based detection state — avoids stale closure issues in scan loops
  const firedRef        = useRef(false);   // ensure onDetected fires at most once
  const lastCodeRef     = useRef<string | null>(null);
  const consecutiveRef  = useRef(0);
  const CONFIRM_FRAMES  = 2;

  const [mode, setMode]             = useState<'loading' | 'scanning' | 'denied' | 'unsupported'>('loading');
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const stopStream = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const fire = (code: string) => {
    if (firedRef.current) return;
    firedRef.current = true;
    stopStream();
    onDetected(code.trim());
  };

  const evaluateCode = (code: string) => {
    if (!isValidFoodBarcode(code)) return;
    if (code === lastCodeRef.current) {
      consecutiveRef.current++;
      if (consecutiveRef.current >= CONFIRM_FRAMES) {
        fire(code);
      }
    } else {
      lastCodeRef.current = code;
      consecutiveRef.current = 1;
      setConfirming(code);
    }
  };

  const startNativeLoop = (detector: any) => {
    const scan = async () => {
      if (firedRef.current) return;
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }
      try {
        const results = await detector.detect(videoRef.current);
        if (results.length > 0) {
          evaluateCode(results[0].rawValue);
        } else {
          consecutiveRef.current = 0;
        }
      } catch {
        // Frame decode errors are normal
      }
      if (!firedRef.current) {
        rafRef.current = requestAnimationFrame(scan);
      }
    };
    rafRef.current = requestAnimationFrame(scan);
  };

  const startZxingLoop = async () => {
    try {
      const cdnUrl = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm';
      // eslint-disable-next-line no-new-func
      const mod = await new Function('u', 'return import(u)')(cdnUrl);
      const reader = new mod.BrowserMultiFormatReader();
      if (!videoRef.current) return;

      await reader.decodeFromVideoElement(videoRef.current, (result: any) => {
        if (firedRef.current) { reader.reset(); return; }
        if (result) {
          const code = result.getText();
          evaluateCode(code);
          if (firedRef.current) reader.reset();
        }
      });
    } catch {
      setMode('unsupported');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        if (!cancelled) setMode('denied');
        return;
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if ('BarcodeDetector' in window) {
        try {
          const supported = await (window as any).BarcodeDetector.getSupportedFormats();
          const formats = FOOD_FORMATS.filter(f => supported.includes(f));
          const detector = new (window as any).BarcodeDetector({
            formats: formats.length ? formats : FOOD_FORMATS,
          });
          if (!cancelled) { setMode('scanning'); startNativeLoop(detector); }
          return;
        } catch { /* fall through to ZXing */ }
      }

      if (!cancelled) { setMode('scanning'); startZxingLoop(); }
    };

    start();
    return () => { cancelled = true; stopStream(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (isValidFoodBarcode(code)) fire(code);
  };

  const handleClose = () => { stopStream(); onClose(); };

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col animate-in fade-in duration-300">

      <style>{`
        @keyframes barcode-beam {
          0%   { top: 5%;  opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 95%; opacity: 0; }
        }
        .barcode-beam {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(to right, transparent, #fb923c, transparent);
          box-shadow: 0 0 16px #fb923c, 0 0 40px rgba(251,146,60,0.4);
          animation: barcode-beam 1.8s linear infinite;
          z-index: 10;
        }
      `}</style>

      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      <div className="absolute inset-0 flex flex-col pointer-events-none">
        <div className="flex-1 bg-black/65" />
        <div className="flex" style={{ height: 200 }}>
          <div className="flex-1 bg-black/65" />
          <div className="relative" style={{ width: 300 }}>
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />
            {mode === 'scanning' && <div className="barcode-beam" />}
            <div className="absolute inset-0 bg-orange-500/5" />
          </div>
          <div className="flex-1 bg-black/65" />
        </div>
        <div className="flex-1 bg-black/65" />
      </div>

      <div className="relative z-10 flex justify-between items-center px-6 pt-12 pb-4">
        <div>
          <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em]">Barcode Scanner</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            {mode === 'loading'  ? 'Starting Camera...' :
             mode === 'scanning' ? 'Align Barcode in Frame' :
             mode === 'denied'   ? 'Camera Access Denied' :
                                   'Scanner Unavailable'}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="p-3 bg-slate-900/80 backdrop-blur-md rounded-2xl text-white border border-white/10 hover:bg-slate-800 transition-all active:scale-90"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-end pb-16 px-6 gap-6">

        {confirming && mode === 'scanning' && (
          <div className="px-6 py-3 bg-orange-500/20 border border-orange-500/40 rounded-2xl backdrop-blur-md">
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest text-center">
              Confirming: {confirming}
            </p>
          </div>
        )}

        <button
          onClick={() => setShowManual(v => !v)}
          className="flex items-center gap-2 px-5 py-3 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl text-slate-300 hover:text-white transition-all active:scale-95"
        >
          <Keyboard size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Enter Code Manually</span>
        </button>

        {showManual && (
          <div className="w-full max-w-xs bg-slate-900/95 backdrop-blur-md border border-orange-500/30 rounded-3xl p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-200">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
              Type barcode numbers (8–14 digits)
            </p>
            <input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 9300652014097"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-sm font-black text-slate-100 outline-none focus:ring-1 focus:ring-orange-500/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={handleManualSubmit}
              disabled={!isValidFoodBarcode(manualCode)}
              className="w-full py-3 bg-orange-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black rounded-2xl uppercase tracking-widest text-[10px] active:scale-95 transition-all"
            >
              Look Up
            </button>
          </div>
        )}

        {(mode === 'denied' || mode === 'unsupported') && !showManual && (
          <div className="text-center px-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {mode === 'denied'
                ? 'Allow camera access in your browser settings, or enter the barcode manually above.'
                : 'Live scanning is not supported on this browser. Enter the barcode manually above.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;
