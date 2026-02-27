import React, { useState, useRef } from 'react';
import { Key, ExternalLink, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowRight, X, ChevronLeft } from 'lucide-react';
import { GeminiService, setBYOKKey } from '../services/geminiService';

interface ApiKeyModalProps {
  aiService: GeminiService;
  onSuccess: () => void;
  onDismiss: () => void;
  /** If true, shown as an inline sheet (from Settings). If false, full-screen onboarding. */
  inline?: boolean;
}

type Step = 'get' | 'paste' | 'done';

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ aiService, onSuccess, onDismiss, inline = false }) => {
  const [step, setStep] = useState<Step>('get');
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleValidate = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setValidating(true);
    setError(null);
    const result = await aiService.validateKey(trimmed);
    setValidating(false);
    if (result) {
      setError(result);
    } else {
      setBYOKKey(trimmed);
      aiService.resetKey();
      setStep('done');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleValidate();
  };

  const maskedPreview = keyInput.length > 8
    ? '••••••••••••••••' + keyInput.slice(-4)
    : keyInput;

  const inner = (
    <div className={`flex flex-col ${inline ? '' : 'min-h-full'}`}>

      {/* ── Step indicator ─────────────────────────────────────────────────── */}
      {step !== 'done' && (
        <div className="flex items-center gap-2 mb-8">
          {(['get', 'paste'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${
                step === s
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                  : step === 'paste' && s === 'get'
                  ? 'bg-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 text-slate-600'
              }`}>{i + 1}</div>
              {i === 0 && <div className={`flex-1 h-px transition-all duration-500 ${step === 'paste' ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ── Step: Get key ──────────────────────────────────────────────────── */}
      {step === 'get' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-3">
            <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tighter">Get your API key</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              IronFlow uses Google's Gemini AI for coaching, program generation, and performance analysis. You'll need a free Gemini API key to unlock these features.
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How it works</p>
            <div className="space-y-2.5">
              {[
                'Google AI Studio gives you a free API key',
                'You paste it here — it stays on your device only',
                'Free tier includes generous daily usage limits',
              ].map((txt, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-black text-emerald-400">{i + 1}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{txt}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-[11px]"
            >
              <ExternalLink size={16} />
              Open Google AI Studio
            </a>
            <button
              onClick={() => setStep('paste')}
              className="w-full py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              I already have a key <ArrowRight size={14} />
            </button>
          </div>

          {!inline && (
            <button
              onClick={onDismiss}
              className="w-full py-3 text-slate-600 font-black text-[9px] uppercase tracking-widest hover:text-slate-400 transition-colors"
            >
              Skip for now — use IronFlow without AI features
            </button>
          )}
        </div>
      )}

      {/* ── Step: Paste key ────────────────────────────────────────────────── */}
      {step === 'paste' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-3">
            <button
              onClick={() => { setStep('get'); setError(null); setKeyInput(''); }}
              className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors mb-2"
            >
              <ChevronLeft size={12} /> Back
            </button>
            <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tighter">Paste your key</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Copy your key from Google AI Studio and paste it below. It starts with <span className="font-black text-slate-300">AIza</span>.
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <input
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={e => { setKeyInput(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                placeholder="AIzaSy..."
                autoFocus
                className={`w-full bg-slate-950 border rounded-2xl px-5 py-4 pr-14 text-sm font-mono text-slate-100 outline-none transition-all ${
                  error
                    ? 'border-rose-500/60 focus:ring-1 focus:ring-rose-500/30'
                    : 'border-slate-700 focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/50'
                }`}
              />
              <button
                onClick={() => setShowKey(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                tabIndex={-1}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 animate-in fade-in duration-200">
                <AlertCircle size={14} className="shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
              </div>
            )}

            {keyInput.length > 4 && !error && (
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-1">{maskedPreview}</p>
            )}
          </div>

          <button
            onClick={handleValidate}
            disabled={!keyInput.trim() || validating}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-[11px]"
          >
            {validating
              ? <><Loader2 className="animate-spin" size={16} /> Validating...</>
              : <><Key size={16} /> Connect AI Engine</>
            }
          </button>

          <p className="text-[9px] text-slate-600 leading-relaxed text-center italic">
            Your key is stored locally on this device and never sent anywhere except Google's own servers.
          </p>
        </div>
      )}

      {/* ── Step: Done ─────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-400 text-center">
          <div className="relative inline-block mx-auto">
            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
            <div className="relative w-20 h-20 bg-slate-950 border-4 border-emerald-500/50 rounded-full flex items-center justify-center mx-auto shadow-2xl">
              <CheckCircle2 className="text-emerald-400" size={36} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tighter">AI Engine Active</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your Gemini key is validated and stored. All AI coaching features are now unlocked.
            </p>
          </div>
          <button
            onClick={onSuccess}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 uppercase tracking-widest text-[11px]"
          >
            Start Training
          </button>
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 animate-in fade-in slide-in-from-top-2 duration-300">
        {inner}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tighter">IronFlow</h1>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">AI Coaching Companion</p>
          </div>
          <button onClick={onDismiss} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>
        {inner}
      </div>
    </div>
  );
};

export default ApiKeyModal;
