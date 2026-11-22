import { z } from 'zod';
import { db, now, uid } from './db';
import { SEED_FOODS } from '../data/foods';
import { addDays, diffDays, range, today as todayFn, type LocalDate } from '../domain/dates';
import { sumNutrients, bmrMifflin, ageOn, type DatedValue } from '../domain/calc';
import { planWorkouts, withDaughter, type CustodyInput, type PlannedWorkout } from '../domain/schedule';
import { evaluateSafety } from '../domain/safety';
import { evaluateReadiness } from '../domain/readiness';
import { evaluateAdaptation, stepTarget } from '../domain/adaptation';
import { coach, type DaySnapshot } from '../domain/coaching';
import type {
  BodyMeasurement, CalendarOverride, CustodyConfig, EveningCheckIn, FoodEntry, FoodProduct, HealthProfile, LabResult, MorningCheckIn,
  PlanVersion, RecommendationFeedback, Settings, SymptomLog, UserProfile, WaterLog, WorkoutSession, WorkoutSet,
} from '../domain/types';

export interface AppData {
  profile?: UserProfile; health?: HealthProfile; plans: PlanVersion[]; morning: MorningCheckIn[]; evening: EveningCheckIn[];
  measurements: BodyMeasurement[]; foods: FoodProduct[]; entries: FoodEntry[]; water: WaterLog[]; sessions: WorkoutSession[]; sets: WorkoutSet[];
  custody?: CustodyConfig; overrides: CalendarOverride[]; symptoms: SymptomLog[]; labs: LabResult[]; feedback: RecommendationFeedback[]; settings?: Settings;
}

export async function loadAll(): Promise<AppData> {
  const [profile, health, plans, morning, evening, measurements, foods, entries, water, sessions, sets, custody, overrides, symptoms, labs, feedback, settings] = await Promise.all([
    db.profile.get('me'), db.health.get('me'), db.plans.orderBy('validFrom').toArray(), db.morning.toArray(), db.evening.toArray(),
    db.measurements.orderBy('date').toArray(), db.foods.toArray(), db.entries.toArray(), db.water.toArray(), db.sessions.orderBy('date').toArray(),
    db.sets.toArray(), db.custody.get('custody'), db.overrides.toArray(), db.symptoms.toArray(), db.labs.toArray(), db.feedback.toArray(), db.settings.get('settings'),
  ]);
  return { profile, health, plans, morning, evening, measurements, foods, entries, water, sessions, sets, custody, overrides, symptoms, labs, feedback, settings };
}

export async function seedIfEmpty() {
  if ((await db.foods.count()) === 0) await db.foods.bulkPut(SEED_FOODS.map((f) => ({ ...f, updatedAt: now() })));
  if (!(await db.settings.get('settings'))) await db.settings.put({ id: 'settings', theme: 'dark', onboarded: false, backupReminderDays: 7, aiIncludeHealth: false });
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => undefined);
}

// ---- prywatny profil (plik JSON spoza repozytorium) ----
export const PrivateProfile = z.object({
  format: z.literal('my-body-os-profile'),
  profile: z.object({ name: z.string(), sex: z.enum(['male', 'female']), ageYears: z.number(), ageRefDate: z.string(), heightCm: z.number(), declaredWeightKg: z.number(), goals: z.array(z.object({ kg: z.number(), label: z.string() })) }),
  health: z.object({ conditions: z.array(z.string()), kneeNote: z.string(), kneeCleared: z.boolean(), dairyAvoid: z.boolean(), notes: z.array(z.string()) }),
  plan: z.object({ kcal: z.number().min(1200).max(5000), proteinG: z.number(), fatG: z.number(), carbsG: z.number(), fiberG: z.tuple([z.number(), z.number()]), mealsPerDay: z.number(), workoutsPer14d: z.number() }),
  historicalMeasurements: z.array(z.object({ weightKg: z.number().optional(), waistCm: z.number().optional(), hipsCm: z.number().optional(), armCm: z.number().optional(), thighCm: z.number().optional(), note: z.string().optional() })).optional(),
});
export type PrivateProfileT = z.infer<typeof PrivateProfile>;

export async function applyProfile(p: PrivateProfileT, startDate: LocalDate) {
  const t = now();
  await db.transaction('rw', [db.profile, db.health, db.plans, db.measurements], async () => {
    await db.profile.put({ id: 'me', ...p.profile, startDate, updatedAt: t });
    await db.health.put({ id: 'me', ...p.health, updatedAt: t });
    if ((await db.plans.count()) === 0) {
      await db.plans.add({ id: uid(), createdAt: t, updatedAt: t, validFrom: startDate, ...p.plan, reason: 'Plan startowy (hipoteza do kalibracji)', approvedByUser: true, source: 'import' });
    }
    for (const h of p.historicalMeasurements ?? []) {
      await db.measurements.add({ id: uid(), createdAt: t, updatedAt: t, date: startDate, historical: true, ...h, source: 'import' });
    }
  });
}

// ---- pochodne ----
export function custodyInput(d: AppData): CustodyInput | undefined {
  if (!d.custody) return undefined;
  return { cycleStart: d.custody.cycleStart, overrides: Object.fromEntries(d.overrides.map((o) => [o.date, o.withDaughter])) };
}
export function planFor(d: AppData, date: LocalDate): PlanVersion | undefined {
  return [...d.plans].filter((p) => p.validFrom <= date).sort((a, b) => b.validFrom.localeCompare(a.validFrom) || b.createdAt - a.createdAt)[0] ?? d.plans[0];
}
export function weightSeries(d: AppData): DatedValue[] {
  const m = new Map<string, number>();
  d.measurements.filter((x) => !x.historical && x.weightKg).forEach((x) => m.set(x.date, x.weightKg!));
  d.morning.filter((x) => x.weightKg).forEach((x) => m.set(x.date, x.weightKg!));
  return [...m.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}
export function waistSeries(d: AppData): DatedValue[] {
  return d.measurements.filter((x) => !x.historical && x.waistCm).map((x) => ({ date: x.date, value: x.waistCm! }));
}
export function dayIntake(d: AppData, date: LocalDate) {
  const e = d.entries.filter((x) => x.date === date);
  if (!e.length) return undefined;
  return { ...sumNutrients(e.map((x) => x.snapshot)), meals: new Set(e.map((x) => x.meal)).size };
}
export function snapshots(d: AppData, from: LocalDate, to: LocalDate, planned: Set<LocalDate>): DaySnapshot[] {
  const c = custodyInput(d);
  return range(from, diffDays(from, to) + 1).map((date) => {
    const intake = dayIntake(d, date);
    return {
      date, morning: d.morning.find((m) => m.date === date), evening: d.evening.find((e) => e.date === date),
      kcal: intake?.kcal, protein: intake?.protein, fiber: intake?.fiber, meals: intake?.meals,
      waterMl: d.water.find((w) => w.date === date)?.ml,
      workoutPlanned: planned.has(date), workoutDone: d.sessions.some((s) => s.date === date && s.status === 'completed'),
      withDaughter: c ? withDaughter(c, date) : false,
    };
  });
}

/** Historyczne "plany" do rozliczeń: dzień był zaplanowany, jeśli plan liczony od tego dnia wskazywał go jako pierwszy. */
export function historicalPlanned(d: AppData, from: LocalDate, to: LocalDate): Set<LocalDate> {
  const c = custodyInput(d); const out = new Set<LocalDate>();
  const per = planFor(d, to)?.workoutsPer14d ?? 4;
  if (!c) return out;
  for (const date of range(from, diffDays(from, to) + 1)) {
    const prior = d.sessions.filter((s) => s.date < date).map((s) => ({ date: s.date, templateId: s.templateId, status: s.status }));
    const p = planWorkouts({ from: date, horizon: 1, custody: c, sessions: prior, perCycle: per });
    if (p.length) out.add(date);
  }
  return out;
}

export function derive(d: AppData, today: LocalDate = todayFn()) {
  const plan = planFor(d, today);
  const custody = custodyInput(d);
  const morningToday = d.morning.find((m) => m.date === today);
  const safety = evaluateSafety(morningToday, d.health?.kneeCleared ?? false);
  const readiness = evaluateReadiness(morningToday, safety.level);
  const refs = d.sessions.map((s) => ({ date: s.date, templateId: s.templateId, status: s.status }));
  const upcoming: PlannedWorkout[] = custody && plan ? planWorkouts({ from: today, horizon: 28, custody, sessions: refs, perCycle: plan.workoutsPer14d }) : [];
  const todayWorkout = upcoming.find((u) => u.date === today);
  const doneToday = d.sessions.find((s) => s.date === today && s.status === 'completed');
  const inProgress = d.sessions.find((s) => s.status === 'in_progress');
  const start = d.profile?.startDate ?? today;
  const histFrom = addDays(today, -28) > start ? addDays(today, -28) : start;
  const past = historicalPlanned(d, histFrom, addDays(today, -1));
  const snaps = snapshots(d, addDays(today, -35), today, past);
  const recs = plan ? coach(snaps.filter((s) => s.date >= start), today, plan.kcal) : [];
  const weekIdx = Math.floor(diffDays(start, today) / 7);
  const kneeIssue = snaps.slice(-8).some((s) => (s.morning?.kneePain ?? 0) >= 4 || (s.evening?.kneePain ?? 0) >= 4);
  const steps = stepTarget(weekIdx, kneeIssue, stepTarget(weekIdx - 1, false));
  const intake = dayIntake(d, today);
  const weights = weightSeries(d);
  const lastChange = [...d.plans].sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]?.validFrom ?? start;
  const intakeDays = snaps.filter((s) => s.kcal !== undefined && (s.meals ?? 0) >= 3).map((s) => ({ date: s.date, kcal: s.kcal! }));
  const adapt = plan ? evaluateAdaptation({
    today, planStart: start, lastPlanChange: lastChange, kcalTarget: plan.kcal, weights, waists: waistSeries(d), intakeDays,
    healthFlag: safety.level === 'urgent' || !!morningToday?.symptoms.includes('illness'),
  }) : undefined;
  const lastActivity = [...d.morning.map((m) => m.date), ...d.evening.map((e) => e.date), ...d.entries.map((e) => e.date)].sort().at(-1);
  const bmr = d.profile ? bmrMifflin({ weightKg: weights.at(-1)?.value ?? d.profile.declaredWeightKg, heightCm: d.profile.heightCm, age: ageOn(d.profile, today), sex: d.profile.sex }) : null;
  return {
    today, plan, custody, morningToday, eveningToday: d.evening.find((e) => e.date === today), safety, readiness, upcoming, todayWorkout, doneToday, inProgress,
    snaps, recs, steps, weekIdx, intake, weights, adapt, bmr,
    withDaughterToday: custody ? withDaughter(custody, today) : undefined,
    returnMode: lastActivity ? diffDays(lastActivity, today) >= 3 : false,
    water: d.water.find((w) => w.date === today)?.ml ?? 0,
  };
}
export type Derived = ReturnType<typeof derive>;
