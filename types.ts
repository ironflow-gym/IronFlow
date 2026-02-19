export interface SetLog {
  id: string;
  weight: number;
  reps: number;
  unit: 'kgs' | 'lbs';
  timestamp: number;
  completed: boolean;
  isWarmup?: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  sets: SetLog[];
  notes?: string;
  targetReps?: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  rationale?: string;
}

export interface WorkoutSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  exercises: Exercise[];
  status: 'active' | 'completed';
  restEndTime?: number | null;
  restLabel?: string;
}

export interface WorkoutTemplate {
  id?: string;
  name: string;
  lastRefreshed?: number;
  isCustomized?: boolean;
  critique?: string;
  exercises: {
    name: string;
    category: string;
    suggestedSets: number;
    targetReps: string;
    suggestedWeight: number;
    suggestedReps: number;
    rationale: string;
    warmupCount?: number;
  }[];
}

export interface HistoricalLog {
  date: string;
  exercise: string;
  category: string;
  weight: number;
  unit: string;
  reps: number;
  completedAt?: number;
  isWarmup?: boolean;
  sessionDuration?: number; // ms
  weightAtTime?: number; // kg/lb
}

export interface BiometricEntry {
  date: string; // YYYY-MM-DD
  weight: number;
  bodyFat?: number;
  height?: number;
  waist?: number;
  chest?: number; // New: Chest measurement
  neck?: number; // New: for Navy BF method
  hips?: number; // New: for Navy BF method (Female calibration)
  unit: 'kgs' | 'lbs';
}

export interface MorphologyAssessment {
  shoulders: number; // 0-100
  chest: number;
  abs: number;
  biceps: number;
  triceps: number;
  forearms: number;
  quads: number;
  hamstrings: number;
  calves: number;
  upperBack: number;
  lowerBack: number;
  lats: number;
  glutes: number;
}

export interface MorphologyScan {
  id: string;
  date: string;
  assessment: MorphologyAssessment;
}

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  servingSize: string;
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
  category?: string;
  lastUsed?: number;
}

export interface FuelLog {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidence: number;
  pantryItemId?: string;
}

export interface FuelProfile {
  goal: 'Build Muscle' | 'Lose Fat' | 'Maintenance';
  preferences: string[];
  targetProteinRatio: number; // g per kg
  region?: string;
  targetMultiplier?: number;
}

export interface ExerciseLibraryItem {
  name: string;
  category: string;
  muscles: string[]; // Specific muscles worked
  instructions: string[];
  benefits: string;
  risks: string;
  sourceUrl?: string;
  methodology?: {
    setup: string[];
    execution: string[];
    tempo: string;
    breathing: string;
    cues: string[];
  };
}

export type IronSyncStatus = 'disconnected' | 'connected' | 'transmitting' | 'pending' | 'error';

export interface UserSettings {
  units: 'metric' | 'imperial';
  autoPopulateCount: number;
  includedBodyParts: string[];
  defaultRestTimer: number;
  enableWakeLock: boolean;
  gender?: 'male' | 'female';
  dateOfBirth?: string;
  enableAutoBackup?: boolean;
  ironSyncConnected?: boolean;
  lastCloudSync?: number;
}