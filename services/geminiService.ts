import { GoogleGenAI, Type } from "@google/genai";
import { WorkoutTemplate, HistoricalLog, ExerciseLibraryItem, BiometricEntry, MorphologyAssessment, FuelLog, FuelProfile, FoodItem } from "../types";
import { isCardioCategory, isAssisted } from "../src/utils";
import { storage } from "./storageService";

// =============================================================================
// Model Configuration
// =============================================================================

/** Structured generation, interactive tasks, vision. Fast and capable.
 *  gemini-2.5-flash: stable, $0.30/$2.50 per 1M tokens. */
const MODEL_FLASH = 'gemini-2.5-flash';

/** Simple extractions, short text generation, background tasks. Lowest cost.
 *  gemini-2.5-flash-lite: stable, $0.10/$0.40 per 1M tokens. */
const MODEL_LITE = 'gemini-2.5-flash-lite';

/** Google Search grounding combined with JSON schema output.
 *  Only supported on Gemini 3 series — gemini-2.5-flash does not support
 *  this combination. Used exclusively for searchExerciseOnline. */
const MODEL_SEARCH = 'gemini-3-flash-preview';

// =============================================================================
// Error Classification
// =============================================================================

export type GeminiErrorKind =
  | 'rate-limit-rpm'
  | 'rate-limit-rpd'
  | 'rate-limit-tpm'
  | 'overloaded'
  | 'timeout'
  | 'invalid-key'
  | 'invalid-request'
  | 'unknown';

export class GeminiError extends Error {
  kind: GeminiErrorKind;
  retryable: boolean;
  retryAfterSeconds?: number;

  constructor(kind: GeminiErrorKind, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'GeminiError';
    this.kind = kind;
    this.retryable = kind !== 'invalid-key' && kind !== 'invalid-request';
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }

  get userMessage(): string {
    switch (this.kind) {
      case 'rate-limit-rpm':  return 'API rate limit reached (too many requests). Wait a minute and try again.';
      case 'rate-limit-tpm':  return 'API token limit reached for this minute. Wait a moment and try again.';
      case 'rate-limit-rpd':  return 'Daily API quota exhausted. Usage resets at midnight Pacific Time — try again tomorrow.';
      case 'overloaded':      return 'Gemini servers are busy. Try again in a few minutes.';
      case 'timeout':         return 'Request timed out — the prompt may be too large. Try again or use a shorter input.';
      case 'invalid-key':     return 'API key is invalid or missing. Add your Gemini API key in Settings → AI Engine.';
      case 'invalid-request': return `Invalid request: ${this.message}`;
      default:                return `AI request failed: ${this.message}`;
    }
  }
}

function parseGeminiError(e: unknown, context: string): GeminiError {
  const raw = e instanceof Error ? e.message : String(e);
  const statusMatch = raw.match(/got status:\s*(\d+)/i) || raw.match(/"code":\s*(\d+)/);
  const status = statusMatch ? parseInt(statusMatch[1]) : 0;
  const statusStrMatch = raw.match(/"status":\s*"([^"]+)"/);
  const statusStr = statusStrMatch ? statusStrMatch[1] : '';
  const reasonMatch = raw.match(/"reason":\s*"([^"]+)"/);
  const reason = reasonMatch ? reasonMatch[1].toLowerCase() : '';
  const retryMatch = raw.match(/retry.after:\s*(\d+)/i);
  const retryAfter = retryMatch ? parseInt(retryMatch[1]) : undefined;

  if (status === 429 || statusStr === 'RESOURCE_EXHAUSTED') {
    if (reason.includes('daily') || raw.toLowerCase().includes('per day') || raw.toLowerCase().includes('rpd'))
      return new GeminiError('rate-limit-rpd', raw, 86400);
    if (raw.toLowerCase().includes('token') || raw.toLowerCase().includes('tpm'))
      return new GeminiError('rate-limit-tpm', raw, retryAfter ?? 60);
    return new GeminiError('rate-limit-rpm', raw, retryAfter ?? 60);
  }
  if (status === 503 || statusStr === 'UNAVAILABLE')
    return new GeminiError('overloaded', raw, retryAfter ?? 120);
  if (status === 504 || statusStr === 'DEADLINE_EXCEEDED')
    return new GeminiError('timeout', raw);
  if (status === 400 && (raw.toLowerCase().includes('api key') || raw.toLowerCase().includes('invalid key')))
    return new GeminiError('invalid-key', raw);
  if (status === 401 || status === 403)
    return new GeminiError('invalid-key', raw);
  if (status === 400)
    return new GeminiError('invalid-request', raw);
  return new GeminiError('unknown', `${context}: ${raw}`);
}

// =============================================================================

const getLocalDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
};

const parseLocal = (dStr: string) => {
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Personality prefix injected into conversational system instructions.
// Structural/JSON methods are never affected.
const PERSONALITY_PREFIXES: Record<string, string> = {
  neutral: '',
  elite:   'You communicate as an elite performance coach — precise, data-driven, and direct. No padding, no encouragement for its own sake. Every sentence earns its place.',
  gymbro:  'You are an enthusiastic gym bro — hyped, casual, uses gym slang naturally (gains, PR, swole, crushing it, lets gooo). Keep the energy high but the numbers accurate. Never sacrifice correctness for vibes.',
};

const BYOK_STORAGE_KEY = 'ironflow_gemini_key';
const BYOK_PAID_STORAGE_KEY = 'ironflow_gemini_key_paid';

export function getBYOKKey(): string | null {
  try { return localStorage.getItem(BYOK_STORAGE_KEY) || null; } catch { return null; }
}

export function setBYOKKey(key: string): void {
  try { localStorage.setItem(BYOK_STORAGE_KEY, key.trim()); } catch {}
}

export function removeBYOKKey(): void {
  try { localStorage.removeItem(BYOK_STORAGE_KEY); } catch {}
}

export function hasBYOKKey(): boolean {
  return !!getBYOKKey();
}

export function getBYOKPaidKey(): string | null {
  try { return localStorage.getItem(BYOK_PAID_STORAGE_KEY) || null; } catch { return null; }
}

export function setBYOKPaidKey(key: string): void {
  try { localStorage.setItem(BYOK_PAID_STORAGE_KEY, key.trim()); } catch {}
}

export function removeBYOKPaidKey(): void {
  try { localStorage.removeItem(BYOK_PAID_STORAGE_KEY); } catch {}
}

export class GeminiService {
  private _ai: GoogleGenAI | null = null;
  private _aiPaid: GoogleGenAI | null = null;
  private _freeKeyExhausted: boolean = false; // RPD exhaustion flag — reset on page load
  private _personalityPrefix: string = '';
  private _wordMultiplier: number = 1;

  private get ai(): GoogleGenAI {
    if (!this._ai) {
      const apiKey = getBYOKKey() || process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        throw new GeminiError("invalid-key", "API key not configured");
      }
      this._ai = new GoogleGenAI({ apiKey });
    }
    return this._ai;
  }

  private get aiPaid(): GoogleGenAI | null {
    const paidKey = getBYOKPaidKey();
    if (!paidKey) return null;
    if (!this._aiPaid) {
      this._aiPaid = new GoogleGenAI({ apiKey: paidKey });
    }
    return this._aiPaid;
  }

  /**
   * Core fallback wrapper. Tries the free key first unless it is known to be
   * RPD-exhausted for this session. On RPD exhaustion, falls through to the
   * paid key if available. RPM exhaustion retries on paid immediately since
   * it's a transient per-minute limit rather than a day-level quota.
   *
   * If no paid key is configured, errors propagate normally.
   */
  private async callWithFallback(
    params: Parameters<GoogleGenAI['models']['generateContent']>[0]
  ): Promise<Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>> {
    const paid = this.aiPaid;

    // If free key is known exhausted for today, go straight to paid
    if (this._freeKeyExhausted && paid) {
      return paid.models.generateContent(params);
    }

    try {
      return await this.ai.models.generateContent(params);
    } catch (e) {
      const parsed = parseGeminiError(e, 'callWithFallback');

      // RPD exhaustion — mark free key as exhausted and fall through to paid
      if (parsed.kind === 'rate-limit-rpd' && paid) {
        this._freeKeyExhausted = true;
        console.info('[IronFlow] Free API key RPD exhausted — switching to paid key for this session');
        return paid.models.generateContent(params);
      }

      // RPM limit — also fall through to paid if available (transient, not worth waiting)
      if (parsed.kind === 'rate-limit-rpm' && paid) {
        return paid.models.generateContent(params);
      }

      throw e;
    }
  }

  /** Force re-initialisation after a key change. */
  resetKey(): void {
    this._ai = null;
    this._aiPaid = null;
    this._freeKeyExhausted = false;
  }

  /**
   * Validate a key by making the cheapest possible real API call.
   * Returns null on success, or a user-facing error string on failure.
   * Quota errors are NOT treated as key errors.
   */
  async validateKey(key: string): Promise<string | null> {
    try {
      const testAi = new GoogleGenAI({ apiKey: key.trim() });
      await testAi.models.generateContent({
        model: MODEL_LITE,
        contents: 'Hi',
        config: { maxOutputTokens: 1 }
      });
      return null; // success
    } catch (e: unknown) {
      const err = parseGeminiError(e, 'validateKey');
      // Quota errors mean the key IS valid — just exhausted
      if (err.kind === 'rate-limit-rpm' || err.kind === 'rate-limit-tpm' || err.kind === 'rate-limit-rpd') {
        return null;
      }
      if (err.kind === 'invalid-key') return 'Invalid API key — check you copied it correctly.';
      return 'Could not reach Gemini — check your connection and try again.';
    }
  }

  constructor() {}

  /**
   * Called by App.tsx whenever UserSettings change.
   * Updates personality prefix and word-limit multiplier for conversational methods.
   */
  configure(settings: { aiPersonality?: string; aiPersonalityCustom?: string }) {
    const p = settings.aiPersonality || 'neutral';
    if (p === 'custom') {
      const raw = (settings.aiPersonalityCustom || '').trim().slice(0, 200);
      // Interpolate as style directive, not free instruction, to limit injection surface
      this._personalityPrefix = raw
        ? `Adopt this communication style: "${raw.replace(/"/g, "'")}".`
        : '';
    } else {
      this._personalityPrefix = PERSONALITY_PREFIXES[p] ?? '';
    }
    // Non-neutral personalities get 60% more words
    this._wordMultiplier = (p === 'neutral') ? 1 : 1.6;
  }

  /** Prepend personality prefix to a system instruction string. */
  private withPersonality(instruction: string): string {
    return this._personalityPrefix
      ? `${this._personalityPrefix} ${instruction}`
      : instruction;
  }

  /** Scale a word/sentence count by the current word multiplier, rounded. */
  private w(n: number): number {
    return Math.round(n * this._wordMultiplier);
  }

  private async getCurrentPhysicalStatus(): Promise<string> {
    const biometrics = await storage.get<BiometricEntry[]>('ironflow_biometrics') || [];
    const clean = this.sanitizeBiometrics(biometrics, 1);
    if (clean.length === 0) return "Unknown (No biometric data registered)";
    const latest = clean[0];
    return `Current Absolute State: ${latest.weight}${latest.unit} as of ${latest.date}${latest.bodyFat ? ` (${latest.bodyFat}% body fat) ` : ''}.`;
  }

  /**
   * Returns a compact string describing WSR and (for males) WCR from the
   * most recent biometric entry. Returns null if insufficient data.
   * Used to inform program generation and optimisation prompts.
   */
  private async getAestheticRatioContext(): Promise<string | null> {
    const biometrics = await storage.get<BiometricEntry[]>('ironflow_biometrics') || [];
    const settings = await storage.get<any>('ironflow_settings');
    const isFemale = settings?.gender === 'female';
    // Access raw BiometricEntry directly — sanitizeBiometrics strips measurement
    // fields (waist/shoulders/chest) that we need here. Apply only the essential
    // validity filter (weight > 0) and take the most recent entry by date.
    const valid = biometrics
      .filter(b => b.weight > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (valid.length === 0) return null;
    const b = valid[0];
    const parts: string[] = [];
    // WSR — meaningful for all genders
    if (b.waist && b.shoulders) {
      const wsr = (b.waist / b.shoulders).toFixed(3);
      const wsrStatus = parseFloat(wsr) < 0.62 ? 'Elite' : parseFloat(wsr) < 0.70 ? 'Advanced' : parseFloat(wsr) < 0.80 ? 'Athletic' : 'Developing';
      parts.push(`WSR ${wsr} (${wsrStatus} — waist ${b.waist}cm / shoulders ${b.shoulders}cm)`);
    }
    // WCR — males only
    if (!isFemale && b.waist && b.chest) {
      const wcr = (b.waist / b.chest).toFixed(3);
      const wcrStatus = parseFloat(wcr) < 0.75 ? 'Elite V-taper' : parseFloat(wcr) < 0.85 ? 'Athletic Proportions' : parseFloat(wcr) < 0.95 ? 'Developing' : 'Foundation stage';
      parts.push(`WCR ${wcr} (${wcrStatus} — waist ${b.waist}cm / chest ${b.chest}cm)`);
    }
    if (parts.length === 0) return null;
    return `Aesthetic ratios as of ${b.date}: ${parts.join('; ')}. Use these to bias exercise selection and volume — prioritise muscle groups that will most improve the weakest ratio.`;
  }

  private async getPairedContext(history: HistoricalLog[]): Promise<any[]> {
    const biometrics = await storage.get<BiometricEntry[]>('ironflow_biometrics') || [];
    if (biometrics.length === 0) {
      // Return same session-grouped shape as the biometrics path below
      const clean = this.sanitizeHistory(history);
      const byDate: Record<string, HistoricalLog[]> = {};
      clean.forEach(log => {
        if (!byDate[log.date]) byDate[log.date] = [];
        byDate[log.date].push(log);
      });
      return Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 20)
        .map(([date, logs]) => ({
          date,
          bodyweightAtTime: 'No weigh-in data for this period',
          logs: logs.map(l => ({ ex: l.exercise, w: l.weight, r: l.reps }))
        }));
    }
    // Sanitize biometrics: 6-month cap, sorted descending, impossible values stripped
    const cleanBios = this.sanitizeBiometrics(biometrics, 50); // keep enough to pair with any session
    const sanitizedHistory = this.sanitizeHistory(history);
    const groupedByDate: Record<string, HistoricalLog[]> = {};
    sanitizedHistory.forEach(log => {
      if (!groupedByDate[log.date]) groupedByDate[log.date] = [];
      groupedByDate[log.date].push(log);
    });
    return Object.entries(groupedByDate).map(([date, logs]) => {
      const workoutDate = parseLocal(date);
      // cleanBios is sorted descending — find most recent weigh-in on or before workout date
      const bio = cleanBios.find(b => parseLocal(b.date) <= workoutDate);
      return {
        date,
        bodyweightAtTime: bio
          ? { weight: bio.weight, unit: bio.unit, ...(bio.bodyFat !== undefined && { bf: bio.bodyFat }) }
          : 'No weigh-in data for this period',
        logs: logs.map(l => ({ ex: l.exercise, w: l.weight, r: l.reps }))
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }

  private sanitizeHistory(history: HistoricalLog[]): HistoricalLog[] {
    const now = new Date().getTime();
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

    // Strip cardio logs entirely — weight=distance, reps=duration encoding
    // would corrupt any weight-calibration or trend analysis.
    const resistanceOnly = history.filter(log => !isCardioCategory(log.category));

    // Build daily peaks per exercise. For assisted exercises lower weight = harder,
    // so the 'peak' (best effort) is the minimum weight on that day.
    const dailyExercisePeaks: Record<string, number> = {};
    resistanceOnly.forEach(log => {
      const key = `${log.date}_${log.exercise}`;
      const assisted = isAssisted(log.exercise);
      if (!dailyExercisePeaks[key] ||
          (assisted ? log.weight < dailyExercisePeaks[key] : log.weight > dailyExercisePeaks[key])) {
        dailyExercisePeaks[key] = log.weight;
      }
    });

    const filtered = resistanceOnly.filter(log => {
      const logDate = parseLocal(log.date).getTime();
      if ((now - logDate) > SIX_MONTHS_MS) return false;
      const peakWeight = dailyExercisePeaks[`${log.date}_${log.exercise}`] || 0;
      // Statistical warmup detection: skip for assisted (inverted scale makes it unreliable).
      const isStatisticalWarmup = !isAssisted(log.exercise) &&
        peakWeight > 0 && log.weight <= (peakWeight * 0.6);
      return !log.isWarmup && !isStatisticalWarmup;
    });

    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Sanitizes biometric history before passing to AI:
   * - Caps to 6 months (same window as sanitizeHistory)
   * - Sorts by date descending (never rely on storage order)
   * - Filters impossible values (weight ≤ 0, bodyFat outside 2–60%)
   * - Projects only AI-relevant fields, omitting undefined optionals
   */
  private sanitizeBiometrics(
    biometrics: BiometricEntry[],
    maxEntries: number = 5
  ): Array<{ date: string; weight: number; unit: string; bodyFat?: number }> {
    const now = Date.now();
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    return [...biometrics]
      .filter(b => {
        const age = now - parseLocal(b.date).getTime();
        if (age > SIX_MONTHS_MS) return false;
        if (!b.weight || b.weight <= 0) return false;
        if (b.bodyFat !== undefined && (b.bodyFat <= 2 || b.bodyFat > 60)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, maxEntries)
      .map(b => ({
        date: b.date,
        weight: b.weight,
        unit: b.unit,
        ...(b.bodyFat !== undefined && { bodyFat: b.bodyFat })
      }));
  }

  /**
   * Groups sanitized history into sessions (by date), takes the N most recent
   * dates, then returns a per-exercise summary the AI can use to calibrate weights.
   * Keying by exercise means the AI sees clear recent-history per movement
   * rather than a flat blob where it has to guess which sets belong to which.
   *
   * Output shape: { exercise: string, recentSets: { date, weight, reps }[] }[]
   * sorted by exercise name for determinism.
   */
  private recentSessionsByExercise(
    history: HistoricalLog[],
    numSessions: number = 12
  ): { exercise: string; recentSets: { date: string; w: number; r: number }[] }[] {
    const clean = this.sanitizeHistory(history);

    // Group by date, newest first
    const byDate: Record<string, HistoricalLog[]> = {};
    clean.forEach(log => {
      if (!byDate[log.date]) byDate[log.date] = [];
      byDate[log.date].push(log);
    });
    const recentDates = Object.keys(byDate)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, numSessions);

    // Flatten those sessions, group by exercise
    const byExercise: Record<string, { date: string; w: number; r: number }[]> = {};
    recentDates.forEach(date => {
      byDate[date].forEach(log => {
        if (!byExercise[log.exercise]) byExercise[log.exercise] = [];
        byExercise[log.exercise].push({ date, w: log.weight, r: log.reps });
      });
    });

    return Object.entries(byExercise)
      .map(([exercise, recentSets]) => ({ exercise, recentSets }))
      .sort((a, b) => a.exercise.localeCompare(b.exercise));
  }

  async analyzeMorphology(
    input:
      | { mode: '8'; images: { upperFront: string; upperBack: string; upperLeft: string; upperRight: string; lowerFront: string; lowerBack: string; lowerLeft: string; lowerRight: string } }
      | { mode: '4'; images: { front: string; left: string; back: string; right: string } }
  ): Promise<MorphologyAssessment> {
    const imgData = (dataUrl: string) => ({ inlineData: { mimeType: 'image/jpeg' as const, data: dataUrl.split(',')[1] } });
    const parts = input.mode === '8'
      ? [
          imgData(input.images.upperFront), imgData(input.images.upperBack),
          imgData(input.images.upperLeft), imgData(input.images.upperRight),
          imgData(input.images.lowerFront), imgData(input.images.lowerBack),
          imgData(input.images.lowerLeft), imgData(input.images.lowerRight),
          { text: `Analyze these 8 physique photos (4 upper body: front/back/left/right, 4 lower body: front/back/left/right). Score each muscle group 0-100: 0=undeveloped, 50=intermediate amateur, 100=elite competitive level. Base scores on visible size, separation, and symmetry.` }
        ]
      : [
          imgData(input.images.front), imgData(input.images.left),
          imgData(input.images.back), imgData(input.images.right),
          { text: `Analyze these 4 full-body physique photos (front/left/back/right). Each image shows the complete body from head to toe. Score each muscle group 0-100: 0=undeveloped, 50=intermediate amateur, 100=elite competitive level. Base scores on visible size, separation, and symmetry for all muscle groups visible across the 4 angles.` }
        ];
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: { parts },
        config: {
          systemInstruction: "You are an IFBB-certified physique judge with 20 years of competitive experience. Assess muscle development objectively based on visible size, separation, and symmetry. Be precise and consistent across all muscle groups.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shoulders: { type: Type.NUMBER },
              chest: { type: Type.NUMBER },
              abs: { type: Type.NUMBER },
              biceps: { type: Type.NUMBER },
              triceps: { type: Type.NUMBER },
              forearms: { type: Type.NUMBER },
              quads: { type: Type.NUMBER },
              hamstrings: { type: Type.NUMBER },
              calves: { type: Type.NUMBER },
              upperBack: { type: Type.NUMBER },
              lowerBack: { type: Type.NUMBER },
              lats: { type: Type.NUMBER },
              glutes: { type: Type.NUMBER }
            },
            required: ["shoulders", "chest", "abs", "biceps", "triceps", "forearms", "quads", "hamstrings", "calves", "upperBack", "lowerBack", "lats", "glutes"]
          }
        }
      });
      return JSON.parse(response.text?.trim() || '{}');
    } catch (e) { throw parseGeminiError(e, "analyzeMorphology"); }
  }

  async parseFuelPrompt(prompt: string, profile: FuelProfile, pantryContext?: FoodItem[]): Promise<{ logs: FuelLog[], updatedProfile?: FuelProfile }> {
    const now = getLocalDateString();
    const pantryText = pantryContext ? `PANTRY DATA (Priority matches): ${JSON.stringify(pantryContext)}` : "";
    const prefText = profile.preferences && profile.preferences.length > 0
      ? `Dietary restrictions/preferences: ${profile.preferences.join(', ')}.`
      : "";
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: `Date: ${now}. Goal: ${profile.goal}. Protein target: ${profile.targetProteinRatio}g/kg. ${prefText} ${pantryText}\nUser input: "${prompt}"`,
        config: {
          systemInstruction: "You are a sports nutritionist. Do three things: (1) Extract food items and macros from the user input — prioritise exact pantry matches over estimates. Confidence: 1.0=exact pantry match, 0.8=well-known product, 0.5=estimated. If a food conflicts with a stated dietary restriction (e.g. dairy for lactose intolerant, meat for vegan, wheat for gluten-free), set confidence to 0.1 and prefix the food name with '[CHECK: conflicts with restriction]'. (2) If the input includes goal-setting or dietary preference statements (e.g. 'I want to lose fat', 'I am vegetarian', 'I'm bulking', 'high protein', 'cut calories'), return updatedProfile with the appropriate goal and/or preferences array. When setting targetProteinRatio, use these evidence-based defaults: Build Muscle = 1.6 g/kg, Lose Fat = 1.8 g/kg (higher protein preserves lean mass during caloric restriction), Maintenance = 1.2 g/kg. Adjust upward by 15% for vegan, 8% for vegetarian. If no goal/preference information is present, omit updatedProfile entirely. (3) Never invent macro data — if a food is ambiguous, use confidence 0.5 and realistic estimates.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              logs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    calories: { type: Type.NUMBER },
                    protein: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                    fats: { type: Type.NUMBER },
                    confidence: { type: Type.NUMBER },
                    pantryItemId: { type: Type.STRING }
                  },
                  required: ["name", "calories", "protein", "carbs", "fats", "confidence"]
                }
              },
              updatedProfile: {
                type: Type.OBJECT,
                properties: {
                  goal: { type: Type.STRING, enum: ['Build Muscle', 'Lose Fat', 'Maintenance'] },
                  preferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                  targetProteinRatio: { type: Type.NUMBER },
                  targetMultiplier: { type: Type.NUMBER }
                }
              }
            },
            required: ["logs"]
          }
        }
      });
      const parsed = JSON.parse(response.text?.trim() || '{}');
      const date = getLocalDateString();
      const logsWithId = (parsed.logs || []).map((l: any) => ({ ...l, id: Math.random().toString(36).substr(2, 9), date }));
      return { logs: logsWithId, updatedProfile: parsed.updatedProfile };
    } catch (e) { throw parseGeminiError(e, "parseFuelPrompt"); }
  }

  async analyzeNutritionPanel(imageData: string): Promise<Partial<FoodItem>> {
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageData.split(',')[1] } },
            { text: "Extract nutrition data from this label exactly as printed: product name, brand, serving size, and per-serving macros (Calories, Protein, Carbs, Fats). Do not estimate — only report what is visible." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              brand: { type: Type.STRING },
              servingSize: { type: Type.STRING },
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fats: { type: Type.NUMBER }
            },
            required: ["name", "calories", "protein", "carbs", "fats", "servingSize"]
          }
        }
      });
      return JSON.parse(response.text?.trim() || '{}');
    } catch (e) { throw parseGeminiError(e, "analyzeNutritionPanel"); }
  }

  /**
   * Look up foods by name from the Australian Food Composition Database (AFCD)
   * or general nutritional knowledge. Returns values per 100g with a default
   * serving size — the user can adjust serving size after import.
   */
  // ── AFCD local database cache ──────────────────────────────────────────────
  private afcdCache: FoodItem[] | null = null;

  private async loadAFCD(): Promise<FoodItem[]> {
    if (this.afcdCache) return this.afcdCache;
    try {
      const res = await fetch('./afcd.json');
      if (!res.ok) throw new Error(`AFCD fetch failed: ${res.status}`);
      this.afcdCache = await res.json();
      return this.afcdCache!;
    } catch {
      this.afcdCache = [];
      return [];
    }
  }

  private searchAFCDLocal(db: FoodItem[], query: string): FoodItem[] {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    return db
      .map(item => {
        const name = item.name.toLowerCase();
        // Score: all terms present = higher score, exact phrase = highest
        const allMatch = terms.every(t => name.includes(t));
        if (!allMatch) return null;
        const exactPhrase = name.includes(query.toLowerCase());
        const score = (exactPhrase ? 100 : 0) + terms.reduce((s, t) => s + (name.startsWith(t) ? 10 : 5), 0);
        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 6)
      .map(r => ({ ...r!.item, id: Math.random().toString(36).substr(2, 9) }));
  }

  private async searchOpenFoodFacts(query: string): Promise<FoodItem[]> {
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=6&fields=product_name,brands,nutriments,serving_size,categories_tags&tagtype_0=countries&tag_contains_0=contains&tag_0=australia`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const products = data.products || [];
      return products
        .filter((p: any) => p.product_name && p.nutriments)
        .map((p: any) => {
          const n = p.nutriments;
          return {
            id: Math.random().toString(36).substr(2, 9),
            name: p.product_name,
            brand: p.brands || undefined,
            category: 'Packaged Foods',
            servingSize: p.serving_size || '100g',
            protein: Math.round((n['proteins_100g'] || 0) * 10) / 10,
            carbs: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
            fats: Math.round((n['fat_100g'] || 0) * 10) / 10,
            calories: Math.round((n['energy-kcal_100g'] || (n['energy_100g'] || 0) * 0.239) * 10) / 10,
            source: 'OpenFoodFacts' as any,
          };
        });
    } catch {
      return [];
    }
  }

  /**
   * Two-tier food search:
   * 1. AFCD local JSON bundle — official Australian Food Composition Database,
   *    1588 foods, zero hallucination, served from a bundled static asset.
   * 2. Open Food Facts fallback — real product label data for branded/packaged
   *    foods not in AFCD. Australian product filter applied.
   */
  async searchAFCD(query: string): Promise<FoodItem[]> {
    const db = await this.loadAFCD();
    const afcdResults = this.searchAFCDLocal(db, query);

    if (afcdResults.length >= 3) {
      // Enough AFCD results — return immediately, no network call needed
      return afcdResults;
    }

    // Supplement with Open Food Facts for branded/packaged foods
    const offResults = await this.searchOpenFoodFacts(query);

    // Merge: AFCD first, then OFF results not already covered by name
    const afcdNames = new Set(afcdResults.map(r => r.name.toLowerCase()));
    const newOff = offResults.filter(r => !afcdNames.has(r.name.toLowerCase()));

    return [...afcdResults, ...newOff].slice(0, 8);
  }

  /**
   * Import nutritional data from a product URL (e.g. supermarket product page,
   * branded food site). Uses Google Search grounding to find the product and
   * extract nutrition panel data.
   */
  async scrapeFoodSite(url: string): Promise<FoodItem[]> {
    try {
      // Step 1: fetch the page content via URL context tool (supported with Gemini 3)
      // Step 2: extract structured nutrition data — no googleSearch to avoid the
      // built-in tool + responseSchema conflict that affects Gemini 3 models.
      const fetchResponse = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: `Extract all nutrition panel data from this product page URL: ${url}\n\nFor each product found, return: name, brand, macros per 100g (protein, carbs, fats, calories), typical serving size, and food category. If values are shown per serve, convert to per 100g using the stated serving size. Return up to 5 products. Use 0 for any genuinely unavailable macro value.`,
        config: {
          tools: [{ urlContext: {} }],
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                brand: { type: Type.STRING },
                servingSize: { type: Type.STRING },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fats: { type: Type.NUMBER },
                calories: { type: Type.NUMBER },
                category: { type: Type.STRING }
              },
              required: ["name", "protein", "carbs", "fats", "calories", "servingSize"]
            }
          }
        }
      });
      const items = JSON.parse(fetchResponse.text?.trim() || '[]');
      return items.map((i: any) => ({ ...i, id: Math.random().toString(36).substr(2, 9) }));
    } catch (e) { throw parseGeminiError(e, "scrapeFoodSite"); }
  }

  async generateProgramFromPrompt(prompt: string, history: HistoricalLog[], libraryNames: string[]): Promise<WorkoutTemplate> {
    const historyText = JSON.stringify(this.recentSessionsByExercise(history, 12));
    const ratioContext = await this.getAestheticRatioContext();
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: `Request: ${prompt}\n\nRecent history by exercise (last 12 sessions, use to calibrate weights and avoid fatigue overlap):\n${historyText}\n\nAvailable exercises: ${JSON.stringify(libraryNames)}${ratioContext ? `\n\nPhysique ratios: ${ratioContext}` : ''}`,
        config: {
          systemInstruction: "You are an elite strength and conditioning coach. Design a single workout that fulfils the request. Use the available exercise library. Set realistic weights from history. Ensure agonist/antagonist balance and minimal overlap with recent sessions.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    suggestedSets: { type: Type.NUMBER },
                    targetReps: { type: Type.STRING },
                    suggestedWeight: { type: Type.NUMBER },
                    suggestedReps: { type: Type.NUMBER },
                    rationale: { type: Type.STRING }
                  },
                  required: ["name", "category", "suggestedSets", "targetReps", "suggestedWeight", "suggestedReps", "rationale"]
                }
              }
            },
            required: ["name", "exercises"]
          }
        }
      });
      const parsed = JSON.parse(response.text?.trim() || '{}');
      // Zero out suggestedWeight for any exercise the user already has history for —
      // the progression algorithm will take over. Only keep AI weight for cold starts.
      if (parsed.exercises && history.length > 0) {
        const knownExercises = new Set(history.map((h: HistoricalLog) => h.exercise.toLowerCase()));
        parsed.exercises = parsed.exercises.map((ex: any) => ({
          ...ex,
          suggestedWeight: knownExercises.has(ex.name?.toLowerCase()) ? 0 : ex.suggestedWeight
        }));
      }
      return parsed;
    } catch (e) { throw parseGeminiError(e, "generateProgramFromPrompt"); }
  }

  async generateMultiWorkoutProgram(prompt: string, workoutCount: number, history: HistoricalLog[], libraryNames: string[]): Promise<WorkoutTemplate[]> {
    const historyText = JSON.stringify(this.recentSessionsByExercise(history, 16));
    const ratioContext = await this.getAestheticRatioContext();
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: `Goal: ${prompt}\nCycle length: exactly ${workoutCount} sessions.\n\nHistory by exercise (last 16 sessions, calibrate weights and identify overworked patterns):\n${historyText}\n\nAvailable exercises: ${JSON.stringify(libraryNames)}${ratioContext ? `\n\nPhysique ratios: ${ratioContext}` : ''}`,
        config: {
          systemInstruction: "You are an elite periodisation coach. Design a cycle with exactly the requested number of sessions. Distribute volume intelligently — no session should excessively overlap with adjacent ones. Apply progressive overload and cover all major movement patterns (push, pull, hinge, squat) across the cycle.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              templates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    exercises: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          category: { type: Type.STRING },
                          suggestedSets: { type: Type.NUMBER },
                          targetReps: { type: Type.STRING },
                          suggestedWeight: { type: Type.NUMBER },
                          suggestedReps: { type: Type.NUMBER },
                          rationale: { type: Type.STRING }
                        },
                        required: ["name", "category", "suggestedSets", "targetReps", "suggestedWeight", "suggestedReps", "rationale"]
                      }
                    }
                  },
                  required: ["name", "exercises"]
                }
              }
            },
            required: ["templates"]
          }
        }
      });
      const parsed = JSON.parse(response.text?.trim() || '{}');
      const knownExercises = history.length > 0
        ? new Set(history.map((h: HistoricalLog) => h.exercise.toLowerCase()))
        : new Set<string>();
      const templates = (parsed.templates || []).map((t: any) => ({
        ...t,
        exercises: (t.exercises || []).map((ex: any) => ({
          ...ex,
          suggestedWeight: knownExercises.has(ex.name?.toLowerCase()) ? 0 : ex.suggestedWeight
        }))
      }));
      return templates;
    } catch (e) { throw parseGeminiError(e, "generateMultiWorkoutProgram"); }
  }

  /**
   * Neural pre-flight: lightweight second-pass audit run immediately after
   * program generation. The model reviews its own output for balance, recovery
   * and overlap with the user's existing saved templates, then returns a
   * refined version of the program alongside a concise list of changes made.
   * Returns an empty changes array when the program needed no adjustment.
   * Uses MODEL_LITE to keep latency low — this is a polish pass, not a redesign.
   */
  async preFlightCheck(
    generated: WorkoutTemplate[],
    savedTemplates: WorkoutTemplate[],
    history: HistoricalLog[],
    originalPrompt: string
  ): Promise<{ templates: WorkoutTemplate[]; changes: string[] }> {
    const slimSummary = (templates: WorkoutTemplate[]) =>
      templates.map(t =>
        `  ${t.name}: ${t.exercises.map(e => `${e.name} (${e.category})`).join(', ')}`
      ).join('\n');

    const existingBlock = savedTemplates.length
      ? `EXISTING SAVED TEMPLATES (check for redundancy and recovery conflicts):\n${slimSummary(savedTemplates)}`
      : `EXISTING SAVED TEMPLATES: none.`;

    const recentLoad = JSON.stringify(this.recentSessionsByExercise(history, 8));

    const contents =
`You designed the following program in response to a user request. Review it as the author before delivery.

ORIGINAL USER REQUEST: "${originalPrompt}"

GENERATED PROGRAM:
${slimSummary(generated)}

${existingBlock}

RECENT TRAINING LOAD (last 8 sessions by exercise):
${recentLoad}

Check for:
1. Muscle group imbalance within the generated program (push/pull ratio, quad/posterior chain)
2. Insufficient recovery — same muscle group hit in back-to-back sessions
3. Redundant exercises — near-identical movement patterns in the same session
4. Significant overlap with existing saved templates the user already owns

PROTECTED EXERCISES — STRICT RULE: Only exercises whose exact name (or a clear abbreviation of it) appears literally in the original user request text above are protected. Exercises you chose to include based on programming judgement are NOT protected and may be freely replaced. For a protected exercise you would otherwise swap out: keep it in the program and add a note formatted as "Considered replacing [exercise] with [alternative] to [reason] — retained as it was explicitly requested."

You are free to replace, reorder or remove any exercise that was not literally named in the request. Make targeted corrections only. Do not redesign. If the program is sound, return it unchanged with an empty changes array.
Return each change or noted consideration as a short plain-English phrase. Maximum 4 entries.`;

    try {
      const response = await this.callWithFallback({
        model: MODEL_LITE,
        contents,
        config: {
          systemInstruction: "You are a strength coach reviewing your own program before delivery. You may freely replace any exercise you chose based on programming judgement. Only exercises literally named by the user in their request are protected from replacement — all others are fair game. Make targeted corrections where needed. Return the corrected program and a concise list of changes, or an empty changes array if nothing needed addressing.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              templates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    exercises: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name:            { type: Type.STRING },
                          category:        { type: Type.STRING },
                          suggestedSets:   { type: Type.NUMBER },
                          targetReps:      { type: Type.STRING },
                          suggestedWeight: { type: Type.NUMBER },
                          suggestedReps:   { type: Type.NUMBER },
                          rationale:       { type: Type.STRING }
                        },
                        required: ["name", "category", "suggestedSets", "targetReps", "suggestedWeight", "suggestedReps", "rationale"]
                      }
                    }
                  },
                  required: ["name", "exercises"]
                }
              },
              changes: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["templates", "changes"]
          }
        }
      });
      const parsed = JSON.parse(response.text?.trim() || '{}');
      // Re-apply the suggestedWeight=0 rule for known exercises — preflight
      // must not reintroduce AI weights the generation pass already zeroed out.
      const knownExercises = history.length > 0
        ? new Set(history.map((h: HistoricalLog) => h.exercise.toLowerCase()))
        : new Set<string>();
      const templates = (parsed.templates || generated).map((t: any) => ({
        ...t,
        exercises: (t.exercises || []).map((ex: any) => ({
          ...ex,
          suggestedWeight: knownExercises.has(ex.name?.toLowerCase()) ? 0 : ex.suggestedWeight
        }))
      }));
      return { templates, changes: parsed.changes || [] };
    } catch (e) {
      // Preflight failure is non-fatal — return original program unchanged
      console.warn('preFlightCheck failed, returning original program', e);
      return { templates: generated, changes: [] };
    }
  }

  async generateProgramNarrative(templates: WorkoutTemplate[], goal: string): Promise<string> {
    const cycleData = templates.map(t => ({
      name: t.name,
      exercises: t.exercises.map(e => e.name),
      isCustomized: !!t.isCustomized
    }));
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: `Goal: ${goal}\nProgram: ${JSON.stringify(cycleData)}\n\nIn 60-70 words, explain: volume distribution, fatigue management, and session sequencing logic. If any session is isCustomized=true, note how those edits affect cycle integrity.`,
        config: { systemInstruction: "You are an exercise physiologist. Write concise technical programming summaries. No motivational language — clinical analysis only." }
      });
      return response.text || "Structural validation complete.";
    } catch (e) { throw parseGeminiError(e, "generateProgramNarrative"); }
  }

  async refineProgramBatch(templates: WorkoutTemplate[], instruction: string, history: HistoricalLog[], libraryNames: string[]): Promise<{ templates: WorkoutTemplate[], narrative: string }> {
    const historyText = JSON.stringify(this.recentSessionsByExercise(history, 8));
    const ratioContext = await this.getAestheticRatioContext();
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: `Modification: "${instruction}"\n\nProgram: ${JSON.stringify(templates)}\nHistory: ${historyText}\nLibrary: ${JSON.stringify(libraryNames)}${ratioContext ? `\nPhysique ratios: ${ratioContext}` : ''}`,
        config: {
          systemInstruction: "You are a periodisation coach. Apply the modification across all sessions while preserving structural balance. If intensity increases in one area, reduce volume elsewhere to prevent overtraining. Return updated program and a 30-40 word explanation of changes made.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              templates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    exercises: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          category: { type: Type.STRING },
                          suggestedSets: { type: Type.NUMBER },
                          targetReps: { type: Type.STRING },
                          suggestedWeight: { type: Type.NUMBER },
                          suggestedReps: { type: Type.NUMBER },
                          rationale: { type: Type.STRING }
                        },
                        required: ["name", "category", "suggestedSets", "targetReps", "suggestedWeight", "suggestedReps", "rationale"]
                      }
                    }
                  },
                  required: ["name", "exercises"]
                }
              },
              narrative: { type: Type.STRING }
            },
            required: ["templates", "narrative"]
          }
        }
      });
      return JSON.parse(response.text?.trim() || '{}');
    } catch (e) { throw parseGeminiError(e, "refineProgramBatch"); }
  }

  async critiqueTemplateChanges(
    template: WorkoutTemplate,
    contextProgram?: WorkoutTemplate[],
    allSavedTemplates?: WorkoutTemplate[]
  ): Promise<string> {
    // Build a lean schedule summary — names and exercise categories only,
    // no weights/sets/reps — to keep token usage low regardless of roster size.
    const slimSummary = (templates: WorkoutTemplate[]) =>
      templates.map(t => `  - ${t.name}: ${t.exercises.map(e => `${e.name} (${e.category})`).join(', ')}`).join('\n');

    const programLines  = contextProgram?.length
      ? `Same program (other days):\n${slimSummary(contextProgram)}`
      : null;
    const rosterLines   = allSavedTemplates?.length
      ? `Other saved templates:\n${slimSummary(allSavedTemplates)}`
      : null;
    const scheduleBlock = [programLines, rosterLines].filter(Boolean).join('\n');

    const scheduleSection = scheduleBlock
      ? `TRAINING SCHEDULE CONTEXT:\n${scheduleBlock}\n\nThe user trains across multiple sessions. Use this full schedule when assessing movement pattern balance.`
      : `TRAINING SCHEDULE CONTEXT: No other sessions available — assess this template as a standalone programme.`;

    // Summarise the template under review (full detail — this is what's being audited)
    const templateSummary = `Name: "${template.name}"\nExercises:\n${
      template.exercises.map(e => `  - ${e.name} (${e.category})`).join('\n')
    }`;

    const contents =
`TEMPLATE UNDER REVIEW:
${templateSummary}

${scheduleSection}

Infer the intended scope of this session from its name and exercise selection (e.g. Push, Pull, Upper, Lower, Full Body, Arms). Treat that scope as intentional — do not flag the absence of movement patterns that fall outside this session's role UNLESS they are also absent from every other session in the schedule above.

Audit for:
(1) Internal conflicts: redundant exercises, excessive volume on a single joint, poor sequencing, rep ranges mismatched to apparent goal.
(2) Schedule-level gaps: movement patterns missing from this session AND from all other sessions listed above — only flag if genuinely uncovered across the full roster.
(3) Exercise quality: poor substitutions or selections given this session's scope.

Reference specific exercises by name. 2 short paragraphs maximum.`;

    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents,
        config: { systemInstruction: "You are an exercise physiologist specialising in resistance training. Give direct clinical feedback only — do not be encouraging. Only flag genuine programming issues, not deliberate design decisions." }
      });
      return response.text || "Audit complete.";
    } catch (e) { throw parseGeminiError(e, "critiqueTemplateChanges"); }
  }

  async reoptimizeTemplate(template: WorkoutTemplate, history: HistoricalLog[]): Promise<WorkoutTemplate> {
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: `Current template: ${JSON.stringify(template)}\n\nRecent performance by exercise (last 12 sessions): ${JSON.stringify(this.recentSessionsByExercise(history, 12))}`,
        config: {
          systemInstruction: "You are a strength coach. Review the template and recent performance. Adjust exercise selection, set counts, rep ranges (targetReps), and rationale if needed. Do NOT set suggestedWeight — weight calibration is handled algorithmically from history. Set suggestedWeight to 0 for all exercises. You may adjust suggestedReps only if the current rep range is clearly wrong for the goal.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    suggestedSets: { type: Type.NUMBER },
                    targetReps: { type: Type.STRING },
                    suggestedWeight: { type: Type.NUMBER },
                    suggestedReps: { type: Type.NUMBER },
                    rationale: { type: Type.STRING }
                  },
                  required: ["name", "category", "suggestedSets", "targetReps", "suggestedWeight", "suggestedReps", "rationale"]
                }
              }
            },
            required: ["name", "exercises"]
          }
        }
      });
      const parsed = JSON.parse(response.text?.trim() || '{}');
      // Force suggestedWeight to 0 — weight is owned by the progression algorithm
      if (parsed.exercises) {
        parsed.exercises = parsed.exercises.map((ex: any) => ({ ...ex, suggestedWeight: 0 }));
      }
      return { ...parsed, lastRefreshed: Date.now() };
    } catch (e) { throw parseGeminiError(e, "reoptimizeTemplate"); }
  }

  async editTemplateWithAI(template: WorkoutTemplate, instruction: string): Promise<WorkoutTemplate> {
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: `Modification: "${instruction}"\n\nTemplate: ${JSON.stringify(template)}`,
        config: {
          systemInstruction: "Apply the modification exactly as requested. Preserve all unaffected exercises, sets, reps, and weights. Only change what the instruction specifies.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    suggestedSets: { type: Type.NUMBER },
                    targetReps: { type: Type.STRING },
                    suggestedWeight: { type: Type.NUMBER },
                    suggestedReps: { type: Type.NUMBER },
                    rationale: { type: Type.STRING }
                  },
                  required: ["name", "category", "suggestedSets", "targetReps", "suggestedWeight", "suggestedReps", "rationale"]
                }
              }
            },
            required: ["name", "exercises"]
          }
        }
      });
      return JSON.parse(response.text?.trim() || '{}');
    } catch (e) { throw parseGeminiError(e, "editTemplateWithAI"); }
  }

  async parseBiometricsPrompt(prompt: string, unit: 'kgs' | 'lbs'): Promise<Partial<BiometricEntry>[]> {
    const now = getLocalDateString();
    try {
      const response = await this.callWithFallback({
        model: MODEL_LITE,
        contents: `Today: ${now}. Preferred unit: ${unit}. User input: "${prompt}"`,
        config: {
          systemInstruction: "Extract biometric measurements from the input. Convert all values to the preferred unit. Use today's date if none specified. Only return fields explicitly mentioned — do not estimate missing values.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                weight: { type: Type.NUMBER },
                bodyFat: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
                waist: { type: Type.NUMBER },
                chest: { type: Type.NUMBER },
                shoulders: { type: Type.NUMBER },
                neck: { type: Type.NUMBER },
                hips: { type: Type.NUMBER }
              },
              required: ["date"]
            }
          }
        }
      });
      return JSON.parse(response.text?.trim() || '[]');
    } catch (e) { throw parseGeminiError(e, "parseBiometricsPrompt"); }
  }

  async matchExercisesToLibrary(importedNames: string[], libraryNames: string[]): Promise<any[]> {
    try {
      const response = await this.callWithFallback({
        model: MODEL_SEARCH,
        contents: `Imported names: ${JSON.stringify(importedNames)}\n\nStandard library: ${JSON.stringify(libraryNames)}`,
        config: {
          systemInstruction: "Match each imported exercise name to the closest library equivalent, accounting for abbreviations and naming variants (e.g. DB Bench = Dumbbell Bench Press). If no close match exists, set isNew=true and use search to find the exercise so you can suggest a clean standardised name and the correct category.",
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                importedName: { type: Type.STRING },
                matches: { type: Type.ARRAY, items: { type: Type.STRING } },
                isNew: { type: Type.BOOLEAN },
                suggestedStandardName: { type: Type.STRING },
                suggestedCategory: { type: Type.STRING }
              },
              required: ["importedName", "matches", "isNew", "suggestedStandardName", "suggestedCategory"]
            }
          }
        }
      });
      return JSON.parse(response.text?.trim() || '[]');
    } catch (e) {
      // Graceful fallback — return passthrough matches so import doesn't fail entirely
      return importedNames.map(name => ({ importedName: name, matches: [], isNew: true, suggestedStandardName: name, suggestedCategory: "Other" }));
    }
  }

  async suggestSwaps(exerciseName: string, category: string): Promise<any[]> {
    try {
      const response = await this.callWithFallback({
        model: MODEL_LITE,
        contents: `Exercise to replace: "${exerciseName}" (${category})`,
        config: {
          systemInstruction: "Suggest 4-5 alternatives targeting the same primary muscle and movement pattern. Include equipment variety (barbell, dumbbell, cable, bodyweight). For each, give a one-sentence rationale for why it is a valid substitute.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              alternatives: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    rationale: { type: Type.STRING }
                  },
                  required: ["name", "category", "rationale"]
                }
              }
            },
            required: ["alternatives"]
          }
        }
      });
      const parsed = JSON.parse(response.text?.trim() || '{}');
      return parsed.alternatives || [];
    } catch (e) { return []; }
  }

  async searchExerciseOnline(exerciseName: string): Promise<ExerciseLibraryItem> {
    try {
      const response = await this.callWithFallback({
        model: MODEL_SEARCH,
        contents: `Find complete technique instructions for: "${exerciseName}". Include setup, execution, tempo, breathing, primary muscles, benefits, and injury risks.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              muscles: { type: Type.ARRAY, items: { type: Type.STRING } },
              instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
              benefits: { type: Type.STRING },
              risks: { type: Type.STRING },
              methodology: {
                type: Type.OBJECT,
                properties: {
                  setup: { type: Type.ARRAY, items: { type: Type.STRING } },
                  execution: { type: Type.ARRAY, items: { type: Type.STRING } },
                  tempo: { type: Type.STRING },
                  breathing: { type: Type.STRING },
                  cues: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["setup", "execution", "tempo", "breathing", "cues"]
              }
            },
            required: ["name", "category", "muscles", "instructions", "benefits", "risks", "methodology"]
          }
        }
      });
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sourceUrl = groundingChunks[0]?.web?.uri || 'https://www.google.com/search?q=' + encodeURIComponent(exerciseName);
      const parsed = JSON.parse(response.text?.trim() || '{}');
      return { ...parsed, sourceUrl };
    } catch (e) { throw parseGeminiError(e, "searchExerciseOnline"); }
  }

  async autopopulateExerciseLibrary(count: number, bodyParts: string[], existingNames: string[]): Promise<ExerciseLibraryItem[]> {
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: `Generate ${count} exercises for: ${bodyParts.join(', ')}.\n\nDo not include any of these already in the library: ${JSON.stringify(existingNames)}`,
        config: {
          systemInstruction: "You are a certified personal trainer building a comprehensive exercise database. Generate diverse exercises across equipment types (barbell, dumbbell, cable, machine, bodyweight). Avoid duplicating any exercise already in the library. Ensure variety of movement patterns.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                category: { type: Type.STRING },
                muscles: { type: Type.ARRAY, items: { type: Type.STRING } },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                benefits: { type: Type.STRING },
                risks: { type: Type.STRING },
                methodology: {
                  type: Type.OBJECT,
                  properties: {
                    setup: { type: Type.ARRAY, items: { type: Type.STRING } },
                    execution: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tempo: { type: Type.STRING },
                    breathing: { type: Type.STRING },
                    cues: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["setup", "execution", "tempo", "breathing", "cues"]
                }
              },
              required: ["name", "category", "muscles", "instructions", "benefits", "risks", "methodology"]
            }
          }
        }
      });
      return JSON.parse(response.text?.trim() || '[]');
    } catch (e) { throw parseGeminiError(e, "autopopulateExerciseLibrary"); }
  }

  async getExerciseAdvice(exerciseName: string, recentSets: any[], history: HistoricalLog[]): Promise<string> {
    const pairedContext = await this.getPairedContext(history);
    const exerciseHistory = pairedContext.filter(session => session.logs.some((l: any) => l.ex === exerciseName)).slice(0, 5);
    try {
      const response = await this.callWithFallback({
        model: MODEL_LITE,
        contents: `Exercise: ${exerciseName}\nToday's sets: ${JSON.stringify(recentSets)}\nLast 5 sessions: ${JSON.stringify(exerciseHistory)}`,
        config: { systemInstruction: this.withPersonality(`You are a strength coach giving real-time feedback. Compare today's performance to recent history. Comment on load progression, rep trends, or fatigue. Be specific — reference the actual numbers. ${this.w(2)}-${this.w(3)} sentences only.`) }
      });
      return response.text || "Continue protocol.";
    } catch (e) { throw parseGeminiError(e, "getExerciseAdvice"); }
  }

  async getWorkoutInspiration(history: HistoricalLog[], query?: string): Promise<{ title: string; summary: string; why: string; sourceUrl: string; template: WorkoutTemplate }[]> {
    const pairedContext = await this.getPairedContext(history);
    try {
      const response = await this.callWithFallback({
        model: MODEL_FLASH,
        contents: `Request: "${query || "suggest balanced progression based on my recent training"}"\n\nRecent history: ${JSON.stringify(pairedContext.slice(0, 10))}`,
        config: {
          systemInstruction: "You are a strength coach with deep knowledge of evidence-based training protocols. Suggest 3 workout protocols that respond to the request and complement the user's recent training. For each: a clear title, 1-2 sentence protocol summary, and a specific reason it suits this user's current training pattern.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                why: { type: Type.STRING },
                template: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    exercises: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          category: { type: Type.STRING },
                          suggestedSets: { type: Type.NUMBER },
                          targetReps: { type: Type.STRING },
                          suggestedWeight: { type: Type.NUMBER },
                          suggestedReps: { type: Type.NUMBER },
                          rationale: { type: Type.STRING }
                        },
                        required: ["name", "category", "suggestedSets", "targetReps", "suggestedWeight", "suggestedReps", "rationale"]
                      }
                    }
                  },
                  required: ["name", "exercises"]
                }
              },
              required: ["title", "summary", "why", "template"]
            }
          }
        }
      });
      const parsed = JSON.parse(response.text?.trim() || '[]');
      return parsed.map((item: any) => ({ ...item, sourceUrl: '' }));
    } catch (e) { throw parseGeminiError(e, "getWorkoutInspiration"); }
  }

  async getWorkoutMotivation(currentSession: HistoricalLog[], history: HistoricalLog[]): Promise<string> {
    const sortedHistory = [...history].sort((a, b) => b.date.localeCompare(a.date));
    const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
    let streakHistory: HistoricalLog[] = [];
    if (sortedHistory.length > 0) {
      for (let i = 0; i < sortedHistory.length; i++) {
        if (i > 0) {
          const d1 = parseLocal(sortedHistory[i-1].date).getTime();
          const d2 = parseLocal(sortedHistory[i].date).getTime();
          if (d1 - d2 >= THREE_MONTHS_MS) break;
        }
        streakHistory.push(sortedHistory[i]);
      }
    }
    streakHistory.reverse();

    // Transform cardio logs into human-readable shape before serializing.
    // Raw logs encode distance as weight and duration as reps, which the AI
    // misreads as load/reps. This is a local transform — no shared pipeline touched.
    const toReadable = (logs: HistoricalLog[]) => logs.map(log => {
      if (!isCardioCategory(log.category)) return log;
      const dist = log.distance ?? log.weight;
      const dur = log.duration ?? log.reps;
      const unit = log.distanceUnit ?? (log.unit === 'lbs' ? 'mi' : 'km');
      const mins = Math.round(dur / 60);
      return {
        date: log.date,
        exercise: log.exercise,
        category: log.category,
        distance: `${dist}${unit}`,
        duration: mins > 0 ? `${mins}min` : `${dur}s`,
      };
    });

    try {
      const response = await this.callWithFallback({
        model: MODEL_LITE,
        contents: `Session Data: ${JSON.stringify(toReadable(currentSession))}. Recent Training Context (last 20 sessions): ${JSON.stringify(toReadable(streakHistory.slice(-20)))}.`,
        config: {
          systemInstruction: this.withPersonality(`You are an experienced strength and conditioning coach reviewing a completed session. Go beyond just listing what was lifted — provide genuine coaching insight. Cover: (1) one meaningful observation about performance today vs recent history — was this a strong session, a maintenance session, a grind? (2) one specific technical or programming suggestion for the next session based on what you see — e.g. readiness to push weight on a lift, a muscle group that looks undertrained, or a recovery cue if volume was high. Write in second person, direct and specific. Reference actual exercises and numbers. Positive but honest tone — not cheerleading, not clinical. Max ${this.w(100)} words.`)
        }
      });
      return response.text || "Session registered.";
    } catch (e) { throw parseGeminiError(e, "getWorkoutMotivation"); }
  }

  async getProgressReview(history: HistoricalLog[], biometrics: BiometricEntry[]): Promise<string> {
    try {
      const response = await this.callWithFallback({
        model: MODEL_LITE,
        contents: `Training logs (last 12 sessions by exercise): ${JSON.stringify(this.recentSessionsByExercise(history, 12))}\nBiometrics (last 5, recent 6 months): ${JSON.stringify(this.sanitizeBiometrics(biometrics, 5))}`,
        config: { systemInstruction: this.withPersonality(`You are an experienced strength coach conducting a weekly check-in. Go beyond describing what happened — give actionable coaching guidance. Cover: (1) the most significant training trend this week, good or bad, with specific reference to exercises and numbers; (2) one concrete suggestion for next week — a lift to push, a volume adjustment, a muscle group needing attention, or a recovery recommendation; (3) if biometric data is available, briefly note whether body composition is moving in the right direction relative to apparent training effort. Positive but direct tone. ${this.w(4)}-${this.w(5)} sentences. No bullet points — write as a coach would speak.`) }
      });
      return response.text || "Trend stable.";
    } catch (e) { throw parseGeminiError(e, "getProgressReview"); }
  }
}
