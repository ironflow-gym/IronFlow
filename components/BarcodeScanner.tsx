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
import Modal, { dialogButton, dialogField, dialogPrimaryButton } from './ui/Modal';

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
  const decoderRef = useRef<{ stop: () => void } | null>(null);
  const CONFIRM_FRAMES  = 2;

  const [mode, setMode]             = useState<'loading' | 'scanning' | 'denied' | 'unsupported'>('loading');
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const stopStream = () => {
    cancelAnimationFrame(rafRef.current);
    decoderRef.current?.stop(); decoderRef.current = null;
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

      const controls = await reader.decodeFromVideoElement(videoRef.current, (result: any, _error: unknown, controls: { stop: () => void }) => {
        if (firedRef.current) { controls.stop(); return; }
        if (result) {
          const code = result.getText();
          evaluateCode(code);
          if (firedRef.current) controls.stop();
        }
      });
      if (firedRef.current || !streamRef.current) controls.stop(); else decoderRef.current = controls;
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

  return <Modal label="Scan barcode" title="Scan barcode" closeLabel="Close barcode scanner" onClose={handleClose}>
    <div className="space-y-4">
      <div className="relative h-48 overflow-hidden rounded-xl bg-black"><video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-emerald-400" />
      </div>
      <p role="status" className="text-sm text-slate-300">{mode === 'loading' ? 'Starting camera…' : mode === 'scanning' ? 'Align the barcode in the frame.' : mode === 'denied' ? 'Camera access was denied. You can enter the code below.' : 'Live scanning is unavailable. You can enter the code below.'}</p>
      {confirming && mode === 'scanning' && <p className="text-sm text-emerald-300">Reading {confirming}…</p>}
      <button type="button" className={dialogButton} aria-expanded={showManual} onClick={() => setShowManual(value => !value)}>Enter code manually</button>
      {showManual && <form className="space-y-3" onSubmit={event => { event.preventDefault(); handleManualSubmit(); }}>
        <label className="block">Barcode numbers<input className={dialogField} type="text" inputMode="numeric" value={manualCode} onChange={e => setManualCode(e.target.value)} placeholder="For example, 9300652014097" /></label>
        <p className="text-sm text-slate-300">Enter 8–14 digits, including any leading zeros.</p>
        <button className={dialogPrimaryButton} type="submit" disabled={!isValidFoodBarcode(manualCode)}>Look up barcode</button>
      </form>}
    </div>
  </Modal>;
};

export default BarcodeScanner;
