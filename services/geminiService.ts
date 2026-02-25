import { GoogleGenAI, Type } from "@google/genai";
import { WorkoutTemplate, HistoricalLog, ExerciseLibraryItem, BiometricEntry, MorphologyAssessment, FuelLog, FuelProfile, FoodItem } from "../types";
import { storage } from "./storageService";

// =============================================================================
// Model Configuration
// =============================================================================

/** Heavy multimodal reasoning (e.g. image analysis). Highest quality, highest cost. */
const MODEL_PRO = 'gemini-3-pro-preview';

/** Structured generation, interactive tasks, grounded search, vision. Fast and capable. */
const MODEL_FLASH = 'gemini-3-flash-preview';

/** Simple extractions, short text generation, background tasks. Lowest cost. */
const MODEL_LITE = 'gemini-2.5-flash-lite-preview-09-2025';

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
      case 'invalid-key':     return 'API key is invalid or missing. Check your environment configuration.';
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

export class GeminiService {
  private _ai: GoogleGenAI | null = null;

  private get ai(): GoogleGenAI {
    if (!this._ai) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        throw new GeminiError("invalid-key", "API key not configured");
      }
      this._ai = new GoogleGenAI({ apiKey });
    }
    return this._ai;
  }

  constructor() {}

  private async getCurrentPhysicalStatus(): Promise<string> {
    const biometrics = await storage.get<BiometricEntry[]>('ironflow_biometrics') || [];
    if (biometrics.length === 0) return "Unknown (No biometric data registered)";
    const sorted = [...biometrics].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    return `Current Absolute State: ${latest.weight}${latest.unit} as of ${latest.date}${latest.bodyFat ? ` (${latest.bodyFat}% body fat) ` : ''}.`;
  }

  private async getPairedContext(history: HistoricalLog[]): Promise<any[]> {
    const biometrics = await storage.get<BiometricEntry[]>('ironflow_biometrics') || [];
    if (biometrics.length === 0) return history.slice(-50);
    const sortedBios = [...biometrics].sort((a, b) => b.date.localeCompare(a.date));
    const sanitizedHistory = this.sanitizeHistory(history);
    const groupedByDate: Record<string, HistoricalLog[]> = {};
    sanitizedHistory.forEach(log => {
      if (!groupedByDate[log.date]) groupedByDate[log.date] = [];
      groupedByDate[log.date].push(log);
    });
    return Object.entries(groupedByDate).map(([date, logs]) => {
      const workoutDate = parseLocal(date);
      const bio = sortedBios.find(b => parseLocal(b.date) <= workoutDate);
      return {
        date,
        bodyweightAtTime: bio ? { weight: bio.weight, unit: bio.unit, bf: bio.bodyFat } : "No weigh-in data for this period",
        logs: logs.map(l => ({ ex: l.exercise, w: l.weight, r: l.reps }))
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }

  private sanitizeHistory(history: HistoricalLog[]): HistoricalLog[] {
    const now = new Date().getTime();
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    const dailyExercisePeaks: Record<string, number> = {};
    history.forEach(log => {
      const key = `${log.date}_${log.exercise}`;
      if (!dailyExercisePeaks[key] || log.weight > dailyExercisePeaks[key]) {
        dailyExercisePeaks[key] = log.weight;
      }
    });
    let filtered = history.filter(log => {
      const logDate = parseLocal(log.date).getTime();
      const peakWeight = dailyExercisePeaks[`${log.date}_${log.exercise}`] || 0;
      const isStatisticalWarmup = peakWeight > 0 && log.weight <= (peakWeight * 0.6);
      const effectiveIsWarmup = log.isWarmup || isStatisticalWarmup;
      return !effectiveIsWarmup && (now - logDate) <= SIX_MONTHS_MS;
    });
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }

  async analyzeMorphology(images: {
    upperFront: string; upperBack: string; upperLeft: string; upperRight: string;
    lowerFront: string; lowerBack: string; lowerLeft: string; lowerRight: string;
  }): Promise<MorphologyAssessment> {
    const parts = [
      { inlineData: { mimeType: "image/jpeg", data: images.upperFront.split(',')[1] } },
      { inlineData: { mimeType: "image/jpeg", data: images.upperBack.split(',')[1] } },
      { inlineData: { mimeType: "image/jpeg", data: images.upperLeft.split(',')[1] } },
      { inlineData: { mimeType: "image/jpeg", data: images.upperRight.split(',')[1] } },
      { inlineData: { mimeType: "image/jpeg", data: images.lowerFront.split(',')[1] } },
      { inlineData: { mimeType: "image/jpeg", data: images.lowerBack.split(',')[1] } },
      { inlineData: { mimeType: "image/jpeg", data: images.lowerLeft.split(',')[1] } },
      { inlineData: { mimeType: "image/jpeg", data: images.lowerRight.split(',')[1] } },
      { text: `Analyze these 8 physique photos (upper/lower x front/back/left/right). Score each muscle group 0-100: 0=undeveloped, 50=intermediate amateur, 100=elite competitive level. Base scores on visible size, separation, and symmetry.` }
    ];
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_PRO,
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
      const response = await this.ai.models.generateContent({
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
      const response = await this.ai.models.generateContent({
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

  async scrapeFoodSite(url: string): Promise<FoodItem[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Find nutritional data for foods or products from this source: ${url}. Retrieve up to 20 items with per-serving macros (protein, carbs, fats, calories) and serving sizes.`,
        config: {
          tools: [{ googleSearch: {} }],
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
                calories: { type: Type.NUMBER }
              },
              required: ["name", "protein", "carbs", "fats", "calories", "servingSize"]
            }
          }
        }
      });
      const items = JSON.parse(response.text?.trim() || '[]');
      return items.map((i: any) => ({ ...i, id: Math.random().toString(36).substr(2, 9) }));
    } catch (e) { throw parseGeminiError(e, "scrapeFoodSite"); }
  }

  async generateProgramFromPrompt(prompt: string, history: HistoricalLog[], libraryNames: string[]): Promise<WorkoutTemplate> {
    const historyText = JSON.stringify(history.slice(-30).map(h => ({ d: h.date, ex: h.exercise, w: h.weight, r: h.reps })));
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Request: ${prompt}\n\nRecent history (calibrate weights, avoid fatigue overlap):\n${historyText}\n\nAvailable exercises: ${JSON.stringify(libraryNames)}`,
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
      return JSON.parse(response.text?.trim() || '{}');
    } catch (e) { throw parseGeminiError(e, "generateProgramFromPrompt"); }
  }

  async generateMultiWorkoutProgram(prompt: string, workoutCount: number, history: HistoricalLog[], libraryNames: string[]): Promise<WorkoutTemplate[]> {
    const historyText = JSON.stringify(history.slice(-40).map(h => ({ d: h.date, ex: h.exercise, w: h.weight, r: h.reps })));
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Goal: ${prompt}\nCycle length: exactly ${workoutCount} sessions.\n\nHistory (calibrate weights, identify overworked patterns):\n${historyText}\n\nAvailable exercises: ${JSON.stringify(libraryNames)}`,
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
      return parsed.templates || [];
    } catch (e) { throw parseGeminiError(e, "generateMultiWorkoutProgram"); }
  }

  async generateProgramNarrative(templates: WorkoutTemplate[], goal: string): Promise<string> {
    const cycleData = templates.map(t => ({
      name: t.name,
      exercises: t.exercises.map(e => e.name),
      isCustomized: !!t.isCustomized
    }));
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Goal: ${goal}\nProgram: ${JSON.stringify(cycleData)}\n\nIn 60-70 words, explain: volume distribution, fatigue management, and session sequencing logic. If any session is isCustomized=true, note how those edits affect cycle integrity.`,
        config: { systemInstruction: "You are an exercise physiologist. Write concise technical programming summaries. No motivational language — clinical analysis only." }
      });
      return response.text || "Structural validation complete.";
    } catch (e) { throw parseGeminiError(e, "generateProgramNarrative"); }
  }

  async refineProgramBatch(templates: WorkoutTemplate[], instruction: string, history: HistoricalLog[], libraryNames: string[]): Promise<{ templates: WorkoutTemplate[], narrative: string }> {
    const historyText = JSON.stringify(history.slice(-20).map(h => ({ ex: h.exercise, w: h.weight })));
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Modification: "${instruction}"\n\nProgram: ${JSON.stringify(templates)}\nHistory: ${historyText}\nLibrary: ${JSON.stringify(libraryNames)}`,
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

  async critiqueTemplateChanges(template: WorkoutTemplate, contextProgram?: WorkoutTemplate[]): Promise<string> {
    const contextText = contextProgram ? `CONTEXT: ${contextProgram.map(t => t.name).join(', ')}. Details: ${JSON.stringify(contextProgram)}` : "";
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Audit this template for programming errors: ${JSON.stringify(template)}. ${contextText}\n\nFlag: (1) frequency/volume conflicts, (2) poor substitutions, (3) movement pattern imbalances. Reference specific exercises. 2 short paragraphs max.`,
        config: { systemInstruction: "You are an exercise physiologist specialising in resistance training. Give direct clinical feedback only — do not be encouraging. Only flag genuine programming issues." }
      });
      return response.text || "Audit complete.";
    } catch (e) { throw parseGeminiError(e, "critiqueTemplateChanges"); }
  }

  async reoptimizeTemplate(template: WorkoutTemplate, history: HistoricalLog[]): Promise<WorkoutTemplate> {
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Current template: ${JSON.stringify(template)}\n\nRecent performance: ${JSON.stringify(history.slice(-20))}`,
        config: {
          systemInstruction: "You are a strength coach. Update suggested weights and reps using progressive overload: if recent sets were completed cleanly at the top of the rep range, increase weight by the smallest practical increment. If sets were missed, hold or reduce slightly. Keep exercise selection intact — only adjust load and rep targets.",
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
      return { ...JSON.parse(response.text?.trim() || '{}'), lastRefreshed: Date.now() };
    } catch (e) { throw parseGeminiError(e, "reoptimizeTemplate"); }
  }

  async editTemplateWithAI(template: WorkoutTemplate, instruction: string): Promise<WorkoutTemplate> {
    try {
      const response = await this.ai.models.generateContent({
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
      const response = await this.ai.models.generateContent({
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
      const response = await this.ai.models.generateContent({
        model: MODEL_FLASH,
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
      const response = await this.ai.models.generateContent({
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
      const response = await this.ai.models.generateContent({
        model: MODEL_FLASH,
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
      const response = await this.ai.models.generateContent({
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
      const response = await this.ai.models.generateContent({
        model: MODEL_LITE,
        contents: `Exercise: ${exerciseName}\nToday's sets: ${JSON.stringify(recentSets)}\nLast 5 sessions: ${JSON.stringify(exerciseHistory)}`,
        config: { systemInstruction: "You are a strength coach giving real-time feedback. Compare today's performance to recent history. Comment on load progression, rep trends, or fatigue. Be specific — reference the actual numbers. 2-3 sentences only." }
      });
      return response.text || "Continue protocol.";
    } catch (e) { throw parseGeminiError(e, "getExerciseAdvice"); }
  }

  async getWorkoutInspiration(history: HistoricalLog[], query?: string): Promise<{ title: string; summary: string; why: string; sourceUrl: string; template: WorkoutTemplate }[]> {
    const pairedContext = await this.getPairedContext(history);
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Request: "${query || "suggest balanced progression based on my recent training"}"\n\nRecent history: ${JSON.stringify(pairedContext.slice(0, 10))}`,
        config: {
          systemInstruction: "You are a strength coach. Suggest 3 evidence-based workout protocols that respond to the request and complement the user's recent training. For each: a clear title, 1-2 sentence protocol summary, and a specific reason it suits this user's current training pattern.",
          tools: [{ googleSearch: {} }],
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
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const parsed = JSON.parse(response.text?.trim() || '[]');
      return parsed.map((item: any, idx: number) => ({ ...item, sourceUrl: groundingChunks[idx]?.web?.uri || 'https://google.com' }));
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
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_LITE,
        contents: `Session Data: ${JSON.stringify(currentSession)}. Recent Streak Context: ${JSON.stringify(streakHistory.slice(-20))}.`,
        config: {
          systemInstruction: "Analyse this workout. Identify 1-2 objective highlights using the actual numbers — load increases, volume records, or consistency streaks. Write in second person. Sharp, specific, no filler. Max 80 words."
        }
      });
      return response.text || "Session registered.";
    } catch (e) { throw parseGeminiError(e, "getWorkoutMotivation"); }
  }

  async getProgressReview(history: HistoricalLog[], biometrics: BiometricEntry[]): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_LITE,
        contents: `Training logs (last 30 sessions): ${JSON.stringify(history.slice(-30))}\nBiometrics (last 5): ${JSON.stringify(biometrics.slice(-5))}`,
        config: { systemInstruction: "You are a sports scientist. Identify the 2-3 most significant trends — strength gains, volume changes, body composition shifts, or plateaus. Reference specific exercises and numbers. 3-4 sentences max." }
      });
      return response.text || "Trend stable.";
    } catch (e) { throw parseGeminiError(e, "getProgressReview"); }
  }
}
