import type { LocalDate } from './dates';

export interface Meta { id: string; createdAt: number; updatedAt: number; source?: DataSource }
export type DataSource = 'manual' | 'import' | 'calculated' | 'estimate' | 'template';

export interface UserProfile {
  id: 'me';
  name: string;
  sex: 'male' | 'female';
  ageYears: number;          // wiek w dniu ageRefDate
  ageRefDate: LocalDate;
  heightCm: number;
  declaredWeightKg: number;
  goals: { kg: number; label: string }[];
  daughterName?: string;
  startDate: LocalDate;      // start planu (kalibracja = pierwsze 14 dni)
  activity?: import('./energy').ActivityProfile;
  updatedAt: number;
}

export interface HealthProfile {
  id: 'me';
  conditions: string[];      // np. potwierdzona insulinooporność
  kneeNote: string;
  kneeCleared: boolean;      // ocena fizjo/ortopedy wykonana i zgoda na cięższe nogi
  dairyAvoid: boolean;
  notes: string[];
  updatedAt: number;
}

export interface PlanVersion extends Meta {
  validFrom: LocalDate;
  kcal: number; proteinG: number; fatG: number; carbsG: number;
  fiberG: [number, number];
  mealsPerDay: number;
  workoutsPer14d: number;
  /** Cykl kalorii: dzień treningowy +trainingExtraKcal (z węglowodanów), odpoczynek mniej, tak by średnia tygodniowa = kcal. */
  cycling?: { enabled: boolean; trainingExtraKcal: number };
  /** Reguły dla schorzeń (każda włączana osobno). */
  rules?: PlanRules;
  reason: string;
  approvedByUser: boolean;
}

export type SymptomFlag =
  | 'chest_pain' | 'fainting' | 'severe_dyspnea'
  | 'knee_swelling' | 'knee_locking' | 'knee_instability' | 'cannot_bear_weight' | 'knee_worse_after_exercise' | 'new_sharp_pain'
  | 'illness' | 'drowsy_driving';

export interface MorningCheckIn {
  date: LocalDate;
  weightKg?: number;
  bedTime?: string; wakeTime?: string; sleepMinutes?: number;
  sleepQuality?: number;     // 1–5
  energy?: number;           // 1–5
  stress?: number;           // 1–10
  kneePain?: number;         // 0–10
  symptoms: SymptomFlag[];
  availability?: 'full' | 'limited' | 'none';
  notes?: string;
  fromHealth?: ('weight' | 'sleep')[];
  createdAt: number; updatedAt: number;
}

export type MissReason = 'time' | 'custody' | 'pain' | 'fatigue' | 'motivation' | 'other';
export interface EveningCheckIn {
  date: LocalDate;
  steps?: number;
  hunger?: number;           // 1–5
  sweetsCraving?: number;    // 1–5
  energy?: number; stress?: number; kneePain?: number;
  digestive?: number;        // 0–5 nasilenie objawów trawiennych
  workoutMissReason?: MissReason;
  planMissReason?: string;
  dietAdherence?: 'yes' | 'partial' | 'no';
  foodLogComplete?: boolean; // użytkownik potwierdza: wpisałem wszystko, co zjadłem
  sweetsInPlan?: boolean;
  activeKcal?: number;       // z zegarka/Zdrowia: tylko informacyjnie, nie dodawane do diety
  restingHr?: number;
  healthSyncAt?: number;
  createdAt: number; updatedAt: number;
}

export interface BodyMeasurement extends Meta {
  date: LocalDate;
  weightKg?: number; waistCm?: number; hipsCm?: number; chestCm?: number; armCm?: number; thighCm?: number;
  bodyFatPct?: number;       // tylko z wagi analizującej: szacunek
  historical?: boolean;      // pomiar historyczny z niepotwierdzoną datą
  note?: string;
}

export interface Nutrients { kcal: number; protein: number; fat: number; carbs: number; fiber: number; sugar?: number; satFat?: number; salt?: number }
export type WeightBasis = 'raw' | 'dry' | 'cooked' | 'drained' | 'as_sold';
export interface FoodProduct {
  id: string;
  name: string;
  per100: Nutrients;
  basis: WeightBasis;
  unit?: { name: string; grams: number };
  dairy: 'none' | 'contains' | 'unknown';
  tolerance: 'good' | 'bad' | 'unknown';
  role?: 'protein' | 'carb' | 'fat' | 'veg' | 'fruit' | 'mixed';
  source: string;
  reliability: 'label' | 'reference' | 'estimate';
  barcode?: string;
  brand?: string;
  ingredients?: string;
  favorite?: boolean;
  custom?: boolean;
  updatedAt: number;
}

export type MacroKey = 'protein' | 'fat' | 'carbs' | 'fiber';
export interface FoodEntry extends Meta {
  date: LocalDate;
  meal: number;              // 1–4 (+5 przekąska)
  productId: string;
  grams: number;
  snapshot: Nutrients & { name: string }; // wartości zapisane w momencie wpisu (historia nie zmienia się po edycji produktu)
  unknown?: MacroKey[];      // makro nieznane (np. szybki wpis kcal): w snapshot = 0, ale NIE jest to zero
}

export interface PlanRules {
  insulinResistance?: { enabled: boolean; carbMaxPct: number; sugarMaxPct: number; fiberMin: number; carbsPerMealMaxG: number; shiftExcessToFat?: boolean };
  dairyFree?: { enabled: boolean };
}

export interface WaterLog { date: LocalDate; ml: number; updatedAt: number }

export interface WorkoutSet {
  id: string; sessionId: string;
  exerciseId: string;   // faktycznie wykonane ćwiczenie (historia i progresja per ćwiczenie)
  slot?: string;        // ćwiczenie z planu, w miejscu którego wykonano serię (brak = exerciseId; dane sprzed v0.5)
  setIndex: number;
  weightKg: number; reps: number; rir?: number; pain?: number; done: boolean;
  createdAt: number; updatedAt: number;
}
export interface WorkoutSession extends Meta {
  date: LocalDate;
  templateId: 'A' | 'B';
  status: 'in_progress' | 'completed' | 'abandoned';
  order: string[];           // kolejność ćwiczeń (sloty planu: id z szablonu A/B)
  substitutions?: Record<string, string>; // slot → faktycznie wykonywane ćwiczenie (zamiana w trakcie treningu)
  skipped: string[];
  technique: Record<string, 'ok' | 'bad'>;
  painBefore?: number;
  cardioMin?: number;
  startedAt: number; finishedAt?: number;
  note?: string;
}

export interface CustodyConfig { id: 'custody'; cycleStart: LocalDate; confirmed: boolean; updatedAt: number }
export interface CalendarOverride { date: LocalDate; withDaughter: boolean; updatedAt: number }

export interface SymptomLog extends Meta {
  date: LocalDate; time?: string; products: string; abdominalPain?: number; diarrhea?: boolean; bloating?: boolean; severity?: number; onsetMinutes?: number; note?: string;
}
export interface LabResult extends Meta {
  date: LocalDate; name: string; value: string; unit: string; refRange?: string; doctorNote?: string;
}
export interface RecommendationFeedback extends Meta { recId: string; date: LocalDate; action: 'accepted' | 'rejected' }

export interface Settings {
  id: 'settings';
  theme: 'dark' | 'light';
  onboarded: boolean;
  lastBackupAt?: number;
  backupReminderDays: number;
  aiIncludeHealth: boolean;
}
