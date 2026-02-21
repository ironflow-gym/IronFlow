import { GoogleGenAI, Type } from "@google/genai";
import { WorkoutTemplate, HistoricalLog, ExerciseLibraryItem, BiometricEntry, MorphologyAssessment, FuelLog, FuelProfile, FoodItem } from "../types";
import { storage } from "./storageService";

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
        throw new Error("Gemini API Key is not configured. Please ensure GEMINI_API_KEY is set in your environment.");
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
    try { return JSON.parse(response.text?.trim() || '{}'); } catch (e) { throw new Error("Failed to interpret physique data."); }
  }

  async parseFuelPrompt(prompt: string, profile: FuelProfile, pantryContext?: FoodItem[]): Promise<{ logs: FuelLog[], updatedProfile?: FuelProfile }> {
    const now = getLocalDateString();
    const pantryText = pantryContext ? `PANTRY DATA (Priority matches): ${JSON.stringify(pantryContext)}` : "";
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Today's Date: ${now}. Profile: ${JSON.stringify(profile)}. ${pantryText} Input: "${prompt}".`,
      config: {
        systemInstruction: "You are a metabolic scientist. Extract nutritional data. If the input matches a pantry item by name or brand, use those exact macros. Return valid JSON.",
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
    try {
      const parsed = JSON.parse(response.text?.trim() || '{}');
      const date = getLocalDateString();
      const logsWithId = (parsed.logs || []).map((l: any) => ({ ...l, id: Math.random().toString(36).substr(2, 9), date }));
      return { logs: logsWithId, updatedProfile: parsed.updatedProfile };
    } catch (e) { throw new Error("Metabolic synthesis failed."); }
  }

  async analyzeNutritionPanel(imageData: string): Promise<Partial<FoodItem>> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: imageData.split(',')[1] } },
          { text: "Analyze this nutrition label frame. Identify the product name, brand, serving size, and macronutrients (Calories, Protein, Carbs, Fats) per serving. Return structured JSON data." }
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
    try { return JSON.parse(response.text?.trim() || '{}'); } catch (e) { throw new Error("Laboratory OCR Failed."); }
  }

  async scrapeFoodSite(url: string): Promise<FoodItem[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Visit ${url} and find a list of common foods or products with their nutritional values (P, C, F, Cals). Extract up to 20 items.`,
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
    try {
      const items = JSON.parse(response.text?.trim() || '[]');
      return items.map((i: any) => ({ ...i, id: Math.random().toString(36).substr(2, 9) }));
    } catch (e) { throw new Error("Web Import Failed."); }
  }

  async generateProgramFromPrompt(prompt: string, history: HistoricalLog[], libraryNames: string[]): Promise<WorkoutTemplate> {
    const historyText = JSON.stringify(history.slice(-30).map(h => ({ d: h.date, ex: h.exercise, w: h.weight, r: h.reps })));
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Prompt: ${prompt}. History: ${historyText}. Library: ${JSON.stringify(libraryNames)}.`,
      config: {
        systemInstruction: "You are a training architect. Generate a balanced workout template. Prioritize structural integrity and prevent redundant fatigue. Return JSON.",
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
    try { return JSON.parse(response.text?.trim() || '{}'); } catch (e) { throw new Error("Generation failed."); }
  }

  async generateMultiWorkoutProgram(prompt: string, workoutCount: number, history: HistoricalLog[], libraryNames: string[]): Promise<WorkoutTemplate[]> {
    const historyText = JSON.stringify(history.slice(-40).map(h => ({ d: h.date, ex: h.exercise, w: h.weight, r: h.reps })));
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User Goal & Intent: ${prompt}. REQUIRED WORKOUTS IN CYCLE: ${workoutCount}. History Context: ${historyText}. Library: ${JSON.stringify(libraryNames)}.`,
      config: {
        systemInstruction: "You are an elite master coach. Generate a full training program. IMPORTANT: Ensure structural balance. If a focused 'blaster' is requested, you MUST still manage systemic fatigue by varying intensity or adding antagonistic stability movements. Return JSON.",
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
    try {
      const parsed = JSON.parse(response.text?.trim() || '{}');
      return parsed.templates || [];
    } catch (e) { throw new Error("Program synthesis failed."); }
  }

  async generateProgramNarrative(templates: WorkoutTemplate[], goal: string): Promise<string> {
    const cycleData = templates.map(t => ({ 
      name: t.name, 
      exercises: t.exercises.map(e => e.name),
      isCustomized: !!t.isCustomized 
    }));

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User Goal: ${goal}. Cycle Data: ${JSON.stringify(cycleData)}.
      
      TASK: Provide a highly concise, professional explanation of the training logic. 
      Analyze volume distribution and fatigue management across the cycle.
      CRITICAL: If "isCustomized: true" is present, evaluate how the manual edits affect the cycle's integrity.
      TONE: Executive Sports Scientist. No 'bro' language. Max 70 words.`,
      config: { systemInstruction: "You are an elite exercise physiologist providing clinical programming summaries." }
    });
    return response.text || "Structural validation complete.";
  }

  async refineProgramBatch(templates: WorkoutTemplate[], instruction: string, history: HistoricalLog[], libraryNames: string[]): Promise<{ templates: WorkoutTemplate[], narrative: string }> {
    const historyText = JSON.stringify(history.slice(-20).map(h => ({ ex: h.exercise, w: h.weight })));
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `CURRENT PROGRAM: ${JSON.stringify(templates)}. USER GUIDANCE: "${instruction}". History: ${historyText}. Library: ${JSON.stringify(libraryNames)}.
      
      TASK: Apply the guidance across the entire batch while maintaining structural balance. If the user asks for something intensive (like everyday frequency), ensure you manage the volume of other movements to prevent overtraining. Return JSON.`,
      config: {
        systemInstruction: "You are a training architect. Return updated templates and a concise narrative explanation in JSON.",
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
    try { return JSON.parse(response.text?.trim() || '{}'); } catch (e) { throw new Error("Refinement synthesis failed."); }
  }

  async critiqueTemplateChanges(template: WorkoutTemplate, contextProgram?: WorkoutTemplate[]): Promise<string> {
    const contextText = contextProgram ? `CONTEXT: ${contextProgram.map(t => t.name).join(', ')}. Details: ${JSON.stringify(contextProgram)}` : "";
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `AUDIT: ${JSON.stringify(template)}. ${contextText}.
      
      TASK: Review the manual modifications. 
      Identify frequency conflicts or poor exercise substitutions.
      Provide a concise, clinical audit in 1-2 short paragraphs.`,
      config: { systemInstruction: "You are an elite exercise physiologist." }
    });
    return response.text || "Audit complete.";
  }

  async reoptimizeTemplate(template: WorkoutTemplate, history: HistoricalLog[]): Promise<WorkoutTemplate> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Template: ${JSON.stringify(template)}. History: ${JSON.stringify(history.slice(-20))}.`,
      config: {
        systemInstruction: "Apply progressive overload logic based on history. Maintain structural balance. Return JSON.",
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
    try { return { ...JSON.parse(response.text?.trim() || '{}'), lastRefreshed: Date.now() }; } catch (e) { throw new Error("Re-optimization failed."); }
  }

  async editTemplateWithAI(template: WorkoutTemplate, instruction: string): Promise<WorkoutTemplate> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Edit instruction: ${instruction}. Current template: ${JSON.stringify(template)}.`,
      config: {
        systemInstruction: "Modify template based on instruction. Maintain programming integrity. Return JSON.",
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
    try { return JSON.parse(response.text?.trim() || '{}'); } catch (e) { throw new Error("Edit failed."); }
  }

  async parseBiometricsPrompt(prompt: string, unit: 'kgs' | 'lbs'): Promise<Partial<BiometricEntry>[]> {
    const now = getLocalDateString();
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Date: ${now}. Unit: ${unit}. Input: "${prompt}".`,
      config: {
        systemInstruction: "Extract metrics. Return JSON array.",
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
    try { return JSON.parse(response.text?.trim() || '[]'); } catch (e) { throw new Error("Extraction failed."); }
  }

  async matchExercisesToLibrary(importedNames: string[], libraryNames: string[]): Promise<any[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Names: ${JSON.stringify(importedNames)}. Library: ${JSON.stringify(libraryNames)}.`,
      config: {
        systemInstruction: "Standardize and match exercise names to the library. Return JSON array.",
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
    try { return JSON.parse(response.text?.trim() || '[]'); } catch (e) { return importedNames.map(name => ({ importedName: name, matches: [], isNew: true, suggestedStandardName: name, suggestedCategory: "Other" })); }
  }

  async suggestSwaps(exerciseName: string, category: string): Promise<any[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Exercise: "${exerciseName}" in category "${category}". Suggest alternatives.`,
      config: {
        systemInstruction: "Suggest equivalent alternatives. Return JSON.",
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
    try { const parsed = JSON.parse(response.text?.trim() || '{}'); return parsed.alternatives || []; } catch (e) { return []; }
  }

  async searchExerciseOnline(exerciseName: string): Promise<ExerciseLibraryItem> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Search for instructions for: "${exerciseName}".`,
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
    try { const parsed = JSON.parse(response.text?.trim() || '{}'); return { ...parsed, sourceUrl }; } catch (e) { throw new Error("Search failed."); }
  }

  async autopopulateExerciseLibrary(count: number, bodyParts: string[], existingNames: string[]): Promise<ExerciseLibraryItem[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate ${count} exercises for: ${bodyParts.join(', ')}.`,
      config: {
        systemInstruction: "Generate professional exercise library entries. Return JSON array.",
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
    try { return JSON.parse(response.text?.trim() || '[]'); } catch (e) { throw new Error("Populate failed."); }
  }

  async getExerciseAdvice(exerciseName: string, recentSets: any[], history: HistoricalLog[]): Promise<string> {
    const pairedContext = await this.getPairedContext(history);
    const exerciseHistory = pairedContext.filter(session => session.logs.some((l: any) => l.ex === exerciseName)).slice(0, 5);
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Exercise: ${exerciseName}. Context: ${JSON.stringify(exerciseHistory)}. Current: ${JSON.stringify(recentSets)}. Feedback?`,
      config: { systemInstruction: "You are a supportive, high-performance coaching partner. Use data-driven professional advice." }
    });
    return response.text || "Continue protocol.";
  }

  async getWorkoutInspiration(history: HistoricalLog[], query?: string): Promise<{ title: string; summary: string; why: string; sourceUrl: string; template: WorkoutTemplate }[]> {
    const pairedContext = await this.getPairedContext(history);
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Query: ${query || "Balanced evolution"}. History: ${JSON.stringify(pairedContext.slice(0, 10))}.`,
      config: {
        systemInstruction: "Generate 3 evidence-based training protocol suggestions. Return JSON.",
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
      return parsed.map((item: any, idx: number) => ({ ...item, sourceUrl: groundingChunks[idx]?.web?.uri || 'https://google.com' }));
    } catch (e) { throw new Error("Inspiration failed."); }
  }

  async getWorkoutMotivation(currentSession: HistoricalLog[], history: HistoricalLog[]): Promise<string> {
    // Filter history to only include the most recent continuous training block (no gaps >= 3 months)
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
    streakHistory.reverse(); // Back to chronological for AI context

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Session Data: ${JSON.stringify(currentSession)}. Recent Streak Context: ${JSON.stringify(streakHistory.slice(-20))}.`,
      config: { 
        systemInstruction: "Write a specific, engaging analysis of this session in the first person. Identify and highlight 1 or 2 objective high points (e.g., volume PRs, intensity spikes, or exceptional consistency). The tone should be sharp, observant, and encouraging—balancing technical insight with accessible energy. Avoid 'gym bro' slang, academic dryness, and generic cliches. Do not describe yourself or your role; simply provide the analysis. Max 100 words." 
      }
    });
    return response.text || "Session registered.";
  }

  async getProgressReview(history: HistoricalLog[], biometrics: BiometricEntry[]): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `History: ${JSON.stringify(history.slice(-30))}. Bios: ${JSON.stringify(biometrics.slice(-5))}.`,
      config: { systemInstruction: "You are an elite physique architect. Provide a concise executive review of current adaptation trends." }
    });
    return response.text || "Trend stable.";
  }
}