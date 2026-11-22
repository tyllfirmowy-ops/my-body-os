import { describe, expect, it } from 'vitest';
import { estimateTdee, planFromTdee, observedTdee } from '../src/domain/energy';
import { parseSync, normalizeSleep } from '../src/domain/sync';
import { weeklyStats, weeklyMarkdown } from '../src/domain/report';
import { addDays } from '../src/domain/dates';

const hubert = { job: 'desk' as const, stepsPerDay: 6500, workoutsPerWeek: 2, workoutMin: 60, workoutType: 'strength' as const, cardioMinPerWeek: 24 };
describe('zapotrzebowanie', () => {
  it('TDEE profilu mieści się w zakresie ze specyfikacji 2700–3050', () => {
    const e = estimateTdee(2152.5, 110, 190, hubert);
    expect(e.tdee).toBeGreaterThanOrEqual(2700); expect(e.tdee).toBeLessThanOrEqual(3050);
    expect(e.base + e.steps + e.training + e.cardio).toBeCloseTo(e.tdee, -1);
  });
  it('więcej kroków = wyższe TDEE', () => {
    expect(estimateTdee(2152.5, 110, 190, { ...hubert, stepsPerDay: 10000 }).tdee).toBeGreaterThan(estimateTdee(2152.5, 110, 190, hubert).tdee);
  });
  it('plan: deficyt 15%, białko 1,7 g/kg celu, minimum 2100', () => {
    const p = planFromTdee(2720, 97, 'gentle');
    expect(p.kcal).toBe(2300); expect(p.proteinG).toBe(165);
    expect(planFromTdee(2300, 97, 'standard').kcal).toBe(2100);
  });
  const w28 = (f: (i: number) => number) => Array.from({ length: 28 }, (_, i) => ({ date: addDays('2026-10-01', i), value: f(i) }));
  const days = (n: number, kcal: number, c = 'confirmed') => Array.from({ length: n }, (_, i) => ({ date: addDays('2026-10-01', i), kcal, completeness: c }));
  it('TDEE z danych: stała waga przy 2500 kcal → 2500, wysoka wiarygodność', () => {
    const r = observedTdee(w28(() => 110), days(28, 2500), '2026-10-28');
    expect(r).toMatchObject({ tdee: 2500, reliability: 'high', usableForPlan: true });
    expect(r.range).toEqual([2350, 2650]);
  });
  it('TDEE z danych: spadek 0,5 kg/tydz. przy 2400 kcal → ~2950', () => {
    const t = observedTdee(w28((i) => 110 - (i * 0.5) / 7), days(28, 2400), '2026-10-28').tdee!;
    expect(t).toBeGreaterThan(2900); expect(t).toBeLessThan(3000);
  });
  it('dni niekompletne są pomijane i nie zaniżają średniej', () => {
    const d = [...days(20, 2500), ...Array.from({ length: 8 }, (_, i) => ({ date: addDays('2026-10-21', i), kcal: 900, completeness: 'incomplete' }))];
    const r = observedTdee(w28(() => 110), d, '2026-10-28');
    expect(r.tdee).toBe(2500); expect(r.completeDays).toBe(20);
  });
  it('same dni „prawdopodobne” bez potwierdzeń → niska wiarygodność, nieużywane do planu', () => {
    const r = observedTdee(w28(() => 110).filter((_, i) => i % 3 === 0), days(12, 2500, 'probable'), '2026-10-28');
    expect(r.reliability).toBe('low'); expect(r.usableForPlan).toBe(false);
  });
  it('za mało danych → brak wyniku', () => expect(observedTdee([], [], '2026-10-28')).toMatchObject({ tdee: null, reliability: 'insufficient' }));
});

describe('synchronizacja ze Zdrowiem', () => {
  it('format ze schowka z polskim przecinkiem', () => {
    expect(parseSync('MBOS1;steps=8 432;sleep=7,25;active=540,3;rhr=62;weight=109,8')).toEqual({ steps: 8432, sleepMinutes: 435, activeKcal: 540, restingHr: 62, weightKg: 109.8 });
  });
  it('hash z adresu i puste wartości', () => expect(parseSync('https://x.app/#sync&steps=5000&weight=&rhr=')).toEqual({ steps: 5000 }));
  it('sen w sekundach i minutach', () => { expect(normalizeSleep(26100)).toBe(435); expect(normalizeSleep(435)).toBe(435); });
  it('śmieci → null', () => { expect(parseSync('hello')).toBeNull(); expect(parseSync('MBOS1;weight=5')).toBeNull(); });
});

describe('raport miesięczny', () => {
  it('liczy realizację diety i treningów', () => {
    const days = Array.from({ length: 28 }, (_, i) => ({ date: addDays('2026-10-01', i), workoutPlanned: i % 7 === 0, workoutDone: i % 14 === 0, withDaughter: false,
      evening: { date: '', dietAdherence: (i % 4 === 0 ? 'no' : 'yes') as 'yes' | 'no', steps: 8000, createdAt: 0, updatedAt: 0 } }));
    const s = weeklyStats(days, [], [], '2026-10-28', 28, 7000);
    expect(s).toMatchObject({ dietYes: 21, dietAnswered: 28, workoutsDone: 2, workoutsPlanned: 4, stepsGoalDays: 28 });
    expect(weeklyMarkdown(s, { status: 'calibration', weeklyLossKg: null, reliable: false, message: 'x', checks: [] }, [], 2450)).toContain('Raport miesięczny');
  });
});
