import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyMeasurement, CalendarOverride, CustodyConfig, EveningCheckIn, FoodEntry, FoodProduct, HealthProfile, LabResult,
  MorningCheckIn, PlanVersion, RecommendationFeedback, Settings, SymptomLog, UserProfile, WaterLog, WorkoutSession, WorkoutSet,
} from '../domain/types';

export class BodyDB extends Dexie {
  profile!: EntityTable<UserProfile, 'id'>;
  health!: EntityTable<HealthProfile, 'id'>;
  plans!: EntityTable<PlanVersion, 'id'>;
  morning!: EntityTable<MorningCheckIn, 'date'>;
  evening!: EntityTable<EveningCheckIn, 'date'>;
  measurements!: EntityTable<BodyMeasurement, 'id'>;
  foods!: EntityTable<FoodProduct, 'id'>;
  entries!: EntityTable<FoodEntry, 'id'>;
  water!: EntityTable<WaterLog, 'date'>;
  sessions!: EntityTable<WorkoutSession, 'id'>;
  sets!: EntityTable<WorkoutSet, 'id'>;
  custody!: EntityTable<CustodyConfig, 'id'>;
  overrides!: EntityTable<CalendarOverride, 'date'>;
  symptoms!: EntityTable<SymptomLog, 'id'>;
  labs!: EntityTable<LabResult, 'id'>;
  feedback!: EntityTable<RecommendationFeedback, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'my-body-os') {
    super(name);
    // Migracje: każda zmiana schematu = nowa wersja, nigdy edycja istniejącej.
    this.version(1).stores({
      profile: 'id', health: 'id', plans: 'id, validFrom',
      morning: 'date', evening: 'date', measurements: 'id, date',
      foods: 'id, name, favorite', entries: 'id, date, productId', water: 'date',
      sessions: 'id, date, status', sets: 'id, sessionId, exerciseId, [sessionId+exerciseId]',
      custody: 'id', overrides: 'date', symptoms: 'id, date', labs: 'id, date', feedback: 'id, date', settings: 'id',
    });
    // v2: szybkie wpisy kcal miały makro zapisane jako 0. Oznaczamy je jako nieznane (dane zostają, zmienia się interpretacja).
    this.version(2).stores({}).upgrade((tx) => tx.table('entries').toCollection().modify(migrateEntryV2));
  }
}

export const db = new BodyDB();
export const TABLES = ['profile', 'health', 'plans', 'morning', 'evening', 'measurements', 'foods', 'entries', 'water', 'sessions', 'sets', 'custody', 'overrides', 'symptoms', 'labs', 'feedback', 'settings'] as const;
export type TableName = (typeof TABLES)[number];

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const now = () => Date.now();

/** Migracja v2 (czysta funkcja, testowana): wpis bez produktu („quick”) → makro z zerem = nieznane. */
export function migrateEntryV2(e: { productId: string; unknown?: string[]; snapshot: { protein: number; fat: number; carbs: number; fiber: number } }) {
  if (e.productId !== 'quick' || e.unknown) return;
  const u = (['fat', 'carbs', 'fiber'] as const).filter((k) => e.snapshot[k] === 0) as string[];
  if (e.snapshot.protein === 0) u.unshift('protein');
  e.unknown = u;
}
