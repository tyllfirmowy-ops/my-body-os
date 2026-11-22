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
  it('TDEE z danych: stała waga przy 2500 kcal → ~2500', () => {
    const w = Array.from({ length: 28 }, (_, i) => ({ date: addDays('2026-10-01', i), value: 110 }));
    const intake = w.map((x) => ({ date: x.date, kcal: 2500 }));
    expect(observedTdee(w, intake, '2026-10-28').tdee).toBe(2500);
  });
  it('TDEE z danych: spadek 0,5 kg/tydz. przy 2400 kcal → ~2950', () => {
    const w = Array.from({ length: 28 }, (_, i) => ({ date: addDays('2026-10-01', i), value: 110 - (i * 0.5) / 7 }));
    const t = observedTdee(w, w.map((x) => ({ date: x.date, kcal: 2400 })), '2026-10-28').tdee!;
    expect(t).toBeGreaterThan(2900); expect(t).toBeLessThan(3000);
  });
  it('TDEE z danych: za mało danych → brak wyniku', () => expect(observedTdee([], [], '2026-10-28').tdee).toBeNull());
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
