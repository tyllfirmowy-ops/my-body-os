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
  /** makro nieznane w źródle (np. niepełna etykieta OFF): w per100 = 0, ale to NIE jest zero */
  unknown?: MacroKey[];
  /** ostrzeżenia z walidacji etykiety (np. kcal niezgodne z makro, brak składu) */
  labelWarnings?: string[];
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
  /** część kcal wpisu z nieznanym makro (np. przepis z jednym składnikiem bez pełnej etykiety) */
  unknownKcal?: Partial<Record<MacroKey, number>>;
  recipeId?: string;
  /** liczba porcji przepisu w tym wpisie (≤0.6.0: odczytywana z nazwy) */
  portions?: number;
}

export interface RecipeItem { productId: string; grams: number }
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export interface Recipe extends Meta {
  name: string;
  servings: number;
  items: RecipeItem[];
  notes?: string;
  favorite?: boolean;
  /** kroki przygotowania (przepisy z biblioteki i ich kopie) */
  steps?: string[];
  /** z którego gotowego przepisu skopiowano */
  libraryId?: string;
  meal?: MealSlot;
  minutes?: number;
}

export interface MealTemplateRec { name: string; items: RecipeItem[] }
/** Szablon dnia edytowany w aplikacji: id 'A'/'B'/'C' nadpisuje domyślny, inne id = własny wariant. */
export interface DayTemplateRec extends Meta {
  name: string;
  meals: MealTemplateRec[];
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
  /** snapshot planu z chwili startu (edycja szablonu nie zmienia trwających ani zakończonych treningów) */
  plan?: PlanItem[];
  planName?: string;
  /** decyzje o sugestii progresji per faktyczne ćwiczenie (exerciseId); serie historyczne się nie zmieniają */
  progress?: Record<string, ProgressDecision>;
}

export interface ProgressDecision {
  action: 'increase' | 'reps' | 'hold' | 'decrease' | 'skip' | 'no_data';
  suggestedKg: number | null;
  targetReps: string;
  reason: string;
  decision: 'accepted' | 'rejected' | 'modified';
  /** ciężar wybrany przez użytkownika na dziś (kg) */
  chosenKg: number | null;
  at: number;
}

export interface PlanItem { exerciseId: string; sets: number; repMin: number; repMax: number; restSec: number; kneeCaution?: boolean }
/** Plan treningowy edytowany w aplikacji: id 'A'/'B' nadpisuje domyślny, inne id = własny wariant dla danego slotu. */
export interface WorkoutTemplateRec extends Meta {
  slot: 'A' | 'B';
  name: string;
  items: PlanItem[];
}

export interface CustodyConfig { id: 'custody'; cycleStart: LocalDate; confirmed: boolean; updatedAt: number }
export interface CalendarOverride { date: LocalDate; withDaughter: boolean; updatedAt: number }

export interface SymptomLog extends Meta {
  date: LocalDate; time?: string; products: string; abdominalPain?: number; diarrhea?: boolean; bloating?: boolean; severity?: number; onsetMinutes?: number; note?: string;
}
export interface LabResult extends Meta {
  date: LocalDate; name: string; value: string; unit: string; refRange?: string; doctorNote?: string;
}
export type RejectReason = 'not_now' | 'no_time' | 'not_helpful' | 'not_fit' | 'health' | 'other';
/** action 'reset' = użytkownik przywrócił ukrytą poradę (wcześniejsze odrzucenia przestają działać). Brak reason przy 'rejected' (≤0.5) = „nie teraz”. */
export interface RecommendationFeedback extends Meta { recId: string; date: LocalDate; action: 'accepted' | 'rejected' | 'reset'; reason?: RejectReason; note?: string }

export interface Settings {
  id: 'settings';
  theme: 'dark' | 'light';
  onboarded: boolean;
  /** legacy (≤0.5): moment wygenerowania pliku, nie potwierdzenie zapisu */
  lastBackupAt?: number;
  lastExport?: { at: number; total: number; bytes: number; verified: boolean; encrypted: boolean };
  /** użytkownik potwierdził, że plik jest zapisany w Plikach/iCloud */
  lastBackupConfirmedAt?: number;
  /** aktywny wariant planu dla slotu A/B (brak = domyślny lub edytowany 'A'/'B') */
  activeWorkouts?: { A?: string; B?: string };
  /** klucz cyklu przypomnienia o kopii odłożonego w porannym check-inie */
  backupReminderDismissed?: string;
  /** propozycje „Co mam teraz zjeść?” ukryte przez użytkownika (id propozycji) */
  suggestHidden?: string[];
  weightUnit?: 'kg' | 'lb';
  /** cel treningów w tygodniu (domyślnie 3) */
  trainingsPerWeek?: number;
  /** preferowane okno treningowe (informacyjnie, nie obowiązkowa godzina) */
  trainingWindow?: { from: string; to: string };
  /** dni oznaczone jako niedostępne / przełożony trening */
  trainingSkip?: string[];
  /** od tego dnia plan treningów liczy planer tygodniowy (bez kalendarza opieki); wcześniejsze dni bez zmian */
  scheduleV2From?: string;
  /** najmniejsze dostępne skoki obciążenia w jednostce użytkownika */
  loadSteps?: Partial<Record<'dumbbell' | 'machine' | 'cable' | 'barbell', number>>;
  backupReminderDays: number;
  aiIncludeHealth: boolean;
}
