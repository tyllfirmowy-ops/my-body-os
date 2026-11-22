import { describe, expect, it } from 'vitest';
import { LB, suggestProgression, type ProgressInput, type SetResult } from '../src/domain/progression';
import { planWeekly } from '../src/domain/schedule';

const sets = (w: number, reps: number[], extra: Partial<SetResult> = {}): SetResult[] => reps.map((r) => ({ weightKg: w, reps: r, done: true, ...extra }));
const base: Omit<ProgressInput, 'history'> = { today: '2026-11-22', plannedSets: 3, repMin: 8, repMax: 12, step: 2.5, safetyBlock: false };

describe('Audyt W2: jednostki, siatka skoków, brak RIR', () => {
  it('uzasadnienie w lb przy ustawieniu lb (bez „kg”)', () => {
    const lb = (v: number) => v * LB;
    const s = suggestProgression({ ...base, step: 5 * LB, unit: 'lb', history: [
      { date: '2026-11-20', sets: sets(lb(50), [12, 12, 12]) }, { date: '2026-11-17', sets: sets(lb(50), [12, 12, 12]) }] });
    expect(s.action).toBe('increase');
    expect(s.reason).toContain('5 lb');
    expect(s.reason).not.toContain('kg');
    expect(s.basis?.[0]).toContain('50×12');
  });
  it('uzasadnienie dużego skoku w lb', () => {
    const s = suggestProgression({ ...base, step: 5 * LB, unit: 'lb', history: [
      { date: '2026-11-20', sets: sets(35 * LB, [12, 12, 12]) }, { date: '2026-11-17', sets: sets(35 * LB, [12, 12, 12]) }] });
    expect(s.action).toBe('reps');
    expect(s.reason).toMatch(/40 lb/);
    expect(s.reason).toMatch(/35 lb/);
    expect(s.reason).not.toContain('kg');
  });
  it('ciężar spoza siatki: skok do najbliższego punktu, nigdy > 1 krok; procent z faktycznego skoku', () => {
    // 26,25 kg na siatce 2,5: następny 27,5 (+1,25 kg ≈ 4,8%), a nie 30
    const s = suggestProgression({ ...base, history: [
      { date: '2026-11-20', sets: sets(26.25, [12, 12, 12]) }, { date: '2026-11-17', sets: sets(26.25, [12, 12, 12]) }] });
    expect(s.action).toBe('increase');
    expect(s.weightKg).toBe(27.5);
  });
  it('granica 10%: 25→27,5 kg to zwiększenie, 22,5→25 (11%) już nie domyślnie', () => {
    const two = (w: number) => [{ date: '2026-11-20', sets: sets(w, [12, 12, 12]) }, { date: '2026-11-17', sets: sets(w, [12, 12, 12]) }];
    expect(suggestProgression({ ...base, history: two(25) }).action).toBe('increase');
    const b = suggestProgression({ ...base, history: two(22.5) });
    expect(b.action).toBe('reps');
    expect(b.alternativeKg).toBe(25);
  });
  it('po zmianie kg→lb: 20 kg (≈44 lb) → najbliższe 45 lb na siatce 5 lb, nie 50 lb', () => {
    const s = suggestProgression({ ...base, step: 5 * LB, unit: 'lb', history: [
      { date: '2026-11-20', sets: sets(20, [12, 12, 12]) }, { date: '2026-11-17', sets: sets(20, [12, 12, 12]) }] });
    expect(s.action).toBe('increase');
    expect(s.weightKg).toBeCloseTo(9 * 5 * LB, 1);
    expect(s.reason).toContain('lb');
  });
  it('brak RIR we wszystkich seriach: jeden trening na górze zakresu nie wystarcza do zwiększenia', () => {
    const s = suggestProgression({ ...base, history: [{ date: '2026-11-20', sets: sets(40, [12, 12, 12]) }] });
    expect(s.action).toBe('hold');
    expect(s.reason).toMatch(/Pierwszy raz górny zakres/);
  });
  it('po 2× 16 kg × 15 nadal decyduje ból 3, technika i RIR 0', () => {
    const h = (extra: Partial<SetResult> = {}, technique?: 'ok' | 'bad') => [
      { date: '2026-11-20', sets: sets(16, [15, 15, 15], extra), technique }, { date: '2026-11-17', sets: sets(16, [15, 15, 15]) }];
    const p = { ...base, step: 2, repMin: 10, repMax: 12 };
    expect(suggestProgression({ ...p, history: h() }).action).toBe('increase');
    expect(suggestProgression({ ...p, history: h({ pain: 3 }) }).action).toBe('hold');
    expect(suggestProgression({ ...p, history: h({ pain: 5 }) }).action).toBe('pain');
    expect(suggestProgression({ ...p, history: h({}, 'bad') }).action).toBe('hold');
    expect(suggestProgression({ ...p, history: h({ rir: 0 }) }).action).toBe('hold');
  });
  it('4 tygodnie przerwy: ok. 10% lżej po siatce, w dół', () => {
    const s = suggestProgression({ ...base, today: '2026-12-20', history: [{ date: '2026-11-20', sets: sets(40, [10, 10, 10]) }] });
    expect(s.action).toBe('decrease');
    expect(s.weightKg).toBe(35);
  });
  it('przełożenie i pominięcie zachowuje rotację A/B', () => {
    const p = planWeekly({ from: '2026-11-25', horizon: 7, sessions: [{ date: '2026-11-23', templateId: 'A', status: 'completed' }], skip: ['2026-11-25', '2026-11-26'] });
    expect(p[0]).toEqual({ date: '2026-11-27', templateId: 'B' });
    expect(p[1].templateId).toBe('A');
  });
});
