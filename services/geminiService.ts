import { GoogleGenAI, Type } from "@google/genai";
import { WorkoutTemplate, HistoricalLog, ExerciseLibraryItem, BiometricEntry, MorphologyAssessment, FuelLog, FuelProfile } from "../types";
import { storage } from "./storageService";

const getLocalDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
};

/**
 * Utility: Parses YYYY-MM-DD strictly as local time to avoid UTC drift.
 */
const parseLocal = (dStr: string) => {
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Internal Helper: Absolute Current Status
   * Fetches the single most recent biometric entry independently of sessions.
   */
  private async getCurrentPhysicalStatus(): Promise<string> {
    const biometrics = await storage.get<BiometricEntry[]>('ironflow_biometrics') || [];
    if (biometrics.length === 0) return "Unknown (No biometric data registered)";
    
    // Sort by string date descending (YYYY-MM-DD works naturally)
    const sorted = [...biometrics].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    
    return `Current Absolute State: ${latest.weight}${latest.unit} as of ${latest.date}${latest.bodyFat ? ` (${latest.bodyFat}% body fat)` : ''}.`;
  }

  /**
   * Internal Helper: Temporal Anchoring Engine
   * Retrieves biometrics directly from the vault and pairs them with historical logs.
   * Uses local time normalization to prevent timezone shadowing.
   */
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
      // Find latest biometric entry before or on workout date using local normalization
      const bio = sortedBios.find(b => parseLocal(b.date) <= workoutDate);
      
      return {
        date,
        bodyweightAtTime: bio ? { weight: bio.weight, unit: bio.unit, bf: bio.bodyFat } : "No weigh-in data for this period",
        logs: logs.map(l => ({ ex: l.exercise, w: l.weight, r: l.reps }))
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Neural Pre-Processor
   */
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
      
      return !log.isWarmup && !isStatisticalWarmup && (now - logDate) <= SIX_MONTHS_MS;
    });

    const groups: Record<string, HistoricalLog[]> = {};
    filtered.forEach(log => {
      if (!groups[log.exercise]) groups[log.exercise] = [];
      groups[log.exercise].push(log);
    });

    const sanitized: HistoricalLog[] = [];

    Object.values(groups).forEach(exerciseLogs => {
      const sorted = exerciseLogs.sort((a, b) => a.date.localeCompare(b.date));
      
      if (sorted.length <= 2) {
        sanitized.push(...sorted);
        return;
      }

      sorted.forEach((log, i) => {
        if (i >= sorted.length - 2) {
          sanitized.push(log);
          return;
        }

        const prev = sorted[i - 1];
        const next = sorted[i + 1];
        
        let localMean = 0;
        if (prev && next) localMean = (prev.weight + next.weight) / 2;
        else if (next) localMean = next.weight;
        else if (prev) localMean = prev.weight;

        const isSpike = Math.abs(log.weight - localMean) > (localMean * 0.7);
        const neighborsAgree = prev && next ? Math.abs(prev.weight - next.weight) < (prev.weight * 0.2) : true;

        if (!(isSpike && neighborsAgree)) {
          sanitized.push(log);
        }
      });
    });

    return sanitized.sort((a, b) => a.date.localeCompare(b.date));
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
      { text: `TASK: Analyze these 8 progress photos. Assign a developmental intensity score (0-100) for each muscle group. RETURN JSON ONLY.` }
    ];

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: "You are an expert physique judge. You return valid JSON only.",
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

    try {
      return JSON.parse(response.text?.trim() || '{}');
    } catch (e) {
      throw new Error("Failed to interpret physique data.");
    }
  }

  async parseBiometricsPrompt(prompt: string, currentUnit: string): Promise<BiometricEntry[]> {
    const now = getLocalDateString();
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Today's Date: ${now}. User Preferred Units: ${currentUnit}. User Input: "${prompt}". Extract biometric records.`,
      config: {
        systemInstruction: "You are a specialized medical data extractor. Convert text into clean JSON biometric records.",
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
              hips: { type: Type.NUMBER },
              unit: { type: Type.STRING, enum: ["kgs", "lbs"] }
            },
            required: ["date", "weight", "unit"]
          }
        }
      }
    });

    try {
      return JSON.parse(response.text?.trim() || '[]');
    } catch (e) {
      throw new Error("Could not interpret biometric data.");
    }
  }

  async parseFuelPrompt(prompt: string, profile: FuelProfile): Promise<{ logs: FuelLog[], updatedProfile?: FuelProfile }> {
    const now = getLocalDateString();
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Today's Date: ${now}. Profile: ${JSON.stringify(profile)}. Input: "${prompt}".`,
      config: {
        systemInstruction: "You are a metabolic scientist. Extract nutritional data from text.",
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
                  confidence: { type: Type.NUMBER }
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
                region: { type: Type.STRING },
                targetMultiplier: { type: Type.NUMBER }
              }
            }
          },
          required: ["logs"]
        }
      }
    });

    try {
      const parsed = JSON.parse(response.text?.trim() || '{}');
      const date = getLocalDateString();
      const logsWithId = (parsed.logs || []).map((l: any) => ({ ...l, id: Math.random().toString(36).substr(2, 9), date }));
      return { logs: logsWithId, updatedProfile: parsed.updatedProfile };
    } catch (e) {
      throw new Error("Metabolic synthesis failed.");
    }
  }

  async generateProgramFromPrompt(prompt: string, history: HistoricalLog[], libraryNames: string[]): Promise<WorkoutTemplate> {
    const pairedContext = await this.getPairedContext(history);
    const currentStatus = await this.getCurrentPhysicalStatus();
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    const recentHistory = history.filter(h => parseLocal(h.date) >= threeDaysAgo);
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User request: "${prompt}". 
      CURRENT PHYSICAL STATUS: ${currentStatus}.
      Available Exercise Database: ${JSON.stringify(libraryNames)}.
      Recent Performance (Last 72 hours): ${JSON.stringify(recentHistory)}.
      Historical Context (Lifts matched to weight on workout date): ${JSON.stringify(pairedContext.slice(0, 15))}. 
      
      TASK: Generate structured program. TEMPORAL ANCHORING: Prioritize the 'CURRENT PHYSICAL STATUS' as the user's absolute baseline today. Use 'Historical Context' only to determine trajectory.`,
      config: {
        systemInstruction: "You are an elite fitness architect. Always use 'CURRENT PHYSICAL STATUS' as the high-priority basis for baseline weight suggestions. Return valid JSON.",
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

    try {
      const parsed = JSON.parse(response.text?.trim() || '{}');
      return { ...parsed, lastRefreshed: Date.now() };
    } catch (e) {
      throw new Error("Could not generate plan.");
    }
  }

  async reoptimizeTemplate(template: WorkoutTemplate, history: HistoricalLog[]): Promise<WorkoutTemplate> {
    const pairedContext = await this.getPairedContext(history);
    const currentStatus = await this.getCurrentPhysicalStatus();
    const relevantHistory = pairedContext.filter(session => 
      session.logs.some((l: any) => template.exercises.some(ex => ex.name.toLowerCase() === l.ex.toLowerCase()))
    ).slice(0, 10);

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Current Template: ${JSON.stringify(template)}.
      CURRENT PHYSICAL STATUS: ${currentStatus}.
      Relevant Historical Lifts (Matched to weight): ${JSON.stringify(relevantHistory)}.
      TASK: Update targets for progressive overload. Use 'CURRENT PHYSICAL STATUS' to calculate today's intensity.`,
      config: {
        systemInstruction: "You are an elite fitness coach. Use the 'CURRENT PHYSICAL STATUS' to determine absolute loading capacity today. Return valid JSON.",
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

    try {
      const parsed = JSON.parse(response.text?.trim() || '{}');
      return { ...parsed, id: template.id, lastRefreshed: Date.now() };
    } catch (e) {
      throw new Error("Could not re-optimize template.");
    }
  }

  async editTemplateWithAI(template: WorkoutTemplate, instructions: string): Promise<WorkoutTemplate> {
    const currentStatus = await this.getCurrentPhysicalStatus();
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Template: ${JSON.stringify(template)}. 
      CURRENT PHYSICAL STATUS: ${currentStatus}.
      Instructions: "${instructions}".`,
      config: {
        systemInstruction: "You are a professional workout editor. Adjust targets using current status and user intent. Return valid JSON.",
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

    try {
      const parsed = JSON.parse(response.text?.trim() || '{}');
      return { ...parsed, id: template.id, lastRefreshed: Date.now() };
    } catch (e) {
      throw new Error("Could not apply AI edits.");
    }
  }

  async matchExercisesToLibrary(importedNames: string[], libraryNames: string[]): Promise<any[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `CSV names: ${JSON.stringify(importedNames)}. Library: ${JSON.stringify(libraryNames)}.`,
      config: {
        systemInstruction: "You are a fitness data architect. Standardize and match names to the library. Return JSON array.",
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

    try {
      return JSON.parse(response.text?.trim() || '[]');
    } catch (e) {
      return importedNames.map(name => ({ importedName: name, matches: [], isNew: true, suggestedStandardName: name, suggestedCategory: "Other" }));
    }
  }

  async suggestSwaps(exerciseName: string, category: string): Promise<any[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Exercise: "${exerciseName}" in category "${category}". Suggest 3 alternatives.`,
      config: {
        systemInstruction: "You are a gym training expert. Return alternatives in JSON.",
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

    try {
      const parsed = JSON.parse(response.text?.trim() || '{}');
      return parsed.alternatives || [];
    } catch (e) {
      return [];
    }
  }

  async searchExerciseOnline(exerciseName: string): Promise<ExerciseLibraryItem> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Search for instructions for: "${exerciseName}". Include clinical methodology.`,
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

    try {
      const parsed = JSON.parse(response.text?.trim() || '{}');
      return { ...parsed, sourceUrl };
    } catch (e) {
      throw new Error("Failed to find information.");
    }
  }

  async autopopulateExerciseLibrary(count: number, bodyParts: string[], existingNames: string[]): Promise<ExerciseLibraryItem[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate ${count} exercises for: ${bodyParts.join(', ')}. Exclude: ${existingNames.join(', ')}.`,
      config: {
        systemInstruction: "You are a world-class physiologist. Return exercise objects in JSON array.",
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

    try {
      return JSON.parse(response.text?.trim() || '[]');
    } catch (e) {
      throw new Error("Failed to generate exercise batch.");
    }
  }

  async getExerciseAdvice(exerciseName: string, recentSets: any[], history: HistoricalLog[]): Promise<string> {
    const pairedContext = await this.getPairedContext(history);
    const currentStatus = await this.getCurrentPhysicalStatus();
    const exerciseHistory = pairedContext.filter(session => 
      session.logs.some((l: any) => l.ex === exerciseName)
    ).slice(0, 5);

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Exercise: ${exerciseName}. 
      CURRENT PHYSICAL STATUS: ${currentStatus}.
      Recent sets: ${JSON.stringify(recentSets)}. 
      Historical context (Lifts matched to weight): ${JSON.stringify(exerciseHistory)}.
      
      Feedback? Provide data-driven advice. PRIORITIZE using the 'CURRENT PHYSICAL STATUS' as the basis for today's strength-to-mass comparison.`,
      config: {
        systemInstruction: "You are a motivating gym partner. Use 'CURRENT PHYSICAL STATUS' as the primary anchor for analysis."
      }
    });
    return response.text || "Keep pushing!";
  }

  async getWorkoutInspiration(history: HistoricalLog[], query?: string): Promise<{ title: string; summary: string; why: string; sourceUrl: string; template: WorkoutTemplate }[]> {
    const pairedContext = await this.getPairedContext(history);
    const currentStatus = await this.getCurrentPhysicalStatus();
    const userQuery = query ? `Specific intent: "${query}".` : "General inspiration.";
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 3 suggestions. Intent: ${userQuery}. 
      CURRENT PHYSICAL STATUS: ${currentStatus}.
      Contextual History (Lifts matched to mass on that date): ${JSON.stringify(pairedContext.slice(0, 10))}.`,
      config: {
        systemInstruction: "You are a world-class fitness architect. Use 'CURRENT PHYSICAL STATUS' as the primary basis for today's suggestions. Return exactly 3 suggestions in JSON.",
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

    try {
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const parsed = JSON.parse(response.text?.trim() || '[]');
      return parsed.map((item: any, idx: number) => ({
        ...item,
        sourceUrl: groundingChunks[idx]?.web?.uri || 'https://www.google.com/search?q=' + encodeURIComponent(item.title)
      }));
    } catch (e) {
      throw new Error("Failed to fetch inspirations.");
    }
  }

  async getWorkoutMotivation(currentSession: HistoricalLog[], history: HistoricalLog[]): Promise<string> {
    const pairedContext = await this.getPairedContext(history);
    const currentStatus = await this.getCurrentPhysicalStatus();
    const exerciseNames = Array.from(new Set(currentSession.map(s => s.exercise)));
    const comparisonHistory = pairedContext.filter(session => 
      session.logs.some((l: any) => exerciseNames.includes(l.ex))
    ).slice(0, 10);
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Today's session: ${JSON.stringify(currentSession)}. 
      CURRENT PHYSICAL STATUS: ${currentStatus}.
      Relevant Paired History: ${JSON.stringify(comparisonHistory)}. 
      Provide motivation. Use 'CURRENT PHYSICAL STATUS' to calculate current strength-to-mass ratios correctly.`,
      config: {
        systemInstruction: "You are a high-energy gym partner. Anchor all analysis to the provided 'CURRENT PHYSICAL STATUS'."
      }
    });
    return response.text || "Epic session.";
  }

  async getProgressReview(history: HistoricalLog[], biometrics: BiometricEntry[]): Promise<string> {
    const pairedContext = await this.getPairedContext(history);
    const currentStatus = await this.getCurrentPhysicalStatus();
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `CURRENT PHYSICAL STATUS: ${currentStatus}.
      Historical Progression (Paired): ${JSON.stringify(pairedContext.slice(0, 20))}. 
      All Biometrics: ${JSON.stringify(biometrics.slice(-5))}.
      Review evolution. Prioritize current status for determining absolute progress status today.`,
      config: {
        systemInstruction: "You are an elite physique architect. Perform longitudinal analysis anchored strictly to the 'CURRENT PHYSICAL STATUS'. Keep under 100 words."
      }
    });
    return response.text || "Protocol stable.";
  }
}