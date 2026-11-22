import { describe, expect, it } from 'vitest';
import { bmrMifflin, macroKcal, mean, blockAverages } from '../src/domain/calc';
import { addDays, sleepMinutes, toLocalDate, weekday } from '../src/domain/dates';
import { SEED_FOODS, DAY_TEMPLATES } from '../src/data/foods';
import { templateTotals, scaleItems, fitDayToKcal, shoppingList } from '../src/domain/nutrition';
import { planWorkouts, withDaughter, PATTERN_223 } from '../src/domain/schedule';
import { evaluateReadiness } from '../src/domain/readiness';
import { evaluateSafety } from '../src/domain/safety';
import { suggestNext } from '../src/domain/progression';
import { evaluateAdaptation, KCAL_FLOOR } from '../src/domain/adaptation';
import { coach, type DaySnapshot } from '../src/domain/coaching';
import { weeklyStats } from '../src/domain/report';

const products = new Map(SEED_FOODS.map((f) => [f.id, f]));

describe('obliczenia', () => {
  it('BMR = 2152,5 kcal', () => expect(bmrMifflin({ weightKg: 110, heightCm: 190, age: 28, sex: 'male' })).toBe(2152.5));
  it('makro = 2448 kcal', () => expect(macroKcal(165, 80, 267)).toBe(2448));
  it('brak pomiaru nie jest zerem', () => {
    expect(mean([100, undefined, null, 102])).toEqual({ value: 101, n: 2 });
    expect(mean([undefined]).value).toBeNull();
  });
  it('średnie blokowe 7-dniowe nie nakładają się', () => {
    const s = Array.from({ length: 14 }, (_, i) => ({ date: addDays('2026-11-01', i), value: i < 7 ? 110 : 109 }));
    const [b0, b1] = blockAverages(s, '2026-11-14', 2);
    expect(b0).toMatchObject({ value: 109, n: 7, from: '2026-11-08' });
    expect(b1).toMatchObject({ value: 110, n: 7, to: '2026-11-07' });
  });
  it('sen przez północ', () => expect(sleepMinutes('2026-11-22', '23:30', '07:15')).toBe(465));
  it('sen po północy', () => expect(sleepMinutes('2026-11-22', '01:00', '09:00')).toBe(480));
  it('zmiana czasu (25.10.2026): noc o godzinę dłuższa', () => expect(sleepMinutes('2026-10-25', '23:00', '07:00')).toBe(540));
  it('zmiana czasu (29.03.2026): noc o godzinę krótsza', () => expect(sleepMinutes('2026-03-29', '23:00', '07:00')).toBe(420));
  it('lokalna data Warszawa (23:30 UTC = następny dzień)', () => expect(toLocalDate(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02'));
});

describe('żywienie', () => {
  it('szablony A/B/C ≈ 2450 kcal (±2%) i ≥165 g białka', () => {
    for (const d of DAY_TEMPLATES) {
      const t = templateTotals(products, d);
      expect(Math.abs(t.kcal - 2450)).toBeLessThan(49);
      expect(t.protein).toBeGreaterThanOrEqual(165);
    }
  });
  it('przeliczanie porcji x3', () => expect(scaleItems([{ productId: 'rice', grams: 75 }], 3)[0].grams).toBe(225));
  it('dopasowanie do 2300 kcal zachowuje białko dnia', () => {
    const fitted = fitDayToKcal(products, DAY_TEMPLATES[0], 2300);
    expect(Math.abs(templateTotals(products, fitted).kcal - 2300)).toBeLessThan(40);
    expect(Math.abs(templateTotals(products, fitted).protein - templateTotals(products, DAY_TEMPLATES[0]).protein)).toBeLessThan(4);
  });
  it('lista zakupów sumuje gramatury', () => {
    const l = shoppingList(products, [DAY_TEMPLATES[0], DAY_TEMPLATES[0]]);
    expect(l.find((x) => x.productId === 'veg_mix')!.grams).toBe(1100);
  });
});

const custody = { cycleStart: '2026-11-02', overrides: {} as Record<string, boolean> }; // poniedziałek
describe('kalendarz 2-2-3', () => {
  it('wzorzec zgodny z przykładem', () => expect(PATTERN_223.join('')).toBe('11001110011000'));
  it('powtarza się przez wiele miesięcy', () => {
    for (let i = 0; i < 400; i++) {
      const d = addDays('2026-11-02', i);
      expect(withDaughter(custody, d)).toBe(withDaughter(custody, addDays(d, 14)));
    }
  });
  it('domyślny plan: Śr A, Pn B, Pt A, Nd B', () => {
    const p = planWorkouts({ from: '2026-11-02', horizon: 14, custody, sessions: [], perCycle: 4 });
    expect(p.map((x) => `${weekday(x.date)}${x.templateId}`)).toEqual(['2A', '0B', '4A', '6B']);
  });
  it('nigdy w dzień z córką i z odstępem ≥2 dni', () => {
    const p = planWorkouts({ from: '2026-11-02', horizon: 120, custody, sessions: [], perCycle: 4 });
    p.forEach((x, i) => {
      expect(withDaughter(custody, x.date)).toBe(false);
      if (i) expect(new Date(x.date).getTime() - new Date(p[i - 1].date).getTime()).toBeGreaterThanOrEqual(2 * 86400000);
    });
  });
  it('ręczna zmiana dnia opieki aktualizuje grafik', () => {
    const c = { ...custody, overrides: { '2026-11-04': true } };
    const p = planWorkouts({ from: '2026-11-02', horizon: 14, custody: c, sessions: [], perCycle: 4 });
    expect(p.map((x) => x.date)).not.toContain('2026-11-04');
    expect(p[0].date).toBe('2026-11-05');
  });
  it('opuszczony trening nie kumuluje sesji i zachowuje A/B', () => {
    // Śr 4.11 opuszczony, liczymy od Cz 5.11; wcześniej zrobiony B
    const p = planWorkouts({ from: '2026-11-05', horizon: 14, custody, sessions: [{ date: '2026-10-30', templateId: 'B', status: 'completed' }], perCycle: 4 });
    const inCycle = p.filter((x) => x.date <= '2026-11-15');
    expect(inCycle.length).toBeLessThanOrEqual(4);
    expect(p[0]).toEqual({ date: '2026-11-05', templateId: 'A' });
    expect(p[1].templateId).toBe('B');
  });
});

describe('A/B/C i bezpieczeństwo', () => {
  it('silne zmęczenie → C, bez zwiększania intensywności', () => expect(evaluateReadiness({ energy: 1, symptoms: [] }, 'none').level).toBe('C'));
  it('krótki sen → B', () => expect(evaluateReadiness({ sleepMinutes: 320, energy: 3, stress: 8, symptoms: [] }, 'none').level).toBe('B'));
  it('przewlekły stres 8 sam nie zmienia planu', () => expect(evaluateReadiness({ sleepMinutes: 450, energy: 3, stress: 8, symptoms: [] }, 'none').level).toBe('A'));
  it('brak danych ≠ zła ocena', () => expect(evaluateReadiness({ symptoms: [] }, 'none').level).toBe('A'));
  it('ból kolana 6/10 → blokada nóg', () => expect(evaluateSafety({ kneePain: 6, symptoms: [] }, false).level).toBe('stop_legs'));
  it('obrzęk kolana → blokada nóg', () => expect(evaluateSafety({ kneePain: 1, symptoms: ['knee_swelling'] }, true).level).toBe('stop_legs'));
  it('ból w klatce → 112', () => {
    const r = evaluateSafety({ symptoms: ['chest_pain'] }, true);
    expect(r.level).toBe('urgent');
    expect(r.alerts[0].text).toContain('112');
  });
});

describe('progresja', () => {
  const base = { plannedSets: 3, repMin: 10, repMax: 12, increment: 2.5, safetyBlock: false };
  const sets = (r: number[], rir = 2) => r.map((reps) => ({ weightKg: 20, reps, rir, done: true }));
  it('górny zakres + warunki → zwiększenie (skok ≤ 10%)', () => expect(suggestNext({ ...base, increment: 2, last: sets([12, 12, 12]), technique: 'ok' })).toMatchObject({ action: 'increase', weightKg: 22 }));
  // W2: ocena techniki jest opcjonalna; blokuje tylko zgłoszona słabsza technika
  it('górny zakres ze słabszą techniką → bez zwiększenia', () => expect(suggestNext({ ...base, last: sets([12, 12, 12]), technique: 'bad' }).action).toBe('hold'));
  it('niepełne serie → bez zwiększenia, najpierw powtórzenia', () => expect(suggestNext({ ...base, last: sets([12, 12, 11]), technique: 'ok' })).toMatchObject({ action: 'reps', weightKg: 20 }));
  it('ból ≥ 4 → bez automatycznej zmiany ciężaru', () => expect(suggestNext({ ...base, last: [{ weightKg: 20, reps: 12, rir: 2, pain: 5, done: true }], technique: 'ok' })).toMatchObject({ action: 'pain', weightKg: null }));
  it('blokada → pominięcie', () => expect(suggestNext({ ...base, last: sets([12, 12, 12]), technique: 'ok', safetyBlock: true }).action).toBe('skip'));
});

const weights = (start: string, days: number, f: (i: number) => number) => Array.from({ length: days }, (_, i) => ({ date: addDays(start, i), value: f(i) }));
describe('adaptacja redukcji', () => {
  const baseInput = { planStart: '2026-09-01', lastPlanChange: '2026-09-01', kcalTarget: 2450, waists: [], intakeDays: [] as { date: string; kcal: number; target: number }[] };
  it('kalibracja: brak zmian w pierwszych 14 dniach', () => {
    const r = evaluateAdaptation({ ...baseInput, today: '2026-09-10', planStart: '2026-09-01', weights: weights('2026-09-01', 9, () => 110) });
    expect(r.status).toBe('calibration'); expect(r.proposal).toBeUndefined();
  });
  it('waga wzrosła jednego dnia → brak korekty', () => {
    const w = weights('2026-10-01', 28, (i) => 110 - i * 0.08); w[27].value += 1.5;
    expect(evaluateAdaptation({ ...baseInput, today: '2026-10-29', weights: w }).proposal).toBeUndefined();
  });
  it('mało ważeń → brak wniosku', () => {
    const w = weights('2026-10-01', 28, () => 110).filter((_, i) => i % 3 === 0);
    expect(evaluateAdaptation({ ...baseInput, today: '2026-10-29', weights: w }).status).toBe('insufficient_data');
  });
  it('waga stoi, talia maleje → bez obniżania kalorii', () => {
    const r = evaluateAdaptation({ ...baseInput, today: '2026-10-29', weights: weights('2026-10-01', 28, () => 110), waists: [{ date: '2026-10-14', value: 110 }, { date: '2026-10-27', value: 108.5 }] });
    expect(r.status).toBe('slow_waist_down'); expect(r.proposal).toBeUndefined();
  });
  it('potwierdzona stagnacja + kompletne dane → jedna korekta', () => {
    const intake = Array.from({ length: 14 }, (_, i) => ({ date: addDays('2026-10-15', i), kcal: 2440, target: 2450 }));
    const r = evaluateAdaptation({ ...baseInput, today: '2026-10-29', weights: weights('2026-10-01', 28, () => 110), intakeDays: intake });
    expect(r.status).toBe('stagnation');
    expect(r.proposal).toMatchObject({ kind: 'kcal', newKcal: 2300 });
  });
  it('nie schodzi poniżej 2100 kcal', () => {
    const intake = Array.from({ length: 14 }, (_, i) => ({ date: addDays('2026-10-15', i), kcal: 2100, target: 2100 }));
    const r = evaluateAdaptation({ ...baseInput, kcalTarget: KCAL_FLOOR, today: '2026-10-29', weights: weights('2026-10-01', 28, () => 110), intakeDays: intake });
    expect(r.proposal?.kind).toBe('activity');
  });
  it('stagnacja, ale zła realizacja → najpierw sprawdzenie danych', () => {
    const r = evaluateAdaptation({ ...baseInput, today: '2026-10-29', weights: weights('2026-10-01', 28, () => 110), intakeDays: [] });
    expect(r.status).toBe('stagnation_check'); expect(r.proposal).toBeUndefined();
  });
  it('prawidłowe tempo → utrzymaj', () => expect(evaluateAdaptation({ ...baseInput, today: '2026-10-29', weights: weights('2026-10-01', 28, (i) => 110 - i * 0.08) }).status).toBe('on_track'));
});

const snap = (date: string, o: Partial<DaySnapshot> = {}): DaySnapshot => ({ date, workoutPlanned: false, workoutDone: false, withDaughter: false, ...o });
describe('coaching', () => {
  it('brak wpisów → tryb powrotu, bez wniosku o łamaniu diety', () => {
    const days = [snap('2026-11-10', { kcal: 2400 }), ...Array.from({ length: 6 }, (_, i) => snap(addDays('2026-11-11', i)))];
    const r = coach(days, '2026-11-17', 2450);
    expect(r[0].id).toBe('return');
    expect(r.map((x) => x.action).join(' ')).not.toMatch(/głodówk|karne/);
  });
  it('dwa dni przekroczenia → powrót do planu, bez głodówki i karnego cardio', () => {
    const r = coach([snap('2026-11-15', { kcal: 3200, morning: { date: '', symptoms: [], createdAt: 0, updatedAt: 0 } }), snap('2026-11-16', { kcal: 3100 })], '2026-11-17', 2450);
    const o = r.find((x) => x.id === 'over_yesterday')!;
    expect(o.action).toMatch(/Bez odrabiania kalorii i bez karnego cardio/);
  });
  // 0.8: opieka nie ogranicza treningu; o tym, czy dzień był treningowy, decyduje planer (przełożone dni nie są planowane)
  it('niezaplanowane dni nie liczą się jako opuszczony trening', () => {
    const days = Array.from({ length: 7 }, (_, i) => snap(addDays('2026-11-10', i), { workoutPlanned: false, withDaughter: true, kcal: 2400 }));
    expect(coach(days, '2026-11-17', 2450).find((x) => x.id === 'missed_workouts')).toBeUndefined();
  });
  it('raport tygodniowy liczy braki danych', () => {
    const s = weeklyStats([snap('2026-11-16', { kcal: 2400 })], [{ date: '2026-11-16', value: 109 }], [], '2026-11-16');
    expect(s).toMatchObject({ weightN: 1, intakeDays: 1, kcalAvg: 2400, stepsAvg: null });
  });
});

describe('regresja: pierwszy dzień', () => {
  it('brak historii przed startem → brak zarzutu opuszczonych treningów', () => {
    expect(coach([snap('2026-11-22')], '2026-11-22', 2450).find((x) => x.id === 'missed_workouts')).toBeUndefined();
  });
});
