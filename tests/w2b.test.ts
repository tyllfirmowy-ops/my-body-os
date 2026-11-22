import { describe, expect, it } from 'vitest';
import { planWeekly, weekSummary, withDaughter, type SessionRef } from '../src/domain/schedule';
import { historicalPlanned, isTrainingDayFor } from '../src/db/repo';
import { coach, type DaySnapshot } from '../src/domain/coaching';
import { suggestProgression, type SetResult } from '../src/domain/progression';
import { addDays, mondayOf } from '../src/domain/dates';
import type { AppData } from '../src/db/repo';

const done = (date: string, templateId: 'A' | 'B'): SessionRef => ({ date, templateId, status: 'completed' });

describe('Planowanie tygodniowe (bez kalendarza opieki)', () => {
  it('domyślnie 3 treningi w tygodniu, min. 2 dni odstępu, rotacja A/B', () => {
    const p = planWeekly({ from: '2026-11-23', horizon: 14, sessions: [] }); // poniedziałek
    const w1 = p.filter((x) => x.date <= '2026-11-29');
    expect(w1.map((x) => x.date)).toEqual(['2026-11-23', '2026-11-25', '2026-11-27']);
    expect(p.map((x) => x.templateId).slice(0, 4)).toEqual(['A', 'B', 'A', 'B']);
    for (let i = 1; i < p.length; i++) expect(Number(new Date(p[i].date)) - Number(new Date(p[i - 1].date))).toBeGreaterThanOrEqual(2 * 864e5);
  });
  it('wykonane treningi liczą się do tygodnia; pominięte się nie kumulują', () => {
    const p = planWeekly({ from: '2026-11-26', horizon: 4, sessions: [done('2026-11-23', 'A')] }); // czw–nd, w tygodniu 1 zrobiony
    expect(p.map((x) => x.date)).toEqual(['2026-11-26', '2026-11-28']); // cel 3: 1 zrobiony + 2, bez nadrabiania ponad cel
    expect(p[0].templateId).toBe('B');
  });
  it('dzień niedostępny przesuwa trening na kolejny możliwy', () => {
    const p = planWeekly({ from: '2026-11-23', horizon: 7, sessions: [], skip: ['2026-11-23'] });
    expect(p[0].date).toBe('2026-11-24');
  });
  it('cel 2 tygodniowo respektowany; trudny tydzień z 2 treningami = minimum', () => {
    expect(planWeekly({ from: '2026-11-23', horizon: 7, sessions: [], perWeek: 2 })).toHaveLength(2);
    const s = weekSummary([done('2026-11-23', 'A'), done('2026-11-26', 'B')], '2026-11-28', 3);
    expect(s).toMatchObject({ done: 2, target: 3, minimum: 2 });
  });
  it('planer nie zna kalendarza opieki: dzień „z córką” może być treningowy', () => {
    const custody = { cycleStart: '2026-11-23', overrides: {} };
    expect(withDaughter(custody, '2026-11-23')).toBe(true);
    expect(planWeekly({ from: '2026-11-23', horizon: 1, sessions: [] })[0].date).toBe('2026-11-23');
  });
});

describe('Historia bilansów bez zmian po przejściu na nowy planer', () => {
  const plan = { id: 'p', createdAt: 0, updatedAt: 0, validFrom: '2026-10-01', kcal: 2400, proteinG: 180, fatG: 70, carbsG: 260, fiberG: [30, 35] as [number, number], mealsPerDay: 4, workoutsPer14d: 4, reason: 'x', approvedByUser: true };
  const base = { plans: [plan], sessions: [], overrides: [], custody: { id: 'custody' as const, cycleStart: '2026-11-02', confirmed: true, updatedAt: 0 } };
  it('przed dniem przejścia: dawne dni (z córką) nie są „planowane”; od dnia przejścia: planer tygodniowy', () => {
    const d = { ...base, settings: { id: 'settings', theme: 'dark', onboarded: true, backupReminderDays: 7, aiIncludeHealth: false, scheduleV2From: '2026-11-16' } } as unknown as AppData;
    const old = historicalPlanned(d, '2026-11-02', '2026-11-15', '2026-11-30');
    const custody = { cycleStart: '2026-11-02', overrides: {} };
    expect([...old].every((dt) => !withDaughter(custody, dt))).toBe(true); // dawna reguła
    expect(old.size).toBeGreaterThan(0);
    const fresh = historicalPlanned(d, '2026-11-16', '2026-11-22', '2026-11-30');
    expect(withDaughter(custody, '2026-11-16')).toBe(true);
    expect(fresh.has('2026-11-16')).toBe(true); // poniedziałek z córką, teraz dzień treningowy
  });
  it('cel kcal dnia treningowego zależy od planu/wykonania, nie od opieki', () => {
    const d = { ...base, sessions: [{ id: 's', date: '2026-11-16', templateId: 'A', status: 'completed', startedAt: 0 }], settings: { scheduleV2From: '2026-11-16' } } as unknown as AppData;
    const planned = historicalPlanned(d, '2026-11-16', '2026-11-22', '2026-11-30');
    expect(isTrainingDayFor(d, '2026-11-16', planned)).toBe(true);
    expect(isTrainingDayFor(d, '2026-11-17', planned)).toBe(false);
  });
  it('bez zapisanej daty przejścia cała przeszłość liczona dawną regułą (bezpieczny domyślny)', () => {
    const d = { ...base, settings: {} } as unknown as AppData;
    expect(historicalPlanned(d, '2026-11-16', '2026-11-22', '2026-11-30').has('2026-11-16')).toBe(false);
  });
});

describe('Coaching po zmianie dostępności', () => {
  it('opuszczony zaplanowany trening liczy się także w dzień opieki (opieka nie ogranicza treningu)', () => {
    const days: DaySnapshot[] = ['2026-11-15', '2026-11-17'].map((date) => ({ date, workoutPlanned: true, workoutDone: false, withDaughter: true }));
    const r = coach(days, '2026-11-20', 2400).find((x) => x.id === 'missed_workouts');
    expect(r).toBeDefined();
    expect(r!.limits).toMatch(/Nie nadrabiamy/);
  });
});

describe('W2: brak bólu ≠ bezpiecznie, propozycja startowa', () => {
  const S = (pain?: number): SetResult[] => [12, 12, 12].map((reps) => ({ weightKg: 20, reps, pain, done: true }));
  const two = (pain?: number) => [{ date: '2026-11-19', sets: S(pain) }, { date: '2026-11-15', sets: S(pain) }];
  const base = { today: '2026-11-22', plannedSets: 3, repMin: 8, repMax: 12, step: 2, safetyBlock: false };
  it('ćwiczenie kolanowe bez oceny: bez wpisanego bólu nie zwiększa', () => {
    expect(suggestProgression({ ...base, history: two(), requirePainRecord: true }).reason).toMatch(/zaznacz ból/);
    expect(suggestProgression({ ...base, history: two(0), requirePainRecord: true }).action).toBe('increase');
    expect(suggestProgression({ ...base, history: two() }).action).toBe('increase'); // ćwiczenie bez obciążenia kolana
  });
  it('brak historii: prosta propozycja startowa (bez wymyślonego ciężaru)', () => {
    const r = suggestProgression({ ...base, history: [] });
    expect(r).toMatchObject({ action: 'no_data', weightKg: null });
    expect(r.reason).toMatch(/2–3 w zapasie/);
  });
  it('tydzień = poniedziałek–niedziela', () => {
    expect(mondayOf('2026-11-29')).toBe('2026-11-23');
    expect(addDays('2026-11-23', 6)).toBe('2026-11-29');
  });
});
