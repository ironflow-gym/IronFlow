export interface SetLog {
  id: string;
  weight: number;
  reps: number;
  unit: 'kgs' | 'lbs';
  timestamp: number;
  completed: boolean;
  isWarmup?: boolean;
  isDeload?: boolean;
  // Cardio fields
  distance?: number;
  duration?: number; // seconds
  intensity?: number; // watts, level, etc.
  distanceUnit?: 'km' | 'mi' | 'm';
}

export interface Exercise {
  tracking?: 'reps' | 'time';
  progressionMode?: 'double' | 'fixed';
  id: string;
  name: string;
  category: string;
  sets: SetLog[];
  notes?: string;
  targetReps?: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  rationale?: string;
  recommendation?: ProgressionRecommendation;
  // Interval countdown timer config (cardio/HIIT exercises)
  intervalWorkSecs?: number;  // work phase duration in seconds
  intervalRestSecs?: number;  // rest phase duration in seconds
  restSeconds?: number;       // prescribed rest between sets for this exercise (from template)
  primaryMuscle?: string;     // muscles[0] from library, written at session creation
}

export interface WorkoutSession {
  progressionMode?: 'double' | 'fixed';
  blockId?: string;
  blockSessionId?: string;
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  exercises: Exercise[];
  status: 'active' | 'completed';
  templateId?: string;
  appointmentId?: string;
  adaptations?: { at: number; changes: string[] }[];
  restEndTime?: number | null;
  restLabel?: string;
  workStartTime?: number | null; // For cardio set timing
  sessionRPE?: number;           // 1–10 user-rated RPE, set at completion
}

export interface WorkoutTemplate {
  weightUnit?: 'kgs' | 'lbs';
  progressionMode?: 'double' | 'fixed';
  id?: string;
  name: string;
  lastRefreshed?: number;
  isCustomized?: boolean;
  critique?: string;
  excludeFromRotation?: boolean;  // when true, template is excluded from "up next" rotation inference
  exercises: {
    tracking?: 'reps' | 'time';
    name: string;
    category: string;
    suggestedSets: number;
    targetReps: string;
    suggestedWeight: number;
    suggestedReps: number;
    rationale: string;
    warmupCount?: number;
    restSeconds?: number;  // prescribed rest between working sets in seconds; 0 = use smart default
  }[];
}

export interface HistoricalLog {
  blockId?: string;
  blockSessionId?: string;
  blockSessionFulfilled?: boolean;
  tracking?: 'reps' | 'time';
  // Completion-time prescription: older records intentionally remain unknown.
  exerciseInstanceId?: string;
  workingSetIndex?: number;
  prescribedWorkingSets?: number;
  prescribedRepRange?: string;
  sessionId?: string;
  templateId?: string;
  appointmentId?: string;
  date: string;
  exercise: string;
  category: string;
  weight: number;
  unit: string;
  reps: number;
  completedAt?: number;
  isWarmup?: boolean;
  isDeload?: boolean;     // set during a planned deload session — excluded from weight suggestions, e1RM, PRs, MEV/MRV
  sessionDuration?: number; // ms
  weightAtTime?: number; // kg/lb
  // Cardio fields — present when category is a cardio type
  distance?: number;
  distanceUnit?: 'km' | 'mi' | 'm';
  duration?: number; // seconds
  primaryMuscle?: string; // primary muscle from exercise library, for accurate volume tracking
  sessionRPE?: number;    // 1–10 user-rated session RPE
  sessionLoad?: number;   // Foster session load: RPE × duration in minutes
  templateName?: string;  // name of the WorkoutTemplate this set belongs to — used to prefer same-protocol history when recommending weights
}

export interface BiometricEntry {
  date: string; // YYYY-MM-DD
  weight: number;
  bodyFat?: number;
  height?: number;
  waist?: number;
  chest?: number;
  shoulders?: number; // New: shoulder circumference for WSR
  neck?: number; // for Navy BF method
  hips?: number; // for Navy BF method (Female calibration)
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
  photoMode?: '4' | '8';
}

export interface MorphologyPendingScan {
  id: string;
  date: string;
  photoMode: '4' | '8';
  images: string[]; // base64 JPEG data URLs
  failedAt: number; // timestamp of last failure
}

export type NutritionSource = 'manual' | 'label' | 'database' | 'barcode' | 'ai';
export interface FoodItem {
  nutritionBasis?: '100g' | '100ml' | 'serving';
  missingNutrients?: ('calories' | 'protein' | 'carbs' | 'fats')[];
  nutritionSource?: NutritionSource;
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
  barcode?: string; // EAN-13 / UPC-A / UPC-E — used for barcode scan lookup
}

export interface FuelLog {
  servingDescription?: string;
  nutritionSource?: NutritionSource;
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

export interface SavedMeal {
  id: string;
  name: string;
  foods: Pick<FuelLog, 'name' | 'calories' | 'protein' | 'carbs' | 'fats' | 'confidence' | 'pantryItemId' | 'servingDescription' | 'nutritionSource'>[];
}

export interface ExerciseLibraryItem {
  name: string;
  category: string;
  muscles: string[]; // Specific muscles worked
  instructions: string[];
  benefits: string;
  risks: string;
  sourceUrl?: string;
  // Equipment configuration — optional, set by user per exercise
  loadingMode?: 'single' | 'paired'; // Increment applied once or on each side.
  weightIncrement?: number;  // Stored in kg. Smallest available weight step for this machine/setup (e.g. 5 for cable stack, 2.5 for barbell)
  barWeight?: number;        // Stored in kg. Starting mass before plates: bar, sled, or machine carriage weight. 0 = bodyweight machine.
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
  aiPersonality?: 'neutral' | 'elite' | 'gymbro' | 'custom';
  aiPersonalityCustom?: string;
  weeklyWorkoutGoal?: number;
  desktopWidgetVisibility?: {
    e1rmChart: boolean;
    muscleGroupVolume: boolean;
    consistencyHeatmap: boolean;
  };
  mevMrvThresholds?: Record<string, { mev: number; mav: number; mrv: number }>;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface ProgressionRecommendation {
  version?: 2;
  needsStartingLoad?: boolean;
  action?: 'increase' | 'reps' | 'hold' | 'starting';
  sets?: { weight: number; reps: number }[];
  previousSets?: { weight: number; reps: number }[];
  unit?: 'kgs' | 'lbs';
  weight: number;
  reps: number;
  reason: string;
  source: 'history' | 'related' | 'routine';
  equipment?: { base: number; step: number };
  previous?: { weight: number; reps: number; date: string };
  choice?: 'suggestion' | 'previous' | 'manual';
}

export interface TrainingAppointment {
  blockId?: string | null;
  blockSessionId?: string | null;
  id: string;
  date: string; // local YYYY-MM-DD, never a UTC timestamp
  kind: 'workout' | 'rest';
  templateId?: string;
  repeat?: 'weekly';
  until?: string; // inclusive last date of a weekly series
}
export interface AppointmentException {
  blockId?: string | null;
  blockSessionId?: string | null;
  date?: string;
  templateId?: string;
  kind?: 'workout' | 'rest';
  status?: 'skipped' | 'removed' | 'completed';
  sessionId?: string;
}
export interface TrainingCompletion {
  blockId?: string;
  blockSessionId?: string;
  blockSessionFulfilled?: boolean;
  sessionId: string;
  date: string;
  name: string; // snapshot, not a live routine name
  templateId?: string;
  appointmentId?: string;
  adaptations?: WorkoutSession['adaptations'];
}
export interface TrainingSchedule {
  appointments: TrainingAppointment[];
  exceptions: Record<string, AppointmentException>;
  completions: TrainingCompletion[];
}
export interface TrainingOccurrence extends Omit<TrainingAppointment, 'blockId' | 'blockSessionId'> {
  blockId?: string | null;
  blockSessionId?: string | null;
  occurrenceId: string;
  originalDate: string;
  status: 'planned' | 'skipped' | 'completed';
  sessionId?: string;
}

export type BlockGoal = 'strength' | 'muscle' | 'fat-loss' | 'recomposition' | 'fitness' | 'cardio-endurance' | 'muscular-endurance' | 'power' | 'mobility' | 'healthy-ageing' | 'sport' | 'maintenance';
export interface BlockSetup {
  name: string;
  goal: BlockGoal;
  daysPerWeek: number;
  workoutsPerRound: number;
  rounds: number;
  minutes: number;
  experience: 'beginner' | 'intermediate' | 'experienced';
  returning: boolean;
  equipment: string;
  priorities: string;
  event: string;
}
export interface BlockSession {
  id: string;
  round: number;
  workoutId: string;
  template: WorkoutTemplate;
  status: 'planned' | 'completed' | 'skipped';
  completedSessionId?: string;
  completedAt?: number;
  partial?: boolean;
}
export interface TrainingBlock extends BlockSetup {
  id: string;
  createdAt: number;
  status: 'active' | 'finished' | 'ended';
  endedAt?: number;
  workouts: WorkoutTemplate[];
  sessions: BlockSession[];
  nutrition?: { previous: FuelProfile; approved: FuelProfile; restoredAt?: number };
  baseline?: BiometricEntry;
}
