import { GoogleGenAI, Type } from "@google/genai";
import { WorkoutTemplate, HistoricalLog, ExerciseLibraryItem, BiometricEntry, MorphologyAssessment, FuelLog, FuelProfile } from "../types";

const getLocalDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
};

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Fix: Initialize GoogleGenAI with named parameter using process.env.API_KEY directly as per guidelines
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
      { text: `TASK: Analyze these 8 high-resolution progress photos. 
      The set contains separate Upper and Lower body captures for each of the 4 standard poses (Front, Back, Left, Right).
      
      Assign a developmental 'intensity' score from 0 to 100 for each muscle group based on visibility, size, vascularity, and definition relative to an elite athletic baseline. 
      Use the increased detail from the split shots to identify high-frequency features like striations and deep separation.
      
      RETURN JSON with these keys: 
      shoulders, chest, abs, biceps, triceps, forearms, quads, hamstrings, calves, upperBack, lowerBack, lats, glutes.
      
      Be objective and strict. If a muscle group is lagging, assign a lower score. If it's highly developed, assign a higher score.` }
    ];

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      // Fix: Use single content object with parts array as per multi-part guideline
      contents: { parts },
      config: {
        systemInstruction: "You are an expert physique judge. You provide detailed morphological analysis from images. You identify muscle development levels with high precision. You return valid JSON only.",
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
      // Fix: Access .text property directly
      return JSON.parse(response.text?.trim() || '{}');
    } catch (e) {
      console.error("Morphology parse failed", e);
      throw new Error("Failed to interpret physique data. Ensure images are clear.");
    }
  }

  async parseBiometricsPrompt(prompt: string, currentUnit: string): Promise<BiometricEntry[]> {
    const now = getLocalDateString();
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Today's Date: ${now}. User Preferred Units: ${currentUnit}.
      User Input: "${prompt}".
      
      TASK: Extract biometric records (Weight, Body Fat %, Height, Waist, Chest, Neck, Hips) from the text.
      - Convert dates to YYYY-MM-DD. 
      - If only a day of the week or 'yesterday' is mentioned, calculate the date relative to today.
      - Ensure weight values are in the user's preferred unit (${currentUnit}).
      - If the user provides a unit in the text (e.g. cm for waist/chest), prioritize that but convert the final JSON numbers to standard metric values where appropriate (Height/Waist/Chest/Neck/Hips in CM).`,
      config: {
        systemInstruction: "You are a specialized medical data extractor. You convert messy text notes into clean JSON biometric records. Be precise with dates, weights, and measurements like waist, chest, and neck circumference. If the user mentions 'chest', 'neck', or 'hips', capture them for physical progress validation.",
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
      console.error("Biometrics parse failed", e);
      throw new Error("Could not interpret biometric data. Try being more specific with dates.");
    }
  }

  async parseFuelPrompt(prompt: string, profile: FuelProfile): Promise<{ logs: FuelLog[], updatedProfile?: FuelProfile }> {
    const now = getLocalDateString();
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Today's Date: ${now}. 
      Current User Profile: ${JSON.stringify(profile)}.
      User Input: "${prompt}".
      
      TASK:
      1. Extract nutritional intake (Calories, Protein, Carbs, Fats) from narrative text.
      2. Detect if the user is updating their GOAL, PREFERENCES, REGION, or TARGET ADJUSTMENT.
         - Goals: 'Build Muscle', 'Lose Fat', 'Maintenance'.
         - Preferences: Vegan, Keto, No Gluten, etc.
         - Region: Name of the country or territory.
         - Target Adjustment: If the user says 'increase target by 5%' or 'decrease target by 10%', calculate the new absolute multiplier relative to baseline (1.0). For example, 'reduce by 5%' = 0.95. 'Increase by 3%' = 1.03.
      3. For nutritional extraction:
         - Prioritize information for the specified region in the profile or prompt.
         - ADJUST FOR LABELING LAWS:
            - USA: Fiber is typically included in 'Total Carbohydrates'.
            - EU/UK/AU: 'Carbohydrates' usually refers to 'Available Carbohydrates' (Fiber listed separately). 
            - Ensure the 'carbs' field in JSON reflects standard athletic macronutrient tracking (Total Carbs minus Fiber if region is USA, otherwise use the listed Carb value).
      4. For protein targets (if updating profile): 
         - Build Muscle: 1.6g/kg.
         - Lose Fat: 1.8g/kg.
         - Maintenance: 1.2g/kg.
      
      RETURN JSON with two keys:
      'logs': array of FuelLog objects.
      'updatedProfile': optional FuelProfile object if user stated a new goal, preference, region, or target adjustment.`,
      config: {
        systemInstruction: "You are a world-class metabolic scientist with global nutritional database expertise. You extract nutritional data and profile updates (goals, regions, target offsets) from messy text. You return valid JSON only.",
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
      console.error("Fuel parse failed", e);
      throw new Error("Metabolic synthesis failed. Try being more descriptive with your meal.");
    }
  }

  async generateProgramFromPrompt(prompt: string, history: HistoricalLog[], libraryNames: string[]): Promise<WorkoutTemplate> {
    const historySample = history.slice(-100);
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    
    const recentHistory = history.filter(h => new Date(h.date) >= threeDaysAgo);
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User request: "${prompt}". 
      Available Exercise Database (Pick names EXACTLY from this list): ${JSON.stringify(libraryNames)}.
      Recent Performance (Last 72 hours - AVOID these muscle groups/exercises for recovery): ${JSON.stringify(recentHistory)}.
      Full History Context: ${JSON.stringify(historySample)}. 
      
      TASK: Generate a structured workout program. 
      CONSTRAINTS:
      1. You MUST ONLY pick exercise names that exist in the 'Available Exercise Database'.
      2. SEMANTIC MATCHING: If a user requests a specific movement (e.g., 'bench press') but it's called something else in the database (e.g., 'Barbell Bench Press'), you MUST use the database name.
      3. RECOVERY LOGIC: Avoid exercises or muscle groups trained in the 'Recent Performance' logs to prevent overtraining, unless the user explicitly asks to repeat a specific group.
      4. For each exercise:
         - Analyze historical performance to ensure 'Progressive Overload' (increase weight or reps slightly from the last recorded session).
         - Provide a 'rationale' explaining the choice (e.g., "Targeting fresh muscle groups" or "5lb increase for progressive overload").`,
      config: {
        systemInstruction: "You are an elite, safety-conscious fitness architect. You only suggest movements from your provided catalog. You prioritize muscle recovery and progressive overload. You return valid JSON.",
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
      console.error("Failed to parse AI response", e);
      throw new Error("Could not generate plan. Try being more specific.");
    }
  }

  async reoptimizeTemplate(template: WorkoutTemplate, history: HistoricalLog[]): Promise<WorkoutTemplate> {
    const relevantHistory = history.filter(h => 
      template.exercises.some(ex => ex.name.toLowerCase() === h.exercise.toLowerCase())
    ).slice(-50);

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Current Template: ${JSON.stringify(template)}.
      Current User History (Relevant): ${JSON.stringify(relevantHistory)}.
      
      TASK: Update the 'suggestedWeight' and 'suggestedReps' for each exercise based on the latest history.
      If the user has improved, increase the targets (progressive overload).
      If the user has not performed an exercise recently, maintain or slightly adjust targets.
      Update the 'rationale' to mention specific historical dates/weights if they were used for the adjustment.`,
      config: {
        systemInstruction: "You are an elite fitness coach specializing in progressive overload. Update existing workout programs based on new performance data.",
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
      console.error("AI Re-optimization failed", e);
      throw new Error("Could not re-optimize template.");
    }
  }

  async editTemplateWithAI(template: WorkoutTemplate, instructions: string): Promise<WorkoutTemplate> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Current Template: ${JSON.stringify(template)}.
      User Instruction: "${instructions}".
      
      TASK: Modify the template according to the instructions. Maintain the same JSON structure.
      If the user says "add more sets", update suggestedSets for appropriate exercises.
      If they say "remove machines", replace machine-based exercises with equivalent free weight ones.
      Update rationales to explain why changes were made.`,
      config: {
        systemInstruction: "You are a professional workout editor. You modify existing workout plans while maintaining strict JSON integrity. Be creative but safe.",
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
      console.error("AI Edit failed", e);
      throw new Error("Could not apply AI edits. Please try a different phrasing.");
    }
  }

  async matchExercisesToLibrary(importedNames: string[], libraryNames: string[]): Promise<any[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Imported exercise names from CSV: ${JSON.stringify(importedNames)}.
      Existing library of movements in the local database: ${JSON.stringify(libraryNames)}.
      
      TASK: Standardize and match CSV names to the local library with STRICT implement (equipment) awareness.
      
      LOGIC FLOW (Search-then-Compare):
      1. IDENTIFY IMPLEMENT: For each imported name, determine the resistance source: Barbell, Dumbbell, Machine (Selectorized or Plate Loaded), Cable, Smith Machine, or Bodyweight.
      2. RESEARCH (Two-Pass): For names with NO confidence match (especially brand names like 'Matrix', 'Prime', 'Hammer Strength', 'Technogym'), use the GOOGLE SEARCH tool to identify BOTH the movement pattern (e.g., Row) AND the specific implement type (e.g., Plate Loaded Machine).
      3. STRICT MATCHING RULE: An exercise is a match ONLY if BOTH the movement pattern AND the implement type are congruent.
      
      OUTPUT:
      Return a JSON array where each object identifies the imported name, suggests local matches ONLY if they are implement-equivalent, and flags 'isNew: true' if no strict movement + implement match exists.`,
      config: {
        systemInstruction: "You are a fitness data architect. You treat the implement (Dumbbell, Barbell, Machine, etc.) as a primary key for matching. You use Google Search to verify brand-specific equipment function. Return strict JSON array.",
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
      let text = response.text?.trim() || '[]';
      return JSON.parse(text);
    } catch (e) {
      console.error("Match AI failed", e);
      return importedNames.map(name => ({
        importedName: name,
        matches: [],
        isNew: true,
        suggestedStandardName: name,
        suggestedCategory: "Other"
      }));
    }
  }

  async suggestSwaps(exerciseName: string, category: string): Promise<any[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Current exercise: "${exerciseName}" in category "${category}". 
      Provide 3 professional alternatives that target the same muscle groups.
      Explain why each is a good substitute (e.g. 'Uses dumbbells instead of barbell for better range of motion').`,
      config: {
        systemInstruction: "You are a gym training expert. Suggest safe, effective equipment-specific or bodyweight alternatives.",
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
      contents: `Search for detailed professional instructions, benefits, injury risks, and the SPECIFIC muscles worked for the exercise: "${exerciseName}".
      
      TASK: Provide Clinical-Grade Methodology.
      Include:
      - SETUP: Precise joint alignment and starting cues.
      - EXECUTION: Precise movement path and breathing patterns.
      - TEMPO: Specific speeds for eccentric/concentric phases.
      - CUES: Useful coaching mental models.
      
      Prioritize authoritative sources like NASM, ExRx.net, or Mayo Clinic.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING, description: "Chest, Back, Legs, Shoulders, Arms, or Core" },
            muscles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific muscle groups like 'Pectorals', 'Quads', 'Lats', etc." },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Legacy list of steps for backwards compatibility." },
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

    // Fix: Extract URLs from groundingChunks as per Search Grounding guidelines
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sourceUrl = groundingChunks[0]?.web?.uri || 'https://www.google.com/search?q=' + encodeURIComponent(exerciseName);

    try {
      const parsed = JSON.parse(response.text?.trim() || '{}');
      return { ...parsed, sourceUrl };
    } catch (e) {
      throw new Error("Failed to find reputable information for this exercise.");
    }
  }

  async autopopulateExerciseLibrary(count: number, bodyParts: string[], existingNames: string[]): Promise<ExerciseLibraryItem[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate exactly ${count} unique and reputable fitness exercises that are NOT in this list: ${existingNames.join(', ')}.
      Target categories: ${bodyParts.join(', ')}.
      IMPORTANT: You MUST ONLY use the following category names exactly: ${bodyParts.join(', ')}.`,
      config: {
        systemInstruction: "You are a world-class exercise physiologist and database curator. Return an array of exercise objects in JSON format. Ensure exercise names are standardized and unique.",
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
      console.error("Autopopulate failed", e);
      throw new Error("Failed to generate exercise batch.");
    }
  }

  async getExerciseAdvice(exerciseName: string, recentSets: any[], history: HistoricalLog[]): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Exercise: ${exerciseName}. Current performance: ${JSON.stringify(recentSets)}. Historical data: ${JSON.stringify(history.filter(h => h.exercise === exerciseName).slice(-10))}. Provide short, encouraging feedback and suggest targets.`,
      config: {
        systemInstruction: "You are a motivating gym partner. Provide concise, data-driven advice."
      }
    });
    return response.text || "Keep pushing!";
  }

  async getWorkoutInspiration(history: HistoricalLog[], query?: string): Promise<{ title: string; summary: string; why: string; sourceUrl: string; template: WorkoutTemplate }[]> {
    const historySample = history.slice(-50);
    const userQuery = query ? `The user is specifically looking for: "${query}".` : "The user wants general inspiration based on their history.";
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `TASK: Generate exactly 3 unique, high-quality, and creative workout program suggestions. 
      CONTEXT: ${userQuery}
      HISTORY SUMMARY: ${JSON.stringify(historySample)}.`,
      config: {
        systemInstruction: "You are a world-class fitness program architect. You use history-awareness and Google Search grounding to provide verified, personalized training protocols. Return exactly 3 suggestions in JSON.",
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              why: { type: Type.STRING, description: "Personalized rationale based on workout history." },
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
      // Fix: Extract URLs from groundingChunks as per Search Grounding guidelines
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const parsed = JSON.parse(response.text?.trim() || '[]');
      
      return parsed.map((item: any, idx: number) => ({
        ...item,
        sourceUrl: groundingChunks[idx]?.web?.uri || 'https://www.google.com/search?q=' + encodeURIComponent(item.title)
      }));
    } catch (e) {
      console.error("Discovery AI failed", e);
      throw new Error("Failed to fetch inspirations.");
    }
  }

  async getWorkoutMotivation(currentSession: HistoricalLog[], history: HistoricalLog[]): Promise<string> {
    const exerciseNames = Array.from(new Set(currentSession.map(s => s.exercise)));
    const comparisonHistory = history.filter(h => exerciseNames.includes(h.exercise)).slice(-20);
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Current Session: ${JSON.stringify(currentSession)}.
      Recent Relevant History: ${JSON.stringify(comparisonHistory)}.`,
      config: {
        systemInstruction: "You are a high-energy, data-driven gym partner. You provide concise, scientifically grounded motivation based on session comparisons."
      }
    });
    return response.text || "Epic session. Keep pushing the limits.";
  }

  async getProgressReview(history: HistoricalLog[], biometrics: BiometricEntry[]): Promise<string> {
    const recentHistory = history.slice(-50);
    const recentBiometrics = biometrics.slice(-10);
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Recent Workout Logs: ${JSON.stringify(recentHistory)}.
      Recent Biometrics: ${JSON.stringify(recentBiometrics)}.`,
      config: {
        systemInstruction: "You are an elite physique architect. You perform deep-tissue analysis of longitudinal data and cross-validate Scale vs. Navy Method measurements to provide actionable, encouraging progress reviews. Keep it under 100 words."
      }
    });
    return response.text || "Protocol stable. Tissue adaptation trending positively across all metrics.";
  }
}
