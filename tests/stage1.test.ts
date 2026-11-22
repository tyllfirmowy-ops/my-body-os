import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { BodyDB, migrateEntryV2 } from '../src/db/db';
import { importAll } from '../src/db/backup';
import { dayTargets, planOn, restDelta } from '../src/domain/targets';
import { completeness, reliableMacro, sumDay } from '../src/domain/intake';
import { coach, type DaySnapshot } from '../src/domain/coaching';
import { evaluateAdaptation } from '../src/domain/adaptation';
import { validatePlanEdit, fillCarbs } from '../src/domain/planEdit';
import { fitDayToTargets, templateTotals } from '../src/domain/nutrition';
import { weeklyStats } from '../src/domain/report';
import { SEED_FOODS, DAY_TEMPLATES } from '../src/data/foods';
import { EXTRA_FOODS } from '../src/data/foodsExtra';
import { addDays } from '../src/domain/dates';
import type { FoodEntry, PlanVersion } from '../src/domain/types';

const plan: PlanVersion = { id: 'p1', createdAt: 1, updatedAt: 1, validFrom: '2026-11-01', kcal: 2450, proteinG: 165, fatG: 80, carbsG: 267, fiberG: [30, 35], mealsPerDay: 4, workoutsPer14d: 4, reason: '', approvedByUser: true };
const entry = (o: Partial<FoodEntry>): FoodEntry => ({ id: Math.random().toString(), createdAt: 0, updatedAt: 0, date: '2026-11-20', meal: 1, productId: 'x', grams: 100, snapshot: { name: 'x', kcal: 500, protein: 30, fat: 20, carbs: 50, fiber: 5 }, ...o });

describe('cykl kalorii: budżet 14 dni', () => {
  const p = { ...plan, cycling: { enabled: true, trainingExtraKcal: 200 } };
  it('przykład: średnia 2450, trening 2650, odpoczynek 2370', () => {
    expect(dayTargets(p, true).kcal).toBe(2650); expect(dayTargets(p, false).kcal).toBe(2370);
  });
  it('4 treningi + 10 dni odpoczynku = dokładnie 14 × 2450', () => {
    expect(4 * dayTargets(p, true).kcal + 10 * dayTargets(p, false).kcal).toBe(14 * 2450);
  });
  it('inna liczba treningów (3/14) też trzyma budżet (±zaokrąglenie)', () => {
    const q = { ...p, workoutsPer14d: 3 };
    expect(Math.abs(3 * dayTargets(q, true).kcal + 11 * dayTargets(q, false).kcal - 14 * 2450)).toBeLessThanOrEqual(11);
    expect(restDelta(200, 0)).toBe(0);
  });
  it('odwołany trening nie karze: dzień zaplanowany zachowuje cel treningowy w analizie', () => {
    const snap: DaySnapshot = { date: '2026-11-21', kcal: 2640, target: dayTargets(p, true).kcal, workoutPlanned: true, workoutDone: false, withDaughter: false };
    expect(coach([snap], '2026-11-22', 2450).find((r) => r.id === 'over_yesterday')).toBeUndefined();
  });
});

describe('historyczny cel dnia', () => {
  const v2 = { ...plan, id: 'p2', createdAt: 2, validFrom: '2026-11-15', kcal: 2300 };
  it('planOn wybiera wersję obowiązującą danego dnia', () => {
    expect(planOn([v2, plan], '2026-11-10')!.kcal).toBe(2450);
    expect(planOn([v2, plan], '2026-11-16')!.kcal).toBe(2300);
  });
  it('coaching: 2600 kcal przy celu treningowym 2650 to nie przekroczenie; przy celu 2300 już tak', () => {
    const y = (target: number): DaySnapshot => ({ date: '2026-11-21', kcal: 2600, target, workoutPlanned: false, workoutDone: false, withDaughter: false });
    expect(coach([y(2650)], '2026-11-22', 2000).some((r) => r.id === 'over_yesterday')).toBe(false);
    expect(coach([y(2300)], '2026-11-22', 9999).some((r) => r.id === 'over_yesterday')).toBe(true);
  });
  it('adaptacja: realizacja liczona względem celów tych dni, nie średniego planu', () => {
    const intake = Array.from({ length: 14 }, (_, i) => ({ date: addDays('2026-10-15', i), kcal: i % 3 === 0 ? 2650 : 2370, target: i % 3 === 0 ? 2650 : 2370 }));
    const w = Array.from({ length: 28 }, (_, i) => ({ date: addDays('2026-10-01', i), value: 110 }));
    const r = evaluateAdaptation({ today: '2026-10-29', planStart: '2026-09-01', lastPlanChange: '2026-09-01', kcalTarget: 2450, weights: w, waists: [], intakeDays: intake });
    expect(r.status).toBe('stagnation');
    expect(r.checks.join(' ')).toContain('cel tych dni');
  });
  it('raport: średni cel tylko z dni z dziennikiem', () => {
    const s = weeklyStats([{ date: '2026-11-20', kcal: 2600, target: 2650, completeness: 'confirmed', workoutPlanned: true, workoutDone: true, withDaughter: false },
      { date: '2026-11-21', target: 2370, workoutPlanned: false, workoutDone: false, withDaughter: false }], [], [], '2026-11-21');
    expect(s.kcalTargetAvg).toBe(2650); expect(s.completeIntakeDays).toBe(1);
  });
});

describe('szybki wpis: nieznane ≠ 0', () => {
  it('pokrycie makro i makro niewiarygodne poniżej 80%', () => {
    const d = sumDay([entry({}), entry({ productId: 'quick', snapshot: { name: 'q', kcal: 1500, protein: 0, fat: 0, carbs: 0, fiber: 0 }, unknown: ['protein', 'fat', 'carbs', 'fiber'] })])!;
    expect(d.coverage.protein).toBe(0.25);
    expect(reliableMacro(d, 'protein')).toBeUndefined();
    expect(d.kcal).toBe(2000);
  });
  it('kompletność: potwierdzony / prawdopodobny / niepewny', () => {
    const full = sumDay([1, 2, 3, 4].map((m) => entry({ meal: m, snapshot: { name: 'x', kcal: 600, protein: 40, fat: 20, carbs: 60, fiber: 8 } })));
    expect(completeness(full, { date: '', foodLogComplete: true, createdAt: 0, updatedAt: 0 }, 2450, 4)).toBe('confirmed');
    expect(completeness(full, undefined, 2450, 4)).toBe('probable');
    expect(completeness(sumDay([entry({})]), undefined, 2450, 4)).toBe('incomplete');
    expect(completeness(sumDay([entry({})]), { date: '', foodLogComplete: true, createdAt: 0, updatedAt: 0 }, 2450, 4)).toBe('incomplete');
    expect(completeness(undefined, undefined, 2450, 4)).toBe('none');
  });
  it('migracja v2 (funkcja): stary szybki wpis z zerami → nieznane; zwykły wpis bez zmian', () => {
    const q = { productId: 'quick', snapshot: { protein: 25, fat: 0, carbs: 0, fiber: 0 } } as { productId: string; unknown?: string[]; snapshot: { protein: number; fat: number; carbs: number; fiber: number } };
    migrateEntryV2(q); expect(q.unknown).toEqual(['fat', 'carbs', 'fiber']);
    const n = { productId: 'oats', snapshot: { protein: 0, fat: 0, carbs: 0, fiber: 0 } } as typeof q;
    migrateEntryV2(n); expect(n.unknown).toBeUndefined();
  });
  it('migracja Dexie v1 → v2 na istniejącej bazie: dane zostają, szybkie wpisy oznaczone', async () => {
    const name = 'mig-test-' + Math.random();
    const v1 = new Dexie(name);
    v1.version(1).stores({ profile: 'id', health: 'id', plans: 'id, validFrom', morning: 'date', evening: 'date', measurements: 'id, date', foods: 'id, name, favorite', entries: 'id, date, productId', water: 'date', sessions: 'id, date, status', sets: 'id, sessionId, exerciseId, [sessionId+exerciseId]', custody: 'id', overrides: 'date', symptoms: 'id, date', labs: 'id, date', feedback: 'id, date', settings: 'id' });
    await v1.table('entries').bulkAdd([entry({ id: 'a' }), entry({ id: 'q', productId: 'quick', snapshot: { name: 'q', kcal: 800, protein: 0, fat: 0, carbs: 0, fiber: 0 } })]);
    await v1.table('morning').add({ date: '2026-11-20', weightKg: 110, symptoms: [], createdAt: 0, updatedAt: 0 });
    v1.close();
    const db2 = new BodyDB(name); await db2.open();
    expect(db2.verno).toBe(2);
    expect((await db2.entries.get('q'))!.unknown).toEqual(['protein', 'fat', 'carbs', 'fiber']);
    expect((await db2.entries.get('a'))!.unknown).toBeUndefined();
    expect((await db2.morning.get('2026-11-20'))!.weightKg).toBe(110);
    db2.close();
  });
  it('import starej kopii stosuje tę samą migrację', async () => {
    const db3 = new BodyDB('imp-test-' + Math.random());
    const r = await importAll({ format: 'my-body-os-backup', version: 1, exportedAt: 0, tables: { entries: [entry({ id: 'q2', productId: 'quick', snapshot: { name: 'q', kcal: 700, protein: 30, fat: 0, carbs: 0, fiber: 0 } })] } }, db3);
    expect(r.ok).toBe(true);
    expect((await db3.entries.get('q2'))!.unknown).toEqual(['fat', 'carbs', 'fiber']);
    db3.close();
  });
});

describe('ręczny edytor planu', () => {
  const ctx = { weightKg: 110, goalKg: 97, tdee: 2720, daysSinceLastChange: 30 };
  it('poprawny plan przechodzi', () => {
    const r = validatePlanEdit({ kcal: 2450, proteinG: 165, fatG: 80, carbsG: 267, reason: 'zalecenie dietetyka', specialistApproved: false }, ctx);
    expect(r.canSave).toBe(true); expect(r.deficitPct).toBe(10);
  });
  it('makro niezgodne z kcal, brak powodu i < 2100 bez potwierdzenia → błędy', () => {
    const r = validatePlanEdit({ kcal: 2000, proteinG: 165, fatG: 80, carbsG: 300, reason: '', specialistApproved: false }, ctx);
    expect(r.canSave).toBe(false); expect(r.errors).toHaveLength(3);
  });
  it('< 2100 z potwierdzeniem specjalisty dozwolone, ale z ostrzeżeniem o deficycie', () => {
    const k = 1900; const r = validatePlanEdit({ kcal: k, proteinG: 165, fatG: 65, carbsG: fillCarbs(k, 165, 65), reason: 'dietetyk kliniczny', specialistApproved: true }, ctx);
    expect(r.canSave).toBe(true); expect(r.warnings.join(' ')).toContain('Deficyt');
  });
  it('ostrzeżenie o przerwaniu 14-dniowej obserwacji', () => {
    const r = validatePlanEdit({ kcal: 2450, proteinG: 165, fatG: 80, carbsG: 267, reason: 'x', specialistApproved: false }, { ...ctx, daysSinceLastChange: 5 });
    expect(r.warnings.join(' ')).toContain('14-dniową');
  });
});

describe('dopasowanie jadłospisu do kcal i makro', () => {
  const products = new Map([...SEED_FOODS, ...EXTRA_FOODS].map((f) => [f.id, f]));
  const targets = [{ kcal: 2450, proteinG: 165, fatG: 80, carbsG: 267 }, { kcal: 2650, proteinG: 165, fatG: 80, carbsG: 317 }, { kcal: 2370, proteinG: 165, fatG: 80, carbsG: 247 }];
  it('każdy szablon trafia w tolerancję dla celów treningowych i odpoczynku', () => {
    for (const d of DAY_TEMPLATES) for (const t of targets) {
      const r = fitDayToTargets(products, d, t);
      expect(r.ok, `${d.id} ${t.kcal}: ${JSON.stringify(r.deviation)}`).toBe(true);
      r.day.meals.forEach((m) => m.items.forEach((i) => expect(i.grams % 5).toBe(0)));
    }
  });
  it('produkt źle tolerowany jest zamieniany na tolerowany tej samej roli', () => {
    const p2 = new Map(products); p2.set('salmon', { ...p2.get('salmon')!, tolerance: 'bad' });
    const r = fitDayToTargets(p2, DAY_TEMPLATES[0], targets[0]);
    expect(r.swapped[0].from).toContain('Łosoś');
    expect(r.day.meals.flatMap((m) => m.items).some((i) => i.productId === 'salmon')).toBe(false);
    expect(templateTotals(p2, r.day).protein).toBeGreaterThan(150);
  });
});
